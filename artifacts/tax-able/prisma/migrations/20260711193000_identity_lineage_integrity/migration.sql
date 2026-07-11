-- DropForeignKey
ALTER TABLE "Approval" DROP CONSTRAINT "Approval_actionId_fkey";

-- DropForeignKey
ALTER TABLE "Approval" DROP CONSTRAINT "Approval_obligationId_fkey";

-- DropForeignKey
ALTER TABLE "DataRequest" DROP CONSTRAINT "DataRequest_actionId_fkey";

-- DropForeignKey
ALTER TABLE "DataRequest" DROP CONSTRAINT "DataRequest_obligationId_fkey";

-- DropForeignKey
ALTER TABLE "EvidenceItem" DROP CONSTRAINT "EvidenceItem_actionId_fkey";

-- DropForeignKey
ALTER TABLE "EvidenceItem" DROP CONSTRAINT "EvidenceItem_obligationId_fkey";

-- DropForeignKey
ALTER TABLE "Exception" DROP CONSTRAINT "Exception_actionId_fkey";

-- DropForeignKey
ALTER TABLE "Exception" DROP CONSTRAINT "Exception_obligationId_fkey";

-- DropForeignKey
ALTER TABLE "RaciAssignment" DROP CONSTRAINT "RaciAssignment_actionId_fkey";

-- DropForeignKey
ALTER TABLE "RaciAssignment" DROP CONSTRAINT "RaciAssignment_obligationId_fkey";

-- DropForeignKey
ALTER TABLE "Reminder" DROP CONSTRAINT "Reminder_actionId_fkey";

-- DropForeignKey
ALTER TABLE "Reminder" DROP CONSTRAINT "Reminder_dataRequestId_fkey";

-- DropForeignKey
ALTER TABLE "Reminder" DROP CONSTRAINT "Reminder_obligationId_fkey";

-- DropForeignKey
ALTER TABLE "ReviewItem" DROP CONSTRAINT "ReviewItem_organisationId_fkey";

-- Controlled content is immutable history: deleting a parent must not cascade
-- through approved versions, citations or impact reviews.
ALTER TABLE "TaxRuleVersion" DROP CONSTRAINT "TaxRuleVersion_ruleId_fkey";
ALTER TABLE "RuleCitation" DROP CONSTRAINT "RuleCitation_ruleVersionId_fkey";
ALTER TABLE "RuleImpactReview" DROP CONSTRAINT "RuleImpactReview_ruleVersionId_fkey";

-- Expand actor/reviewer columns before contracting the legacy free-text
-- fields. ID and email matches are deterministic; a display-name match is
-- accepted only where it is unique inside the same organisation.
ALTER TABLE "Assumption" ADD COLUMN "createdById" TEXT;
UPDATE "Assumption" AS target
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
  'legacy-' || md5('Assumption:' || target."id" || ':createdBy'),
  target."organisationId", 'LEGACY_ACTOR_PRESERVED',
  'Unresolved legacy creator label retained during user-ID migration.',
  'Assumption', target."id", target."createdBy", CURRENT_TIMESTAMP
FROM "Assumption" AS target
WHERE target."createdBy" IS NOT NULL AND target."createdById" IS NULL
ON CONFLICT ("id") DO NOTHING;
ALTER TABLE "Assumption" DROP COLUMN "createdBy";

-- Derive review-item tenancy from its required document relation before making
-- it non-null. Abort rather than silently hiding an orphan from scoped queues.
UPDATE "ReviewItem" AS item
SET "organisationId" = document."organisationId"
FROM "Document" AS document
WHERE document."id" = item."documentId"
  AND item."organisationId" IS DISTINCT FROM document."organisationId";
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ReviewItem" WHERE "organisationId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot enforce ReviewItem organisation: orphaned rows exist';
  END IF;
END $$;
ALTER TABLE "ReviewItem" ALTER COLUMN "organisationId" SET NOT NULL;

-- Extraction runs carry the same organisation as their required document.
UPDATE "ExtractionRun" AS run
SET "organisationId" = document."organisationId"
FROM "Document" AS document
WHERE document."id" = run."documentId"
  AND run."organisationId" IS DISTINCT FROM document."organisationId";

ALTER TABLE "SourceConflict" ADD COLUMN "reviewOwnerId" TEXT;
UPDATE "SourceConflict" AS target
SET "reviewOwnerId" = actor."id"
FROM "User" AS actor
WHERE target."reviewOwner" IS NOT NULL
  AND actor."organisationId" = target."organisationId"
  AND (
    actor."id" = target."reviewOwner"
    OR actor."email" = target."reviewOwner"
    OR (
      actor."name" = target."reviewOwner"
      AND 1 = (
        SELECT COUNT(*) FROM "User" AS candidate
        WHERE candidate."organisationId" = target."organisationId"
          AND candidate."name" = target."reviewOwner"
      )
    )
  );
