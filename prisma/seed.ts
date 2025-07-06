import { PrismaClient } from '@prisma/client'
import { addDays, addHours } from 'date-fns';

const prisma = new PrismaClient()

async function main() {
  console.log('Start seeding ...');

  // Create Roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {},
    create: {
        name: 'Admin',
        description: 'Administrator with all permissions',
        permissions: [
            'Events:Create', 'Events:Read', 'Events:Update', 'Events:Delete',
            'Attendees:Read', 'Attendees:Update',
            'Reports:Read',
            'Users & Roles:Create', 'Users & Roles:Read', 'Users & Roles:Update', 'Users & Roles:Delete'
        ]
    }
  });

  const organizerRole = await prisma.role.upsert({
    where: { name: 'Organizer' },
    update: {},
    create: {
        name: 'Organizer',
        description: 'Can manage events and attendees',
        permissions: [
            'Events:Create', 'Events:Read', 'Events:Update',
            'Attendees:Read', 'Attendees:Update',
            'Reports:Read'
        ]
    }
  });
  
  console.log(`Created roles: ${adminRole.name}, ${organizerRole.name}`);

  // Create Users
  const adminUser = await prisma.user.upsert({
    where: { phoneNumber: '0912345678' },
    update: {},
    create: {
      id: 'b1e55c84-9055-4eb5-8bd4-a262538f7e66',
      firstName: 'Admin',
      lastName: 'User',
      phoneNumber: '0912345678',
      roleId: adminRole.id
    },
  });

  console.log(`Created admin user: ${adminUser.firstName}`);

  // Clean up existing events to avoid duplicates during re-seeding
  await prisma.event.deleteMany({});

  // Create Events
  const today = new Date();
  
  const event1 = await prisma.event.create({
    data: {
      name: 'Global Tech Summit 2025',
      description: 'Join the brightest minds in technology as we explore the future of AI, quantum computing, and sustainable tech. A 3-day event filled with keynotes, workshops, and networking opportunities.',
      startDate: addDays(today, 30),
      endDate: addDays(today, 32),
      location: 'Metropolis Convention Center',
      category: 'Technology',
      image: ['https://placehold.co/600x400.png'],
      hint: 'technology conference',
      ticketTypes: {
        create: [
          { name: 'General Admission', price: 299.00, total: 1000, sold: 450 },
          { name: 'VIP Pass', price: 799.00, total: 150, sold: 120 },
          { name: 'Student Pass', price: 99.00, total: 200, sold: 85 },
        ]
      },
      promoCodes: {
        create: [
          { code: 'EARLYBIRD25', type: 'PERCENTAGE', value: 25, maxUses: 200, uses: 150 },
          { code: 'TECHSAVE50', type: 'FIXED', value: 50, maxUses: 100, uses: 45 },
        ]
      }
    }
  });
  console.log(`Created event: ${event1.name}`);

  const event2 = await prisma.event.create({
    data: {
      name: 'Summer Soundwave Festival',
      description: 'The ultimate weekend of live music under the sun! Featuring over 50 artists across 4 stages, food trucks, art installations, and more.',
      startDate: addDays(today, 60),
      endDate: addDays(today, 61),
      location: 'Sunshine Valley Park',
      category: 'Music',
      image: ['https://placehold.co/600x400.png'],
      hint: 'music festival',
      ticketTypes: {
        create: [
          { name: 'Weekend Pass', price: 180.00, total: 5000, sold: 2100 },
          { name: 'VIP Weekend', price: 450.00, total: 500, sold: 450 },
          { name: 'Saturday Pass', price: 95.00, total: 1500, sold: 800 },
          { name: 'Sunday Pass', price: 95.00, total: 1500, sold: 650 },
        ]
      }
    }
  });
  console.log(`Created event: ${event2.name}`);
  
  const event3 = await prisma.event.create({
    data: {
      name: 'Art & Soul Exhibition',
      description: 'A curated exhibition showcasing the vibrant works of emerging local artists. Discover new talent, purchase unique pieces, and meet the creators.',
      startDate: addDays(today, 15),
      location: 'The Downtown Gallery',
      category: 'Art',
      image: ['https://placehold.co/600x400.png'],
      hint: 'art gallery',
      ticketTypes: {
        create: [
          { name: 'Standard Entry', price: 25.00, total: 500, sold: 120 },
        ]
      }
    }
  });
  console.log(`Created event: ${event3.name}`);


  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
