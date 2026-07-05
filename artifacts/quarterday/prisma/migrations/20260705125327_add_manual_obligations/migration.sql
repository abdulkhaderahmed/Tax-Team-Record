-- CreateTable
CREATE TABLE "ManualObligation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "entityId" TEXT,
    "regime" TEXT NOT NULL,
    "obligationType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "statutoryBasis" TEXT,
    "filingDeadline" TIMESTAMP(3),
    "paymentDeadline" TIMESTAMP(3),
    "internalTargetDate" TIMESTAMP(3),
    "recurrence" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "source" TEXT,
    "responsibleOwner" TEXT,
    "accountableOwner" TEXT,
    "consultedParty" TEXT,
    "informedParty" TEXT,
    "externalAdviser" TEXT,
    "dataCompletenessStatus" TEXT NOT NULL DEFAULT 'Not started',
    "dataValidationStatus" TEXT NOT NULL DEFAULT 'Not started',
    "technicalReviewStatus" TEXT NOT NULL DEFAULT 'Not started',
    "approvalStatus" TEXT NOT NULL DEFAULT 'Not started',
    "evidenceStatus" TEXT NOT NULL DEFAULT 'Not started',
    "filingPaymentStatus" TEXT NOT NULL DEFAULT 'Not started',
    "overallWorkflowStatus" TEXT NOT NULL DEFAULT 'Not started',
    "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
    "evidenceDescription" TEXT,
    "evidenceFileLink" TEXT,
    "evidenceOwner" TEXT,
    "riskLevel" TEXT,
    "consequenceOfMissingDeadline" TEXT,
    "openIssueBlocker" TEXT,
    "notes" TEXT,
    "exceptionRequired" BOOLEAN NOT NULL DEFAULT false,
    "sourceType" TEXT,
    "sourceDocumentReference" TEXT,
    "sourcePageParagraph" TEXT,
    "createdBy" TEXT,
    "lastUpdatedBy" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualObligation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManualObligation_organisationId_idx" ON "ManualObligation"("organisationId");

-- CreateIndex
CREATE INDEX "ManualObligation_entityId_idx" ON "ManualObligation"("entityId");

-- CreateIndex
CREATE INDEX "ManualObligation_filingDeadline_idx" ON "ManualObligation"("filingDeadline");

-- CreateIndex
CREATE INDEX "ManualObligation_overallWorkflowStatus_idx" ON "ManualObligation"("overallWorkflowStatus");

-- AddForeignKey
ALTER TABLE "ManualObligation" ADD CONSTRAINT "ManualObligation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualObligation" ADD CONSTRAINT "ManualObligation_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
