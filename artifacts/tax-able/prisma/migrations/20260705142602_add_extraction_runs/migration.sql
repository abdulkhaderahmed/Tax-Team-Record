-- CreateTable
CREATE TABLE "ExtractionRun" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "modelProvider" TEXT NOT NULL DEFAULT 'openai',
    "modelName" TEXT NOT NULL DEFAULT 'gpt-4o',
    "promptVersion" TEXT NOT NULL DEFAULT '1',
    "extractionSchemaVersion" TEXT NOT NULL DEFAULT '1',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "errorMessage" TEXT,
    "totalChunksProcessed" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewItem" (
    "id" TEXT NOT NULL,
    "extractionRunId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "entityId" TEXT,
    "itemType" TEXT NOT NULL,
    "structuredJson" JSONB NOT NULL,
    "plainSummary" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourceChunkId" TEXT,
    "sourcePageSection" TEXT,
    "sourceTextExcerpt" TEXT,
    "conditionText" TEXT,
    "assumptionText" TEXT,
    "caveatText" TEXT,
    "isConditional" BOOLEAN NOT NULL DEFAULT false,
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "requiresHumanTaxReview" BOOLEAN NOT NULL DEFAULT true,
    "requiresSourceVerification" BOOLEAN NOT NULL DEFAULT false,
    "suggestedRegime" TEXT,
    "suggestedObligationType" TEXT,
    "suggestedDeadline" TIMESTAMP(3),
    "suggestedOwner" TEXT,
    "suggestedEvidenceRequired" TEXT,
    "suggestedSourceSystemId" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'Needs review',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewerNotes" TEXT,
    "rejectionReason" TEXT,
    "createdLiveObjectType" TEXT,
    "createdLiveObjectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExtractionRun_organisationId_idx" ON "ExtractionRun"("organisationId");

-- CreateIndex
CREATE INDEX "ExtractionRun_documentId_idx" ON "ExtractionRun"("documentId");

-- CreateIndex
CREATE INDEX "ExtractionRun_status_idx" ON "ExtractionRun"("status");

-- CreateIndex
CREATE INDEX "ReviewItem_extractionRunId_idx" ON "ReviewItem"("extractionRunId");

-- CreateIndex
CREATE INDEX "ReviewItem_documentId_idx" ON "ReviewItem"("documentId");

-- CreateIndex
CREATE INDEX "ReviewItem_itemType_idx" ON "ReviewItem"("itemType");

-- CreateIndex
CREATE INDEX "ReviewItem_reviewStatus_idx" ON "ReviewItem"("reviewStatus");

-- AddForeignKey
ALTER TABLE "ExtractionRun" ADD CONSTRAINT "ExtractionRun_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_extractionRunId_fkey" FOREIGN KEY ("extractionRunId") REFERENCES "ExtractionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
