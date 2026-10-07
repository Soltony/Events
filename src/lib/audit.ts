import type { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Centralised security / administrative audit log.
 *
 * Every security-relevant event (authn success & failure, logout, password
 * change / reset, session revocation, role & permission changes, account
 * status changes, deletions, approvals) should call `logAudit`. Writes are
 * best-effort: a logging failure must never break the request it describes.
 */

export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface AuditEntry {
  action: string; // dot-namespaced, e.g. "auth.login.success", "role.delete"
  severity?: AuditSeverity;
  actorType?: 'user' | 'superAdmin' | 'system' | 'anonymous';
  actorId?: string | null;
  actorLabel?: string | null; // phone / email / name snapshot
  targetType?: string | null;
  targetId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  detail?: Record<string, unknown> | null;
}

export function auditRequestContext(req: NextRequest | Request) {
  const h = req.headers;
  const fwd = h.get('x-forwarded-for');
  const ip = (fwd ? fwd.split(',')[0]?.trim() : '') || h.get('x-real-ip') || null;
  return { ip, userAgent: h.get('user-agent') };
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        severity: entry.severity ?? 'info',
        actorType: entry.actorType ?? null,
        actorId: entry.actorId ?? null,
        actorLabel: entry.actorLabel ?? null,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
        detail: (entry.detail ?? undefined) as any,
      },
    });
    if (entry.severity === 'critical') {
      // Surface high-severity events to the process logs / APM as well.
      console.warn(`[AUDIT:critical] ${entry.action}`, {
        actorId: entry.actorId,
        targetType: entry.targetType,
        targetId: entry.targetId,
        ip: entry.ip,
      });
    }
  } catch (err) {
    console.error('[AUDIT] Failed to persist audit entry:', entry.action, err);
  }
}
