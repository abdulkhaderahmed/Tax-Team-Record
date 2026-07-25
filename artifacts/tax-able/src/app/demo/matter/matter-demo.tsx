"use client";

import { useMemo, useState } from "react";

type MatterTab = "overview" | "advice" | "workplan" | "evidence" | "history";
type CheckId = "consideration" | "structure" | "subsequent-events";

type ControlCheck = {
  id: CheckId;
  title: string;
  requestedFrom: string;
  receivedAt: string;
  response: string;
  evidence: string;
  source: string;
};

const checks: ControlCheck[] = [
  {
    id: "consideration",
    title: "Final consideration remains within the supported value",
    requestedFrom: "Priya Shah · Finance",
    receivedAt: "Today, 09:14",
    response:
      "Final consideration is £8.2m. The signed SPA and completion statement agree.",
    evidence: "Completion statement v3.xlsx",
    source: "Valuation report · page 18",
  },
  {
    id: "structure",
    title: "Executed structure matches the structure reviewed by the valuer",
    requestedFrom: "Tom Williams · Legal",
    receivedAt: "Yesterday, 16:42",
    response:
      "The share-for-share exchange and EOT acquisition documents follow the reviewed steps.",
    evidence: "Legal completion pack.pdf",
    source: "Valuation report · page 7",
  },
  {
    id: "subsequent-events",
    title: "No later event requires the valuation to be refreshed",
    requestedFrom: "Helen Moore · Valuation adviser",
    receivedAt: "Today, 08:51",
    response:
      "June trading and the new customer contract do not change our concluded range. No addendum is required.",
    evidence: "Adviser confirmation.eml",
    source: "Valuation report · page 4",
  },
];

const tabs: Array<{ id: MatterTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "advice", label: "Advice" },
  { id: "workplan", label: "Workplan" },
  { id: "evidence", label: "Evidence" },
  { id: "history", label: "History" },
];

const adviceConditions = [
  {
    id: "market-value",
    label: "Market value condition",
    source: "Page 18",
    advice:
      "The concluded equity value supports consideration up to £8.4m for the transaction described.",
    control:
      "Compare the signed consideration with £8.4m before tax sign-off.",
  },
  {
    id: "transaction-steps",
    label: "Transaction structure",
    source: "Page 7",
    advice:
      "The valuation assumes the share exchange and EOT acquisition occur in the sequence provided.",
    control:
      "Legal must confirm that the executed documents follow the reviewed sequence.",
  },
  {
    id: "later-facts",
    label: "Later facts",
    source: "Page 4",
    advice:
      "Reliance should be reconsidered if trading, contracts or transaction terms change before completion.",
    control:
      "Ask the valuer to confirm whether later facts require an update.",
  },
];

function TickIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="m5 10.5 3 3 7-7" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="M5.5 2.75h6l3 3v11.5h-9z" />
      <path d="M11.5 2.75v3h3M8 9h4.5M8 12h4.5" />
    </svg>
  );
}

