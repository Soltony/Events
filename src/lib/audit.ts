import type { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import prisma from '@/lib/prisma';

/**
 * Centralised security / administrative audit log.
 *
 * Every security-relevant event (authn success & failure, logout, password
 * change / reset, session revocation, role & permission changes, account
 * status changes, deletions, approvals) should call `logAudit`. Writes are
 * best-effort: a logging failure must never break the request it describes.
 *
 * The log is append-only from the application's point of view: nothing in the
 * codebase updates or deletes AuditLog rows, and the viewer is read-only.
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

function contextFromHeaders(h: Headers) {
  const fwd = h.get('x-forwarded-for');
  const ip = (fwd ? fwd.split(',')[0]?.trim() : '') || h.get('x-real-ip') || null;
  return { ip, userAgent: h.get('user-agent') };
}

export function auditRequestContext(req: NextRequest | Request) {
  return contextFromHeaders(req.headers);
}

/** Request context for server actions / server components (no request object in scope). */
async function ambientRequestContext(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    return contextFromHeaders(await headers());
  } catch {
    return { ip: null, userAgent: null }; // outside a request (scripts, background work)
  }
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const ctx = entry.ip === undefined && entry.userAgent === undefined ? await ambientRequestContext() : null;
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        severity: entry.severity ?? 'info',
        actorType: entry.actorType ?? null,
        actorId: entry.actorId ?? null,
        actorLabel: entry.actorLabel ?? null,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        ip: entry.ip ?? ctx?.ip ?? null,
        userAgent: entry.userAgent ?? ctx?.userAgent ?? null,
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

/** Any authenticated identity performing an administrative action. */
export type AuditActor =
  | { id: string; actorType: 'superAdmin' | 'user'; actorLabel: string }
  | { id: string; firstName?: string | null; lastName?: string | null; phoneNumber?: string | null };

function describeActor(actor: AuditActor): Pick<AuditEntry, 'actorType' | 'actorId' | 'actorLabel'> {
  if ('actorType' in actor) {
    return { actorType: actor.actorType, actorId: actor.id, actorLabel: actor.actorLabel };
  }
  const name = `${actor.firstName ?? ''} ${actor.lastName ?? ''}`.trim();
  return {
    actorType: 'user',
    actorId: actor.id,
    actorLabel: [name, actor.phoneNumber ? `(${actor.phoneNumber})` : ''].filter(Boolean).join(' ') || null,
  };
}

/** Records an administrative action attributed to the individual who performed it. */
export async function logAdminAction(
  actor: AuditActor,
  action: string,
  opts: {
    targetType?: string;
    targetId?: string | number | null;
    detail?: Record<string, unknown>;
    severity?: AuditSeverity;
  } = {},
): Promise<void> {
  await logAudit({
    action,
    severity: opts.severity ?? 'info',
    ...describeActor(actor),
    targetType: opts.targetType ?? null,
    targetId: opts.targetId == null ? null : String(opts.targetId),
    detail: opts.detail ?? null,
  });
}
