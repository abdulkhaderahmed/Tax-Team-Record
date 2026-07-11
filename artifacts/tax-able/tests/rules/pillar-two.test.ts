import assert from "node:assert/strict";
import test from "node:test";

import {
  assessPillarTwoScope,
  generatePillarTwoObligations,
  pillarTwoRevenueThreshold,
} from "../../src/domain/rules/index";

const priorPeriods = [
  { period: { start: "2020-01-01", end: "2020-12-31" }, consolidatedRevenueEur: 800_000_000 },
  { period: { start: "2021-01-01", end: "2021-12-31" }, consolidatedRevenueEur: 700_000_000 },
  { period: { start: "2022-01-01", end: "2022-12-31" }, consolidatedRevenueEur: 800_000_000 },
  { period: { start: "2023-01-01", end: "2023-12-31" }, consolidatedRevenueEur: 700_000_000 },
] as const;

test("Pillar Two threshold is day-adjusted and strict-greater-than", () => {
  assert.equal(
    pillarTwoRevenueThreshold({ start: "2021-01-01", end: "2021-12-31" }),
    750_000_000,
  );
  assert.ok(
    Math.abs(
      pillarTwoRevenueThreshold({ start: "2020-01-01", end: "2020-12-31" }) - 752_054_794.520548,
    ) < 0.000001,
  );

  const assessment = assessPillarTwoScope({
    testedPeriod: { start: "2024-01-01", end: "2024-12-31" },
    hasUkEntity: true,
    priorPeriods: [
      { period: { start: "2019-01-01", end: "2019-12-31" }, consolidatedRevenueEur: 750_000_000 },
      { period: { start: "2020-01-01", end: "2020-12-31" }, consolidatedRevenueEur: 752_000_000 },
      { period: { start: "2021-01-01", end: "2021-12-31" }, consolidatedRevenueEur: 900_000_000 },
      { period: { start: "2022-01-01", end: "2022-12-31" }, consolidatedRevenueEur: 700_000_000 },
    ],
  });

  assert.equal(assessment.periodsExceedingThreshold, 1);
  assert.equal(assessment.status, "NOT_QUALIFYING");
});

test("two of four periods strictly exceeding threshold makes a UK group qualifying", () => {
  const assessment = assessPillarTwoScope({
    testedPeriod: { start: "2024-01-01", end: "2024-12-31" },
    priorPeriods,
    hasUkEntity: true,
  });

  assert.equal(assessment.status, "QUALIFYING");
  assert.equal(assessment.periodsExceedingThreshold, 2);
  assert.equal(assessment.provenance.ruleKey, "PILLAR2_SCOPE");
  assert.ok(assessment.why.some((step) => step.code === "TWO_OF_FOUR_EXCEEDED"));
});

test("first Pillar Two period generates registration and 18-month return/payment dates", () => {
  const generated = generatePillarTwoObligations({
    testedPeriod: { start: "2025-01-01", end: "2025-12-31" },
    priorPeriods,
    hasUkEntity: true,
    reportingSequence: "FIRST",
    registrationAlreadyCompleted: false,
    filingRoute: "UK_GIR",
    hasPaymentLiability: true,
  });

  assert.equal(generated.assessment.status, "QUALIFYING");
  assert.deepEqual(generated.obligations.map((result) => [result.ruleKey, result.dueDate]), [
    ["PILLAR2_REGISTRATION", "2026-06-30"],
    ["PILLAR2_RETURN", "2027-06-30"],
    ["PILLAR2_PAYMENT", "2027-06-30"],
  ]);
});

test("transitional first period is never due before 30 June 2026", () => {
  const generated = generatePillarTwoObligations({
    testedPeriod: { start: "2023-12-31", end: "2024-12-30" },
    priorPeriods,
    hasUkEntity: true,
    reportingSequence: "FIRST",
    registrationAlreadyCompleted: false,
    filingRoute: "UK_GIR",
    hasPaymentLiability: true,
  });

  assert.equal(generated.obligations.find((result) => result.ruleKey === "PILLAR2_RETURN")?.dueDate, "2026-06-30");
  assert.equal(generated.obligations.find((result) => result.ruleKey === "PILLAR2_PAYMENT")?.dueDate, "2026-06-30");
});

test("subsequent Pillar Two period uses the 15-month date", () => {
  const generated = generatePillarTwoObligations({
    testedPeriod: { start: "2026-01-01", end: "2026-12-31" },
    priorPeriods,
    hasUkEntity: true,
    reportingSequence: "SUBSEQUENT",
    registrationAlreadyCompleted: true,
    filingRoute: "UK_GIR",
    hasPaymentLiability: true,
  });

  assert.equal(generated.obligations.find((result) => result.ruleKey === "PILLAR2_RETURN")?.dueDate, "2028-03-31");
  assert.equal(generated.obligations.find((result) => result.ruleKey === "PILLAR2_PAYMENT")?.dueDate, "2028-03-31");
});

test("ORN route remains evidence-blocked and merger scope remains review-only", () => {
  const orn = generatePillarTwoObligations({
    testedPeriod: { start: "2025-01-01", end: "2025-12-31" },
    priorPeriods,
    hasUkEntity: true,
    reportingSequence: "FIRST",
    registrationAlreadyCompleted: true,
    filingRoute: "ORN",
    hasPaymentLiability: false,
  });
  const merger = generatePillarTwoObligations({
    testedPeriod: { start: "2025-01-01", end: "2025-12-31" },
    priorPeriods,
    hasUkEntity: true,
    mergerOrDemerger: true,
    reportingSequence: "FIRST",
    registrationAlreadyCompleted: false,
    filingRoute: "UK_GIR",
    hasPaymentLiability: false,
  });

  assert.equal(orn.obligations.find((result) => result.ruleKey === "PILLAR2_RETURN")?.blocksReadiness, true);
  assert.equal(merger.assessment.status, "REVIEW_REQUIRED");
  assert.equal(merger.obligations[0]?.outcome, "REVIEW_REQUIRED");
});
