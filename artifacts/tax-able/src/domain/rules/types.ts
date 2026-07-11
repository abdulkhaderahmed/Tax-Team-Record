export type ISODate = string;
export type ISOInstant = string;

export interface DatePeriod {
  start: ISODate;
  end: ISODate;
}

export type AuthorityLevel =
  | "PRIMARY_LEGISLATION"
  | "SECONDARY_LEGISLATION"
  | "STATUTORY_NOTICE"
  | "HMRC_GUIDANCE"
  | "INTERIM_GUIDANCE";

export type LegalStatus = "ENACTED" | "FORCE_OF_LAW" | "ADMINISTRATIVE" | "INTERIM_DRAFT";

export interface RuleSource {
  title: string;
  url: string;
  authorityLevel: AuthorityLevel;
}

export interface RuleVersion {
  ruleKey: string;
  version: string;
  effectiveFrom: ISODate;
  effectiveTo?: ISODate;
  legalStatus: LegalStatus;
  sourceLastCheckedAt: ISODate;
  changeRationale: string;
  sources: readonly RuleSource[];
}

export interface WhyTrace {
  code: string;
  message: string;
  facts?: Readonly<Record<string, string | number | boolean | null>>;
}

export type RuleOutcome = "OBLIGATION" | "IMPACT_REVIEW" | "REVIEW_REQUIRED" | "NOT_APPLICABLE";

export interface GeneratedRuleResult {
  ruleKey: string;
  outcome: RuleOutcome;
  title: string;
  obligationType: string;
  /** Date on which the controlled rule applies when that differs from a due
   * date or period end (for example, a transition effective at period start). */
  applicabilityDate?: ISODate;
  dueDate?: ISODate;
  period?: DatePeriod;
  humanReviewRequired: boolean;
  blocksReadiness: boolean;
  provenance: RuleVersion;
  why: readonly WhyTrace[];
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

export function resultFor(
  provenance: RuleVersion,
  fields: Omit<GeneratedRuleResult, "ruleKey" | "provenance">,
): GeneratedRuleResult {
  return {
    ...fields,
    ruleKey: provenance.ruleKey,
    provenance,
  };
}
