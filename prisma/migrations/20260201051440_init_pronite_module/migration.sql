-- AlterTable
ALTER TABLE "PronitePass" ADD COLUMN     "pidId" INTEGER,
ADD COLUMN     "scannedByVolunteerId" INTEGER;

-- CreateTable
CREATE TABLE "ProniteBooth" (
    "id" SERIAL NOT NULL,
    "location" TEXT NOT NULL,
    "assignedBands" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProniteBooth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProniteVolunteer" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "boothId" INTEGER NOT NULL,
    "proniteDay" "ProniteDay" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProniteVolunteer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProniteVolunteer_userId_proniteDay_key" ON "ProniteVolunteer"("userId", "proniteDay");

-- CreateIndex
CREATE INDEX "PronitePass_pidId_idx" ON "PronitePass"("pidId");

-- AddForeignKey
ALTER TABLE "PronitePass" ADD CONSTRAINT "PronitePass_pidId_fkey" FOREIGN KEY ("pidId") REFERENCES "PID"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PronitePass" ADD CONSTRAINT "PronitePass_scannedByVolunteerId_fkey" FOREIGN KEY ("scannedByVolunteerId") REFERENCES "ProniteVolunteer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProniteVolunteer" ADD CONSTRAINT "ProniteVolunteer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProniteVolunteer" ADD CONSTRAINT "ProniteVolunteer_boothId_fkey" FOREIGN KEY ("boothId") REFERENCES "ProniteBooth"("id") ON DELETE CASCADE ON UPDATE CASCADE;
