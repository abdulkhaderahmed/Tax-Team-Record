-- Operational controls may point at an obligation or an action, never both.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Exception" WHERE num_nonnulls("obligationId", "actionId") > 1) THEN
    RAISE EXCEPTION 'Cannot enforce Exception target integrity: obligation/action dual links exist';
  END IF;
  IF EXISTS (SELECT 1 FROM "EvidenceItem" WHERE num_nonnulls("obligationId", "actionId") > 1) THEN
    RAISE EXCEPTION 'Cannot enforce EvidenceItem target integrity: obligation/action dual links exist';
  END IF;
  IF EXISTS (SELECT 1 FROM "DataRequest" WHERE num_nonnulls("obligationId", "actionId") > 1) THEN
    RAISE EXCEPTION 'Cannot enforce DataRequest target integrity: obligation/action dual links exist';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Approval"
    WHERE "status" = 'Pending' AND "obligationId" IS NOT NULL
    GROUP BY "organisationId", "obligationId", "gate" HAVING COUNT(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM "Approval"
    WHERE "status" = 'Pending' AND "actionId" IS NOT NULL
    GROUP BY "organisationId", "actionId", "gate" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce Approval gate integrity: duplicate pending gates exist';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Exception"
    WHERE "resolvedById" IS NOT NULL AND "ownerId" IS NOT NULL AND "resolvedById" = "ownerId"
  ) THEN
    RAISE EXCEPTION 'Cannot enforce Exception separation: self-resolved records exist';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "EvidenceItem"
    WHERE "verifiedById" IS NOT NULL AND "ownerId" IS NOT NULL AND "verifiedById" = "ownerId"
  ) THEN
    RAISE EXCEPTION 'Cannot enforce Evidence separation: self-verified records exist';
  END IF;
END $$;

ALTER TABLE "Exception"
  ADD CONSTRAINT "Exception_single_operational_target_check"
  CHECK (num_nonnulls("obligationId", "actionId") <= 1);

ALTER TABLE "EvidenceItem"
  ADD CONSTRAINT "EvidenceItem_single_operational_target_check"
  CHECK (num_nonnulls("obligationId", "actionId") <= 1);

ALTER TABLE "DataRequest"
  ADD CONSTRAINT "DataRequest_single_operational_target_check"
  CHECK (num_nonnulls("obligationId", "actionId") <= 1);

-- Independent resolution and verification are database invariants as well as
-- server-action policy. NULL actors remain valid for pre-review records.
ALTER TABLE "Exception"
  ADD CONSTRAINT "Exception_resolution_separation_check"
  CHECK ("resolvedById" IS NULL OR "ownerId" IS NULL OR "resolvedById" <> "ownerId");

ALTER TABLE "EvidenceItem"
  ADD CONSTRAINT "EvidenceItem_verification_separation_check"
  CHECK ("verifiedById" IS NULL OR "ownerId" IS NULL OR "verifiedById" <> "ownerId");

-- Only one pending cycle for a target/gate can exist. Separate partial indexes
-- are required because an Approval has exactly one nullable target column.
CREATE UNIQUE INDEX "Approval_pending_obligation_gate_key"
ON "Approval"("organisationId", "obligationId", "gate")
WHERE "status" = 'Pending' AND "obligationId" IS NOT NULL;

CREATE UNIQUE INDEX "Approval_pending_action_gate_key"
ON "Approval"("organisationId", "actionId", "gate")
WHERE "status" = 'Pending' AND "actionId" IS NOT NULL;
