-- AlterEnum
ALTER TYPE "AlertChannel" ADD VALUE 'TELEGRAM';

-- AlterTable
ALTER TABLE "AlertRule" ADD COLUMN "telegramChatId" TEXT;
