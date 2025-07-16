
'use server';

import { revalidatePath } from 'next/cache';
import prisma from './prisma';
import type { Role, User, TicketType } from '@prisma/client';
import axios from 'axios';

// Helper to ensure data is serializable
const serialize = (data: any) => JSON.parse(JSON.stringify(data, (key, value) =>
    typeof value === 'bigint'
        ? value.toString()
        : value
));

// Event Actions
export async function getEvents() {
  const events = await prisma.event.findMany({
    orderBy: { startDate: 'asc' },
  });
  return serialize(events);
}

export async function getPublicEvents() {
    const events = await prisma.event.findMany({
        where: { startDate: { gte: new Date() } },
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
    return serialize(event);
}

export async function addEvent(data: any) {
    const { tickets, ...eventData } = data;
    
    const newEvent = await prisma.event.create({
        data: {
            ...eventData,
            startDate: eventData.date.from,
            endDate: eventData.date.to,
            date: undefined, // remove old date field
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


// Dashboard Actions
export async function getDashboardData() {
    const totalEvents = await prisma.event.count();

    const ticketTypes = await prisma.ticketType.findMany();
    const totalRevenue = ticketTypes.reduce((sum, t) => sum + (t.sold * Number(t.price)), 0);
    const totalTicketsSold = ticketTypes.reduce((sum, t) => sum + t.sold, 0);
    
    const salesData = await prisma.event.findMany({
        include: {
            ticketTypes: {
                select: {
                    sold: true
                }
            }
        }
    });

    const chartData = salesData.map(event => ({
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
    const ticketTypes = await prisma.ticketType.findMany({
        include: { event: { select: { name: true } } },
        orderBy: { eventId: 'asc' }
    });

    const events = await prisma.event.findMany({
        include: { ticketTypes: true }
    });
    
    const dailySalesData = events.map(event => {
        const revenue = event.ticketTypes.reduce((sum, t) => sum + (t.sold * Number(t.price)), 0);
        return {
            date: event.startDate,
            eventName: event.name,
            ticketsSold: event.ticketTypes.reduce((sum, t) => sum + t.sold, 0),
            revenue
        }
    });

    const promoCodes = await prisma.promoCode.findMany({
        include: { event: { select: { name: true } } }
    });
    
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
        include: { role: true }
    });
    const roles = await prisma.role.findMany();
    return serialize({ users, roles });
}

export async function getUserByPhoneNumber(phoneNumber: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
        where: { phoneNumber },
    });
    return serialize(user);
}

export async function addUser(data: any) {
    const { firstName, lastName, phoneNumber, password, roleId } = data;

    // Step 1: Register user with the external auth server
    try {
        const authApiUrl = process.env.AUTH_API_BASE_URL;
        if (!authApiUrl) {
            throw new Error("Authentication API URL is not configured.");
        }
        
        const registrationData = {
            FirstName: firstName,
            LastName: lastName,
            PhoneNumber: phoneNumber,
            Password: password,
        };
        
        const response = await axios.post(`${authApiUrl}/api/Auth/register`, registrationData);

        if (!response.data.isSuccess) {
            throw new Error(response.data.errors?.join(', ') || 'Authentication server registration failed.');
        }
    } catch (error: any) {
        console.error("Error registering user with auth server:", error);
        const errorMessage = error.response?.data?.errors?.join(', ') || error.message || 'An unknown error occurred during registration.';
        throw new Error(`Failed to register user: ${errorMessage}`);
    }

    // Step 2: Create the user in the local database
    const user = await prisma.user.create({
        data: {
            firstName,
            lastName,
            phoneNumber,
            roleId,
        }
    });

    revalidatePath('/dashboard/settings');
    return serialize(user);
}

export async function updateUserRole(userId: string, roleId: string) {
    const user = await prisma.user.update({
        where: { id: userId },
        data: { roleId },
    });
    revalidatePath('/dashboard/settings');
    return serialize(user);
}

export async function createRole(data: Omit<Role, 'id'>) {
    const role = await prisma.role.create({ data: data as any });
    revalidatePath('/dashboard/settings');
    return serialize(role);
}

export async function updateRole(id: string, data: Partial<Role>) {
    const role = await prisma.role.update({
        where: { id },
        data: data as any,
    });
    revalidatePath('/dashboard/settings');
    return serialize(role);
}

export async function deleteRole(id: string) {
    // Before deleting a role, ensure no users are assigned to it.
    const usersWithRole = await prisma.user.count({ where: { roleId: id } });
    if (usersWithRole > 0) {
        throw new Error("Cannot delete role as it is currently assigned to users.");
    }
    const role = await prisma.role.delete({ where: { id } });
    revalidatePath('/dashboard/settings');
    return serialize(role);
}