INSERT INTO "AuditEvent" (
  "id", "organisationId", "action", "detail", "objectType", "objectId",
  "actorNameSnapshot", "createdAt"
)
SELECT
  'legacy-' || md5('SourceConflict:' || target."id" || ':reviewOwner'),
  target."organisationId", 'LEGACY_REVIEW_OWNER_PRESERVED',
  'Unresolved legacy review-owner label retained during user-ID migration.',
  'SourceConflict', target."id", target."reviewOwner", CURRENT_TIMESTAMP
FROM "SourceConflict" AS target
WHERE target."reviewOwner" IS NOT NULL AND target."reviewOwnerId" IS NULL
ON CONFLICT ("id") DO NOTHING;
ALTER TABLE "SourceConflict" DROP COLUMN "reviewOwner";

ALTER TABLE "SourcePriorityRule" ADD COLUMN "reviewOwnerId" TEXT;
UPDATE "SourcePriorityRule" AS target
SET "reviewOwnerId" = actor."id"
FROM "User" AS actor
WHERE target."reviewOwner" IS NOT NULL
  AND actor."organisationId" = target."organisationId"
  AND (
    actor."id" = target."reviewOwner"
    OR actor."email" = target."reviewOwner"
    OR (
      actor."name" = target."reviewOwner"
      AND 1 = (
        SELECT COUNT(*) FROM "User" AS candidate
        WHERE candidate."organisationId" = target."organisationId"
          AND candidate."name" = target."reviewOwner"
      )
    )
  );
INSERT INTO "AuditEvent" (
  "id", "organisationId", "action", "detail", "objectType", "objectId",
  "actorNameSnapshot", "createdAt"
)
SELECT
  'legacy-' || md5('SourcePriorityRule:' || target."id" || ':reviewOwner'),
  target."organisationId", 'LEGACY_REVIEW_OWNER_PRESERVED',
  'Unresolved legacy review-owner label retained during user-ID migration.',
  'SourcePriorityRule', target."id", target."reviewOwner", CURRENT_TIMESTAMP
FROM "SourcePriorityRule" AS target
WHERE target."reviewOwner" IS NOT NULL AND target."reviewOwnerId" IS NULL
ON CONFLICT ("id") DO NOTHING;
ALTER TABLE "SourcePriorityRule" DROP COLUMN "reviewOwner";

ALTER TABLE "StatusHistory" ADD COLUMN "changedById" TEXT;
UPDATE "StatusHistory" AS target
SET "changedById" = actor."id"
FROM "User" AS actor
WHERE target."changedBy" IS NOT NULL
  AND (
    actor."id" = target."changedBy"
    OR actor."email" = target."changedBy"
    OR (
      actor."name" = target."changedBy"
      AND 1 = (SELECT COUNT(*) FROM "User" AS candidate WHERE candidate."name" = target."changedBy")
    )
  );
INSERT INTO "AuditEvent" (
  "id", "organisationId", "action", "detail", "objectType", "objectId",
  "actorNameSnapshot", "createdAt"
)
SELECT
  'legacy-' || md5('StatusHistory:' || target."id" || ':changedBy'),
  scope."organisationId", 'LEGACY_ACTOR_PRESERVED',
  'Unresolved legacy status-change actor retained during user-ID migration.',
  target."objectType", target."objectId", target."changedBy", CURRENT_TIMESTAMP
FROM "StatusHistory" AS target
JOIN LATERAL (
  SELECT obligation."organisationId"
  FROM "ManualObligation" AS obligation
  WHERE target."objectType" = 'Obligation' AND obligation."id" = target."objectId"
  UNION ALL
  SELECT action."organisationId"
  FROM "Action" AS action
  WHERE target."objectType" = 'Action' AND action."id" = target."objectId"
  LIMIT 1
) AS scope ON TRUE
WHERE target."changedBy" IS NOT NULL AND target."changedById" IS NULL
ON CONFLICT ("id") DO NOTHING;
ALTER TABLE "StatusHistory" DROP COLUMN "changedBy";

ALTER TABLE "Tripwire" ADD COLUMN "createdById" TEXT;
UPDATE "Tripwire" AS target
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
  'legacy-' || md5('Tripwire:' || target."id" || ':createdBy'),
  target."organisationId", 'LEGACY_ACTOR_PRESERVED',
  'Unresolved legacy creator label retained during user-ID migration.',
  'Tripwire', target."id", target."createdBy", CURRENT_TIMESTAMP
FROM "Tripwire" AS target
WHERE target."createdBy" IS NOT NULL AND target."createdById" IS NULL
ON CONFLICT ("id") DO NOTHING;
ALTER TABLE "Tripwire" DROP COLUMN "createdBy";

