import {
  addCalendarMonths,
  addDays,
  assertInstant,
  assertPeriod,
  compareDates,
  isOnOrAfter,
  isOnOrBefore,
} from "./date-math";
import { RULE_VERSIONS } from "./provenance";
import {
  resultFor,
  type DatePeriod,
  type GeneratedRuleResult,
  type ISODate,
  type ISOInstant,
  type WhyTrace,
} from "./types";

export interface PriorRndClaim {
  accountingPeriodStart: ISODate;
  madeDate: ISODate;
  valid: boolean;
  removedByHmrc?: boolean;
  madeByAmendment?: boolean;
}

export type RndClaimKind =
  | "NEW"
  | "AMEND_SAME_VALID_CLAIM"
  | "ADDITIONAL_SCHEME"
  | "REMADE_AFTER_WITHDRAWAL";

export interface RndInput {
  accountingPeriod: DatePeriod;
  periodOfAccount: DatePeriod;
  claimIntended: boolean;
  claimSubmittedAt: ISOInstant;
  aifSubmittedAt?: ISOInstant;
  claimKind?: RndClaimKind;
  materialAmendment?: boolean;
  priorClaims?: readonly PriorRndClaim[];
  samePeriodOfAccountClaimOrNotification?: boolean;
}

function instantDate(value: ISOInstant): ISODate {
  assertInstant(value);
  return new Date(value).toISOString().slice(0, 10);
}

function assertAccountingPeriodWithinPeriodOfAccount(accountingPeriod: DatePeriod, periodOfAccount: DatePeriod): void {
  assertPeriod(accountingPeriod);
  assertPeriod(periodOfAccount);
  if (
    compareDates(accountingPeriod.start, periodOfAccount.start) < 0 ||
    compareDates(accountingPeriod.end, periodOfAccount.end) > 0
  ) {
    throw new RangeError("The R&D accounting period must fall within the period of account");
  }
}

function qualifyingPriorClaim(
  priorClaims: readonly PriorRndClaim[],
  lookbackStart: ISODate,
  lookbackEnd: ISODate,
): PriorRndClaim | undefined {
  return priorClaims.find((claim) => {
    const ignoredLegacyAmendment =
      compareDates(claim.accountingPeriodStart, "2023-04-01") < 0 &&
      claim.madeByAmendment === true &&
      isOnOrAfter(claim.madeDate, "2023-04-01");

    return (
      claim.valid &&
      !claim.removedByHmrc &&
      !ignoredLegacyAmendment &&
      isOnOrAfter(claim.madeDate, lookbackStart) &&
      isOnOrBefore(claim.madeDate, lookbackEnd)
    );
  });
}

