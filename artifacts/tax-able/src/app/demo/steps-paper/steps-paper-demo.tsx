"use client";

import { useMemo, useState } from "react";

type PanelId = "deadlines" | "readiness" | "exceptions";

/** Evidence-quality grade. Distinct from a clock's legal authority — see SPEC-006. */
type Grade = "A" | "B" | "C" | "D" | "E";

const gradeLabel: Record<Grade, string> = {
  A: "A · authoritative",
  B: "B · professional advice",
  C: "C · corroborated client info",
  D: "D · unverified",
  E: "E · inference / assumption",
};

/** A grade below C may not operate a control until a named person verifies it. */
const OPERABLE_GRADES: Grade[] = ["A", "B", "C"];

type DateStatus = "KNOWN" | "DERIVED" | "CONDITIONAL" | "UNDEFINED";

type Obligation = {
  id: string;
  title: string;
  party: string;
  clock: string;
  dateStatus: DateStatus;
  /** Days from completion, for DERIVED items only. */
  offsetDays?: number;
  /** Fixed statutory or contractual date, for KNOWN items only. */
  fixedDate?: string;
  consequence: string;
};

const obligations: Obligation[] = [
  {
    id: "O-01",
    title: "s431 elections on shares and loan notes",
    party: "Every UK employee acquirer",
    clock: "14 days from acquisition",
    dateStatus: "DERIVED",
    offsetDays: 14,
    consequence: "Irreversible. Income charge on later chargeable events, rolling into replacement securities.",
  },
  {
    id: "O-02",
    title: "Stamp duty notified and paid",
    party: "[BIDCO]",
    clock: "30 days from the transfer",
    dateStatus: "DERIVED",
    offsetDays: 30,
    consequence: "Interest and penalties; register not written up.",
  },
  {
    id: "O-03",
    title: "VAT registration application",
    party: "[BIDCO]",
    clock: "30 days from completion, effective from completion",
    dateStatus: "DERIVED",
    offsetDays: 30,
    consequence: "Loss of recovery on c.£1.3m of deal fees.",
  },
  {
    id: "O-04",
    title: "Transfer pricing debt defence paper",
    party: "[INVESTOR] / tax adviser",
    clock: "0–3 months post completion",
    dateStatus: "DERIVED",
    offsetDays: 90,
    consequence: "Shareholder interest deduction unsupported.",
  },
  {
    id: "O-05",
    title: "EBT established and unallocated sweet warehoused",
    party: "[SELL-SIDE LEGAL]",
    clock: "Within 3 months of completion",
    dateStatus: "DERIVED",
    offsetDays: 90,
    consequence: "Sweet equity unissued; completion valuation goes stale.",
  },
  {
    id: "O-06",
    title: "Loan notes listed before the first coupon",
    party: "[INVESTOR] / lawyers",
    clock: "Recommended first coupon no sooner than 4 months post completion",
    dateStatus: "DERIVED",
    offsetDays: 120,
    consequence: "20% withholding on that payment. Not curable retrospectively.",
  },
  {
    id: "O-07",
    title: "Upstream loan settled or distributed",
    party: "Management",
    clock: "9 months and 1 day after the accounting period end",
    dateStatus: "KNOWN",
    fixedDate: "2026-10-01",
    consequence: "33.75% charge, refundable only 9 months and a day after later settlement.",
  },
  {
    id: "O-08",
    title: "Annual ERS and EMI returns",
    party: "Management",
    clock: "6 July following the tax year",
    dateStatus: "KNOWN",
    fixedDate: "2026-07-06",
    consequence: "Penalties; recurring every year.",
  },
  {
    id: "O-09",
    title: "First EBITDA measurement and contingent note issue",
    party: "[BIDCO]",
    clock: "After the accounting period end",
    dateStatus: "KNOWN",
    fixedDate: "2025-12-31",
    consequence: "Earn-out dispute; s431 clock starts on issue.",
  },
  {
    id: "O-10",
    title: "Second EBITDA measurement, with catch-up",
    party: "[BIDCO]",
    clock: "After the accounting period end",
    dateStatus: "KNOWN",
    fixedDate: "2026-12-31",
    consequence: "As above.",
  },
  {
    id: "O-11",
    title: "Recover deal-cost VAT on the first return",
    party: "[BIDCO]",
    clock: "First VAT return period post completion",
    dateStatus: "CONDITIONAL",
    consequence: "Recovery deferred; repayment return will attract scrutiny.",
  },
  {
    id: "O-12",
    title: "s431 elections on the contingent loan notes",
    party: "Each CLN holder",
    clock: "14 days from each issue",
    dateStatus: "CONDITIONAL",
    consequence: "Irreversible, and it recurs on each of two issues.",
  },
  {
    id: "O-13",
    title: "Employer NIC on contingent note redemption",
    party: "[TARGET]",
    clock: "On a future exit",
    dateStatus: "CONDITIONAL",
    consequence: "Unfunded liability years after the deal team has moved on.",
  },
  {
    id: "O-14",
    title: "Register for corporation tax and payroll taxes",
    party: "[BIDCO]",
    clock: "“ASAP post completion”",
    dateStatus: "UNDEFINED",
    consequence: "Penalties. The source gives no computable deadline.",
  },
  {
    id: "O-15",
    title: "Partial exemption impact of the upstream loan assessed",
    party: "Management",
    clock: "“post completion”",
    dateStatus: "UNDEFINED",
    consequence: "VAT recovery restriction. The source gives no date.",
  },
];