-- Caveat already used an ID-shaped field but previously had no User FK.
INSERT INTO "AuditEvent" (
  "id", "organisationId", "action", "detail", "objectType", "objectId",
  "actorNameSnapshot", "createdAt"
)
SELECT
  'legacy-' || md5('Caveat:' || target."id" || ':createdById'),
  target."organisationId", 'LEGACY_ACTOR_PRESERVED',
  'Unresolved legacy creator identifier retained before enforcing the User relation.',
  'Caveat', target."id", target."createdById", CURRENT_TIMESTAMP
FROM "Caveat" AS target
LEFT JOIN "User" AS actor
  ON actor."id" = target."createdById"
  AND actor."organisationId" = target."organisationId"
WHERE target."createdById" IS NOT NULL AND actor."id" IS NULL
ON CONFLICT ("id") DO NOTHING;
UPDATE "Caveat" AS target
SET "createdById" = NULL
WHERE target."createdById" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "User" AS actor
    WHERE actor."id" = target."createdById"
      AND actor."organisationId" = target."organisationId"
  );

-- The original consolidation migration creates and populates this archive for
-- fresh upgrades. Existing demo databases that applied the earlier checksum
-- receive the same empty archive here.
CREATE TABLE IF NOT EXISTS "LegacyRuleSnapshot" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "LegacyRuleSnapshot_ruleKey_key" ON "LegacyRuleSnapshot"("ruleKey");

-- CreateTable
CREATE TABLE "DocumentRecordLink" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "linkType" TEXT NOT NULL DEFAULT 'Source',
    "pageReference" TEXT,
    "sourceExcerpt" TEXT,
    "createdById" TEXT,
    "obligationId" TEXT,
    "actionId" TEXT,
    "assumptionId" TEXT,
    "caveatId" TEXT,
    "tripwireId" TEXT,
    "exceptionId" TEXT,
    "evidenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentRecordLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewItemRecordLink" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "reviewItemId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL DEFAULT 'Linked',
    "createdById" TEXT,
    "obligationId" TEXT,
    "actionId" TEXT,
    "assumptionId" TEXT,
    "caveatId" TEXT,
    "tripwireId" TEXT,
    "exceptionId" TEXT,
    "evidenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewItemRecordLink_pkey" PRIMARY KEY ("id")
);

-- The first migration records every old Document -> obligation edge in this
-- staging table. It is created here as well so an already-upgraded empty demo
-- remains forward-compatible.
CREATE TABLE IF NOT EXISTS "_LegacyDocumentObligationLink" (
    "documentId" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    PRIMARY KEY ("documentId", "obligationId")
);

-- Recover creation provenance only when the legacy polymorphic pointer is
-- unambiguous. All pointers, including multiple links to one record, are then
-- represented in ReviewItemRecordLink below.
UPDATE "ManualObligation" AS target
SET "originatingReviewItemId" = item."id",
    "sourceDocumentId" = COALESCE(target."sourceDocumentId", item."documentId")
FROM "ReviewItem" AS item
WHERE item."createdLiveObjectType" = 'Obligation'
  AND item."createdLiveObjectId" = target."id"
  AND target."originatingReviewItemId" IS NULL
  AND 1 = (
    SELECT COUNT(*) FROM "ReviewItem" AS candidate
    WHERE candidate."createdLiveObjectType" = 'Obligation'
      AND candidate."createdLiveObjectId" = target."id"
  );
UPDATE "Action" AS target
SET "originatingReviewItemId" = item."id",
    "sourceDocumentId" = COALESCE(target."sourceDocumentId", item."documentId")
FROM "ReviewItem" AS item
WHERE item."createdLiveObjectType" = 'Action'
  AND item."createdLiveObjectId" = target."id"
  AND target."originatingReviewItemId" IS NULL
  AND 1 = (
    SELECT COUNT(*) FROM "ReviewItem" AS candidate
    WHERE candidate."createdLiveObjectType" = 'Action'
      AND candidate."createdLiveObjectId" = target."id"
  );
UPDATE "Assumption" AS target
SET "originatingReviewItemId" = item."id",
    "sourceDocumentId" = COALESCE(target."sourceDocumentId", item."documentId")
FROM "ReviewItem" AS item
WHERE item."createdLiveObjectType" = 'Assumption'
  AND item."createdLiveObjectId" = target."id"
  AND target."originatingReviewItemId" IS NULL
  AND 1 = (
    SELECT COUNT(*) FROM "ReviewItem" AS candidate
    WHERE candidate."createdLiveObjectType" = 'Assumption'
      AND candidate."createdLiveObjectId" = target."id"
  );
UPDATE "Caveat" AS target
SET "originatingReviewItemId" = item."id",
    "sourceDocumentId" = COALESCE(target."sourceDocumentId", item."documentId")
