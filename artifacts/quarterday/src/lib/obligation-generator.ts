import type { Entity } from "@prisma/client";

// ── Date helpers ──────────────────────────────────────────────────────────

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function lastDayOfMonth(year: number, month1: number): Date {
  // month1 is 1-indexed (January = 1)
  return new Date(Date.UTC(year, month1, 0));
}

/** 14th of the Nth month counting from `start` (N=1 = same month as start) */
function month14(start: Date, n: number): Date {
  const d = new Date(start);
  d.setUTCMonth(d.getUTCMonth() + (n - 1));
  d.setUTCDate(14);
  return d;
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// ── VAT quarter generator ─────────────────────────────────────────────────

interface VatQuarter {
  periodStart: Date;
  periodEnd: Date;
  filingDeadline: Date;
}

function vatQuarters(vatEndMonth: number, today: Date): VatQuarter[] {
  const results: VatQuarter[] = [];
  const em0 = vatEndMonth - 1; // 0-indexed base end month

  // Scan a 3-year window (prev year through next 2 years) for all quarter-end months
  for (let yr = today.getUTCFullYear() - 1; yr <= today.getUTCFullYear() + 2 && results.length < 8; yr++) {
    for (let qi = 0; qi < 4 && results.length < 8; qi++) {
      // Quarter end month (0-indexed), could overflow into next year
      let endM0 = em0 + qi * 3;
      let endY = yr;
      if (endM0 > 11) { endM0 -= 12; endY++; }

      const periodEnd = lastDayOfMonth(endY, endM0 + 1);

      // Filing deadline: 7th of the 2nd month after quarter end
      let dlM0 = endM0 + 2;
      let dlY = endY;
      if (dlM0 > 11) { dlM0 -= 12; dlY++; }
      const filingDeadline = new Date(Date.UTC(dlY, dlM0, 7));

      // Only include quarters whose deadline is in the future (or up to 3 months past)
      const cutoff = addMonths(today, -3);
      if (filingDeadline < cutoff) continue;
      if (filingDeadline > addMonths(today, 15)) break;

      // Period start: 1st of the month 2 months before quarter end
      let psM0 = endM0 - 2;
      let psY = endY;
      if (psM0 < 0) { psM0 += 12; psY--; }
      const periodStart = new Date(Date.UTC(psY, psM0, 1));

      results.push({ periodStart, periodEnd, filingDeadline });
    }
  }

  return results
    .sort((a, b) => a.periodEnd.getTime() - b.periodEnd.getTime())
    .slice(0, 4);
}

// ── Employment tax year helper ────────────────────────────────────────────

interface TaxYear {
  taxYearStart: Date;
  taxYearEnd: Date;
  p11dDeadline: Date;
  p11dPaymentDeadline: Date;
  psaPaymentDeadline: Date;
}

function employmentTaxYears(today: Date): TaxYear[] {
  // Most recently COMPLETED tax year: ended 5 April most recently before today
  const yr = today.getUTCFullYear();
  const m0 = today.getUTCMonth(); // 0-indexed
  const day = today.getUTCDate();

  // If before or on 5 April, the most recent completed tax year ended 5 April last year
  const completedEndYear = (m0 < 3 || (m0 === 3 && day <= 5)) ? yr - 1 : yr;

  return [completedEndYear, completedEndYear + 1].map((endYear) => ({
    taxYearStart: new Date(Date.UTC(endYear - 1, 3, 6)),      // 6 April prior year
    taxYearEnd: new Date(Date.UTC(endYear, 3, 5)),            // 5 April
    p11dDeadline: new Date(Date.UTC(endYear, 6, 6)),          // 6 July
    p11dPaymentDeadline: new Date(Date.UTC(endYear, 6, 22)),  // 22 July
    psaPaymentDeadline: new Date(Date.UTC(endYear, 9, 22)),   // 22 October
  }));
}

// ── Draft obligation shape ────────────────────────────────────────────────

export interface DraftObligationData {
  entityId: string;
  organisationId: string;
  regime: string;
  obligationType: string;
  description: string;
  statutoryBasis: string | null;
  filingDeadline: Date | null;
  paymentDeadline: Date | null;
  internalTargetDate: Date | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  recurrence: string;
  sourceType: string;
  ruleId: string;
  calculationBasis: string;
  humanExplanation: string;
  overallWorkflowStatus: string;
  draftReviewStatus: string;
  responsibleOwner: string | null;
  accountableOwner: string | null;
  externalAdviser: string | null;
  dataCompletenessStatus: string;
  dataValidationStatus: string;
  technicalReviewStatus: string;
  approvalStatus: string;
  workflowProgressStatus: string;
  evidenceStatus: string;
  filingSubmissionStatus: string;
  paymentStatus: string;
}

// ── Main generator ────────────────────────────────────────────────────────

export function generateDraftObligations(
  entity: Entity,
  today: Date = new Date()
): DraftObligationData[] {
  const drafts: DraftObligationData[] = [];
  const ape = entity.accountingPeriodEnd;
  const aps = entity.accountingPeriodStart;

  function push(params: {
    ruleId: string;
    regime: string;
    obligationType: string;
    description: string;
    statutoryBasis: string;
    filingDeadline: Date | null;
    paymentDeadline?: Date | null;
    internalTargetDate?: Date | null;
    periodStart?: Date | null;
    periodEnd?: Date | null;
    recurrence: string;
    calculationBasis: string;
    humanExplanation: string;
  }): void {
    const itd =
      params.internalTargetDate ??
      (params.filingDeadline ? addDays(params.filingDeadline, -14) : null);

    drafts.push({
      entityId: entity.id,
      organisationId: entity.organisationId,
      regime: params.regime,
      obligationType: params.obligationType,
      description: params.description,
      statutoryBasis: params.statutoryBasis,
      filingDeadline: params.filingDeadline,
      paymentDeadline: params.paymentDeadline ?? null,
      internalTargetDate: itd,
      periodStart: params.periodStart ?? null,
      periodEnd: params.periodEnd ?? null,
      recurrence: params.recurrence,
      sourceType: "Rules pack",
      ruleId: params.ruleId,
      calculationBasis: params.calculationBasis,
      humanExplanation: params.humanExplanation,
      overallWorkflowStatus: "Not started",
      draftReviewStatus: "pending",
      responsibleOwner: entity.primaryTaxOwner ?? null,
      accountableOwner: entity.financeOwner ?? null,
      externalAdviser: entity.externalAdviser ?? null,
      dataCompletenessStatus: "Not started",
      dataValidationStatus: "Not started",
      technicalReviewStatus: "Not started",
      approvalStatus: "Not started",
      workflowProgressStatus: "Not started",
      evidenceStatus: "Not started",
      filingSubmissionStatus: "Not started",
      paymentStatus: "Not started",
    });
  }

  // ── Corporation Tax ──────────────────────────────────────────────────────
  if (entity.ctReturnRequired && ape) {
    push({
      ruleId: "CT-FILING",
      regime: "Corporation Tax",
      obligationType: "Filing",
      description: `CT600 Corporation Tax return — period ending ${fmtShort(ape)}`,
      statutoryBasis: "S455 CTA 2010; FA 1998 Schedule 18",
      filingDeadline: addMonths(ape, 12),
      internalTargetDate: addMonths(ape, 11),
      periodStart: aps ?? null,
      periodEnd: ape,
      recurrence: "Annual",
      calculationBasis: `12 months after accounting period end (${fmtShort(ape)})`,
      humanExplanation:
        `Entity has CT return required = Yes. The CT600 must be filed within 12 months of the ` +
        `accounting period end (${fmtShort(ape)}).`,
    });

    // Standard CT payment (not large/very large)
    if (!entity.isLargeCompany && !entity.isVeryLargeCompany) {
      const payDate = addDays(addMonths(ape, 9), 1);
      push({
        ruleId: "CT-PAYMENT-STD",
        regime: "Corporation Tax Payment",
        obligationType: "Payment",
        description: `Corporation Tax payment — period ending ${fmtShort(ape)}`,
        statutoryBasis: "S59 TMA 1970; CTSA regime",
        filingDeadline: payDate,
        paymentDeadline: payDate,
        internalTargetDate: addMonths(ape, 8),
        periodStart: aps ?? null,
        periodEnd: ape,
        recurrence: "Annual",
        calculationBasis: `9 months and 1 day after accounting period end (${fmtShort(ape)})`,
        humanExplanation:
          `Entity is not a large or very large company. Corporation Tax is payable 9 months and ` +
          `1 day after the accounting period end (${fmtShort(ape)}).`,
      });
    }
  }

  // ── QIPs — Large company (not very large) ────────────────────────────────
  if (aps && ape && entity.isLargeCompany && !entity.isVeryLargeCompany) {
    const qips = [
      { ruleId: "QIP-L-1", n: 7,  num: 1 },
      { ruleId: "QIP-L-2", n: 10, num: 2 },
      { ruleId: "QIP-L-3", n: 13, num: 3 },
      { ruleId: "QIP-L-4", n: 16, num: 4 },
    ];
    for (const q of qips) {
      const due = month14(aps, q.n);
      push({
        ruleId: q.ruleId,
        regime: "Quarterly Instalment Payments",
        obligationType: "Payment",
        description: `QIP Instalment ${q.num} of 4 (large company) — period ending ${fmtShort(ape)}`,
        statutoryBasis: "SI 1998/3175 reg 5 Corporation Tax (Instalment Payments) Regulations",
        filingDeadline: due,
        paymentDeadline: due,
        internalTargetDate: addDays(due, -7),
        periodStart: aps,
        periodEnd: ape,
        recurrence: "Annual",
        calculationBasis:
          `14th day of month ${q.n} counting from AP start (${fmtShort(aps)}). ` +
          `Large company 4-instalment schedule (SI 1998/3175 reg 5).`,
        humanExplanation:
          `Entity is flagged as a large company (not very large). CT must be paid in 4 quarterly ` +
          `instalments. Instalment ${q.num} of 4 falls on the 14th of month ${q.n} from the AP start. ` +
          `⚠ Verify that the large company threshold is met with your tax adviser.`,
      });
    }
  }

  // ── QIPs — Very large company ────────────────────────────────────────────
  if (aps && ape && entity.isVeryLargeCompany) {
    const qips = [
      { ruleId: "QIP-VL-1", n: 3,  num: 1 },
      { ruleId: "QIP-VL-2", n: 6,  num: 2 },
      { ruleId: "QIP-VL-3", n: 9,  num: 3 },
      { ruleId: "QIP-VL-4", n: 12, num: 4 },
    ];
    for (const q of qips) {
      const due = month14(aps, q.n);
      push({
        ruleId: q.ruleId,
        regime: "Quarterly Instalment Payments",
        obligationType: "Payment",
        description: `QIP Instalment ${q.num} of 4 (very large — accelerated) — period ending ${fmtShort(ape)}`,
        statutoryBasis: "SI 1998/3175 reg 5B (very large companies — accelerated QIP schedule)",
        filingDeadline: due,
        paymentDeadline: due,
        internalTargetDate: addDays(due, -7),
        periodStart: aps,
        periodEnd: ape,
        recurrence: "Annual",
        calculationBasis:
          `14th day of month ${q.n} counting from AP start (${fmtShort(aps)}). ` +
          `Very large company accelerated 4-instalment schedule (SI 1998/3175 reg 5B).`,
        humanExplanation:
          `Entity is flagged as a very large company. Accelerated QIP schedule applies. ` +
          `Instalment ${q.num} of 4 falls on the 14th of month ${q.n} from the AP start. ` +
          `⚠ Verify that the very large company threshold (>£20m CT liability) is met.`,
      });
    }
  }

  // ── VAT Quarterly Returns ────────────────────────────────────────────────
  if (entity.vatRegistered && entity.vatQuarterEndMonth) {
    const quarters = vatQuarters(entity.vatQuarterEndMonth, today);
    for (const q of quarters) {
      const stagger = MONTH_NAMES_SHORT[entity.vatQuarterEndMonth - 1];
      push({
        ruleId: "VAT-Q",
        regime: "VAT",
        obligationType: "Filing",
        description: `VAT return — quarter ending ${fmtShort(q.periodEnd)}`,
        statutoryBasis: "VAT Act 1994 s25; SI 1995/2518 reg 25A; SI 2018/261 (MTD for VAT)",
        filingDeadline: q.filingDeadline,
        paymentDeadline: q.filingDeadline,
        internalTargetDate: addDays(q.filingDeadline, -7),
        periodStart: q.periodStart,
        periodEnd: q.periodEnd,
        recurrence: "Quarterly",
        calculationBasis:
          `7th of the second month following the VAT quarter end (${fmtShort(q.periodEnd)}). ` +
          `1 month + 7 days after quarter end — standard MTD filing and payment deadline.`,
        humanExplanation:
          `Entity is VAT registered with a ${stagger} stagger` +
          (entity.vatRegistrationNumber ? ` (VRN: ${entity.vatRegistrationNumber})` : "") +
          `. Quarterly VAT return and payment due 1 month and 7 days after the quarter end.`,
      });
    }
  }

  // ── P11D / P11D(b) ───────────────────────────────────────────────────────
  if (entity.p11dRequired) {
    for (const ty of employmentTaxYears(today)) {
      const tyLabel = `${ty.taxYearStart.getUTCFullYear()}/${String(ty.taxYearEnd.getUTCFullYear()).slice(-2)}`;
      push({
        ruleId: "P11D-FILING",
        regime: "P11D/P11D(b)",
        obligationType: "Filing",
        description: `P11D and P11D(b) filing — tax year ${tyLabel}`,
        statutoryBasis: "ITEPA 2003 ss.65, 69, 73; SI 2003/2682 PAYE Regs reg 85",
        filingDeadline: ty.p11dDeadline,
        internalTargetDate: addDays(ty.p11dDeadline, -14),
        periodStart: ty.taxYearStart,
        periodEnd: ty.taxYearEnd,
        recurrence: "Annual",
        calculationBasis:
          `6 July following the end of tax year ${tyLabel} (5 April ${ty.taxYearEnd.getUTCFullYear()})`,
        humanExplanation:
          `Entity has P11D required = Yes. P11D forms (expenses and benefits) and P11D(b) ` +
          `(employer NIC declaration) must be filed by 6 July. Tax year: ${tyLabel}.`,
      });
      push({
        ruleId: "P11D-PAYMENT",
        regime: "P11D/P11D(b)",
        obligationType: "Payment",
        description: `P11D(b) Class 1A NIC payment — tax year ${tyLabel}`,
        statutoryBasis: "SSCBA 1992 s10; SI 2001/1004 reg 67C",
        filingDeadline: ty.p11dPaymentDeadline,
        paymentDeadline: ty.p11dPaymentDeadline,
        internalTargetDate: addDays(ty.p11dPaymentDeadline, -7),
        periodStart: ty.taxYearStart,
        periodEnd: ty.taxYearEnd,
        recurrence: "Annual",
        calculationBasis:
          `22 July following the end of tax year ${tyLabel} (19 July for non-electronic payment)`,
        humanExplanation:
          `Class 1A NIC on benefits in kind declared on P11D(b) is payable by 22 July ` +
          `(electronic) / 19 July (cheque). Tax year: ${tyLabel}.`,
      });
    }
  }

  // ── PSA ──────────────────────────────────────────────────────────────────
  if (entity.psaRequired) {
    for (const ty of employmentTaxYears(today)) {
      const tyLabel = `${ty.taxYearStart.getUTCFullYear()}/${String(ty.taxYearEnd.getUTCFullYear()).slice(-2)}`;
      push({
        ruleId: "PSA-AGREEMENT",
        regime: "PSA",
        obligationType: "Review",
        description: `PSA agreement / renewal — tax year ${tyLabel}`,
        statutoryBasis: "SI 1996/2631 reg 109; ITEPA 2003 ss.703–707",
        filingDeadline: ty.p11dDeadline,
        internalTargetDate: addDays(ty.p11dDeadline, -30),
        periodStart: ty.taxYearStart,
        periodEnd: ty.taxYearEnd,
        recurrence: "Annual",
        calculationBasis:
          `PSA must be agreed with HMRC before 6 July ${ty.taxYearEnd.getUTCFullYear()} ` +
          `(following tax year ending 5 April ${ty.taxYearEnd.getUTCFullYear()})`,
        humanExplanation:
          `Entity has PSA required = Yes. The PAYE Settlement Agreement must be reviewed or ` +
          `renewed with HMRC before 6 July. Tax year: ${tyLabel}.`,
      });
      push({
        ruleId: "PSA-PAYMENT",
        regime: "PSA",
        obligationType: "Payment",
        description: `PSA tax and NIC calculation and payment — tax year ${tyLabel}`,
        statutoryBasis: "SI 1996/2631 reg 111",
        filingDeadline: ty.psaPaymentDeadline,
        paymentDeadline: ty.psaPaymentDeadline,
        internalTargetDate: addDays(ty.psaPaymentDeadline, -14),
        periodStart: ty.taxYearStart,
        periodEnd: ty.taxYearEnd,
        recurrence: "Annual",
        calculationBasis:
          `22 October ${ty.taxYearEnd.getUTCFullYear()} ` +
          `(following tax year ending 5 April ${ty.taxYearEnd.getUTCFullYear()})`,
        humanExplanation:
          `PSA tax and NIC calculation must be completed and payment made by 22 October ` +
          `(19 October for non-electronic). Tax year: ${tyLabel}.`,
      });
    }
  }

  // ── ERS ──────────────────────────────────────────────────────────────────
  if (entity.hasErs) {
    for (const ty of employmentTaxYears(today)) {
      const tyLabel = `${ty.taxYearStart.getUTCFullYear()}/${String(ty.taxYearEnd.getUTCFullYear()).slice(-2)}`;
      push({
        ruleId: "ERS-ANNUAL",
        regime: "ERS",
        obligationType: "Filing",
        description: `ERS annual return — tax year ${tyLabel}`,
        statutoryBasis: "ITEPA 2003 s421JA; applicable ERS scheme regulations",
        filingDeadline: ty.p11dDeadline,
        internalTargetDate: addDays(ty.p11dDeadline, -21),
        periodStart: ty.taxYearStart,
        periodEnd: ty.taxYearEnd,
        recurrence: "Annual",
        calculationBasis:
          `6 July ${ty.taxYearEnd.getUTCFullYear()} — following tax year ending 5 April ${ty.taxYearEnd.getUTCFullYear()}`,
        humanExplanation:
          `Entity has ERS scheme present = Yes. The ERS annual return must be filed via HMRC ` +
          `PAYE online by 6 July. Tax year: ${tyLabel}.`,
      });
    }
  }

  // ── EMI ──────────────────────────────────────────────────────────────────
  if (entity.hasEmi) {
    for (const ty of employmentTaxYears(today)) {
      const tyLabel = `${ty.taxYearStart.getUTCFullYear()}/${String(ty.taxYearEnd.getUTCFullYear()).slice(-2)}`;
      push({
        ruleId: "EMI-ANNUAL",
        regime: "EMI",
        obligationType: "Filing",
        description: `EMI annual return — tax year ${tyLabel}`,
        statutoryBasis: "ITEPA 2003 Sch 5; ITEPA 2003 s421JA",
        filingDeadline: ty.p11dDeadline,
        internalTargetDate: addDays(ty.p11dDeadline, -21),
        periodStart: ty.taxYearStart,
        periodEnd: ty.taxYearEnd,
        recurrence: "Annual",
        calculationBasis:
          `6 July ${ty.taxYearEnd.getUTCFullYear()} — EMI options are reported via the ERS annual return`,
        humanExplanation:
          `Entity has EMI scheme present = Yes. EMI option grants and exercises must be reported ` +
          `in the ERS annual return by 6 July. Tax year: ${tyLabel}.`,
      });
    }
  }

  // ── R&D ──────────────────────────────────────────────────────────────────
  if (entity.rdClaimExpected && ape) {
    if (entity.rdNotificationNeeded) {
      push({
        ruleId: "RD-NOTIFICATION",
        regime: "R&D",
        obligationType: "R&D claim notification",
        description: `R&D claim notification — period ending ${fmtShort(ape)}`,
        statutoryBasis: "FA 2023 s18; CTA 2009 s1142A",
        filingDeadline: addMonths(ape, 6),
        internalTargetDate: addMonths(ape, 4),
        periodStart: aps ?? null,
        periodEnd: ape,
        recurrence: "Annual",
        calculationBasis:
          `6 months after accounting period end (${fmtShort(ape)})`,
        humanExplanation:
          `Entity has R&D claim expected = Yes and R&D notification required = Yes. ` +
          `New and lapsed R&D claimants must submit an advance claim notification to HMRC ` +
          `within 6 months of the accounting period end. ⚠ Verify whether notification applies ` +
          `with your tax adviser (depends on prior claim history).`,
      });
    }

    if (entity.rdAifNeeded) {
      push({
        ruleId: "RD-AIF",
        regime: "R&D",
        obligationType: "R&D additional information form",
        description: `R&D Additional Information Form — period ending ${fmtShort(ape)}`,
        statutoryBasis: "FA 2023 s18; HMRC R&D Additional Information Form requirement",
        filingDeadline: addMonths(ape, 11),
        internalTargetDate: addMonths(ape, 10),
        periodStart: aps ?? null,
        periodEnd: ape,
        recurrence: "Annual",
        calculationBasis:
          `Must be submitted before the CT600. Internal target: 11 months after ` +
          `accounting period end (${fmtShort(ape)})`,
        humanExplanation:
          `Entity has R&D AIF needed = Yes. The Additional Information Form is mandatory ` +
          `and must be submitted to HMRC before the R&D claim can be included in the CT600.`,
      });
    }

    push({
      ruleId: "RD-EVIDENCE",
      regime: "R&D",
      obligationType: "R&D technical evidence pack",
      description: `R&D technical evidence pack — period ending ${fmtShort(ape)}`,
      statutoryBasis: "HMRC CIRD guidance; R&D relief substantiation best practice",
      filingDeadline: addMonths(ape, 10),
      internalTargetDate: addMonths(ape, 9),
      periodStart: aps ?? null,
      periodEnd: ape,
      recurrence: "Annual",
      calculationBasis:
        `Internal target: 10 months after accounting period end (${fmtShort(ape)}), ` +
        `to allow review before CT600 filing`,
      humanExplanation:
        `Entity has R&D claim expected = Yes. An R&D technical evidence pack (project ` +
        `descriptions, qualifying expenditure analysis, nexus with advance in science or ` +
        `technology) must be prepared and retained.`,
    });

    push({
      ruleId: "RD-REVIEW",
      regime: "R&D",
      obligationType: "R&D claim review before CT600 submission",
      description: `R&D claim review before CT600 — period ending ${fmtShort(ape)}`,
      statutoryBasis: "HMRC CIRD guidance; Governance best practice",
      filingDeadline: addMonths(ape, 11),
      internalTargetDate: addMonths(ape, 10),
      periodStart: aps ?? null,
      periodEnd: ape,
      recurrence: "Annual",
      calculationBasis:
        `Internal target: 11 months after AP end (${fmtShort(ape)}), ` +
        `1 month before CT600 statutory deadline`,
      humanExplanation:
        `The R&D claim must be reviewed and signed off internally before the CT600 is filed. ` +
        `This ensures the claim is defensible, correctly quantified and supported by evidence.`,
    });
  }

  // ── Capital Allowances ───────────────────────────────────────────────────
  if (entity.capitalAllowancesActivity && ape) {
    push({
      ruleId: "CA-CAPEX",
      regime: "Capital Allowances",
      obligationType: "Capital expenditure evidence collection",
      description: `Capital expenditure evidence collection — period ending ${fmtShort(ape)}`,
      statutoryBasis: "CAA 2001 ss.1–570; Governance best practice",
      filingDeadline: addMonths(ape, 8),
      internalTargetDate: addMonths(ape, 7),
      periodStart: aps ?? null,
      periodEnd: ape,
      recurrence: "Annual",
      calculationBasis:
        `Internal target: 8 months after accounting period end (${fmtShort(ape)})`,
      humanExplanation:
        `Entity has capital allowances activity = Yes. Capital expenditure must be identified, ` +
        `evidenced and classified by reference to the fixed asset register and underlying contracts.`,
    });

    push({
      ruleId: "CA-FAR",
      regime: "Capital Allowances",
      obligationType: "Fixed asset register review",
      description: `Fixed asset register review — period ending ${fmtShort(ape)}`,
      statutoryBasis: "CAA 2001; Governance best practice",
      filingDeadline: addMonths(ape, 9),
      internalTargetDate: addMonths(ape, 8),
      periodStart: aps ?? null,
      periodEnd: ape,
      recurrence: "Annual",
      calculationBasis:
        `Internal target: 9 months after accounting period end (${fmtShort(ape)})`,
      humanExplanation:
        `The fixed asset register must be reviewed to confirm additions, disposals and ` +
        `pool movements for the accounting period. This is a prerequisite for computing ` +
        `capital allowances positions.`,
    });

    push({
      ruleId: "CA-AIA",
      regime: "Capital Allowances",
      obligationType: "AIA review",
      description: `AIA / full expensing / special rate review — period ending ${fmtShort(ape)}`,
      statutoryBasis: "CAA 2001 ss.38A–51O; F(No.2)A 2023 (full expensing permanence)",
      filingDeadline: addMonths(ape, 9),
      internalTargetDate: addMonths(ape, 8),
      periodStart: aps ?? null,
      periodEnd: ape,
      recurrence: "Annual",
      calculationBasis:
        `Internal target: 9 months after accounting period end (${fmtShort(ape)})`,
      humanExplanation:
        `Review qualifying plant and machinery expenditure for AIA (up to £1m), full expensing ` +
        `(100% first-year allowance), and 50% special rate allowance. Confirm eligible pools ` +
        `and available claims to include in CT computation.`,
    });

    push({
      ruleId: "CA-CT",
      regime: "Capital Allowances",
      obligationType: "Capital allowances position included in CT computation",
      description: `Capital allowances position in CT computation — period ending ${fmtShort(ape)}`,
      statutoryBasis: "CAA 2001; CTA 2010",
      filingDeadline: addMonths(ape, 11),
      internalTargetDate: addMonths(ape, 10),
      periodStart: aps ?? null,
      periodEnd: ape,
      recurrence: "Annual",
      calculationBasis:
        `Internal target: 11 months after accounting period end (${fmtShort(ape)}), ` +
        `ahead of CT600 filing`,
      humanExplanation:
        `Capital allowances pools and claims must be reflected in the CT computation ` +
        `and signed off before the CT600 is filed. No calculation of allowance amounts ` +
        `is made here — this is a review and sign-off workflow.`,
    });
  }

  // ── SAO ──────────────────────────────────────────────────────────────────
  if (entity.saoInScope && ape) {
    push({
      ruleId: "SAO-EVIDENCE",
      regime: "SAO",
      obligationType: "Evidence preparation",
      description: `SAO evidence preparation — period ending ${fmtShort(ape)}`,
      statutoryBasis: "FA 2009 Sch 46; HMRC SAO guidance",
      filingDeadline: addMonths(ape, 11),
      internalTargetDate: addMonths(ape, 10),
      periodStart: aps ?? null,
      periodEnd: ape,
      recurrence: "Annual",
      calculationBasis:
        `Internal target: 11 months after accounting period end (${fmtShort(ape)})`,
      humanExplanation:
        `Entity has SAO in scope = Yes. The Senior Accounting Officer must be identified ` +
        `and supporting evidence of adequate tax accounting arrangements assembled before ` +
        `the certification is submitted.`,
    });

    push({
      ruleId: "SAO-CERT",
      regime: "SAO",
      obligationType: "Approval",
      description: `SAO certification — period ending ${fmtShort(ape)}`,
      statutoryBasis: "FA 2009 Sch 46 para 1; HMRC SAO guidance",
      filingDeadline: addMonths(ape, 12),
      internalTargetDate: addMonths(ape, 11),
      periodStart: aps ?? null,
      periodEnd: ape,
      recurrence: "Annual",
      calculationBasis:
        `12 months after accounting period end (${fmtShort(ape)}) — same as CT600 filing deadline`,
      humanExplanation:
        `The SAO must certify (or qualify) to HMRC within 12 months of the accounting period ` +
        `end. The SAO is personally liable for a £5,000 penalty per failure to certify.`,
    });
  }

  // ── Published Tax Strategy ───────────────────────────────────────────────
  if (entity.publishedTaxStrategyInScope && ape) {
    push({
      ruleId: "PTS-REVIEW",
      regime: "Published Tax Strategy",
      obligationType: "Review",
      description: `Published Tax Strategy internal review — period ending ${fmtShort(ape)}`,
      statutoryBasis: "FA 2016 Sch 19; HMRC Large Business Tax Strategy guidance",
      filingDeadline: addMonths(ape, -3),
      internalTargetDate: addMonths(ape, -4),
      periodStart: aps ?? null,
      periodEnd: ape,
      recurrence: "Annual",
      calculationBasis:
        `Internal review target: 3 months before accounting period end (${fmtShort(ape)}), ` +
        `to allow time for publication before the period ends`,
      humanExplanation:
        `Entity has Published Tax Strategy in scope = Yes. The tax strategy must be reviewed ` +
        `and updated annually. Large businesses must publish their strategy before the financial ` +
        `year ends — £7,500 penalty (first offence) for failure to publish.`,
    });

    push({
      ruleId: "PTS-PUB",
      regime: "Published Tax Strategy",
      obligationType: "Approval",
      description: `Published Tax Strategy publication — period ending ${fmtShort(ape)}`,
      statutoryBasis: "FA 2016 Sch 19 para 16(3)",
      filingDeadline: ape,
      internalTargetDate: addMonths(ape, -1),
      periodStart: aps ?? null,
      periodEnd: ape,
      recurrence: "Annual",
      calculationBasis:
        `Must be published before the end of the financial year (${fmtShort(ape)})`,
      humanExplanation:
        `The Published Tax Strategy must be approved internally and published on the ` +
        `company's website before the accounting period ends. It must be accessible to ` +
        `the public on a UK-facing website.`,
    });
  }

  // ── Pillar 2 ─────────────────────────────────────────────────────────────
  if (entity.hasPillar2 && ape) {
    push({
      ruleId: "P2-PLACEHOLDER",
      regime: "Pillar 2",
      obligationType: "Registration",
      description: `Pillar 2 registration / reporting review — period ending ${fmtShort(ape)} ⚠ Dates require human review`,
      statutoryBasis: "Finance (No.2) Act 2023 (Pillar 2 — global minimum tax); HMRC Pillar 2 guidance",
      filingDeadline: addMonths(ape, 15),
      internalTargetDate: addMonths(ape, 12),
      periodStart: aps ?? null,
      periodEnd: ape,
      recurrence: "Annual",
      calculationBasis:
        `PLACEHOLDER: 15 months after AP end (${fmtShort(ape)}). ` +
        `Pillar 2 reporting timelines are evolving — this date MUST be reviewed and confirmed ` +
        `by a tax owner or adviser before relying on it.`,
      humanExplanation:
        `Entity has Pillar 2 in scope = Yes. Pillar 2 (global minimum tax of 15%) may ` +
        `require registration, top-up tax payments, and GloBE Information Return (GIR) ` +
        `filing. Applies to MNE groups with consolidated revenue ≥ €750m. All dates are ` +
        `indicative placeholders — verify with HMRC or your adviser.`,
    });
  }

  return drafts;
}

/** Deduplication key for a draft: entity + rule + period start (if any) */
export function dedupKey(entityId: string, ruleId: string, periodStart: Date | null): string {
  const ps = periodStart ? periodStart.toISOString().slice(0, 10) : "no-period";
  return `${entityId}::${ruleId}::${ps}`;
}
