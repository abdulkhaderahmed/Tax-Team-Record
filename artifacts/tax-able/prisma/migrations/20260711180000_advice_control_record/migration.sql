-- DropForeignKey
ALTER TABLE "AuditEvent" DROP CONSTRAINT "AuditEvent_manualObligationId_fkey";

-- DropForeignKey
ALTER TABLE "AuditEvent" DROP CONSTRAINT "AuditEvent_obligationId_fkey";

-- DropForeignKey
ALTER TABLE "Obligation" DROP CONSTRAINT "Obligation_entityId_fkey";

-- DropForeignKey
ALTER TABLE "Obligation" DROP CONSTRAINT "Obligation_ruleId_fkey";

-- DropForeignKey
ALTER TABLE "RaciAssignment" DROP CONSTRAINT "RaciAssignment_manualObligationId_fkey";

-- DropIndex
DROP INDEX "AuditEvent_manualObligationId_idx";

-- DropIndex
DROP INDEX "RaciAssignment_manualObligationId_idx";

-- AlterTable
ALTER TABLE "Action" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletionReason" TEXT,
ADD COLUMN     "lastUpdatedById" TEXT,
ADD COLUMN     "originatingReviewItemId" TEXT,
ADD COLUMN     "sourceDocumentId" TEXT;

-- Backfill free-text actor attribution only where it deterministically resolves
-- to a user in the same organisation. Name matches are accepted only when
-- unique; unresolved labels are preserved after audit columns are expanded.
UPDATE "Action" AS target
SET "createdById" = actor."id"
FROM "User" AS actor
WHERE target."createdBy" IS NOT NULL
  AND actor."organisationId" = target."organisationId"
  AND (
    actor."id" = target."createdBy"
    OR actor."email" = target."createdBy"
    OR (
      actor."name" = target."createdBy"
      AND 1 = (
        SELECT COUNT(*) FROM "User" AS candidate
        WHERE candidate."organisationId" = target."organisationId"
          AND candidate."name" = target."createdBy"
      )
    )
  );

-- AlterTable
ALTER TABLE "Assumption" ADD COLUMN     "originatingReviewItemId" TEXT,
ADD COLUMN     "sourceDocumentId" TEXT;

-- AlterTable
ALTER TABLE "AuditEvent" ADD COLUMN     "actorEmailSnapshot" TEXT,
ADD COLUMN     "actorNameSnapshot" TEXT,
ADD COLUMN     "afterJson" JSONB,
ADD COLUMN     "beforeJson" JSONB,
ADD COLUMN     "correlationId" TEXT,
ADD COLUMN     "objectId" TEXT,
ADD COLUMN     "objectType" TEXT,
ADD COLUMN     "reason" TEXT;

-- The former manual-obligation relation is the canonical live record. Legacy
-- obligation references are retained because those rows are backfilled below.
UPDATE "AuditEvent"
SET "beforeJson" = COALESCE("beforeJson", '{}'::jsonb) || jsonb_build_object(
      'legacyObligationId', "obligationId",
      'manualObligationId', "manualObligationId"
    )
WHERE "obligationId" IS NOT NULL
  AND "manualObligationId" IS NOT NULL
  AND "obligationId" <> "manualObligationId";

UPDATE "AuditEvent"
SET "objectType" = CASE
      WHEN "manualObligationId" IS NOT NULL OR "obligationId" IS NOT NULL THEN 'Obligation'
      WHEN "actionId" IS NOT NULL THEN 'Action'
      WHEN "entityId" IS NOT NULL THEN 'Entity'
      ELSE "objectType"
    END,
    "objectId" = COALESCE(
      "manualObligationId", "obligationId", "actionId", "entityId", "objectId"
    )
WHERE "objectType" IS NULL OR "objectId" IS NULL;

UPDATE "AuditEvent"
SET "obligationId" = COALESCE("manualObligationId", "obligationId");

UPDATE "AuditEvent" AS event
SET "actorNameSnapshot" = actor."name",
    "actorEmailSnapshot" = actor."email"
FROM "User" AS actor
WHERE event."userId" = actor."id";

INSERT INTO "AuditEvent" (
  "id", "organisationId", "action", "detail", "objectType", "objectId",
  "actorNameSnapshot", "createdAt"
)
SELECT
  'legacy-' || md5('Action:' || target."id" || ':createdBy'),
  target."organisationId", 'LEGACY_ACTOR_PRESERVED',
  'Unresolved legacy creator label retained during user-ID migration.',
  'Action', target."id", target."createdBy", CURRENT_TIMESTAMP
