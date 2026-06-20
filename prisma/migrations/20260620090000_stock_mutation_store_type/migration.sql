CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "StoreType" AS ENUM ('UTAMA', 'CABANG');

-- CreateEnum
CREATE TYPE "StockMutationStatus" AS ENUM ('REQUESTED', 'REJECTED', 'ACCEPTED', 'SHIPPED', 'RECEIVED');

-- AlterTable
ALTER TABLE "Store" ADD COLUMN "type" "StoreType" NOT NULL DEFAULT 'CABANG';

UPDATE "Store"
SET "type" = 'UTAMA'
WHERE "id" = (
  SELECT "id" FROM "Store"
  WHERE "deletedAt" IS NULL
  ORDER BY "createdAt" ASC
  LIMIT 1
);

-- AlterTable
ALTER TABLE "StockMutation"
ADD COLUMN "destinationInventoryId" TEXT,
ADD COLUMN "status" "StockMutationStatus" NOT NULL DEFAULT 'REQUESTED',
ADD COLUMN "requestedById" TEXT,
ADD COLUMN "acceptedById" TEXT,
ADD COLUMN "rejectedById" TEXT,
ADD COLUMN "shippedById" TEXT,
ADD COLUMN "receivedById" TEXT,
ADD COLUMN "acceptedAt" TIMESTAMP(3),
ADD COLUMN "rejectedAt" TIMESTAMP(3),
ADD COLUMN "shippedAt" TIMESTAMP(3),
ADD COLUMN "receivedAt" TIMESTAMP(3);

-- Backfill zero-stock inventory rows for every active product in every active store.
INSERT INTO "Inventory" ("id", "storeId", "productId", "stock", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", p."id", 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Store" s
CROSS JOIN "Product" p
LEFT JOIN "Inventory" i ON i."storeId" = s."id" AND i."productId" = p."id"
WHERE s."deletedAt" IS NULL
  AND p."deletedAt" IS NULL
  AND i."id" IS NULL;

-- AddForeignKey
ALTER TABLE "StockMutation" ADD CONSTRAINT "StockMutation_destinationInventoryId_fkey" FOREIGN KEY ("destinationInventoryId") REFERENCES "Inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMutation" ADD CONSTRAINT "StockMutation_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMutation" ADD CONSTRAINT "StockMutation_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMutation" ADD CONSTRAINT "StockMutation_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMutation" ADD CONSTRAINT "StockMutation_shippedById_fkey" FOREIGN KEY ("shippedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMutation" ADD CONSTRAINT "StockMutation_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