FROM "ReviewItem" AS item
WHERE item."createdLiveObjectType" = 'Caveat'
  AND item."createdLiveObjectId" = target."id"
  AND target."originatingReviewItemId" IS NULL
  AND 1 = (
    SELECT COUNT(*) FROM "ReviewItem" AS candidate
    WHERE candidate."createdLiveObjectType" = 'Caveat'
      AND candidate."createdLiveObjectId" = target."id"
  );
UPDATE "Tripwire" AS target
SET "originatingReviewItemId" = item."id",
    "sourceDocumentId" = COALESCE(target."sourceDocumentId", item."documentId")
FROM "ReviewItem" AS item
WHERE item."createdLiveObjectType" = 'Tripwire'
  AND item."createdLiveObjectId" = target."id"
  AND target."originatingReviewItemId" IS NULL
  AND 1 = (
    SELECT COUNT(*) FROM "ReviewItem" AS candidate
    WHERE candidate."createdLiveObjectType" = 'Tripwire'
      AND candidate."createdLiveObjectId" = target."id"
  );

-- Preserve every former Document -> obligation edge, not merely one arbitrary
-- sourceDocumentId value.
INSERT INTO "DocumentRecordLink" (
  "id", "organisationId", "documentId", "obligationId", "linkType", "createdAt"
)
SELECT
  'doclink-' || md5(legacy."documentId" || ':' || legacy."obligationId"),
  legacy."organisationId", legacy."documentId", legacy."obligationId",
  'Source', legacy."createdAt"
FROM "_LegacyDocumentObligationLink" AS legacy
JOIN "Document" AS document ON document."id" = legacy."documentId"
JOIN "ManualObligation" AS obligation ON obligation."id" = legacy."obligationId"
WHERE document."organisationId" = legacy."organisationId"
  AND obligation."organisationId" = legacy."organisationId"
ON CONFLICT ("id") DO NOTHING;

-- Materialise primary source-document pointers into the many-to-many graph.
INSERT INTO "DocumentRecordLink" ("id", "organisationId", "documentId", "obligationId", "linkType", "pageReference", "createdById")
SELECT 'doclink-' || md5('Obligation:' || target."id" || ':' || target."sourceDocumentId"), target."organisationId", target."sourceDocumentId", target."id", 'Source', target."sourcePageParagraph", target."createdById"
FROM "ManualObligation" AS target
WHERE target."sourceDocumentId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "DocumentRecordLink" AS link WHERE link."documentId" = target."sourceDocumentId" AND link."obligationId" = target."id" AND link."linkType" = 'Source');
INSERT INTO "DocumentRecordLink" ("id", "organisationId", "documentId", "actionId", "linkType", "pageReference", "createdById")
SELECT 'doclink-' || md5('Action:' || target."id" || ':' || target."sourceDocumentId"), target."organisationId", target."sourceDocumentId", target."id", 'Source', target."sourcePageParagraph", target."createdById"
FROM "Action" AS target WHERE target."sourceDocumentId" IS NOT NULL;
INSERT INTO "DocumentRecordLink" ("id", "organisationId", "documentId", "assumptionId", "linkType", "pageReference", "createdById")
SELECT 'doclink-' || md5('Assumption:' || target."id" || ':' || target."sourceDocumentId"), target."organisationId", target."sourceDocumentId", target."id", 'Source', target."sourcePageParagraph", target."createdById"
FROM "Assumption" AS target WHERE target."sourceDocumentId" IS NOT NULL;
INSERT INTO "DocumentRecordLink" ("id", "organisationId", "documentId", "caveatId", "linkType", "pageReference", "createdById")
SELECT 'doclink-' || md5('Caveat:' || target."id" || ':' || target."sourceDocumentId"), target."organisationId", target."sourceDocumentId", target."id", 'Source', target."sourcePageParagraph", target."createdById"
FROM "Caveat" AS target WHERE target."sourceDocumentId" IS NOT NULL;
INSERT INTO "DocumentRecordLink" ("id", "organisationId", "documentId", "tripwireId", "linkType", "pageReference", "createdById")
SELECT 'doclink-' || md5('Tripwire:' || target."id" || ':' || target."sourceDocumentId"), target."organisationId", target."sourceDocumentId", target."id", 'Source', target."sourcePageParagraph", target."createdById"
FROM "Tripwire" AS target WHERE target."sourceDocumentId" IS NOT NULL;

-- Convert all valid historical review pointers into relational lineage.
INSERT INTO "ReviewItemRecordLink" ("id", "organisationId", "reviewItemId", "relationType", "obligationId", "createdById")
SELECT 'reviewlink-' || md5('Obligation:' || item."id" || ':' || target."id"), item."organisationId", item."id",
  CASE WHEN target."originatingReviewItemId" = item."id" THEN 'Created' ELSE 'Linked' END, target."id", item."reviewedById"
