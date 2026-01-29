/*
  Warnings:

  - You are about to drop the column `paymentId` on the `AccommodationBooking` table. All the data in the column will be lost.
  - You are about to drop the `AccommodationPayment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EventPaymentOrder` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AccommodationBooking" DROP CONSTRAINT "AccommodationBooking_paymentId_fkey";

-- DropForeignKey
ALTER TABLE "AccommodationPayment" DROP CONSTRAINT "AccommodationPayment_pidId_fkey";

-- DropForeignKey
ALTER TABLE "AccommodationPayment" DROP CONSTRAINT "AccommodationPayment_userId_fkey";

-- DropForeignKey
ALTER TABLE "EventPaymentOrder" DROP CONSTRAINT "EventPaymentOrder_teamId_fkey";

-- AlterTable
ALTER TABLE "AccommodationBooking" DROP COLUMN "paymentId",
ADD COLUMN     "paymentOrderId" TEXT;

-- DropTable
DROP TABLE "AccommodationPayment";

-- DropTable
DROP TABLE "EventPaymentOrder";

-- AddForeignKey
ALTER TABLE "AccommodationBooking" ADD CONSTRAINT "AccommodationBooking_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("orderId") ON DELETE SET NULL ON UPDATE CASCADE;
