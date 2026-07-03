import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding devices...');

  // Clear existing devices
  await prisma.device.deleteMany({});

  const devices = [
    // Drawing Room (drawing)
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

  for (const device of devices) {
    await prisma.device.create({
      data: {
        ...device,
        lastChanged: new Date(),
      },
    });
  }

  console.log(`Successfully seeded ${devices.length} devices.`);
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
