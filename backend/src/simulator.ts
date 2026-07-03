import { EventEmitter } from 'events';
import { getState, toggleDevice, getUsage } from './devices';
import { getAlerts } from './alerts';

// EventEmitter to broadcast the state shape { devices, usage, alerts } locally
export const simulatorEvents = new EventEmitter();

let isRunning = false;

/**
 * Starts the randomized weighted device simulation.
 */
export function startSimulator() {
  if (isRunning) return;
  isRunning = true;
  console.log('[Simulator] Weighted device simulation loop started.');
  scheduleNextTick();
}

/**
 * Schedules the next tick with a randomized delay between 5 and 15 seconds.
 */
function scheduleNextTick() {
  const delaySec = Math.floor(Math.random() * (15 - 5 + 1) + 5);
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
 * Simulation tick: Toggles 0-2 random devices using workday weightings.
 */
async function tick() {
  const devices = await getState();
  if (devices.length === 0) {
    console.warn('[Simulator] Database is empty. Seed the database first.');
    return;
  }

  const countToSelect = Math.floor(Math.random() * 3); // 0, 1, or 2 devices
  if (countToSelect === 0) {
    return;
  }

  // Weight decision based on current time (Work hours vs After hours)
  const hour = new Date().getHours();
  const isWorkHours = hour >= 9 && hour < 17;

  // Shuffle device list and pick countToSelect devices
  const shuffled = [...devices].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, countToSelect);

  let updatedAny = false;

  for (const dev of selected) {
    const isCurrentlyOn = dev.status === 'on';
    let shouldToggle = false;

    if (isWorkHours) {
      if (isCurrentlyOn) {
        // High likelihood to stay ON (low toggle off chance: 15%)
        shouldToggle = Math.random() < 0.15;
      } else {
        // High likelihood to turn ON (high toggle on chance: 75%)
        shouldToggle = Math.random() < 0.75;
      }
    } else {
      // After-hours (cozy night mode)
      if (isCurrentlyOn) {
        // High likelihood to turn OFF (high toggle off chance: 80%)
        shouldToggle = Math.random() < 0.8;
      } else {
        // Rare chance to turn ON after hours (10%)
        shouldToggle = Math.random() < 0.10;
      }
    }

    if (shouldToggle) {
      await toggleDevice(dev.id);
      console.log(`[Simulator] Auto-toggled ${dev.id} [WorkHours: ${isWorkHours}, Turned: ${dev.status === 'on' ? 'OFF' : 'ON'}]`);
      updatedAny = true;
    }
  }

  // Always broadcast fresh state on every simulation tick
  await broadcastState();
}

/**
 * Fetches all states, computes aggregates, and fires SSE change event.
 */
export async function broadcastState() {
  const devices = await getState();
  const usage = await getUsage();
  const alerts = await getAlerts();

  const payload = {
    devices,
    usage,
    alerts,
  };

  simulatorEvents.emit('change', payload);
}
