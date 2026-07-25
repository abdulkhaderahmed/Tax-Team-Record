"use client";

import { useMemo, useState } from "react";

type PanelId = "windows" | "conditions" | "sweep";

type Basis = "statute" | "guidance" | "practice" | "unverified";

const basisLabel: Record<Basis, string> = {
  statute: "Statute",
  guidance: "HMRC guidance",
  practice: "Practice assumption",
  unverified: "Stated in source, unverified",
};

/** Demo "today" — fixed so the countdowns do not drift with the wall clock. */
const TODAY = new Date("2026-07-25T00:00:00Z");

function daysUntil(iso: string) {
  return Math.round(
    (new Date(`${iso}T00:00:00Z`).getTime() - TODAY.getTime()) / 86_400_000,
  );
}

function fmt(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function remaining(days: number) {
  if (days < 0) return "closed";
  if (days < 90) return `${days} days`;
  const months = Math.round(days / 30.4);
  if (months < 24) return `${months} months`;
  return `${(days / 365).toFixed(1)} years`;
}

type Window = {
  id: string;
  position: string;
  entity: string;
  kind: "Make" | "Amend" | "Claim" | "Revoke";
  closesOn: string;
  clockBasis: string;
  basis: Basis;
  defaultOutcome: string;
  decisionMaker: string;
  blockedBy: string[];
  consequence: string;
  funding?: { tax: string; cash: string; status: "covered" | "short" | "unknown"; asAt: string };
  exposedTo?: string;
  antiForestalling?: boolean;
};

const windows: Window[] = [
  {
    id: "W-01",
    position: "Disapply rollover on management replacement shares (s.169Q TCGA 1992)",
    entity: "12 managers · Northstar Bidco rollover",
    kind: "Make",
    closesOn: "2029-01-31",
    clockBasis: "Second 31 January following the tax year of the exchange (2026/27)",
    basis: "unverified",
    defaultOutcome:
      "Rollover treatment stands. Relief on the original shares is not claimed and cannot be recovered once the window closes.",
    decisionMaker: "Each manager personally",
    blockedBy: ["Remaining lifetime allowance per manager", "Whether Bidco shares will qualify on exit"],
    consequence: "A separate relief claim is required in addition to the election.",
    funding: { tax: "£1.42m across 12 managers", cash: "£0.31m cash at completion", status: "short", asAt: "Completion, 30 Jun 2026" },
    exposedTo: "Next fiscal event",
    antiForestalling: true,
  },
  {
    id: "W-02",
    position: "Holdover on gift of 8% holding to the family trust (s.260 TCGA 1992)",
    entity: "A Founder → Northstar Family Trust",
    kind: "Claim",
    closesOn: "2031-04-05",
    clockBasis: "Four years from the end of the tax year of the gift",
    basis: "practice",
    defaultOutcome:
      "The gift stands as a market-value disposal and the gain remains crystallised at the rate applying at the date of the gift.",
    decisionMaker: "Donor and trustees jointly",
    blockedBy: ["Confirmation the trust is not settlor-interested in a way that restricts the claim"],
    consequence: "Claiming defers the gain into the trustees' base cost.",
  },
  {
    id: "W-03",
    position: "Revoke the holdover claim if the expected sale re-emerges",
    entity: "A Founder → Northstar Family Trust",
    kind: "Revoke",
    closesOn: "2031-04-05",
    clockBasis: "By amended return, within the same four-year period",
    basis: "unverified",
    defaultOutcome: "The held-over gain stays with the trustees and is taxed on their later disposal.",
    decisionMaker: "Donor and trustees jointly",
    blockedBy: ["Whether revocation is available on these facts"],
    consequence: "Reinstating the gain runs interest from the original due date.",
  },
  {
    id: "W-04",
    position: "Treat the earn-out as satisfied in loan notes (s.138A TCGA 1992)",
    entity: "3 selling shareholders · earn-out tranche",
    kind: "Make",
    closesOn: "2027-01-31",
    clockBasis: "Deadline to be confirmed against the statutory wording",
    basis: "unverified",
    defaultOutcome:
      "The earn-out right is treated as unascertainable consideration and taxed on the original disposal at its valued amount.",
    decisionMaker: "Each selling shareholder",
    blockedBy: ["Whether the shareholder choice between cash and notes is settled in advance", "Valuation of the earn-out right"],
    consequence: "Deferral aligns tax with cash but delays access to proceeds.",
  },
];

type Condition = {
  id: string;
  subject: string;
  entity: string;
  startsOn: string;
  endsOn: string;
  duration: string;
  basis: Basis;
  breakingEvents: string[];
  onBreach: string;
  /** True where completing the transaction is itself one of the breaking events. */
  brokenByCompletion: boolean;
  status: "running" | "at-risk";
};

const conditions: Condition[] = [
  {
    id: "C-01",
    subject: "Business property relief on the gift to an individual survives",
    entity: "A Founder → adult child · 12% holding",
    startsOn: "2026-05-14",
    endsOn: "2033-05-14",
    duration: "7 years",
    basis: "statute",
    breakingEvents: [
      "The shares are sold before the donor's death within the period",
      "Replacement property conditions are not met",
      "The company ceases to qualify",
    ],
    onBreach: "Relief is lost or clawed back and the gift falls back into the seven-year cumulation.",
    brokenByCompletion: true,
    status: "at-risk",
  },
  {
    id: "C-02",
    subject: "Holding company holds the shares long enough for the exemption to apply on a later sale",
    entity: "Northstar Holdings Ltd · 30% of trading company",
    startsOn: "2026-06-30",
    endsOn: "2027-06-30",
    duration: "12 months",
    basis: "statute",
    breakingEvents: [
      "Sale completes before the period ends",
      "The target ceases to be a trading company",
      "Substantial non-trading assets accumulate",
    ],
    onBreach: "The exemption is unavailable and the corporate disposal is fully chargeable.",
    brokenByCompletion: true,
    status: "at-risk",
  },
  {
    id: "C-03",
    subject: "Loan notes held before redemption",
    entity: "3 selling shareholders · earn-out tranche",
    startsOn: "2026-06-30",
    endsOn: "2026-12-30",
    duration: "6 months",
    basis: "unverified",
    breakingEvents: ["Redemption or disposal before the period ends"],
    onBreach: "Deferral is not obtained and the gain arises on the original disposal.",
    brokenByCompletion: false,
    status: "running",
  },
  {
    id: "C-04",
    subject: "Options held before exercise for tax-advantaged treatment",
    entity: "Management incentive plan · routes 1 and 3",
    startsOn: "2026-07-03",
    endsOn: "2029-07-03",
    duration: "3 years",
    basis: "statute",
    breakingEvents: ["Exercise before the period ends", "Leaver outside the good-leaver exceptions"],
    onBreach: "Tax-advantaged treatment is lost and the exercise is taxed as employment income.",
    brokenByCompletion: true,
    status: "running",
  },
];

/** A proposed completion date the user can test the conditions against. */
const PROPOSED_DATE = "2027-03-31";

type SweepRow = {
  shareholder: string;
  event: string;
  taxYear: string;
  closesOn: string;
  cashAtCompletion: string;
  replacementValue: string;
  funding: "covered" | "short" | "unknown";
  state: "Open" | "Decided" | "Blocked";
  note: string;
};

const sweep: SweepRow[] = [
  {
    shareholder: "Manager cohort A (7)",
    event: "PE rollover into Bidco",
    taxYear: "2026/27",
    closesOn: "2029-01-31",
    cashAtCompletion: "£0.18m",
    replacementValue: "£4.10m",
    funding: "short",
    state: "Open",
    note: "Election would crystallise more tax than the cash received at completion.",
  },
  {
    shareholder: "Manager cohort B (5)",
    event: "PE rollover into Bidco",
    taxYear: "2026/27",
    closesOn: "2029-01-31",
    cashAtCompletion: "£0.13m",
    replacementValue: "£1.95m",
    funding: "unknown",
    state: "Blocked",
    note: "Remaining lifetime allowance not established for four of five.",
  },
  {
    shareholder: "Former director · J. Okonkwo",
    event: "Share exchange on holdco insertion",
    taxYear: "2024/25",
    closesOn: "2027-01-31",
    cashAtCompletion: "£0.00m",
    replacementValue: "£0.62m",
    funding: "short",
    state: "Open",
    note: "No cash was received at the exchange; funding would have to come from elsewhere.",
  },
  {
    shareholder: "Minority holders (14, each below 5%)",
    event: "Share exchange on holdco insertion",
    taxYear: "2024/25",
    closesOn: "2027-01-31",
    cashAtCompletion: "£0.00m",
    replacementValue: "£0.44m",
    funding: "unknown",
    state: "Blocked",
    note: "Population added after the sub-5% exclusion was removed. Not previously analysed.",
  },
  {
    shareholder: "A Founder",
    event: "Loan notes on earn-out tranche",
    taxYear: "2026/27",
    closesOn: "2027-01-31",
    cashAtCompletion: "£2.40m",
    replacementValue: "£1.10m",
    funding: "covered",
    state: "Decided",
    note: "Election not taken. Reason recorded: relief already exhausted on the main disposal.",
  },
];

const panels: Array<{ id: PanelId; label: string; count?: number }> = [
  { id: "windows", label: "Windows", count: windows.length },
  { id: "conditions", label: "Conditions", count: conditions.length },
  { id: "sweep", label: "Election sweep", count: sweep.length },
];

export function PositionsDemo() {
  const [panel, setPanel] = useState<PanelId>("windows");
  const [open, setOpen] = useState<string | null>("W-01");
  const [testDate, setTestDate] = useState(false);

  const ordered = useMemo(
    () => [...windows].sort((a, b) => daysUntil(a.closesOn) - daysUntil(b.closesOn)),
    [],
  );

  // SPEC-005 Part F: rank by time remaining, then by whether the tax could be funded.
  const fundingRank = { short: 0, unknown: 1, covered: 2 } as const;
  const orderedSweep = useMemo(
    () =>
      [...sweep].sort(
        (a, b) =>
          daysUntil(a.closesOn) - daysUntil(b.closesOn) ||
          fundingRank[a.funding] - fundingRank[b.funding],
      ),
    [],
  );

  const unverified = useMemo(
    () =>
      windows.filter((w) => w.basis === "unverified" || w.basis === "practice").length +
      conditions.filter((c) => c.basis === "unverified" || c.basis === "practice").length,
    [],
  );

  // A condition breaks only where completion is itself a breaking event AND the
  // condition is still running on that date.
  const wouldBreak = conditions.filter(
    (condition) =>
      condition.brokenByCompletion &&
      new Date(PROPOSED_DATE) < new Date(condition.endsOn),
  );

  return (
    <div className="matter-demo pos-demo">
      <header className="matter-heading">
        <div className="matter-heading-main">
          <div className="matter-breadcrumbs">
            <span>Matters</span>
            <span>/</span>
            <span>Transactions</span>
          </div>
          <div className="matter-title-row">
            <h1>Open tax positions</h1>
            <span className="matter-status matter-status-blocked">
              {windows.filter((w) => daysUntil(w.closesOn) > 0).length} windows open
            </span>
          </div>
          <p>
            Northstar Group · choices that expire, conditions that must hold, and{" "}
            {unverified} items whose basis is not yet verified
          </p>
        </div>
        <div className="matter-heading-actions">
          <button className="matter-button matter-button-secondary" type="button">
            Verification queue
          </button>
          <button className="matter-button matter-button-primary" type="button">
            Export sweep
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
            {item.count !== undefined && <span>{item.count}</span>}
          </button>
        ))}
      </nav>

      {panel === "windows" && (
        <section className="matter-tab-panel">
          <ul className="pos-window-list">
            {ordered.map((window) => {
              const days = daysUntil(window.closesOn);
              const isOpen = open === window.id;
              return (
                <li className={isOpen ? "pos-window open" : "pos-window"} key={window.id}>
                  <button
                    className="pos-window-head"
                    onClick={() => setOpen(isOpen ? null : window.id)}
                    type="button"
                  >
                    <span className={`pos-countdown pos-countdown-${days < 400 ? "near" : "far"}`}>
                      {remaining(days)}
                    </span>
                    <span className="pos-window-title">
                      <strong>{window.position}</strong>
                      <small>
                        {window.entity} · {window.kind.toLowerCase()} by {fmt(window.closesOn)}
                      </small>
                    </span>
                    <span className={`pos-basis pos-basis-${window.basis}`}>
                      {basisLabel[window.basis]}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="pos-window-body">
                      <div className="pos-default">
                        <span>If nobody acts</span>
                        <p>{window.defaultOutcome}</p>
                      </div>

                      <dl className="pos-facts">
                        <div>
                          <dt>Clock</dt>
                          <dd>{window.clockBasis}</dd>
                        </div>
                        <div>
                          <dt>Decision</dt>
                          <dd>{window.decisionMaker}</dd>
                        </div>
                        <div>
                          <dt>Effect of acting</dt>
                          <dd>{window.consequence}</dd>
                        </div>
                        {window.exposedTo && (
                          <div>
                            <dt>Exposure</dt>
                            <dd>
                              {window.exposedTo}
                              {window.antiForestalling &&
                                " · anti-forestalling risk if the election is left late"}
                            </dd>
                          </div>
                        )}
                      </dl>

                      {window.funding && (
                        <div className={`pos-funding pos-funding-${window.funding.status}`}>
                          <span>
                            {window.funding.status === "short"
                              ? "Funding short"
                              : window.funding.status === "covered"
                                ? "Funding covered"
                                : "Funding not established"}
                          </span>
                          <p>
                            {window.funding.tax} against {window.funding.cash} ·{" "}
                            {window.funding.asAt}
                          </p>
                          <small>Both figures recorded from the adviser model. Not calculated here.</small>
                        </div>
                      )}

                      {window.blockedBy.length > 0 && (
                        <div className="pos-blocked">
                          <span>Blocked by</span>
                          <ul>
                            {window.blockedBy.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="pos-window-actions">
                        <button className="matter-button matter-button-primary" type="button">
                          Record decision
                        </button>
                        <button className="matter-button matter-button-secondary" type="button">
                          Request the blocking facts
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {panel === "conditions" && (
        <section className="matter-tab-panel">
          <div className="pos-date-test">
            <label>
              <input
                checked={testDate}
                onChange={(event) => setTestDate(event.target.checked)}
                type="checkbox"
              />
              Test against a proposed completion of {fmt(PROPOSED_DATE)}
            </label>
            {testDate && (
              <span className="pos-date-result">
                {wouldBreak.length} of {conditions.length} conditions would be broken by
                completing on that date
              </span>
            )}
          </div>

          <ul className="pos-condition-list">
            {conditions.map((condition) => {
              const breaks = testDate && wouldBreak.includes(condition);
              const total = daysUntil(condition.endsOn) - daysUntil(condition.startsOn);
              const elapsed = Math.max(0, -daysUntil(condition.startsOn));
              const pct = Math.min(100, Math.round((elapsed / total) * 100));
              return (
                <li className={breaks ? "pos-condition breaks" : "pos-condition"} key={condition.id}>
                  <div className="pos-condition-head">
                    <div>
                      <strong>{condition.subject}</strong>
                      <small>{condition.entity}</small>
                    </div>
                    <span className={`pos-basis pos-basis-${condition.basis}`}>
                      {basisLabel[condition.basis]}
                    </span>
                  </div>

                  <div className="pos-bar" role="presentation">
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <div className="pos-bar-labels">
                    <small>{fmt(condition.startsOn)}</small>
                    <small>
                      {condition.duration} · ends {fmt(condition.endsOn)}
                    </small>
                  </div>

                  <div className="pos-breaks">
                    <span>Broken by</span>
                    <ul>
                      {condition.breakingEvents.map((event) => (
                        <li key={event}>{event}</li>
                      ))}
                    </ul>
                    <p>{condition.onBreach}</p>
                  </div>

                  {breaks && (
                    <p className="pos-break-flag">
                      Completing on {fmt(PROPOSED_DATE)} would break this condition.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {panel === "sweep" && (
        <section className="matter-tab-panel">
          <p className="pos-sweep-note">
            Every shareholder who received replacement shares or securities since 5 April 2024.
            Ranked by time remaining, then by whether the tax could be funded.
          </p>
          <div className="pos-sweep-scroll">
            <table className="pos-sweep">
              <thead>
                <tr>
                  <th scope="col">Shareholder</th>
                  <th scope="col">Event</th>
                  <th scope="col">Tax year</th>
                  <th scope="col">Window closes</th>
                  <th scope="col">Cash at completion</th>
                  <th scope="col">Replacement value</th>
                  <th scope="col">State</th>
                </tr>
              </thead>
              <tbody>
                {orderedSweep.map((row) => (
                  <tr key={row.shareholder}>
                    <th scope="row">
                      <strong>{row.shareholder}</strong>
                      <small>{row.note}</small>
                    </th>
                    <td>{row.event}</td>
                    <td className="num">{row.taxYear}</td>
                    <td className="num">
                      {fmt(row.closesOn)}
                      <small>{remaining(daysUntil(row.closesOn))}</small>
                    </td>
                    <td className="num">
                      <span className={`pos-funding-chip pos-funding-${row.funding}`}>
                        {row.cashAtCompletion}
                      </span>
                    </td>
                    <td className="num">{row.replacementValue}</td>
                    <td>
                      <span
                        className={`response-state${row.state === "Decided" ? " accepted" : ""}`}
                      >
                        {row.state}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="ip-boundary">
        Illustrative worked example. Figures are invented and no treatment is concluded. Items
        graded &ldquo;practice assumption&rdquo; or &ldquo;stated in source, unverified&rdquo;
        cannot gate a sign-off until a named reviewer verifies them against the legislation.
      </p>
    </div>
  );
}
