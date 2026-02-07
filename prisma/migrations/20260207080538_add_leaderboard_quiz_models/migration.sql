-- CreateTable
CREATE TABLE "LeaderboardQuizQuestion" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaderboardQuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardQuizAnswerSubmission" (
    "id" TEXT NOT NULL,
    "pidId" INTEGER NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerCorrect" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaderboardQuizAnswerSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardQuizOptions" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "option" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaderboardQuizOptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeaderboardQuizAnswerSubmission_pidId_idx" ON "LeaderboardQuizAnswerSubmission"("pidId");

-- CreateIndex
CREATE INDEX "LeaderboardQuizAnswerSubmission_questionId_idx" ON "LeaderboardQuizAnswerSubmission"("questionId");

-- CreateIndex
CREATE INDEX "LeaderboardQuizOptions_questionId_idx" ON "LeaderboardQuizOptions"("questionId");

-- AddForeignKey
ALTER TABLE "LeaderboardQuizAnswerSubmission" ADD CONSTRAINT "LeaderboardQuizAnswerSubmission_pidId_fkey" FOREIGN KEY ("pidId") REFERENCES "PID"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardQuizAnswerSubmission" ADD CONSTRAINT "LeaderboardQuizAnswerSubmission_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "LeaderboardQuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardQuizOptions" ADD CONSTRAINT "LeaderboardQuizOptions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "LeaderboardQuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
