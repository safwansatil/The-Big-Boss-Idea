import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from './db';
import { startSimulator, simulatorEvents } from './simulator';
import { computeAlerts, processAlertNotifications } from './alerts';

dotenv.config();

const app = express();
const port = process.env.BACKEND_PORT || 5000;

app.use(cors());
app.use(express.json());

// Logger middleware
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.path}`);
  next();
});

/**
 * REST: Get all devices
 */
app.get('/api/devices', async (req, res) => {
  try {
    const devices = await prisma.device.findMany();
    res.json(devices);
  } catch (err) {
    console.error('Error fetching devices:', err);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

/**
 * REST: Get devices by room
 */
app.get('/api/rooms/:room', async (req, res) => {
  const { room } = req.params;
  if (!['drawing', 'work1', 'work2'].includes(room)) {
    return res.status(400).json({ error: 'Invalid room name. Choose drawing, work1, or work2' });
  }
  try {
    const devices = await prisma.device.findMany({ where: { room } });
    res.json(devices);
  } catch (err) {
    console.error(`Error fetching devices for room ${room}:`, err);
    res.status(500).json({ error: 'Failed to fetch room devices' });
  }
});

/**
 * REST: Get active energy usage summary
 */
app.get('/api/usage', async (req, res) => {
  try {
    const devices = await prisma.device.findMany();
    const totalWatts = devices.reduce((sum, d) => sum + d.powerDraw, 0);
    
    const perRoom = {
      drawing: devices.filter(d => d.room === 'drawing').reduce((sum, d) => sum + d.powerDraw, 0),
      work1: devices.filter(d => d.room === 'work1').reduce((sum, d) => sum + d.powerDraw, 0),
      work2: devices.filter(d => d.room === 'work2').reduce((sum, d) => sum + d.powerDraw, 0),
    };

    res.json({ totalWatts, perRoom });
  } catch (err) {
    console.error('Error computing energy usage:', err);
    res.status(500).json({ error: 'Failed to compute usage' });
  }
});

/**
 * REST: Get current computed alerts
 */
app.get('/api/alerts', async (req, res) => {
  try {
    const devices = await prisma.device.findMany();
    const activeAlerts = computeAlerts(devices);
    res.json(activeAlerts);
  } catch (err) {
    console.error('Error computing alerts:', err);
    res.status(500).json({ error: 'Failed to compute alerts' });
  }
});

/**
 * REST: Manual toggle device status
 */
app.post('/api/devices/:id/toggle', async (req, res) => {
  const { id } = req.params;
  try {
    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const nextStatus = device.status === 'on' ? 'off' : 'on';
    let nextPower = 0;
    if (nextStatus === 'on') {
      nextPower = device.type === 'fan' ? 60 : 15;
    }

    const updatedDevice = await prisma.device.update({
      where: { id },
      data: {
        status: nextStatus,
        powerDraw: nextPower,
        lastChanged: new Date(),
      },
    });

    console.log(`[API] Manually toggled device ${id} to ${nextStatus} (${nextPower}W)`);

    // Fetch fresh states to notify
    const freshDevices = await prisma.device.findMany();

    // Trigger alerts checks (sends webhook if a new alert condition arises)
    processAlertNotifications(freshDevices).catch((err) => {
      console.error('[API] Error processing alerts:', err);
    });

    // Broadcast update to all SSE subscribers
    simulatorEvents.emit('change', freshDevices);

    res.json(updatedDevice);
  } catch (err) {
    console.error(`Error toggling device ${id}:`, err);
    res.status(500).json({ error: 'Failed to toggle device' });
  }
});

/**
 * SSE: Stream real-time device updates and alerts
 */
app.get('/api/stream', async (req, res) => {
  // Set headers for Server-Sent Events (SSE)
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  console.log('[SSE] Client connected to real-time event stream.');

  // Helper to package and send data
  const sendUpdate = (devicesList: any[]) => {
    const alertsList = computeAlerts(devicesList);
    const data = JSON.stringify({ devices: devicesList, alerts: alertsList });
    res.write(`data: ${data}\n\n`);
  };

  // 1. Send initial state immediately
  try {
    const initialDevices = await prisma.device.findMany();
    sendUpdate(initialDevices);
  } catch (err) {
    console.error('[SSE] Error sending initial state:', err);
  }

  // 2. Subscribe to change events
  const onChange = (freshDevices: any[]) => {
    try {
      sendUpdate(freshDevices);
    } catch (err) {
      console.error('[SSE] Error writing stream updates:', err);
    }
  };

  simulatorEvents.on('change', onChange);

  // 3. Handle connection close
  req.on('close', () => {
    console.log('[SSE] Client disconnected.');
    simulatorEvents.off('change', onChange);
  });
});

// Start Express server and Simulator
app.listen(port, () => {
  console.log(`===============================================`);
  console.log(`   THE BIG BOSS IDEA BACKEND SERVER RUNNING    `);
  console.log(`   URL: http://localhost:${port}               `);
  console.log(`===============================================`);
  
  // Start simulation loop
  startSimulator();
});
