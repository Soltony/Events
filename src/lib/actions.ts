
'use server';

import { revalidatePath } from 'next/cache';
import prisma from './prisma';
import type { Role, User, TicketType, PromoCode, PromoCodeType, Event, Attendee, EventStatus, UserStatus, District, Branch } from '@prisma/client';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import type { DateRange } from 'react-day-picker';
import { randomUUID } from 'crypto';

// Helper to ensure data is serializable
const serialize = (data: any) => JSON.parse(JSON.stringify(data, (key, value) =>
    typeof value === 'bigint'
        ? value.toString()
        : value
));

interface AttendeeTicket {
  id: string;
  userId: string | null;
  phoneNumber: string | null;
  createdAt: Date;
  qrCode: string;
  event: {
    id: string;
    name: string;
    image: string | null;
    startDate: Date;
    endDate: Date | null;
  };
  ticketType: {
    id: string;
    name: string;
  };
}

// --- Permission Definitions ---
const VALID_PERMISSIONS = new Set([
  'Dashboard:Create', 'Dashboard:Read', 'Dashboard:Update', 'Dashboard:Delete',
  'Scan QR:Create', 'Scan QR:Read', 'Scan QR:Update', 'Dashboard:Delete',
  'Events:Create', 'Events:Read', 'Events:Update', 'Events:Delete',
  'Reports:Create', 'Reports:Read', 'Reports:Update', 'Dashboard:Delete',
  'User Registration:Create', 'User Registration:Read', 'User Registration:Update', 'User Registration:Delete',
  'User Management:Create', 'User Management:Read', 'User Management:Update', 'User Management:Delete',
  'Role Management:Create', 'Role Management:Read', 'Role Management:Update', 'Role Management:Delete',
  'Staff Management:Create', 'Staff Management:Read', 'Staff Management:Update', 'Staff Management:Delete',
]);


export async function getCurrentUser(): Promise<(User & { role: Role, branch: Branch | null }) | null> {
  try {
    const cookieStore = cookies();
    const tokenCookie = cookieStore.get('auth_token');

    if (!tokenCookie?.value) {
      return null;
    }
    
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      console.error("JWT_SECRET is not set in environment variables.");
      return null;
    }

    const decoded = jwt.verify(tokenCookie.value, JWT_SECRET) as { userId: string };

    if (!decoded || !decoded.userId) {
        return null;
    }

    const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { 
            role: true,
            branch: true 
        },
    });
    
    return serialize(user);

  } catch(e) {
      console.error("Error decoding token or finding user", e);
      return null;
  }
}


// Event Actions
export async function getEvents(status?: EventStatus | 'all') {
    const user = await getCurrentUser();
    if (!user) {
        return [];
    }

    const isAdmin = user.role.name === 'Admin';
    let whereClause: any = {};

    if (status && status !== 'all') {
        whereClause.status = status;
    }

    if (!isAdmin) {
        whereClause.organizerId = user.id;
    }
    
    const events = await prisma.event.findMany({
        where: whereClause,
        include: {
          organizer: isAdmin ? {
            select: {
              firstName: true,
              lastName: true,
            },
          } : undefined,
        },
        orderBy: { startDate: 'asc' },
    });

    return serialize(events);
}


export async function getPublicEvents(): Promise<(Event & { ticketTypes: TicketType[] })[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const events = await prisma.event.findMany({
        where: {
            status: 'APPROVED',
            OR: [
                {
                    endDate: {
                        gte: today,
                    },
                },
                {
                    endDate: null,
                    startDate: {
                        gte: today,
                    },
                },
            ],
        },
        include: { ticketTypes: true },
        orderBy: { startDate: 'asc' },
    });
    return serialize(events);
}


