"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const permissions_1 = require("../src/lib/permissions");
async function main() {
    const prisma = new client_1.PrismaClient();
    try {
        for (const name of permissions_1.FLAT_PERMISSIONS) {
            await prisma.permission.upsert({
                where: { name },
                update: {},
                create: { name },
            });
        }
        console.log('Seeded permissions:', permissions_1.FLAT_PERMISSIONS.length);
    }
    catch (err) {
        console.error('Failed to seed permissions:', err);
        process.exitCode = 1;
    }
    finally {
        await prisma.$disconnect();
    }
}
main();
