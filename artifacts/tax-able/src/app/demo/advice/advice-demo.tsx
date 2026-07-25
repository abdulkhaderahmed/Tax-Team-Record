"use client";

import { useState } from "react";

type CandidateStatus = "pending" | "confirmed" | "dismissed";

const candidates = [
  {
    id: "price-value",
    recordType: "Tripwire",
    title: "Consideration may exceed the valuation",
    condition:
      "The final EOT consideration is higher than the market value supported by the report.",
    consequence:
      "Employment income tax, PAYE or NIC analysis may be required.",
    action:
      "Reconcile the final consideration and transaction terms to the signed valuation before approval.",
    evidence:
      "Signed valuation, transaction documents, cap table and adviser confirmation.",
    source:
      "PDF page 6 · tax-purpose and market-value section",
  },
  {
    id: "valuation-refresh",
    recordType: "Tripwire",
    title: "A material fact changes after the valuation date",
    condition:
      "Forecasts, material contracts, trading results, share rights or the proposed transaction structure change.",
    consequence:
      "The report may no longer support reliance for the proposed transaction.",
    action:
      "Ask the valuation adviser whether an update or addendum is required.",
    evidence:
      "Management fact confirmation and a record of post-valuation changes.",
    source:
      "PDF page 3 · reliance and subsequent-events section",
  },
  {
    id: "reorganisation",
    recordType: "Assumption",
    title: "The pre-sale reorganisation completes as described",
    condition:
      "The new parent and share-for-share exchange are completed on the assumed terms.",
    consequence:
      "A different structure may make the valuation and related tax analysis inapplicable.",
    action:
      "Compare executed reorganisation documents with the structure used in the report.",
    evidence:
      "Share exchange agreement, board approvals and final group structure.",
    source:
      "PDF page 5 · proposed transaction structure",
  },
];

export function AdviceDemo() {
  const [statuses, setStatuses] = useState<Record<string, CandidateStatus>>({});
  const confirmed = Object.values(statuses).filter(
    (status) => status === "confirmed",
  ).length;
  const decided = Object.keys(statuses).length;

  function setStatus(id: string, status: CandidateStatus) {
    setStatuses((current) => ({ ...current, [id]: status }));
  }

  return (
    <div className="advice-demo">
      <div className="demo-progress">
        <div>
          <span className="eyebrow">Guided matter · sample data</span>
          <h1>EOT valuation reliance</h1>
          <p>
            Review the operational consequences proposed from a valuation
            report. No candidate becomes a live record until you decide.
          </p>
        </div>
        <div className="demo-progress-count">
          <strong>
            {decided}/{candidates.length}
          </strong>
          <span>reviewed</span>
        </div>
      </div>

      <div className="matter-context">
        <div>
          <span>Source</span>
          <strong>Sample EOT valuation report</strong>
        </div>
        <div>
          <span>Entity</span>
          <strong>Northstar Operations Ltd</strong>
        </div>
        <div>
          <span>Purpose</span>
          <strong>Transaction approval</strong>
        </div>
        <div>
          <span>Reviewer</span>
          <strong>Head of Tax</strong>
        </div>
      </div>

      <div className="candidate-list">
        {candidates.map((candidate, index) => {
          const status = statuses[candidate.id] ?? "pending";
          return (
            <article
              className={`candidate-card candidate-${status}`}
              key={candidate.id}
            >
              <header>
                <div>
                  <span className="candidate-number">Candidate {index + 1}</span>
                  <span className="badge badge-orange">Conditional</span>
                  <span className="badge badge-grey">
                    {candidate.recordType}
                  </span>
                </div>
                {status !== "pending" && (
                  <span
                    className={`badge ${
                      status === "confirmed" ? "badge-green" : "badge-grey"
                    }`}
                  >
                    {status === "confirmed" ? "Confirmed" : "Dismissed"}
                  </span>
                )}
              </header>
              <h2>{candidate.title}</h2>
              <div className="candidate-fields">
                <div>
                  <span>Condition</span>
                  <p>{candidate.condition}</p>
                </div>
                <div>
                  <span>Control consequence</span>
                  <p>{candidate.consequence}</p>
                </div>
                <div>
                  <span>Proposed action</span>
                  <p>{candidate.action}</p>
                </div>
                <div>
                  <span>Evidence expected</span>
                  <p>{candidate.evidence}</p>
                </div>
              </div>
              <div className="candidate-source">
                <span>Source citation</span>
                <strong>{candidate.source}</strong>
                <button type="button">View cited page</button>
              </div>
              <footer>
                <button
                  className="btn btn-primary"
                  onClick={() => setStatus(candidate.id, "confirmed")}
                  type="button"
                >
                  Confirm as {candidate.recordType.toLowerCase()}
                </button>
                <button
                  className="btn"
                  onClick={() => setStatus(candidate.id, "dismissed")}
                  type="button"
                >
                  Dismiss
                </button>
                {status !== "pending" && (
                  <button
                    className="btn btn-link"
                    onClick={() =>
                      setStatuses((current) => {
                        const next = { ...current };
                        delete next[candidate.id];
                        return next;
                      })
                    }
                    type="button"
                  >
                    Undo
                  </button>
                )}
              </footer>
            </article>
          );
        })}
      </div>

      <section className="demo-outcome">
        <div>
          <span className="eyebrow">Implementation record</span>
          <h2>
            {decided === candidates.length
              ? "Review complete"
              : "Complete the review to create the control bundle"}
          </h2>
          <p>
            {confirmed} candidate{confirmed === 1 ? "" : "s"} will become live.
            Confirmed records retain the source page, reviewer and decision
            history.
          </p>
        </div>
        <div className="outcome-links">
          <span>{confirmed} controlled records</span>
          <span>{confirmed > 0 ? "Evidence requirements attached" : "No evidence attached"}</span>
          <span>{confirmed > 0 ? "Ready for owner assignment" : "Awaiting review"}</span>
        </div>
        <button
          className="btn"
          onClick={() => setStatuses({})}
          type="button"
        >
          Reset guided demo
        </button>
      </section>
    </div>
  );
}
