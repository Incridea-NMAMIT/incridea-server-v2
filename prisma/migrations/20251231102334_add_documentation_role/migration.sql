-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "AccommodationBookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProniteDay" AS ENUM ('Day1', 'Day2');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('FEST_REGISTRATION', 'EVENT_REGISTRATION');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'PARTICIPANT', 'ADMIN', 'JUDGE', 'JURY', 'DOCUMENTATION');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('RESET_PASSWORD', 'EMAIL_VERIFICATION');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('INDIVIDUAL', 'TEAM', 'INDIVIDUAL_MULTIPLE_ENTRY', 'TEAM_MULTIPLE_ENTRY');

-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('TECHNICAL', 'NON_TECHNICAL', 'CORE', 'SPECIAL');

-- CreateEnum
CREATE TYPE "EventTier" AS ENUM ('DIAMOND', 'GOLD', 'SILVER', 'BRONZE');

-- CreateEnum
CREATE TYPE "CommitteeName" AS ENUM ('MEDIA', 'SOCIAL_MEDIA', 'THORANA', 'EVENT_MANAGEMENT', 'ACCOMMODATION', 'DIGITAL', 'INAUGURAL', 'CREW', 'HOUSE_KEEPING', 'FOOD', 'TRANSPORT', 'PUBLICITY', 'DOCUMENTATION', 'FINANCE', 'CULTURAL', 'REQUIREMENTS', 'DISCIPLINARY', 'TECHNICAL', 'JURY');

-- CreateEnum
CREATE TYPE "CommitteeMembershipStatus" AS ENUM ('PENDING', 'APPROVED');

-- CreateEnum
CREATE TYPE "CollegeType" AS ENUM ('ENGINEERING', 'NON_ENGINEERING', 'OTHER');

-- CreateEnum
CREATE TYPE "CriteriaType" AS ENUM ('TEXT', 'NUMBER', 'TIME');

-- CreateEnum
CREATE TYPE "WinnerType" AS ENUM ('WINNER', 'RUNNER_UP', 'SECOND_RUNNER_UP');

-- CreateEnum
CREATE TYPE "DayType" AS ENUM ('Day1', 'Day2', 'Day3', 'Day4');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('INTERNAL', 'EXTERNAL', 'ALUMNI');

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "hashedToken" TEXT NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "id" TEXT NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "type" "VerificationType" NOT NULL DEFAULT 'EMAIL_VERIFICATION',
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "profileImage" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "password" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "category" "Category" NOT NULL DEFAULT 'INTERNAL',
    "otpHash" TEXT,
    "otpExpiresAt" TIMESTAMP(3),
    "collegeId" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" SERIAL NOT NULL,
    "role" "Role" NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alumni" (
    "id" SERIAL NOT NULL,
    "yearOfGraduation" INTEGER NOT NULL,
    "idDocument" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alumni_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "College" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "details" TEXT,
    "championshipPoints" INTEGER NOT NULL DEFAULT 0,
    "type" "CollegeType" NOT NULL DEFAULT 'ENGINEERING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "College_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variable" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Variable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Committee" (
    "id" SERIAL NOT NULL,
    "name" "CommitteeName" NOT NULL,
    "headUserId" INTEGER,
    "coHeadUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Committee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommitteeMembership" (
    "id" SERIAL NOT NULL,
    "status" "CommitteeMembershipStatus" NOT NULL DEFAULT 'PENDING',
    "userId" INTEGER NOT NULL,
    "committeeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommitteeMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "fees" INTEGER NOT NULL DEFAULT 0,
    "venue" TEXT,
    "minTeamSize" INTEGER NOT NULL DEFAULT 1,
    "maxTeamSize" INTEGER NOT NULL DEFAULT 1,
    "maxTeams" INTEGER,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "eventType" "EventType" NOT NULL DEFAULT 'INDIVIDUAL',
    "category" "EventCategory" NOT NULL DEFAULT 'TECHNICAL',
    "tier" "EventTier" NOT NULL DEFAULT 'GOLD',
    "branchId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "roundNo" INTEGER NOT NULL DEFAULT 1,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "attended" BOOLEAN NOT NULL DEFAULT false,
    "leaderId" INTEGER,
    "eventId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "roundNo" INTEGER NOT NULL DEFAULT 1,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "selectStatus" BOOLEAN NOT NULL DEFAULT false,
    "date" TIMESTAMP(3),
    "eventId" INTEGER NOT NULL,
    "quizId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("eventId","roundNo")
);

