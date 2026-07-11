import { compareDates } from "./date-math";
import { RULE_VERSIONS } from "./provenance";
import { resultFor, type GeneratedRuleResult, type ISODate, type WhyTrace } from "./types";

export type PsaAgreementStatus = "NONE" | "ENDURING" | "NEW_REQUIRED" | "AMENDMENT_REQUIRED";

export interface PsaInput {
  taxYearEnd: ISODate;
  agreementStatus: PsaAgreementStatus;
  electronicPayment: boolean;
}

export interface P11dInput {
  taxYearEnd: ISODate;
  hasNonPayrolledReportableBenefits: boolean;
  hasPayrolledBenefits: boolean;
  hasClass1ALiability: boolean;
  hmrcNoticeToFile: boolean;
  electronicPayment: boolean;
}

function taxYearEndYear(value: ISODate): number {
  const match = /^(\d{4})-04-05$/.exec(value);
  if (!match) {
    throw new RangeError(`Expected a UK tax-year end on 5 April, received: ${value}`);
  }
  return Number(match[1]);
}

function annualDate(year: number, month: number, day: number): ISODate {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function generatePsaObligations(input: PsaInput): readonly GeneratedRuleResult[] {
  const year = taxYearEndYear(input.taxYearEnd);
  if (input.agreementStatus === "NONE") {
    return [];
  }

  const results: GeneratedRuleResult[] = [];
  if (input.agreementStatus === "NEW_REQUIRED" || input.agreementStatus === "AMENDMENT_REQUIRED") {
    const dueDate = annualDate(year, 7, 5);
    const isAmendment = input.agreementStatus === "AMENDMENT_REQUIRED";
    results.push(
      resultFor(RULE_VERSIONS.PSA_AGREEMENT, {
        outcome: "OBLIGATION",
        title: isAmendment ? "Amend enduring PAYE Settlement Agreement" : "Put PAYE Settlement Agreement in place",
        obligationType: "Agreement",
        dueDate,
        humanReviewRequired: true,
        blocksReadiness: true,
        why: [
          {
            code: isAmendment ? "PSA_AMENDMENT_REQUIRED" : "PSA_NOT_IN_PLACE",
            message: isAmendment
              ? "The recorded enduring agreement needs a scope change; the replacement must repeat retained items."
              : "No enduring agreement is recorded for the intended PSA treatment.",
            facts: { taxYearEnd: input.taxYearEnd },
          },
          {
            code: "BEFORE_6_JULY",
            message: "An agreement or variation must be completed before 6 July following the relevant tax year.",
            facts: { dueDate },
          },
        ],
      }),
    );
  }

  const enduringWhy: WhyTrace = {
    code: "ENDURING_AGREEMENT",
    message: "A PSA continues until varied or cancelled; this annual work is not a renewal of the agreement.",
    facts: { agreementStatus: input.agreementStatus },
  };
  const calculationDueDate = annualDate(year, 7, 31);
  results.push(
    resultFor(RULE_VERSIONS.PSA_CALCULATION, {
      outcome: "OBLIGATION",
      title: "Prepare and submit annual PSA calculation",
      obligationType: "Calculation submission",
      dueDate: calculationDueDate,
      humanReviewRequired: true,
      blocksReadiness: false,
      why: [
        enduringWhy,
        {
          code: "HMRC_31_JULY_EXPECTATION",
          message: "HMRC asks employers to send the annual calculation by 31 July; this is an administrative expectation, not an agreement-renewal date.",
          facts: { dueDate: calculationDueDate },
        },
      ],
    }),
  );

  const paymentDueDate = annualDate(year, 10, input.electronicPayment ? 22 : 19);
  results.push(
    resultFor(RULE_VERSIONS.PSA_PAYMENT, {
      outcome: "OBLIGATION",
      title: "Pay PSA tax and Class 1B National Insurance",
      obligationType: "Payment",
      dueDate: paymentDueDate,
      humanReviewRequired: false,
      blocksReadiness: false,
      why: [
        enduringWhy,
        {
          code: input.electronicPayment ? "ELECTRONIC_PAYMENT_DATE" : "STATUTORY_PAYMENT_DATE",
          message: input.electronicPayment
            ? "Applied HMRC's 22 October electronic-payment date."
            : "Applied the 19 October non-electronic payment date.",
          facts: { electronicPayment: input.electronicPayment, dueDate: paymentDueDate },
        },
      ],
    }),
  );

  return results;
}

export function generateP11dObligations(input: P11dInput): readonly GeneratedRuleResult[] {
  const year = taxYearEndYear(input.taxYearEnd);

  if (compareDates(input.taxYearEnd, "2028-04-05") >= 0) {
    const transitionReviewDate = annualDate(year - 1, 4, 5);
    return [
      resultFor(RULE_VERSIONS.P11D_TRANSITION_2027, {
        outcome: "IMPACT_REVIEW",
        title: "Review April 2027 benefits-in-kind payrolling transition",
        obligationType: "Regulatory impact review",
        applicabilityDate: annualDate(year - 1, 4, 6),
        dueDate: transitionReviewDate,
        humanReviewRequired: true,
        blocksReadiness: true,
        why: [
          {
            code: "INTERIM_GUIDANCE_ONLY",
            message: "The requested tax year begins on or after 6 April 2027, while the available HMRC material remains interim/draft controlled content.",
            facts: { taxYearEnd: input.taxYearEnd },
          },
          {
            code: "NO_SILENT_ACTIVATION",
            message: "No P11D or mandatory-payrolling filing obligation is activated until final legislation and guidance are reviewed and approved.",
          },
        ],
      }),
    ];
  }

  const filingDueDate = annualDate(year, 7, 6);
  const results: GeneratedRuleResult[] = [];
  if (input.hasNonPayrolledReportableBenefits) {
    results.push(
      resultFor(RULE_VERSIONS.P11D_RETURN, {
        outcome: "OBLIGATION",
        title: "Submit employee P11D forms and provide employee copies",
        obligationType: "Filing",
        dueDate: filingDueDate,
        humanReviewRequired: false,
        blocksReadiness: false,
        why: [
          {
            code: "NON_PAYROLLED_REPORTABLE_BENEFITS",
            message: "The employer has reportable benefits that were not validly payrolled or covered by a PSA.",
            facts: { taxYearEnd: input.taxYearEnd, dueDate: filingDueDate },
          },
        ],
      }),
    );
  }

  const hasBenefitsOrLiability =
    input.hasNonPayrolledReportableBenefits || input.hasPayrolledBenefits || input.hasClass1ALiability;
  if (hasBenefitsOrLiability || input.hmrcNoticeToFile) {
    const isNilDeclaration = !hasBenefitsOrLiability && input.hmrcNoticeToFile;
    results.push(
      resultFor(RULE_VERSIONS.P11D_RETURN, {
        outcome: "OBLIGATION",
        title: isNilDeclaration ? "Submit nil Class 1A declaration" : "Submit P11D(b) Class 1A return",
        obligationType: "Filing",
        dueDate: filingDueDate,
        humanReviewRequired: false,
        blocksReadiness: false,
        why: [
          {
            code: isNilDeclaration ? "HMRC_NOTICE_NIL_RESPONSE" : "P11D_B_TRIGGER",
            message: isNilDeclaration
              ? "HMRC requested a return and no taxable benefits or Class 1A liability are recorded."
              : "A P11D, payrolled benefit or Class 1A liability requires the employer return.",
            facts: {
              hasNonPayrolledReportableBenefits: input.hasNonPayrolledReportableBenefits,
              hasPayrolledBenefits: input.hasPayrolledBenefits,
              hasClass1ALiability: input.hasClass1ALiability,
              hmrcNoticeToFile: input.hmrcNoticeToFile,
              dueDate: filingDueDate,
            },
          },
        ],
        metadata: { nilDeclaration: isNilDeclaration },
      }),
    );
  }

  if (input.hasClass1ALiability) {
    const paymentDueDate = annualDate(year, 7, input.electronicPayment ? 22 : 19);
    results.push(
      resultFor(RULE_VERSIONS.P11D_RETURN, {
        outcome: "OBLIGATION",
        title: "Pay Class 1A National Insurance",
        obligationType: "Payment",
        dueDate: paymentDueDate,
        humanReviewRequired: false,
        blocksReadiness: false,
        why: [
          {
            code: input.electronicPayment ? "CLASS_1A_ELECTRONIC_DATE" : "CLASS_1A_STATUTORY_DATE",
            message: input.electronicPayment
              ? "Applied the 22 July electronic-payment date."
              : "Applied the 19 July non-electronic payment date.",
            facts: { electronicPayment: input.electronicPayment, dueDate: paymentDueDate },
          },
        ],
      }),
    );
  }

  return results;
}