FROM "ReviewItem" AS item JOIN "ManualObligation" AS target ON target."id" = item."createdLiveObjectId"
WHERE item."createdLiveObjectType" = 'Obligation' AND target."organisationId" = item."organisationId";
INSERT INTO "ReviewItemRecordLink" ("id", "organisationId", "reviewItemId", "relationType", "actionId", "createdById")
SELECT 'reviewlink-' || md5('Action:' || item."id" || ':' || target."id"), item."organisationId", item."id",
  CASE WHEN target."originatingReviewItemId" = item."id" THEN 'Created' ELSE 'Linked' END, target."id", item."reviewedById"
FROM "ReviewItem" AS item JOIN "Action" AS target ON target."id" = item."createdLiveObjectId"
WHERE item."createdLiveObjectType" = 'Action' AND target."organisationId" = item."organisationId";
INSERT INTO "ReviewItemRecordLink" ("id", "organisationId", "reviewItemId", "relationType", "assumptionId", "createdById")
SELECT 'reviewlink-' || md5('Assumption:' || item."id" || ':' || target."id"), item."organisationId", item."id",
  CASE WHEN target."originatingReviewItemId" = item."id" THEN 'Created' ELSE 'Linked' END, target."id", item."reviewedById"
FROM "ReviewItem" AS item JOIN "Assumption" AS target ON target."id" = item."createdLiveObjectId"
WHERE item."createdLiveObjectType" = 'Assumption' AND target."organisationId" = item."organisationId";
INSERT INTO "ReviewItemRecordLink" ("id", "organisationId", "reviewItemId", "relationType", "caveatId", "createdById")
SELECT 'reviewlink-' || md5('Caveat:' || item."id" || ':' || target."id"), item."organisationId", item."id",
  CASE WHEN target."originatingReviewItemId" = item."id" THEN 'Created' ELSE 'Linked' END, target."id", item."reviewedById"
FROM "ReviewItem" AS item JOIN "Caveat" AS target ON target."id" = item."createdLiveObjectId"
WHERE item."createdLiveObjectType" = 'Caveat' AND target."organisationId" = item."organisationId";
INSERT INTO "ReviewItemRecordLink" ("id", "organisationId", "reviewItemId", "relationType", "tripwireId", "createdById")
SELECT 'reviewlink-' || md5('Tripwire:' || item."id" || ':' || target."id"), item."organisationId", item."id",
  CASE WHEN target."originatingReviewItemId" = item."id" THEN 'Created' ELSE 'Linked' END, target."id", item."reviewedById"
FROM "ReviewItem" AS item JOIN "Tripwire" AS target ON target."id" = item."createdLiveObjectId"
WHERE item."createdLiveObjectType" = 'Tripwire' AND target."organisationId" = item."organisationId";

-- Review links are also source links even where a historical record had no
-- single primary sourceDocumentId.
INSERT INTO "DocumentRecordLink" ("id", "organisationId", "documentId", "obligationId", "linkType", "pageReference", "sourceExcerpt", "createdById")
SELECT 'doclink-' || md5('ReviewObligation:' || item."id" || ':' || target."id"), item."organisationId", item."documentId", target."id", 'Source', item."sourcePageSection", item."sourceTextExcerpt", item."reviewedById"
FROM "ReviewItem" AS item JOIN "ManualObligation" AS target ON target."id" = item."createdLiveObjectId"
WHERE item."createdLiveObjectType" = 'Obligation' AND target."organisationId" = item."organisationId"
  AND NOT EXISTS (SELECT 1 FROM "DocumentRecordLink" AS link WHERE link."documentId" = item."documentId" AND link."obligationId" = target."id" AND link."linkType" = 'Source');
INSERT INTO "DocumentRecordLink" ("id", "organisationId", "documentId", "actionId", "linkType", "pageReference", "sourceExcerpt", "createdById")
SELECT 'doclink-' || md5('ReviewAction:' || item."id" || ':' || target."id"), item."organisationId", item."documentId", target."id", 'Source', item."sourcePageSection", item."sourceTextExcerpt", item."reviewedById"
FROM "ReviewItem" AS item JOIN "Action" AS target ON target."id" = item."createdLiveObjectId"
WHERE item."createdLiveObjectType" = 'Action' AND target."organisationId" = item."organisationId"
  AND NOT EXISTS (SELECT 1 FROM "DocumentRecordLink" AS link WHERE link."documentId" = item."documentId" AND link."actionId" = target."id" AND link."linkType" = 'Source');
INSERT INTO "DocumentRecordLink" ("id", "organisationId", "documentId", "assumptionId", "linkType", "pageReference", "sourceExcerpt", "createdById")
SELECT 'doclink-' || md5('ReviewAssumption:' || item."id" || ':' || target."id"), item."organisationId", item."documentId", target."id", 'Source', item."sourcePageSection", item."sourceTextExcerpt", item."reviewedById"
FROM "ReviewItem" AS item JOIN "Assumption" AS target ON target."id" = item."createdLiveObjectId"
WHERE item."createdLiveObjectType" = 'Assumption' AND target."organisationId" = item."organisationId"
  AND NOT EXISTS (SELECT 1 FROM "DocumentRecordLink" AS link WHERE link."documentId" = item."documentId" AND link."assumptionId" = target."id" AND link."linkType" = 'Source');
