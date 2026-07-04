import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Climb up directory tree to find root .env and load it
let currentDir = __dirname;
let loaded = false;
while (currentDir !== path.parse(currentDir).root) {
  const envPath = path.join(currentDir, '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    loaded = true;
    break;
  }
  currentDir = path.dirname(currentDir);
}
if (!loaded) {
  console.warn('[Seed] Warning: Root .env file was not found.');
}

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing database tables...');
  await prisma.alertLog.deleteMany({});
  await prisma.device.deleteMany({});

  console.log('Seeding 15 office devices with randomized past timestamps...');

  // 15 devices: 3 rooms (drawing, work1, work2), 5 devices per room (2 fans, 3 lights)
  const initialDevices = [
    // Drawing Room (drawing) - Lounge
    { id: 'drawing-fan-1', name: 'Drawing Room Fan 1', type: 'fan', room: 'drawing', status: 'off', powerDraw: 0 },
    { id: 'drawing-fan-2', name: 'Drawing Room Fan 2', type: 'fan', room: 'drawing', status: 'on', powerDraw: 60 },
    { id: 'drawing-light-1', name: 'Drawing Room Light 1', type: 'light', room: 'drawing', status: 'off', powerDraw: 0 },
    { id: 'drawing-light-2', name: 'Drawing Room Light 2', type: 'light', room: 'drawing', status: 'on', powerDraw: 15 },
    { id: 'drawing-light-3', name: 'Drawing Room Light 3', type: 'light', room: 'drawing', status: 'off', powerDraw: 0 },

    // Work Room 1 (work1)
    { id: 'work1-fan-1', name: 'Work Room 1 Fan 1', type: 'fan', room: 'work1', status: 'on', powerDraw: 60 },
    { id: 'work1-fan-2', name: 'Work Room 1 Fan 2', type: 'fan', room: 'work1', status: 'off', powerDraw: 0 },
    { id: 'work1-light-1', name: 'Work Room 1 Light 1', type: 'light', room: 'work1', status: 'on', powerDraw: 15 },
    { id: 'work1-light-2', name: 'Work Room 1 Light 2', type: 'light', room: 'work1', status: 'off', powerDraw: 0 },
    { id: 'work1-light-3', name: 'Work Room 1 Light 3', type: 'light', room: 'work1', status: 'on', powerDraw: 15 },

    // Work Room 2 (work2)
    { id: 'work2-fan-1', name: 'Work Room 2 Fan 1', type: 'fan', room: 'work2', status: 'off', powerDraw: 0 },
    { id: 'work2-fan-2', name: 'Work Room 2 Fan 2', type: 'fan', room: 'work2', status: 'off', powerDraw: 0 },
    { id: 'work2-light-1', name: 'Work Room 2 Light 1', type: 'light', room: 'work2', status: 'on', powerDraw: 15 },
    { id: 'work2-light-2', name: 'Work Room 2 Light 2', type: 'light', room: 'work2', status: 'on', powerDraw: 15 },
    { id: 'work2-light-3', name: 'Work Room 2 Light 3', type: 'light', room: 'work2', status: 'off', powerDraw: 0 },
  ];

  for (const dev of initialDevices) {
    // Generate a random offset between 0 and 4 hours in the past
    const offsetMs = Math.floor(Math.random() * 4 * 60 * 60 * 1000);
    const lastChangedTime = new Date(Date.now() - offsetMs);

    await prisma.device.create({
      data: {
        id: dev.id,
        name: dev.name,
        type: dev.type,
        room: dev.room,
        status: dev.status,
        powerDraw: dev.powerDraw,
        lastChanged: lastChangedTime,
      },
    });
  }

  console.log('Seed completed successfully. 15 devices created.');
}

main()
  .catch((e) => {
    console.error('Error seeding DB:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
