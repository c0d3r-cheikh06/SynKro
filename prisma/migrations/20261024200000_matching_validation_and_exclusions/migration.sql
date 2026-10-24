-- Add READY_TO_PUBLISH to WeekStatus enum safely
ALTER TYPE "WeekStatus" ADD VALUE IF NOT EXISTS 'READY_TO_PUBLISH';

-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MatchValidationStatus') THEN
        CREATE TYPE "MatchValidationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
    END IF;
END
$$;

-- AlterTable Match (preserve all existing data)
ALTER TABLE "Match"
    ADD COLUMN IF NOT EXISTS "validationStatus" "MatchValidationStatus" NOT NULL DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS "validatedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "validatedById" TEXT,
    ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

-- Backfill already published or closed weeks so existing official pairs remain APPROVED
UPDATE "Match" m
SET
    "validationStatus" = 'APPROVED',
    "validatedAt" = COALESCE(mw."publishedAt", m."createdAt")
FROM "MatchingWeek" mw
WHERE m."weekId" = mw."id"
  AND mw."status" IN ('PUBLISHED', 'CLOSED')
  AND m."validationStatus" = 'PENDING';

-- CreateTable MatchPairExclusion
CREATE TABLE IF NOT EXISTS "MatchPairExclusion" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "weekId" TEXT,
    "studentAId" TEXT NOT NULL,
    "studentBId" TEXT NOT NULL,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchPairExclusion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Match_weekId_validationStatus_idx" ON "Match"("weekId", "validationStatus");
CREATE INDEX IF NOT EXISTS "MatchPairExclusion_cycleId_idx" ON "MatchPairExclusion"("cycleId");
CREATE INDEX IF NOT EXISTS "MatchPairExclusion_weekId_idx" ON "MatchPairExclusion"("weekId");
CREATE UNIQUE INDEX IF NOT EXISTS "MatchPairExclusion_cycleId_studentAId_studentBId_key" ON "MatchPairExclusion"("cycleId", "studentAId", "studentBId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MatchPairExclusion" ADD CONSTRAINT "MatchPairExclusion_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "MatchingCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchPairExclusion" ADD CONSTRAINT "MatchPairExclusion_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "MatchingWeek"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MatchPairExclusion" ADD CONSTRAINT "MatchPairExclusion_studentAId_fkey" FOREIGN KEY ("studentAId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MatchPairExclusion" ADD CONSTRAINT "MatchPairExclusion_studentBId_fkey" FOREIGN KEY ("studentBId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MatchPairExclusion" ADD CONSTRAINT "MatchPairExclusion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