INSERT INTO "DocumentRecordLink" ("id", "organisationId", "documentId", "caveatId", "linkType", "pageReference", "sourceExcerpt", "createdById")
SELECT 'doclink-' || md5('ReviewCaveat:' || item."id" || ':' || target."id"), item."organisationId", item."documentId", target."id", 'Source', item."sourcePageSection", item."sourceTextExcerpt", item."reviewedById"
FROM "ReviewItem" AS item JOIN "Caveat" AS target ON target."id" = item."createdLiveObjectId"
WHERE item."createdLiveObjectType" = 'Caveat' AND target."organisationId" = item."organisationId"
  AND NOT EXISTS (SELECT 1 FROM "DocumentRecordLink" AS link WHERE link."documentId" = item."documentId" AND link."caveatId" = target."id" AND link."linkType" = 'Source');
INSERT INTO "DocumentRecordLink" ("id", "organisationId", "documentId", "tripwireId", "linkType", "pageReference", "sourceExcerpt", "createdById")
SELECT 'doclink-' || md5('ReviewTripwire:' || item."id" || ':' || target."id"), item."organisationId", item."documentId", target."id", 'Source', item."sourcePageSection", item."sourceTextExcerpt", item."reviewedById"
FROM "ReviewItem" AS item JOIN "Tripwire" AS target ON target."id" = item."createdLiveObjectId"
WHERE item."createdLiveObjectType" = 'Tripwire' AND target."organisationId" = item."organisationId"
  AND NOT EXISTS (SELECT 1 FROM "DocumentRecordLink" AS link WHERE link."documentId" = item."documentId" AND link."tripwireId" = target."id" AND link."linkType" = 'Source');

DROP TABLE "_LegacyDocumentObligationLink";

-- Do not strand uploaders when a previously restricted document enters the
-- ACL regime. Administrators and Heads of Tax retain policy-level bypass.
INSERT INTO "DocumentAccess" (
  "id", "organisationId", "documentId", "userId", "permission",
  "grantedAt", "grantedById", "reason"
)
SELECT
  'access-' || md5(document."id" || ':' || document."uploadedById"),
  document."organisationId", document."id", document."uploadedById", 'manage',
  CURRENT_TIMESTAMP, document."uploadedById", 'Backfilled for pre-ACL restricted document uploader'
FROM "Document" AS document
JOIN "User" AS uploader
  ON uploader."id" = document."uploadedById"
  AND uploader."organisationId" = document."organisationId"
WHERE document."restrictedAccess" = TRUE
ON CONFLICT ("documentId", "userId") DO NOTHING;

-- Database-enforced invariants for lineage, separation of duties and
-- tombstone completeness.
ALTER TABLE "DocumentRecordLink" ADD CONSTRAINT "DocumentRecordLink_one_target_check"
  CHECK (num_nonnulls("obligationId", "actionId", "assumptionId", "caveatId", "tripwireId", "exceptionId", "evidenceId") = 1);
ALTER TABLE "ReviewItemRecordLink" ADD CONSTRAINT "ReviewItemRecordLink_one_target_check"
  CHECK (num_nonnulls("obligationId", "actionId", "assumptionId", "caveatId", "tripwireId", "exceptionId", "evidenceId") = 1);
ALTER TABLE "RaciAssignment" ADD CONSTRAINT "RaciAssignment_one_target_check"
  CHECK (num_nonnulls("obligationId", "actionId") = 1);
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_one_target_check"
  CHECK (num_nonnulls("obligationId", "actionId") = 1);
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_separation_of_duties_check"
  CHECK ("requestedById" <> "approverId");
ALTER TABLE "TaxRuleVersion" ADD CONSTRAINT "TaxRuleVersion_independent_reviewer_check"
  CHECK ("reviewedById" IS NULL OR "reviewedById" <> "createdById");
ALTER TABLE "TaxRuleVersion" ADD CONSTRAINT "TaxRuleVersion_effective_dates_check"
  CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");
ALTER TABLE "Document" ADD CONSTRAINT "Document_not_self_superseding_check"
  CHECK ("supersedesDocumentId" IS NULL OR "supersedesDocumentId" <> "id");
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_tombstone_reason_check"
  CHECK ("deletedAt" IS NULL OR "deletionReason" IS NOT NULL);
ALTER TABLE "Document" ADD CONSTRAINT "Document_tombstone_reason_check"
  CHECK ("deletedAt" IS NULL OR "deletionReason" IS NOT NULL);
ALTER TABLE "Action" ADD CONSTRAINT "Action_tombstone_reason_check"
  CHECK ("deletedAt" IS NULL OR "deletionReason" IS NOT NULL);
