
'use server';

import { revalidatePath } from 'next/cache';
import prisma from './prisma';
import type { Role, User, TicketType, PromoCode, Event, EventStatus, Branch } from '@prisma/client';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import cuid from 'cuid';
import type { DateRange } from 'react-day-picker';
import { randomUUID } from 'crypto';
import { buildPhoneVariants, normalizeEthiopianPhoneStrict, normalizePhoneNumber } from './utils';
import { sendPendingEventNotification, sendTempPassword } from '@/lib/email';
import { hasPermission } from './permissions';

// Roles an Admin (or any user with Users:Create) may assign to a newly
// registered user — excludes Admin/Super Admin to prevent privilege escalation.
const RESTRICTED_ASSIGNABLE_ROLE_NAMES = ['Admin', 'Super Admin'];

const JWT_SECRET = process.env.JWT_SECRET;

// Helper to ensure data is serializable
const serialize = (data: any) => {
    if (!data) return null;
    return JSON.parse(JSON.stringify(data, (key, value) =>
        typeof value === 'bigint'
            ? value.toString()
            : value
    ));
}

export async function getCurrentUser(): Promise<(User & { role: Role; branch: Branch | null }) | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    return null;
  }

  try {
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET is not defined');
    }
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; tokenVersion?: number };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        branch: true,
      },
    });

    if (!user || user.tokenVersion !== decoded.tokenVersion) {
      return null;
    }

    const permissions = user.role.rolePermissions.map(rp => rp.permission.name);

    const { password: _password, ...userWithoutPassword } = user;

    return serialize({
      ...userWithoutPassword,
      role: {
        ...user.role,
        permissions,
      },
    });
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    return null;
  }
}

async function requireAuthenticatedUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Authentication required.');
  }
  return user as User & { role: Role & { permissions: string[] }; branch: Branch | null };
}

async function requirePermission(permission: string) {
  const user = await requireAuthenticatedUser();
  if (!hasPermission(user.role, permission)) {
    throw new Error('Permission denied.');
  }
  return user;
}

async function requireAdmin() {
  const user = await requireAuthenticatedUser();
  if (user.role.name !== 'Admin') {
    throw new Error('Permission denied.');
  }
  return user;
}

// --- User registration (Admin Portal) ---
// Lets a User with Users:Create (e.g. an Admin) register a new User scoped to
// their own branch (no Branch selector), with a required NIB Account field.

export async function getAssignableRoles() {
  await requirePermission('Users:Create');
  return prisma.role.findMany({
    where: { name: { notIn: RESTRICTED_ASSIGNABLE_ROLE_NAMES } },
    orderBy: { name: 'asc' },
  });
}

export async function addUser(data: {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
  roleId: string;
  nibBankAccount: string;
}): Promise<{ success: boolean; error?: string }> {
  const currentUser = await requirePermission('Users:Create');

  try {
    let normalizedPhone: string;
    try {
      normalizedPhone = normalizeEthiopianPhoneStrict(data.phoneNumber);
    } catch (e: any) {
      return { success: false, error: e?.message || 'Invalid phone number.' };
    }

    const existingUserByPhone = await prisma.user.findUnique({ where: { phoneNumber: normalizedPhone } });
    if (existingUserByPhone) {
      return { success: false, error: 'Phone number is already registered.' };
    }

    const existingUserByEmail = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUserByEmail) {
      return { success: false, error: 'Email is already registered.' };
    }

    const role = await prisma.role.findUnique({ where: { id: data.roleId } });
    if (!role || RESTRICTED_ASSIGNABLE_ROLE_NAMES.includes(role.name)) {
      return { success: false, error: 'You are not allowed to assign this role.' };
    }

    const tempPassword = nanoid(10);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    await prisma.user.create({
      data: {
        id: cuid(),
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: normalizedPhone,
        email: data.email,
        password: hashedPassword,
        roleId: data.roleId,
        branchId: currentUser.branchId,
        nibBankAccount: data.nibBankAccount,
        status: 'ACTIVE',
        passwordChangeRequired: true,
        tokenVersion: 1,
      },
    });

    await sendTempPassword({ email: data.email, phoneNumber: normalizedPhone, tempPassword });

    return { success: true };
  } catch (error: any) {
    console.error('Failed to add user:', error);
    if (error.code === 'P2002') {
      if (error.meta?.target?.includes('phoneNumber')) {
        return { success: false, error: 'This phone number is already in use.' };
      }
      if (error.meta?.target?.includes('email')) {
        return { success: false, error: 'This email address is already in use.' };
      }
    }
    return { success: false, error: error.message || 'An unexpected error occurred.' };
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
    const now = new Date();

    const events = await prisma.event.findMany({
        where: {
            status: 'APPROVED',
            OR: [
                {
                    endDate: {
                        gte: now,
                    },
                },
                {
                    endDate: null,
                    startDate: {
                        gte: now,
                    },
                },
            ],
        },
        include: { ticketTypes: true },
        orderBy: { startDate: 'asc' },
    });
    return serialize(events);
}

