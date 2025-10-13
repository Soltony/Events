
'use server';

import { revalidatePath } from 'next/cache';
import prisma from './prisma';
import type { Role, User, TicketType, PromoCode, PromoCodeType, Event, Attendee, EventStatus, UserStatus } from '@prisma/client';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { DateRange } from 'react-day-picker';
import { randomBytes } from 'crypto';

// Helper to ensure data is serializable
const serialize = (data: any) => JSON.parse(JSON.stringify(data, (key, value) =>
    typeof value === 'bigint'
        ? value.toString()
        : value
));

export async function getCurrentUser(): Promise<(User & { role: Role }) | null> {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get('authTokens');

    if (!tokenCookie?.value) {
      return null;
    }
    
    const tokenData = JSON.parse(tokenCookie.value);
    const token = tokenData.accessToken;

    if (!token) {
        return null;
    }

    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) {
        return null;
    }

    const decodedJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
    const decoded = JSON.parse(decodedJson);

    if (!decoded || typeof decoded === 'string' || !decoded.sub) {
        return null;
    }

    const userId = decoded.sub;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true },
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
        },
    });

    if (event) {
        event.ticketTypes = event.ticketTypes.map(tt => {
            const ticketType = { ...tt } as any;
            if (ticketType.locationPrices && typeof ticketType.locationPrices === 'object') {
                 const normalizedPrices: Record<string, number> = {};
                 for (const [loc, price] of Object.entries(ticketType.locationPrices)) {
                     if (price !== null && price !== undefined) {
                         normalizedPrices[loc] = parseFloat(price as string);
                     }
                 }
                 ticketType.locationPrices = normalizedPrices;
            } else {
                 ticketType.locationPrices = {};
            }
            ticketType.basePrice = parseFloat(ticketType.basePrice as any);
            return ticketType;
        });
    }

    return serialize(event);
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

    if (user.role.name !== 'Admin' && !nibBankAccount) {
        throw new Error('You must have a NIB Account set in your profile to create an event.');
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
      const multipleLocations = Array.isArray(locations) && locations.length > 1;
      for (const ticket of tickets) {
        if (multipleLocations) {
            for (const loc of locations) {
                const cfg = ticket.locationConfigs?.[loc.value];
                if (cfg && cfg.price > 0 && cfg.quantity > 0) {
                    await prisma.ticketType.create({
                        data: {
                            name: `${ticket.name} - ${loc.value}`,
                            description: ticket.description,
                            basePrice: cfg.price,
                            total: cfg.quantity,
                            sold: 0,
                            eventId: newEvent.id,
                        }
                    });
                }
            }
        } else {
            if (ticket.price > 0 && ticket.quantity > 0) {
                await prisma.ticketType.create({
                    data: {
                        name: `${ticket.name} - ${locations[0].value}`,
                        description: ticket.description,
                        basePrice: ticket.price,
                        total: ticket.quantity,
                        sold: 0,
                        eventId: newEvent.id,
                    }
                });
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
    const { startDate, endDate, otherCategory, locations, images, ...eventData } = data;
    const user = await getCurrentUser();
    if (!user) {
        throw new Error('User is not authenticated.');
    }

    const finalCategory = eventData.category === 'Other' ? otherCategory : eventData.category;

    const eventDataForUpdate = { ...eventData };
    delete eventDataForUpdate.otherCategory;
    delete eventDataForUpdate.tickets; 

    const locationString = locations.map((l: { value: string }) => l.value).join('||');
    
    // Get the first image from the array (since we only allow one image now)
    const imageString = Array.isArray(images) && images.length > 0
        ? images[0]
        : null;

    const eventToUpdate = await prisma.event.findUnique({ where: { id }});
    if (!eventToUpdate) throw new Error("Event not found");

    if (user.role.name !== 'Admin' && eventToUpdate.organizerId !== user.id) {
        throw new Error("You are not authorized to update this event.");
    }
    
    const updatedEvent = await prisma.event.update({
        where: { id },
        data: {
            ...eventDataForUpdate,
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
    prisma.pendingOrder.deleteMany({ where: { eventId: id } }),
    prisma.event.delete({ where: { id } }),
  ]);
  
  revalidatePath('/dashboard/events');
  revalidatePath('/');
}


export async function addTicketType(eventId: number, data: any) {
    const newTicketType = await prisma.ticketType.create({
        data: {
            name: data.name,
            description: data.description,
            basePrice: data.price,
            locationPrices: data.locationPrices || {},
            total: data.total,
            eventId: eventId,
        }
    });
    revalidatePath(`/dashboard/events/${eventId}`);
    return serialize(newTicketType);
}

export async function updateTicketType(ticketTypeId: number, data: any) {
  const updatedTicketType = await prisma.ticketType.update({
    where: { id: ticketTypeId },
    data: {
        name: data.name,
        description: data.description,
        basePrice: data.price,
        locationPrices: data.locationPrices || {},
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
export async function getReportsData(dateRange?: DateRange) {
    const user = await getCurrentUser();
    if (!user) {
        return {
            productSales: [],
            dailySales: [],
            promoCodes: [],
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

    const events = await prisma.event.findMany({
        where: whereClause,
        include: {
            ticketTypes: true,
            promoCodes: true,
        },
        orderBy: { startDate: 'asc' }
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
        promoCodes: promoCodeData
    });
}

// Settings Actions
export async function getUsersAndRoles() {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return { users: [], roles: [] };
    }
    
    const users = await prisma.user.findMany({
      include: { role: true },
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
        include: { role: true },
    });
    return serialize(user);
}


export async function addUser(data: any) {
    const { firstName, lastName, phoneNumber, email, roleId, nibBankAccount } = data;

    const phoneRegex = /^(09|07)\d{8}$/;
    if (!phoneRegex.test(phoneNumber)) {
        throw new Error("Phone number must start with 09 or 07 followed by 8 digits.");
    }
    
    const authApiUrl = process.env.AUTH_API_BASE_URL;
    if (!authApiUrl) {
      throw new Error('Auth API URL not configured.');
    }
    
    const password = "User@123";
    
    try {
        const authServiceEmail = email || `${phoneNumber}@nibtickets.com`;

        const registrationResponse = await fetch(`${authApiUrl}/api/Auth/register`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                firstName,
                lastName,
                phoneNumber,
                email: authServiceEmail,
                password,
            }),
        });
        
        const responseData = await registrationResponse.json();
                                              
        if (!responseData || !responseData.isSuccess) {
            let errorMessage = 'Failed to register user with auth service.';
            if (responseData.errors) {
              if (Array.isArray(responseData.errors)) {
                errorMessage = responseData.errors.join(', ');
              } else if (typeof responseData.errors === 'string') {
                errorMessage = responseData.errors;
              } else if (typeof responseData.errors === 'object') {
                errorMessage = Object.values(responseData.errors).flat().join(' ');
              }
            }
            throw new Error(errorMessage);
        }
        
        let newUserId;

        if (responseData.accessToken) {
            const token = responseData.accessToken;
            const payloadBase64 = token.split('.')[1];
            if (payloadBase64) {
                const decodedJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
                const decoded = JSON.parse(decodedJson);
                if (decoded && decoded.sub) {
                    newUserId = decoded.sub;
                }
            }
        }
        
        if (!newUserId) {
            console.error("Auth service response did not contain a user ID. Full response:", JSON.stringify(responseData, null, 2));
            throw new Error("Auth service did not return a user ID.");
        }
        
        const createData: any = {
            id: newUserId,
            firstName,
            lastName,
            phoneNumber,
            roleId,
            passwordChangeRequired: true,
            nibBankAccount: nibBankAccount || null,
        };

        if (email) {
            createData.email = email;
        }

        const user = await prisma.user.create({
            data: createData,
        });
    
        revalidatePath('/dashboard/settings/users');
        return serialize(user);

    } catch (error: any) {
        console.error("Error creating user:", error.message);
        
        if (error.code === 'P2002' && error.meta?.target?.includes('phoneNumber')) {
             throw new Error(`A user with this phone number already exists in the local database.`);
        }

        if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
            throw new Error('A user with this email address already exists in the local database.');
        }
        
        if (error.message.includes('already taken')) {
            throw new Error(error.message);
        }

        throw new Error(error.message || 'Failed to create user.');
    }
}

export async function updateUser(userId: string, data: Partial<User>) {
    const { firstName, lastName, phoneNumber, roleId, nibBankAccount, email } = data;
    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
            firstName,
            lastName,
            phoneNumber,
            roleId,
            nibBankAccount: nibBankAccount || null,
            email,
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
        const eventCount = await prisma.event.count({
            where: { organizerId: userId },
        });

        if (eventCount > 0) {
            throw new Error(`Cannot delete user. They are the organizer of ${eventCount} event(s). Please delete or reassign the events first.`);
        }

        const authApiUrl = process.env.AUTH_API_BASE_URL;
        if (!authApiUrl) {
            throw new Error('Authentication service URL is not configured.');
        }

        const cookieStore = await cookies();
        const tokenCookie = cookieStore.get('authTokens');
        if (!tokenCookie?.value) {
            throw new Error('Authentication token not found');
        }
        const tokenData = JSON.parse(tokenCookie.value);
        const token = tokenData.accessToken;
       
        const response = await fetch(`${authApiUrl}/api/Auth/delete-users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ phoneNumbers: [phoneNumber] })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData?.errors?.join(', ') || `Failed to delete user from authentication service. Status: ${response.status}`;
            throw new Error(errorMessage);
        }
        
        await prisma.$transaction([
            prisma.attendee.deleteMany({ where: { userId } }),
            prisma.user.delete({ where: { id: userId } }),
        ]);

        revalidatePath('/dashboard/settings/users');

    } catch (error: any) {
        console.error('Error deleting user:', error);
        
        if (error.code === 'P2003') { 
             throw new Error("Cannot delete user. They are still linked to other records in the database (e.g., as an event organizer). Please reassign or delete those records first.");
        }
        
        throw new Error(error.message || 'Failed to delete user.');
    }
}



export async function getRoles() {
    const roles = await prisma.role.findMany();
    return serialize(roles);
}

export async function getRoleById(id: string) {
    const role = await prisma.role.findUnique({
        where: { id },
    });
    return serialize(role);
}

export async function createRole(data: { name: string; description: string; permissions: string[] }) {
    const { name, description, permissions } = data;
    const role = await prisma.role.create({
        data: {
            name,
            description,
            permissions: permissions.join(','),
        },
    });
    revalidatePath('/dashboard/settings/roles');
    revalidatePath('/dashboard/settings/roles/new');
    return serialize(role);
}

export async function updateRole(id: string, data: Partial<Role>) {
    const role = await prisma.role.update({
        where: { id },
        data: data,
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
interface PurchaseRequest {
  eventId: number;
  tickets: { id: number; quantity: number, name: string; price: number }[];
  promoCode?: string;
  attendeeDetails: {
    name: string;
    phone: string;
    email?: string;
  };
}

export async function purchaseTickets(request: PurchaseRequest) {
    'use server';
    const { eventId, tickets, promoCode, attendeeDetails } = request;

    if (!attendeeDetails.name || !attendeeDetails.phone) {
        throw new Error("Attendee name and phone number are required.");
    }
    if (tickets.length === 0) {
        throw new Error("No tickets in purchase request.");
    }
    
    const user = await getCurrentUser();
    
    const useMockFlow = process.env.NODE_ENV === 'development' || !process.env.BASE_URL || !process.env.ARIFPAY_API_KEY;

    try {
        if (useMockFlow) {
            console.log("Using mock payment flow.");
            const totalQuantity = tickets.reduce((sum, t) => sum + t.quantity, 0);
            const transactionId = randomBytes(16).toString('hex');

            const pendingOrder = await prisma.pendingOrder.create({
                data: {
                    transactionId: transactionId,
                    arifpaySessionId: transactionId, // Use the same ID for mock session
                    eventId,
                    ticketTypeId: tickets[0].id,
                    attendeeData: {
                        name: attendeeDetails.name,
                        phoneNumber: attendeeDetails.phone,
                        userId: user?.id,
                        quantity: totalQuantity,
                    },
                    promoCode,
                    status: 'PENDING',
                },
            });

            redirect(`/payment/success?session_id=${pendingOrder.arifpaySessionId}`);
            return;
        }

        // Production flow with real payment gateway
        const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_VERCEL_URL;
        if (!appUrl) {
            throw new Error("App URL environment variable is not set.");
        }

        const purchaseData = {
            eventId,
            tickets,
            promoCode,
            attendeeDetails: {
                ...attendeeDetails,
                userId: user?.id,
            }
        };

        const response = await fetch(`${appUrl}/api/payment/arifpay/initiate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(purchaseData),
        });

        const result = await response.json();

        if (response.ok && result.paymentUrl) {
            redirect(result.paymentUrl);
        } else {
            throw new Error(result.error || 'Failed to initiate payment session.');
        }
    } catch (error: any) {
        if (error.digest?.startsWith('NEXT_REDIRECT')) {
            throw error;
        }
        console.error("Payment initiation failed:", error.message);
        redirect(`/payment/failure?event_id=${eventId}`);
    }
}

export async function getTicketDetailsForConfirmation(attendeeId: number) {
    const attendee = await prisma.attendee.findUnique({
        where: { id: attendeeId },
        include: {
            event: true,
            ticketType: true,
        },
    });

    return serialize(attendee);
}

export async function getTicketsByUserId(userId: string | null, localTicketIds: number[] = []) {
    const whereClauses = [];
    if (userId) {
        whereClauses.push({ userId: userId });
    }
    if (localTicketIds.length > 0) {
        whereClauses.push({ id: { in: localTicketIds } });
    }

    if (whereClauses.length === 0) {
        return [];
    }

    const tickets = await prisma.attendee.findMany({
        where: {
            OR: whereClauses,
        },
        include: {
            event: true,
            ticketType: true,
        },
        orderBy: {
            createdAt: 'desc',
        }
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


export async function checkInAttendee(attendeeId: number) {
    'use server';
    try {
        const attendee = await prisma.attendee.findUnique({
            where: { id: attendeeId },
            include: { event: true, ticketType: true }
        });

        if (!attendee) {
            return { error: 'Invalid Ticket: This ticket does not exist.' };
        }

        if (attendee.checkedIn) {
            return { data: serialize(attendee), error: 'Already Checked In: This ticket has already been used.' };
        }

        const updatedAttendee = await prisma.attendee.update({
            where: { id: attendeeId },
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
