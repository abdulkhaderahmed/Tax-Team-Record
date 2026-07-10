-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "entityId" TEXT,
    "obligationId" TEXT,
    "sourceSystemId" TEXT,
    "filename" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT,
    "documentType" TEXT NOT NULL,
    "documentDate" TIMESTAMP(3),
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "adviserName" TEXT,
    "versionLabel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Uploaded',
    "sensitivityLevel" TEXT NOT NULL DEFAULT 'Low',
    "privilegeStatus" TEXT NOT NULL DEFAULT 'Unknown',
    "containsPersonalData" TEXT NOT NULL DEFAULT 'Unknown',
    "containsSpecialCategory" TEXT NOT NULL DEFAULT 'Unknown',
    "containsPayrollData" TEXT NOT NULL DEFAULT 'Unknown',
    "containsMaData" TEXT NOT NULL DEFAULT 'Unknown',
    "restrictedAccess" BOOLEAN NOT NULL DEFAULT false,
    "accessNotes" TEXT,
    "isAuthoritativeSource" TEXT NOT NULL DEFAULT 'Unknown',
    "sourceConfidence" TEXT NOT NULL DEFAULT 'Unknown',
    "supersedesDocumentId" TEXT,
    "supersededByDocumentId" TEXT,
    "relianceStatus" TEXT NOT NULL DEFAULT 'Draft',
    "extractionError" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "pageNumber" INTEGER,
    "text" TEXT NOT NULL,

    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentHealthFlag" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "marker" TEXT NOT NULL,
    "context" TEXT,
    "chunkIndex" INTEGER,
    "pageNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentHealthFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Document_organisationId_idx" ON "Document"("organisationId");

-- CreateIndex
CREATE INDEX "Document_entityId_idx" ON "Document"("entityId");

-- CreateIndex
CREATE INDEX "Document_documentType_idx" ON "Document"("documentType");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE INDEX "Document_uploadedAt_idx" ON "Document"("uploadedAt");

-- CreateIndex
CREATE INDEX "DocumentChunk_documentId_idx" ON "DocumentChunk"("documentId");

-- CreateIndex
CREATE INDEX "DocumentHealthFlag_documentId_idx" ON "DocumentHealthFlag"("documentId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_sourceSystemId_fkey" FOREIGN KEY ("sourceSystemId") REFERENCES "SourceSystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentHealthFlag" ADD CONSTRAINT "DocumentHealthFlag_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
