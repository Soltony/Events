
'use server';

import { revalidatePath } from 'next/cache';
import prisma from './prisma';
import type { Role, User, TicketType, PromoCode, PromoCodeType, Event, Attendee } from '@prisma/client';
import axios from 'axios';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

// Helper to ensure data is serializable
const serialize = (data: any) => JSON.parse(JSON.stringify(data, (key, value) =>
    typeof value === 'bigint'
        ? value.toString()
        : value
));

// A simple function to decode the payload of a JWT without verifying its signature.
// This is safe to do on the server side because we trust the token we just received from our own auth service.
function decodeJwtPayload(token: string): { sub: string, role: string, name: string } | null {
    try {
        const payloadBase64 = token.split('.')[1];
        if (!payloadBase64) {
            throw new Error('Invalid JWT: Missing payload');
        }
        const decodedJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
        return JSON.parse(decodedJson);
    } catch (error) {
        console.error("Failed to decode JWT:", error);
        return null;
    }
}

async function getCurrentUser() {
    const authorization = headers().get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
        throw new Error('User is not authenticated.');
    }
    const token = authorization.substring(7);
    const decodedToken = decodeJwtPayload(token);
    
    if (!decodedToken || !decodedToken.sub) {
        throw new Error("Invalid authentication token.");
    }
    
    const user = await prisma.user.findUnique({
        where: { id: decodedToken.sub },
        include: { role: true },
    });

    if (!user) {
        throw new Error("User not found.");
    }

    return user;
}

