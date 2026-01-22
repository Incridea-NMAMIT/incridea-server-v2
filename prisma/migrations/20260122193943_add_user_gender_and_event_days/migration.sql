/*
  Warnings:

  - You are about to drop the column `invoice` on the `AccommodationBooking` table. All the data in the column will be lost.
  - You are about to drop the column `paymentData` on the `PaymentOrder` table. All the data in the column will be lost.
  - Changed the column `day` on the `Event` table from a scalar field to a list field. If there are non-null values in that column, this step will fail.

*/
-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'NETBANKING', 'UPI', 'WALLET', 'EMI');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('FEST_REGISTRATION', 'EVENT_REGISTRATION', 'MERCH', 'ACCOMMODATION');

-- AlterTable
ALTER TABLE "AccommodationBooking" DROP COLUMN "invoice",
ADD COLUMN     "receipt" TEXT;

-- AlterTable
ALTER TABLE "AccommodationPayment" ALTER COLUMN "type" SET DEFAULT 'ACC_REGISTRATION';

-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "day" SET DEFAULT ARRAY['Day1']::"DayType"[],
ALTER COLUMN "day" SET DATA TYPE "DayType"[] USING CASE WHEN "day" IS NULL THEN ARRAY['Day1']::"DayType"[] ELSE ARRAY["day"] END;

-- AlterTable
ALTER TABLE "PaymentOrder" DROP COLUMN "paymentData",
ADD COLUMN     "collectedAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paymentDataJson" JSONB,
ADD COLUMN     "receipt" TEXT,
ALTER COLUMN "amount" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "gender" "Gender" NOT NULL DEFAULT 'MALE';

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "gatewayPaymentId" TEXT NOT NULL,
    "gatewayOrderId" TEXT,
    "entity" TEXT,
    "amount" INTEGER NOT NULL,
    "fee" INTEGER,
    "tax" INTEGER,
    "amountRefunded" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "PaymentStatus" NOT NULL,
    "captured" BOOLEAN NOT NULL DEFAULT false,
    "refundStatus" TEXT,
    "international" BOOLEAN NOT NULL DEFAULT false,
    "method" "PaymentMethod" NOT NULL,
    "bankCode" TEXT,
    "wallet" TEXT,
    "vpa" TEXT,
    "cardId" TEXT,
    "bankTransactionId" TEXT,
    "email" TEXT,
    "contact" TEXT,
    "purpose" "PaymentPurpose" NOT NULL,
    "registrationId" TEXT,
    "userId" TEXT,
    "errorCode" TEXT,
    "errorReason" TEXT,
    "errorSource" TEXT,
    "errorStep" TEXT,
    "errorDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_gatewayPaymentId_key" ON "Payment"("gatewayPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_gatewayOrderId_key" ON "Payment"("gatewayOrderId");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "Payment_registrationId_idx" ON "Payment"("registrationId");

-- CreateIndex
CREATE INDEX "Payment_gatewayOrderId_idx" ON "Payment"("gatewayOrderId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_gatewayOrderId_fkey" FOREIGN KEY ("gatewayOrderId") REFERENCES "PaymentOrder"("orderId") ON DELETE SET NULL ON UPDATE CASCADE;