export function MatterDemo() {
  const [activeTab, setActiveTab] = useState<MatterTab>("overview");
  const [accepted, setAccepted] = useState<Record<CheckId, boolean>>({
    consideration: false,
    structure: false,
    "subsequent-events": false,
  });
  const [approved, setApproved] = useState(false);
  const [sourceOpen, setSourceOpen] = useState<string | null>(null);

  const acceptedCount = useMemo(
    () => Object.values(accepted).filter(Boolean).length,
    [accepted],
  );
  const ready = acceptedCount === checks.length;

  function acceptCheck(id: CheckId) {
    setAccepted((current) => ({ ...current, [id]: true }));
  }

  function resetDemo() {
    setAccepted({
      consideration: false,
      structure: false,
      "subsequent-events": false,
    });
    setApproved(false);
    setActiveTab("overview");
    setSourceOpen(null);
  }

  return (
    <div className="matter-demo">
      <div className="matter-demo-banner">
        <div>
          <span className="matter-demo-dot" />
          <strong>Northstar Group · fictional workspace</strong>
          <span>
            £430m UK private group · 14 active entities · 3-person tax team.
            This matter began with one valuation report and a Legal email.
          </span>
        </div>
        <button onClick={resetDemo} type="button">
          Reset
        </button>
      </div>

      <header className="matter-heading">
        <div className="matter-heading-main">
          <div className="matter-breadcrumbs">
            <span>Matters</span>
            <span>/</span>
            <span>Transactions</span>
          </div>
          <div className="matter-title-row">
            <h1>Employee ownership trust share sale</h1>
            <span
              className={`matter-status ${
                approved
                  ? "matter-status-approved"
                  : ready
                    ? "matter-status-ready"
                    : "matter-status-blocked"
              }`}
            >
              {approved
                ? "Approved with conditions"
                : ready
                  ? "Ready for tax sign-off"
                  : "Tax sign-off blocked"}
            </span>
          </div>
          <p>
            Northstar Operations Ltd · Board approval 31 July 2026 · Tax owner:
            You, Head of Tax
          </p>
        </div>
        <div className="matter-heading-actions">
          <button className="matter-button matter-button-secondary" type="button">
            Share
          </button>
          <button className="matter-button matter-button-primary" type="button">
            Add work
          </button>
        </div>
      </header>

      <div className="matter-intake-summary">
        <div className="intake-summary-copy">
          <span className="intake-spark">✦</span>
          <div>
            <strong>Matter brief prepared automatically</strong>
            <p>
              11 fields were prefilled. Tax judgement is required for three
              conditions before the transaction can proceed.
            </p>
          </div>
        </div>
        <div className="intake-sources">
          <span>1 report</span>
          <span>1 email</span>
          <span>3 cited conditions</span>
        </div>
      </div>

      <nav aria-label="Matter sections" className="matter-tabs">
        {tabs.map((tab) => (
          <button
            aria-current={activeTab === tab.id ? "page" : undefined}
            className={activeTab === tab.id ? "active" : ""}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
            {tab.id === "evidence" && <span>3</span>}
          </button>
        ))}
      </nav>

      {activeTab === "overview" && (
        <div className="matter-layout">
          <div className="matter-primary-column">
            <section
              className={`decision-panel ${
                approved ? "decision-panel-approved" : ""
              }`}
            >
              <div className="decision-panel-top">
                <div>
                  <span className="matter-kicker">Decision required</span>
                  <h2>Can Tax release the transaction for board approval?</h2>
                </div>
                <span className="decision-id">DEC-2026-014</span>
              </div>

              <div className="decision-position">
                <span>Proposed control position</span>
                <p>
                  Proceed using the current valuation if consideration remains
                  at or below £8.4m, the executed steps match the reviewed
                  structure and the valuer confirms that later facts do not
                  require an update.
                </p>
                <button
                  className="source-link"
                  onClick={() => setSourceOpen("decision")}
                  type="button"
                >
                  See the advice and source pages
                </button>
              </div>

              <div className="decision-gate">
                <div className="decision-progress">
                  <div className="progress-ring">
                    <span>
                      {acceptedCount}/{checks.length}
                    </span>
                  </div>
                  <div>
                    <strong>
                      {approved
                        ? "Decision recorded"
                        : ready
                          ? "All conditions evidenced"
                          : `${checks.length - acceptedCount} control checks need your acceptance`}
                    </strong>
                    <p>
                      {approved
                        ? "The decision, conditions, evidence and approver are retained together."
                        : "Responses have arrived. Review each one before sign-off."}
                    </p>
                  </div>
                </div>
                {approved ? (
                  <button
                    className="matter-button matter-button-secondary"
                    onClick={() => setApproved(false)}
                    type="button"
                  >
                    Reopen decision
                  </button>
                ) : (
                  <button
                    className="matter-button matter-button-primary"
                    disabled={!ready}
                    onClick={() => setApproved(true)}
                    type="button"
                  >
                    Approve controlled decision
                  </button>
                )}
              </div>
              {!ready && !approved && (
                <p className="decision-disabled-reason">
                  Approval becomes available when all three control checks are
                  accepted.
                </p>
              )}
            </section>

            <section className="matter-section">
              <div className="matter-section-heading">
                <div>
                  <span className="matter-kicker">Inbox for this decision</span>
                  <h2>Three responses are ready for review</h2>
                </div>
                <span className="section-counter">
                  {acceptedCount} accepted
                </span>
              </div>

              <div className="control-check-list">
                {checks.map((check) => {
                  const isAccepted = accepted[check.id];
                  return (
                    <article
                      className={`control-check ${
                        isAccepted ? "control-check-accepted" : ""
                      }`}
                      key={check.id}
                    >
                      <div className="control-check-status">
                        <span className="check-circle">
                          {isAccepted ? <TickIcon /> : ""}
                        </span>
                      </div>
                      <div className="control-check-content">
                        <div className="control-check-heading">
                          <div>
                            <h3>{check.title}</h3>
                            <p>
                              {check.requestedFrom} · received {check.receivedAt}
                            </p>
                          </div>
                          <span
                            className={
                              isAccepted
                                ? "response-state accepted"
                                : "response-state"
                            }
                          >
                            {isAccepted ? "Accepted" : "Response received"}
                          </span>
                        </div>

                        <blockquote>{check.response}</blockquote>

                        <div className="control-check-footer">
                          <button
                            className="evidence-file"
                            onClick={() => setSourceOpen(check.id)}
                            type="button"
                          >
                            <DocumentIcon />
                            <span>{check.evidence}</span>
                          </button>
                          <span className="control-check-source">
                            Condition from {check.source}
                          </span>
                          {!isAccepted && (
                            <button
                              className="matter-button matter-button-accept"
                              onClick={() => acceptCheck(check.id)}
                              type="button"
                            >
                              Accept evidence
                            </button>
                          )}
                          {isAccepted && (
                            <button
                              className="matter-text-button"
                              onClick={() =>
                                setAccepted((current) => ({
                                  ...current,
                                  [check.id]: false,
                                }))
                              }
                              type="button"
                            >
                              Undo
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="matter-context-rail">
            <section>
              <span className="matter-kicker">Why Tax is involved</span>
              <p className="context-lead">
                A £8.2m employee ownership transaction needs tax clearance
                before board approval.
              </p>
              <dl>
                <div>
                  <dt>Tax areas</dt>
                  <dd>Employment tax, CGT, transactions</dd>
                </div>
                <div>
                  <dt>Business sponsor</dt>
                  <dd>Sarah Allen · CFO</dd>
                </div>
                <div>
                  <dt>External adviser</dt>
                  <dd>Helen Moore · Valuations</dd>
                </div>
                <div>
                  <dt>Decision deadline</dt>
                  <dd>29 July 2026</dd>
                </div>
              </dl>
            </section>

            <section>
              <div className="rail-section-heading">
                <span className="matter-kicker">Source pack</span>
                <button
                  className="matter-text-button"
                  onClick={() => setActiveTab("evidence")}
                  type="button"
                >
                  View all
                </button>
              </div>
              <button
                className="source-pack-file"
                onClick={() => setSourceOpen("valuation")}
                type="button"
              >
                <span className="file-icon">PDF</span>
                <span>
                  <strong>Independent valuation report</strong>
                  <small>Verified · 24 pages</small>
                </span>
              </button>
              <button className="source-pack-file" type="button">
                <span className="file-icon email">EML</span>
                <span>
                  <strong>Transaction steps from Legal</strong>
                  <small>Received 23 July</small>
                </span>
              </button>
            </section>

            <section>
              <span className="matter-kicker">Activity</span>
              <ol className="matter-activity">
                <li>
                  <span />
                  <div>
                    <strong>Adviser response received</strong>
                    <small>Today, 08:51</small>
                  </div>
                </li>
                <li>
                  <span />
                  <div>
                    <strong>Finance uploaded completion statement</strong>
                    <small>Today, 09:14</small>
                  </div>
                </li>
                <li>
                  <span />
                  <div>
                    <strong>Tax matter created from forwarded email</strong>
                    <small>22 July, 14:05</small>
                  </div>
                </li>
              </ol>
            </section>
          </aside>
        </div>
      )}

      {activeTab === "advice" && (
        <section className="matter-tab-panel">
          <div className="tab-panel-heading">
            <div>
              <span className="matter-kicker">Advice-to-control review</span>
              <h2>What the report says and how Tax will use it</h2>
              <p>
                The system has preserved each condition and proposed an
                operational check. A tax reviewer controls the decision.
              </p>
            </div>
            <button
              className="matter-button matter-button-secondary"
              onClick={() => setSourceOpen("valuation")}
              type="button"
            >
              Open report
            </button>
          </div>
          <div className="advice-condition-table">
            {adviceConditions.map((condition) => (
              <article key={condition.id}>
                <div className="advice-condition-label">
                  <span>{condition.source}</span>
                  <strong>{condition.label}</strong>
                </div>
                <div>
                  <span>Advice states</span>
                  <p>{condition.advice}</p>
                </div>
                <div>
                  <span>Control proposed</span>
                  <p>{condition.control}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeTab === "workplan" && (
        <section className="matter-tab-panel">
          <div className="tab-panel-heading">
            <div>
              <span className="matter-kicker">Cross-functional delivery</span>
              <h2>Workplan</h2>
              <p>
                Requests, owners and decision dependencies for this matter.
              </p>
            </div>
            <button className="matter-button matter-button-primary" type="button">
              Add request
            </button>
          </div>
          <div className="workplan-table">
            <div className="workplan-header">
              <span>Control check</span>
              <span>Owner</span>
              <span>Due</span>
              <span>Status</span>
            </div>
            {checks.map((check, index) => (
              <div className="workplan-row" key={check.id}>
                <div>
                  <strong>{check.title}</strong>
                  <small>Blocks DEC-2026-014</small>
                </div>
                <span>{check.requestedFrom}</span>
                <span>{index === 0 ? "25 Jul" : "26 Jul"}</span>
                <span
                  className={
                    accepted[check.id]
                      ? "response-state accepted"
                      : "response-state"
                  }
                >
                  {accepted[check.id] ? "Accepted" : "Ready for review"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "evidence" && (
        <section className="matter-tab-panel">
          <div className="tab-panel-heading">
            <div>
              <span className="matter-kicker">Decision evidence</span>
              <h2>Evidence pack</h2>
              <p>
                Every accepted condition remains tied to the source and reviewer.
              </p>
            </div>
            <button className="matter-button matter-button-secondary" type="button">
              Add evidence
            </button>
          </div>
          <div className="evidence-grid">
            {checks.map((check) => (
              <article key={check.id}>
                <div className="evidence-grid-icon">
                  <DocumentIcon />
                </div>
                <div>
                  <strong>{check.evidence}</strong>
                  <p>{check.title}</p>
                  <span>
                    {accepted[check.id] ? "Accepted by you" : "Awaiting review"}
                  </span>
                </div>
                <button
                  className="matter-text-button"
                  onClick={() => setSourceOpen(check.id)}
                  type="button"
                >
                  Inspect
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeTab === "history" && (
        <section className="matter-tab-panel">
          <div className="tab-panel-heading">
            <div>
              <span className="matter-kicker">Audit record</span>
              <h2>Decision history</h2>
              <p>
                Material changes retain the actor, time, source and reason.
              </p>
            </div>
          </div>
          <ol className="history-timeline">
            {approved && (
              <li>
                <span className="history-marker approved" />
                <div>
                  <strong>Controlled decision approved</strong>
                  <p>
                    You approved DEC-2026-014 with three retained conditions.
                  </p>
                  <small>Just now</small>
                </div>
              </li>
            )}
            {checks
              .filter((check) => accepted[check.id])
              .map((check) => (
                <li key={check.id}>
                  <span className="history-marker" />
                  <div>
                    <strong>Evidence accepted</strong>
                    <p>{check.evidence} accepted against “{check.title}”.</p>
                    <small>This session · Current signed-in user</small>
                  </div>
                </li>
              ))}
            <li>
              <span className="history-marker" />
              <div>
                <strong>Three stakeholder responses received</strong>
                <p>
                  Finance, Legal and the valuation adviser responded to the
                  control requests.
                </p>
                <small>25 July 2026 · System</small>
              </div>
            </li>
            <li>
              <span className="history-marker" />
              <div>
                <strong>Matter brief reviewed by Tax Manager</strong>
                <p>
                  Entity, deadline and tax areas confirmed. Three conditions
                  retained for Head of Tax review.
                </p>
                <small>23 July 2026 · Tax Manager · user_demo_tax_manager</small>
              </div>
            </li>
            <li>
              <span className="history-marker" />
              <div>
                <strong>Matter created</strong>
                <p>
                  Created from a forwarded Legal email and linked valuation
                  report.
                </p>
                <small>22 July 2026 · System</small>
              </div>
            </li>
          </ol>
        </section>
      )}

      {sourceOpen && (
        <div
          aria-label="Source detail"
          aria-modal="true"
          className="source-drawer-backdrop"
          role="dialog"
        >
          <div className="source-drawer">
            <header>
              <div>
                <span className="matter-kicker">Source detail</span>
                <h2>
                  {sourceOpen === "decision" || sourceOpen === "valuation"
                    ? "Independent valuation report"
                    : checks.find((check) => check.id === sourceOpen)?.evidence}
                </h2>
              </div>
              <button
                aria-label="Close source detail"
                onClick={() => setSourceOpen(null)}
                type="button"
              >
                ×
              </button>
            </header>
            <div className="source-drawer-body">
              <div className="source-preview">
                <div className="source-preview-page">
                  <span>ILLUSTRATIVE SOURCE · PAGE 18</span>
                  <h3>Valuation conclusion and reliance</h3>
                  <p>
                    The equity value range has been prepared for the proposed
                    employee ownership transaction and the transaction steps
                    supplied to us.
                  </p>
                  <p className="source-emphasis">
                    The concluded range supports consideration up to £8.4m,
                    subject to the stated assumptions and no material change in
                    the facts before completion.
                  </p>
                  <p>
                    Changes to trading, material contracts, share rights or the
                    proposed steps should be referred back to the valuer.
                  </p>
                </div>
              </div>
              <div className="source-control-summary">
                <span className="matter-kicker">Preserved by the system</span>
                <dl>
                  <div>
                    <dt>Condition</dt>
                    <dd>Consideration does not exceed £8.4m.</dd>
                  </div>
                  <div>
                    <dt>Action</dt>
                    <dd>Reconcile signed consideration before tax sign-off.</dd>
                  </div>
                  <div>
                    <dt>Reassessment event</dt>
                    <dd>A material fact or transaction step changes.</dd>
                  </div>
                  <div>
                    <dt>Human decision</dt>
                    <dd>Head of Tax accepts the evidence and records sign-off.</dd>
                  </div>
                </dl>
                <p className="source-boundary-note">
                  The system structures the report’s stated conditions. It does
                  not certify the valuation or replace tax review.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
