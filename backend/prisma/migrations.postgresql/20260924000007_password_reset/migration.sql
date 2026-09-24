-- AlterTable
ALTER TABLE "users" ADD COLUMN "passwordResetCode" TEXT;
ALTER TABLE "users" ADD COLUMN "passwordResetSentAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "passwordResetExpiresAt" TIMESTAMP(3);