-- CreateTable
CREATE TABLE "SuperAdminRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuperAdminRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuperAdminPermission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuperAdminPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuperAdminRolePermission" (
    "id" TEXT NOT NULL,
    "superAdminRoleId" TEXT NOT NULL,
    "superAdminPermissionId" TEXT NOT NULL,

    CONSTRAINT "SuperAdminRolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SuperAdminRole_name_key" ON "SuperAdminRole"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SuperAdminPermission_name_key" ON "SuperAdminPermission"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SuperAdminRolePermission_superAdminRoleId_superAdminPermi_key" ON "SuperAdminRolePermission"("superAdminRoleId", "superAdminPermissionId");

-- AddForeignKey
ALTER TABLE "SuperAdminRolePermission" ADD CONSTRAINT "SuperAdminRolePermission_superAdminRoleId_fkey" FOREIGN KEY ("superAdminRoleId") REFERENCES "SuperAdminRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuperAdminRolePermission" ADD CONSTRAINT "SuperAdminRolePermission_superAdminPermissionId_fkey" FOREIGN KEY ("superAdminPermissionId") REFERENCES "SuperAdminPermission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed a bootstrap "Super Admin" role so existing SuperAdmin rows can be backfilled
INSERT INTO "SuperAdminRole" ("id", "name", "description", "createdAt", "updatedAt")
VALUES ('bootstrap-super-admin-role', 'Super Admin', 'Full access to all Super Admin Portal modules.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

-- AlterTable: add roleId as nullable first, backfill, then enforce NOT NULL
ALTER TABLE "SuperAdmin" ADD COLUMN IF NOT EXISTS "roleId" TEXT;

UPDATE "SuperAdmin" SET "roleId" = (SELECT "id" FROM "SuperAdminRole" WHERE "name" = 'Super Admin') WHERE "roleId" IS NULL;

ALTER TABLE "SuperAdmin" ALTER COLUMN "roleId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "SuperAdmin" ADD CONSTRAINT "SuperAdmin_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "SuperAdminRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