FROM "Action" AS target
WHERE target."createdBy" IS NOT NULL AND target."createdById" IS NULL
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "Action" DROP COLUMN "createdBy";

ALTER TABLE "AuditEvent" DROP COLUMN "manualObligationId";

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletionReason" TEXT,
ADD COLUMN     "sourceVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "sourceVerifiedById" TEXT,
ADD COLUMN     "uploadedById" TEXT,
ADD COLUMN     "versionNotes" TEXT,
ADD COLUMN     "versionNumber" INTEGER NOT NULL DEFAULT 1;

-- Preserve the inverse supersession pointer as the canonical single-direction
-- relation before removing the duplicate writable column.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Document"
    WHERE "supersedesDocumentId" = "id" OR "supersededByDocumentId" = "id"
  ) THEN
    RAISE EXCEPTION 'Invalid document version graph: a document supersedes itself';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Document" AS source
    LEFT JOIN "Document" AS target ON target."id" = source."supersedesDocumentId"
    WHERE source."supersedesDocumentId" IS NOT NULL
      AND (target."id" IS NULL OR target."organisationId" <> source."organisationId")
  ) OR EXISTS (
    SELECT 1 FROM "Document" AS source
    LEFT JOIN "Document" AS target ON target."id" = source."supersededByDocumentId"
    WHERE source."supersededByDocumentId" IS NOT NULL
      AND (target."id" IS NULL OR target."organisationId" <> source."organisationId")
  ) THEN
    RAISE EXCEPTION 'Invalid document version graph: dangling or cross-organisation pointer';
  END IF;
  IF EXISTS (
    SELECT "supersededByDocumentId"
    FROM "Document"
    WHERE "supersededByDocumentId" IS NOT NULL
    GROUP BY "supersededByDocumentId"
    HAVING COUNT(*) > 1
  ) OR EXISTS (
    SELECT "supersedesDocumentId"
    FROM "Document"
    WHERE "supersedesDocumentId" IS NOT NULL
    GROUP BY "supersedesDocumentId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Invalid document version graph: a version chain branches';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM "Document" AS newer
    JOIN "Document" AS older ON older."supersededByDocumentId" = newer."id"
    WHERE newer."supersedesDocumentId" IS NOT NULL
      AND newer."supersedesDocumentId" <> older."id"
  ) THEN
    RAISE EXCEPTION 'Invalid document version graph: forward and inverse pointers disagree';
  END IF;
END $$;

UPDATE "Document" AS newer
SET "supersedesDocumentId" = older."id"
FROM "Document" AS older
WHERE older."supersededByDocumentId" = newer."id"
  AND newer."supersedesDocumentId" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    WITH RECURSIVE chain AS (
      SELECT "id" AS start_id, "supersedesDocumentId" AS predecessor_id,
             ARRAY["id"] AS path, FALSE AS cycle
      FROM "Document"
      UNION ALL
      SELECT chain.start_id, predecessor."supersedesDocumentId",
             chain.path || predecessor."id",
             predecessor."id" = ANY(chain.path)
      FROM chain
      JOIN "Document" AS predecessor ON predecessor."id" = chain.predecessor_id
      WHERE NOT chain.cycle
    )
    SELECT 1 FROM chain WHERE cycle
  ) THEN
    RAISE EXCEPTION 'Invalid document version graph: cycle detected';
  END IF;
END $$;

WITH RECURSIVE version_chain AS (
  SELECT root."id", 1 AS version_number
  FROM "Document" AS root
  WHERE root."supersedesDocumentId" IS NULL
  UNION ALL
  SELECT newer."id", version_chain.version_number + 1
  FROM version_chain
  JOIN "Document" AS newer ON newer."supersedesDocumentId" = version_chain."id"
)
UPDATE "Document" AS document
SET "versionNumber" = version_chain.version_number
FROM version_chain
WHERE document."id" = version_chain."id";

UPDATE "Document" AS predecessor
SET "relianceStatus" = 'Superseded'
WHERE EXISTS (
  SELECT 1 FROM "Document" AS newer
  WHERE newer."supersedesDocumentId" = predecessor."id"
);

UPDATE "Document" AS target
SET "uploadedById" = actor."id"
FROM "User" AS actor
WHERE target."uploadedBy" IS NOT NULL
  AND actor."organisationId" = target."organisationId"
  AND (
    actor."id" = target."uploadedBy"
    OR actor."email" = target."uploadedBy"
    OR (
      actor."name" = target."uploadedBy"
      AND 1 = (
        SELECT COUNT(*) FROM "User" AS candidate
        WHERE candidate."organisationId" = target."organisationId"
          AND candidate."name" = target."uploadedBy"
      )
    )
  );

