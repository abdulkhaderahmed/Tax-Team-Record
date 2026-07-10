-- CreateTable
CREATE TABLE "SourceSystem" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "systemType" TEXT NOT NULL,
    "description" TEXT,
    "owner" TEXT,
    "department" TEXT,
    "externalProvider" TEXT,
    "accessMethod" TEXT,
    "refreshFrequency" TEXT,
    "containsPersonalData" BOOLEAN NOT NULL DEFAULT false,
    "containsPrivilegedData" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceSystem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourcePriorityRule" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "dataCategoryId" TEXT NOT NULL,
    "authSourceId" TEXT,
    "secondarySourceId" TEXT,
    "tertiarySourceId" TEXT,
    "conflictHandling" TEXT,
    "reviewOwner" TEXT,
    "reviewFrequency" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourcePriorityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceConflict" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "dataCategoryId" TEXT NOT NULL,
    "entityId" TEXT,
    "sourceAId" TEXT NOT NULL,
    "sourceAValue" TEXT NOT NULL,
    "sourceBId" TEXT NOT NULL,
    "sourceBValue" TEXT NOT NULL,
    "severity" TEXT,
    "reviewOwner" TEXT,
    "requiredConfirmation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "resolution" TEXT,
    "resolvedValue" TEXT,
    "resolutionRationale" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObligationSourceRef" (
    "id" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "sourceSystemId" TEXT,
    "dataCategoryId" TEXT,
    "documentReference" TEXT,
    "pageOrChunk" TEXT,
    "isAuthoritative" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "confidence" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObligationSourceRef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourceSystem_organisationId_idx" ON "SourceSystem"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "DataCategory_name_key" ON "DataCategory"("name");

-- CreateIndex
CREATE INDEX "SourcePriorityRule_organisationId_idx" ON "SourcePriorityRule"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "SourcePriorityRule_organisationId_dataCategoryId_key" ON "SourcePriorityRule"("organisationId", "dataCategoryId");

-- CreateIndex
CREATE INDEX "SourceConflict_organisationId_idx" ON "SourceConflict"("organisationId");

-- CreateIndex
CREATE INDEX "SourceConflict_dataCategoryId_idx" ON "SourceConflict"("dataCategoryId");

-- CreateIndex
CREATE INDEX "SourceConflict_status_idx" ON "SourceConflict"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ObligationSourceRef_obligationId_key" ON "ObligationSourceRef"("obligationId");

-- AddForeignKey
ALTER TABLE "SourceSystem" ADD CONSTRAINT "SourceSystem_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcePriorityRule" ADD CONSTRAINT "SourcePriorityRule_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcePriorityRule" ADD CONSTRAINT "SourcePriorityRule_dataCategoryId_fkey" FOREIGN KEY ("dataCategoryId") REFERENCES "DataCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcePriorityRule" ADD CONSTRAINT "SourcePriorityRule_authSourceId_fkey" FOREIGN KEY ("authSourceId") REFERENCES "SourceSystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcePriorityRule" ADD CONSTRAINT "SourcePriorityRule_secondarySourceId_fkey" FOREIGN KEY ("secondarySourceId") REFERENCES "SourceSystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcePriorityRule" ADD CONSTRAINT "SourcePriorityRule_tertiarySourceId_fkey" FOREIGN KEY ("tertiarySourceId") REFERENCES "SourceSystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceConflict" ADD CONSTRAINT "SourceConflict_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceConflict" ADD CONSTRAINT "SourceConflict_dataCategoryId_fkey" FOREIGN KEY ("dataCategoryId") REFERENCES "DataCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceConflict" ADD CONSTRAINT "SourceConflict_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceConflict" ADD CONSTRAINT "SourceConflict_sourceAId_fkey" FOREIGN KEY ("sourceAId") REFERENCES "SourceSystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceConflict" ADD CONSTRAINT "SourceConflict_sourceBId_fkey" FOREIGN KEY ("sourceBId") REFERENCES "SourceSystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObligationSourceRef" ADD CONSTRAINT "ObligationSourceRef_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "ManualObligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObligationSourceRef" ADD CONSTRAINT "ObligationSourceRef_sourceSystemId_fkey" FOREIGN KEY ("sourceSystemId") REFERENCES "SourceSystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObligationSourceRef" ADD CONSTRAINT "ObligationSourceRef_dataCategoryId_fkey" FOREIGN KEY ("dataCategoryId") REFERENCES "DataCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