export async function getEventById(id: number) {
    const event = await prisma.event.findUnique({
        where: { id },
        include: {
            ticketTypes: true,
            organizer: {
                select: {
                    firstName: true,
                    lastName: true,
                },
            },
        },
    });

    if (event) {
        const serializedEvent = serialize(event) as any;
         // Manually construct the organizer name from the fetched fields
        if (serializedEvent.organizer) {
            serializedEvent.organizerName = `${''}${serializedEvent.organizer.firstName || ''} ${''}${serializedEvent.organizer.lastName || ''}`.trim();
        }

        serializedEvent.ticketTypes = serializedEvent.ticketTypes.map((tt: any) => {
            if (tt.locationPrices && typeof tt.locationPrices === 'object') {
                 const normalizedPrices: Record<string, number> = {};
                 for (const [loc, price] of Object.entries(tt.locationPrices)) {
                     if (price !== null && price !== undefined) {
                         normalizedPrices[loc] = parseFloat(price as string);
                     }
                 }
                 tt.locationPrices = normalizedPrices;
            } else {
                 tt.locationPrices = {};
            }
            tt.basePrice = parseFloat(tt.basePrice as any);
            return tt;
        });
        return serializedEvent;
    }

    return null;
}

export async function getEventForTransaction(transactionId: string) {
    const order = await prisma.pendingOrder.findFirst({
        where: {
            OR: [
                { transactionId: transactionId },
                { arifpaySessionId: transactionId }
            ]
        },
        select: { eventId: true }
    });
    return order?.eventId ?? null;
}

export async function getEventDetails(id: number) {
    const user = await getCurrentUser();
    if (!user) {
        throw new Error('User is not authenticated.');
    }
    
    const event = await prisma.event.findUnique({
        where: { id },
        include: {
            ticketTypes: true,
            attendees: {
                include: {
                    ticketType: true,
                }
            },
            promoCodes: true,
        }
    });

    if (!event) return null;

    if (user.role.name !== 'Admin' && event.organizerId !== user.id) {
        throw new Error("You are not authorized to view this event's details.");
    }

    return serialize(event);
}

export async function addEvent(data: any) {
    const { tickets, startDate, endDate, otherCategory, locations, images, ...eventData } = data;
    const user = await getCurrentUser();
    if (!user) {
        throw new Error('User is not authenticated.');
    }

    let nibBankAccount = user.nibBankAccount;

    if (user.role.name === 'Admin' && !nibBankAccount) {
        const defaultAdmin = await prisma.user.findFirst({
            where: { role: { name: 'Admin' } },
            orderBy: { createdAt: 'asc' },
        });
        
        if (defaultAdmin?.nibBankAccount) {
            nibBankAccount = defaultAdmin.nibBankAccount;
        } else {
            console.warn("Admin event creation: Default admin has no NIB account. Event will be created without a bank account, but this may cause payout issues.");
        }
    }
    
    const finalCategory = eventData.category === 'Other' ? otherCategory : eventData.category;
    
    const locationString = locations.map((l: { value: string }) => l.value).join('||');
    
    const imageString = Array.isArray(images) && images.length > 0 ? images[0] : null;

    const newEvent = await prisma.event.create({
        data: {
            ...eventData,
            image: imageString,
            location: locationString,
            organizerId: user.id,
            nibBankAccount: nibBankAccount,
            category: finalCategory,
            startDate: startDate,
            endDate: endDate,
            status: user.role.name === 'Admin' ? 'APPROVED' : 'PENDING',
            rejectionReason: null,
        },
    });

    if (tickets && tickets.length > 0) {
      for (const ticket of tickets) {
        if (ticket.locationPrices && ticket.locationPrices.length > 0) {
            for (const config of ticket.locationPrices) {
                if (config.location && config.price >= 0 && config.quantity >= 0) {
                     await prisma.ticketType.create({
                        data: {
                            name: `${''}${ticket.name} - ${config.location}`,
                            description: ticket.description,
                            basePrice: config.price,
                            total: config.quantity,
                            sold: 0,
                            eventId: newEvent.id,
                            locationPrices: ticket.locationPrices,
                        }
                    });
                }
            }
        }
      }
    }

    revalidatePath('/dashboard/events');
    revalidatePath('/dashboard');
    revalidatePath('/');
    return serialize(newEvent);
}

