/*
  Warnings:

  - You are about to drop the column `externalOwner` on the `Action` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Action` table. All the data in the column will be lost.
  - The `evidenceRequired` column on the `Action` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `filingPaymentStatus` on the `ManualObligation` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Action" DROP COLUMN "externalOwner",
DROP COLUMN "status",
ADD COLUMN     "accountableApprovalRequired" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "approvalStatus" TEXT NOT NULL DEFAULT 'Not started',
ADD COLUMN     "consultedParty" TEXT,
ADD COLUMN     "dataCollectionRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dataCompletenessStatus" TEXT NOT NULL DEFAULT 'Not started',
ADD COLUMN     "dataValidationRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dataValidationStatus" TEXT NOT NULL DEFAULT 'Not started',
ADD COLUMN     "evidenceDescription" TEXT,
ADD COLUMN     "evidenceStatus" TEXT NOT NULL DEFAULT 'Not started',
ADD COLUMN     "exceptionRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "externalAdviser" TEXT,
ADD COLUMN     "externalOperationalOwner" TEXT,
ADD COLUMN     "filingSubmissionRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "filingSubmissionStatus" TEXT NOT NULL DEFAULT 'Not started',
ADD COLUMN     "informedParty" TEXT,
ADD COLUMN     "openIssueBlocker" TEXT,
ADD COLUMN     "overallStatus" TEXT NOT NULL DEFAULT 'Not started',
ADD COLUMN     "overallStatusIsOverride" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'Not started',
ADD COLUMN     "riskLevel" TEXT,
ADD COLUMN     "technicalReviewRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "technicalReviewStatus" TEXT NOT NULL DEFAULT 'Not started',
ADD COLUMN     "workflowProgressStatus" TEXT NOT NULL DEFAULT 'Not started',
DROP COLUMN "evidenceRequired",
ADD COLUMN     "evidenceRequired" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "AuditEvent" ADD COLUMN     "actionId" TEXT,
ADD COLUMN     "manualObligationId" TEXT;

-- AlterTable
ALTER TABLE "ManualObligation" DROP COLUMN "filingPaymentStatus",
ADD COLUMN     "accountableApprovalRequired" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "dataCollectionRequired" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "dataValidationRequired" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "externalOperationalOwner" TEXT,
ADD COLUMN     "filingSubmissionRequired" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "filingSubmissionStatus" TEXT NOT NULL DEFAULT 'Not started',
ADD COLUMN     "overallStatusIsOverride" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'Not started',
ADD COLUMN     "technicalReviewRequired" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "workflowProgressStatus" TEXT NOT NULL DEFAULT 'Not started';

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "organisationOrTeam" TEXT,
    "partyType" TEXT NOT NULL,
    "isExternal" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaciAssignment" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "manualObligationId" TEXT,
    "actionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaciAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusHistory" (
    "id" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "statusField" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedBy" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "StatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Party_organisationId_idx" ON "Party"("organisationId");

-- CreateIndex
CREATE INDEX "RaciAssignment_manualObligationId_idx" ON "RaciAssignment"("manualObligationId");

-- CreateIndex
CREATE INDEX "RaciAssignment_actionId_idx" ON "RaciAssignment"("actionId");

-- CreateIndex
CREATE INDEX "RaciAssignment_partyId_idx" ON "RaciAssignment"("partyId");

-- CreateIndex
CREATE INDEX "StatusHistory_objectType_objectId_idx" ON "StatusHistory"("objectType", "objectId");

-- CreateIndex
CREATE INDEX "StatusHistory_changedAt_idx" ON "StatusHistory"("changedAt");

-- CreateIndex
CREATE INDEX "AuditEvent_manualObligationId_idx" ON "AuditEvent"("manualObligationId");

-- CreateIndex
CREATE INDEX "AuditEvent_actionId_idx" ON "AuditEvent"("actionId");

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaciAssignment" ADD CONSTRAINT "RaciAssignment_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaciAssignment" ADD CONSTRAINT "RaciAssignment_manualObligationId_fkey" FOREIGN KEY ("manualObligationId") REFERENCES "ManualObligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaciAssignment" ADD CONSTRAINT "RaciAssignment_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_manualObligationId_fkey" FOREIGN KEY ("manualObligationId") REFERENCES "ManualObligation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE SET NULL ON UPDATE CASCADE;
