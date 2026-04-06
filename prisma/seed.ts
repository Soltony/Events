
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs';
import cuid from 'cuid';
import { PERMISSIONS_GROUPS } from '../src/lib/permissions';

const prisma = new PrismaClient()

async function main() {
  console.log('Start seeding ...');

  // 1. Clear existing role-related data for a clean seed
  console.log('Clearing old permissions and roles...');
  await prisma.rolePermission.deleteMany({});
  await prisma.permission.deleteMany({});
  
  // Keep the Admin user, but clear out roles that will be recreated
  await prisma.role.deleteMany({
    where: { name: { notIn: ['Admin'] } },
  });
  console.log('Old data cleared.');


  // 2. Seed all permissions from the single source of truth
  console.log('Seeding permissions...');
  const flatPermissions = Object.entries(PERMISSIONS_GROUPS).flatMap(([group, actions]) =>
    actions.map(action => `${group}:${action}`)
  );

  for (const name of flatPermissions) {
    await prisma.permission.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`Seeded ${flatPermissions.length} permissions.`);


  // 3. Re-create Roles and assign permissions
  console.log('Creating roles and assigning permissions...');

  const allPermissionsFromDb = await prisma.permission.findMany();

  // Admin Role (Full Permissions)
  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {},
    create: {
        name: 'Admin',
        description: 'Administrator with all permissions',
    }
  });

  await prisma.rolePermission.createMany({
    data: allPermissionsFromDb.map(p => ({
        roleId: adminRole.id,
        permissionId: p.id,
    })),
    skipDuplicates: true,
  });
  console.log('Admin role configured with all permissions.');
  
  // Organizer Role
  const organizerPermNames = [
    'Dashboard:Access',
    'Events:Create', 'Events:Read', 'Events:Update', 'Events:Delete',
    'Reports:Access',
    'Staff Management:Access',
  ];
  const organizerPerms = await prisma.permission.findMany({ where: { name: { in: organizerPermNames } } });
  
  const organizerRole = await prisma.role.create({
    data: {
      name: 'Organizer',
      description: 'Event organizer with permissions to create and manage their own events.',
    }
  });

  await prisma.rolePermission.createMany({
    data: organizerPerms.map(p => ({ roleId: organizerRole.id, permissionId: p.id })),
  });
  console.log('Organizer role created.');

  // Staff Role
  const staffPermNames = [
    'Dashboard:Access',
    'Scan QR:Access',
  ];
  const staffPerms = await prisma.permission.findMany({ where: { name: { in: staffPermNames } } });

  const staffRole = await prisma.role.create({
    data: {
        name: 'Staff',
        description: 'Staff member with limited permissions for event operations like scanning tickets.',
    }
  });

  await prisma.rolePermission.createMany({
    data: staffPerms.map(p => ({ roleId: staffRole.id, permissionId: p.id })),
  });
  console.log('Staff role created.');


  // 4. Update the Admin User to ensure it has the correct Role ID
  const adminPassword = 'Admin@123';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  
  const existingAdmin = await prisma.user.findFirst({
    where: { role: { name: 'Admin' } },
  });

  if (existingAdmin) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: { roleId: adminRole.id }
    });
    console.log(`Admin user (${existingAdmin.email}) role updated.`);
  } else {
    // Create Admin if it doesn't exist
    await prisma.user.create({
      data: {
        id: cuid(),
        firstName: 'Admin',
        lastName: 'User',
        phoneNumber: '0912345678',
        email: 'admin@example.com',
        password: hashedPassword,
        roleId: adminRole.id,
        nibBankAccount: '7000101672811', // Placeholder account
        status: 'ACTIVE',
        passwordChangeRequired: true,
        tokenVersion: 1,
      },
    });
    console.log('Admin user created.');
  }

  console.log('Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error('An error occurred during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
