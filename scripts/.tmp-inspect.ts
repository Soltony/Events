import 'dotenv/config';
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const s = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
(async () => {
  const sess = await prisma.session.findUnique({ where: { id: s.sessionId } });
  console.log('session', JSON.stringify({ revokedAt: sess?.revokedAt, updatedAt: (sess as any)?.updatedAt, lastUsedAt: (sess as any)?.lastUsedAt }));
  const logs = await (prisma as any).auditLog?.findMany?.({ orderBy: { createdAt: 'desc' }, take: 12 }).catch(() => null);
  for (const l of logs ?? []) console.log(l.createdAt?.toISOString?.(), l.action, l.outcome ?? '', JSON.stringify(l.metadata ?? l.details ?? '').slice(0, 160));
  await prisma.$disconnect();
})();
