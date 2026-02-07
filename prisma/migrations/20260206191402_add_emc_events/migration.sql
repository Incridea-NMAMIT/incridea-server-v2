-- AlterTable
ALTER TABLE "EventSchedule" ADD COLUMN     "emcEventId" INTEGER,
ALTER COLUMN "eventId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "EmcCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmcCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmcEvent" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" "EventCategory",
    "emcCategoryId" INTEGER,
    "venueId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmcEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmcCategory_name_key" ON "EmcCategory"("name");

-- CreateIndex
CREATE INDEX "EmcEvent_emcCategoryId_idx" ON "EmcEvent"("emcCategoryId");

-- CreateIndex
CREATE INDEX "EmcEvent_venueId_idx" ON "EmcEvent"("venueId");

-- CreateIndex
CREATE INDEX "EventSchedule_emcEventId_idx" ON "EventSchedule"("emcEventId");

-- AddForeignKey
ALTER TABLE "EventSchedule" ADD CONSTRAINT "EventSchedule_emcEventId_fkey" FOREIGN KEY ("emcEventId") REFERENCES "EmcEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmcEvent" ADD CONSTRAINT "EmcEvent_emcCategoryId_fkey" FOREIGN KEY ("emcCategoryId") REFERENCES "EmcCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmcEvent" ADD CONSTRAINT "EmcEvent_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
