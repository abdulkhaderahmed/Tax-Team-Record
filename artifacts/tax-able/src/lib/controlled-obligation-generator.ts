import type { AccountingPeriod, Entity, TaxRule, TaxRuleVersion } from "@prisma/client";
import {
  RULE_VERSIONS,
  addCalendarMonths,
  addDays,
  generateCorporationTaxObligations,
  generateP11dObligations,
  generatePsaObligations,
  generateQipObligations,
  generateRndObligations,
  latestDate,
  resultFor,
  type DatePeriod,
  type GeneratedRuleResult,
} from "@/domain/rules";
import { CONTROLLED_RULE_ENGINE_VERSION } from "@/lib/controlled-rule-definitions";

export type ApprovedRuleVersion = TaxRuleVersion & { rule: TaxRule };

export type ControlledGeneration = {
  obligations: GeneratedRuleResult[];
  impacts: GeneratedRuleResult[];
  warnings: string[];
};

export type CorporationTaxPeriodGroup = {
  periodOfAccount: DatePeriod;
  accountingPeriods: DatePeriod[];
};

function iso(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function periodFromRecord(period: AccountingPeriod): DatePeriod {
  return { start: iso(period.ctPeriodStart), end: iso(period.ctPeriodEnd) };
}

/**
 * Group confirmed CT periods by their own period of account. Historical
 * records must never inherit the filing-date limbs of the first stored period.
 */
export function corporationTaxPeriods(
  entity: Entity,
  storedPeriods: readonly AccountingPeriod[] = [],
): CorporationTaxPeriodGroup[] {
  if (storedPeriods.length > 0) {
    const ordered = [...storedPeriods].sort(
      (left, right) => left.ctPeriodStart.getTime() - right.ctPeriodStart.getTime(),
    );
    const grouped = new Map<string, CorporationTaxPeriodGroup>();
    for (const period of ordered) {
      const periodOfAccount = {
        start: iso(period.periodOfAccountStart),
        end: iso(period.periodOfAccountEnd),
      };
      const key = `${periodOfAccount.start}|${periodOfAccount.end}`;
      const group = grouped.get(key) ?? {
        periodOfAccount,
        accountingPeriods: [],
      };
      group.accountingPeriods.push(periodFromRecord(period));
      grouped.set(key, group);
    }
    const groups = [...grouped.values()].sort((left, right) =>
      left.periodOfAccount.start.localeCompare(right.periodOfAccount.start),
    );
    for (const group of groups) {
      const periods = group.accountingPeriods;
      if (
        periods.length === 0 ||
        periods[0].start !== group.periodOfAccount.start ||
        periods[periods.length - 1].end !== group.periodOfAccount.end
      ) {
        throw new Error(
          `Confirmed CT periods do not fully cover period of account ${group.periodOfAccount.start} to ${group.periodOfAccount.end}.`,
        );
      }
      for (let index = 1; index < periods.length; index += 1) {
        if (periods[index].start !== addDays(periods[index - 1].end, 1)) {
          throw new Error(
            `Confirmed CT periods are not contiguous for period of account ${group.periodOfAccount.start} to ${group.periodOfAccount.end}.`,
          );
        }
      }
    }
    return groups;
  }

  if (!entity.accountingPeriodStart || !entity.accountingPeriodEnd) return [];
  const periodOfAccount = {
    start: iso(entity.accountingPeriodStart),
    end: iso(entity.accountingPeriodEnd),
  };
  const accountingPeriods: DatePeriod[] = [];
  let start = periodOfAccount.start;
  while (start <= periodOfAccount.end) {
    const twelveMonthEnd = addDays(addCalendarMonths(start, 12), -1);
    const end = twelveMonthEnd < periodOfAccount.end ? twelveMonthEnd : periodOfAccount.end;
    accountingPeriods.push({ start, end });
    start = addDays(end, 1);
  }
  return [{ periodOfAccount, accountingPeriods }];
}

function assertEmbeddedEngineVersion(): void {
  const mismatches = Object.values(RULE_VERSIONS).filter(
    (version) => version.version !== CONTROLLED_RULE_ENGINE_VERSION,
  );
  if (mismatches.length > 0) {
    throw new Error(
      `Rule engine build is internally inconsistent: expected ${CONTROLLED_RULE_ENGINE_VERSION}; mismatched ${mismatches.map((version) => version.ruleKey).join(", ")}.`,
    );
  }
}

function currentEmploymentTaxYearEnds(asOf: Date): string[] {
  const year = asOf.getUTCFullYear();
  const completedEndYear =
    asOf.getUTCMonth() < 3 || (asOf.getUTCMonth() === 3 && asOf.getUTCDate() <= 5)
      ? year - 1
      : year;
  return [completedEndYear, completedEndYear + 1, completedEndYear + 2].map(
    (endYear) => `${endYear}-04-05`,
  );
}

function manualVatResults(entity: Entity, asOf: Date): GeneratedRuleResult[] {
  if (!entity.vatRegistered || !entity.vatQuarterEndMonth) return [];
  const results: GeneratedRuleResult[] = [];
  for (let year = asOf.getUTCFullYear() - 1; year <= asOf.getUTCFullYear() + 1; year++) {
    for (let quarter = 0; quarter < 4; quarter++) {
      const monthIndex = entity.vatQuarterEndMonth - 1 + quarter * 3;
      const endYear = year + Math.floor(monthIndex / 12);
      const endMonth = ((monthIndex % 12) + 12) % 12;
      const periodEnd = new Date(Date.UTC(endYear, endMonth + 1, 0));
      const periodStart = new Date(Date.UTC(endYear, endMonth - 2, 1));
      const dueDate = new Date(Date.UTC(endYear, endMonth + 2, 7));
      if (dueDate < new Date(asOf.getTime() - 120 * 86_400_000)) continue;
      if (dueDate > new Date(asOf.getTime() + 500 * 86_400_000)) continue;
      results.push({
        ruleKey: "VAT_QUARTERLY",
        outcome: "OBLIGATION",
        title: "Submit quarterly VAT return and payment",
        obligationType: "Filing and payment",
        dueDate: iso(dueDate),
        period: { start: iso(periodStart), end: iso(periodEnd) },
        humanReviewRequired: true,
        blocksReadiness: false,
        provenance: {
          ruleKey: "VAT_QUARTERLY",
          version: CONTROLLED_RULE_ENGINE_VERSION,
          effectiveFrom: "2019-04-01",
          legalStatus: "ENACTED",
          sourceLastCheckedAt: "2026-07-11",
          changeRationale: "Standard-stagger VAT date generator; non-standard schemes require review.",
          sources: [],
        },
        why: [
          {
            code: "VAT_REGISTRATION_AND_STAGGER",
            message: "The entity is VAT registered and has a quarterly stagger on record.",
            facts: { vatQuarterEndMonth: entity.vatQuarterEndMonth, dueDate: iso(dueDate) },
          },
        ],
      });
    }
  }
  return results;
}

function manualErsResults(entity: Entity, taxYearEnds: readonly string[]): GeneratedRuleResult[] {
  if (!entity.hasErs) return [];
  return taxYearEnds.slice(0, 2).map((taxYearEnd) => {
    const year = Number(taxYearEnd.slice(0, 4));
    return {
      ruleKey: "ERS_RETURN",
      outcome: "OBLIGATION",
      title: "Submit Employment-Related Securities annual return",
      obligationType: "Filing",
      dueDate: `${year}-07-06`,
      humanReviewRequired: false,
      blocksReadiness: false,
      provenance: {
        ruleKey: "ERS_RETURN",
        version: CONTROLLED_RULE_ENGINE_VERSION,
        effectiveFrom: "2015-04-06",
        legalStatus: "ENACTED",
        sourceLastCheckedAt: "2026-07-11",
        changeRationale: "Controlled annual ERS filing rule.",
        sources: [],
      },
      why: [
        {
          code: "ERS_SCHEME_RECORDED",
          message: "An ERS scheme is recorded for the entity; an annual return (including a nil return where relevant) is due.",
          facts: { taxYearEnd },
        },
      ],
    };
  });
}

function confirmedPillarTwoResults(entity: Entity): GeneratedRuleResult[] {
  if (!entity.hasPillar2 || !entity.accountingPeriodStart || !entity.accountingPeriodEnd) return [];
  const period = { start: iso(entity.accountingPeriodStart), end: iso(entity.accountingPeriodEnd) };
  const first = entity.pillar2FirstReportingPeriod;
  const reportingDue = latestDate(
    "2026-06-30",
    addCalendarMonths(period.end, first ? 18 : 15),
  );
  const sharedWhy = [
    {
      code: "PILLAR_TWO_SCOPE_CONFIRMED",
      message: "The entity profile records the group as in scope; the underlying four-period revenue assessment remains reviewable evidence.",
      facts: { firstReportingPeriod: first },
    },
  ];
  const results: GeneratedRuleResult[] = [];
  if (first) {
    results.push(
      resultFor(RULE_VERSIONS.PILLAR2_REGISTRATION, {
        outcome: "OBLIGATION",
        title: "Register group for UK Pillar Two top-up taxes",
        obligationType: "Registration",
        dueDate: addCalendarMonths(period.end, 6),
        period,
        humanReviewRequired: true,
        blocksReadiness: true,
        why: sharedWhy,
      }),
    );
  }
  results.push(
    resultFor(RULE_VERSIONS.PILLAR2_RETURN, {
      outcome: "OBLIGATION",
      title: "Submit Pillar Two UK return and GIR/ORN",
      obligationType: "Filing",
      dueDate: reportingDue,
      period,
      humanReviewRequired: true,
      blocksReadiness: true,
      why: [
        ...sharedWhy,
        {
          code: first ? "FIRST_PERIOD_18_MONTHS" : "SUBSEQUENT_PERIOD_15_MONTHS",
          message: `Applied the ${first ? "18" : "15"}-month reporting deadline and the 30 June 2026 transitional floor.`,
          facts: { dueDate: reportingDue },
        },
      ],
    }),
  );
  return results;
}

export function generateControlledResults(
  entity: Entity,
  accountingPeriodRecords: readonly AccountingPeriod[] = [],
  asOf: Date = new Date(),
): ControlledGeneration {
  assertEmbeddedEngineVersion();
  const results: GeneratedRuleResult[] = [];
  const warnings: string[] = [];
  const periodGroups = corporationTaxPeriods(entity, accountingPeriodRecords);

  if (entity.ctReturnRequired && periodGroups.length > 0) {
    for (const periods of periodGroups) {
      for (const accountingPeriod of periods.accountingPeriods) {
        results.push(
          ...generateCorporationTaxObligations({
            accountingPeriod,
            periodOfAccount: periods.periodOfAccount,
            noticeStatus: "EXPECTED",
            paymentMode: entity.isLargeCompany || entity.isVeryLargeCompany ? "QIP" : "STANDARD",
          }),
        );
        if (entity.isLargeCompany || entity.isVeryLargeCompany) {
          const qips = generateQipObligations({
            accountingPeriod,
            taxableProfits: 0,
            estimatedTaxLiability: 0,
            associatedCompaniesIncludingSelf: Math.max(1, entity.qipAssociatedCompanyCount),
            wasLargeInPreviousTwelveMonths: entity.isLargeCompany,
            confirmedStatus: entity.isVeryLargeCompany ? "VERY_LARGE" : "LARGE",
          });
          results.push(...qips.obligations);
        }
      }
    }
  } else if (entity.ctReturnRequired) {
    warnings.push("Corporation Tax is marked required but no period of account is recorded.");
  }

  const taxYearEnds = currentEmploymentTaxYearEnds(asOf);
  if (entity.p11dRequired || entity.payeRegistered) {
    for (const taxYearEnd of taxYearEnds) {
      const reportingMethod = entity.benefitsReportingMethod.toLowerCase();
      results.push(
        ...generateP11dObligations({
          taxYearEnd,
          hasNonPayrolledReportableBenefits:
            entity.p11dRequired &&
            (reportingMethod === "p11d" ||
              reportingMethod === "mixed" ||
              entity.hasLoansOrAccommodationBenefits),
          hasPayrolledBenefits: reportingMethod.includes("payroll") || reportingMethod === "mixed",
          hasClass1ALiability: entity.p11dRequired,
          hmrcNoticeToFile: entity.p11dRequired,
          electronicPayment: true,
        }),
      );
    }
  }

  if (entity.psaRequired) {
    const agreementStatus =
      entity.psaAgreementStatus === "Enduring"
        ? "ENDURING"
        : entity.psaAgreementStatus === "Amendment needed"
          ? "AMENDMENT_REQUIRED"
          : "NEW_REQUIRED";
    results.push(
      ...generatePsaObligations({
        taxYearEnd: taxYearEnds[0],
        agreementStatus,
        electronicPayment: entity.psaPaymentMethod === "Electronic",
      }),
    );
  }

  if (entity.rdClaimExpected && periodGroups.length > 0) {
    for (const periods of periodGroups) {
      for (const accountingPeriod of periods.accountingPeriods) {
        const ctFilingDate = addCalendarMonths(periods.periodOfAccount.end, 12);
        const rdResults = generateRndObligations({
          accountingPeriod,
          periodOfAccount: periods.periodOfAccount,
          claimIntended: true,
          claimSubmittedAt: `${ctFilingDate}T12:00:00.000Z`,
          aifSubmittedAt: undefined,
          priorClaims: [],
        });
        results.push(
          ...rdResults.filter((result) => {
            if (result.ruleKey === "RD_NOTIFICATION") return entity.rdNotificationNeeded;
            if (result.ruleKey === "RD_AIF") return entity.rdAifNeeded;
            return result.outcome !== "NOT_APPLICABLE";
          }),
        );
      }
    }
  }

  results.push(...manualVatResults(entity, asOf));
  results.push(...manualErsResults(entity, taxYearEnds));
  if (entity.hasPillar2 && entity.groupId) {
    results.push(
      resultFor(RULE_VERSIONS.PILLAR2_SCOPE, {
        outcome: "IMPACT_REVIEW",
        title: "Confirm group-level Pillar Two filing member and assessment",
        obligationType: "Scope assessment",
        humanReviewRequired: true,
        blocksReadiness: true,
        why: [
          {
            code: "PILLAR_TWO_GROUP_CONTROL_REQUIRED",
            message:
              "Pillar Two is a group-level obligation. Entity-level registration and return drafts are withheld until a single filing member and evidenced group assessment are recorded.",
            facts: { groupId: entity.groupId, entityId: entity.id },
          },
        ],
      }),
    );
    warnings.push(
      "Pillar Two filing drafts were withheld because this entity belongs to a group and no controlled group filing-member workflow is implemented yet.",
    );
  } else {
    results.push(...confirmedPillarTwoResults(entity));
  }

  const mismatchedResults = results.filter(
    (result) => result.provenance.version !== CONTROLLED_RULE_ENGINE_VERSION,
  );
  if (mismatchedResults.length > 0) {
    throw new Error(
      `Rule engine emitted results from an incompatible build: ${mismatchedResults.map((result) => result.ruleKey).join(", ")}.`,
    );
  }

  return {
    obligations: results.filter((result) => result.outcome === "OBLIGATION"),
    impacts: results.filter(
      (result) => result.outcome === "IMPACT_REVIEW" || result.outcome === "REVIEW_REQUIRED",
    ),
    warnings,
  };
}

export function ruleResultWhy(result: GeneratedRuleResult): string {
  return result.why
    .map((trace) => {
      const facts = trace.facts ? ` ${JSON.stringify(trace.facts)}` : "";
      return `${trace.message}${facts}`;
    })
    .join("\n");
}

/**
 * Select the one approved controlled-content version that applies to the
 * generated occurrence. EffectiveTo is inclusive because approval closes the
 * superseded version on the day before the successor starts.
 */
export function selectEffectiveRuleVersion(
  versions: readonly ApprovedRuleVersion[],
  applicabilityDate: Date,
): ApprovedRuleVersion | null {
  const matches = versions.filter(
    (version) =>
      (version.status === "Approved" || version.status === "Superseded") &&
      version.effectiveFrom.getTime() <= applicabilityDate.getTime() &&
      (!version.effectiveTo || version.effectiveTo.getTime() >= applicabilityDate.getTime()),
  );
  if (matches.length > 1) {
    throw new Error(
      `Controlled rule ${matches[0].rule.ruleKey} has overlapping approved versions for ${iso(applicabilityDate)}.`,
    );
  }
  const selected = matches[0] ?? null;
  if (
    selected &&
    selected.engineVersion !== CONTROLLED_RULE_ENGINE_VERSION
  ) {
    throw new Error(
      `Controlled rule ${selected.rule.ruleKey} v${selected.version} is bound to engine ${selected.engineVersion}; running engine is ${CONTROLLED_RULE_ENGINE_VERSION}. Generation stopped without creating records.`,
    );
  }
  return selected;
}

export function resultApplicabilityDate(
  result: GeneratedRuleResult,
  fallback: Date,
): Date {
  if (result.applicabilityDate) return date(result.applicabilityDate);
  if (result.period?.end) return date(result.period.end);
  if (result.dueDate) return date(result.dueDate);
  return fallback;
}

export function controlledRuleWhy(
  result: GeneratedRuleResult,
  version: ApprovedRuleVersion,
  applicabilityDate: Date,
): string {
  const effectiveRange = `${iso(version.effectiveFrom)} to ${version.effectiveTo ? iso(version.effectiveTo) : "open-ended"}`;
  return [
    ruleResultWhy(result),
    `Controlled content: ${version.rule.ruleKey} v${version.version} (${effectiveRange}); deterministic engine ${version.engineVersion}; selected using occurrence date ${iso(applicabilityDate)}.`,
  ].filter(Boolean).join("\n");
}

export function resultOccurrenceKey(result: GeneratedRuleResult): string {
  return [
    result.ruleKey,
    result.obligationType,
    result.period?.start ?? "none",
    result.period?.end ?? "none",
    result.dueDate ?? "none",
    result.title,
  ].join("|");
}

export function resultDueDate(result: GeneratedRuleResult): Date | null {
  return result.dueDate ? date(result.dueDate) : null;
}
