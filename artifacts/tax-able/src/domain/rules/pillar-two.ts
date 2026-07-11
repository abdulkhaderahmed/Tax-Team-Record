import {
  addCalendarMonths,
  assertPeriod,
  compareDates,
  inclusiveDayCount,
  isOnOrAfter,
  latestDate,
} from "./date-math";
import { RULE_VERSIONS } from "./provenance";
import { resultFor, type DatePeriod, type GeneratedRuleResult, type RuleVersion, type WhyTrace } from "./types";

export interface PillarTwoPriorPeriod {
  period: DatePeriod;
  consolidatedRevenueEur: number;
}

export interface PillarTwoScopeInput {
  testedPeriod: DatePeriod;
  priorPeriods: readonly PillarTwoPriorPeriod[];
  hasUkEntity: boolean;
  mergerOrDemerger?: boolean;
}

export type PillarTwoScopeStatus = "QUALIFYING" | "NOT_QUALIFYING" | "REVIEW_REQUIRED";

export interface PillarTwoThresholdResult {
  period: DatePeriod;
  consolidatedRevenueEur: number;
  dayAdjustedThresholdEur: number;
  strictlyExceeds: boolean;
}

export interface PillarTwoScopeAssessment {
  status: PillarTwoScopeStatus;
  humanReviewRequired: boolean;
  provenance: RuleVersion;
  periodsExceedingThreshold: number;
  thresholdResults: readonly PillarTwoThresholdResult[];
  why: readonly WhyTrace[];
}

export interface PillarTwoInput extends PillarTwoScopeInput {
  reportingSequence: "FIRST" | "SUBSEQUENT";
  registrationAlreadyCompleted: boolean;
  registeredPreviously?: boolean;
  expectedToQualifyInNextTwoPeriods?: boolean;
  filingRoute: "UK_GIR" | "ORN";
  hasPaymentLiability: boolean;
}

export interface PillarTwoGeneration {
  assessment: PillarTwoScopeAssessment;
  obligations: readonly GeneratedRuleResult[];
}

function assertRevenue(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError("Pillar Two consolidated revenue must be a finite, non-negative number");
  }
}

export function pillarTwoRevenueThreshold(period: DatePeriod): number {
  return (750_000_000 * inclusiveDayCount(period)) / 365;
}

export function assessPillarTwoScope(input: PillarTwoScopeInput): PillarTwoScopeAssessment {
  assertPeriod(input.testedPeriod);
  input.priorPeriods.forEach(({ period, consolidatedRevenueEur }) => {
    assertPeriod(period);
    assertRevenue(consolidatedRevenueEur);
  });

  const thresholdResults = input.priorPeriods.map(({ period, consolidatedRevenueEur }) => {
    const dayAdjustedThresholdEur = pillarTwoRevenueThreshold(period);
    return {
      period,
      consolidatedRevenueEur,
      dayAdjustedThresholdEur,
      strictlyExceeds: consolidatedRevenueEur > dayAdjustedThresholdEur,
    };
  });
  const periodsExceedingThreshold = thresholdResults.filter((result) => result.strictlyExceeds).length;
  const baseWhy: WhyTrace[] = thresholdResults.map((result, index) => ({
    code: "PRIOR_PERIOD_THRESHOLD_TEST",
    message: "Compared consolidated revenue with the statutory day-adjusted threshold using a strict-greater-than test.",
    facts: {
      priorPeriod: index + 1,
      periodStart: result.period.start,
      periodEnd: result.period.end,
      consolidatedRevenueEur: result.consolidatedRevenueEur,
      dayAdjustedThresholdEur: result.dayAdjustedThresholdEur,
      strictlyExceeds: result.strictlyExceeds,
    },
  }));

  if (input.priorPeriods.length !== 4 || input.mergerOrDemerger) {
    return {
      status: "REVIEW_REQUIRED",
      humanReviewRequired: true,
      provenance: RULE_VERSIONS.PILLAR2_SCOPE,
      periodsExceedingThreshold,
      thresholdResults,
      why: [
        ...baseWhy,
        {
          code: input.mergerOrDemerger ? "MERGER_DEMERGER_RULES" : "INCOMPLETE_FOUR_PERIOD_HISTORY",
          message: input.mergerOrDemerger
            ? "A merger or demerger requires the specialist statutory scope rules."
            : "Exactly four prior accounting periods are required for the ordinary scope test.",
          facts: { priorPeriodCount: input.priorPeriods.length },
        },
      ],
    };
  }

  if (!isOnOrAfter(input.testedPeriod.start, "2023-12-31")) {
    return {
      status: "NOT_QUALIFYING",
      humanReviewRequired: false,
      provenance: RULE_VERSIONS.PILLAR2_SCOPE,
      periodsExceedingThreshold,
      thresholdResults,
      why: [
        ...baseWhy,
        {
          code: "PRE_COMMENCEMENT_PERIOD",
          message: "The tested accounting period began before the UK Pillar Two commencement date.",
          facts: { testedPeriodStart: input.testedPeriod.start },
        },
      ],
    };
  }

  if (!input.hasUkEntity) {
    return {
      status: "NOT_QUALIFYING",
      humanReviewRequired: false,
      provenance: RULE_VERSIONS.PILLAR2_SCOPE,
      periodsExceedingThreshold,
      thresholdResults,
      why: [
        ...baseWhy,
        {
          code: "NO_UK_ENTITY",
          message: "The input records no entity located in the UK.",
        },
      ],
    };
  }

  const qualifying = periodsExceedingThreshold >= 2;
  return {
    status: qualifying ? "QUALIFYING" : "NOT_QUALIFYING",
    humanReviewRequired: qualifying,
    provenance: RULE_VERSIONS.PILLAR2_SCOPE,
    periodsExceedingThreshold,
    thresholdResults,
    why: [
      ...baseWhy,
      {
        code: qualifying ? "TWO_OF_FOUR_EXCEEDED" : "TWO_OF_FOUR_NOT_MET",
        message: qualifying
          ? "Revenue strictly exceeded the adjusted threshold in at least two of the four prior periods and a UK entity is present."
          : "Revenue did not strictly exceed the adjusted threshold in at least two of the four prior periods.",
        facts: { periodsExceedingThreshold, hasUkEntity: input.hasUkEntity },
      },
    ],
  };
}

