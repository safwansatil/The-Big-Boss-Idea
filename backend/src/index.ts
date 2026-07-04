import './loadEnv';
import express from 'express';
import cors from 'cors';
import { prisma } from './db';
import { getState, toggleDevice, getUsage } from './devices';
import { getAlerts } from './alerts';
import { startSimulator, broadcastState, simulatorEvents } from './simulator';
import { logger, httpLogger } from './logger';
import { getStuckOnThresholdMs, setStuckOnThresholdMs, validateConfig } from './config';
import rateLimit from 'express-rate-limit';
import { getLeaderboard } from './leaderboard';

const app = express();
const port = process.env.BACKEND_PORT || 5000;

validateConfig();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : ['*'];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes('*')) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(httpLogger);

const VALID_DEVICE_IDS = [
  'drawing-fan-1', 'drawing-fan-2', 'drawing-light-1', 'drawing-light-2', 'drawing-light-3',
  'work1-fan-1', 'work1-fan-2', 'work1-light-1', 'work1-light-2', 'work1-light-3',
  'work2-fan-1', 'work2-fan-2', 'work2-light-1', 'work2-light-2', 'work2-light-3',
];

// --- Rate limiters ---
const alertsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many alert requests, please try again later.' },
});

const usageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many usage requests, please try again later.' },
});

const toggleLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many toggle requests, please try again later.' },
});

const configLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many config requests, please try again later.' },
});

// --- Health ---
const handleHealthCheck = async (_req: express.Request, res: express.Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error({ err }, '[Health] DB Connection check failed');
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: err.message || String(err),
      timestamp: new Date().toISOString(),
    });
  }
};
app.get('/health', handleHealthCheck);
app.get('/api/health', handleHealthCheck);

// --- Devices ---
const handleGetDevices = async (_req: express.Request, res: express.Response) => {
  try {
    const devices = await getState();
    res.json(devices);
  } catch (err) {
    logger.error({ err }, 'Error in GET /devices');
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
};
app.get('/devices', usageLimiter, handleGetDevices);
app.get('/api/devices', usageLimiter, handleGetDevices);

const handleGetRoomDevices = async (req: express.Request, res: express.Response) => {
  const { room } = req.params;
  if (!['drawing', 'work1', 'work2'].includes(room)) {
    return res.status(400).json({ error: 'Invalid room. Choose drawing, work1, or work2.' });
  }
  try {
    const devices = await getState();
    res.json(devices.filter((d) => d.room === room));
  } catch (err) {
    logger.error({ err }, `Error in GET /rooms/${room}`);
    res.status(500).json({ error: 'Failed to fetch room devices' });
  }
};
app.get('/rooms/:room', usageLimiter, handleGetRoomDevices);
app.get('/api/rooms/:room', usageLimiter, handleGetRoomDevices);

// --- Usage ---
const handleGetUsage = async (_req: express.Request, res: express.Response) => {
  try {
    const usage = await getUsage();
    res.json(usage);
  } catch (err) {
    logger.error({ err }, 'Error in GET /usage');
    res.status(500).json({ error: 'Failed to compute usage metrics' });
  }
};
app.get('/usage', usageLimiter, handleGetUsage);
app.get('/api/usage', usageLimiter, handleGetUsage);

// --- Alerts ---
const handleGetAlerts = async (_req: express.Request, res: express.Response) => {
  try {
    const alerts = await getAlerts();
    res.json(alerts);
  } catch (err) {
    logger.error({ err }, 'Error in GET /alerts');
    res.status(500).json({ error: 'Failed to evaluate alert conditions' });
  }
};
app.get('/alerts', alertsLimiter, handleGetAlerts);
app.get('/api/alerts', alertsLimiter, handleGetAlerts);

// --- Leaderboard ---
const handleGetLeaderboard = async (_req: express.Request, res: express.Response) => {
  try {
    const result = await getLeaderboard();
    res.json(result);
  } catch (err) {
    logger.error({ err }, 'Error in GET /leaderboard');
    res.status(500).json({ error: 'Failed to compute leaderboard' });
  }
};
app.get('/leaderboard', handleGetLeaderboard);
app.get('/api/leaderboard', handleGetLeaderboard);

// --- Toggle ---
const handleToggleDevice = async (req: express.Request, res: express.Response) => {
  const { id } = req.params;

  if (!VALID_DEVICE_IDS.includes(id)) {
    return res.status(400).json({ error: `Invalid device ID '${id}'. Expected one of: ${VALID_DEVICE_IDS.join(', ')}` });
  }

  try {
    const prev = await prisma.device.findUnique({ where: { id } });
    if (!prev) throw new Error(`Device with ID ${id} not found.`);

    const updatedDevice = await toggleDevice(id);
    logger.info(`[API] Manually toggled ${id} to ${updatedDevice.status}`);

    await broadcastState('manual');

    res.json({
      ...updatedDevice,
      previousStatus: prev.status,
      previousPower: prev.powerDraw,
      wattsDelta: updatedDevice.powerDraw - prev.powerDraw,
    });
  } catch (err: any) {
    logger.error({ err }, `Error in POST /devices/${id}/toggle`);
    res.status(404).json({ error: err.message || 'Failed to toggle device' });
  }
};
app.post('/devices/:id/toggle', toggleLimiter, handleToggleDevice);
app.post('/api/devices/:id/toggle', toggleLimiter, handleToggleDevice);

// --- Config ---
const handleGetConfig = async (_req: express.Request, res: express.Response) => {
  res.json({ stuckOnThresholdMs: getStuckOnThresholdMs() });
};
app.get('/config', handleGetConfig);
app.get('/api/config', handleGetConfig);

const handlePatchConfig = async (req: express.Request, res: express.Response) => {
  try {
    const body = req.body as { stuckOnThresholdMs?: number };
    if (typeof body.stuckOnThresholdMs !== 'number') {
      return res.status(400).json({ error: 'stuckOnThresholdMs must be a positive number.' });
    }

    setStuckOnThresholdMs(body.stuckOnThresholdMs);
    logger.info('[API] Updated stuckOnThresholdMs', body.stuckOnThresholdMs);

    res.json({ stuckOnThresholdMs: getStuckOnThresholdMs() });
  } catch (err: any) {
    logger.error({ err }, 'Error in PATCH /config');
    res.status(400).json({ error: err.message || 'Invalid config' });
  }
};
app.patch('/config', configLimiter, handlePatchConfig);
app.patch('/api/config', configLimiter, handlePatchConfig);

// --- SSE ---
const handleSseStream = async (req: express.Request, res: express.Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': allowedOrigins.includes('*') ? '*' : String(allowedOrigins[0] ?? '*'),
  });

  logger.info('[SSE] Connection opened.');

  const sendUpdate = (payload: any) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const devices = await getState();
    const usage = await getUsage();
    const alerts = await getAlerts();
    sendUpdate({ devices, usage, alerts });
  } catch (err) {
    logger.error({ err }, '[SSE] Error sending initial connection payload');
  }

  const onChange = (payload: any) => {
    try {
      sendUpdate(payload);
    } catch (err) {
      logger.error({ err }, '[SSE] Error writing stream updates');
    }
  };

  simulatorEvents.on('change', onChange);

  req.on('close', () => {
    logger.info('[SSE] Connection closed.');
    simulatorEvents.off('change', onChange);
  });
};
app.get('/stream', handleSseStream);
app.get('/api/stream', handleSseStream);

// --- Boot ---
app.listen(port, () => {
  logger.info(`Backend running on port ${port}`);
  startSimulator();
});
