/*
  Warnings:

  - You are about to drop the column `totalXp` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Hotel` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Level` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserInHotel` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `XP` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[pidId,teamId]` on the table `TeamMember` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `pidId` to the `TeamMember` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AccessType" AS ENUM ('HEAD_ONLY', 'HEAD_AND_COHEAD');

-- AlterEnum
ALTER TYPE "PaymentType" ADD VALUE 'ACC_REGISTRATION';

-- DropForeignKey
ALTER TABLE "Level" DROP CONSTRAINT "Level_EventId_fkey";

-- DropForeignKey
ALTER TABLE "Level" DROP CONSTRAINT "Level_winnerId_fkey";

-- DropForeignKey
ALTER TABLE "TeamMember" DROP CONSTRAINT "TeamMember_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserInHotel" DROP CONSTRAINT "UserInHotel_hotelId_fkey";

-- DropForeignKey
ALTER TABLE "UserInHotel" DROP CONSTRAINT "UserInHotel_userId_fkey";

-- DropForeignKey
ALTER TABLE "XP" DROP CONSTRAINT "XP_levelId_fkey";

-- DropForeignKey
ALTER TABLE "XP" DROP CONSTRAINT "XP_userId_fkey";

-- DropIndex
DROP INDEX "Committee_coHeadUserId_key";

-- DropIndex
DROP INDEX "Committee_headUserId_key";

-- DropIndex
DROP INDEX "TeamMember_teamId_userId_idx";

-- DropIndex
DROP INDEX "TeamMember_userId_teamId_key";

-- AlterTable
ALTER TABLE "Criteria" ADD COLUMN     "scoreOutOf" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "day" "DayType";

-- AlterTable
ALTER TABLE "TeamMember" ADD COLUMN     "pidId" INTEGER NOT NULL,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "totalXp";

-- DropTable
DROP TABLE "Hotel";

-- DropTable
DROP TABLE "Level";

-- DropTable
DROP TABLE "UserInHotel";

-- DropTable
DROP TABLE "XP";

-- CreateTable
CREATE TABLE "PID" (
    "id" SERIAL NOT NULL,
    "pidCode" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "paymentOrderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PID_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriorUser" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "phoneNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriorUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerVariable" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServerVariable_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "DocumentDetails" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requestedBy" TEXT,
    "committeeId" INTEGER NOT NULL,
    "isClassified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAccess" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "committeeId" INTEGER NOT NULL,
    "accessType" "AccessType" NOT NULL,

    CONSTRAINT "DocumentAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" SERIAL NOT NULL,
    "documentCode" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "docDetailsId" INTEGER NOT NULL,
    "generatedById" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccommodationPayment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 200,
    "paymentData" JSONB,
    "status" "Status" NOT NULL DEFAULT 'PENDING',
    "type" "PaymentType" NOT NULL DEFAULT 'ACC_REGISTRATION',
    "userId" INTEGER NOT NULL,
    "pidId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccommodationPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccommodationBooking" (
    "id" TEXT NOT NULL,
    "accommodationType" "Gender" NOT NULL,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3) NOT NULL,
    "idCard" TEXT,
    "invoice" TEXT,
    "status" "AccommodationBookingStatus" NOT NULL DEFAULT 'PENDING',
    "userId" INTEGER NOT NULL,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccommodationBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccommodationRequests" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccommodationRequests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PID_pidCode_key" ON "PID"("pidCode");

-- CreateIndex
CREATE UNIQUE INDEX "PID_userId_key" ON "PID"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PID_paymentOrderId_key" ON "PID"("paymentOrderId");

-- CreateIndex
CREATE INDEX "PID_userId_idx" ON "PID"("userId");

-- CreateIndex
CREATE INDEX "PID_pidCode_idx" ON "PID"("pidCode");

-- CreateIndex
CREATE UNIQUE INDEX "PriorUser_email_key" ON "PriorUser"("email");

-- CreateIndex
CREATE INDEX "DocumentDetails_committeeId_idx" ON "DocumentDetails"("committeeId");

-- CreateIndex
CREATE INDEX "DocumentAccess_committeeId_idx" ON "DocumentAccess"("committeeId");

-- CreateIndex
CREATE INDEX "DocumentAccess_documentId_idx" ON "DocumentAccess"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentAccess_documentId_committeeId_key" ON "DocumentAccess"("documentId", "committeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_documentCode_key" ON "Document"("documentCode");

-- CreateIndex
CREATE INDEX "Document_docDetailsId_idx" ON "Document"("docDetailsId");

-- CreateIndex
CREATE INDEX "Document_generatedById_idx" ON "Document"("generatedById");

-- CreateIndex
CREATE UNIQUE INDEX "AccommodationPayment_orderId_key" ON "AccommodationPayment"("orderId");

-- CreateIndex
CREATE INDEX "AccommodationPayment_userId_idx" ON "AccommodationPayment"("userId");

-- CreateIndex
CREATE INDEX "AccommodationBooking_userId_idx" ON "AccommodationBooking"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AccommodationRequests_key_key" ON "AccommodationRequests"("key");

-- CreateIndex
CREATE INDEX "Team_leaderId_idx" ON "Team"("leaderId");

-- CreateIndex
CREATE INDEX "TeamMember_teamId_pidId_idx" ON "TeamMember"("teamId", "pidId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_pidId_teamId_key" ON "TeamMember"("pidId", "teamId");

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "PID"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_pidId_fkey" FOREIGN KEY ("pidId") REFERENCES "PID"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PID" ADD CONSTRAINT "PID_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PID" ADD CONSTRAINT "PID_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("orderId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentDetails" ADD CONSTRAINT "DocumentDetails_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccess" ADD CONSTRAINT "DocumentAccess_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccess" ADD CONSTRAINT "DocumentAccess_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_docDetailsId_fkey" FOREIGN KEY ("docDetailsId") REFERENCES "DocumentDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccommodationPayment" ADD CONSTRAINT "AccommodationPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccommodationPayment" ADD CONSTRAINT "AccommodationPayment_pidId_fkey" FOREIGN KEY ("pidId") REFERENCES "PID"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccommodationBooking" ADD CONSTRAINT "AccommodationBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccommodationBooking" ADD CONSTRAINT "AccommodationBooking_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "AccommodationPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