export async function updateEvent(id: number, data: any) {
    const { startDate, endDate, otherCategory, locations, images, tickets, ...eventData } = data;
    const user = await getCurrentUser();
    if (!user) {
        throw new Error('User is not authenticated.');
    }

    const finalCategory = eventData.category === 'Other' ? otherCategory : eventData.category;
    const locationString = locations.map((l: { value: string }) => l.value).join('||');
    const imageString = Array.isArray(images) && images.length > 0 ? images[0] : null;

    const eventToUpdate = await prisma.event.findUnique({ where: { id }});
    if (!eventToUpdate) throw new Error("Event not found");

    if (user.role.name !== 'Admin' && eventToUpdate.organizerId !== user.id) {
        throw new Error("You are not authorized to update this event.");
    }
    
    const updatedEvent = await prisma.event.update({
        where: { id },
        data: {
            ...eventData,
            image: imageString,
            location: locationString,
            category: finalCategory,
            startDate: startDate,
            endDate: endDate,
            status: user.role.name === 'Admin' ? eventToUpdate.status : 'PENDING',
        }
    });

    revalidatePath('/dashboard/events');
    revalidatePath(`/dashboard/events/${id}`);
    revalidatePath(`/dashboard/events/${id}/edit`);
    revalidatePath(`/events/${id}`);
    revalidatePath('/');

    return serialize(updatedEvent);
}

export async function updateEventStatus(id: number, status: EventStatus, rejectionReason?: string) {
    const user = await getCurrentUser();
    if (!user || user.role.name !== 'Admin') {
        throw new Error("You are not authorized to perform this action.");
    }
    
    const eventToUpdate = await prisma.event.findUnique({ where: { id }});
    if (!eventToUpdate) throw new Error("Event not found");

    const updatedEvent = await prisma.event.update({
        where: { id },
        data: {
            status: status,
            rejectionReason: status === 'REJECTED' ? rejectionReason : null,
        }
    });

    revalidatePath('/dashboard/events');
    revalidatePath('/dashboard');
    revalidatePath(`/dashboard/events/${id}`);
    revalidatePath('/');
    return serialize(updatedEvent);
}

export async function deleteEvent(id: number) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('User is not authenticated.');
  }

  const eventToDelete = await prisma.event.findUnique({ where: { id }});
  if (!eventToDelete) throw new Error("Event not found");

  if (user.role.name !== 'Admin' && eventToDelete.organizerId !== user.id) {
        throw new Error("You are not authorized to delete this event.");
  }

  await prisma.$transaction([
    prisma.attendee.deleteMany({ where: { eventId: id } }),
    prisma.promoCode.deleteMany({ where: { eventId: id } }),
    prisma.ticketType.deleteMany({ where: { eventId: id } }),
    prisma.eventPayment.deleteMany({ where: { eventId: id } }),
    prisma.pendingOrder.deleteMany({ where: { eventId: id } }),
    prisma.event.delete({ where: { id } }),
  ]);
  
  revalidatePath('/dashboard/events');
  revalidatePath('/');
}


export async function addTicketType(eventId: number, data: { name: string; description?: string; locationPrices: { location: string; price: number; quantity: number }[] }) {
    for (const config of data.locationPrices) {
        if (config.location && config.price >= 0 && config.quantity >= 0) {
            await prisma.ticketType.create({
                data: {
                    name: `${data.name} - ${config.location}`,
                    description: data.description,
                    basePrice: config.price,
                    total: config.quantity,
                    sold: 0,
                    eventId: eventId,
                    locationPrices: data.locationPrices,
                }
            });
        }
    }
    revalidatePath(`/dashboard/events/${eventId}`);
}

export async function updateTicketType(ticketTypeId: number, data: any) {
  const updatedTicketType = await prisma.ticketType.update({
    where: { id: ticketTypeId },
    data: {
        name: data.name,
        description: data.description,
        basePrice: data.price,
        total: data.total,
    },
  });
  revalidatePath(`/dashboard/events/${updatedTicketType.eventId}`);
  return serialize(updatedTicketType);
}

export async function deleteTicketType(ticketTypeId: number) {
  const ticketType = await prisma.ticketType.findUnique({ where: { id: ticketTypeId } });
  if (!ticketType) throw new Error('Ticket type not found');

  const attendeeCount = await prisma.attendee.count({ where: { ticketTypeId: ticketTypeId } });
  if (attendeeCount > 0) {
    throw new Error(`Cannot delete ticket type, ${attendeeCount} tickets have already been sold.`);
  }

  await prisma.ticketType.delete({ where: { id: ticketTypeId } });
  revalidatePath(`/dashboard/events/${ticketType.eventId}`);
}


