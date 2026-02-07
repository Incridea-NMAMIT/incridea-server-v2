-- CreateTable
CREATE TABLE "_EventScheduleVenues" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_EventScheduleVenues_AB_unique" ON "_EventScheduleVenues"("A", "B");

-- CreateIndex
CREATE INDEX "_EventScheduleVenues_B_index" ON "_EventScheduleVenues"("B");

-- AddForeignKey
ALTER TABLE "_EventScheduleVenues" ADD CONSTRAINT "_EventScheduleVenues_A_fkey" FOREIGN KEY ("A") REFERENCES "EventSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EventScheduleVenues" ADD CONSTRAINT "_EventScheduleVenues_B_fkey" FOREIGN KEY ("B") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
