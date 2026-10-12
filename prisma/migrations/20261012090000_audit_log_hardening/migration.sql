-- VA-021: audit log hardening.
--   1. Record the result of every audited action (outcome).
--   2. Tamper evidence: every row is linked into a SHA-256 hash chain assigned by the
--      database itself (seq / prevHash / hash), so an edited, deleted or back-dated
--      row is detectable (see verifyAuditLogIntegrity in src/lib/audit-log-actions.ts).
--   3. Tamper resistance: UPDATE / DELETE / TRUNCATE on "AuditLog" are rejected.
--   4. Make the audit trail reachable: grant 'Audit Logs:Read' to the Admin and
--      Super Admin roles (new deployments get it from prisma/seed.ts already).

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "hash" TEXT,
ADD COLUMN     "outcome" TEXT NOT NULL DEFAULT 'success',
ADD COLUMN     "prevHash" TEXT,
ADD COLUMN     "seq" BIGINT;

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_seq_key" ON "AuditLog"("seq");

-- CreateIndex
CREATE INDEX "AuditLog_outcome_createdAt_idx" ON "AuditLog"("outcome", "createdAt");

-- Backfill outcome for rows written before the column existed.
UPDATE "AuditLog" SET "outcome" = 'failure'
WHERE "action" LIKE '%.failure' OR "action" LIKE '%.rejected' OR "action" LIKE '%.reuse_detected';

-- Canonical row hash. Every column except the hash itself is covered, each value is
-- NULL-safe and separated by the ASCII unit separator so fields cannot be shifted.
CREATE OR REPLACE FUNCTION audit_log_compute_hash(r "AuditLog") RETURNS TEXT
LANGUAGE sql STABLE AS $$
  SELECT encode(sha256(convert_to(concat_ws(chr(31),
    r."seq"::text,
    coalesce(r."prevHash", ''),
    r."id",
    to_char(r."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS'),
    r."action",
    r."severity",
    r."outcome",
    coalesce(r."actorType", ''),
    coalesce(r."actorId", ''),
    coalesce(r."actorLabel", ''),
    coalesce(r."targetType", ''),
    coalesce(r."targetId", ''),
    coalesce(r."ip", ''),
    coalesce(r."userAgent", ''),
    coalesce(r."detail"::text, '')
  ), 'UTF8')), 'hex');
$$;

-- Chain existing rows in insertion order.
DO $$
DECLARE
  r "AuditLog";
  n BIGINT := 0;
  prev TEXT := NULL;
BEGIN
  FOR r IN SELECT * FROM "AuditLog" ORDER BY "createdAt", "id" LOOP
    n := n + 1;
    r."seq" := n;
    r."prevHash" := prev;
    r."hash" := audit_log_compute_hash(r);
    UPDATE "AuditLog" SET "seq" = r."seq", "prevHash" = r."prevHash", "hash" = r."hash" WHERE "id" = r."id";
    prev := r."hash";
  END LOOP;
END $$;

-- Assign seq / prevHash / hash on insert. The advisory lock serialises concurrent
-- inserts so the chain stays linear; the application cannot supply its own values.
CREATE OR REPLACE FUNCTION audit_log_chain_before_insert() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  last_seq BIGINT;
  last_hash TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(7302101021);
  SELECT "seq", "hash" INTO last_seq, last_hash FROM "AuditLog" ORDER BY "seq" DESC NULLS LAST LIMIT 1;
  NEW."createdAt" := coalesce(NEW."createdAt", CURRENT_TIMESTAMP)::timestamp(3);
  NEW."seq" := coalesce(last_seq, 0) + 1;
  NEW."prevHash" := last_hash;
  NEW."hash" := audit_log_compute_hash(NEW);
  RETURN NEW;
END $$;

CREATE TRIGGER audit_log_chain
BEFORE INSERT ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION audit_log_chain_before_insert();

-- Append-only: audit records can never be altered or removed through SQL issued by
-- the application (or anyone else) while these triggers are enabled.
CREATE OR REPLACE FUNCTION audit_log_reject_mutation() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END $$;

CREATE TRIGGER audit_log_no_update_delete
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION audit_log_reject_mutation();

CREATE TRIGGER audit_log_no_truncate
BEFORE TRUNCATE ON "AuditLog"
FOR EACH STATEMENT EXECUTE FUNCTION audit_log_reject_mutation();

-- Grant the audit viewer to the administrative roles.
INSERT INTO "Permission" ("id", "name", "createdAt")
VALUES (gen_random_uuid()::text, 'Audit Logs:Read', CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT gen_random_uuid()::text, r."id", p."id"
FROM "Role" r CROSS JOIN "Permission" p
WHERE r."name" IN ('Admin', 'Super Admin') AND p."name" = 'Audit Logs:Read'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
