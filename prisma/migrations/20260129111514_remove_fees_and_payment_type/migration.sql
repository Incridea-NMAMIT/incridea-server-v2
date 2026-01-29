/*
  Warnings:

  - The values [EVENT_REGISTRATION] on the enum `PaymentPurpose` will be removed. If these variants are still used in the database, this will fail.
  - The values [EVENT_REGISTRATION] on the enum `PaymentType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `userId` on the `AccommodationBooking` table. All the data in the column will be lost.
  - You are about to drop the column `championshipPoints` on the `College` table. All the data in the column will be lost.
  - You are about to drop the column `fees` on the `Event` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[pidId]` on the table `Winners` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `pidId` to the `AccommodationBooking` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
-- Handle conflicting Payment data
DELETE FROM "Payment" WHERE "purpose"::text = 'EVENT_REGISTRATION';
CREATE TYPE "PaymentPurpose_new" AS ENUM ('FEST_REGISTRATION', 'MERCH', 'ACCOMMODATION');
ALTER TABLE "Payment" ALTER COLUMN "purpose" TYPE "PaymentPurpose_new" USING ("purpose"::text::"PaymentPurpose_new");
ALTER TYPE "PaymentPurpose" RENAME TO "PaymentPurpose_old";
ALTER TYPE "PaymentPurpose_new" RENAME TO "PaymentPurpose";
DROP TYPE "PaymentPurpose_old";
COMMIT;

-- AlterEnum
BEGIN;
-- Handle conflicting PaymentOrder and AccommodationPayment data
DELETE FROM "PaymentOrder" WHERE "type"::text = 'EVENT_REGISTRATION';
DELETE FROM "AccommodationPayment" WHERE "type"::text = 'EVENT_REGISTRATION';

CREATE TYPE "PaymentType_new" AS ENUM ('FEST_REGISTRATION', 'ACC_REGISTRATION');
ALTER TABLE "AccommodationPayment" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "PaymentOrder" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "PaymentOrder" ALTER COLUMN "type" TYPE "PaymentType_new" USING ("type"::text::"PaymentType_new");
ALTER TABLE "AccommodationPayment" ALTER COLUMN "type" TYPE "PaymentType_new" USING ("type"::text::"PaymentType_new");
ALTER TYPE "PaymentType" RENAME TO "PaymentType_old";
ALTER TYPE "PaymentType_new" RENAME TO "PaymentType";
DROP TYPE "PaymentType_old";
ALTER TABLE "AccommodationPayment" ALTER COLUMN "type" SET DEFAULT 'ACC_REGISTRATION';
ALTER TABLE "PaymentOrder" ALTER COLUMN "type" SET DEFAULT 'FEST_REGISTRATION';
COMMIT;

-- AlterEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'Role' AND e.enumlabel = 'ACCOMMODATION') THEN
        ALTER TYPE "Role" ADD VALUE 'ACCOMMODATION';
    END IF;
END $$;

-- DropForeignKey
ALTER TABLE "AccommodationBooking" DROP CONSTRAINT IF EXISTS "AccommodationBooking_userId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "AccommodationBooking_userId_idx";

-- AlterTable
-- Safely migrate userId to pidId
ALTER TABLE "AccommodationBooking" ADD COLUMN IF NOT EXISTS "pidId" INTEGER;

-- Update pidId from PID table based on userId (only if userId still exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'AccommodationBooking' AND column_name = 'userId') THEN
        UPDATE "AccommodationBooking" ab
        SET "pidId" = p.id
        FROM "PID" p
        WHERE p."userId" = ab."userId";
    END IF;
END $$;

-- Delete bookings that have no associated PID (stale or invalid data)
DELETE FROM "AccommodationBooking" WHERE "pidId" IS NULL;

-- Enforce NOT NULL constraint and drop userId safely
DO $$
BEGIN
    -- Set pidId to NOT NULL if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'AccommodationBooking' AND column_name = 'pidId') THEN
        ALTER TABLE "AccommodationBooking" ALTER COLUMN "pidId" SET NOT NULL;
    END IF;

    -- Drop userId if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'AccommodationBooking' AND column_name = 'userId') THEN
        ALTER TABLE "AccommodationBooking" DROP COLUMN "userId";
    END IF;
END $$;

-- AlterTable College safely
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'College' AND column_name = 'championshipPoints') THEN
        ALTER TABLE "College" DROP COLUMN "championshipPoints";
    END IF;
END $$;

-- AlterTable Committee safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Committee' AND column_name = 'canCreateClassified') THEN
        ALTER TABLE "Committee" ADD COLUMN "canCreateClassified" BOOLEAN NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Committee' AND column_name = 'canCreateDocuments') THEN
        ALTER TABLE "Committee" ADD COLUMN "canCreateDocuments" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- AlterTable CommitteeMembership safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'CommitteeMembership' AND column_name = 'photo') THEN
        ALTER TABLE "CommitteeMembership" ADD COLUMN "photo" TEXT;
    END IF;
END $$;

-- AlterTable Event safely
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Event' AND column_name = 'fees') THEN
        ALTER TABLE "Event" DROP COLUMN "fees";
    END IF;
END $$;

-- AlterTable Winners safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Winners' AND column_name = 'pidId') THEN
        ALTER TABLE "Winners" ADD COLUMN "pidId" INTEGER;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Winners' AND column_name = 'teamId') THEN
        ALTER TABLE "Winners" ALTER COLUMN "teamId" DROP NOT NULL;
    END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DocumentUserAccess" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentUserAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChampionshipPoints" (
    "id" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "eventId" INTEGER NOT NULL,
    "winnerType" "WinnerType" NOT NULL,
    "pidId" INTEGER NOT NULL,
    "collegeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChampionshipPoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DocumentationSetting" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DocumentUserAccess_documentId_idx" ON "DocumentUserAccess"("documentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DocumentUserAccess_userId_idx" ON "DocumentUserAccess"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentUserAccess_documentId_userId_key" ON "DocumentUserAccess"("documentId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChampionshipPoints_eventId_idx" ON "ChampionshipPoints"("eventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChampionshipPoints_pidId_idx" ON "ChampionshipPoints"("pidId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChampionshipPoints_collegeId_idx" ON "ChampionshipPoints"("collegeId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentationSetting_key_key" ON "DocumentationSetting"("key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AccommodationBooking_pidId_idx" ON "AccommodationBooking"("pidId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Winners_pidId_key" ON "Winners"("pidId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Winners_pidId_idx" ON "Winners"("pidId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Session_userId_fkey') THEN
        ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Winners_pidId_fkey') THEN
        ALTER TABLE "Winners" ADD CONSTRAINT "Winners_pidId_fkey" FOREIGN KEY ("pidId") REFERENCES "PID"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DocumentUserAccess_documentId_fkey') THEN
        ALTER TABLE "DocumentUserAccess" ADD CONSTRAINT "DocumentUserAccess_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DocumentUserAccess_userId_fkey') THEN
        ALTER TABLE "DocumentUserAccess" ADD CONSTRAINT "DocumentUserAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChampionshipPoints_eventId_fkey') THEN
        ALTER TABLE "ChampionshipPoints" ADD CONSTRAINT "ChampionshipPoints_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChampionshipPoints_pidId_fkey') THEN
        ALTER TABLE "ChampionshipPoints" ADD CONSTRAINT "ChampionshipPoints_pidId_fkey" FOREIGN KEY ("pidId") REFERENCES "PID"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChampionshipPoints_collegeId_fkey') THEN
        ALTER TABLE "ChampionshipPoints" ADD CONSTRAINT "ChampionshipPoints_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AccommodationBooking_pidId_fkey') THEN
        ALTER TABLE "AccommodationBooking" ADD CONSTRAINT "AccommodationBooking_pidId_fkey" FOREIGN KEY ("pidId") REFERENCES "PID"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
