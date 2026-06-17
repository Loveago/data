-- CreateTable: ReferralPrice
CREATE TABLE "ReferralPrice" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralPrice_referrerId_productId_key" ON "ReferralPrice"("referrerId", "productId");

-- AddForeignKey
ALTER TABLE "ReferralPrice" ADD CONSTRAINT "ReferralPrice_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralPrice" ADD CONSTRAINT "ReferralPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
