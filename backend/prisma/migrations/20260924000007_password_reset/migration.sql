-- AlterTable
ALTER TABLE "users" ADD COLUMN "passwordResetCode" TEXT;
ALTER TABLE "users" ADD COLUMN "passwordResetSentAt" DATETIME;
ALTER TABLE "users" ADD COLUMN "passwordResetExpiresAt" DATETIME;