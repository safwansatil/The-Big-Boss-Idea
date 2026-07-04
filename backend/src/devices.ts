import { prisma } from './db';

interface UsagePayload {
  totalWatts: number;
  perRoom: {
    drawing: number;
    work1: number;
    work2: number;
  };
}

/**
 * Returns all 15 devices flat list from database.
 */
export async function getState() {
  return await prisma.device.findMany();
}

/**
 * Toggles status, updates power draw and lastChanged timestamp in database.
 */
export async function toggleDevice(id: string) {
  const device = await prisma.device.findUnique({ where: { id } });
  if (!device) {
    throw new Error(`Device with ID ${id} not found.`);
  }

  const nextStatus = device.status === 'on' ? 'off' : 'on';
  let nextPower = 0;
  if (nextStatus === 'on') {
    nextPower = device.type === 'fan' ? 60 : 15;
  }

  return await prisma.device.update({
    where: { id },
    data: {
      status: nextStatus,
      powerDraw: nextPower,
      lastChanged: new Date(),
    },
  });
}

/**
 * Computes total active wattage and per-room active wattage breakdown.
 */
export async function getUsage(): Promise<UsagePayload> {
  const devices = await prisma.device.findMany();
  const totalWatts = devices.reduce((sum, d) => sum + d.powerDraw, 0);

  const perRoom = {
    drawing: devices.filter((d) => d.room === 'drawing').reduce((sum, d) => sum + d.powerDraw, 0),
    work1: devices.filter((d) => d.room === 'work1').reduce((sum, d) => sum + d.powerDraw, 0),
    work2: devices.filter((d) => d.room === 'work2').reduce((sum, d) => sum + d.powerDraw, 0),
  };

  return { totalWatts, perRoom };
}
