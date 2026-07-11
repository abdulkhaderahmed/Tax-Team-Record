import assert from "node:assert/strict";
import test from "node:test";

import {
  assessQipStatus,
  generateCorporationTaxObligations,
  generateQipObligations,
} from "../../src/domain/rules/index";

test("standard CT dates retain month-end before adding the payment day", () => {
  const results = generateCorporationTaxObligations({
    accountingPeriod: { start: "2025-01-01", end: "2025-06-30" },
    periodOfAccount: { start: "2025-01-01", end: "2025-06-30" },
    noticeServedDate: "2025-08-15",
    noticeStatus: "CONFIRMED",
  });

  assert.equal(results.find((result) => result.ruleKey === "CT_RETURN")?.dueDate, "2026-06-30");
  assert.equal(results.find((result) => result.ruleKey === "CT_PAYMENT_STANDARD")?.dueDate, "2026-04-01");
  assert.equal(results[0]?.provenance.version, "2026.07.11-1");
  assert.ok(results[0]?.why.some((step) => step.code === "LATEST_DATE_CONTROLS"));
});

test("an 18-month period of account gives both CT returns the common later filing date", () => {
  const periodOfAccount = { start: "2025-01-01", end: "2026-06-30" };
  const first = generateCorporationTaxObligations({
    accountingPeriod: { start: "2025-01-01", end: "2025-12-31" },
    periodOfAccount,
    noticeStatus: "CONFIRMED",
  });
  const second = generateCorporationTaxObligations({
    accountingPeriod: { start: "2026-01-01", end: "2026-06-30" },
    periodOfAccount,
    noticeStatus: "CONFIRMED",
  });

  assert.equal(first.find((result) => result.ruleKey === "CT_RETURN")?.dueDate, "2027-06-30");
  assert.equal(second.find((result) => result.ruleKey === "CT_RETURN")?.dueDate, "2027-06-30");
  assert.equal(first.find((result) => result.ruleKey === "CT_PAYMENT_STANDARD")?.dueDate, "2026-10-01");
  assert.equal(second.find((result) => result.ruleKey === "CT_PAYMENT_STANDARD")?.dueDate, "2027-04-01");
});

test("a period of account over 18 months applies the 30-month filing limb", () => {
  const periodOfAccount = { start: "2025-01-01", end: "2026-08-31" };
  const first = generateCorporationTaxObligations({
    accountingPeriod: { start: "2025-01-01", end: "2025-12-31" },
    periodOfAccount,
    noticeStatus: "CONFIRMED",
  });
  const second = generateCorporationTaxObligations({
    accountingPeriod: { start: "2026-01-01", end: "2026-08-31" },
    periodOfAccount,
    noticeStatus: "CONFIRMED",
  });

  assert.equal(first.find((result) => result.ruleKey === "CT_RETURN")?.dueDate, "2027-06-30");
  assert.equal(second.find((result) => result.ruleKey === "CT_RETURN")?.dueDate, "2027-08-31");
});

test("a late notice-served date can control the CT filing deadline", () => {
  const results = generateCorporationTaxObligations({
    accountingPeriod: { start: "2025-01-01", end: "2025-12-31" },
    periodOfAccount: { start: "2025-01-01", end: "2025-12-31" },
    noticeServedDate: "2027-01-15",
    noticeStatus: "CONFIRMED",
  });

  assert.equal(results.find((result) => result.ruleKey === "CT_RETURN")?.dueDate, "2027-04-15");
});

test("large-company QIPs use the four-date 12-month timetable", () => {
  const generated = generateQipObligations({
    accountingPeriod: { start: "2026-01-01", end: "2026-12-31" },
    taxableProfits: 2_000_000,
    estimatedTaxLiability: 500_000,
    associatedCompaniesIncludingSelf: 1,
    wasLargeInPreviousTwelveMonths: true,
  });

  assert.equal(generated.assessment.status, "LARGE");
  assert.deepEqual(generated.obligations.map((result) => result.dueDate), [
    "2026-07-14",
    "2026-10-14",
    "2027-01-14",
    "2027-04-14",
  ]);
  assert.ok(generated.obligations.every((result) => result.provenance.ruleKey === "CT_QIP_LARGE"));
});

test("large-company QIPs shorten to the dates strictly before the final date", () => {
  const eightMonths = generateQipObligations({
    accountingPeriod: { start: "2027-01-01", end: "2027-08-31" },
    taxableProfits: 1_200_000,
    estimatedTaxLiability: 200_000,
    associatedCompaniesIncludingSelf: 1,
    wasLargeInPreviousTwelveMonths: true,
  });
  const threeMonths = generateQipObligations({
    accountingPeriod: { start: "2027-01-01", end: "2027-03-31" },
    taxableProfits: 500_000,
    estimatedTaxLiability: 100_000,
    associatedCompaniesIncludingSelf: 1,
    wasLargeInPreviousTwelveMonths: true,
  });

  assert.deepEqual(eightMonths.obligations.map((result) => result.dueDate), [
    "2027-07-14",
    "2027-10-14",
    "2027-12-14",
  ]);
  assert.deepEqual(threeMonths.obligations.map((result) => result.dueDate), ["2027-07-14"]);
});

