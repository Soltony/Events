// TEMPORARY (smoke test helper, delete after use). Creates / removes two throwaway accounts.
//   npx tsx scripts/.tmp-e2e-accounts.ts create <out.json>
//   npx tsx scripts/.tmp-e2e-accounts.ts remove <out.json>
import 'dotenv/config';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { normalizeEthiopianPhoneStrict } from '../src/lib/utils';

const prisma = new PrismaClient();
const [mode, out] = process.argv.slice(2);
const USER_PHONE = normalizeEthiopianPhoneStrict('0999000111');
const SA_PHONE = normalizeEthiopianPhoneStrict('0999000222');

async function create() {
  const password = `E2e!${randomBytes(9).toString('base64url')}`;
  const hash = await bcrypt.hash(password, 10);
  const adminRole = await prisma.role.findFirstOrThrow({ where: { name: 'Admin' } });
  const saRoleId = (await prisma.superAdmin.findFirstOrThrow({ where: { status: 'ACTIVE' } })).roleId;
  const user = await prisma.user.create({ data: { firstName: 'E2E', lastName: 'Smoke', phoneNumber: USER_PHONE, password: hash, roleId: adminRole.id } });
  const sa = await prisma.superAdmin.create({ data: { fullName: 'E2E Smoke', phoneNumber: SA_PHONE, password: hash, roleId: saRoleId } });
  fs.writeFileSync(out, JSON.stringify({ password, userPhone: '0999000111', saPhone: '0999000222', userId: user.id, saId: sa.id }));
  console.log('created');
}

async function remove() {
  const s = JSON.parse(fs.readFileSync(out, 'utf8'));
  await prisma.session.deleteMany({ where: { userId: s.userId } });
  await prisma.superAdminSession.deleteMany({ where: { superAdminId: s.saId } });
  await prisma.user.delete({ where: { id: s.userId } });
  await prisma.superAdmin.delete({ where: { id: s.saId } });
  console.log('removed');
}

(mode === 'create' ? create() : remove()).catch((e) => { console.error(e.message ?? e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
