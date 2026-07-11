import {
  addCalendarMonths,
  addDays,
  assertPeriod,
  compareDates,
  exactPeriodMonths,
  latestDate,
} from "./date-math";
import { RULE_VERSIONS } from "./provenance";
import { resultFor, type DatePeriod, type GeneratedRuleResult, type RuleVersion, type WhyTrace } from "./types";

export interface CorporationTaxInput {
  accountingPeriod: DatePeriod;
  periodOfAccount: DatePeriod;
  noticeServedDate?: string;
  noticeStatus?: "CONFIRMED" | "EXPECTED";
  paymentMode?: "STANDARD" | "QIP";
}

export interface QipInput {
  accountingPeriod: DatePeriod;
  taxableProfits: number;
  estimatedTaxLiability: number;
  associatedCompaniesIncludingSelf: number;
  wasLargeInPreviousTwelveMonths: boolean;
  specialRegime?: "NONE" | "BANK_LEVY" | "RING_FENCE";
  confirmedStatus?: "LARGE" | "VERY_LARGE";
}

export type QipStatus = "STANDARD" | "LARGE" | "VERY_LARGE" | "REVIEW_REQUIRED";

export interface QipAssessment {
  status: QipStatus;
  humanReviewRequired: boolean;
  provenance: RuleVersion;
  accountingPeriodMonths: number | null;
  adjustedLargeThreshold?: number;
  adjustedVeryLargeThreshold?: number;
  adjustedFirstPeriodGraceThreshold?: number;
  adjustedLiabilityDeMinimis?: number;
  why: readonly WhyTrace[];
}

export interface QipGeneration {
  assessment: QipAssessment;
  obligations: readonly GeneratedRuleResult[];
}

function assertFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite, non-negative number`);
  }
}

function assertAccountingPeriodWithinPeriodOfAccount(accountingPeriod: DatePeriod, periodOfAccount: DatePeriod): void {
  assertPeriod(accountingPeriod);
  assertPeriod(periodOfAccount);
  if (
    compareDates(accountingPeriod.start, periodOfAccount.start) < 0 ||
    compareDates(accountingPeriod.end, periodOfAccount.end) > 0
  ) {
    throw new RangeError("The Corporation Tax accounting period must fall within the period of account");
  }
}

export function generateCorporationTaxObligations(input: CorporationTaxInput): readonly GeneratedRuleResult[] {
  assertAccountingPeriodWithinPeriodOfAccount(input.accountingPeriod, input.periodOfAccount);

  const apTwelveMonthDate = addCalendarMonths(input.accountingPeriod.end, 12);
  const eighteenMonthPeriodEnd = addDays(addCalendarMonths(input.periodOfAccount.start, 18), -1);
  const isPeriodOfAccountAtMostEighteenMonths =
    compareDates(input.periodOfAccount.end, eighteenMonthPeriodEnd) <= 0;
  const periodOfAccountDate = isPeriodOfAccountAtMostEighteenMonths
    ? addCalendarMonths(input.periodOfAccount.end, 12)
    : addDays(addCalendarMonths(input.periodOfAccount.start, 30), -1);
  const noticeDate = input.noticeServedDate
    ? addCalendarMonths(input.noticeServedDate, 3)
    : undefined;
  const filingDueDate = latestDate(apTwelveMonthDate, periodOfAccountDate, noticeDate);
  const noticeStatus = input.noticeStatus ?? (input.noticeServedDate ? "CONFIRMED" : "EXPECTED");

  const filingWhy: WhyTrace[] = [
    {
      code: "AP_12_MONTH_LIMB",
      message: "Calculated the date twelve months after the Corporation Tax accounting-period end.",
      facts: { accountingPeriodEnd: input.accountingPeriod.end, candidateDate: apTwelveMonthDate },
    },
    {
      code: isPeriodOfAccountAtMostEighteenMonths ? "POA_AT_MOST_18_MONTHS" : "POA_OVER_18_MONTHS",
      message: isPeriodOfAccountAtMostEighteenMonths
        ? "Applied the twelve-month period-of-account filing limb."
        : "Applied the thirty-month period beginning with the period-of-account start.",
      facts: {
        periodOfAccountStart: input.periodOfAccount.start,
        periodOfAccountEnd: input.periodOfAccount.end,
        candidateDate: periodOfAccountDate,
      },
    },
  ];

  if (noticeDate) {
    filingWhy.push({
      code: "NOTICE_3_MONTH_LIMB",
      message: "Included the three-month period following service of the notice to deliver.",
      facts: { noticeServedDate: input.noticeServedDate ?? null, candidateDate: noticeDate },
    });
  } else {
    filingWhy.push({
      code: "NOTICE_DATE_UNCONFIRMED",
      message: "No notice-served date was supplied; the calculated filing date must be checked against the actual notice.",
    });
  }

  filingWhy.push({
    code: "LATEST_DATE_CONTROLS",
    message: "Selected the latest applicable statutory filing-date limb.",
    facts: { dueDate: filingDueDate },
  });

  const results: GeneratedRuleResult[] = [
    resultFor(RULE_VERSIONS.CT_RETURN, {
      outcome: "OBLIGATION",
      title: "File Company Tax Return (CT600)",
      obligationType: "Filing",
      dueDate: filingDueDate,
      period: input.accountingPeriod,
      humanReviewRequired: noticeStatus !== "CONFIRMED",
      blocksReadiness: noticeStatus !== "CONFIRMED",
      why: filingWhy,
      metadata: {
        periodOfAccountStart: input.periodOfAccount.start,
        periodOfAccountEnd: input.periodOfAccount.end,
        noticeStatus,
      },
    }),
  ];

  if ((input.paymentMode ?? "STANDARD") === "STANDARD") {
    const paymentDueDate = addDays(addCalendarMonths(input.accountingPeriod.end, 9), 1);
    results.push(
      resultFor(RULE_VERSIONS.CT_PAYMENT_STANDARD, {
        outcome: "OBLIGATION",
        title: "Pay Corporation Tax (non-QIP)",
        obligationType: "Payment",
        dueDate: paymentDueDate,
        period: input.accountingPeriod,
        humanReviewRequired: false,
        blocksReadiness: false,
        why: [
          {
            code: "NON_QIP_PAYMENT",
            message: "The input identifies the period as a standard, non-instalment payment period.",
          },
          {
            code: "NINE_MONTHS_AND_ONE_DAY",
            message: "Calculated nine calendar months and one day after the accounting-period end.",
            facts: { accountingPeriodEnd: input.accountingPeriod.end, dueDate: paymentDueDate },
          },
        ],
      }),
    );
  }

  return results;
}

export function assessQipStatus(input: QipInput): QipAssessment {
  assertPeriod(input.accountingPeriod);
  assertFiniteNonNegative(input.taxableProfits, "taxableProfits");
  assertFiniteNonNegative(input.estimatedTaxLiability, "estimatedTaxLiability");
  if (!Number.isInteger(input.associatedCompaniesIncludingSelf) || input.associatedCompaniesIncludingSelf < 1) {
    throw new RangeError("associatedCompaniesIncludingSelf must be a positive integer");
  }

  const periodMonths = exactPeriodMonths(input.accountingPeriod, 12);
  const baseWhy: WhyTrace[] = [
    {
      code: "QIP_INPUTS",
      message: "Assessed QIP status using profits, estimated liability, associated companies and prior large-company status.",
      facts: {
        taxableProfits: input.taxableProfits,
        estimatedTaxLiability: input.estimatedTaxLiability,
        associatedCompaniesIncludingSelf: input.associatedCompaniesIncludingSelf,
        wasLargeInPreviousTwelveMonths: input.wasLargeInPreviousTwelveMonths,
      },
    },
  ];

  if ((input.specialRegime ?? "NONE") !== "NONE") {
    return {
      status: "REVIEW_REQUIRED",
      humanReviewRequired: true,
      provenance: RULE_VERSIONS.CT_QIP_LARGE,
      accountingPeriodMonths: periodMonths,
      why: [
        ...baseWhy,
        {
          code: "SPECIAL_QIP_REGIME",
          message: "Bank levy and ring-fence liabilities do not use the generic QIP schedule.",
          facts: { specialRegime: input.specialRegime ?? "NONE" },
        },
      ],
    };
  }

  if (input.confirmedStatus) {
    const provenance = input.confirmedStatus === "LARGE"
      ? RULE_VERSIONS.CT_QIP_LARGE
      : RULE_VERSIONS.CT_QIP_VERY_LARGE;
    return {
      status: input.confirmedStatus,
      humanReviewRequired: true,
      provenance,
      accountingPeriodMonths: null,
      why: [
        ...baseWhy,
        {
          code: "TAX_OWNER_CONFIRMED_QIP_STATUS",
          message: "The tax owner confirmed QIP status; the engine applies the deterministic date schedule and retains the classification as a reviewable judgement.",
          facts: { confirmedStatus: input.confirmedStatus },
        },
      ],
    };
  }

  if (periodMonths === null) {
    return {
      status: "REVIEW_REQUIRED",
      humanReviewRequired: true,
      provenance: RULE_VERSIONS.CT_QIP_LARGE,
      accountingPeriodMonths: null,
      why: [
        ...baseWhy,
        {
          code: "IRREGULAR_SHORT_PERIOD",
          message: "The accounting period is not an exact whole-calendar-month period; its statutory proportion requires tax-owner review.",
        },
      ],
    };
  }

  const shortPeriodProportion = periodMonths / 12;
  const companyCount = input.associatedCompaniesIncludingSelf;
  const adjustedLargeThreshold = (1_500_000 * shortPeriodProportion) / companyCount;
  const adjustedVeryLargeThreshold = (20_000_000 * shortPeriodProportion) / companyCount;
  const adjustedFirstPeriodGraceThreshold = (10_000_000 * shortPeriodProportion) / companyCount;
  const adjustedLiabilityDeMinimis = 10_000 * shortPeriodProportion;
  const thresholdWhy: WhyTrace = {
    code: "ADJUSTED_THRESHOLDS",
    message: "Reduced the profit thresholds for the short period and associated-company count; reduced the liability de-minimis for the short period only.",
    facts: {
      accountingPeriodMonths: periodMonths,
      adjustedLargeThreshold,
      adjustedVeryLargeThreshold,
      adjustedFirstPeriodGraceThreshold,
      adjustedLiabilityDeMinimis,
    },
  };
  const common = {
    accountingPeriodMonths: periodMonths,
    adjustedLargeThreshold,
    adjustedVeryLargeThreshold,
    adjustedFirstPeriodGraceThreshold,
    adjustedLiabilityDeMinimis,
  };

  if (input.estimatedTaxLiability <= adjustedLiabilityDeMinimis) {
    return {
      ...common,
      status: "STANDARD",
      humanReviewRequired: false,
      provenance: RULE_VERSIONS.CT_QIP_LARGE,
      why: [
        ...baseWhy,
        thresholdWhy,
        {
          code: "LIABILITY_DE_MINIMIS",
          message: "Estimated liability does not exceed the adjusted £10,000 de-minimis, so QIPs do not apply.",
        },
      ],
    };
  }

  if (input.taxableProfits > adjustedVeryLargeThreshold) {
    return {
      ...common,
      status: "VERY_LARGE",
      humanReviewRequired: true,
      provenance: RULE_VERSIONS.CT_QIP_VERY_LARGE,
      why: [
        ...baseWhy,
        thresholdWhy,
        {
          code: "VERY_LARGE_THRESHOLD_EXCEEDED",
          message: "Taxable profits strictly exceed the adjusted £20 million threshold; no first-period grace applies.",
        },
      ],
    };
  }

  if (input.taxableProfits <= adjustedLargeThreshold) {
    return {
      ...common,
      status: "STANDARD",
      humanReviewRequired: false,
      provenance: RULE_VERSIONS.CT_QIP_LARGE,
      why: [
        ...baseWhy,
        thresholdWhy,
        {
          code: "LARGE_THRESHOLD_NOT_EXCEEDED",
          message: "Taxable profits do not strictly exceed the adjusted £1.5 million threshold.",
        },
      ],
    };
  }

  if (!input.wasLargeInPreviousTwelveMonths && input.taxableProfits <= adjustedFirstPeriodGraceThreshold) {
    return {
      ...common,
      status: "STANDARD",
      humanReviewRequired: true,
      provenance: RULE_VERSIONS.CT_QIP_LARGE,
      why: [
        ...baseWhy,
        thresholdWhy,
        {
          code: "FIRST_PERIOD_GRACE",
          message: "The company was not large in the preceding twelve months and profits do not exceed the adjusted £10 million grace threshold.",
        },
      ],
    };
  }

  return {
    ...common,
    status: "LARGE",
    humanReviewRequired: true,
    provenance: RULE_VERSIONS.CT_QIP_LARGE,
    why: [
      ...baseWhy,
      thresholdWhy,
      {
        code: "LARGE_QIP_APPLIES",
        message: "Taxable profits exceed the adjusted large-company threshold, liability exceeds the de-minimis, and grace does not apply.",
      },
    ],
  };
}

function largeCompanyDates(period: DatePeriod): string[] {
  const finalDate = addDays(addCalendarMonths(period.end, 3), 14);
  const firstDate = addDays(addCalendarMonths(period.start, 6), 13);
  const candidates = [
    firstDate,
    addCalendarMonths(firstDate, 3),
    addCalendarMonths(firstDate, 6),
  ];
  return [...candidates.filter((date) => compareDates(date, finalDate) < 0), finalDate];
}

function veryLargeCompanyFinalDate(period: DatePeriod): string {
  const statutoryDate = addDays(addCalendarMonths(period.end, -1), 14);
  return compareDates(statutoryDate, period.start) < 0 ? period.end : statutoryDate;
}

function veryLargeCompanyDates(period: DatePeriod, periodMonths: number | null): string[] {
  const firstDate = addDays(addCalendarMonths(period.start, 2), 13);
  if (periodMonths === 12) {
    return [
      firstDate,
      addCalendarMonths(firstDate, 3),
      addCalendarMonths(firstDate, 6),
      addCalendarMonths(firstDate, 9),
    ];
  }

  const finalDate = veryLargeCompanyFinalDate(period);
  const candidates = [
    firstDate,
    addCalendarMonths(firstDate, 3),
    addCalendarMonths(firstDate, 6),
  ];
  return [...candidates.filter((date) => compareDates(date, finalDate) < 0), finalDate];
}

export function generateQipObligations(input: QipInput): QipGeneration {
  const assessment = assessQipStatus(input);

  if (assessment.status === "STANDARD") {
    return { assessment, obligations: [] };
  }

  if (assessment.status === "REVIEW_REQUIRED") {
    return {
      assessment,
      obligations: [
        resultFor(assessment.provenance, {
          outcome: "REVIEW_REQUIRED",
          title: "Review Corporation Tax instalment-payment treatment",
          obligationType: "Review",
          period: input.accountingPeriod,
          humanReviewRequired: true,
          blocksReadiness: true,
          why: assessment.why,
        }),
      ],
    };
  }

  const dates = assessment.status === "LARGE"
    ? largeCompanyDates(input.accountingPeriod)
    : veryLargeCompanyDates(input.accountingPeriod, assessment.accountingPeriodMonths);

  return {
    assessment,
    obligations: dates.map((dueDate, index) =>
      resultFor(assessment.provenance, {
        outcome: "OBLIGATION",
        title: `Corporation Tax QIP instalment ${index + 1} of ${dates.length}`,
        obligationType: "Payment",
        dueDate,
        period: input.accountingPeriod,
        humanReviewRequired: true,
        blocksReadiness: false,
        why: [
          ...assessment.why,
          {
            code: "INSTALMENT_DATE",
            message: "Applied the controlled instalment timetable for the confirmed QIP classification.",
            facts: { instalment: index + 1, instalmentCount: dates.length, dueDate },
          },
        ],
        metadata: {
          qipStatus: assessment.status,
          instalmentNumber: index + 1,
          instalmentCount: dates.length,
        },
      }),
    ),
  };
}
