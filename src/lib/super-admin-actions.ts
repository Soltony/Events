'use server';

import { requireSuperAdminPermission } from '@/lib/super-admin-auth';
import prisma from '@/lib/prisma';
import type { EventStatus } from '@prisma/client';

const PERFORMANCE_PERMISSIONS = [
  'Performance:Overview',
  'Performance:Branch Comparison',
  'Performance:District Comparison',
];

async function requireSuperAdmin(permission: string | string[] = PERFORMANCE_PERMISSIONS) {
  return requireSuperAdminPermission(permission);
}

export interface PerformanceFilters {
  districtId?: string;
  branchId?: string;
  eventId?: number;
  from?: string; // ISO date
  to?: string;   // ISO date
}

function buildEventWhere(filters: PerformanceFilters) {
  const where: any = {};

  if (filters.branchId) {
    where.organizer = { branchId: filters.branchId };
  } else if (filters.districtId) {
    where.organizer = { branch: { districtId: filters.districtId } };
  }

  if (filters.eventId) {
    where.id = filters.eventId;
  }

  if (filters.from || filters.to) {
    where.startDate = {};
    if (filters.from) where.startDate.gte = new Date(filters.from);
    if (filters.to) where.startDate.lte = new Date(filters.to);
  }

  return where;
}

export async function getSuperAdminFilters() {
  await requireSuperAdmin();

  const [districts, branches, events] = await Promise.all([
    prisma.district.findMany({ orderBy: { name: 'asc' } }),
    prisma.branch.findMany({ include: { district: true }, orderBy: { name: 'asc' } }),
    prisma.event.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  return { districts, branches, events };
}

export async function getPerformanceOverview(filters: PerformanceFilters = {}) {
  await requireSuperAdmin('Performance:Overview');

  const where = buildEventWhere(filters);

  const totalEvents = await prisma.event.count({ where });
  const pendingEvents = await prisma.event.count({ where: { ...where, status: 'PENDING' as EventStatus } });

  const approvedEvents = await prisma.event.findMany({
    where: { ...where, status: 'APPROVED' as EventStatus },
    include: { ticketTypes: true, attendees: { select: { checkedIn: true } } },
  });

  const totalRevenue = approvedEvents.reduce((sum, event) => {
    return sum + event.ticketTypes.reduce((eventSum, tt) => {
      const price = tt.basePrice ? Number(tt.basePrice) : 0;
      return eventSum + tt.sold * price;
    }, 0);
  }, 0);

  const totalTicketsSold = approvedEvents.reduce((sum, event) => {
    return sum + event.ticketTypes.reduce((eventSum, tt) => eventSum + tt.sold, 0);
  }, 0);

  const totalAttendees = approvedEvents.reduce((sum, event) => sum + event.attendees.length, 0);
  const checkedInAttendees = approvedEvents.reduce(
    (sum, event) => sum + event.attendees.filter((a) => a.checkedIn).length,
    0
  );

  return {
    totalEvents,
    pendingEvents,
    approvedEvents: approvedEvents.length,
    totalRevenue,
    totalTicketsSold,
    totalAttendees,
    checkedInAttendees,
    checkInRate: totalAttendees > 0 ? checkedInAttendees / totalAttendees : 0,
  };
}

interface GroupPerformance {
  id: string;
  name: string;
  districtName?: string;
  eventsCount: number;
  ticketsSold: number;
  revenue: number;
}

export async function getBranchPerformance(filters: PerformanceFilters = {}): Promise<GroupPerformance[]> {
  await requireSuperAdmin('Performance:Branch Comparison');

  const branches = await prisma.branch.findMany({
    where: filters.districtId
      ? { districtId: filters.districtId }
      : filters.branchId
      ? { id: filters.branchId }
      : {},
    include: { district: true },
    orderBy: { name: 'asc' },
  });

  const results: GroupPerformance[] = [];

  for (const branch of branches) {
    const where = buildEventWhere({ ...filters, branchId: branch.id, districtId: undefined });
    const events = await prisma.event.findMany({
      where: { ...where, status: 'APPROVED' as EventStatus },
      include: { ticketTypes: true },
    });

    const ticketsSold = events.reduce(
      (sum, e) => sum + e.ticketTypes.reduce((s, tt) => s + tt.sold, 0),
      0
    );
    const revenue = events.reduce(
      (sum, e) => sum + e.ticketTypes.reduce((s, tt) => s + tt.sold * (tt.basePrice ? Number(tt.basePrice) : 0), 0),
      0
    );

    results.push({
      id: branch.id,
      name: branch.name,
      districtName: branch.district.name,
      eventsCount: events.length,
      ticketsSold,
      revenue,
    });
  }

  return results;
}

export async function getDistrictPerformance(filters: PerformanceFilters = {}): Promise<GroupPerformance[]> {
  await requireSuperAdmin('Performance:District Comparison');

  const districts = await prisma.district.findMany({
    where: filters.districtId ? { id: filters.districtId } : {},
    orderBy: { name: 'asc' },
  });

  const results: GroupPerformance[] = [];

  for (const district of districts) {
    const where = buildEventWhere({ ...filters, districtId: district.id, branchId: undefined });
    const events = await prisma.event.findMany({
      where: { ...where, status: 'APPROVED' as EventStatus },
      include: { ticketTypes: true },
    });

    const ticketsSold = events.reduce(
      (sum, e) => sum + e.ticketTypes.reduce((s, tt) => s + tt.sold, 0),
      0
    );
    const revenue = events.reduce(
      (sum, e) => sum + e.ticketTypes.reduce((s, tt) => s + tt.sold * (tt.basePrice ? Number(tt.basePrice) : 0), 0),
      0
    );

    results.push({
      id: district.id,
      name: district.name,
      eventsCount: events.length,
      ticketsSold,
      revenue,
    });
  }

  return results;
}