export async function addPromoCode(eventId: number, data: any, allTicketTypes?: TicketType[]) {
    let finalCode = data.code;
    if (data.restrictionType === 'TICKET' && data.ticketTypeId && allTicketTypes) {
        const ticketType = allTicketTypes.find(t => t.id === parseInt(data.ticketTypeId, 10));
        if (ticketType) {
            finalCode = `TICKET:${ticketType.name}:${data.code}`;
        }
    } else if (data.restrictionType === 'LOCATION' && data.location) {
        finalCode = `LOCATION:${data.location}:${data.code}`;
    }

    const newPromoCode = await prisma.promoCode.create({
        data: {
            code: finalCode,
            type: data.type,
            value: data.value,
            maxUses: data.maxUses,
            eventId: eventId,
        }
    });
    revalidatePath(`/dashboard/events/${eventId}`);
    return serialize(newPromoCode);
}

export async function updatePromoCode(promoCodeId: number, data: any, allTicketTypes?: TicketType[]) {
  let finalCode = data.code;
    if (data.restrictionType === 'TICKET' && data.ticketTypeId && allTicketTypes) {
        const ticketType = allTicketTypes.find(t => t.id === parseInt(data.ticketTypeId, 10));
        if (ticketType) {
            finalCode = `TICKET:${ticketType.name}:${data.code}`;
        }
    } else if (data.restrictionType === 'LOCATION' && data.location) {
        finalCode = `LOCATION:${data.location}:${data.code}`;
    }

  const updatedPromoCode = await prisma.promoCode.update({
    where: { id: promoCodeId },
    data: {
        code: finalCode,
        type: data.type,
        value: data.value,
        maxUses: data.maxUses,
    },
  });
  revalidatePath(`/dashboard/events/${updatedPromoCode.eventId}`);
  return serialize(updatedPromoCode);
}

export async function deletePromoCode(promoCodeId: number) {
  const promoCode = await prisma.promoCode.findUnique({ where: { id: promoCodeId } });
  if (!promoCode) throw new Error('Promo code not found');

  if (promoCode.uses > 0) {
    throw new Error('Cannot delete promo code, it has already been used.');
  }

  await prisma.promoCode.delete({ where: { id: promoCodeId } });
  revalidatePath(`/dashboard/events/${promoCode.eventId}`);
}

// Dashboard Actions
export async function getDashboardData() {
    const user = await getCurrentUser();
    if (!user) {
         return {
            totalRevenue: 0,
            totalTicketsSold: 0,
            totalEvents: 0,
            pendingEvents: 0,
            salesData: [],
        };
    }

    const isUserAdmin = user.role.name === 'Admin';
    const organizerFilter = isUserAdmin ? {} : { organizerId: user.id };
    
    const totalEvents = await prisma.event.count({ where: organizerFilter });

    const approvedWhereClause = { ...organizerFilter, status: 'APPROVED' as EventStatus };
    
    const approvedEvents = await prisma.event.findMany({
        where: approvedWhereClause,
        include: {
            ticketTypes: true
        }
    });
    
    const pendingEventsFilter = isUserAdmin ? { status: 'PENDING' as EventStatus } : { organizerId: user.id, status: 'PENDING' as EventStatus };
    const pendingEvents = await prisma.event.count({ where: pendingEventsFilter });
    
    const totalRevenue = approvedEvents.reduce((sum, event) => {
        return sum + event.ticketTypes.reduce((eventSum, tt) => {
            const price = tt.basePrice ? Number(tt.basePrice) : 0;
            return eventSum + (tt.sold * price);
        }, 0);
    }, 0);

    const totalTicketsSold = approvedEvents.reduce((sum, event) => {
        return sum + event.ticketTypes.reduce((eventSum, tt) => eventSum + tt.sold, 0)
    }, 0);
    
    const chartData = approvedEvents.map(event => ({
        name: event.name,
        ticketsSold: event.ticketTypes.reduce((sum, t) => sum + t.sold, 0),
    })).filter(e => e.ticketsSold > 0);

    return serialize({
        totalRevenue,
        totalTicketsSold,
        totalEvents,
        pendingEvents,
        salesData: chartData,
    });
}


