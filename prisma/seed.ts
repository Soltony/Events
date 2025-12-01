
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs';
import cuid from 'cuid';

const prisma = new PrismaClient()

async function main() {
  console.log('Start seeding ...');

  const adminPermissions = [
    'Dashboard:Create', 'Dashboard:Read', 'Dashboard:Update', 'Dashboard:Delete',
    'Scan QR:Create', 'Scan QR:Read', 'Scan QR:Update', 'Scan QR:Delete',
    'Events:Create', 'Events:Read', 'Events:Update', 'Events:Delete',
    'Reports:Create', 'Reports:Read', 'Reports:Update', 'Reports:Delete',
    'User Registration:Create', 'User Registration:Read', 'User Registration:Update', 'User Registration:Delete',
    'User Management:Create', 'User Management:Read', 'User Management:Update', 'User Management:Delete',
    'Role Management:Create', 'Role Management:Read', 'Role Management:Update', 'Role Management:Delete',
    'Staff Management:Create', 'Staff Management:Read', 'Staff Management:Update', 'Staff Management:Delete',
  ];

  const staffPermissions = [
    'Dashboard:Read',
    'Scan QR:Read',
  ];

  // Create Roles with granular permissions stored as a JSON string
  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {
      permissions: JSON.stringify(adminPermissions),
    },
    create: {
        name: 'Admin',
        description: 'Administrator with all permissions',
        permissions: JSON.stringify(adminPermissions),
    }
  });

  const staffRole = await prisma.role.upsert({
    where: { name: 'Staff' },
    update: {
      permissions: JSON.stringify(staffPermissions),
    },
    create: {
        name: 'Staff',
        description: 'Staff member with limited permissions for event operations like scanning tickets.',
        permissions: JSON.stringify(staffPermissions),
    }
  });

  const organizerRole = await prisma.role.upsert({
    where: { name: 'Organizer' },
    update: {},
    create: {
      name: 'Organizer',
      description: 'Event organizer with permissions to create and manage their own events.',
      permissions: JSON.stringify([
        'Dashboard:Read',
        'Events:Create',
        'Events:Read',
        'Events:Update',
        'Events:Delete',
        'Reports:Read',
        'Staff Management:Create',
        'Staff Management:Read',
        'Staff Management:Update',
        'Staff Management:Delete',
      ]),
    }
  });
  
  console.log(`Created/updated essential roles: Admin, Staff, Organizer.`);

  // Create Admin User with a hashed password
  const adminPassword = 'Admin@123';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  
  await prisma.user.upsert({
    where: { email: 'admin@example.com' }, // Using email as the unique identifier for upsert
    update: {
        password: hashedPassword,
        phoneNumber: '0912345678',
        roleId: adminRole.id,
    },
    create: {
      id: cuid(),
      firstName: 'Admin',
      lastName: 'User',
      phoneNumber: '0912345678',
      email: 'admin@example.com',
      password: hashedPassword,
      roleId: adminRole.id,
      nibBankAccount: '7000000000000', // Placeholder account
      status: 'ACTIVE',
      passwordChangeRequired: true,
      tokenVersion: 1,
    },
  });

  console.log('Admin user created or updated.');
  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error('An error occurred during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
