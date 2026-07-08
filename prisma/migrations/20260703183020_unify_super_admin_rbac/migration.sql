-- Unify RBAC: SuperAdmin now links to the main Role table via a reserved
-- "Super Admin" role, instead of the separate SuperAdminRole/SuperAdminPermission
-- system. This migration is additive-and-backfill first, destructive last, to
-- avoid ever orphaning the single existing SuperAdmin account.

-- 1. Seed the new Permission rows this unification introduces (idempotent).
INSERT INTO "Permission" ("id", "name", "createdAt")
SELECT gen_random_uuid()::text, name, CURRENT_TIMESTAMP
FROM (VALUES
  ('Users:Access'),
  ('Roles:Access'),
  ('Staff:Access'),
  ('Organization:Access'),
  ('Homepage Carousel:Access'),
  ('Performance:Access')
) AS new_perms(name)
WHERE NOT EXISTS (SELECT 1 FROM "Permission" p WHERE p.name = new_perms.name);

-- 2. Create the reserved "Super Admin" role in the main Role table (idempotent).
INSERT INTO "Role" ("id", "name", "description")
SELECT 'reserved-super-admin-role', 'Super Admin', 'Reserved system role for the single Super Admin account. Cannot be renamed, deleted, or assigned to another account.'
WHERE NOT EXISTS (SELECT 1 FROM "Role" WHERE "name" = 'Super Admin');

-- 3. Attach every existing Permission to the reserved role (idempotent, in case
--    of re-run or future permissions added after this migration).
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT gen_random_uuid()::text, r.id, p.id
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r.name = 'Super Admin'
  AND NOT EXISTS (
    SELECT 1 FROM "RolePermission" rp WHERE rp."roleId" = r.id AND rp."permissionId" = p.id
  );

-- 4. Drop the old FK from SuperAdmin to SuperAdminRole so it no longer blocks
--    repointing roleId below.
ALTER TABLE "SuperAdmin" DROP CONSTRAINT IF EXISTS "SuperAdmin_roleId_fkey";

-- 5. Backfill: repoint the existing SuperAdmin account's roleId at the reserved
--    Role row instead of its old SuperAdminRole row.
UPDATE "SuperAdmin"
SET "roleId" = (SELECT id FROM "Role" WHERE name = 'Super Admin')
WHERE "roleId" NOT IN (SELECT id FROM "Role");

-- 6. Re-add the FK pointing at the main Role table.
ALTER TABLE "SuperAdmin" ADD CONSTRAINT "SuperAdmin_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 7. Drop the now-fully-superseded separate RBAC tables.
DROP TABLE IF EXISTS "SuperAdminRolePermission";
DROP TABLE IF EXISTS "SuperAdminPermission";
DROP TABLE IF EXISTS "SuperAdminRole";
