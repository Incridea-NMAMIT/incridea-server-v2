-- CreateTable
CREATE TABLE "LeaderboardTask" (
    "id" TEXT NOT NULL,
    "riddle" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "hint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaderboardTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardTaskHint" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "hint" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaderboardTaskHint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardTaskSubmission" (
    "id" TEXT NOT NULL,
    "pidId" INTEGER NOT NULL,
    "taskId" TEXT NOT NULL,
    "hintTaken" BOOLEAN NOT NULL DEFAULT false,
    "hintId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaderboardTaskSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeaderboardTaskHint_taskId_idx" ON "LeaderboardTaskHint"("taskId");

-- CreateIndex
CREATE INDEX "LeaderboardTaskSubmission_pidId_idx" ON "LeaderboardTaskSubmission"("pidId");

-- CreateIndex
CREATE INDEX "LeaderboardTaskSubmission_taskId_idx" ON "LeaderboardTaskSubmission"("taskId");

-- CreateIndex
CREATE INDEX "LeaderboardTaskSubmission_hintId_idx" ON "LeaderboardTaskSubmission"("hintId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardTaskSubmission_pidId_taskId_key" ON "LeaderboardTaskSubmission"("pidId", "taskId");

-- AddForeignKey
ALTER TABLE "LeaderboardTaskHint" ADD CONSTRAINT "LeaderboardTaskHint_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "LeaderboardTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardTaskSubmission" ADD CONSTRAINT "LeaderboardTaskSubmission_pidId_fkey" FOREIGN KEY ("pidId") REFERENCES "PID"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardTaskSubmission" ADD CONSTRAINT "LeaderboardTaskSubmission_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "LeaderboardTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardTaskSubmission" ADD CONSTRAINT "LeaderboardTaskSubmission_hintId_fkey" FOREIGN KEY ("hintId") REFERENCES "LeaderboardTaskHint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