ALTER TABLE "ManualObligation" ADD CONSTRAINT "ManualObligation_tombstone_reason_check"
  CHECK ("deletedAt" IS NULL OR "deletionReason" IS NOT NULL);
ALTER TABLE "RegimeAssessment" ADD CONSTRAINT "RegimeAssessment_one_subject_check"
  CHECK (num_nonnulls("entityId", "groupId") = 1);

DROP INDEX "RegimeAssessment_organisationId_regime_entityId_groupId_per_key";
CREATE UNIQUE INDEX "RegimeAssessment_entity_period_key"
  ON "RegimeAssessment" ("organisationId", "regime", "entityId", "periodStart", "periodEnd")
  WHERE "entityId" IS NOT NULL;
CREATE UNIQUE INDEX "RegimeAssessment_group_period_key"
  ON "RegimeAssessment" ("organisationId", "regime", "groupId", "periodStart", "periodEnd")
  WHERE "groupId" IS NOT NULL;
CREATE UNIQUE INDEX "EntityRelation_null_effective_from_key"
  ON "EntityRelation" ("organisationId", "fromEntityId", "toEntityId", "relationType")
  WHERE "effectiveFrom" IS NULL;

-- Prevent two approved versions of the same controlled rule from applying to
-- the same point in time. This makes effective dating executable rather than
-- descriptive metadata.
CREATE OR REPLACE FUNCTION enforce_approved_tax_rule_version_interval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."status" IN ('Approved', 'Superseded') AND EXISTS (
    SELECT 1
    FROM "TaxRuleVersion" AS existing
    WHERE existing."ruleId" = NEW."ruleId"
      AND existing."id" <> NEW."id"
      AND existing."status" IN ('Approved', 'Superseded')
      AND NEW."effectiveFrom" < COALESCE(existing."effectiveTo", 'infinity'::timestamp)
      AND existing."effectiveFrom" < COALESCE(NEW."effectiveTo", 'infinity'::timestamp)
  ) THEN
    RAISE EXCEPTION 'Approved TaxRuleVersion intervals may not overlap for rule %', NEW."ruleId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "TaxRuleVersion_no_approved_overlap"
BEFORE INSERT OR UPDATE OF "ruleId", "status", "effectiveFrom", "effectiveTo"
ON "TaxRuleVersion"
FOR EACH ROW EXECUTE FUNCTION enforce_approved_tax_rule_version_interval();

-- CreateIndex
CREATE INDEX "DocumentRecordLink_organisationId_idx" ON "DocumentRecordLink"("organisationId");

-- CreateIndex
CREATE INDEX "DocumentRecordLink_createdById_idx" ON "DocumentRecordLink"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRecordLink_documentId_obligationId_linkType_key" ON "DocumentRecordLink"("documentId", "obligationId", "linkType");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRecordLink_documentId_actionId_linkType_key" ON "DocumentRecordLink"("documentId", "actionId", "linkType");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRecordLink_documentId_assumptionId_linkType_key" ON "DocumentRecordLink"("documentId", "assumptionId", "linkType");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRecordLink_documentId_caveatId_linkType_key" ON "DocumentRecordLink"("documentId", "caveatId", "linkType");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRecordLink_documentId_tripwireId_linkType_key" ON "DocumentRecordLink"("documentId", "tripwireId", "linkType");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRecordLink_documentId_exceptionId_linkType_key" ON "DocumentRecordLink"("documentId", "exceptionId", "linkType");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRecordLink_documentId_evidenceId_linkType_key" ON "DocumentRecordLink"("documentId", "evidenceId", "linkType");

-- CreateIndex
CREATE INDEX "ReviewItemRecordLink_organisationId_idx" ON "ReviewItemRecordLink"("organisationId");

-- CreateIndex
CREATE INDEX "ReviewItemRecordLink_createdById_idx" ON "ReviewItemRecordLink"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewItemRecordLink_reviewItemId_obligationId_relationType_key" ON "ReviewItemRecordLink"("reviewItemId", "obligationId", "relationType");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewItemRecordLink_reviewItemId_actionId_relationType_key" ON "ReviewItemRecordLink"("reviewItemId", "actionId", "relationType");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewItemRecordLink_reviewItemId_assumptionId_relationType_key" ON "ReviewItemRecordLink"("reviewItemId", "assumptionId", "relationType");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewItemRecordLink_reviewItemId_caveatId_relationType_key" ON "ReviewItemRecordLink"("reviewItemId", "caveatId", "relationType");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewItemRecordLink_reviewItemId_tripwireId_relationType_key" ON "ReviewItemRecordLink"("reviewItemId", "tripwireId", "relationType");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewItemRecordLink_reviewItemId_exceptionId_relationType_key" ON "ReviewItemRecordLink"("reviewItemId", "exceptionId", "relationType");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewItemRecordLink_reviewItemId_evidenceId_relationType_key" ON "ReviewItemRecordLink"("reviewItemId", "evidenceId", "relationType");

