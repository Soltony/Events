
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { normalizeEthiopianPhoneStrict } from '../src/lib/utils';
import { PERMISSIONS_GROUPS } from '../src/lib/permissions';

const prisma = new PrismaClient();

async function main() {
  const phoneNumber = process.env.SUPER_ADMIN_BOOTSTRAP_PHONE;
  const password = process.env.SUPER_ADMIN_BOOTSTRAP_PASSWORD;

  if (!phoneNumber || !password) {
    throw new Error(
      'SUPER_ADMIN_BOOTSTRAP_PHONE and SUPER_ADMIN_BOOTSTRAP_PASSWORD must be set in the environment to seed a Super Admin account.'
    );
  }

  // Ensure the permission catalog exists (idempotent — matches prisma/seed.ts's
  // own upsert loop, safe to run standalone if the main seed hasn't run yet).
  const flatPermissions = Object.entries(PERMISSIONS_GROUPS).flatMap(([group, actions]) =>
    actions.map((action) => `${group}:${action}`)
  );
  for (const name of flatPermissions) {
    await prisma.permission.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Provision the reserved "Super Admin" role with every permission.
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'Super Admin' },
    update: {},
    create: {
      name: 'Super Admin',
      description: 'Reserved system role for the single Super Admin account. Cannot be renamed, deleted, or assigned to another account.',
    },
  });

  const allPermissions = await prisma.permission.findMany();
  await prisma.rolePermission.createMany({
    data: allPermissions.map((p) => ({
      roleId: superAdminRole.id,
      permissionId: p.id,
    })),
    skipDuplicates: true,
  });
  console.log('Super Admin role configured with all permissions.');

  const normalizedPhone = normalizeEthiopianPhoneStrict(phoneNumber);
  const hashedPassword = await bcrypt.hash(password, 10);

  const superAdmin = await prisma.superAdmin.upsert({
    where: { phoneNumber: normalizedPhone },
    update: {},
    create: {
      fullName: 'Super Admin',
      phoneNumber: normalizedPhone,
      password: hashedPassword,
      status: 'ACTIVE',
      roleId: superAdminRole.id,
    },
  });

  console.log(`Super Admin account ready: ${superAdmin.phoneNumber}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
