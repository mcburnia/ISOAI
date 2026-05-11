-- AlterTable
ALTER TABLE "ControlMapping" ADD COLUMN     "applicable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "justification" TEXT;