INSERT INTO "AuditEvent" (
  "id", "organisationId", "action", "detail", "objectType", "objectId",
  "actorNameSnapshot", "createdAt"
)
SELECT
  'legacy-' || md5('Document:' || target."id" || ':uploadedBy'),
  target."organisationId", 'LEGACY_ACTOR_PRESERVED',
  'Unresolved legacy uploader label retained during user-ID migration.',
  'Document', target."id", target."uploadedBy", CURRENT_TIMESTAMP
FROM "Document" AS target
WHERE target."uploadedBy" IS NOT NULL AND target."uploadedById" IS NULL
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "Document"
DROP COLUMN "supersededByDocumentId",
DROP COLUMN "uploadedBy";

-- AlterTable
ALTER TABLE "Entity" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "benefitsReportingMethod" TEXT NOT NULL DEFAULT 'P11D',
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletionReason" TEXT,
ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "hasLoansOrAccommodationBenefits" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentEntityId" TEXT,
ADD COLUMN     "pillar2FirstReportingPeriod" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "psaAgreementStatus" TEXT NOT NULL DEFAULT 'Not in place',
ADD COLUMN     "psaPaymentMethod" TEXT NOT NULL DEFAULT 'Electronic',
ADD COLUMN     "qipAssociatedCompanyCount" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ExtractionRun" ADD COLUMN     "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "heartbeatAt" TIMESTAMP(3),
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "ExtractionRun" AS target
SET "createdById" = actor."id"
FROM "User" AS actor
WHERE target."createdBy" IS NOT NULL
  AND actor."organisationId" = target."organisationId"
  AND (
    actor."id" = target."createdBy"
    OR actor."email" = target."createdBy"
    OR (
      actor."name" = target."createdBy"
      AND 1 = (
        SELECT COUNT(*) FROM "User" AS candidate
        WHERE candidate."organisationId" = target."organisationId"
          AND candidate."name" = target."createdBy"
      )
    )
  );

INSERT INTO "AuditEvent" (
  "id", "organisationId", "action", "detail", "objectType", "objectId",
  "actorNameSnapshot", "createdAt"
)
SELECT
  'legacy-' || md5('ExtractionRun:' || target."id" || ':createdBy'),
  target."organisationId", 'LEGACY_ACTOR_PRESERVED',
  'Unresolved legacy extraction creator retained during user-ID migration.',
  'ExtractionRun', target."id", target."createdBy", CURRENT_TIMESTAMP
FROM "ExtractionRun" AS target
WHERE target."createdBy" IS NOT NULL AND target."createdById" IS NULL
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "ExtractionRun" DROP COLUMN "createdBy";

-- AlterTable
ALTER TABLE "ManualObligation" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletionReason" TEXT,
ADD COLUMN     "lastUpdatedById" TEXT,
ADD COLUMN     "originatingReviewItemId" TEXT,
ADD COLUMN     "ruleKey" TEXT,
ADD COLUMN     "ruleVersionId" TEXT,
ADD COLUMN     "ruleVersionNumber" INTEGER,
ADD COLUMN     "sourceDocumentId" TEXT,
ADD COLUMN     "whyApplies" TEXT;

UPDATE "ManualObligation" AS target
SET "createdById" = actor."id"
FROM "User" AS actor
WHERE target."createdBy" IS NOT NULL
  AND actor."organisationId" = target."organisationId"
  AND (
    actor."id" = target."createdBy"
    OR actor."email" = target."createdBy"
    OR (
      actor."name" = target."createdBy"
      AND 1 = (
        SELECT COUNT(*) FROM "User" AS candidate
        WHERE candidate."organisationId" = target."organisationId"
          AND candidate."name" = target."createdBy"
      )
    )
  );

UPDATE "ManualObligation" AS target
SET "lastUpdatedById" = actor."id"
FROM "User" AS actor
WHERE target."lastUpdatedBy" IS NOT NULL
  AND actor."organisationId" = target."organisationId"
  AND (
    actor."id" = target."lastUpdatedBy"
    OR actor."email" = target."lastUpdatedBy"
    OR (
      actor."name" = target."lastUpdatedBy"
      AND 1 = (
        SELECT COUNT(*) FROM "User" AS candidate
        WHERE candidate."organisationId" = target."organisationId"
          AND candidate."name" = target."lastUpdatedBy"
      )
    )
  );

