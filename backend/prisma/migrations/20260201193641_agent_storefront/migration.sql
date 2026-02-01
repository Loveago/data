-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "agentProfitCreditedAt" TIMESTAMP(3),
ADD COLUMN     "agentStorefrontId" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "agentCostPrice" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "AgentStorefront" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "welcomeMessage" TEXT,
    "heroEmoji" TEXT,
    "accentColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentStorefront_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentStorefrontPrice" (
    "id" TEXT NOT NULL,
    "storefrontId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sellPrice" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentStorefrontPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentStorefront_userId_key" ON "AgentStorefront"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentStorefront_slug_key" ON "AgentStorefront"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AgentStorefrontPrice_storefrontId_productId_key" ON "AgentStorefrontPrice"("storefrontId", "productId");

-- AddForeignKey
ALTER TABLE "AgentStorefront" ADD CONSTRAINT "AgentStorefront_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentStorefrontPrice" ADD CONSTRAINT "AgentStorefrontPrice_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "AgentStorefront"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentStorefrontPrice" ADD CONSTRAINT "AgentStorefrontPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_agentStorefrontId_fkey" FOREIGN KEY ("agentStorefrontId") REFERENCES "AgentStorefront"("id") ON DELETE SET NULL ON UPDATE CASCADE;