type Control = {
  id: string;
  title: string;
  owner: string | null;
  grade: Grade;
  survives: boolean;
  blocker?: string;
};

const controls: Control[] = [
  { id: "C-01", title: "s431 elections signed on every instrument", owner: "Lawyers / management", grade: "A", survives: true },
  { id: "C-02", title: "Loan notes listed before any interest payment or PIK", owner: "[INVESTOR] / lawyers", grade: "A", survives: true },
  { id: "C-04", title: "Bidco VAT registration effective from completion", owner: "Management", grade: "A", survives: false },
  { id: "C-06", title: "Engagements novated; invoices to and paid by [BIDCO]", owner: "Management / advisers", grade: "B", survives: false },
  { id: "C-07", title: "Substance: hive up finance function or non-common directors", owner: "Management", grade: "B", survives: true },
  { id: "C-10", title: "Stamp duty paid and forms processed", owner: "Lawyers", grade: "A", survives: false },
  { id: "C-11", title: "Loan capital exemption conditions reflected in the instruments", owner: "Lawyers", grade: "A", survives: false },
  { id: "C-13", title: "Upstream loan documented as fees-only", owner: "Management / lawyers", grade: "D", survives: false, blocker: "Rests on an adviser recommendation, not a reviewed instrument" },
  { id: "C-14", title: "Upstream loan settled or distributed", owner: "Management", grade: "A", survives: true },
  { id: "C-16", title: "Independent valuation for every post-completion equity issue", owner: null, grade: "D", survives: true, blocker: "No owner. Recommended by the paper, excluded from its scope, absent from the action table" },
  { id: "C-18", title: "Trustees not told of exact CLN payments until shortly before distribution", owner: null, grade: "E", survives: true, blocker: "No owner, no evidence artefact, behavioural control" },
  { id: "C-19", title: "Transfer pricing debt defence paper", owner: "[INVESTOR] / tax adviser", grade: "C", survives: true },
  { id: "C-23", title: "Separate fee notes for debt-related and equity-related work", owner: null, grade: "D", survives: false, blocker: "No owner. Practically irreversible once invoices are raised" },
  { id: "C-25", title: "Group relief and loss utilisation reviewed", owner: null, grade: "D", survives: true, blocker: "No owner. Source says only “consideration should be given”" },
  { id: "C-27", title: "Uncertain tax treatment notification assessment", owner: null, grade: "E", survives: true, blocker: "No owner. Expressly disclaimed by the adviser" },
  { id: "C-29", title: "Employer NIC funded at CLN redemption on exit", owner: "Management", grade: "A", survives: true },
  { id: "C-30", title: "Fresh tax advice before any refinancing", owner: "[INVESTOR]", grade: "E", survives: true, blocker: "Deferred entirely by the source" },
];

type Exception = {
  id: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  issue: string;
  effect: string;
};

