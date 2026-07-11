-- Every controlled-content version is bound to the exact deterministic rule
-- engine reviewed with it. Existing versions pre-date this column but were all
-- created for the initial 2026.07.11-1 engine, so the expand/backfill/contract
-- migration binds them explicitly before making the field required.
ALTER TABLE "TaxRuleVersion" ADD COLUMN "engineVersion" TEXT;

UPDATE "TaxRuleVersion"
SET "engineVersion" = '2026.07.11-1'
WHERE "engineVersion" IS NULL;

ALTER TABLE "TaxRuleVersion" ALTER COLUMN "engineVersion" SET NOT NULL;

CREATE INDEX "TaxRuleVersion_engineVersion_idx"
ON "TaxRuleVersion"("engineVersion");

-- A controlled version may change lifecycle state and close its effective
-- interval, but its reviewed engine binding must never be rewritten in place.
CREATE OR REPLACE FUNCTION prevent_tax_rule_engine_version_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."engineVersion" IS DISTINCT FROM OLD."engineVersion" THEN
    RAISE EXCEPTION 'TaxRuleVersion.engineVersion is immutable; create a successor version instead';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "TaxRuleVersion_engineVersion_immutable"
BEFORE UPDATE OF "engineVersion" ON "TaxRuleVersion"
FOR EACH ROW
EXECUTE FUNCTION prevent_tax_rule_engine_version_update();
