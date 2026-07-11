import assert from "node:assert/strict";
import test from "node:test";

import {
  generateP11dObligations,
  generatePsaObligations,
  generateRndObligations,
} from "../../src/domain/rules/index";

test("an enduring PSA creates annual calculation and payment work but no renewal", () => {
  const results = generatePsaObligations({
    taxYearEnd: "2026-04-05",
    agreementStatus: "ENDURING",
    electronicPayment: true,
  });

  assert.deepEqual(results.map((result) => result.ruleKey), ["PSA_CALCULATION", "PSA_PAYMENT"]);
  assert.deepEqual(results.map((result) => result.dueDate), ["2026-07-31", "2026-10-22"]);
  assert.ok(results[0]?.why.some((step) => step.code === "ENDURING_AGREEMENT"));
});

test("new and amended PSAs create a 5 July controlled agreement obligation", () => {
  const newAgreement = generatePsaObligations({
    taxYearEnd: "2026-04-05",
    agreementStatus: "NEW_REQUIRED",
    electronicPayment: false,
  });
  const amendment = generatePsaObligations({
    taxYearEnd: "2026-04-05",
    agreementStatus: "AMENDMENT_REQUIRED",
    electronicPayment: false,
  });

  assert.equal(newAgreement[0]?.ruleKey, "PSA_AGREEMENT");
  assert.equal(newAgreement[0]?.dueDate, "2026-07-05");
  assert.equal(newAgreement.at(-1)?.dueDate, "2026-10-19");
  assert.ok(amendment[0]?.why.some((step) => step.code === "PSA_AMENDMENT_REQUIRED"));
});

test("current P11D facts generate employee, employer and payment obligations", () => {
  const results = generateP11dObligations({
    taxYearEnd: "2026-04-05",
    hasNonPayrolledReportableBenefits: true,
    hasPayrolledBenefits: false,
    hasClass1ALiability: true,
    hmrcNoticeToFile: false,
    electronicPayment: true,
  });

  assert.deepEqual(results.map((result) => result.dueDate), ["2026-07-06", "2026-07-06", "2026-07-22"]);
  assert.ok(results.every((result) => result.provenance.sources.length > 0));
});

test("all-payrolled benefits suppress employee P11Ds but retain P11D(b)", () => {
  const results = generateP11dObligations({
    taxYearEnd: "2027-04-05",
    hasNonPayrolledReportableBenefits: false,
    hasPayrolledBenefits: true,
    hasClass1ALiability: true,
    hmrcNoticeToFile: false,
    electronicPayment: true,
  });

  assert.equal(results.some((result) => result.title.includes("employee P11D")), false);
  assert.equal(results.some((result) => result.title.includes("P11D(b)")), true);
});

test("nil P11D(b) work is created only when HMRC has requested it", () => {
  const noNotice = generateP11dObligations({
    taxYearEnd: "2026-04-05",
    hasNonPayrolledReportableBenefits: false,
    hasPayrolledBenefits: false,
    hasClass1ALiability: false,
    hmrcNoticeToFile: false,
    electronicPayment: true,
  });
  const notice = generateP11dObligations({
    taxYearEnd: "2026-04-05",
    hasNonPayrolledReportableBenefits: false,
    hasPayrolledBenefits: false,
    hasClass1ALiability: false,
    hmrcNoticeToFile: true,
    electronicPayment: true,
  });

  assert.equal(noNotice.length, 0);
  assert.equal(notice[0]?.title, "Submit nil Class 1A declaration");
});

test("2027/28 P11D transition remains impact-only", () => {
  const results = generateP11dObligations({
    taxYearEnd: "2028-04-05",
    hasNonPayrolledReportableBenefits: true,
    hasPayrolledBenefits: false,
    hasClass1ALiability: true,
    hmrcNoticeToFile: false,
    electronicPayment: true,
  });

  assert.equal(results.length, 1);
  assert.equal(results[0]?.ruleKey, "P11D_TRANSITION_2027");
  assert.equal(results[0]?.outcome, "IMPACT_REVIEW");
  assert.equal(results[0]?.applicabilityDate, "2027-04-06");
  assert.equal(results[0]?.dueDate, "2027-04-05");
  assert.equal(results[0]?.blocksReadiness, true);
  assert.equal(results[0]?.provenance.legalStatus, "INTERIM_DRAFT");
});

const calendar2025Rnd = {
  accountingPeriod: { start: "2025-01-01", end: "2025-12-31" },
  periodOfAccount: { start: "2025-01-01", end: "2025-12-31" },
  claimIntended: true,
  claimSubmittedAt: "2026-12-01T12:00:00.000Z",
  aifSubmittedAt: "2026-11-30T12:00:00.000Z",
} as const;

