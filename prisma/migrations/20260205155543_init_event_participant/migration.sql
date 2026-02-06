-- 1. Create EventParticipant Table (Moved up)
CREATE TABLE "EventParticipant" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "pidId" INTEGER,
    "teamId" INTEGER,
    "roundNo" INTEGER NOT NULL DEFAULT 1,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "attended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventParticipant_pkey" PRIMARY KEY ("id")
);

-- 2. Populate EventParticipant
-- A. For Team Events (EventParticipant links to Team)
INSERT INTO "EventParticipant" ("eventId", "teamId", "roundNo", "confirmed", "createdAt", "updatedAt")
SELECT t."eventId", t."id", t."roundNo", t."confirmed", t."createdAt", t."updatedAt"
FROM "Team" t
JOIN "Event" e ON t."eventId" = e."id"
WHERE e."eventType" IN ('TEAM', 'TEAM_MULTIPLE_ENTRY');

-- B. For Individual Events (EventParticipant links to PID)
-- Find the PID via TeamMember. 
-- Note: Individual events currently use Team (size 1) -> TeamMember -> PID
INSERT INTO "EventParticipant" ("eventId", "pidId", "roundNo", "confirmed", "createdAt", "updatedAt")
SELECT t."eventId", tm."pidId", t."roundNo", t."confirmed", t."createdAt", t."updatedAt"
FROM "Team" t
JOIN "Event" e ON t."eventId" = e."id"
JOIN "TeamMember" tm ON t."id" = tm."teamId"
WHERE e."eventType" IN ('INDIVIDUAL', 'INDIVIDUAL_MULTIPLE_ENTRY');

-- 3. Add columns (NULLABLE initially)
ALTER TABLE "Scores" ADD COLUMN "eventParticipantId" INTEGER;
ALTER TABLE "Comments" ADD COLUMN "eventParticipantId" INTEGER;
ALTER TABLE "Winners" ADD COLUMN "eventParticipantId" INTEGER;
ALTER TABLE "QuizScore" ADD COLUMN "eventParticipantId" INTEGER;
ALTER TABLE "QuizSubmission" ADD COLUMN "eventParticipantId" INTEGER;

-- 4. Update References (Data Migration)

-- SCORES
-- Team Events (via TeamId)
UPDATE "Scores" s
SET "eventParticipantId" = ep.id
FROM "EventParticipant" ep
WHERE ep."teamId" = s."teamId";

-- Individual Events (via Team -> PID) (Scores currently linked to Team)
UPDATE "Scores" s
SET "eventParticipantId" = ep.id
FROM "Team" t
JOIN "TeamMember" tm ON t."id" = tm."teamId"
JOIN "EventParticipant" ep ON t."eventId" = ep."eventId" AND tm."pidId" = ep."pidId"
WHERE s."teamId" = t."id";


-- COMMENTS
-- Team Events
UPDATE "Comments" c
SET "eventParticipantId" = ep.id
FROM "EventParticipant" ep
WHERE ep."teamId" = c."teamId";

-- Individual Events
UPDATE "Comments" c
SET "eventParticipantId" = ep.id
FROM "Team" t
JOIN "TeamMember" tm ON t."id" = tm."teamId"
JOIN "EventParticipant" ep ON t."eventId" = ep."eventId" AND tm."pidId" = ep."pidId"
WHERE c."teamId" = t."id";


-- WINNERS
-- Winners table has `teamId` and `pidId` columns already.
-- If teamId is set (Team Events):
UPDATE "Winners" w
SET "eventParticipantId" = ep.id
FROM "EventParticipant" ep
WHERE w."teamId" IS NOT NULL AND ep."teamId" = w."teamId";

-- If pidId is set (Individual Events):
UPDATE "Winners" w
SET "eventParticipantId" = ep.id
FROM "EventParticipant" ep
WHERE w."pidId" IS NOT NULL AND ep."pidId" = w."pidId";