// --- Homepage carousel ads (admin-managed; not tied to events) ---

export async function getPublicHomeCarouselAds() {
    const ads = await prisma.homeCarouselAd.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
    });
    return serialize(ads) as Array<{
        id: number;
        imageUrl: string;
        title: string | null;
        caption: string | null;
        linkUrl: string | null;
        sortOrder: number;
        isActive: boolean;
    }>;
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
            // Preserve raw location configuration array/object (may include max tickets per phone)
            const rawLp = tt.locationPrices;
            const entries: any[] = Array.isArray(rawLp) ? rawLp : (rawLp && typeof rawLp === 'object' ? rawLp : []);

            // Also keep a normalized price map for compatibility with existing client code
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

            tt.locationConfigs = entries; // new: preserve full config entries (may include maxTicketsPerPhone)
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
    const user = await requirePermission('Events:Create');

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
    
    // Store multiple event images in the existing `image` column.
    // We use JSON so `data:image/...` URIs (which contain commas) are not corrupted.
    const imageString = Array.isArray(images) && images.length > 0 ? JSON.stringify(images) : null;

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

    // Notify Admin(s) if event is PENDING approval
    if (newEvent.status === 'PENDING') {
        try {
            const admins = await prisma.user.findMany({
                where: {
                    role: { name: 'Admin' },
                    AND: [{ email: { not: null } }, { email: { not: '' } }],
                },
                select: { email: true }
            });

            if (admins.length > 0) {
                const organizerName = `${user.firstName} ${user.lastName}`;
                const eventDateFormatted = new Date(startDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                });

                // Send email to all configured admins
                await Promise.all(admins.map(admin => 
                    sendPendingEventNotification({
                        adminEmail: admin.email!,
                        eventName: newEvent.name,
                        organizerName: organizerName,
                        eventDate: eventDateFormatted,
                        eventId: newEvent.id
                    })
                ));
            }
        } catch (emailError) {
            console.error('Failed to notify admins about new pending event:', emailError);
        }
    }

    if (tickets && tickets.length > 0) {
      for (const ticket of tickets) {
        if (ticket.locationPrices && ticket.locationPrices.length > 0) {
            for (const config of ticket.locationPrices) {
                if (config.location && config.price >= 0 && config.quantity >= 0) {
                     await prisma.ticketType.create({
                        data: {
                            name: `${ticket.name} - ${config.location}`,
                            description: ticket.description,
                            basePrice: config.price,
                            total: config.quantity,
                            sold: 0,
                            eventId: newEvent.id,
                            locationPrices: ticket.locationPrices,
                        } as any
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
    const user = await requirePermission('Events:Update');

    const eventToUpdate = await prisma.event.findUnique({ where: { id }});
    if (!eventToUpdate) throw new Error("Event not found");

    const isOwner = eventToUpdate.organizerId === user.id;
    const isAdmin = user.role.name === 'Admin';

    if (!isOwner && !isAdmin) {
        throw new Error("You are not authorized to update this event.");
    }
    
    const finalCategory = eventData.category === 'Other' ? otherCategory : eventData.category;
    const locationString = locations.map((l: { value: string }) => l.value).join('||');
    // Store multiple event images in the existing `image` column.
    // We use JSON so `data:image/...` URIs (which contain commas) are not corrupted.
    const imageString = Array.isArray(images) && images.length > 0 ? JSON.stringify(images) : null;

    const updatedEvent = await prisma.event.update({
        where: { id },
        data: {
            ...eventData,
            image: imageString,
            location: locationString,
            category: finalCategory,
            startDate: startDate,
            endDate: endDate,
            status: isAdmin ? eventToUpdate.status : 'PENDING',
        }
    });

    // Notify Admin(s) if event is PENDING approval after update
    if (updatedEvent.status === 'PENDING' && !isAdmin) {
        try {
            const admins = await prisma.user.findMany({
                where: {
                    role: { name: 'Admin' },
                    AND: [{ email: { not: null } }, { email: { not: '' } }],
                },
                select: { email: true }
            });

            if (admins.length > 0) {
                const organizerName = `${user.firstName} ${user.lastName}`;
                const eventDateFormatted = new Date(startDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                });

                // Send email to all configured admins
                await Promise.all(admins.map(admin => 
                    sendPendingEventNotification({
                        adminEmail: admin.email!,
                        eventName: updatedEvent.name,
                        organizerName: organizerName,
                        eventDate: eventDateFormatted,
                        eventId: updatedEvent.id
                    })
                ));
            }
        } catch (emailError) {
            console.error('Failed to notify admins about updated pending event:', emailError);
        }
    }

    revalidatePath('/dashboard/events');
    revalidatePath(`/dashboard/events/${id}`);
    revalidatePath(`/dashboard/events/${id}/edit`);
    revalidatePath(`/events/${id}`);
    revalidatePath('/');

    return serialize(updatedEvent);
}

export async function updateEventStatus(id: number, status: EventStatus, rejectionReason?: string) {
    const user = await requireAuthenticatedUser();
    if (user.role.name !== 'Admin') {
      throw new Error('Permission denied.');
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
  const user = await requirePermission('Events:Delete');

  const eventToDelete = await prisma.event.findUnique({ where: { id }});
  if (!eventToDelete) throw new Error("Event not found");

  const isOwner = eventToDelete.organizerId === user.id;
  const isAdmin = user.role.name === 'Admin';

  if (!isOwner && !isAdmin) {
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


export async function addTicketType(
  eventId: number,
  data: {
    name: string;
    description?: string;
    locationPrices: { location: string; price: number; quantity: number; maxFreeTicketsPerPhone?: number }[];
  }
) {
    const user = await requirePermission('Events:Update');
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new Error('Event not found');
    if (user.role.name !== 'Admin' && event.organizerId !== user.id) {
      throw new Error('Permission denied.');
    }

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
                } as any
            });
        }
    }
    revalidatePath(`/dashboard/events/${eventId}`);
}

export async function updateTicketType(ticketTypeId: number, data: any) {
  const user = await requirePermission('Events:Update');
  const ticketType = await prisma.ticketType.findUnique({
    where: { id: ticketTypeId },
    select: { eventId: true, locationPrices: true, name: true },
  });
  if (!ticketType) throw new Error('Ticket type not found');
  const event = await prisma.event.findUnique({ where: { id: ticketType.eventId }, select: { organizerId: true } });
  if (!event) throw new Error('Event not found');
  if (user.role.name !== 'Admin' && event.organizerId !== user.id) {
    throw new Error('Permission denied.');
  }

  const parsedLocationFromName =
    typeof data.name === 'string' ? data.name.split(' - ').slice(1).join(' - ') : null;
  const newLocation =
    typeof data.location === 'string'
      ? data.location
      : parsedLocationFromName;
  const currentLocationPrices: any = ticketType.locationPrices;
  const entries: any[] = Array.isArray(currentLocationPrices) ? currentLocationPrices : [];
  const normalizedNewLocation =
    typeof newLocation === 'string' ? newLocation.trim() : null;

  const nextLocationPrices = entries.length
    ? entries.map((entry) => {
        const entryLocation =
          typeof entry?.location === 'string' ? entry.location.trim() : null;
        if (!normalizedNewLocation || entryLocation !== normalizedNewLocation) return entry;
        return {
          ...entry,
          location: entry?.location ?? normalizedNewLocation,
          price: data.price,
          quantity: data.total,
          free: Number(data.price) === 0,
          maxFreeTicketsPerPhone:
            Number(data.price) === 0
              ? data.maxFreeTicketsPerPhone ?? entry?.maxFreeTicketsPerPhone ?? entry?.maxTicketsPerPhone ?? null
              : null,
          // Keep legacy key in sync so enforcement doesn't continue using the old value.
          maxTicketsPerPhone:
            Number(data.price) === 0
              ? data.maxFreeTicketsPerPhone ?? entry?.maxTicketsPerPhone ?? entry?.maxFreeTicketsPerPhone ?? null
              : null,
        };
      })
    : currentLocationPrices;

  const updatedTicketType = await prisma.ticketType.update({
    where: { id: ticketTypeId },
    data: {
        name: data.name,
        description: data.description,
        basePrice: data.price,
        total: data.total,
        locationPrices: nextLocationPrices,
    } as any,
  });
  revalidatePath(`/dashboard/events/${updatedTicketType.eventId}`);
  return serialize(updatedTicketType);
}

export async function deleteTicketType(ticketTypeId: number) {
  const user = await requirePermission('Events:Update');
  const ticketType = await prisma.ticketType.findUnique({ where: { id: ticketTypeId } });
  if (!ticketType) throw new Error('Ticket type not found');
  const event = await prisma.event.findUnique({ where: { id: ticketType.eventId }, select: { organizerId: true } });
  if (!event) throw new Error('Event not found');
  if (user.role.name !== 'Admin' && event.organizerId !== user.id) {
    throw new Error('Permission denied.');
  }

  const attendeeCount = await prisma.attendee.count({ where: { ticketTypeId: ticketTypeId } });
  if (attendeeCount > 0) {
    throw new Error(`Cannot delete ticket type, ${attendeeCount} tickets have already been sold.`);
  }

  await prisma.ticketType.delete({ where: { id: ticketTypeId } });
  revalidatePath(`/dashboard/events/${ticketType.eventId}`);
}


export async function addPromoCode(eventId: number, data: any, allTicketTypes?: TicketType[]) {
    const user = await requirePermission('Events:Update');

    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { organizerId: true } });
    if (!event) throw new Error('Event not found.');
    if (user.role.name !== 'Admin' && event.organizerId !== user.id) {
        throw new Error('Permission denied.');
    }

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
    const user = await requirePermission('Events:Update');

    const existing = await prisma.promoCode.findUnique({ where: { id: promoCodeId }, select: { eventId: true } });
    if (!existing) throw new Error('Promo code not found.');

    const event = await prisma.event.findUnique({ where: { id: existing.eventId }, select: { organizerId: true } });
    if (!event) throw new Error('Associated event not found.');
    if (user.role.name !== 'Admin' && event.organizerId !== user.id) {
        throw new Error('Permission denied.');
    }

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
        const user = await requirePermission('Events:Update');

        const promoCode = await prisma.promoCode.findUnique({ where: { id: promoCodeId }, select: { eventId: true, uses: true } });
        if (!promoCode) throw Error('Promo code not found');

        const event = await prisma.event.findUnique({ where: { id: promoCode.eventId }, select: { organizerId: true } });
        if (!event) throw new Error('Associated event not found.');
        if (user.role.name !== 'Admin' && event.organizerId !== user.id) {
                throw new Error('Permission denied.');
        }

        if (promoCode.uses > 0) {
                throw new Error('Cannot delete promo code, it has already been used.');
        }

        await prisma.promoCode.delete({ where: { id: promoCodeId } });
        revalidatePath(`/dashboard/events/${promoCode.eventId}`);
        return { ok: true };
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
export async function updatePasswordFlag(userId: string, passwordChangeRequired: boolean): Promise<void> {
    const current = await requireAuthenticatedUser();
    if (current.id !== userId && current.role.name !== 'Admin') {
        throw new Error('Permission denied.');
    }
    await prisma.user.update({
        where: { id: userId },
        data: { passwordChangeRequired: passwordChangeRequired },
    });
    revalidatePath('/profile');
}


// Ticket/Attendee Actions
export async function purchaseTickets(request: {
  eventId: number;
  tickets: { id: number; quantity: number, name: string; price: number }[];
  promoCode?: string;
  attendeeDetails: {
    name: string;
    phone: string;
    email?: string;
    userId?: string;
  };
}) {
    const { eventId, tickets, promoCode, attendeeDetails } = request;
    const user = await getCurrentUser();

    if (!user && !attendeeDetails.phone) {
        throw new Error("User must be logged in or provide a phone number.");
    }

    let normalizedPhone: string | null = null;
    if (attendeeDetails.phone) {
        normalizedPhone = normalizeEthiopianPhoneStrict(attendeeDetails.phone);
    }

    const totalRequestedQuantity = tickets.reduce((sum, t) => sum + Number(t.quantity ?? 0), 0);

    return await prisma.$transaction(async (tx) => {
        let totalAmount = 0;
        let discountAmount = 0;
        // Free ticket support:
        // If all selected ticket tiers have base price of 0, skip payment pages and go straight to confirmation.
        let allSelectedFree = true;
        const phoneForLimit = normalizedPhone ?? attendeeDetails.phone;

        for (const ticket of tickets) {
            const ticketType = await tx.ticketType.findUnique({ where: { id: ticket.id } });
            if (!ticketType) throw new Error(`Ticket type with ID ${ticket.id} not found.`);
            if ((ticketType.total - ticketType.sold) < ticket.quantity) {
                throw new Error(`Not enough tickets available for "${ticketType.name}".`);
            }
            totalAmount += Number(ticketType.basePrice) * ticket.quantity;
            allSelectedFree = allSelectedFree && Number(ticketType.basePrice) === 0;

                        // Per-user limit enforcement (supports legacy maxFreeTicketsPerPhone and new maxTicketsPerPhone)
                        const locationFromName =
                            typeof (ticketType as any).name === 'string'
                                ? String((ticketType as any).name).split(' - ').slice(1).join(' - ')
                                : null;

                        const lp = (ticketType as any).locationPrices ?? (ticketType as any).locationConfigs ?? [];
                        const entries: any[] = Array.isArray(lp) ? lp : [];

                        const normalizedLocation = locationFromName ? String(locationFromName).trim() : null;
                        const matched = normalizedLocation
                            ? entries.find(e => (e?.location ? String(e.location).trim() : null) === normalizedLocation)
                            : entries[0];

                        const max = (matched?.maxTicketsPerPhone ?? matched?.maxFreeTicketsPerPhone) as number | null | undefined;
                        if (typeof max === 'number' && max > 0 && phoneForLimit) {
                            // Count already claimed tickets for this phone across the event (this treats the limit as an event-level cap)
                            const alreadyClaimed = await tx.attendee.count({
                                where: {
                                    phoneNumber: phoneForLimit,
                                    eventId: eventId,
                                },
                            });

                            // Use totalRequestedQuantity to account for all tickets in this purchase
                            if (alreadyClaimed + totalRequestedQuantity > max) {
                                throw new Error('Ticket limit exceeded for this user');
                            }
                        }
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

        const totalQuantity = totalRequestedQuantity;

        const newAttendee = await tx.attendee.create({
            data: {
                name: attendeeDetails.name,
                phoneNumber: normalizedPhone ?? attendeeDetails.phone,
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
                    phone: normalizedPhone ?? attendeeDetails.phone,
                    quantity: totalQuantity,
                    tickets: tickets,
                },
                attendeeId: newAttendee.id,
                status: 'COMPLETED' // Mocking completion
            }
        });

        revalidatePath(`/events/${eventId}`);
        revalidatePath('/dashboard');
        
        return serialize({
            success: true,
            redirectUrl: allSelectedFree ? `/ticket/${newAttendee.id}/confirmation` : `/payment/success?session_id=${paymentSessionId}`
        });
    });
}

export async function getTicketDetailsForConfirmation(identifier: string) {
    const isNumericId = /^\d+$/.test(identifier);

    let whereClause;
    if (isNumericId) {
        whereClause = { id: parseInt(identifier, 10) };
    } else {
        // If it's not numeric, assume it's a transactionId from the payment success page
        const order = await prisma.pendingOrder.findFirst({
            where: { 
                OR: [
                    { transactionId: identifier },
                    { arifpaySessionId: identifier }
                ]
             },
        });
        if (!order || !order.attendeeId) return null;
        whereClause = { id: order.attendeeId };
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

export async function getTicketsForUser(
  requester: { id: string; role: { name: string }; phoneNumber?: string } | null,
  userId?: string,
  phoneNumber?: string
) {
    const authRequester = requester ?? await requireAuthenticatedUser();

    if (!userId && !phoneNumber) {
        return [];
    }

    // Only allow requesting your own tickets unless you're Admin.
    if (authRequester.role.name !== 'Admin') {
        if (userId && userId !== authRequester.id) {
            throw new Error('Permission denied.');
        }
        // Phone-number lookups:
        // - Admin: allowed
        // - Guest: allowed only for the authenticated guest's own phone number
        if (phoneNumber) {
            const isGuest = authRequester.role.name === 'Guest';
            if (!isGuest) {
                throw new Error('Permission denied.');
            }

            const requesterPhone = authRequester.phoneNumber;
            if (!requesterPhone) {
                throw new Error('Permission denied.');
            }

            const providedVariants = buildPhoneVariants(phoneNumber);
            const requesterVariants = buildPhoneVariants(requesterPhone);
            const phoneMatches = providedVariants.some(v => requesterVariants.includes(v));
            if (!phoneMatches) {
                throw new Error('Permission denied.');
            }
        }
    }

    const whereClauses: any[] = [];
    if (userId) {
        whereClauses.push({ userId: userId });
    }

    if (phoneNumber) {
        const phoneVariants = buildPhoneVariants(phoneNumber);
        if (phoneVariants.length > 0) {
            whereClauses.push({ phoneNumber: { in: phoneVariants } });
        } else {
            const normalized = normalizePhoneNumber(phoneNumber);
            if (normalized) {
                whereClauses.push({ phoneNumber: normalized });
            }
        }
    }

    if (whereClauses.length === 0) {
        return [];
    }

    const attendees = await prisma.attendee.findMany({
        where: {
            OR: whereClauses,
        },
        include: {
            event: true,
            ticketType: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });

    return serialize(attendees);
}


export async function getTicketsByUserId(userId: string | null) {
  const requester = await requireAuthenticatedUser();
  if (!userId) return [];

  if (requester.role.name !== 'Admin' && requester.id !== userId) {
    throw new Error('Permission denied.');
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


export async function checkInAttendee(attendeeIdentifier: number | string) {
    'use server';
    try {
        const user = await requirePermission('Scan QR:Access');

        const normalizedIdentifier =
            typeof attendeeIdentifier === 'number'
                ? attendeeIdentifier.toString()
                : attendeeIdentifier?.trim();

        if (!normalizedIdentifier) {
            return { error: 'Invalid Ticket: QR data is missing.' };
        }

        const isNumericId = /^\d+$/.test(normalizedIdentifier);

        const attendee = await prisma.attendee.findUnique({
            where: isNumericId
                ? { id: parseInt(normalizedIdentifier, 10) }
                : { qrCode: normalizedIdentifier },
            include: { event: true, ticketType: true }
        });

        if (!attendee) {
            return { error: 'Invalid Ticket: This ticket does not exist.' };
        }

        // Non-admins can only check in attendees for their own events
        if (user.role.name !== 'Admin' && attendee.event.organizerId !== user.id) {
            return { error: 'Permission denied.' };
        }

        if (attendee.checkedIn) {
            return { data: serialize(attendee), error: 'Already Checked In: This ticket has already been used.' };
        }

        const updatedAttendee = await prisma.attendee.update({
            where: { id: attendee.id },
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

