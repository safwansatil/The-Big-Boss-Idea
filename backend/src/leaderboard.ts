import { prisma } from './db';

export interface AlertAggregate {
  room: 'drawing' | 'work1' | 'work2';
  resolved: number;
  unresolved: number;
}

export async function getLeaderboard(): Promise<AlertAggregate[]> {
  const allResolved = await prisma.alertLog.findMany({ where: { resolved: true } });
  const allUnresolved = await prisma.alertLog.findMany({ where: { resolved: false } });

  const rooms = ['drawing', 'work1', 'work2'] as const;

  const result: AlertAggregate[] = rooms.map((room) => {
    const resolved = allResolved.filter((r) => r.room === room).length;
    const unresolved = allUnresolved.filter((r) => r.room === room).length;
    return { room, resolved, unresolved };
  });

  result.sort((a, b) => b.resolved - a.resolved);
  return result;
}