INSERT INTO "AuditEvent" (
  "id", "organisationId", "action", "detail", "objectType", "objectId",
  "actorNameSnapshot", "createdAt"
)
SELECT
  'legacy-' || md5('Obligation:' || target."id" || ':createdBy'),
  target."organisationId", 'LEGACY_ACTOR_PRESERVED',
  'Unresolved legacy creator label retained during user-ID migration.',
  'Obligation', target."id", target."createdBy", CURRENT_TIMESTAMP
FROM "ManualObligation" AS target
WHERE target."createdBy" IS NOT NULL AND target."createdById" IS NULL
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "AuditEvent" (
  "id", "organisationId", "action", "detail", "objectType", "objectId",
  "actorNameSnapshot", "createdAt"
)
SELECT
  'legacy-' || md5('Obligation:' || target."id" || ':lastUpdatedBy'),
  target."organisationId", 'LEGACY_ACTOR_PRESERVED',
  'Unresolved legacy updater label retained during user-ID migration.',
  'Obligation', target."id", target."lastUpdatedBy", CURRENT_TIMESTAMP
FROM "ManualObligation" AS target
WHERE target."lastUpdatedBy" IS NOT NULL AND target."lastUpdatedById" IS NULL
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "ManualObligation"
DROP COLUMN "createdBy",
DROP COLUMN "lastUpdatedBy";

-- Convert the former raw document-to-obligation pointer into a real foreign-key
-- direction on the canonical obligation where one was recorded. Preserve every
-- edge in a staging table for the following lineage migration; the direct
-- sourceDocumentId is only the primary/convenience pointer.
CREATE TABLE "_LegacyDocumentObligationLink" (
    "documentId" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    PRIMARY KEY ("documentId", "obligationId")
);

INSERT INTO "_LegacyDocumentObligationLink" (
  "documentId", "obligationId", "organisationId", "createdAt"
)
SELECT document."id", document."obligationId", document."organisationId", document."createdAt"
FROM "Document" AS document
JOIN "ManualObligation" AS obligation ON obligation."id" = document."obligationId"
WHERE document."obligationId" IS NOT NULL
  AND obligation."organisationId" = document."organisationId";

UPDATE "ManualObligation" AS obligation
SET "sourceDocumentId" = document."id"
FROM "Document" AS document
WHERE document."obligationId" = obligation."id"
  AND obligation."sourceDocumentId" IS NULL;

ALTER TABLE "Document" DROP COLUMN "obligationId";

-- AlterTable
ALTER TABLE "RaciAssignment" RENAME COLUMN "manualObligationId" TO "obligationId";

-- AlterTable
ALTER TABLE "ReviewItem" ADD COLUMN     "reviewedById" TEXT;

UPDATE "ReviewItem" AS target
SET "organisationId" = document."organisationId"
FROM "Document" AS document
WHERE document."id" = target."documentId"
  AND target."organisationId" IS DISTINCT FROM document."organisationId";

UPDATE "ReviewItem" AS target
SET "reviewedById" = actor."id"
FROM "User" AS actor, "Document" AS document
WHERE target."reviewedBy" IS NOT NULL
  AND document."id" = target."documentId"
  AND actor."organisationId" = document."organisationId"
  AND (
    actor."id" = target."reviewedBy"
    OR actor."email" = target."reviewedBy"
    OR (
      actor."name" = target."reviewedBy"
      AND 1 = (
        SELECT COUNT(*) FROM "User" AS candidate
        WHERE candidate."organisationId" = document."organisationId"
          AND candidate."name" = target."reviewedBy"
      )
    )
  );

INSERT INTO "AuditEvent" (
  "id", "organisationId", "action", "detail", "objectType", "objectId",
  "actorNameSnapshot", "createdAt"
)
SELECT
  'legacy-' || md5('ReviewItem:' || target."id" || ':reviewedBy'),
  document."organisationId", 'LEGACY_ACTOR_PRESERVED',
  'Unresolved legacy reviewer label retained during user-ID migration.',
  'ReviewItem', target."id", target."reviewedBy", CURRENT_TIMESTAMP
FROM "ReviewItem" AS target
JOIN "Document" AS document ON document."id" = target."documentId"
WHERE target."reviewedBy" IS NOT NULL AND target."reviewedById" IS NULL
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "ReviewItem" DROP COLUMN "reviewedBy";

-- AlterTable
ALTER TABLE "Tripwire" ADD COLUMN     "originatingReviewItemId" TEXT,
ADD COLUMN     "sourceDocumentId" TEXT;

