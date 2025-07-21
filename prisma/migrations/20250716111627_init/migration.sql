/*
  Warnings:

  - The primary key for the `Attendee` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `value` on the `PromoCode` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.
  - You are about to alter the column `price` on the `TicketType` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.
  - Added the required column `updatedAt` to the `Attendee` table without a default value. This is not possible if the table is not empty.
  - Made the column `userId` on table `Attendee` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `PromoCode` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Role` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `TicketType` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Attendee" DROP CONSTRAINT "Attendee_userId_fkey";

-- DropIndex
DROP INDEX "Attendee_email_key";

-- AlterTable
ALTER TABLE "Attendee" DROP CONSTRAINT "Attendee_pkey",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET NOT NULL,
ADD CONSTRAINT "Attendee_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Attendee_id_seq";

-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "image" DROP NOT NULL,
ALTER COLUMN "image" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "PromoCode" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "value" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "permissions" DROP NOT NULL,
ALTER COLUMN "permissions" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "TicketType" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "price" SET DATA TYPE DECIMAL(10,2);

-- AddForeignKey
ALTER TABLE "Attendee" ADD CONSTRAINT "Attendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