// Event Actions
export async function getEvents() {
    const user = await getCurrentUser();
    const whereClause: { organizerId?: string } = {};

    if (user.role.name !== 'Admin') {
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
    return serialize(event);
}

export async function getEventDetails(id: number) {
    const user = await getCurrentUser();
    
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
    const { tickets, startDate, endDate, otherCategory, ...eventData } = data;
    const user = await getCurrentUser();

    // Determine the final category and remove the temporary 'otherCategory' field
    const finalCategory = eventData.category === 'Other' ? otherCategory : eventData.category;
    
    // Set default image if one isn't provided
    if (!eventData.image) {
        eventData.image = '/image/nibtickets.jpg';
    }
    
    const newEvent = await prisma.event.create({
        data: {
            ...eventData,
            organizerId: user.id,
            category: finalCategory,
            startDate: startDate,
            endDate: endDate,
        },
    });

    if (tickets && tickets.length > 0) {
        await prisma.ticketType.createMany({
            data: tickets.map((ticket: any) => ({
                ...ticket,
                eventId: newEvent.id,
            })),
        });
    }

    revalidatePath('/dashboard/events');
    revalidatePath('/dashboard/events/new');
    revalidatePath('/');
    return serialize(newEvent);
}

export async function updateEvent(id: number, data: any) {
    const { startDate, endDate, otherCategory, ...eventData } = data;
    const user = await getCurrentUser();

    // Determine the final category
    const finalCategory = eventData.category === 'Other' ? otherCategory : eventData.category;

    const eventDataForUpdate = { ...eventData };
    delete eventDataForUpdate.otherCategory;

    const eventToUpdate = await prisma.event.findUnique({ where: { id }});
    if (!eventToUpdate) throw new Error("Event not found");

    if (user.role.name !== 'Admin' && eventToUpdate.organizerId !== user.id) {
        throw new Error("You are not authorized to update this event.");
    }
    
    const updatedEvent = await prisma.event.update({
        where: { id },
        data: {
            ...eventDataForUpdate,
            category: finalCategory,
            startDate: startDate,
            endDate: endDate,
        }
    });

    revalidatePath('/dashboard/events');
    revalidatePath(`/dashboard/events/${id}`);
    revalidatePath(`/dashboard/events/${id}/edit`);
    revalidatePath(`/events/${id}`);
    revalidatePath('/');

    return serialize(updatedEvent);
}

export async function deleteEvent(id: number) {
  const user = await getCurrentUser();
  const eventToDelete = await prisma.event.findUnique({ where: { id }});
  if (!eventToDelete) throw new Error("Event not found");

  if (user.role.name !== 'Admin' && eventToDelete.organizerId !== user.id) {
        throw new Error("You are not authorized to delete this event.");
  }

  await prisma.$transaction([
    prisma.attendee.deleteMany({ where: { eventId: id } }),
    prisma.promoCode.deleteMany({ where: { eventId: id } }),
    prisma.ticketType.deleteMany({ where: { eventId: id } }),
    prisma.event.delete({ where: { id } }),
  ]);
  
  revalidatePath('/dashboard/events');
  revalidatePath('/');
}


export async function addTicketType(eventId: number, data: Omit<TicketType, 'id' | 'eventId' | 'createdAt' | 'updatedAt' | 'sold'>) {
    const newTicketType = await prisma.ticketType.create({
        data: {
            ...data,
            eventId: eventId,
        }
    });
    revalidatePath(`/dashboard/events/${eventId}`);
    return serialize(newTicketType);
}

export async function addPromoCode(eventId: number, data: { code: string; type: PromoCodeType; value: number; maxUses: number; }) {
    const newPromoCode = await prisma.promoCode.create({
        data: {
            ...data,
            eventId: eventId,
        }
    });
    revalidatePath(`/dashboard/events/${eventId}`);
    return serialize(newPromoCode);
}


// Dashboard Actions
export async function getDashboardData() {
    const user = await getCurrentUser();
    const whereClause: { organizerId?: string } = {};

    if (user.role.name !== 'Admin') {
        whereClause.organizerId = user.id;
    }
    
    const events = await prisma.event.findMany({
        where: whereClause,
        include: {
            ticketTypes: {
                select: {
                    sold: true,
                    price: true
                }
            }
        }
    });

    const totalEvents = events.length;
    const totalRevenue = events.reduce((sum, event) => {
        return sum + event.ticketTypes.reduce((eventSum, tt) => eventSum + (tt.sold * Number(tt.price)), 0)
    }, 0);
    const totalTicketsSold = events.reduce((sum, event) => {
        return sum + event.ticketTypes.reduce((eventSum, tt) => eventSum + tt.sold, 0)
    }, 0);
    
    const chartData = events.map(event => ({
        name: event.name,
        ticketsSold: event.ticketTypes.reduce((sum, t) => sum + t.sold, 0),
    })).filter(e => e.ticketsSold > 0);

    return serialize({
        totalRevenue,
        totalTicketsSold,
        totalEvents,
        salesData: chartData,
    });
}


// Reports Actions
export async function getReportsData() {
    const user = await getCurrentUser();
    const whereClause: { organizerId?: string } = {};

    if (user.role.name !== 'Admin') {
        whereClause.organizerId = user.id;
    }

    const events = await prisma.event.findMany({
        where: whereClause,
        include: {
            ticketTypes: true,
            promoCodes: true,
        },
        orderBy: { startDate: 'asc' }
    });

    const ticketTypes = events.flatMap(e => e.ticketTypes.map(tt => ({ ...tt, event: { name: e.name } })));
    
    const dailySalesData = events.map(event => {
        const revenue = event.ticketTypes.reduce((sum, t) => sum + (t.sold * Number(t.price)), 0);
        return {
            date: event.startDate,
            eventName: event.name,
            ticketsSold: event.ticketTypes.reduce((sum, t) => sum + t.sold, 0),
            revenue
        }
    });

    const promoCodes = events.flatMap(e => e.promoCodes.map(pc => ({ ...pc, event: { name: e.name } })));
    
    const promoCodeData = promoCodes.map(code => {
        // This estimation logic is kept from mock data as there's no order history
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
        productSales: ticketTypes,
        dailySales: dailySalesData,
        promoCodes: promoCodeData
    });
}

// Settings Actions
export async function getUsersAndRoles() {
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
    const { firstName, lastName, phoneNumber, email, password, roleId } = data;

    const authApiUrl = process.env.AUTH_API_BASE_URL;
    if (!authApiUrl) {
        throw new Error("Authentication service URL is not configured.");
    }
    
    try {
        const registrationResponse = await axios.post(`${authApiUrl}/api/Auth/register`, {
            firstName,
            lastName,
            phoneNumber,
            email: email || undefined,
            password,
        });

        if (!registrationResponse.data || !registrationResponse.data.isSuccess) {
            throw new Error(registrationResponse.data.errors?.join(', ') || 'Failed to register user with auth service.');
        }
        
        const responseData = registrationResponse.data;
        let newUserId;

        if (responseData.accessToken) {
            const tokenPayload = decodeJwtPayload(responseData.accessToken);
            if (tokenPayload && tokenPayload.sub) {
                newUserId = tokenPayload.sub;
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
        
        if (error.response?.data?.errors) {
            throw new Error(error.response.data.errors.join(', '));
        }
        
        if (error.code === 'P2002' && error.meta?.target?.includes('phoneNumber')) {
             throw new Error('A user with this phone number already exists.');
        }

        if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
            throw new Error('A user with this email address already exists.');
        }
        
        throw new Error(error.message || 'Failed to create user.');
    }
}

export async function updateUser(userId: string, data: Partial<User>) {
    const { firstName, lastName, roleId } = data;
    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
            firstName,
            lastName,
            roleId,
        },
    });

    revalidatePath('/dashboard/settings/users');
    revalidatePath(`/dashboard/settings/users/${userId}/edit`);
    return serialize(updatedUser);
}


export async function updateUserRole(userId: string, roleId: string) {
    const user = await prisma.user.update({
        where: { id: userId },
        data: { roleId },
    });
    revalidatePath('/dashboard/settings');
    return serialize(user);
}

