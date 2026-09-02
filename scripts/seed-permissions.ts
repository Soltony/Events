
// Additive, non-destructive sync of the Permission table from the single
// source of truth (PERMISSIONS_GROUPS). Unlike `prisma/seed.ts`, this never
// deletes or reassigns Roles/RolePermissions/Users — it only inserts
// Permission rows that don't exist yet (e.g. after adding a new permission
// like "Event Approvals:Access" to an already-seeded database with real
// roles and users). Existing role assignments are left untouched; grant the
// new permission to whichever role(s) need it via the Roles UI afterward.
import { PrismaClient } from '@prisma/client';
import { PERMISSIONS_GROUPS } from '../src/lib/permissions';

const prisma = new PrismaClient();

async function main() {
  const flatPermissions = Object.entries(PERMISSIONS_GROUPS).flatMap(([group, actions]) =>
    actions.map((action) => `${group}:${action}`)
  );

  const existing = await prisma.permission.findMany({ select: { name: true } });
  const existingNames = new Set(existing.map((p) => p.name));
  const missing = flatPermissions.filter((name) => !existingNames.has(name));

  if (missing.length === 0) {
    console.log('No new permissions to add. The Permission table is already up to date.');
    return;
  }

  for (const name of missing) {
    await prisma.permission.create({ data: { name } });
  }

  console.log(`Added ${missing.length} new permission(s): ${missing.join(', ')}`);
  console.log('Assign them to the relevant role(s) via the Roles UI.');
}

main()
  .catch((e) => {
    console.error('An error occurred while syncing permissions:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
