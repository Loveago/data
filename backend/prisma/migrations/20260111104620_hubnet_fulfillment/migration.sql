/*
  Warnings:

  - A unique constraint covering the columns `[hubnetReference]` on the table `OrderItem` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "HubnetFulfillmentStatus" AS ENUM ('PENDING', 'SENDING', 'SUBMITTED', 'DELIVERED', 'FAILED');

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "hubnetAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hubnetDeliveredAt" TIMESTAMP(3),
ADD COLUMN     "hubnetLastAttemptAt" TIMESTAMP(3),
ADD COLUMN     "hubnetLastError" TEXT,
ADD COLUMN     "hubnetNetwork" TEXT,
ADD COLUMN     "hubnetPaymentId" TEXT,
ADD COLUMN     "hubnetReference" TEXT,
ADD COLUMN     "hubnetStatus" "HubnetFulfillmentStatus",
ADD COLUMN     "hubnetTransactionId" TEXT,
ADD COLUMN     "hubnetVolumeMb" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_hubnetReference_key" ON "OrderItem"("hubnetReference");
