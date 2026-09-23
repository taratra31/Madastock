-- AlterTable
ALTER TABLE "users" ADD COLUMN "emailVerifyCode" TEXT;
ALTER TABLE "users" ADD COLUMN "emailVerifyExpiresAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "emailVerifySentAt" TIMESTAMP(3);