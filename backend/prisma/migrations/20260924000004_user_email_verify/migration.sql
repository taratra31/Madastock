-- AlterTable
ALTER TABLE "users" ADD COLUMN "emailVerifyCode" TEXT;
ALTER TABLE "users" ADD COLUMN "emailVerifyExpiresAt" DATETIME;
ALTER TABLE "users" ADD COLUMN "emailVerifySentAt" DATETIME;