test("very-large QIPs use accelerated and statutory short-period dates", () => {
  const fullYear = generateQipObligations({
    accountingPeriod: { start: "2025-01-01", end: "2025-12-31" },
    taxableProfits: 21_000_000,
    estimatedTaxLiability: 5_000_000,
    associatedCompaniesIncludingSelf: 1,
    wasLargeInPreviousTwelveMonths: false,
  });
  const twoMonths = generateQipObligations({
    accountingPeriod: { start: "2027-01-01", end: "2027-02-28" },
    taxableProfits: 4_000_000,
    estimatedTaxLiability: 700_000,
    associatedCompaniesIncludingSelf: 1,
    wasLargeInPreviousTwelveMonths: false,
  });
  const fiveMonths = generateQipObligations({
    accountingPeriod: { start: "2030-01-01", end: "2030-05-30" },
    taxableProfits: 9_000_000,
    estimatedTaxLiability: 2_000_000,
    associatedCompaniesIncludingSelf: 1,
    wasLargeInPreviousTwelveMonths: false,
    confirmedStatus: "VERY_LARGE",
  });

  assert.deepEqual(fullYear.obligations.map((result) => result.dueDate), [
    "2025-03-14",
    "2025-06-14",
    "2025-09-14",
    "2025-12-14",
  ]);
  assert.deepEqual(twoMonths.obligations.map((result) => result.dueDate), ["2027-02-14"]);
  assert.deepEqual(fiveMonths.obligations.map((result) => result.dueDate), ["2030-03-14", "2030-05-14"]);
});

test("QIP thresholds are short-period and associated-company adjusted", () => {
  const assessment = assessQipStatus({
    accountingPeriod: { start: "2025-07-01", end: "2026-03-31" },
    taxableProfits: 300_000,
    estimatedTaxLiability: 60_000,
    associatedCompaniesIncludingSelf: 4,
    wasLargeInPreviousTwelveMonths: true,
  });

  assert.equal(assessment.adjustedLargeThreshold, 281_250);
  assert.equal(assessment.adjustedVeryLargeThreshold, 3_750_000);
  assert.equal(assessment.adjustedLiabilityDeMinimis, 7_500);
  assert.equal(assessment.status, "LARGE");
});

test("QIP uses strict boundaries, the liability de-minimis and first-period grace", () => {
  const exactVeryLargeBoundary = assessQipStatus({
    accountingPeriod: { start: "2025-01-01", end: "2025-12-31" },
    taxableProfits: 20_000_000,
    estimatedTaxLiability: 5_000_000,
    associatedCompaniesIncludingSelf: 1,
    wasLargeInPreviousTwelveMonths: true,
  });
  const exactDeMinimis = assessQipStatus({
    accountingPeriod: { start: "2025-01-01", end: "2025-06-30" },
    taxableProfits: 9_000_000,
    estimatedTaxLiability: 5_000,
    associatedCompaniesIncludingSelf: 1,
    wasLargeInPreviousTwelveMonths: true,
  });
  const grace = assessQipStatus({
    accountingPeriod: { start: "2025-01-01", end: "2025-12-31" },
    taxableProfits: 8_000_000,
    estimatedTaxLiability: 2_000_000,
    associatedCompaniesIncludingSelf: 1,
    wasLargeInPreviousTwelveMonths: false,
  });
  const noVeryLargeGrace = assessQipStatus({
    accountingPeriod: { start: "2025-01-01", end: "2025-12-31" },
    taxableProfits: 20_000_001,
    estimatedTaxLiability: 5_000_000,
    associatedCompaniesIncludingSelf: 1,
    wasLargeInPreviousTwelveMonths: false,
  });

  assert.equal(exactVeryLargeBoundary.status, "LARGE");
  assert.equal(exactDeMinimis.status, "STANDARD");
  assert.equal(grace.status, "STANDARD");
  assert.equal(noVeryLargeGrace.status, "VERY_LARGE");
});

test("special QIP regimes and irregular periods are review-only", () => {
  const special = generateQipObligations({
    accountingPeriod: { start: "2025-01-01", end: "2025-12-31" },
    taxableProfits: 30_000_000,
    estimatedTaxLiability: 7_000_000,
    associatedCompaniesIncludingSelf: 1,
    wasLargeInPreviousTwelveMonths: true,
    specialRegime: "RING_FENCE",
  });
  const irregular = generateQipObligations({
    accountingPeriod: { start: "2025-01-01", end: "2025-05-17" },
    taxableProfits: 2_000_000,
    estimatedTaxLiability: 500_000,
    associatedCompaniesIncludingSelf: 1,
    wasLargeInPreviousTwelveMonths: true,
  });

  assert.equal(special.assessment.status, "REVIEW_REQUIRED");
  assert.equal(special.obligations[0]?.blocksReadiness, true);
  assert.equal(irregular.assessment.status, "REVIEW_REQUIRED");
});