export function generatePillarTwoObligations(input: PillarTwoInput): PillarTwoGeneration {
  const assessment = assessPillarTwoScope(input);

  if (assessment.status === "REVIEW_REQUIRED") {
    return {
      assessment,
      obligations: [
        resultFor(RULE_VERSIONS.PILLAR2_SCOPE, {
          outcome: "REVIEW_REQUIRED",
          title: "Review UK Pillar Two scope",
          obligationType: "Scope review",
          period: input.testedPeriod,
          humanReviewRequired: true,
          blocksReadiness: true,
          why: assessment.why,
        }),
      ],
    };
  }

  if (assessment.status === "NOT_QUALIFYING") {
    const belowThresholdAvailable =
      input.registeredPreviously === true && input.expectedToQualifyInNextTwoPeriods === false;
    return {
      assessment,
      obligations: belowThresholdAvailable
        ? [
            resultFor(RULE_VERSIONS.PILLAR2_RETURN, {
              outcome: "OBLIGATION",
              title: "Submit Pillar Two below-threshold notification",
              obligationType: "Notification",
              period: input.testedPeriod,
              dueDate: latestDate(
                "2026-06-30",
                addCalendarMonths(input.testedPeriod.end, input.reportingSequence === "FIRST" ? 18 : 15),
              ),
              humanReviewRequired: true,
              blocksReadiness: true,
              why: [
                ...assessment.why,
                {
                  code: "BELOW_THRESHOLD_FORECAST",
                  message: "The group was previously registered and is recorded as unlikely to qualify in the next two periods; this forecast requires approval.",
                },
              ],
            }),
          ]
        : [],
    };
  }

  const firstPeriod = input.reportingSequence === "FIRST";
  const monthsAfterEnd = firstPeriod ? 18 : 15;
  const reportingDueDate = latestDate(
    "2026-06-30",
    addCalendarMonths(input.testedPeriod.end, monthsAfterEnd),
  );
  const obligations: GeneratedRuleResult[] = [];

  if (firstPeriod && !input.registrationAlreadyCompleted) {
    const registrationDueDate = addCalendarMonths(input.testedPeriod.end, 6);
    obligations.push(
      resultFor(RULE_VERSIONS.PILLAR2_REGISTRATION, {
        outcome: "OBLIGATION",
        title: "Register group for UK Pillar Two top-up taxes",
        obligationType: "Registration",
        dueDate: registrationDueDate,
        period: input.testedPeriod,
        humanReviewRequired: true,
        blocksReadiness: true,
        why: [
          ...assessment.why,
          {
            code: "FIRST_QUALIFYING_PERIOD",
            message: "This is the first qualifying period and no completed registration is recorded.",
            facts: { dueDate: registrationDueDate },
          },
        ],
      }),
    );
  }

  const routeNeedsReview = input.filingRoute === "ORN";
  obligations.push(
    resultFor(RULE_VERSIONS.PILLAR2_RETURN, {
      outcome: "OBLIGATION",
      title: input.filingRoute === "ORN"
        ? "Submit Pillar Two UK return and overseas return notification"
        : "Submit Pillar Two UK return and GloBE Information Return",
      obligationType: "Filing",
      dueDate: reportingDueDate,
      period: input.testedPeriod,
      humanReviewRequired: true,
      blocksReadiness: routeNeedsReview,
      why: [
        ...assessment.why,
        {
          code: firstPeriod ? "FIRST_PERIOD_18_MONTHS" : "SUBSEQUENT_PERIOD_15_MONTHS",
          message: firstPeriod
            ? "Applied the first-period 18-month deadline."
            : "Applied the subsequent-period 15-month deadline.",
          facts: { periodEnd: input.testedPeriod.end, dueDate: reportingDueDate },
        },
        {
          code: input.filingRoute === "ORN" ? "OVERSEAS_RETURN_NOTIFICATION" : "UK_GIR",
          message: input.filingRoute === "ORN"
            ? "The overseas GIR filing and exchange conditions must be evidenced before the ORN route is approved."
            : "The input selects a UK-filed GloBE Information Return alongside the UK self-assessment return.",
        },
      ],
      metadata: { filingRoute: input.filingRoute, reportingSequence: input.reportingSequence },
    }),
  );

  if (input.hasPaymentLiability) {
    obligations.push(
      resultFor(RULE_VERSIONS.PILLAR2_PAYMENT, {
        outcome: "OBLIGATION",
        title: "Pay UK Pillar Two top-up taxes",
        obligationType: "Payment",
        dueDate: reportingDueDate,
        period: input.testedPeriod,
        humanReviewRequired: true,
        blocksReadiness: false,
        why: [
          ...assessment.why,
          {
            code: firstPeriod ? "FIRST_PAYMENT_18_MONTHS" : "SUBSEQUENT_PAYMENT_15_MONTHS",
            message: "Applied the payment deadline for the reporting sequence and the 30 June 2026 transitional floor.",
            facts: { dueDate: reportingDueDate },
          },
        ],
      }),
    );
  }

  return { assessment, obligations };
}