-- QUIZSCORE
-- Team Events
UPDATE "QuizScore" qs
SET "eventParticipantId" = ep.id
FROM "EventParticipant" ep
WHERE qs."teamId" IS NOT NULL AND ep."teamId" = qs."teamId";

-- Individual Events
UPDATE "QuizScore" qs
SET "eventParticipantId" = ep.id
FROM "Team" t
JOIN "TeamMember" tm ON t."id" = tm."teamId"
JOIN "EventParticipant" ep ON t."eventId" = ep."eventId" AND tm."pidId" = ep."pidId"
WHERE qs."teamId" = t."id";


-- QUIZSUBMISSION
-- Team Events
UPDATE "QuizSubmission" qs
SET "eventParticipantId" = ep.id
FROM "EventParticipant" ep
WHERE qs."teamId" IS NOT NULL AND ep."teamId" = qs."teamId";

-- Individual Events
UPDATE "QuizSubmission" qs
SET "eventParticipantId" = ep.id
FROM "Team" t
JOIN "TeamMember" tm ON t."id" = tm."teamId"
JOIN "EventParticipant" ep ON t."eventId" = ep."eventId" AND tm."pidId" = ep."pidId"
WHERE qs."teamId" = t."id";

-- 5. Handle Orphans (Clean up data that couldn't be migrated if any)
-- This assumes all scores/comments have valid teams/participants. 
-- Valid EventParticipantId is required for constraints.
-- If any row has NULL eventParticipantId, the subsequent ALTER TABLE ... NOT NULL will fail.
-- We could delete them: DELETE FROM "Scores" WHERE "eventParticipantId" IS NULL;


-- 6. Drop Indexes and Constraints (Legacy)
-- DropForeignKey
ALTER TABLE "Comments" DROP CONSTRAINT "Comments_teamId_fkey";

-- DropForeignKey
ALTER TABLE "QuizScore" DROP CONSTRAINT "QuizScore_teamId_fkey";

-- DropForeignKey
ALTER TABLE "QuizSubmission" DROP CONSTRAINT "QuizSubmission_teamId_fkey";

-- DropForeignKey
ALTER TABLE "Scores" DROP CONSTRAINT "Scores_teamId_fkey";

-- DropForeignKey
ALTER TABLE "Winners" DROP CONSTRAINT "Winners_pidId_fkey";

-- DropForeignKey
ALTER TABLE "Winners" DROP CONSTRAINT "Winners_teamId_fkey";

-- DropIndex
DROP INDEX "Comments_teamId_eventId_roundNo_judgeId_key";

-- DropIndex
DROP INDEX "Comments_teamId_idx";

-- DropIndex
DROP INDEX "QuizScore_teamId_idx";

-- DropIndex
DROP INDEX "QuizScore_teamId_quizId_key";

-- DropIndex
DROP INDEX "QuizSubmission_teamId_idx";

-- DropIndex
DROP INDEX "Scores_teamId_criteriaId_idx";

-- DropIndex
DROP INDEX "Scores_teamId_criteriaId_judgeId_key";

-- DropIndex
DROP INDEX "Team_eventId_roundNo_idx";

-- DropIndex
DROP INDEX "Winners_pidId_idx";

-- DropIndex
DROP INDEX "Winners_pidId_key";

-- DropIndex
DROP INDEX "Winners_teamId_idx";

-- DropIndex
DROP INDEX "Winners_teamId_key";

-- 7. Modify Columns (Drop old, Set New Constraint)

-- AlterTable Comments
DELETE FROM "Comments" WHERE "eventParticipantId" IS NULL; -- Prevent migration fail
ALTER TABLE "Comments" DROP COLUMN "teamId",
ALTER COLUMN "eventParticipantId" SET NOT NULL;

-- AlterTable PID
ALTER TABLE "PID" ADD COLUMN     "winnersId" INTEGER;

-- AlterTable QuizScore
-- DELETE FROM "QuizScore" WHERE "eventParticipantId" IS NULL; -- Optional if teamId is kept optional
ALTER TABLE "QuizScore" ALTER COLUMN "eventParticipantId" SET NOT NULL,
ALTER COLUMN "teamId" DROP NOT NULL;

-- AlterTable QuizSubmission
-- DELETE FROM "QuizSubmission" WHERE "eventParticipantId" IS NULL;
ALTER TABLE "QuizSubmission" ALTER COLUMN "eventParticipantId" SET NOT NULL,
ALTER COLUMN "teamId" DROP NOT NULL;

-- AlterTable Scores
DELETE FROM "Scores" WHERE "eventParticipantId" IS NULL;
ALTER TABLE "Scores" DROP COLUMN "teamId",
ALTER COLUMN "eventParticipantId" SET NOT NULL;

-- AlterTable Team
ALTER TABLE "Team" DROP COLUMN "attended",
DROP COLUMN "confirmed",
DROP COLUMN "roundNo";

-- AlterTable Winners
DELETE FROM "Winners" WHERE "eventParticipantId" IS NULL;
ALTER TABLE "Winners" DROP COLUMN "pidId",
DROP COLUMN "teamId",
ALTER COLUMN "eventParticipantId" SET NOT NULL;

-- Create Indexes for New Table
CREATE INDEX "EventParticipant_eventId_roundNo_idx" ON "EventParticipant"("eventId", "roundNo");
CREATE UNIQUE INDEX "EventParticipant_eventId_pidId_key" ON "EventParticipant"("eventId", "pidId");
CREATE UNIQUE INDEX "EventParticipant_eventId_teamId_key" ON "EventParticipant"("eventId", "teamId");

-- Create Indexes/FKs for updated tables
CREATE INDEX "Comments_eventParticipantId_idx" ON "Comments"("eventParticipantId");
CREATE UNIQUE INDEX "Comments_eventParticipantId_eventId_roundNo_judgeId_key" ON "Comments"("eventParticipantId", "eventId", "roundNo", "judgeId");

CREATE INDEX "QuizScore_eventParticipantId_idx" ON "QuizScore"("eventParticipantId");
CREATE UNIQUE INDEX "QuizScore_eventParticipantId_quizId_key" ON "QuizScore"("eventParticipantId", "quizId");

CREATE INDEX "QuizSubmission_eventParticipantId_idx" ON "QuizSubmission"("eventParticipantId");

CREATE INDEX "Scores_eventParticipantId_criteriaId_idx" ON "Scores"("eventParticipantId", "criteriaId");
CREATE UNIQUE INDEX "Scores_eventParticipantId_criteriaId_judgeId_key" ON "Scores"("eventParticipantId", "criteriaId", "judgeId");

CREATE UNIQUE INDEX "Winners_eventParticipantId_key" ON "Winners"("eventParticipantId");
CREATE INDEX "Winners_eventParticipantId_idx" ON "Winners"("eventParticipantId");

-- AddForeignKey
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_pidId_fkey" FOREIGN KEY ("pidId") REFERENCES "PID"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Scores" ADD CONSTRAINT "Scores_eventParticipantId_fkey" FOREIGN KEY ("eventParticipantId") REFERENCES "EventParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comments" ADD CONSTRAINT "Comments_eventParticipantId_fkey" FOREIGN KEY ("eventParticipantId") REFERENCES "EventParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Winners" ADD CONSTRAINT "Winners_eventParticipantId_fkey" FOREIGN KEY ("eventParticipantId") REFERENCES "EventParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizSubmission" ADD CONSTRAINT "QuizSubmission_eventParticipantId_fkey" FOREIGN KEY ("eventParticipantId") REFERENCES "EventParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizSubmission" ADD CONSTRAINT "QuizSubmission_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuizScore" ADD CONSTRAINT "QuizScore_eventParticipantId_fkey" FOREIGN KEY ("eventParticipantId") REFERENCES "EventParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizScore" ADD CONSTRAINT "QuizScore_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PID" ADD CONSTRAINT "PID_winnersId_fkey" FOREIGN KEY ("winnersId") REFERENCES "Winners"("id") ON DELETE SET NULL ON UPDATE CASCADE;
