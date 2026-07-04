import { EventEmitter } from 'events';
import { getState, toggleDevice, getUsage } from './devices';
import { getAlerts } from './alerts';
import { logger } from './logger';

export const simulatorEvents = new EventEmitter();

let isRunning = false;

export function startSimulator() {
  if (isRunning) return;
  isRunning = true;
  logger.info('[Simulator] Weighted device simulation loop started.');
  scheduleNextTick();
}

function scheduleNextTick() {
  const delaySec = Math.floor(Math.random() * (15 - 5 + 1) + 5);
  setTimeout(async () => {
    try {
      await tick();
    } catch (err) {
      logger.error({ err }, '[Simulator] Error in simulation tick');
    }
    scheduleNextTick();
  }, delaySec * 1000);
}

function getOccupancyWeight(room: string, hour: number): number {
  if (room === 'drawing') {
    if (hour >= 17 && hour < 22) return 1.0;
    if (hour >= 9 && hour < 17) return 0.4;
    if (hour >= 6 && hour < 9) return 0.3;
    return 0.1;
  }

  if (room === 'work1' || room === 'work2') {
    if (hour >= 9 && hour < 17) return 0.9;
    if (hour >= 8 && hour < 9) return 0.4;
    if (hour >= 17 && hour < 19) return 0.2;
    return 0.05;
  }

  return 0.3;
}

async function tick() {
  const devices = await getState();
  if (devices.length === 0) {
    logger.warn('[Simulator] Database is empty. Seed the database first.');
    return;
  }

  const countToSelect = Math.floor(Math.random() * 3);
  if (countToSelect === 0) return;

  const hour = new Date().getHours();
  const isWorkHours = hour >= 9 && hour < 17;

  const shuffled = [...devices].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, countToSelect);

  for (const dev of selected) {
    const isCurrentlyOn = dev.status === 'on';
    const occupancyWeight = getOccupancyWeight(dev.room, hour);
    let shouldToggle = false;

    if (isWorkHours) {
      if (isCurrentlyOn) {
        shouldToggle = Math.random() < 0.15;
      } else {
        shouldToggle = Math.random() < 0.75 * occupancyWeight;
      }
    } else {
      if (isCurrentlyOn) {
        shouldToggle = Math.random() < 0.8;
      } else {
        shouldToggle = Math.random() < 0.10 * occupancyWeight;
      }
    }

    if (shouldToggle) {
      await toggleDevice(dev.id);
      logger.info(`[Simulator] Auto-toggled ${dev.id} in ${dev.room} [WorkHours: ${isWorkHours}, Turned: ${dev.status === 'on' ? 'OFF' : 'ON'}]`);
    }
  }

  await broadcastState();
}

export async function broadcastState() {
  const devices = await getState();
  const usage = await getUsage();
  const alerts = await getAlerts();

  simulatorEvents.emit('change', { devices, usage, alerts });
}