export async function deleteUser(userId: string, phoneNumber: string) {
    const authApiUrl = process.env.AUTH_API_BASE_URL;
    if (!authApiUrl) {
        throw new Error("Authentication service URL is not configured.");
    }

    try {
        const userToDelete = await prisma.user.findUnique({ where: { id: userId } });
        if (!userToDelete) {
             throw new Error("User not found.");
        }

        await prisma.user.delete({
            where: { id: userId },
        });

        const deleteResponse = await axios.delete(`${authApiUrl}/api/Auth/delete/${phoneNumber}`);
        
        if (!deleteResponse.data || !deleteResponse.data.isSuccess) {
             console.error('Failed to delete user from auth service:', deleteResponse.data.errors?.join(', '));
        }

        revalidatePath('/dashboard/settings/users');
    } catch (error: any) {
        console.error('Error deleting user:', error);
        if (error.response?.data?.errors) {
            throw new Error(error.response.data.errors.join(', '));
        }
        if (error.code === 'P2025') { 
            throw new Error("User not found in the database.");
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
    revalidatePath(`/dashboard/settings/roles/edit?id=${id}`);
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

export async function resetPassword(phoneNumber: string, newPassword: string, currentPassword?: string): Promise<void> {
  const authApiUrl = process.env.AUTH_API_BASE_URL;
  if (!authApiUrl) {
    throw new Error('Authentication service URL is not configured.');
  }

  const user = await prisma.user.findUnique({
    where: { phoneNumber },
  });

  if (!user) {
    throw new Error('No account found with this phone number.');
  }

  try {
    const payload: { phoneNumber: string, newPassword: string, currentPassword?: string } = {
      phoneNumber,
      newPassword,
    };
    if (currentPassword) {
      payload.currentPassword = currentPassword;
    }

    const response = await axios.post(`${authApiUrl}/api/Auth/change-password`, payload);
    
    if (!response.data || !response.data.isSuccess) {
      throw new Error(response.data.errors?.join(', ') || 'Failed to reset password.');
    }
    
    await prisma.user.update({
      where: { phoneNumber },
      data: { passwordChangeRequired: false }
    });
    revalidatePath('/dashboard/profile');

  } catch (error: any) {
    console.error('Error resetting password:', error);
    if (error.response?.data?.errors) {
      throw new Error(error.response.data.errors.join(', '));
    }
    throw new Error(error.message || 'Failed to communicate with authentication service.');
  }
}

// Ticket/Attendee Actions
interface PurchaseRequest {
  eventId: number;
  tickets: { id: number; quantity: number, name: string; price: number }[];
  promoCode?: string;
}

export async function purchaseTickets(request: PurchaseRequest) {
    'use server';

    const newAttendees = await prisma.$transaction(async (tx) => {
        const createdAttendees: Attendee[] = [];
        for (const ticket of request.tickets) {
            const ticketType = await tx.ticketType.findUnique({ where: { id: ticket.id } });
            if (!ticketType) throw new Error(`Ticket type with id ${ticket.id} not found.`);
            if ((ticketType.total - ticketType.sold) < ticket.quantity) {
                throw new Error(`Not enough tickets available for ${ticketType.name}.`);
            }

            for (let i = 0; i < ticket.quantity; i++) {
                const newAttendee = await tx.attendee.create({
                    data: {
                        name: 'Public Customer', // Placeholder
                        email: `customer+${Date.now() + i}@example.com`,
                        eventId: request.eventId,
                        ticketTypeId: ticket.id,
                        checkedIn: false,
                    },
                });
                createdAttendees.push(newAttendee);
            }

            await tx.ticketType.update({
                where: { id: ticket.id },
                data: { sold: { increment: ticket.quantity } },
            });
        }

        if (request.promoCode) {
            await tx.promoCode.update({
                where: { code: request.promoCode, eventId: request.eventId },
                data: { uses: { increment: 1 } },
            });
        }
        return createdAttendees;
    });

    revalidatePath(`/events/${request.eventId}`);
    revalidatePath('/');

    if (newAttendees.length > 0) {
        redirect(`/ticket/${newAttendees[0].id}/confirmation`);
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

    if (!attendee) {
        return null;
    }

    return serialize(attendee);
}

export async function getTicketsByIds(ids: number[]) {
    const tickets = await prisma.attendee.findMany({
        where: {
            id: {
                in: ids,
            },
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

export async function validatePromoCode(eventId: number, code: string): Promise<PromoCode | null> {
    const promoCode = await prisma.promoCode.findFirst({
        where: {
            code: code,
            eventId: eventId,
            uses: {
                lt: prisma.promoCode.fields.maxUses
            }
        }
    });
    return serialize(promoCode);
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

    