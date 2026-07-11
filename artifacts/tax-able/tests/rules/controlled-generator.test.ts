import assert from "node:assert/strict";
import test from "node:test";
import type { AccountingPeriod, Entity } from "@prisma/client";
import {
  corporationTaxPeriods,
  generateControlledResults,
  resultApplicabilityDate,
} from "../../src/lib/controlled-obligation-generator";
import {
  CONTROLLED_RULE_DEFINITIONS,
  CONTROLLED_RULE_ENGINE_VERSION,
} from "../../src/lib/controlled-rule-definitions";

function utc(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function entity(overrides: Partial<Entity> = {}): Entity {
  return {
    accountingPeriodStart: null,
    accountingPeriodEnd: null,
    ctReturnRequired: true,
    isLargeCompany: false,
    isVeryLargeCompany: false,
    qipAssociatedCompanyCount: 1,
    p11dRequired: false,
    payeRegistered: false,
    benefitsReportingMethod: "P11D",
    hasLoansOrAccommodationBenefits: false,
    psaRequired: false,
    psaAgreementStatus: "Not in place",
    psaPaymentMethod: "Electronic",
    rdClaimExpected: false,
    rdNotificationNeeded: false,
    rdAifNeeded: false,
    vatRegistered: false,
    vatQuarterEndMonth: null,
    hasErs: false,
    hasPillar2: false,
    pillar2FirstReportingPeriod: true,
    ...overrides,
  } as Entity;
}

function accountingPeriod(
  id: string,
  periodOfAccountStart: string,
  periodOfAccountEnd: string,
  ctPeriodStart: string,
  ctPeriodEnd: string,
): AccountingPeriod {
  return {
    id,
    organisationId: "org-1",
    entityId: "entity-1",
    periodOfAccountStart: utc(periodOfAccountStart),
    periodOfAccountEnd: utc(periodOfAccountEnd),
    ctPeriodStart: utc(ctPeriodStart),
    ctPeriodEnd: utc(ctPeriodEnd),
    periodType: "Corporation Tax",
    status: "Confirmed",
    sourceDocumentId: null,
    verifiedAt: null,
    verifiedById: null,
    createdAt: utc("2026-01-01"),
    updatedAt: utc("2026-01-01"),
  };
}

test("confirmed CT periods are grouped by their own period of account", () => {
  const periods = [
    accountingPeriod(
      "later",
      "2025-07-01",
      "2026-06-30",
      "2025-07-01",
      "2026-06-30",
    ),
    accountingPeriod(
      "long-second",
      "2024-01-01",
      "2025-06-30",
      "2025-01-01",
      "2025-06-30",
    ),
    accountingPeriod(
      "long-first",
      "2024-01-01",
      "2025-06-30",
      "2024-01-01",
      "2024-12-31",
    ),
  ];

  assert.deepEqual(corporationTaxPeriods(entity(), periods), [
    {
      periodOfAccount: { start: "2024-01-01", end: "2025-06-30" },
      accountingPeriods: [
        { start: "2024-01-01", end: "2024-12-31" },
        { start: "2025-01-01", end: "2025-06-30" },
      ],
    },
    {
      periodOfAccount: { start: "2025-07-01", end: "2026-06-30" },
      accountingPeriods: [
        { start: "2025-07-01", end: "2026-06-30" },
      ],
    },
  ]);
});

test("confirmed CT period groups fail closed when coverage is incomplete", () => {
  assert.throws(
    () => corporationTaxPeriods(entity(), [
      accountingPeriod(
        "incomplete",
        "2024-01-01",
        "2025-06-30",
        "2024-01-01",
        "2024-12-31",
      ),
    ]),
    /do not fully cover period of account/i,
  );
});

test("every seeded controlled-content version binds the current deterministic engine", () => {
  assert.ok(CONTROLLED_RULE_DEFINITIONS.length > 0);
  assert.ok(
    CONTROLLED_RULE_DEFINITIONS.every(
      (definition) =>
        definition.engineVersion === CONTROLLED_RULE_ENGINE_VERSION,
    ),
  );
});

test("historical confirmed periods use the filing date of their own period of account", () => {
  const generation = generateControlledResults(
    entity(),
    [
      accountingPeriod(
        "2024",
        "2024-01-01",
        "2024-12-31",
        "2024-01-01",
        "2024-12-31",
      ),
      accountingPeriod(
        "2025",
        "2025-01-01",
        "2025-12-31",
        "2025-01-01",
        "2025-12-31",
      ),
    ],
    utc("2026-07-11"),
  );
  const returns = generation.obligations.filter(
    (result) => result.ruleKey === "CT_RETURN",
  );

  assert.deepEqual(
    returns.map((result) => ({
      accountingPeriodEnd: result.period?.end,
      periodOfAccountEnd: result.metadata?.periodOfAccountEnd,
      dueDate: result.dueDate,
    })),
    [
      {
        accountingPeriodEnd: "2024-12-31",
        periodOfAccountEnd: "2024-12-31",
        dueDate: "2025-12-31",
      },
      {
        accountingPeriodEnd: "2025-12-31",
        periodOfAccountEnd: "2025-12-31",
        dueDate: "2026-12-31",
      },
    ],
  );
  assert.ok(
    generation.obligations.every(
      (result) => result.provenance.version === CONTROLLED_RULE_ENGINE_VERSION,
    ),
  );
});

test("grouped Pillar Two entities create an impact review, not duplicate entity filings", () => {
  const generation = generateControlledResults(
    entity({
      id: "entity-1",
      groupId: "group-1",
      hasPillar2: true,
      accountingPeriodStart: utc("2025-01-01"),
      accountingPeriodEnd: utc("2025-12-31"),
    }),
    [],
    utc("2026-07-11"),
  );

  assert.equal(
    generation.obligations.filter((result) => result.ruleKey.startsWith("PILLAR2_")).length,
    0,
  );
  assert.equal(
    generation.impacts.filter((result) => result.ruleKey === "PILLAR2_SCOPE").length,
    1,
  );
  assert.match(generation.warnings.join(" "), /withheld/i);
});

test("P11D transition impact resolves against the controlled version start date", () => {
  const generation = generateControlledResults(
    entity({ p11dRequired: true, payeRegistered: true }),
    [],
    utc("2026-07-11"),
  );
  const impact = generation.impacts.find(
    (result) => result.ruleKey === "P11D_TRANSITION_2027",
  );
  const definition = CONTROLLED_RULE_DEFINITIONS.find(
    (rule) => rule.ruleKey === "P11D_TRANSITION_2027",
  );

  assert.ok(impact);
  assert.ok(definition);
  assert.equal(
    resultApplicabilityDate(impact, utc("2026-07-11")).toISOString().slice(0, 10),
    definition.effectiveFrom,
  );
});
