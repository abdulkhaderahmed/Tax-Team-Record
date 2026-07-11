import type { RuleVersion } from "./types";

const checked = "2026-07-11";
const version = "2026.07.11-1";

export const RULE_VERSIONS = {
  CT_RETURN: {
    ruleKey: "CT_RETURN",
    version,
    effectiveFrom: "1999-07-01",
    legalStatus: "ENACTED",
    sourceLastCheckedAt: checked,
    changeRationale: "Controlled implementation of the full Schedule 18 filing-date limbs, including long periods of account.",
    sources: [
      {
        title: "Finance Act 1998, Schedule 18, paragraph 14",
        url: "https://www.legislation.gov.uk/ukpga/1998/36/schedule/18",
        authorityLevel: "PRIMARY_LEGISLATION",
      },
      {
        title: "HMRC COTAX Manual COM130070",
        url: "https://www.gov.uk/hmrc-internal-manuals/cotax-manual/com130070",
        authorityLevel: "HMRC_GUIDANCE",
      },
    ],
  },
  CT_PAYMENT_STANDARD: {
    ruleKey: "CT_PAYMENT_STANDARD",
    version,
    effectiveFrom: "1999-07-01",
    legalStatus: "ENACTED",
    sourceLastCheckedAt: checked,
    changeRationale: "Controlled implementation of the nine-month-and-one-day normal payment date.",
    sources: [
      {
        title: "Taxes Management Act 1970, section 59D",
        url: "https://www.legislation.gov.uk/ukpga/1970/9/section/59D",
        authorityLevel: "PRIMARY_LEGISLATION",
      },
      {
        title: "HMRC Company Tax Return obligations",
        url: "https://www.gov.uk/guidance/company-tax-return-obligations",
        authorityLevel: "HMRC_GUIDANCE",
      },
    ],
  },
  CT_QIP_LARGE: {
    ruleKey: "CT_QIP_LARGE",
    version,
    effectiveFrom: "2002-07-01",
    legalStatus: "ENACTED",
    sourceLastCheckedAt: checked,
    changeRationale: "Controlled large-company threshold, grace, de-minimis and shortened instalment schedule.",
    sources: [
      {
        title: "Corporation Tax (Instalment Payments) Regulations 1998",
        url: "https://www.legislation.gov.uk/uksi/1998/3175/contents",
        authorityLevel: "SECONDARY_LEGISLATION",
      },
      {
        title: "HMRC large-company instalment guidance",
        url: "https://www.gov.uk/guidance/corporation-tax-paying-in-instalments",
        authorityLevel: "HMRC_GUIDANCE",
      },
    ],
  },
  CT_QIP_VERY_LARGE: {
    ruleKey: "CT_QIP_VERY_LARGE",
    version,
    effectiveFrom: "2019-04-01",
    legalStatus: "ENACTED",
    sourceLastCheckedAt: checked,
    changeRationale: "Controlled accelerated timetable and statutory short-period final-date rule for very-large companies.",
    sources: [
      {
        title: "Corporation Tax (Instalment Payments) Regulations 1998",
        url: "https://www.legislation.gov.uk/uksi/1998/3175/contents",
        authorityLevel: "SECONDARY_LEGISLATION",
      },
      {
        title: "HMRC very-large-company instalment guidance",
        url: "https://www.gov.uk/guidance/pay-corporation-tax-if-youre-a-very-large-company",
        authorityLevel: "HMRC_GUIDANCE",
      },
    ],
  },
  PSA_AGREEMENT: {
    ruleKey: "PSA_AGREEMENT",
    version,
    effectiveFrom: "2018-04-06",
    legalStatus: "ENACTED",
    sourceLastCheckedAt: checked,
    changeRationale: "Treat PSAs as enduring agreements and create application/amendment work only when facts require it.",
    sources: [
      {
        title: "Income Tax (PAYE) Regulations 2003, Part 6",
        url: "https://www.legislation.gov.uk/uksi/2003/2682/part/6",
        authorityLevel: "SECONDARY_LEGISLATION",
      },
      {
        title: "HMRC PSA Manual PSA1150",
        url: "https://www.gov.uk/hmrc-internal-manuals/paye-settlement-agreements/psa1150",
        authorityLevel: "HMRC_GUIDANCE",
      },
    ],
  },
  PSA_CALCULATION: {
    ruleKey: "PSA_CALCULATION",
    version,
    effectiveFrom: "2025-04-06",
    legalStatus: "ADMINISTRATIVE",
    sourceLastCheckedAt: checked,
    changeRationale: "Separate HMRC's annual calculation expectation from the enduring agreement itself.",
    sources: [
      {
        title: "HMRC Guidelines for Compliance GfC1",
        url: "https://www.gov.uk/government/publications/gfc1-2022-guidelines-for-compliance-help-with-paye-settlement-agreement-calculations/gfc1-2022-help-with-paye-settlement-agreements-psa",
        authorityLevel: "HMRC_GUIDANCE",
      },
    ],
  },
  PSA_PAYMENT: {
    ruleKey: "PSA_PAYMENT",
    version,
    effectiveFrom: "2003-04-06",
    legalStatus: "ENACTED",
    sourceLastCheckedAt: checked,
    changeRationale: "Model statutory and electronic payment dates explicitly.",
    sources: [
      {
        title: "HMRC Pay a PAYE Settlement Agreement",
        url: "https://www.gov.uk/pay-psa",
        authorityLevel: "HMRC_GUIDANCE",
      },
    ],
  },
  P11D_RETURN: {
    ruleKey: "P11D_RETURN",
    version,
    effectiveFrom: "2003-04-06",
    legalStatus: "ENACTED",
    sourceLastCheckedAt: checked,
    changeRationale: "Generate P11D/P11D(b) only from benefit, payrolling and HMRC-notice facts.",
    sources: [
      {
        title: "Income Tax (PAYE) Regulations 2003, regulation 85",
        url: "https://www.legislation.gov.uk/uksi/2003/2682/regulation/85",
        authorityLevel: "SECONDARY_LEGISLATION",
      },
      {
        title: "HMRC expenses and benefits deadlines",
        url: "https://www.gov.uk/employer-reporting-expenses-benefits/deadlines",
        authorityLevel: "HMRC_GUIDANCE",
      },
    ],
  },
  P11D_TRANSITION_2027: {
    ruleKey: "P11D_TRANSITION_2027",
    version,
    effectiveFrom: "2027-04-06",
    legalStatus: "INTERIM_DRAFT",
    sourceLastCheckedAt: checked,
    changeRationale: "Keep April 2027 mandatory-payrolling material impact-only until final legislation and guidance are approved.",
    sources: [
      {
        title: "HMRC interim mandatory-payrolling guidance",
        url: "https://www.gov.uk/guidance/draft-guidance-and-legislation-to-aid-preparation-for-reporting-benefits-in-kind-in-real-time/getting-ready-for-mandatory-payrolling-of-benefits-in-kind",
        authorityLevel: "INTERIM_GUIDANCE",
      },
    ],
  },
  RD_NOTIFICATION: {
    ruleKey: "RD_NOTIFICATION",
    version,
    effectiveFrom: "2023-04-01",
    legalStatus: "ENACTED",
    sourceLastCheckedAt: checked,
    changeRationale: "Implement the period-of-account notification window and three-year prior-claim test.",
    sources: [
      {
        title: "Corporation Tax Act 2009, section 1142A",
        url: "https://www.legislation.gov.uk/ukpga/2009/4/section/1142A",
        authorityLevel: "PRIMARY_LEGISLATION",
      },
      {
        title: "HMRC CIRD183000",
        url: "https://www.gov.uk/hmrc-internal-manuals/corporate-intangibles-research-and-development-manual/cird183000",
        authorityLevel: "HMRC_GUIDANCE",
      },
    ],
  },
  RD_AIF: {
    ruleKey: "RD_AIF",
    version,
    effectiveFrom: "2023-08-08",
    legalStatus: "ENACTED",
    sourceLastCheckedAt: checked,
    changeRationale: "Enforce one AIF per claim/AP and the AIF-before-CT600 ordering gate.",
    sources: [
      {
        title: "SI 2023/813",
        url: "https://www.legislation.gov.uk/uksi/2023/813/contents",
        authorityLevel: "SECONDARY_LEGISLATION",
      },
      {
        title: "HMRC additional-information guidance",
        url: "https://www.gov.uk/guidance/submit-detailed-information-before-you-claim-research-and-development-rd-tax-relief",
        authorityLevel: "HMRC_GUIDANCE",
      },
    ],
  },
  PILLAR2_SCOPE: {
    ruleKey: "PILLAR2_SCOPE",
    version,
    effectiveFrom: "2023-12-31",
    legalStatus: "ENACTED",
    sourceLastCheckedAt: checked,
    changeRationale: "Use the statutory strict-exceeds, day-adjusted two-of-four revenue test.",
    sources: [
      {
        title: "Finance (No. 2) Act 2023, section 129",
        url: "https://www.legislation.gov.uk/ukpga/2023/30/section/129",
        authorityLevel: "PRIMARY_LEGISLATION",
      },
      {
        title: "HMRC MTT11010",
        url: "https://www.gov.uk/hmrc-internal-manuals/multinational-top-up-tax-and-domestic-top-up-tax/mtt11010",
        authorityLevel: "HMRC_GUIDANCE",
      },
    ],
  },
  PILLAR2_REGISTRATION: {
    ruleKey: "PILLAR2_REGISTRATION",
    version,
    effectiveFrom: "2023-12-31",
    legalStatus: "FORCE_OF_LAW",
    sourceLastCheckedAt: checked,
    changeRationale: "Create one registration obligation for the first qualifying period.",
    sources: [
      {
        title: "Pillar 2 registration notice 1",
        url: "https://www.gov.uk/government/publications/pillar-2-top-up-taxes-registration-notice-1",
        authorityLevel: "STATUTORY_NOTICE",
      },
    ],
  },
  PILLAR2_RETURN: {
    ruleKey: "PILLAR2_RETURN",
    version,
    effectiveFrom: "2023-12-31",
    legalStatus: "FORCE_OF_LAW",
    sourceLastCheckedAt: checked,
    changeRationale: "Implement the first-period 18-month and subsequent 15-month filing deadlines.",
    sources: [
      {
        title: "Pillar 2 submission notice 3",
        url: "https://www.gov.uk/government/publications/pillar-2-top-up-taxes-submission-of-returns-notice-3/notice-3-pillar-2-top-up-taxes-submission-of-returns",
        authorityLevel: "STATUTORY_NOTICE",
      },
    ],
  },
  PILLAR2_PAYMENT: {
    ruleKey: "PILLAR2_PAYMENT",
    version,
    effectiveFrom: "2023-12-31",
    legalStatus: "ENACTED",
    sourceLastCheckedAt: checked,
    changeRationale: "Align payment with the first/subsequent reporting periods and transitional minimum date.",
    sources: [
      {
        title: "HMRC Pay Pillar 2 top-up taxes",
        url: "https://www.gov.uk/guidance/pay-pillar-2-top-up-taxes-domestic-top-up-tax-and-multinational-top-up-tax",
        authorityLevel: "HMRC_GUIDANCE",
      },
    ],
  },
} as const satisfies Record<string, RuleVersion>;
