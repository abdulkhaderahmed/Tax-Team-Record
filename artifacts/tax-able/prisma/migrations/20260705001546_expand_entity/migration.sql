/*
  Warnings:

  - You are about to drop the column `accountingYearEndDay` on the `Entity` table. All the data in the column will be lost.
  - You are about to drop the column `accountingYearEndMonth` on the `Entity` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Entity" DROP COLUMN "accountingYearEndDay",
DROP COLUMN "accountingYearEndMonth",
ADD COLUMN     "accountingPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "accountingPeriodStart" TIMESTAMP(3),
ADD COLUMN     "aiaRelevant" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "capitalAllowancesActivity" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ccoInScope" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "companiesHouseAccountsDue" TIMESTAMP(3),
ADD COLUMN     "corporationTaxUtr" TEXT,
ADD COLUMN     "ctPaymentMethod" TEXT,
ADD COLUMN     "ctReturnRequired" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "entityType" TEXT,
ADD COLUMN     "externalAdviser" TEXT,
ADD COLUMN     "financeOwner" TEXT,
ADD COLUMN     "fullExpensingRelevant" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "groupReliefRelevant" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasEmi" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lossesBroughtForward" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "p11dRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "payeRegistered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "payrollOwner" TEXT,
ADD COLUMN     "primaryTaxOwner" TEXT,
ADD COLUMN     "psaRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publishedTaxStrategyInScope" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rdAifNeeded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rdClaimExpected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rdNotificationNeeded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "saoInScope" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "specialRatePoolRelevant" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "taxableProfitsBand" TEXT,
ADD COLUMN     "transferPricingRelevant" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ukTaxResident" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "vatRegistered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vatRegistrationNumber" TEXT;
