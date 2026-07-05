-- AlterTable
ALTER TABLE "ReviewItem" ADD COLUMN     "organisationId" TEXT;

-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "entityId" TEXT,
    "description" TEXT NOT NULL,
    "responsibleParty" TEXT,
    "accountableParty" TEXT,
    "externalOwner" TEXT,
    "deadline" TIMESTAMP(3),
    "relativeDeadlineTrigger" TEXT,
    "relativeDeadlineOffset" TEXT,
    "evidenceRequired" TEXT,
    "conditionText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "sourceType" TEXT,
    "sourceDocumentReference" TEXT,
    "sourcePageParagraph" TEXT,
    "createdBy" TEXT,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assumption" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "entityId" TEXT,
    "assumptionStatement" TEXT NOT NULL,
    "factCategory" TEXT,
    "relianceImportance" TEXT NOT NULL DEFAULT 'Medium',
    "suggestedReviewCadence" TEXT,
    "linkedCaveat" TEXT,
    "conditionText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "sourceType" TEXT,
    "sourceDocumentReference" TEXT,
    "sourcePageParagraph" TEXT,
    "createdBy" TEXT,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tripwire" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "entityId" TEXT,
    "description" TEXT NOT NULL,
    "triggerEvent" TEXT NOT NULL,
    "reviewDateOrDeadline" TIMESTAMP(3),
    "reviewCadence" TEXT,
    "disarmCondition" TEXT,
    "conditionText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Armed',
    "sourceType" TEXT,
    "sourceDocumentReference" TEXT,
    "sourcePageParagraph" TEXT,
    "createdBy" TEXT,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tripwire_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Action_organisationId_idx" ON "Action"("organisationId");

-- CreateIndex
CREATE INDEX "Action_entityId_idx" ON "Action"("entityId");

-- CreateIndex
CREATE INDEX "Assumption_organisationId_idx" ON "Assumption"("organisationId");

-- CreateIndex
CREATE INDEX "Assumption_entityId_idx" ON "Assumption"("entityId");

-- CreateIndex
CREATE INDEX "Tripwire_organisationId_idx" ON "Tripwire"("organisationId");

-- CreateIndex
CREATE INDEX "Tripwire_entityId_idx" ON "Tripwire"("entityId");

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assumption" ADD CONSTRAINT "Assumption_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assumption" ADD CONSTRAINT "Assumption_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tripwire" ADD CONSTRAINT "Tripwire_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tripwire" ADD CONSTRAINT "Tripwire_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_suggestedSourceSystemId_fkey" FOREIGN KEY ("suggestedSourceSystemId") REFERENCES "SourceSystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
