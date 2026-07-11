import assert from "node:assert/strict";
import test from "node:test";
import type { ApprovedRuleVersion } from "../../src/lib/controlled-obligation-generator";
import { selectEffectiveRuleVersion } from "../../src/lib/controlled-obligation-generator";
import { CONTROLLED_RULE_ENGINE_VERSION } from "../../src/lib/controlled-rule-definitions";

function version(
  number: number,
  status: "Approved" | "Superseded",
  effectiveFrom: string,
  effectiveTo: string | null,
  engineVersion = CONTROLLED_RULE_ENGINE_VERSION,
): ApprovedRuleVersion {
  return {
    id: `version-${number}`,
    ruleId: "rule-1",
    version: number,
    name: "Test rule",
    description: "Test",
    obligationType: "Filing",
    statutoryBasis: "Test authority",
    statutoryUrl: "https://www.gov.uk/",
    authorityLevel: "Legislation",
    legalStatus: "Enacted",
    triggerDescription: "Test",
    triggerConfig: {},
    calculationKey: "TEST",
    calculationDescription: "Test",
    recurrence: "Annual",
    effectiveFrom: new Date(`${effectiveFrom}T00:00:00.000Z`),
    effectiveTo: effectiveTo ? new Date(`${effectiveTo}T00:00:00.000Z`) : null,
    status,
    humanReviewRequired: false,
    changeRationale: "Test",
    sourceLastCheckedAt: new Date("2026-01-01T00:00:00.000Z"),
    logicHash: null,
    engineVersion,
    createdById: "editor",
    reviewedById: "reviewer",
    reviewedAt: new Date("2026-01-01T00:00:00.000Z"),
    supersedesVersionId: number === 1 ? null : `version-${number - 1}`,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    rule: {
      id: "rule-1",
      organisationId: "org-1",
      ruleKey: "TEST_RULE",
      regime: "Test",
      active: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  };
}

test("selects the historical superseded version for its effective period", () => {
  const versions = [
    version(2, "Approved", "2026-01-01", null),
    version(1, "Superseded", "2025-01-01", "2025-12-31"),
  ];
  assert.equal(
    selectEffectiveRuleVersion(versions, new Date("2025-12-31T00:00:00.000Z"))?.version,
    1,
  );
  assert.equal(
    selectEffectiveRuleVersion(versions, new Date("2026-01-01T00:00:00.000Z"))?.version,
    2,
  );
});

test("returns null when controlled content has no effective coverage", () => {
  assert.equal(
    selectEffectiveRuleVersion(
      [version(1, "Approved", "2026-01-01", null)],
      new Date("2025-12-31T00:00:00.000Z"),
    ),
    null,
  );
});

test("fails closed when approved-history intervals overlap", () => {
  assert.throws(
    () =>
      selectEffectiveRuleVersion(
        [
          version(2, "Approved", "2026-01-01", null),
          version(1, "Superseded", "2025-01-01", "2026-01-31"),
        ],
        new Date("2026-01-15T00:00:00.000Z"),
      ),
    /overlapping approved versions/,
  );
});

test("fails closed when the selected controlled version targets another engine", () => {
  assert.throws(
    () =>
      selectEffectiveRuleVersion(
        [
          version(
            1,
            "Approved",
            "2025-01-01",
            null,
            "2026.07.10-obsolete",
          ),
        ],
        new Date("2026-01-15T00:00:00.000Z"),
      ),
    /bound to engine 2026\.07\.10-obsolete.*Generation stopped without creating records/,
  );
});