const exceptions: Exception[] = [
  { id: "QI-16", severity: "Critical", issue: "The completion date appears nowhere in the document", effect: "Almost every deadline is expressed relative to completion. No date can be calculated from the source." },
  { id: "QI-04", severity: "High", issue: "Disclosure-regime statement reads “we do/do not consider that it is disclosable”", effect: "An unresolved drafting placeholder in a document marked final. The position is genuinely unstated." },
  { id: "QI-02", severity: "High", issue: "Two subsidiaries described as standalone VAT registered and, in the next sentence, as having submitted a group registration", effect: "Both cannot be true. Material to the standalone-registration recommendation and to partial exemption." },
  { id: "QI-03", severity: "High", issue: "VAT registration timing given three ways: 0–14 days, effective from completion, application within 30 days", effect: "Three operational deadlines for the control protecting c.£1.3m of fees." },
  { id: "QI-14", severity: "High", issue: "Valuations recommended, expressly excluded from scope, and absent from the action tables", effect: "A recurring, indefinite control belonging to nobody." },
  { id: "QI-01", severity: "High", issue: "Action table requires s83(b) elections; the narrative states they will not be made", effect: "The table instructs an action the narrative says will not happen." },
  { id: "QI-05", severity: "Medium", issue: "Two unreconciled director-loan facts", effect: "No close-company analysis of the historic loan." },
  { id: "QI-06", severity: "Medium", issue: "EOT contingent note entitlement stated as £2.19m twice and £2.17m once", effect: "One figure is wrong, and it forms part of the stamp duty base." },
  { id: "QI-07", severity: "Medium", issue: "The defined term “Rolling Vendors” does not match the capitalisation table total", effect: "A party whose securities status is contested is included in a total the definition excludes him from." },
  { id: "QI-12", severity: "Medium", issue: "“We have included some high-level comments below” — no such comments follow", effect: "Promised content missing." },
  { id: "QI-13", severity: "Medium", issue: "Advice to obtain separate fee notes appears with no corresponding action", effect: "Advice with no action, and practically irreversible once invoiced." },
  { id: "QI-10", severity: "Medium", issue: "Timeline item carries a month earlier than the report date", effect: "Stale template date; the first timeline entry is unusable." },
  { id: "QI-17", severity: "Medium", issue: "All eight VAT action points show status “Outstanding” days before the expected transaction", effect: "Either the status column is stale or the programme is behind." },
  { id: "QI-18", severity: "Low", issue: "Devolved anti-avoidance boilerplate with no relevant nexus; inconsistent abbreviations; a postcode mismatch", effect: "Template-driven drafting, which raises the prior on the unresolved placeholder above." },
];

const DAY = 86_400_000;

function addDays(iso: string, days: number) {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * DAY)
    .toISOString()
    .slice(0, 10);
}

