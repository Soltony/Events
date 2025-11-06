
import { PrismaClient } from '@prisma/client'
import { addDays } from 'date-fns';
import crypto from 'crypto';

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
  ];

  // Create Roles with granular permissions
  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {
      description: 'Administrator with all permissions',
      permissions: JSON.stringify(adminPermissions),
    },
    create: {
        name: 'Admin',
        description: 'Administrator with all permissions',
        permissions: JSON.stringify(adminPermissions),
    }
  });
  
  console.log(`Created role: ${adminRole.name}`);

  // Create Users
  const adminUser = await prisma.user.upsert({
    where: { phoneNumber: '0900000000' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000000', // Placeholder ID for seed user
      firstName: 'Admin',
      lastName: 'User',
      phoneNumber: '0900000000',
      roleId: adminRole.id,
      nibBankAccount: '7000000000000'
    },
  });

  console.log('Admin user created or updated.');

  // This section will only run in non-production environments to prevent accidental data loss.
  if (process.env.NODE_ENV !== 'production') {
    console.log('Running in non-production environment, cleaning and seeding events...');
    // Clean up existing events to avoid duplicates during re-seeding
    await prisma.attendee.deleteMany({});
    await prisma.promoCode.deleteMany({});
    await prisma.ticketType.deleteMany({});
    await prisma.pendingOrder.deleteMany({}); 
    await prisma.event.deleteMany({});

    // Create Events, Tickets, Promos, and Attendees within a single transaction
    await prisma.$transaction(async (tx) => {
      const today = new Date();
      
      const event1 = await tx.event.create({
        data: {
          name: 'Global Tech Summit 2025',
          description: 'Join the brightest minds in technology as we explore the future of AI, quantum computing, and sustainable tech. A 3-day event filled with keynotes, workshops, and networking opportunities.',
          startDate: addDays(today, 30),
          endDate: addDays(today, 32),
          location: 'Metropolis Convention Center',
          category: 'Technology',
          status: 'APPROVED',
          image: '/image/3.jpg',
          hint: 'technology conference',
          organizerId: adminUser.id,
          nibBankAccount: '7000000000001',
          ticketTypes: {
            create: [
              { name: 'General Admission', basePrice: 299.00, total: 1000, sold: 450, description: 'Access to all keynotes and general sessions.', locationPrices: {} },
              { name: 'VIP Pass', basePrice: 799.00, total: 150, sold: 120, description: 'Includes VIP lounge access, exclusive networking events, and premium seating.', locationPrices: {} },
              { name: 'Student Pass', basePrice: 99.00, total: 200, sold: 85, description: 'For currently enrolled students. Valid student ID required.', locationPrices: {} },
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
      console.log('Created event 1.');

      const event2 = await tx.event.create({
        data: {
          name: 'Summer Soundwave Festival',
          description: 'The ultimate weekend of live music under the sun! Featuring over 50 artists across 4 stages, food trucks, art installations, and more.',
          startDate: addDays(today, 60),
          endDate: addDays(today, 61),
          location: 'Sunshine Valley Park',
          category: 'Music',
          status: 'APPROVED',
          image: '/image/1.jpg',
          hint: 'music festival concert',
          organizerId: adminUser.id,
          nibBankAccount: '7000000000002',
          ticketTypes: {
            create: [
              { name: 'Weekend Pass', description: 'Full access for both Saturday and Sunday.', basePrice: 180.00, total: 5000, sold: 2100, locationPrices: {} },
              { name: 'VIP Weekend', description: 'VIP area access, private bars, and premium viewing.', basePrice: 450.00, total: 500, sold: 450, locationPrices: {} },
              { name: 'Saturday Pass', description: 'Access to all shows on Saturday.', basePrice: 95.00, total: 1500, sold: 800, locationPrices: {} },
              { name: 'Sunday Pass', description: 'Access to all shows on Sunday.', basePrice: 95.00, total: 1500, sold: 650, locationPrices: {} },
            ]
          }
        }
      });
      console.log('Created event 2.');
      
      const event3 = await tx.event.create({
        data: {
          name: 'Art & Soul Exhibition',
          description: 'A curated exhibition showcasing the vibrant works of emerging local artists. Discover new talent, purchase unique pieces, and meet the creators.',
          startDate: addDays(today, 15),
          endDate: addDays(today, 15),
          location: 'The Downtown Gallery',
          category: 'Art',
          status: 'APPROVED',
          image: '/image/2.jpg',
          hint: 'art gallery',
          organizerId: adminUser.id,
          nibBankAccount: '7000000000003',
          ticketTypes: {
            create: [
              { name: 'Standard Entry', basePrice: 25.00, total: 500, sold: 120, description: 'General entry to the exhibition.', locationPrices: {} },
            ]
          }
        }
      });
      console.log('Created event 3.');
      
      const event1Tickets = await tx.ticketType.findMany({ where: { eventId: event1.id } });
      
      const generalTicketId = event1Tickets.find(t => t.name === 'General Admission')?.id;
      const vipTicketId = event1Tickets.find(t => t.name === 'VIP Pass')?.id;

      if (generalTicketId && vipTicketId) {
        // Create Attendees
        await tx.attendee.createMany({
            data: [
              {
                  name: 'John Doe',
                  phoneNumber: '0911111111',
                  eventId: event1.id,
                  ticketTypeId: generalTicketId,
                  userId: adminUser.id,
                  checkedIn: true,
                  qrCode: crypto.randomUUID(),
              },
              {
                  name: 'Jane Smith',
                  phoneNumber: '0922222222',
                  eventId: event1.id,
                  ticketTypeId: vipTicketId,
                  userId: adminUser.id,
                  checkedIn: false,
                  qrCode: crypto.randomUUID(),
              }
            ]
        });
        console.log('Created attendees for Tech Summit.');
      }
    });

  } else {
    console.log('Skipping event seeding in production environment.');
  }


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

    

    