// Reports Actions
export async function getReportsData(dateRange?: DateRange, eventNameSearch?: string) {
    const user = await getCurrentUser();
    if (!user) {
        return {
            productSales: [],
            dailySales: [],
            promoCodes: [],
            events: [],
        };
    }

    const whereClause: any = { status: 'APPROVED' };

    if (user.role.name !== 'Admin') {
        whereClause.organizerId = user.id;
    }

    if (dateRange?.from) {
        whereClause.startDate = { ...whereClause.startDate, gte: dateRange.from };
    }
    if (dateRange?.to) {
        whereClause.startDate = { ...whereClause.startDate, lte: dateRange.to };
    }

    if (eventNameSearch) {
        whereClause.name = { contains: eventNameSearch, mode: 'insensitive' };
    }
    
    const events = await prisma.event.findMany({
        where: whereClause,
        include: {
            ticketTypes: true,
            promoCodes: true,
        },
        orderBy: { startDate: 'asc' }
    });

    const allEventsForFilter = await prisma.event.findMany({
        where: user.role.name === 'Admin' ? {} : { organizerId: user.id },
        orderBy: { name: 'asc' }
    });

    const ticketTypes = events.flatMap(e => e.ticketTypes.map(tt => ({ ...tt, event: { name: e.name }, basePrice: tt.basePrice })));
    
    const dailySalesData = events.map(event => {
        const revenue = event.ticketTypes.reduce((sum, t) => sum + (t.sold * Number(t.basePrice)), 0);
        return {
            date: event.startDate,
            eventName: event.name,
            ticketsSold: event.ticketTypes.reduce((sum, t) => sum + t.sold, 0),
            revenue
        }
    });

    const promoCodes = events.flatMap(e => e.promoCodes.map(pc => ({ ...pc, event: { name: e.name } })));
    
    const promoCodeData = promoCodes.map(code => {
        const avgTicketPrice = 50;
        let totalDiscount = 0;
        if (code.type === 'PERCENTAGE') {
            totalDiscount = code.uses * (avgTicketPrice * (Number(code.value) / 100));
        } else {
            totalDiscount = code.uses * Number(code.value);
        }
        return {
            ...code,
            totalDiscount,
        };
    });

    return serialize({
        productSales: ticketTypes.map(p => ({...p, price: p.basePrice, revenue: p.sold * Number(p.basePrice)})),
        dailySales: dailySalesData,
        promoCodes: promoCodeData,
        events: allEventsForFilter,
    });
}

// Settings Actions
export async function getUsersAndRoles() {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return { users: [], roles: [] };
    }
    
    const users = await prisma.user.findMany({
      include: { 
          role: true,
          branch: {
              include: {
                  district: true
              }
          }
      },
      orderBy: { createdAt: 'desc'}
    });
    
    const roles = await prisma.role.findMany();

    return serialize({ users, roles });
}


export async function getUserById(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true },
    });
    return serialize(user);
}


export async function getUserByPhoneNumber(phoneNumber: string) {
    const user = await prisma.user.findUnique({
        where: { phoneNumber },
        include: {
            role: true,
        },
    });
    return serialize(user);
}

export async function getStaffForUser(organizerId: string) {
    const staff = await prisma.user.findMany({
        where: {
            organizerId: organizerId,
        },
        include: {
            role: true,
            branch: {
                include: {
                    district: true
                }
            }
        }
    });

    return serialize(staff);
}

export async function updateUser(userId: string, data: Partial<User>) {
    const { firstName, lastName, phoneNumber, roleId, nibBankAccount, email, branchId } = data;
    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
            firstName,
            lastName,
            phoneNumber,
            roleId,
            branchId: branchId || null,
            nibBankAccount: nibBankAccount || null,
            email: email || null,
        },
    });

    revalidatePath('/dashboard/settings/users');
    revalidatePath(`/dashboard/settings/users/${userId}/edit`);
    return serialize(updatedUser);
}


