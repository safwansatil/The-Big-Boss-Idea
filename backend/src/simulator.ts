import { EventEmitter } from 'events';
import { prisma } from './db';
import { processAlertNotifications } from './alerts';

// EventEmitter to broadcast state updates locally (e.g. to SSE clients)
export const simulatorEvents = new EventEmitter();

let isRunning = false;

/**
 * Starts the randomized simulation loop.
 */
export function startSimulator() {
  if (isRunning) return;
  isRunning = true;
  console.log('[Simulator] Device simulation loop initialized.');
  scheduleNextTick();
}

/**
 * Schedules the next tick with a randomized delay between 5 and 15 seconds.
 */
function scheduleNextTick() {
  const delaySec = Math.floor(Math.random() * (15 - 5 + 1) + 5); // 5 to 15 seconds
  setTimeout(async () => {
    try {
      await tick();
    } catch (err) {
      console.error('[Simulator] Error in simulation tick:', err);
    }
    scheduleNextTick();
  }, delaySec * 1000);
}

/**
 * Executes a single simulation step: toggles 0, 1, or 2 random devices in the DB.
 */
async function tick() {
  const devices = await prisma.device.findMany();
  if (devices.length === 0) {
    console.warn('[Simulator] No devices found in database. Seed the DB first.');
    return;
  }

  const countToToggle = Math.floor(Math.random() * 3); // 0, 1, or 2 devices
  if (countToToggle === 0) {
    return;
  }

  // Shuffle and pick devices
  const shuffled = [...devices].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, countToToggle);

  for (const device of selected) {
    const nextStatus = device.status === 'on' ? 'off' : 'on';
    let nextPower = 0;
    if (nextStatus === 'on') {
      nextPower = device.type === 'fan' ? 60 : 15;
    }

    await prisma.device.update({
      where: { id: device.id },
      data: {
        status: nextStatus,
        powerDraw: nextPower,
        lastChanged: new Date(),
      },
    });

    console.log(`[Simulator] Automatically toggled ${device.id} to ${nextStatus} (${nextPower}W)`);
  }

  // Fetch fresh states
  const freshDevices = await prisma.device.findMany();

  // Process alerts (sends discord webhook alert if new anomalies arise)
  processAlertNotifications(freshDevices).catch((err) => {
    console.error('[Simulator] Error processing alerts:', err);
  });

  // Emit change event to notify active SSE streams
  simulatorEvents.emit('change', freshDevices);
}
