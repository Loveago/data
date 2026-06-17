-- AlterEnum: Add SUPER_AGENT to Role
ALTER TYPE "Role" ADD VALUE 'SUPER_AGENT';

-- AlterTable: Add superAgentPrice to Product
ALTER TABLE "Product" ADD COLUMN "superAgentPrice" DECIMAL(12,2);

-- CreateEnum: ApiAccessStatus
CREATE TYPE "ApiAccessStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable: ApiAccessRequest
CREATE TABLE "ApiAccessRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "status" "ApiAccessStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApiAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ApiKey
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiAccessRequest_userId_key" ON "ApiAccessRequest"("userId");
CREATE UNIQUE INDEX "ApiKey_userId_key" ON "ApiKey"("userId");
CREATE UNIQUE INDEX "ApiKey_requestId_key" ON "ApiKey"("requestId");
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");

-- AddForeignKey
ALTER TABLE "ApiAccessRequest" ADD CONSTRAINT "ApiAccessRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ApiAccessRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