export async function updateUserRole(userId: string, newRoleId: string) {
    const user = await prisma.user.update({
        where: { id: userId },
        data: { roleId: newRoleId },
    });
    revalidatePath('/dashboard/settings/users');
    return serialize(user);
}

export async function updateUserStatus(userId: string, status: UserStatus) {
    const user = await prisma.user.update({
        where: { id: userId },
        data: { status },
    });
    revalidatePath('/dashboard/settings/users');
    return serialize(user);
}

export async function deleteUser(userId: string, phoneNumber: string) {
  try {
    const count = await prisma.event.count({
      where: { organizerId: userId },
    });

    if (count > 0) {
      return {
        ok: false,
        message: `Cannot delete user. They are the organizer of ${count} event(s). Please delete or reassign the events first.`,
      };
    }
    
    // In a real app with external auth, you'd delete the user there first.
    // For this prototype, we'll just delete from the local DB.
    
    // Also, if this user is an organizer, we might need to delete their staff.
    const userToDelete = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true }
    });

    if (userToDelete?.role?.name === 'Organizer') {
        await prisma.user.deleteMany({
            where: { organizerId: userId }
        });
    }

    await prisma.attendee.deleteMany({ where: { userId }});

    await prisma.user.delete({
      where: { id: userId },
    });
    
    revalidatePath('/dashboard/settings/users');
    
    return { ok: true };
  } catch (err: any) {
    console.error('Error deleting user:', err);

    if (err.code === 'P2003') { 
        return {
            ok: false,
            message: "Cannot delete user. They are still linked to other records in the database (e.g., as an event organizer). Please reassign or delete those records first."
        };
    }

    return {
      ok: false,
      message: err.message ?? "Unexpected server error.",
    };
  }
}



export async function getRoles() {
    try {
        const roles = await prisma.role.findMany();
        return serialize(roles);
    } catch (error: any) {
        console.error("Failed to fetch roles from database:", error);
        throw new Error("Could not load roles. Please check the database connection and try again.");
    }
}

export async function getRoleById(id: string) {
    const role = await prisma.role.findUnique({
        where: { id },
    });
    return serialize(role);
}

export async function createRole(data: { name: string; description: string; permissions: string[] }) {
    const { name, description, permissions } = data;

    // Filter incoming permissions against the valid list
    const sanitizedPermissions = permissions.filter(p => VALID_PERMISSIONS.has(p));

    const role = await prisma.role.create({
        data: {
            name,
            description,
            permissions: sanitizedPermissions.join(','),
        },
    });
    revalidatePath('/dashboard/settings/roles');
    revalidatePath('/dashboard/settings/roles/new');
    return serialize(role);
}

export async function updateRole(id: string, data: Partial<Role> & { permissions: string }) {
    const permissionsArray = Array.isArray(data.permissions) 
        ? data.permissions 
        : (data.permissions || '').split(',');

    // Filter incoming permissions against the valid list
    const sanitizedPermissions = permissionsArray.filter(p => VALID_PERMISSIONS.has(p));

    const role = await prisma.role.update({
        where: { id },
        data: {
            name: data.name,
            description: data.description,
            permissions: sanitizedPermissions.join(','),
        },
    });
    revalidatePath('/dashboard/settings/roles');
    revalidatePath(`/dashboard/settings/roles/${id}/edit`);
    return serialize(role);
}


export async function deleteRole(id: string) {
    const usersWithRole = await prisma.user.count({ where: { roleId: id } });
    if (usersWithRole > 0) {
        throw new Error("Cannot delete role as it is currently assigned to users.");
    }
    const role = await prisma.role.delete({ where: { id } });
    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/settings/roles');
    return serialize(role);
}

export async function updatePasswordFlag(userId: string, passwordChangeRequired: boolean): Promise<void> {
    await prisma.user.update({
        where: { id: userId },
        data: { passwordChangeRequired: passwordChangeRequired },
    });
    revalidatePath('/profile');
}