-- CreateTable
CREATE TABLE "PaymentOrder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 250,
    "paymentData" JSONB,
    "status" "Status" NOT NULL DEFAULT 'PENDING',
    "type" "PaymentType" NOT NULL DEFAULT 'FEST_REGISTRATION',
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventPaymentOrder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 250,
    "paymentData" JSONB,
    "status" "Status" NOT NULL DEFAULT 'PENDING',
    "teamId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventPaymentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchRep" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchRep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organiser" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "eventId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organiser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebLog" (
    "id" SERIAL NOT NULL,
    "message" TEXT NOT NULL,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Judge" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "eventId" INTEGER NOT NULL,
    "roundNo" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Judge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Criteria" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CriteriaType" NOT NULL DEFAULT 'NUMBER',
    "eventId" INTEGER NOT NULL,
    "roundNo" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scores" (
    "id" SERIAL NOT NULL,
    "score" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "criteriaId" INTEGER NOT NULL,
    "judgeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comments" (
    "id" SERIAL NOT NULL,
    "comment" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "eventId" INTEGER NOT NULL,
    "roundNo" INTEGER NOT NULL,
    "judgeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Winners" (
    "id" SERIAL NOT NULL,
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "type" "WinnerType" NOT NULL,
    "teamId" INTEGER NOT NULL,
    "eventId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Winners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PronitePass" (
    "id" SERIAL NOT NULL,
    "proniteDay" "ProniteDay" NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PronitePass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificateIssue" (
    "id" SERIAL NOT NULL,
    "issued" BOOLEAN NOT NULL DEFAULT false,
    "userId" INTEGER NOT NULL,
    "eventId" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificateIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Options" (
    "id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isAnswer" BOOLEAN NOT NULL DEFAULT false,
    "questionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizSubmission" (
    "id" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "optionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizScore" (
    "id" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "timeTaken" DOUBLE PRECISION NOT NULL,
    "flags" INTEGER NOT NULL DEFAULT 0,
    "allowUser" BOOLEAN NOT NULL DEFAULT true,
    "teamId" INTEGER NOT NULL,
    "quizId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "allowAttempts" BOOLEAN NOT NULL DEFAULT false,
    "points" INTEGER NOT NULL DEFAULT 1,
    "qualifyNext" INTEGER NOT NULL DEFAULT 5,
    "password" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "overridePassword" TEXT NOT NULL,
    "roundId" INTEGER NOT NULL,
    "eventId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "description" TEXT,
    "isCode" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "quizId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Level" (
    "id" SERIAL NOT NULL,
    "point" INTEGER NOT NULL DEFAULT 0,
    "EventId" INTEGER,
    "winnerId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Level_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XP" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "levelId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hotel" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "details" TEXT,
    "price" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hotel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInHotel" (
    "id" SERIAL NOT NULL,
    "IdCard" TEXT,
    "room" TEXT,
    "AC" BOOLEAN NOT NULL DEFAULT false,
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "gender" "Gender" NOT NULL,
    "status" "AccommodationBookingStatus" NOT NULL DEFAULT 'PENDING',
    "hotelId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserInHotel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_id_key" ON "RefreshToken"("id");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_id_key" ON "VerificationToken"("id");

-- CreateIndex
CREATE INDEX "VerificationToken_userId_idx" ON "VerificationToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_collegeId_idx" ON "User"("collegeId");

-- CreateIndex
CREATE INDEX "User_id_idx" ON "User"("id");

-- CreateIndex
CREATE INDEX "UserRole_userId_idx" ON "UserRole"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_role_key" ON "UserRole"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Alumni_userId_key" ON "Alumni"("userId");

-- CreateIndex
CREATE INDEX "Alumni_userId_idx" ON "Alumni"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Variable_key_key" ON "Variable"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Committee_name_key" ON "Committee"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Committee_headUserId_key" ON "Committee"("headUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Committee_coHeadUserId_key" ON "Committee"("coHeadUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CommitteeMembership_userId_key" ON "CommitteeMembership"("userId");

-- CreateIndex
CREATE INDEX "CommitteeMembership_committeeId_status_idx" ON "CommitteeMembership"("committeeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CommitteeMembership_committeeId_userId_key" ON "CommitteeMembership"("committeeId", "userId");

-- CreateIndex
CREATE INDEX "Event_branchId_idx" ON "Event"("branchId");

-- CreateIndex
CREATE INDEX "Team_eventId_roundNo_idx" ON "Team"("eventId", "roundNo");

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_eventId_key" ON "Team"("name", "eventId");

-- CreateIndex
CREATE INDEX "Round_quizId_idx" ON "Round"("quizId");

-- CreateIndex
CREATE UNIQUE INDEX "Round_eventId_roundNo_key" ON "Round"("eventId", "roundNo");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_orderId_key" ON "PaymentOrder"("orderId");

-- CreateIndex
CREATE INDEX "PaymentOrder_userId_idx" ON "PaymentOrder"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventPaymentOrder_orderId_key" ON "EventPaymentOrder"("orderId");

-- CreateIndex
CREATE INDEX "EventPaymentOrder_teamId_idx" ON "EventPaymentOrder"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "BranchRep_userId_key" ON "BranchRep"("userId");

-- CreateIndex
CREATE INDEX "BranchRep_branchId_userId_idx" ON "BranchRep"("branchId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "BranchRep_userId_branchId_key" ON "BranchRep"("userId", "branchId");

-- CreateIndex
CREATE INDEX "Organiser_eventId_userId_idx" ON "Organiser"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Organiser_userId_eventId_key" ON "Organiser"("userId", "eventId");

-- CreateIndex
CREATE INDEX "WebLog_createdAt_idx" ON "WebLog"("createdAt");

-- CreateIndex
CREATE INDEX "WebLog_userId_idx" ON "WebLog"("userId");

-- CreateIndex
CREATE INDEX "TeamMember_teamId_userId_idx" ON "TeamMember"("teamId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_userId_teamId_key" ON "TeamMember"("userId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Judge_userId_key" ON "Judge"("userId");

-- CreateIndex
CREATE INDEX "Judge_eventId_roundNo_userId_idx" ON "Judge"("eventId", "roundNo", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Judge_userId_eventId_roundNo_key" ON "Judge"("userId", "eventId", "roundNo");

-- CreateIndex
CREATE INDEX "Criteria_eventId_roundNo_idx" ON "Criteria"("eventId", "roundNo");

-- CreateIndex
CREATE INDEX "Scores_teamId_criteriaId_idx" ON "Scores"("teamId", "criteriaId");

-- CreateIndex
CREATE INDEX "Scores_criteriaId_idx" ON "Scores"("criteriaId");

-- CreateIndex
CREATE INDEX "Scores_judgeId_idx" ON "Scores"("judgeId");

-- CreateIndex
CREATE UNIQUE INDEX "Scores_teamId_criteriaId_judgeId_key" ON "Scores"("teamId", "criteriaId", "judgeId");

-- CreateIndex
CREATE INDEX "Comments_teamId_idx" ON "Comments"("teamId");

-- CreateIndex
CREATE INDEX "Comments_eventId_roundNo_idx" ON "Comments"("eventId", "roundNo");

-- CreateIndex
CREATE INDEX "Comments_judgeId_idx" ON "Comments"("judgeId");

-- CreateIndex
CREATE UNIQUE INDEX "Comments_teamId_eventId_roundNo_judgeId_key" ON "Comments"("teamId", "eventId", "roundNo", "judgeId");

-- CreateIndex
CREATE UNIQUE INDEX "Winners_teamId_key" ON "Winners"("teamId");

-- CreateIndex
CREATE INDEX "Winners_teamId_idx" ON "Winners"("teamId");

-- CreateIndex
CREATE INDEX "Winners_eventId_idx" ON "Winners"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Winners_eventId_type_key" ON "Winners"("eventId", "type");

-- CreateIndex
CREATE INDEX "PronitePass_userId_idx" ON "PronitePass"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PronitePass_userId_proniteDay_key" ON "PronitePass"("userId", "proniteDay");

-- CreateIndex
CREATE INDEX "CertificateIssue_userId_idx" ON "CertificateIssue"("userId");

-- CreateIndex
CREATE INDEX "CertificateIssue_eventId_idx" ON "CertificateIssue"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateIssue_userId_eventId_key" ON "CertificateIssue"("userId", "eventId");

-- CreateIndex
CREATE INDEX "Options_questionId_idx" ON "Options"("questionId");

-- CreateIndex
CREATE INDEX "QuizSubmission_teamId_idx" ON "QuizSubmission"("teamId");

-- CreateIndex
CREATE INDEX "QuizSubmission_optionId_idx" ON "QuizSubmission"("optionId");

-- CreateIndex
CREATE INDEX "QuizScore_quizId_idx" ON "QuizScore"("quizId");

-- CreateIndex
CREATE INDEX "QuizScore_teamId_idx" ON "QuizScore"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizScore_teamId_quizId_key" ON "QuizScore"("teamId", "quizId");

-- CreateIndex
CREATE INDEX "Quiz_roundId_idx" ON "Quiz"("roundId");

-- CreateIndex
CREATE UNIQUE INDEX "Quiz_eventId_roundId_key" ON "Quiz"("eventId", "roundId");

-- CreateIndex
CREATE INDEX "Question_quizId_idx" ON "Question"("quizId");

-- CreateIndex
CREATE INDEX "Level_EventId_idx" ON "Level"("EventId");

-- CreateIndex
CREATE INDEX "Level_winnerId_idx" ON "Level"("winnerId");

-- CreateIndex
CREATE INDEX "XP_userId_idx" ON "XP"("userId");

-- CreateIndex
CREATE INDEX "XP_levelId_idx" ON "XP"("levelId");

-- CreateIndex
CREATE UNIQUE INDEX "XP_userId_levelId_key" ON "XP"("userId", "levelId");

-- CreateIndex
CREATE UNIQUE INDEX "Hotel_name_key" ON "Hotel"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UserInHotel_userId_key" ON "UserInHotel"("userId");

-- CreateIndex
CREATE INDEX "UserInHotel_userId_idx" ON "UserInHotel"("userId");

-- CreateIndex
CREATE INDEX "UserInHotel_hotelId_idx" ON "UserInHotel"("hotelId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alumni" ADD CONSTRAINT "Alumni_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Committee" ADD CONSTRAINT "Committee_headUserId_fkey" FOREIGN KEY ("headUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Committee" ADD CONSTRAINT "Committee_coHeadUserId_fkey" FOREIGN KEY ("coHeadUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeMembership" ADD CONSTRAINT "CommitteeMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeMembership" ADD CONSTRAINT "CommitteeMembership_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPaymentOrder" ADD CONSTRAINT "EventPaymentOrder_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchRep" ADD CONSTRAINT "BranchRep_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchRep" ADD CONSTRAINT "BranchRep_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organiser" ADD CONSTRAINT "Organiser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organiser" ADD CONSTRAINT "Organiser_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebLog" ADD CONSTRAINT "WebLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Judge" ADD CONSTRAINT "Judge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Judge" ADD CONSTRAINT "Judge_eventId_roundNo_fkey" FOREIGN KEY ("eventId", "roundNo") REFERENCES "Round"("eventId", "roundNo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Criteria" ADD CONSTRAINT "Criteria_eventId_roundNo_fkey" FOREIGN KEY ("eventId", "roundNo") REFERENCES "Round"("eventId", "roundNo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scores" ADD CONSTRAINT "Scores_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scores" ADD CONSTRAINT "Scores_criteriaId_fkey" FOREIGN KEY ("criteriaId") REFERENCES "Criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scores" ADD CONSTRAINT "Scores_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "Judge"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comments" ADD CONSTRAINT "Comments_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comments" ADD CONSTRAINT "Comments_eventId_roundNo_fkey" FOREIGN KEY ("eventId", "roundNo") REFERENCES "Round"("eventId", "roundNo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comments" ADD CONSTRAINT "Comments_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "Judge"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Winners" ADD CONSTRAINT "Winners_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Winners" ADD CONSTRAINT "Winners_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PronitePass" ADD CONSTRAINT "PronitePass_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateIssue" ADD CONSTRAINT "CertificateIssue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateIssue" ADD CONSTRAINT "CertificateIssue_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Options" ADD CONSTRAINT "Options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizSubmission" ADD CONSTRAINT "QuizSubmission_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizSubmission" ADD CONSTRAINT "QuizSubmission_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizScore" ADD CONSTRAINT "QuizScore_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizScore" ADD CONSTRAINT "QuizScore_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_eventId_roundId_fkey" FOREIGN KEY ("eventId", "roundId") REFERENCES "Round"("eventId", "roundNo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Level" ADD CONSTRAINT "Level_EventId_fkey" FOREIGN KEY ("EventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Level" ADD CONSTRAINT "Level_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Winners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XP" ADD CONSTRAINT "XP_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XP" ADD CONSTRAINT "XP_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInHotel" ADD CONSTRAINT "UserInHotel_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInHotel" ADD CONSTRAINT "UserInHotel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
