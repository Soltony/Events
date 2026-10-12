/**
 * Self-checks for the audit trail (VA-021): attribution + outcome on every entry,
 * database-enforced append-only storage, the tamper-evident hash chain, and the
 * Audit Logs:Read grant for the administrative roles.
 * Run: npx tsx scripts/verify-audit-log.ts   (needs DATABASE_URL and the migrations applied)
 *
 * Tampering scenarios run inside transactions that are rolled back, so the real audit
 * log is never modified. The only rows persisted are a handful of `selftest.audit_chain`
 * entries (actorType "system") from the concurrency check, plus the helper checks.
 */
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { logAccessDenied, logAdminAction, logAudit } from '../src/lib/audit';
import { checkAuditChain } from '../src/lib/audit-integrity';

const prisma = new PrismaClient();

let passed = 0;
async function check(name: string, fn: () => unknown | Promise<unknown>) {
  await fn();
  passed++;
  console.log(`  ✔ ${name}`);
}

class Rollback extends Error {}
/** Runs `fn` in a transaction that is always rolled back. */
async function inRolledBackTx(fn: (tx: any) => Promise<void>) {
  try {
    await prisma.$transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
}

async function expectRejected(promise: Promise<unknown>, pattern: RegExp) {
  await assert.rejects(promise, (e: any) => pattern.test(String(e?.message ?? e)));
}

const latest = (action: string) =>
  prisma.auditLog.findFirst({ where: { action }, orderBy: { seq: 'desc' } });

async function main() {
  const runId = `selftest-${Date.now()}`;

  console.log('Attribution & outcome');
  await check('logAdminAction records individual actor, target and success outcome', async () => {
    await logAdminAction(
      { id: 'selftest-admin-a', actorType: 'user', actorLabel: 'Selftest Admin A (0900000001)' },
      'selftest.audit_chain',
      { targetType: 'selftest', targetId: runId, detail: { step: 'admin-action' } },
    );
    const row = await latest('selftest.audit_chain');
    assert.equal(row?.actorId, 'selftest-admin-a');
    assert.equal(row?.actorLabel, 'Selftest Admin A (0900000001)');
    assert.equal(row?.targetId, runId);
    assert.equal(row?.outcome, 'success');
  });
  await check('logAccessDenied records the actor, required permission and "denied" outcome', async () => {
    await logAccessDenied({ id: 'selftest-admin-b', firstName: 'Selftest', lastName: 'B', phoneNumber: '0900000002' }, 'Users:Delete', {
      runId,
    });
    const row = await prisma.auditLog.findFirst({ where: { action: 'authz.denied', actorId: 'selftest-admin-b' }, orderBy: { seq: 'desc' } });
    assert.equal(row?.outcome, 'denied');
    assert.equal(row?.severity, 'warning');
    assert.equal(row?.actorLabel, 'Selftest B (0900000002)');
    assert.equal((row?.detail as any)?.required, 'Users:Delete');
  });
  await check('legacy "*.failure" actions are recorded with outcome "failure"', async () => {
    await logAudit({ action: 'selftest.audit_chain.failure', actorType: 'system', detail: { runId } });
    assert.equal((await latest('selftest.audit_chain.failure'))?.outcome, 'failure');
  });

  console.log('Hash chain');
  await check('application-supplied seq / prevHash / hash are overridden by the database', async () => {
    const row = await prisma.auditLog.create({
      data: { action: 'selftest.audit_chain', actorType: 'system', seq: BigInt(1), prevHash: 'forged', hash: 'forged', detail: { runId } },
    });
    assert.notEqual(row.hash, 'forged');
    assert.notEqual(row.seq, BigInt(1));
    const prev = await prisma.auditLog.findUnique({ where: { seq: row.seq! - BigInt(1) } });
    assert.equal(row.prevHash, prev?.hash);
  });
  await check('8 concurrent writes produce a gap-free, linear chain', async () => {
    const before = await prisma.auditLog.aggregate({ _max: { seq: true } });
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        prisma.auditLog.create({ data: { action: 'selftest.audit_chain', actorType: 'system', detail: { runId, concurrent: i } } }),
      ),
    );
    const rows = await prisma.auditLog.findMany({ where: { seq: { gt: before._max.seq ?? BigInt(0) } }, orderBy: { seq: 'asc' } });
    assert.ok(rows.length >= 8);
    rows.forEach((r, i) => i > 0 && assert.equal(r.seq, rows[i - 1].seq! + BigInt(1)));
  });
  await check('full chain verifies clean', async () => {
    const report = await checkAuditChain(prisma);
    assert.deepEqual(report.problems, []);
    assert.ok(report.ok && report.checkedRows > 0);
  });

  console.log('Append-only enforcement');
  const victim = await latest('selftest.audit_chain');
  assert.ok(victim);
  await check('UPDATE is rejected by the database', () =>
    expectRejected(prisma.auditLog.update({ where: { id: victim.id }, data: { actorLabel: 'someone else' } }), /append-only/),
  );
  await check('raw SQL UPDATE is rejected by the database', () =>
    expectRejected(prisma.$executeRaw`UPDATE "AuditLog" SET "actorId" = 'x' WHERE "id" = ${victim.id}`, /append-only/),
  );
  await check('DELETE is rejected by the database', () =>
    expectRejected(prisma.auditLog.delete({ where: { id: victim.id } }), /append-only/),
  );
  await check('deleteMany is rejected by the database', () =>
    expectRejected(prisma.auditLog.deleteMany({ where: { action: 'selftest.audit_chain' } }), /append-only/),
  );
  await check('TRUNCATE is rejected by the database', () =>
    expectRejected(prisma.$executeRawUnsafe('TRUNCATE "AuditLog"'), /append-only/),
  );

  console.log('Tamper detection (triggers bypassed by a privileged DB user, rolled back)');
  await check('edited row is detected as hash_mismatch', () =>
    inRolledBackTx(async (tx) => {
      await tx.$executeRawUnsafe('ALTER TABLE "AuditLog" DISABLE TRIGGER audit_log_no_update_delete');
      await tx.$executeRaw`UPDATE "AuditLog" SET "actorLabel" = 'Someone Else' WHERE "id" = ${victim.id}`;
      const report = await checkAuditChain(tx);
      assert.ok(report.problems.some((p) => p.id === victim.id && p.problem === 'hash_mismatch'));
    }),
  );
  await check('deleted row is detected as missing_rows', () =>
    inRolledBackTx(async (tx) => {
      const mid = await tx.auditLog.findFirst({ where: { seq: { lt: victim.seq! } }, orderBy: { seq: 'desc' } });
      await tx.$executeRawUnsafe('ALTER TABLE "AuditLog" DISABLE TRIGGER audit_log_no_update_delete');
      await tx.$executeRaw`DELETE FROM "AuditLog" WHERE "id" = ${mid.id}`;
      const report = await checkAuditChain(tx);
      assert.ok(report.problems.some((p) => p.problem === 'missing_rows'));
    }),
  );
  await check('row re-hashed after editing is detected as broken_link', () =>
    inRolledBackTx(async (tx) => {
      const mid = await tx.auditLog.findFirst({ where: { seq: { lt: victim.seq! } }, orderBy: { seq: 'desc' } });
      await tx.$executeRawUnsafe('ALTER TABLE "AuditLog" DISABLE TRIGGER audit_log_no_update_delete');
      await tx.$executeRaw`UPDATE "AuditLog" SET "actorId" = 'forged' WHERE "id" = ${mid.id}`;
      await tx.$executeRaw`UPDATE "AuditLog" a SET "hash" = audit_log_compute_hash(a) WHERE "id" = ${mid.id}`;
      const report = await checkAuditChain(tx);
      assert.ok(report.problems.some((p) => p.problem === 'broken_link'));
    }),
  );
  await check('row inserted with the chain trigger disabled is detected', () =>
    inRolledBackTx(async (tx) => {
      await tx.$executeRawUnsafe('ALTER TABLE "AuditLog" DISABLE TRIGGER audit_log_chain');
      const row = await tx.auditLog.create({ data: { action: 'selftest.audit_chain', actorType: 'system' } });
      const report = await checkAuditChain(tx);
      assert.ok(report.problems.some((p) => p.id === row.id && p.problem === 'unchained_row'));
    }),
  );
  await check('real chain still verifies clean after the rolled-back tampering', async () => {
    assert.ok((await checkAuditChain(prisma)).ok);
  });

  console.log('Viewer access');
  await check("'Admin' and 'Super Admin' roles hold 'Audit Logs:Read'", async () => {
    const grants = await prisma.rolePermission.findMany({
      where: { permission: { name: 'Audit Logs:Read' }, role: { name: { in: ['Admin', 'Super Admin'] } } },
      select: { role: { select: { name: true } } },
    });
    const roles = grants.map((g) => g.role.name).sort();
    assert.deepEqual(roles, ['Admin', 'Super Admin']);
  });

  console.log(`\n${passed} checks passed.`);
}

main()
  .catch((e) => {
    console.error('\n✘ FAILED:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
