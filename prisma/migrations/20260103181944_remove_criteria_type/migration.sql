/*
  Warnings:

  - The values [PARTICIPANT,JUDGE] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `type` on the `Criteria` table. All the data in the column will be lost.
  - You are about to drop the column `completed` on the `Round` table. All the data in the column will be lost.
  - You are about to drop the column `notificationSent` on the `Round` table. All the data in the column will be lost.
  - You are about to drop the column `selectStatus` on the `Round` table. All the data in the column will be lost.
  - You are about to drop the column `notificationSent` on the `Winners` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('USER', 'ADMIN', 'JURY', 'DOCUMENTATION');
ALTER TABLE "UserRole" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Comments" DROP CONSTRAINT "Comments_judgeId_fkey";

-- DropForeignKey
ALTER TABLE "Scores" DROP CONSTRAINT "Scores_judgeId_fkey";

-- DropIndex
DROP INDEX "Judge_userId_key";

-- AlterTable
ALTER TABLE "Criteria" DROP COLUMN "type";

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "isBranch" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isStarted" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "branchId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Organiser" ADD COLUMN     "name" TEXT,
ADD COLUMN     "phoneNumber" TEXT;

-- AlterTable
ALTER TABLE "QuizScore" ADD COLUMN     "attemptStartTime" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Round" DROP COLUMN "completed",
DROP COLUMN "notificationSent",
DROP COLUMN "selectStatus",
ADD COLUMN     "isCompleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Winners" DROP COLUMN "notificationSent";

-- DropEnum
DROP TYPE "CriteriaType";

-- AddForeignKey
ALTER TABLE "Scores" ADD CONSTRAINT "Scores_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comments" ADD CONSTRAINT "Comments_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
