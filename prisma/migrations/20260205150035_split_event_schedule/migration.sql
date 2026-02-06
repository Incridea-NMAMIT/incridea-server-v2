/*
  Warnings:

  - You are about to drop the column `day` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `venue` on the `Event` table. All the data in the column will be lost.

*/
-- AlterTable
-- CreateTable
CREATE TABLE "EventSchedule" (
    "id" SERIAL NOT NULL,
    "venue" TEXT,
    "day" "DayType" NOT NULL,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "eventId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSchedule_pkey" PRIMARY KEY ("id")
);

-- Data Migration: Move data from Event to EventSchedule
INSERT INTO "EventSchedule" ("venue", "day", "eventId", "updatedAt")
SELECT "venue", unnest("day"), "id", CURRENT_TIMESTAMP
FROM "Event";

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "day",
DROP COLUMN "venue";

-- CreateIndex
CREATE INDEX "EventSchedule_eventId_idx" ON "EventSchedule"("eventId");

-- AddForeignKey
ALTER TABLE "EventSchedule" ADD CONSTRAINT "EventSchedule_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
