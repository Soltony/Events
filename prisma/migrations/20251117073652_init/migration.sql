-- CreateEnum
CREATE TYPE "PromoCodeType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "Event" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "location" TEXT NOT NULL,
    "hint" TEXT,
    "category" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'PENDING',
    "image" TEXT,
    "organizerId" TEXT NOT NULL,
    "rejectionReason" TEXT,
    "nibBankAccount" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "basePrice" DECIMAL(10,2) NOT NULL,
    "total" INTEGER NOT NULL,
    "sold" INTEGER NOT NULL,
    "locationPrices" JSONB,
    "eventId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendee" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "userId" TEXT,
    "eventId" INTEGER NOT NULL,
    "ticketTypeId" INTEGER NOT NULL,
    "qrCode" TEXT NOT NULL,
    "checkedIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "type" "PromoCodeType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "maxUses" INTEGER NOT NULL,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "eventId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT,
    "passwordChangeRequired" BOOLEAN NOT NULL DEFAULT true,
    "roleId" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "organizerId" TEXT,
    "branchId" TEXT,
    "nibBankAccount" TEXT,
    "tempPass" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPersonName" TEXT NOT NULL,
    "contactPersonPhone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "contactPersonName" TEXT NOT NULL,
    "contactPersonPhone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingOrder" (
    "id" TEXT NOT NULL,
    "arifpaySessionId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "eventId" INTEGER NOT NULL,
    "ticketTypeId" INTEGER NOT NULL,
    "attendeeData" JSONB NOT NULL,
    "attendeeId" INTEGER,
    "promoCode" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventPayment" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sessionId" TEXT,
    "transactionId" TEXT NOT NULL,
    "reference" TEXT,
    "paymentDate" TIMESTAMP(3),
    "pendingOrderId" TEXT NOT NULL,
    "eventId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Attendee_qrCode_key" ON "Attendee"("qrCode");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "District_name_key" ON "District"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PendingOrder_arifpaySessionId_key" ON "PendingOrder"("arifpaySessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PendingOrder_transactionId_key" ON "PendingOrder"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "PendingOrder_attendeeId_key" ON "PendingOrder"("attendeeId");

-- CreateIndex
CREATE UNIQUE INDEX "EventPayment_sessionId_key" ON "EventPayment"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "EventPayment_transactionId_key" ON "EventPayment"("transactionId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketType" ADD CONSTRAINT "TicketType_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendee" ADD CONSTRAINT "Attendee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendee" ADD CONSTRAINT "Attendee_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendee" ADD CONSTRAINT "Attendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingOrder" ADD CONSTRAINT "PendingOrder_attendeeId_fkey" FOREIGN KEY ("attendeeId") REFERENCES "Attendee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingOrder" ADD CONSTRAINT "PendingOrder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPayment" ADD CONSTRAINT "EventPayment_pendingOrderId_fkey" FOREIGN KEY ("pendingOrderId") REFERENCES "PendingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPayment" ADD CONSTRAINT "EventPayment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
