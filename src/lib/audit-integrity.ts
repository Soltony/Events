import type { Prisma } from '@prisma/client';

// Verification of the database-maintained AuditLog hash chain (see migration
// 20261012090000_audit_log_hardening). Kept free of auth so the self-test script can
// run it inside a transaction; the viewer reaches it via verifyAuditLogIntegrity.

export type AuditIntegrityProblem = {
  seq: string | null;
  id: string;
  problem: 'hash_mismatch' | 'broken_link' | 'missing_rows' | 'unchained_row';
};

export type AuditIntegrityReport = {
  ok: boolean;
  checkedRows: number;
  firstSeq: string | null;
  lastSeq: string | null;
  headHash: string | null;
  problems: AuditIntegrityProblem[];
};

/**
 * Recomputes every row's hash and reports rows whose contents no longer match their
 * hash (edited), whose link to the predecessor is broken (forged / reordered), gaps in
 * the sequence (deleted rows), and rows written with the chain trigger disabled.
 */
export async function checkAuditChain(db: Prisma.TransactionClient): Promise<AuditIntegrityReport> {
  const [summary] = await db.$queryRaw<
    { checked: bigint; first_seq: bigint | null; last_seq: bigint | null; unchained: bigint }[]
  >`
    SELECT count(*) FILTER (WHERE "seq" IS NOT NULL) AS checked,
           min("seq") AS first_seq,
           max("seq") AS last_seq,
           count(*) FILTER (WHERE "seq" IS NULL OR "hash" IS NULL) AS unchained
    FROM "AuditLog"`;

  const chainProblems = await db.$queryRaw<{ seq: bigint; id: string; problem: AuditIntegrityProblem['problem'] }[]>`
    WITH c AS (
      SELECT a."seq", a."id", a."hash", a."prevHash",
             audit_log_compute_hash(a) AS expected,
             lag(a."hash") OVER w AS prev_hash,
             lag(a."seq") OVER w AS prev_seq
      FROM "AuditLog" a
      WHERE a."seq" IS NOT NULL
      WINDOW w AS (ORDER BY a."seq")
    )
    SELECT "seq", "id",
           CASE
             WHEN "hash" IS DISTINCT FROM expected THEN 'hash_mismatch'
             WHEN "seq" <> prev_seq + 1 THEN 'missing_rows'
             ELSE 'broken_link'
           END AS problem
    FROM c
    WHERE "hash" IS DISTINCT FROM expected
       OR (prev_seq IS NOT NULL AND ("seq" <> prev_seq + 1 OR "prevHash" IS DISTINCT FROM prev_hash))
    ORDER BY "seq"
    LIMIT 100`;

  const unchainedRows =
    Number(summary.unchained) > 0
      ? await db.auditLog.findMany({ where: { OR: [{ seq: null }, { hash: null }] }, select: { id: true }, take: 100 })
      : [];

  const head =
    summary.last_seq == null
      ? null
      : await db.auditLog.findUnique({ where: { seq: summary.last_seq }, select: { hash: true } });

  const problems: AuditIntegrityProblem[] = [
    ...chainProblems.map((p) => ({ seq: p.seq.toString(), id: p.id, problem: p.problem })),
    ...unchainedRows.map((r) => ({ seq: null, id: r.id, problem: 'unchained_row' as const })),
  ];

  return {
    ok: problems.length === 0,
    checkedRows: Number(summary.checked),
    firstSeq: summary.first_seq?.toString() ?? null,
    lastSeq: summary.last_seq?.toString() ?? null,
    headHash: head?.hash ?? null,
    problems,
  };
}