export function generateRndObligations(input: RndInput): readonly GeneratedRuleResult[] {
  assertAccountingPeriodWithinPeriodOfAccount(input.accountingPeriod, input.periodOfAccount);
  const claimDate = instantDate(input.claimSubmittedAt);

  if (!input.claimIntended) {
    return [];
  }

  const results: GeneratedRuleResult[] = [];
  const notificationEnd = addCalendarMonths(input.periodOfAccount.end, 6);
  const lookbackStart = addDays(addCalendarMonths(notificationEnd, -36), 1);
  const priorClaim = qualifyingPriorClaim(input.priorClaims ?? [], lookbackStart, notificationEnd);
  const apWithinNotificationRegime = isOnOrAfter(input.accountingPeriod.start, "2023-04-01");
  const claimFiledWithinWindow = isOnOrBefore(claimDate, notificationEnd);
  const samePoaSatisfied = input.samePeriodOfAccountClaimOrNotification === true;

  const notificationWhy: WhyTrace[] = [
    {
      code: "NOTIFICATION_WINDOW",
      message: "Calculated the claim-notification deadline six months after the period-of-account end and the associated three-year lookback.",
      facts: {
        periodOfAccountEnd: input.periodOfAccount.end,
        notificationDeadline: notificationEnd,
        lookbackStart,
        lookbackEnd: notificationEnd,
      },
    },
  ];

  if (!apWithinNotificationRegime) {
    notificationWhy.push({
      code: "PRE_NOTIFICATION_REGIME_AP",
      message: "The accounting period began before 1 April 2023, so claim notification does not apply.",
    });
  } else if (priorClaim) {
    notificationWhy.push({
      code: "QUALIFYING_PRIOR_CLAIM",
      message: "A valid, non-excluded prior claim falls within the statutory three-year lookback.",
      facts: { priorClaimMadeDate: priorClaim.madeDate },
    });
  } else if (samePoaSatisfied) {
    notificationWhy.push({
      code: "SAME_POA_SATISFIED",
      message: "Another accounting period in the same period of account has a claim or notification satisfying the condition.",
    });
  } else if (claimFiledWithinWindow) {
    notificationWhy.push({
      code: "CLAIM_FILED_WITHIN_NOTIFICATION_WINDOW",
      message: "The R&D claim itself is scheduled to be filed by the notification deadline, so a separate notification is not required.",
      facts: { claimDate },
    });
  }

  const notificationRequired =
    apWithinNotificationRegime && !priorClaim && !samePoaSatisfied && !claimFiledWithinWindow;
  results.push(
    resultFor(RULE_VERSIONS.RD_NOTIFICATION, {
      outcome: notificationRequired ? "OBLIGATION" : "NOT_APPLICABLE",
      title: notificationRequired ? "Submit R&D claim notification" : "R&D claim notification not required",
      obligationType: "Notification",
      dueDate: notificationRequired ? notificationEnd : undefined,
      period: input.accountingPeriod,
      humanReviewRequired: notificationRequired,
      blocksReadiness: notificationRequired,
      why: notificationRequired
        ? [
            ...notificationWhy,
            {
              code: "NOTIFICATION_REQUIRED",
              message: "No qualifying prior claim or same-period-of-account condition applies, and the claim will not be filed within the notification window.",
            },
          ]
        : notificationWhy,
    }),
  );

  const claimKind = input.claimKind ?? "NEW";
  const sameValidClaimAmendment = claimKind === "AMEND_SAME_VALID_CLAIM";
  const aifDateRegimeApplies = isOnOrAfter(claimDate, "2023-08-08");

  if (!aifDateRegimeApplies || sameValidClaimAmendment) {
    const why: WhyTrace[] = sameValidClaimAmendment
      ? [
          {
            code: "SAME_VALID_CLAIM_AMENDMENT",
            message: "A fresh AIF is not ordinarily mandatory for an amendment to the same claim already supported by a valid AIF.",
            facts: { materialAmendment: input.materialAmendment ?? false },
          },
        ]
      : [
          {
            code: "PRE_AIF_EFFECTIVE_DATE",
            message: "The claim was made before 8 August 2023, so the AIF requirement does not apply.",
            facts: { claimDate },
          },
        ];

    results.push(
      resultFor(RULE_VERSIONS.RD_AIF, {
        outcome: input.materialAmendment ? "IMPACT_REVIEW" : "NOT_APPLICABLE",
        title: input.materialAmendment ? "Review whether amended R&D claim needs refreshed AIF support" : "Fresh R&D AIF not required",
        obligationType: "Pre-filing form",
        period: input.accountingPeriod,
        humanReviewRequired: input.materialAmendment ?? false,
        blocksReadiness: false,
        why,
      }),
    );
    return results;
  }

  const aifSubmittedAt = input.aifSubmittedAt;
  const orderingSatisfied = aifSubmittedAt
    ? assertInstant(aifSubmittedAt) < assertInstant(input.claimSubmittedAt)
    : false;
  const requiresFreshAif =
    claimKind === "NEW" || claimKind === "ADDITIONAL_SCHEME" || claimKind === "REMADE_AFTER_WITHDRAWAL";
  const aifWhy: WhyTrace[] = [
    {
      code: "AIF_EFFECTIVE_DATE",
      message: "The claim is made on or after 8 August 2023 and requires an AIF for this accounting period and claim.",
      facts: { claimDate, claimKind },
    },
    {
      code: "AIF_BEFORE_CT600",
      message: "The AIF must be received before the CT600 claim; on the same calendar day, its submission must still occur first.",
      facts: {
        claimSubmittedAt: input.claimSubmittedAt,
        aifSubmittedAt: aifSubmittedAt ?? null,
      },
    },
  ];

  if (!requiresFreshAif) {
    throw new RangeError(`Unsupported R&D claim kind: ${claimKind}`);
  }

  results.push(
    resultFor(RULE_VERSIONS.RD_AIF, {
      outcome: aifSubmittedAt && !orderingSatisfied ? "REVIEW_REQUIRED" : "OBLIGATION",
      title: "Submit R&D Additional Information Form before CT600",
      obligationType: "Pre-filing form",
      dueDate: claimDate,
      period: input.accountingPeriod,
      humanReviewRequired: !orderingSatisfied,
      blocksReadiness: !orderingSatisfied,
      why: aifSubmittedAt && !orderingSatisfied
        ? [
            ...aifWhy,
            {
              code: "AIF_ORDERING_FAILED",
              message: "Recorded submission evidence shows that the AIF did not precede the CT600 claim.",
            },
          ]
        : aifWhy,
      metadata: {
        mustPrecede: "CT_RETURN",
        orderingSatisfied,
      },
    }),
  );

  return results;
}