-- Reconcile the retired legacy obligation path into the canonical live table
-- before dropping it. The old table has no richer control fields, so those are
-- explicitly marked as legacy-source drafts for review.
CREATE TABLE "LegacyRuleSnapshot" (
    "id" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "appliesTo" TEXT NOT NULL,
    "sourceCreatedAt" TIMESTAMP(3) NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "retiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LegacyRuleSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LegacyRuleSnapshot_ruleKey_key" ON "LegacyRuleSnapshot"("ruleKey");

INSERT INTO "LegacyRuleSnapshot" (
  "id", "ruleKey", "name", "description", "appliesTo",
  "sourceCreatedAt", "sourceUpdatedAt"
)
SELECT "id", "ruleKey", "name", "description", "appliesTo", "createdAt", "updatedAt"
FROM "ObligationRule";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Obligation" AS legacy
    JOIN "ManualObligation" AS canonical ON canonical."id" = legacy."id"
  ) THEN
    RAISE EXCEPTION 'Cannot retire legacy obligations: canonical ID collision detected';
  END IF;
END $$;

INSERT INTO "ManualObligation" (
  "id", "organisationId", "entityId", "regime", "obligationType",
  "description", "filingDeadline", "source", "sourceType", "ruleId",
  "ruleKey", "draftReviewStatus", "overallWorkflowStatus", "notes",
  "createdAt", "updatedAt"
)
SELECT
  legacy."id", entity."organisationId", legacy."entityId", 'Legacy rules pack',
  'Filing', legacy."title", legacy."dueDate", 'Retired legacy obligation path',
  'Legacy migration', legacy."ruleId", rule."ruleKey",
  CASE WHEN legacy."status" = 'DRAFT' THEN 'pending' ELSE 'activated' END,
  CASE WHEN legacy."status" = 'DRAFT' THEN 'Draft' ELSE legacy."status" END,
  CONCAT_WS(E'\n', legacy."notes", 'Migrated from the retired Obligation / ObligationRule path.'),
  legacy."createdAt", legacy."updatedAt"
FROM "Obligation" AS legacy
JOIN "Entity" AS entity ON entity."id" = legacy."entityId"
LEFT JOIN "ObligationRule" AS rule ON rule."id" = legacy."ruleId"
;

-- DropTable
DROP TABLE "Obligation";

-- DropTable
DROP TABLE "ObligationRule";