function fmt(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Resolve an obligation's date. Returns null where the source cannot support one. */
function resolveDate(obligation: Obligation, completion: string | null) {
  if (obligation.dateStatus === "KNOWN") return obligation.fixedDate ?? null;
  if (obligation.dateStatus === "DERIVED" && completion && obligation.offsetDays !== undefined) {
    return addDays(completion, obligation.offsetDays);
  }
  return null;
}

const panels: Array<{ id: PanelId; label: string }> = [
  { id: "deadlines", label: "Deadlines" },
  { id: "readiness", label: "Readiness" },
  { id: "exceptions", label: "Exceptions" },
];

export function StepsPaperDemo() {
  const [panel, setPanel] = useState<PanelId>("deadlines");
  const [completion, setCompletion] = useState<string | null>(null);

  const derivedCount = obligations.filter((o) => o.dateStatus === "DERIVED").length;
  const undefinedCount = obligations.filter((o) => o.dateStatus === "UNDEFINED").length;
  const conditionalCount = obligations.filter((o) => o.dateStatus === "CONDITIONAL").length;

  const resolved = useMemo(() => {
    return obligations
      .map((o) => ({ obligation: o, date: resolveDate(o, completion) }))
      .sort((a, b) => {
        if (a.date && b.date) return a.date.localeCompare(b.date);
        if (a.date) return -1;
        if (b.date) return 1;
        return 0;
      });
  }, [completion]);

  const datedCount = resolved.filter((r) => r.date).length;

  const blocked = controls.filter(
    (c) => c.owner === null || !OPERABLE_GRADES.includes(c.grade),
  );
  const unowned = controls.filter((c) => c.owner === null);
  const surviving = blocked.filter((c) => c.survives);

  return (
    <div className="matter-demo sp-demo">
      <header className="matter-heading">
        <div className="matter-heading-main">
          <div className="matter-breadcrumbs">
            <span>Advice &amp; sources</span>
            <span>/</span>
            <span>Steps papers</span>
          </div>
          <div className="matter-title-row">
            <h1>Transaction steps report</h1>
            <span className="matter-status matter-status-blocked">
              {blocked.length} controls cannot go live
            </span>
          </div>
          <p>
            45 pages · {obligations.length} obligations · {controls.length} proposed controls ·{" "}
            {exceptions.length} document exceptions · illustrative, anonymised
          </p>
        </div>
        <div className="matter-heading-actions">
          <button className="matter-button matter-button-secondary" type="button">
            Open source
          </button>
          <button className="matter-button matter-button-primary" type="button">
            Send to author
          </button>
        </div>
      </header>

      <nav aria-label="Sections" className="matter-tabs">
        {panels.map((item) => (
          <button
            aria-current={panel === item.id ? "page" : undefined}
            className={panel === item.id ? "active" : ""}
            key={item.id}
            onClick={() => setPanel(item.id)}
            type="button"
          >
            {item.label}
            <span>
              {item.id === "deadlines"
                ? obligations.length
                : item.id === "readiness"
                  ? blocked.length
                  : exceptions.length}
            </span>
          </button>
        ))}
      </nav>

      {panel === "deadlines" && (
        <section className="matter-tab-panel">
          <div className={`sp-root ${completion ? "sp-root-set" : "sp-root-missing"}`}>
            <div>
              <strong>
                {completion
                  ? `Completion set — ${datedCount} of ${obligations.length} obligations now dated`
                  : `One missing date blocks ${derivedCount} obligations`}
              </strong>
              <p>
                {completion
                  ? "Every derived deadline below is calculated from this one input. Change it and they all move."
                  : "The source expresses most deadlines relative to completion, and never states the completion date. Supply it once."}
              </p>
            </div>
            <label className="sp-root-input">
              <span>Completion date</span>
              <input
                onChange={(event) => setCompletion(event.target.value || null)}
                type="date"
                value={completion ?? ""}
              />
            </label>
          </div>

          <ul className="sp-obligations">
            {resolved.map(({ obligation, date }) => (
              <li key={obligation.id}>
                <span
                  className={`sp-date sp-date-${
                    date
                      ? obligation.dateStatus.toLowerCase()
                      : obligation.dateStatus === "DERIVED"
                        ? "unresolved"
                        : obligation.dateStatus.toLowerCase()
                  }`}
                >
                  {date ? (
                    fmt(date)
                  ) : obligation.dateStatus === "DERIVED" ? (
                    "awaiting completion"
                  ) : obligation.dateStatus === "CONDITIONAL" ? (
                    "event-driven"
                  ) : (
                    "no date in source"
                  )}
                </span>
                <span className="sp-obligation-body">
                  <strong>{obligation.title}</strong>
                  <small>
                    {obligation.party} · {obligation.clock}
                  </small>
                  <em>{obligation.consequence}</em>
                </span>
                <span className={`sp-status sp-status-${obligation.dateStatus.toLowerCase()}`}>
                  {obligation.dateStatus}
                </span>
              </li>
            ))}
          </ul>

          <p className="sp-note">
            {undefinedCount} obligations carry no computable deadline because the source says only
            “ASAP” or “post completion”. {conditionalCount} depend on an event that has not
            happened. Neither is given an invented date.
          </p>
        </section>
      )}

      {panel === "readiness" && (
        <section className="matter-tab-panel">
          <div className="sp-readiness-summary">
            <div>
              <strong>{unowned.length}</strong>
              <span>controls with no owner</span>
            </div>
            <div>
              <strong>{blocked.length - unowned.length}</strong>
              <span>owned, but resting on grade D or E</span>
            </div>
            <div className="sp-readiness-alarm">
              <strong>{surviving.length}</strong>
              <span>of the blocked survive completion</span>
            </div>
          </div>

          <ul className="sp-controls">
            {[...controls]
              .sort((a, b) => {
                const aBlocked = blocked.includes(a) ? 0 : 1;
                const bBlocked = blocked.includes(b) ? 0 : 1;
                return aBlocked - bBlocked || a.grade.localeCompare(b.grade);
              })
              .map((control) => {
                const isBlocked = blocked.includes(control);
                return (
                  <li className={isBlocked ? "sp-control blocked" : "sp-control"} key={control.id}>
                    <span className={`sp-grade sp-grade-${control.grade}`}>{control.grade}</span>
                    <span className="sp-control-body">
                      <strong>{control.title}</strong>
                      <small>
                        {control.owner ?? "No owner"} · {gradeLabel[control.grade]}
                        {control.survives && " · survives completion"}
                      </small>
                      {control.blocker && <em>{control.blocker}</em>}
                    </span>
                    <span
                      className={
                        isBlocked ? "response-state" : "response-state accepted"
                      }
                    >
                      {isBlocked ? "Blocked" : "Can go live"}
                    </span>
                  </li>
                );
              })}
          </ul>

          <p className="sp-note">
            A control may operate on grade A, B or C. Grade D or E requires a named verifier first —
            the record will not let an unverified assertion become an operating control.
          </p>
        </section>
      )}

      {panel === "exceptions" && (
        <section className="matter-tab-panel">
          <ul className="sp-exceptions">
            {exceptions.map((exception) => (
              <li key={exception.id}>
                <span className={`sp-severity sp-severity-${exception.severity.toLowerCase()}`}>
                  {exception.severity}
                </span>
                <span className="sp-exception-body">
                  <strong>{exception.issue}</strong>
                  <small>{exception.effect}</small>
                </span>
                <span className="sp-exception-id">{exception.id}</span>
              </li>
            ))}
          </ul>
          <p className="sp-note">
            Exceptions are raised, not resolved. The record does not silently correct a source
            document — it puts the contradiction in front of the person who can answer it.
          </p>
        </section>
      )}

      <p className="ip-boundary">
        Illustrative worked example built from an anonymised transaction steps report. Party names,
        figures and conclusions are the source&rsquo;s own or invented; none is verified here, and no
        treatment is concluded.
      </p>
    </div>
  );
}
