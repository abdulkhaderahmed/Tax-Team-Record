-- Prisma upsert executes BEFORE INSERT triggers before resolving its unique
-- (ruleId, version) conflict. Exclude the same controlled version number as
-- well as the same row ID so idempotent seeding remains possible without
-- weakening overlap protection between distinct versions.
CREATE OR REPLACE FUNCTION enforce_approved_tax_rule_version_interval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."status" IN ('Approved', 'Superseded') AND EXISTS (
    SELECT 1
    FROM "TaxRuleVersion" AS existing
    WHERE existing."ruleId" = NEW."ruleId"
      AND existing."id" <> NEW."id"
      AND existing."version" <> NEW."version"
      AND existing."status" IN ('Approved', 'Superseded')
      AND NEW."effectiveFrom" < COALESCE(existing."effectiveTo", 'infinity'::timestamp)
      AND existing."effectiveFrom" < COALESCE(NEW."effectiveTo", 'infinity'::timestamp)
  ) THEN
    RAISE EXCEPTION 'Approved TaxRuleVersion intervals may not overlap for rule %', NEW."ruleId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