-- CreateIndex
CREATE INDEX "Assumption_createdById_idx" ON "Assumption"("createdById");

-- CreateIndex
CREATE INDEX "Caveat_createdById_idx" ON "Caveat"("createdById");

-- CreateIndex
CREATE INDEX "SourceConflict_reviewOwnerId_idx" ON "SourceConflict"("reviewOwnerId");

-- CreateIndex
CREATE INDEX "SourcePriorityRule_reviewOwnerId_idx" ON "SourcePriorityRule"("reviewOwnerId");

-- CreateIndex
CREATE INDEX "StatusHistory_changedById_idx" ON "StatusHistory"("changedById");

-- CreateIndex
CREATE INDEX "Tripwire_createdById_idx" ON "Tripwire"("createdById");

-- AddForeignKey
ALTER TABLE "RaciAssignment" ADD CONSTRAINT "RaciAssignment_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "ManualObligation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaciAssignment" ADD CONSTRAINT "RaciAssignment_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusHistory" ADD CONSTRAINT "StatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assumption" ADD CONSTRAINT "Assumption_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caveat" ADD CONSTRAINT "Caveat_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tripwire" ADD CONSTRAINT "Tripwire_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "ManualObligation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "ManualObligation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRequest" ADD CONSTRAINT "DataRequest_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "ManualObligation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRequest" ADD CONSTRAINT "DataRequest_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_dataRequestId_fkey" FOREIGN KEY ("dataRequestId") REFERENCES "DataRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "ManualObligation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "ManualObligation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionRun" ADD CONSTRAINT "ExtractionRun_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRecordLink" ADD CONSTRAINT "DocumentRecordLink_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRecordLink" ADD CONSTRAINT "DocumentRecordLink_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRecordLink" ADD CONSTRAINT "DocumentRecordLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRecordLink" ADD CONSTRAINT "DocumentRecordLink_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "ManualObligation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRecordLink" ADD CONSTRAINT "DocumentRecordLink_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRecordLink" ADD CONSTRAINT "DocumentRecordLink_assumptionId_fkey" FOREIGN KEY ("assumptionId") REFERENCES "Assumption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRecordLink" ADD CONSTRAINT "DocumentRecordLink_caveatId_fkey" FOREIGN KEY ("caveatId") REFERENCES "Caveat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRecordLink" ADD CONSTRAINT "DocumentRecordLink_tripwireId_fkey" FOREIGN KEY ("tripwireId") REFERENCES "Tripwire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRecordLink" ADD CONSTRAINT "DocumentRecordLink_exceptionId_fkey" FOREIGN KEY ("exceptionId") REFERENCES "Exception"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRecordLink" ADD CONSTRAINT "DocumentRecordLink_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "EvidenceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItemRecordLink" ADD CONSTRAINT "ReviewItemRecordLink_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItemRecordLink" ADD CONSTRAINT "ReviewItemRecordLink_reviewItemId_fkey" FOREIGN KEY ("reviewItemId") REFERENCES "ReviewItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItemRecordLink" ADD CONSTRAINT "ReviewItemRecordLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItemRecordLink" ADD CONSTRAINT "ReviewItemRecordLink_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "ManualObligation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItemRecordLink" ADD CONSTRAINT "ReviewItemRecordLink_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItemRecordLink" ADD CONSTRAINT "ReviewItemRecordLink_assumptionId_fkey" FOREIGN KEY ("assumptionId") REFERENCES "Assumption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItemRecordLink" ADD CONSTRAINT "ReviewItemRecordLink_caveatId_fkey" FOREIGN KEY ("caveatId") REFERENCES "Caveat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItemRecordLink" ADD CONSTRAINT "ReviewItemRecordLink_tripwireId_fkey" FOREIGN KEY ("tripwireId") REFERENCES "Tripwire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItemRecordLink" ADD CONSTRAINT "ReviewItemRecordLink_exceptionId_fkey" FOREIGN KEY ("exceptionId") REFERENCES "Exception"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItemRecordLink" ADD CONSTRAINT "ReviewItemRecordLink_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "EvidenceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcePriorityRule" ADD CONSTRAINT "SourcePriorityRule_reviewOwnerId_fkey" FOREIGN KEY ("reviewOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceConflict" ADD CONSTRAINT "SourceConflict_reviewOwnerId_fkey" FOREIGN KEY ("reviewOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRuleVersion" ADD CONSTRAINT "TaxRuleVersion_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "TaxRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleCitation" ADD CONSTRAINT "RuleCitation_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "TaxRuleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleImpactReview" ADD CONSTRAINT "RuleImpactReview_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "TaxRuleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
