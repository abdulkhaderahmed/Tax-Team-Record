-- Persist the generator's deterministic occurrence identity. This makes the
-- "one obligation occurrence" invariant safe under concurrent requests rather
-- than relying only on an in-memory preflight.
ALTER TABLE "ManualObligation" ADD COLUMN "occurrenceKey" TEXT;

UPDATE "ManualObligation"
SET "occurrenceKey" =
  COALESCE("ruleKey", 'none') || '|' ||
  "obligationType" || '|' ||
  COALESCE(to_char("periodStart", 'YYYY-MM-DD'), 'none') || '|' ||
  COALESCE(to_char("periodEnd", 'YYYY-MM-DD'), 'none') || '|' ||
  COALESCE(to_char(COALESCE("paymentDeadline", "filingDeadline"), 'YYYY-MM-DD'), 'none') || '|' ||
  "description"
WHERE "ruleVersionId" IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ManualObligation"
    WHERE "occurrenceKey" IS NOT NULL
    GROUP BY "organisationId", "entityId", "occurrenceKey"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce obligation occurrence uniqueness: duplicate controlled occurrences exist';
  END IF;
END $$;

CREATE UNIQUE INDEX "ManualObligation_organisationId_entityId_occurrenceKey_key"
ON "ManualObligation"("organisationId", "entityId", "occurrenceKey");
