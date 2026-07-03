import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from './db';
import { getState, toggleDevice, getUsage } from './devices';
import { getAlerts } from './alerts';
import { startSimulator, broadcastState, simulatorEvents } from './simulator';

dotenv.config();

const app = express();
const port = process.env.BACKEND_PORT || 5000;

// Enable CORS for all origins (dashboard, bot, local scripts)
app.use(cors());
app.use(express.json());

// Log HTTP requests
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.path}`);
  next();
});

// List of all 15 valid device IDs in the system
const VALID_DEVICE_IDS = [
  'drawing-fan-1', 'drawing-fan-2', 'drawing-light-1', 'drawing-light-2', 'drawing-light-3',
  'work1-fan-1', 'work1-fan-2', 'work1-light-1', 'work1-light-2', 'work1-light-3',
  'work2-fan-1', 'work2-fan-2', 'work2-light-1', 'work2-light-2', 'work2-light-3'
];

/**
 * REST: GET /health -> Health check endpoint verifying database connectivity
 */
const handleHealthCheck = async (req: express.Request, res: express.Response) => {
  try {
    // Run simple query to test DB connection
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('[Health] DB Connection check failed:', err);
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: err.message || String(err),
      timestamp: new Date().toISOString()
    });
  }
};
app.get('/health', handleHealthCheck);
app.get('/api/health', handleHealthCheck);

/**
 * REST: GET /devices -> Retrieve all devices
 */
const handleGetDevices = async (req: express.Request, res: express.Response) => {
  try {
    const devices = await getState();
    res.json(devices);
  } catch (err) {
    console.error('Error in GET /devices:', err);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
};
app.get('/devices', handleGetDevices);
app.get('/api/devices', handleGetDevices);

/**
 * REST: GET /rooms/:room -> Retrieve devices filtered by room
 */
const handleGetRoomDevices = async (req: express.Request, res: express.Response) => {
  const { room } = req.params;
  if (!['drawing', 'work1', 'work2'].includes(room)) {
    return res.status(400).json({ error: 'Invalid room. Choose drawing, work1, or work2.' });
  }
  try {
    const devices = await getState();
    const filtered = devices.filter((d) => d.room === room);
    res.json(filtered);
  } catch (err) {
    console.error(`Error in GET /rooms/${room}:`, err);
    res.status(500).json({ error: 'Failed to fetch room devices' });
  }
};
app.get('/rooms/:room', handleGetRoomDevices);
app.get('/api/rooms/:room', handleGetRoomDevices);

/**
 * REST: GET /usage -> Get total and per-room active wattage load
 */
const handleGetUsage = async (req: express.Request, res: express.Response) => {
  try {
    const usage = await getUsage();
    res.json(usage);
  } catch (err) {
    console.error('Error in GET /usage:', err);
    res.status(500).json({ error: 'Failed to compute usage metrics' });
  }
};
app.get('/usage', handleGetUsage);
app.get('/api/usage', handleGetUsage);

/**
 * REST: GET /alerts -> Recompute and get active alerts
 */
const handleGetAlerts = async (req: express.Request, res: express.Response) => {
  try {
    const alerts = await getAlerts();
    res.json(alerts);
  } catch (err) {
    console.error('Error in GET /alerts:', err);
    res.status(500).json({ error: 'Failed to evaluate alert conditions' });
  }
};
app.get('/alerts', handleGetAlerts);
app.get('/api/alerts', handleGetAlerts);

/**
 * REST: POST /devices/:id/toggle -> Manually toggle a device
 */
const handleToggleDevice = async (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  
  // Validate ID against list of seeded devices
  if (!VALID_DEVICE_IDS.includes(id)) {
    return res.status(400).json({ 
      error: `Invalid device ID '${id}'. Expected one of: ${VALID_DEVICE_IDS.join(', ')}` 
    });
  }

  try {
    const updatedDevice = await toggleDevice(id);
    console.log(`[API] Manually toggled ${id} to ${updatedDevice.status}`);
    
    // Broadcast updated state to all connected SSE clients instantly
    await broadcastState();
    
    res.json(updatedDevice);
  } catch (err: any) {
    console.error(`Error in POST /devices/${id}/toggle:`, err);
    res.status(404).json({ error: err.message || 'Failed to toggle device' });
  }
};
app.post('/devices/:id/toggle', handleToggleDevice);
app.post('/api/devices/:id/toggle', handleToggleDevice);

/**
 * SSE: GET /stream -> Stream device status and alerts in real-time
 */
const handleSseStream = async (req: express.Request, res: express.Response) => {
  // Set headers for EventSource compatibility and CORS
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  console.log('[SSE] Connection opened.');

  // Push helper
  const sendUpdate = (payload: any) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  // 1. Send initial state payload immediately on connection
  try {
    const devices = await getState();
    const usage = await getUsage();
    const alerts = await getAlerts();
    sendUpdate({ devices, usage, alerts });
  } catch (err) {
    console.error('[SSE] Error sending initial connection payload:', err);
  }

  // 2. Subscribe to simulator state updates
  const onChange = (payload: any) => {
    try {
      sendUpdate(payload);
    } catch (err) {
      console.error('[SSE] Error writing stream updates:', err);
    }
  };

  simulatorEvents.on('change', onChange);

  // 3. Close listener on disconnect cleanly to prevent memory leaks
  req.on('close', () => {
    console.log('[SSE] Connection closed.');
    simulatorEvents.off('change', onChange);
  });
};
app.get('/stream', handleSseStream);
app.get('/api/stream', handleSseStream);

// Start Express server and simulation loop
app.listen(port, () => {
  console.log(`===============================================`);
  console.log(`   THE BIG BOSS IDEA BACKEND ENERGY RUNNING   `);
  console.log(`   URL: http://localhost:${port}               `);
  console.log(`===============================================`);
  
  startSimulator();
});
