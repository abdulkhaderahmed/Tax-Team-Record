export type EntityData = {
  accountingYearEndMonth: number; // 1–12
  accountingYearEndDay: number; // 1–31
  vatQuarterEndMonth: number | null; // 1–12, null = not VAT registered
  isLargeCompany: boolean;
  isVeryLargeCompany: boolean;
  hasErs: boolean;
  hasPillar2: boolean;
};

export type DraftObligation = {
  ruleKey: string;
  ruleId: string;
  title: string;
  dueDate: Date;
  period: string;
};

export function generateDraftObligations(
  entity: EntityData,
  rules: { id: string; ruleKey: string }[]
): DraftObligation[] {
  const ruleMap = new Map(rules.map((r) => [r.ruleKey, r.id]));
  const results: DraftObligation[] = [];
  const today = new Date();
  const baseYear = today.getFullYear();

  // ── Corporation Tax obligations ────────────────────────────────────────────
  // Generate for accounting periods ending in baseYear-1 through baseYear+2
  for (let offset = -1; offset <= 2; offset++) {
    const apEndYear = baseYear + offset;
    const yearEnd = new Date(
      apEndYear,
      entity.accountingYearEndMonth - 1,
      entity.accountingYearEndDay
    );

    // AP start = year end minus 1 year + 1 day
    const apStart = new Date(yearEnd);
    apStart.setFullYear(apStart.getFullYear() - 1);
    apStart.setDate(apStart.getDate() + 1);

    const period = `AP ${fmtDate(apStart)} – ${fmtDate(yearEnd)}`;

    // CT600 filing: 12 months after year end
    const ct600Due = new Date(yearEnd);
    ct600Due.setFullYear(ct600Due.getFullYear() + 1);
    push(results, ruleMap, "CT600_FILING", "CT600 Filing", ct600Due, period);

    if (entity.isVeryLargeCompany) {
      // QIP 1: 14th of 7th month of AP
      push(
        results,
        ruleMap,
        "CT_QIP_1",
        "Corporation Tax QIP 1",
        new Date(apStart.getFullYear(), apStart.getMonth() + 6, 14),
        period
      );
      // QIP 2: 14th of 10th month of AP
      push(
        results,
        ruleMap,
        "CT_QIP_2",
        "Corporation Tax QIP 2",
        new Date(apStart.getFullYear(), apStart.getMonth() + 9, 14),
        period
      );
      // QIP 3: 14th of 1st month after AP end
      push(
        results,
        ruleMap,
        "CT_QIP_3",
        "Corporation Tax QIP 3",
        new Date(yearEnd.getFullYear(), yearEnd.getMonth() + 1, 14),
        period
      );
      // QIP 4: 14th of 4th month after AP end
      push(
        results,
        ruleMap,
        "CT_QIP_4",
        "Corporation Tax QIP 4",
        new Date(yearEnd.getFullYear(), yearEnd.getMonth() + 4, 14),
        period
      );
    } else {
      // Standard / large: 9 months + 1 day after year end
      const ctPayDue = new Date(yearEnd);
      ctPayDue.setMonth(ctPayDue.getMonth() + 9);
      ctPayDue.setDate(ctPayDue.getDate() + 1);
      push(
        results,
        ruleMap,
        "CT_PAYMENT_STANDARD",
        "Corporation Tax Payment",
        ctPayDue,
        period
      );
    }
  }

  // ── VAT quarterly returns ──────────────────────────────────────────────────
  // Calendar-based; iterate from a known quarter end before the window opens
  if (entity.vatQuarterEndMonth !== null) {
    const vatBase = entity.vatQuarterEndMonth; // month number, 1–12

    // Find the first quarter end on or just before (baseYear-1, Jan 1)
    const windowStart = new Date(baseYear - 1, 0, 1);
    const windowEnd = new Date(baseYear + 3, 0, 1);

    // Anchor: first instance of vatBase quarter in the year before windowStart
    let current = new Date(
      windowStart.getFullYear() - 1,
      vatBase - 1,
      // last day of vatBase month
      new Date(windowStart.getFullYear() - 1, vatBase, 0).getDate()
    );

    // Walk forward in 3-month increments until we pass windowEnd
    while (current < windowEnd) {
      const due = new Date(current);
      due.setMonth(due.getMonth() + 1);
      due.setDate(due.getDate() + 7);

      if (due >= windowStart) {
        const vatPeriod = `VAT quarter ended ${fmtDate(current)}`;
        push(
          results,
          ruleMap,
          "VAT_QUARTERLY_RETURN",
          "VAT Quarterly Return",
          due,
          vatPeriod
        );
      }

      // Advance to next quarter end (last day of +3 months)
      const nextMonth = current.getMonth() + 3;
      const nextYear =
        current.getFullYear() + Math.floor((current.getMonth() + 3) / 12);
      const normMonth = nextMonth % 12;
      const lastDay = new Date(nextYear, normMonth + 1, 0).getDate();
      current = new Date(nextYear, normMonth, lastDay);
    }
  }

  // ── P11D, P11D(b), ERS — 6 July each calendar year ───────────────────────
  for (let offset = -1; offset <= 2; offset++) {
    const calYear = baseYear + offset;
    const dueDate = new Date(calYear, 6, 6); // 6 July (month index 6)
    const taxYearStr = `${calYear - 1}–${String(calYear).slice(-2)}`;
    const taxPeriod = `Tax year ended 5 Apr ${calYear}`;

    push(results, ruleMap, "P11D", "P11D Expenses & Benefits", dueDate, taxPeriod);
    push(results, ruleMap, "P11D_B", "P11D(b) Class 1A NIC", dueDate, taxPeriod);

    if (entity.hasErs) {
      push(results, ruleMap, "ERS_ANNUAL_RETURN", "ERS Annual Return", dueDate, taxPeriod);
    }
  }

  // Deduplicate (same ruleKey + same due date) then sort chronologically
  const seen = new Set<string>();
  return results
    .filter((r) => {
      const key = `${r.ruleKey}:${r.dueDate.toISOString()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

function push(
  results: DraftObligation[],
  ruleMap: Map<string, string>,
  ruleKey: string,
  title: string,
  dueDate: Date,
  period: string
) {
  const ruleId = ruleMap.get(ruleKey);
  if (!ruleId) return;
  results.push({ ruleKey, ruleId, title, dueDate, period });
}

export function fmtDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtMonthName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString("en-GB", { month: "long" });
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export { MONTH_NAMES };
