'use server';

import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireSuperAdminPermission } from '@/lib/super-admin-auth';

// Read-only access to the audit trail. There is deliberately no update/delete action:
// audit records cannot be altered or removed through the application.

const PAGE_SIZE = 50;

export type AuditLogFilters = {
  search?: string; // matches action, actor label/id, target id
  severity?: 'info' | 'warning' | 'critical' | 'all';
  actorType?: 'user' | 'superAdmin' | 'system' | 'anonymous' | 'all';
  from?: string; // ISO date (inclusive)
  to?: string; // ISO date (inclusive, whole day)
  cursor?: string; // id of the last row of the previous page
};

export type AuditLogRow = {
  id: string;
  createdAt: string;
  action: string;
  severity: string;
  actorType: string | null;
  actorId: string | null;
  actorLabel: string | null;
  targetType: string | null;
  targetId: string | null;
  ip: string | null;
  userAgent: string | null;
  detail: unknown;
};

function parseDate(value: string | undefined, endOfDay: boolean): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return d;
}

export async function getAuditLogs(
  filters: AuditLogFilters = {},
): Promise<{ rows: AuditLogRow[]; nextCursor: string | null }> {
  await requireSuperAdminPermission('Audit Logs:Read');

  const where: Prisma.AuditLogWhereInput = {};
  const search = typeof filters.search === 'string' ? filters.search.trim().slice(0, 100) : '';
  if (search) {
    where.OR = [
      { action: { contains: search, mode: 'insensitive' } },
      { actorLabel: { contains: search, mode: 'insensitive' } },
      { actorId: search },
      { targetId: search },
    ];
  }
  if (filters.severity && filters.severity !== 'all') where.severity = filters.severity;
  if (filters.actorType && filters.actorType !== 'all') where.actorType = filters.actorType;
  const from = parseDate(filters.from, false);
  const to = parseDate(filters.to, true);
  if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: PAGE_SIZE + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
  });

  const page = rows.slice(0, PAGE_SIZE);
  return {
    rows: page.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), detail: r.detail ?? null })),
    nextCursor: rows.length > PAGE_SIZE ? page[page.length - 1].id : null,
  };
}