// Ticket/Attendee Actions
export interface PurchaseRequest {
  eventId: number;
  tickets: { id: number; quantity: number, name: string; price: number }[];
  promoCode?: string;
  attendeeDetails: {
    name: string;
    phone: string;
    email?: string;
    userId?: string;
  };
}

export async function purchaseTickets(request: PurchaseRequest) {
    const { eventId, tickets, promoCode, attendeeDetails } = request;
    const user = await getCurrentUser();

    if (!user && !attendeeDetails.phone) {
        throw new Error("User must be logged in or provide a phone number.");
    }

    return await prisma.$transaction(async (tx) => {
        let totalAmount = 0;
        let discountAmount = 0;

        for (const ticket of tickets) {
            const ticketType = await tx.ticketType.findUnique({ where: { id: ticket.id } });
            if (!ticketType) throw new Error(`Ticket type with ID ${ticket.id} not found.`);
            if ((ticketType.total - ticketType.sold) < ticket.quantity) {
                throw new Error(`Not enough tickets available for "${ticketType.name}".`);
            }
            totalAmount += Number(ticketType.basePrice) * ticket.quantity;
        }

        if (promoCode) {
            const validatedPromo = await validatePromoCode(promoCode, eventId);
            if (!validatedPromo) throw new Error("Invalid or expired promo code.");
            
            if (validatedPromo.type === 'PERCENTAGE') {
                discountAmount = totalAmount * (Number(validatedPromo.value) / 100);
            } else {
                discountAmount = Math.min(totalAmount, Number(validatedPromo.value));
            }
            totalAmount -= discountAmount;

            await tx.promoCode.update({
                where: { id: validatedPromo.id },
                data: { uses: { increment: 1 } }
            });
        }
        
        const finalAmount = totalAmount;
        
        // This is a placeholder for the actual payment gateway interaction
        console.log(`Initiating payment for ${finalAmount.toFixed(2)} ETB...`);
        const paymentSessionId = `MOCK_${''}${randomUUID()}`;

        // Create a single attendee record for the entire purchase
        const firstTicket = tickets[0];
        if (!firstTicket) throw new Error("No tickets in purchase request.");

        const totalQuantity = tickets.reduce((sum, t) => sum + t.quantity, 0);

        const newAttendee = await tx.attendee.create({
            data: {
                name: attendeeDetails.name,
                phoneNumber: attendeeDetails.phone,
                userId: attendeeDetails.userId || user?.id,
                eventId: eventId,
                ticketTypeId: firstTicket.id, // Primary ticket type
                qrCode: randomUUID(),
            }
        });

        // Update ticket counts
        for (const ticket of tickets) {
             await tx.ticketType.update({
                where: { id: ticket.id },
                data: { sold: { increment: ticket.quantity } }
            });
        }
        
        const order = await tx.pendingOrder.create({
            data: {
                arifpaySessionId: paymentSessionId,
                transactionId: paymentSessionId, // Using the same for simplicity in mock
                eventId: eventId,
                ticketTypeId: firstTicket.id,
                attendeeData: {
                    ...attendeeDetails,
                    quantity: totalQuantity,
                    tickets: tickets,
                },
                attendeeId: newAttendee.id,
                status: 'COMPLETED' // Mocking completion
            }
        });

        revalidatePath(`/events/${eventId}`);
        revalidatePath('/dashboard');
        
        return serialize({ success: true, redirectUrl: `/payment/success?session_id=${paymentSessionId}` });
    });
}

export async function getTicketDetailsForConfirmation(identifier: string) {
  const isNumericId = /^\d+$/.test(identifier);

  let whereClause;
  if (isNumericId) {
    whereClause = { id: parseInt(identifier, 10) };
  } else {
    // If not a numeric ID, it could be a transactionId or a qrCode string (UUID)
    const order = await prisma.pendingOrder.findFirst({
      where: {
        OR: [
          { transactionId: identifier },
          { arifpaySessionId: identifier }
        ]
      },
      select: { attendeeId: true }
    });

    if (order && order.attendeeId) {
      whereClause = { id: order.attendeeId };
    } else {
      // Fallback to check if the identifier is a QR code
      whereClause = { qrCode: identifier };
    }
  }

  const attendee = await prisma.attendee.findUnique({
    where: whereClause,
    include: {
      event: true,
      ticketType: true,
    },
  });

  return serialize(attendee);
}




