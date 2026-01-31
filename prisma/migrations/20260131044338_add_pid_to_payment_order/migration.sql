/*
  Warnings:

  - You are about to drop the column `receipt` on the `AccommodationBooking` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `AccommodationBooking` table. All the data in the column will be lost.
  - You are about to drop the column `paymentOrderId` on the `PID` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[pidId]` on the table `AccommodationBooking` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "PID" DROP CONSTRAINT "PID_paymentOrderId_fkey";

-- DropIndex
DROP INDEX "AccommodationBooking_pidId_idx";

-- DropIndex
DROP INDEX "PID_paymentOrderId_key";

-- AlterTable
ALTER TABLE "AccommodationBooking" DROP COLUMN "receipt",
DROP COLUMN "status";

-- AlterTable
ALTER TABLE "PID" DROP COLUMN "paymentOrderId";

-- AlterTable
ALTER TABLE "PaymentOrder" ADD COLUMN     "PID" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AccommodationBooking_pidId_key" ON "AccommodationBooking"("pidId");

-- AddForeignKey
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_PID_fkey" FOREIGN KEY ("PID") REFERENCES "PID"("pidCode") ON DELETE CASCADE ON UPDATE CASCADE;
