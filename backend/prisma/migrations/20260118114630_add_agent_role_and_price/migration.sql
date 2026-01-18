-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'AGENT';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "agentPrice" DECIMAL(12,2);
