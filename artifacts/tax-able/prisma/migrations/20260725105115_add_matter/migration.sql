-- CreateTable
CREATE TABLE "Matter" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "entityId" TEXT,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "matterType" TEXT NOT NULL,
    "summary" TEXT,
    "decisionQuestion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "priority" TEXT NOT NULL DEFAULT 'Normal',
    "taxAreas" TEXT,
    "taxOwner" TEXT,
    "businessSponsor" TEXT,
    "externalAdviser" TEXT,
    "targetDecisionDate" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdByUserId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "archivedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Matter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Matter_organisationId_status_idx" ON "Matter"("organisationId", "status");

-- CreateIndex
CREATE INDEX "Matter_entityId_idx" ON "Matter"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Matter_organisationId_reference_key" ON "Matter"("organisationId", "reference");

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
