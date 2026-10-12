'use server';

import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireSuperAdminPermission } from '@/lib/super-admin-auth';
import { logAdminAction } from '@/lib/audit';
import { checkAuditChain, type AuditIntegrityReport } from '@/lib/audit-integrity';

export type { AuditIntegrityProblem, AuditIntegrityReport } from '@/lib/audit-integrity';

// Read-only access to the audit trail. There is deliberately no update/delete action:
// audit records cannot be altered or removed through the application, and the
// database rejects UPDATE/DELETE/TRUNCATE on "AuditLog" (append-only triggers).

const PAGE_SIZE = 50;

export type AuditLogFilters = {
  search?: string; // matches action, actor label/id, target id
  severity?: 'info' | 'warning' | 'critical' | 'all';
  outcome?: 'success' | 'failure' | 'denied' | 'all';
  actorType?: 'user' | 'superAdmin' | 'system' | 'anonymous' | 'all';
  from?: string; // ISO date (inclusive)
  to?: string; // ISO date (inclusive, whole day)
  cursor?: string; // id of the last row of the previous page
};

export type AuditLogRow = {
  id: string;
  seq: string | null;
  createdAt: string;
  action: string;
  severity: string;
  outcome: string;
  actorType: string | null;
  actorId: string | null;
  actorLabel: string | null;
  targetType: string | null;
  targetId: string | null;
  ip: string | null;
  userAgent: string | null;
  detail: unknown;
  hash: string | null;
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
  const actor = await requireSuperAdminPermission('Audit Logs:Read');

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
  if (filters.outcome && filters.outcome !== 'all') where.outcome = filters.outcome;
  if (filters.actorType && filters.actorType !== 'all') where.actorType = filters.actorType;
  const from = parseDate(filters.from, false);
  const to = parseDate(filters.to, true);
  if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };

  // Access to the audit trail is itself audited (once per query, not per page).
  if (!filters.cursor) {
    await logAdminAction(actor, 'audit_log.view', {
      detail: {
        search: search || undefined,
        severity: filters.severity,
        outcome: filters.outcome,
        actorType: filters.actorType,
        from: filters.from || undefined,
        to: filters.to || undefined,
      },
    });
  }

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: PAGE_SIZE + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
  });

  const page = rows.slice(0, PAGE_SIZE);
  return {
    rows: page.map(({ prevHash: _prevHash, ...r }) => ({
      ...r,
      seq: r.seq == null ? null : r.seq.toString(),
      createdAt: r.createdAt.toISOString(),
      detail: r.detail ?? null,
    })),
    nextCursor: rows.length > PAGE_SIZE ? page[page.length - 1].id : null,
  };
}

/** Verifies the audit hash chain for the viewer; the check itself is recorded too. */
export async function verifyAuditLogIntegrity(): Promise<AuditIntegrityReport> {
  const actor = await requireSuperAdminPermission('Audit Logs:Read');
  const report = await checkAuditChain(prisma);

  await logAdminAction(actor, 'audit_log.integrity_check', {
    severity: report.ok ? 'info' : 'critical',
    outcome: report.ok ? 'success' : 'failure',
    detail: {
      checkedRows: report.checkedRows,
      lastSeq: report.lastSeq,
      headHash: report.headHash,
      problems: report.problems.length,
    },
  });

  return report;
}
