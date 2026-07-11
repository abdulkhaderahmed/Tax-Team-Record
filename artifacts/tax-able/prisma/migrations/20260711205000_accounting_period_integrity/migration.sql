DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "AccountingPeriod"
    WHERE "periodOfAccountStart" > "periodOfAccountEnd"
       OR "ctPeriodStart" > "ctPeriodEnd"
       OR "ctPeriodStart" < "periodOfAccountStart"
       OR "ctPeriodEnd" > "periodOfAccountEnd"
  ) THEN
    RAISE EXCEPTION 'Cannot enforce AccountingPeriod integrity: invalid period boundaries exist';
  END IF;
END $$;

ALTER TABLE "AccountingPeriod"
  ADD CONSTRAINT "AccountingPeriod_date_integrity_check"
  CHECK (
    "periodOfAccountStart" <= "periodOfAccountEnd"
    AND "ctPeriodStart" <= "ctPeriodEnd"
    AND "ctPeriodStart" >= "periodOfAccountStart"
    AND "ctPeriodEnd" <= "periodOfAccountEnd"
  );