test("first R&D claimant receives the six-month notification and AIF gate", () => {
  const results = generateRndObligations(calendar2025Rnd);
  const notification = results.find((result) => result.ruleKey === "RD_NOTIFICATION");
  const aif = results.find((result) => result.ruleKey === "RD_AIF");

  assert.equal(notification?.outcome, "OBLIGATION");
  assert.equal(notification?.dueDate, "2026-06-30");
  assert.equal(aif?.outcome, "OBLIGATION");
  assert.equal(aif?.blocksReadiness, false);
  assert.equal(aif?.metadata?.orderingSatisfied, true);
});

test("R&D prior-claim three-year lookback has an exact boundary", () => {
  const inside = generateRndObligations({
    ...calendar2025Rnd,
    priorClaims: [{ accountingPeriodStart: "2023-01-01", madeDate: "2023-07-01", valid: true }],
  });
  const outside = generateRndObligations({
    ...calendar2025Rnd,
    priorClaims: [{ accountingPeriodStart: "2023-01-01", madeDate: "2023-06-30", valid: true }],
  });

  assert.equal(inside.find((result) => result.ruleKey === "RD_NOTIFICATION")?.outcome, "NOT_APPLICABLE");
  assert.equal(outside.find((result) => result.ruleKey === "RD_NOTIFICATION")?.outcome, "OBLIGATION");
});

test("a legacy-period claim added by post-April-2023 amendment is ignored", () => {
  const results = generateRndObligations({
    ...calendar2025Rnd,
    priorClaims: [
      {
        accountingPeriodStart: "2022-01-01",
        madeDate: "2024-01-15",
        valid: true,
        madeByAmendment: true,
      },
    ],
  });

  assert.equal(results.find((result) => result.ruleKey === "RD_NOTIFICATION")?.outcome, "OBLIGATION");
});

test("one same-period-of-account claim or notification satisfies the long-period notification condition", () => {
  const common = {
    periodOfAccount: { start: "2025-01-01", end: "2026-06-30" },
    claimIntended: true,
    claimSubmittedAt: "2027-05-01T12:00:00.000Z",
    aifSubmittedAt: "2027-04-30T12:00:00.000Z",
    samePeriodOfAccountClaimOrNotification: true,
  } as const;
  const first = generateRndObligations({
    ...common,
    accountingPeriod: { start: "2025-01-01", end: "2025-12-31" },
  });
  const second = generateRndObligations({
    ...common,
    accountingPeriod: { start: "2026-01-01", end: "2026-06-30" },
  });

  assert.equal(first.find((result) => result.ruleKey === "RD_NOTIFICATION")?.outcome, "NOT_APPLICABLE");
  assert.equal(second.find((result) => result.ruleKey === "RD_NOTIFICATION")?.outcome, "NOT_APPLICABLE");
  assert.equal(first.find((result) => result.ruleKey === "RD_AIF")?.outcome, "OBLIGATION");
  assert.equal(second.find((result) => result.ruleKey === "RD_AIF")?.outcome, "OBLIGATION");
});

test("AIF must precede CT600 even when both are submitted on the same day", () => {
  const valid = generateRndObligations({
    ...calendar2025Rnd,
    claimSubmittedAt: "2026-12-01T15:00:00.000Z",
    aifSubmittedAt: "2026-12-01T14:59:59.000Z",
  });
  const invalid = generateRndObligations({
    ...calendar2025Rnd,
    claimSubmittedAt: "2026-12-01T15:00:00.000Z",
    aifSubmittedAt: "2026-12-01T15:00:01.000Z",
  });

  assert.equal(valid.find((result) => result.ruleKey === "RD_AIF")?.blocksReadiness, false);
  assert.equal(invalid.find((result) => result.ruleKey === "RD_AIF")?.outcome, "REVIEW_REQUIRED");
  assert.equal(invalid.find((result) => result.ruleKey === "RD_AIF")?.blocksReadiness, true);
});

test("AIF and notification have independent effective-date tests", () => {
  const results = generateRndObligations({
    accountingPeriod: { start: "2022-01-01", end: "2022-12-31" },
    periodOfAccount: { start: "2022-01-01", end: "2022-12-31" },
    claimIntended: true,
    claimSubmittedAt: "2023-08-08T12:00:00.000Z",
    aifSubmittedAt: "2023-08-08T11:00:00.000Z",
  });

  assert.equal(results.find((result) => result.ruleKey === "RD_NOTIFICATION")?.outcome, "NOT_APPLICABLE");
  assert.equal(results.find((result) => result.ruleKey === "RD_AIF")?.outcome, "OBLIGATION");
});

test("same valid R&D claim amendment does not automatically require a fresh AIF", () => {
  const results = generateRndObligations({
    ...calendar2025Rnd,
    claimKind: "AMEND_SAME_VALID_CLAIM",
  });

  assert.equal(results.find((result) => result.ruleKey === "RD_AIF")?.outcome, "NOT_APPLICABLE");
});
