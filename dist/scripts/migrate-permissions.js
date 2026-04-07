"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
/**
 * Migration helper: reads existing Role.permissions JSON strings, upserts Permission rows,
 * and creates RolePermission join rows. Run AFTER applying the migration that adds
 * Permission and RolePermission models but BEFORE removing the Role.permissions column.
 *
 * Usage:
 *   npx ts-node scripts/migrate-permissions.ts
 */
async function main() {
    const prisma = new client_1.PrismaClient();
    try {
        const roles = await prisma.role.findMany();
        console.log(`Found ${roles.length} roles.`);
        for (const role of roles) {
            if (!role.permissions)
                continue;
            let perms = [];
            try {
                perms = JSON.parse(role.permissions);
            }
            catch (e) {
                // Fall back to comma-separated parsing
                perms = role.permissions.split(',').map(p => p.trim()).filter(Boolean);
            }
            for (const permName of perms) {
                if (!permName)
                    continue;
                // Upsert permission
                const permission = await prisma.permission.upsert({
                    where: { name: permName },
                    update: {},
                    create: { name: permName },
                });
                // Create join row if not exists
                await prisma.rolePermission.upsert({
                    where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
                    update: {},
                    create: { roleId: role.id, permissionId: permission.id },
                });
            }
        }
        console.log('Permission migration complete.');
    }
    catch (err) {
        console.error('Migration failed:', err);
        process.exitCode = 1;
    }
    finally {
        await prisma.$disconnect();
    }
}
main();