-- CreateTable
CREATE TABLE "EntityGroup" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "associatedCompanyCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntityGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingPeriod" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "periodOfAccountStart" TIMESTAMP(3) NOT NULL,
    "periodOfAccountEnd" TIMESTAMP(3) NOT NULL,
    "ctPeriodStart" TIMESTAMP(3) NOT NULL,
    "ctPeriodEnd" TIMESTAMP(3) NOT NULL,
    "periodType" TEXT NOT NULL DEFAULT 'Corporation Tax',
    "status" TEXT NOT NULL DEFAULT 'Confirmed',
    "sourceDocumentId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegimeAssessment" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "entityId" TEXT,
    "groupId" TEXT,
    "regime" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "outcome" TEXT NOT NULL,
    "inputsJson" JSONB NOT NULL,
    "rationale" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegimeAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityRelation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "fromEntityId" TEXT NOT NULL,
    "toEntityId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "ownershipPct" DECIMAL(7,4),
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "sourceDocumentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntityRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRegistration" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "registrationType" TEXT NOT NULL,
    "reference" TEXT,
    "jurisdiction" TEXT NOT NULL DEFAULT 'United Kingdom',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "sourceSystemId" TEXT,
    "sourceVerifiedAt" TIMESTAMP(3),
    "sourceVerifiedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRule" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "regime" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRuleVersion" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "obligationType" TEXT NOT NULL,
    "statutoryBasis" TEXT NOT NULL,
    "statutoryUrl" TEXT NOT NULL,
    "authorityLevel" TEXT NOT NULL,
    "legalStatus" TEXT NOT NULL,
    "triggerDescription" TEXT NOT NULL,
    "triggerConfig" JSONB NOT NULL,
    "calculationKey" TEXT NOT NULL,
    "calculationDescription" TEXT NOT NULL,
    "recurrence" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "humanReviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "changeRationale" TEXT NOT NULL,
    "sourceLastCheckedAt" TIMESTAMP(3) NOT NULL,
    "logicHash" TEXT,
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "supersedesVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRuleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleCitation" (
    "id" TEXT NOT NULL,
    "ruleVersionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "authorityLevel" TEXT NOT NULL,
    "locator" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleCitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleImpactReview" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "ruleVersionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Needs review',
    "impactSummary" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleImpactReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Caveat" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "entityId" TEXT,
    "caveatText" TEXT NOT NULL,
    "relatedTopic" TEXT,
    "impactIfUnresolved" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "resolutionNote" TEXT,
    "sourceDocumentId" TEXT,
    "sourcePageParagraph" TEXT,
    "originatingReviewItemId" TEXT,
    "createdById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Caveat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exception" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "entityId" TEXT,
    "obligationId" TEXT,
    "actionId" TEXT,
    "assumptionId" TEXT,
    "caveatId" TEXT,
    "tripwireId" TEXT,
    "documentId" TEXT,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'Medium',
    "status" TEXT NOT NULL DEFAULT 'Open',
    "blocksFiling" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" TEXT,
    "targetResolutionDate" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exception_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceItem" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "entityId" TEXT,
    "obligationId" TEXT,
    "actionId" TEXT,
    "assumptionId" TEXT,
    "caveatId" TEXT,
    "tripwireId" TEXT,
    "exceptionId" TEXT,
    "documentId" TEXT,
    "title" TEXT NOT NULL,
    "evidenceType" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Required',
    "requiredBy" TIMESTAMP(3),
    "ownerId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "verificationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataRequest" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "entityId" TEXT,
    "obligationId" TEXT,
    "actionId" TEXT,
    "requestedFromPartyId" TEXT,
    "requestedFromDepartment" TEXT,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "dueDate" TIMESTAMP(3),
    "escalationDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "responseNote" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "dataRequestId" TEXT,
    "obligationId" TEXT,
    "actionId" TEXT,
    "ownerId" TEXT,
    "reminderType" TEXT NOT NULL DEFAULT 'Reminder',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Scheduled',
    "message" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "entityId" TEXT,
    "obligationId" TEXT,
    "actionId" TEXT,
    "gate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "requestedById" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "decidedById" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAccess" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'view',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedById" TEXT,
    "expiresAt" TIMESTAMP(3),
    "reason" TEXT,

    CONSTRAINT "DocumentAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntityGroup_organisationId_idx" ON "EntityGroup"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "EntityGroup_organisationId_name_key" ON "EntityGroup"("organisationId", "name");

-- CreateIndex
CREATE INDEX "AccountingPeriod_organisationId_idx" ON "AccountingPeriod"("organisationId");

-- CreateIndex
CREATE INDEX "AccountingPeriod_entityId_status_idx" ON "AccountingPeriod"("entityId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriod_entityId_ctPeriodStart_ctPeriodEnd_key" ON "AccountingPeriod"("entityId", "ctPeriodStart", "ctPeriodEnd");

-- CreateIndex
CREATE INDEX "RegimeAssessment_entityId_regime_idx" ON "RegimeAssessment"("entityId", "regime");

-- CreateIndex
CREATE INDEX "RegimeAssessment_groupId_regime_idx" ON "RegimeAssessment"("groupId", "regime");

-- CreateIndex
CREATE UNIQUE INDEX "RegimeAssessment_organisationId_regime_entityId_groupId_per_key" ON "RegimeAssessment"("organisationId", "regime", "entityId", "groupId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "EntityRelation_organisationId_idx" ON "EntityRelation"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "EntityRelation_organisationId_fromEntityId_toEntityId_relat_key" ON "EntityRelation"("organisationId", "fromEntityId", "toEntityId", "relationType", "effectiveFrom");

-- CreateIndex
CREATE INDEX "TaxRegistration_organisationId_idx" ON "TaxRegistration"("organisationId");

-- CreateIndex
CREATE INDEX "TaxRegistration_entityId_idx" ON "TaxRegistration"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRegistration_entityId_registrationType_jurisdiction_key" ON "TaxRegistration"("entityId", "registrationType", "jurisdiction");

-- CreateIndex
CREATE INDEX "TaxRule_organisationId_idx" ON "TaxRule"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRule_organisationId_ruleKey_key" ON "TaxRule"("organisationId", "ruleKey");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRuleVersion_supersedesVersionId_key" ON "TaxRuleVersion"("supersedesVersionId");

-- CreateIndex
CREATE INDEX "TaxRuleVersion_ruleId_status_effectiveFrom_idx" ON "TaxRuleVersion"("ruleId", "status", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRuleVersion_ruleId_version_key" ON "TaxRuleVersion"("ruleId", "version");

-- CreateIndex
CREATE INDEX "RuleCitation_ruleVersionId_idx" ON "RuleCitation"("ruleVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "RuleCitation_ruleVersionId_url_key" ON "RuleCitation"("ruleVersionId", "url");

-- CreateIndex
CREATE INDEX "RuleImpactReview_organisationId_status_idx" ON "RuleImpactReview"("organisationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RuleImpactReview_ruleVersionId_entityId_key" ON "RuleImpactReview"("ruleVersionId", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Caveat_originatingReviewItemId_key" ON "Caveat"("originatingReviewItemId");

-- CreateIndex
CREATE INDEX "Caveat_organisationId_idx" ON "Caveat"("organisationId");

-- CreateIndex
CREATE INDEX "Caveat_entityId_idx" ON "Caveat"("entityId");

-- CreateIndex
CREATE INDEX "Caveat_status_idx" ON "Caveat"("status");

-- CreateIndex
CREATE INDEX "Exception_organisationId_status_idx" ON "Exception"("organisationId", "status");

-- CreateIndex
CREATE INDEX "Exception_obligationId_idx" ON "Exception"("obligationId");

-- CreateIndex
CREATE INDEX "Exception_actionId_idx" ON "Exception"("actionId");

-- CreateIndex
CREATE INDEX "EvidenceItem_organisationId_status_idx" ON "EvidenceItem"("organisationId", "status");

-- CreateIndex
CREATE INDEX "EvidenceItem_obligationId_idx" ON "EvidenceItem"("obligationId");

-- CreateIndex
CREATE INDEX "EvidenceItem_actionId_idx" ON "EvidenceItem"("actionId");

-- CreateIndex
CREATE INDEX "DataRequest_organisationId_status_dueDate_idx" ON "DataRequest"("organisationId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "Reminder_organisationId_status_scheduledFor_idx" ON "Reminder"("organisationId", "status", "scheduledFor");

-- CreateIndex
CREATE INDEX "Approval_organisationId_status_idx" ON "Approval"("organisationId", "status");

-- CreateIndex
CREATE INDEX "Approval_obligationId_idx" ON "Approval"("obligationId");

-- CreateIndex
CREATE INDEX "Approval_actionId_idx" ON "Approval"("actionId");

-- CreateIndex
CREATE INDEX "DocumentAccess_organisationId_idx" ON "DocumentAccess"("organisationId");

-- CreateIndex
CREATE INDEX "DocumentAccess_userId_idx" ON "DocumentAccess"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentAccess_documentId_userId_key" ON "DocumentAccess"("documentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Action_originatingReviewItemId_key" ON "Action"("originatingReviewItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Assumption_originatingReviewItemId_key" ON "Assumption"("originatingReviewItemId");

-- CreateIndex
CREATE INDEX "AuditEvent_objectType_objectId_idx" ON "AuditEvent"("objectType", "objectId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_supersedesDocumentId_key" ON "Document"("supersedesDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "ManualObligation_originatingReviewItemId_key" ON "ManualObligation"("originatingReviewItemId");

-- CreateIndex
CREATE INDEX "RaciAssignment_obligationId_idx" ON "RaciAssignment"("obligationId");

-- CreateIndex
CREATE UNIQUE INDEX "Tripwire_originatingReviewItemId_key" ON "Tripwire"("originatingReviewItemId");

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "EntityGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_parentEntityId_fkey" FOREIGN KEY ("parentEntityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityGroup" ADD CONSTRAINT "EntityGroup_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegimeAssessment" ADD CONSTRAINT "RegimeAssessment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegimeAssessment" ADD CONSTRAINT "RegimeAssessment_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegimeAssessment" ADD CONSTRAINT "RegimeAssessment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "EntityGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegimeAssessment" ADD CONSTRAINT "RegimeAssessment_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityRelation" ADD CONSTRAINT "EntityRelation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityRelation" ADD CONSTRAINT "EntityRelation_fromEntityId_fkey" FOREIGN KEY ("fromEntityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityRelation" ADD CONSTRAINT "EntityRelation_toEntityId_fkey" FOREIGN KEY ("toEntityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityRelation" ADD CONSTRAINT "EntityRelation_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRegistration" ADD CONSTRAINT "TaxRegistration_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRegistration" ADD CONSTRAINT "TaxRegistration_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRegistration" ADD CONSTRAINT "TaxRegistration_sourceSystemId_fkey" FOREIGN KEY ("sourceSystemId") REFERENCES "SourceSystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRegistration" ADD CONSTRAINT "TaxRegistration_sourceVerifiedById_fkey" FOREIGN KEY ("sourceVerifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRule" ADD CONSTRAINT "TaxRule_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRuleVersion" ADD CONSTRAINT "TaxRuleVersion_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "TaxRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRuleVersion" ADD CONSTRAINT "TaxRuleVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRuleVersion" ADD CONSTRAINT "TaxRuleVersion_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRuleVersion" ADD CONSTRAINT "TaxRuleVersion_supersedesVersionId_fkey" FOREIGN KEY ("supersedesVersionId") REFERENCES "TaxRuleVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleCitation" ADD CONSTRAINT "RuleCitation_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "TaxRuleVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleImpactReview" ADD CONSTRAINT "RuleImpactReview_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleImpactReview" ADD CONSTRAINT "RuleImpactReview_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "TaxRuleVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleImpactReview" ADD CONSTRAINT "RuleImpactReview_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleImpactReview" ADD CONSTRAINT "RuleImpactReview_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualObligation" ADD CONSTRAINT "ManualObligation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualObligation" ADD CONSTRAINT "ManualObligation_lastUpdatedById_fkey" FOREIGN KEY ("lastUpdatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualObligation" ADD CONSTRAINT "ManualObligation_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "TaxRuleVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualObligation" ADD CONSTRAINT "ManualObligation_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualObligation" ADD CONSTRAINT "ManualObligation_originatingReviewItemId_fkey" FOREIGN KEY ("originatingReviewItemId") REFERENCES "ReviewItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualObligation" ADD CONSTRAINT "ManualObligation_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_lastUpdatedById_fkey" FOREIGN KEY ("lastUpdatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_originatingReviewItemId_fkey" FOREIGN KEY ("originatingReviewItemId") REFERENCES "ReviewItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaciAssignment" ADD CONSTRAINT "RaciAssignment_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "ManualObligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assumption" ADD CONSTRAINT "Assumption_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assumption" ADD CONSTRAINT "Assumption_originatingReviewItemId_fkey" FOREIGN KEY ("originatingReviewItemId") REFERENCES "ReviewItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caveat" ADD CONSTRAINT "Caveat_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caveat" ADD CONSTRAINT "Caveat_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caveat" ADD CONSTRAINT "Caveat_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caveat" ADD CONSTRAINT "Caveat_originatingReviewItemId_fkey" FOREIGN KEY ("originatingReviewItemId") REFERENCES "ReviewItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tripwire" ADD CONSTRAINT "Tripwire_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tripwire" ADD CONSTRAINT "Tripwire_originatingReviewItemId_fkey" FOREIGN KEY ("originatingReviewItemId") REFERENCES "ReviewItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "ManualObligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_assumptionId_fkey" FOREIGN KEY ("assumptionId") REFERENCES "Assumption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_caveatId_fkey" FOREIGN KEY ("caveatId") REFERENCES "Caveat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_tripwireId_fkey" FOREIGN KEY ("tripwireId") REFERENCES "Tripwire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "ManualObligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_assumptionId_fkey" FOREIGN KEY ("assumptionId") REFERENCES "Assumption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_caveatId_fkey" FOREIGN KEY ("caveatId") REFERENCES "Caveat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_tripwireId_fkey" FOREIGN KEY ("tripwireId") REFERENCES "Tripwire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_exceptionId_fkey" FOREIGN KEY ("exceptionId") REFERENCES "Exception"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRequest" ADD CONSTRAINT "DataRequest_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRequest" ADD CONSTRAINT "DataRequest_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRequest" ADD CONSTRAINT "DataRequest_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "ManualObligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRequest" ADD CONSTRAINT "DataRequest_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRequest" ADD CONSTRAINT "DataRequest_requestedFromPartyId_fkey" FOREIGN KEY ("requestedFromPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRequest" ADD CONSTRAINT "DataRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRequest" ADD CONSTRAINT "DataRequest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_dataRequestId_fkey" FOREIGN KEY ("dataRequestId") REFERENCES "DataRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "ManualObligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "ManualObligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_supersedesDocumentId_fkey" FOREIGN KEY ("supersedesDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_sourceVerifiedById_fkey" FOREIGN KEY ("sourceVerifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccess" ADD CONSTRAINT "DocumentAccess_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccess" ADD CONSTRAINT "DocumentAccess_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccess" ADD CONSTRAINT "DocumentAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccess" ADD CONSTRAINT "DocumentAccess_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionRun" ADD CONSTRAINT "ExtractionRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "ManualObligation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