export async function getTicketsForUser(userId?: string, phoneNumber?: string): Promise<AttendeeTicket[]> {
    if (!userId && !phoneNumber) {
        return [];
    }

    const whereClauses: ({ userId: string } | { phoneNumber: string })[] = [];
    if (userId) {
        whereClauses.push({ userId: userId });
    }
    if (phoneNumber) {
        whereClauses.push({ phoneNumber: phoneNumber });
    }

    const attendees = await prisma.attendee.findMany({
        where: {
            OR: whereClauses,
        },
        select: {
            id: true,
            userId: true,
            phoneNumber: true,
            createdAt: true,
            qrCode: true,
            event: {
                select: {
                    id: true,
                    name: true,
                    image: true,
                    startDate: true,
                    endDate: true,
                }
            },
            ticketType: {
                select: {
                    id: true,
                    name: true,
                }
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
    });

    return serialize(attendees);
}



export async function getTicketsByUserId(userId: string | null) {
  if (!userId) {
    return [];
  }
  const tickets = await prisma.attendee.findMany({
    where: { userId },
    include: {
      event: true,
      ticketType: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  return serialize(tickets);
}

export async function validatePromoCode(code: string, eventId: number, location?: string | null, ticketTypesInCart?: { id: number; name: string }[]): Promise<PromoCode | null> {
    const promos = await prisma.promoCode.findMany({
        where: {
            eventId: eventId,
            uses: {
                lt: prisma.promoCode.fields.maxUses
            }
        }
    });

    for (const promo of promos) {
        // No restrictions, just match the code
        if (promo.code === code) return serialize(promo);

        // Check for structured codes
        if (promo.code.includes(':')) {
            const parts = promo.code.split(':');
            const type = parts[0];
            const value = parts[1];
            const actualCode = parts[2];

            if (actualCode === code) {
                if (type === 'TICKET' && ticketTypesInCart) {
                    if (ticketTypesInCart.some(t => t.name === value)) {
                        return serialize(promo);
                    }
                }
                if (type === 'LOCATION' && location) {
                    if (location === value) {
                        return serialize(promo);
                    }
                }
            }
        }
    }

    return null;
}


export async function checkInAttendee(qrCode: string) {
    'use server';
    try {
        const attendee = await prisma.attendee.findUnique({
            where: { qrCode },
            include: { event: true, ticketType: true }
        });

        if (!attendee) {
            return { error: 'Invalid Ticket: This ticket does not exist.' };
        }

        if (attendee.checkedIn) {
            return { data: serialize(attendee), error: 'Already Checked In: This ticket has already been used.' };
        }

        const updatedAttendee = await prisma.attendee.update({
            where: { qrCode },
            data: { checkedIn: true },
            include: { event: true, ticketType: true }
        });
        
        revalidatePath(`/dashboard/events/${attendee.eventId}`);

        return { data: serialize(updatedAttendee) };

    } catch (error) {
        console.error("Check-in error:", error);
        return { error: 'An unexpected error occurred during check-in.' };
    }
}

// Branch and District Actions
export async function createDistrict(data: { districtName: string; contactPersonName: string; contactPersonPhone: string; }) {
  const { districtName, ...rest } = data;
  const district = await prisma.district.create({
    data: {
      name: districtName,
      ...rest,
    },
  });
  revalidatePath('/dashboard/settings/branch-district-registration');
  return serialize(district);
}

export async function createBranch(data: { branchName: string; districtId: string; contactPersonName: string; contactPersonPhone: string; }) {
  const { branchName, ...rest } = data;
  const branch = await prisma.branch.create({
    data: {
      name: branchName,
      ...rest,
    },
  });
  revalidatePath('/dashboard/settings/branch-district-registration');
  return serialize(branch);
}

export async function getDistricts(): Promise<District[]> {
  const districts = await prisma.district.findMany();
  return serialize(districts);
}

export async function getBranches(): Promise<Branch[]> {
  const branches = await prisma.branch.findMany({ include: { district: true }});
  return serialize(branches);
}
