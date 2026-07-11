import { computeOwnershipWarnings } from "@/lib/ownership-control";
import { STATUS_FIELD_LABELS, REQUIREMENT_FLAG_LABELS, RACI_ROLE_DEFINITIONS, type RaciRole } from "@/lib/raci-constants";
import { removeRaciAssignment } from "@/app/actions/parties";

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "Complete" || status === "Approved" || status === "Submitted" || status === "Paid" ? "badge-green" :
    status === "In progress" || status === "Under review" ? "badge-blue" :
    status === "Blocked" || status === "Needs owner" ? "badge-red" :
    status === "Needs adviser input" || status === "Needs source verification" ? "badge-orange" :
    status === "Ready for review" ? "badge-yellow" :
    "badge-grey";
  return <span className={`badge ${cls}`}>{status}</span>;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="detail-item">
      <div className="detail-label">{label}</div>
      <div className="detail-value">{value ?? <span className="text-muted">—</span>}</div>
    </div>
  );
}

export interface OwnershipControlsData {
  objectType: "Obligation" | "Action";
  objectId: string;
  returnPath: string;

  responsibleOwner: string | null;
  accountableOwner: string | null;
  consultedParty: string | null;
  informedParty: string | null;
  externalAdviser: string | null;
  externalOperationalOwner: string | null;

  dataCollectionRequired: boolean;
  dataValidationRequired: boolean;
  technicalReviewRequired: boolean;
  accountableApprovalRequired: boolean;
  evidenceRequired: boolean;
  filingSubmissionRequired: boolean;
  paymentRequired: boolean;

  dataCompletenessStatus: string;
  dataValidationStatus: string;
  technicalReviewStatus: string;
  approvalStatus: string;
  workflowProgressStatus: string;
  evidenceStatus: string;
  filingSubmissionStatus: string;
  paymentStatus: string;
  overallStatus: string;
  overallStatusIsOverride: boolean;

  riskLevel: string | null;
  exceptionRequired: boolean;
  openIssueBlocker: string | null;
  notes: string | null;

  raciAssignments: Array<{ id: string; role: string; party: { name: string; partyType: string; isExternal: boolean; email: string | null } }>;
  statusHistory: Array<{ id: string; statusField: string; oldValue: string | null; newValue: string | null; changedBy: { id: string; name: string } | null; changedAt: Date; reason: string | null }>;
}

export function OwnershipAndControls(data: OwnershipControlsData) {
  const warnings = computeOwnershipWarnings(data);
  const raciByRole = new Map<string, typeof data.raciAssignments>();
  for (const a of data.raciAssignments) {
    if (!raciByRole.has(a.role)) raciByRole.set(a.role, []);
    raciByRole.get(a.role)!.push(a);
  }

  return (
    <div className="panel">
      <h2>Ownership and Controls</h2>

      {warnings.length > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {warnings.map((w) => (
              <span key={w.code} className="badge badge-orange">⚠ {w.message}</span>
            ))}
          </div>
        </div>
      )}

      <h3 style={{ fontSize: 13, color: "var(--ink-secondary)", textTransform: "uppercase", marginBottom: 8 }}>RACI</h3>
      <div className="detail-grid" style={{ marginBottom: 16 }}>
        <Row label="Responsible owner" value={data.responsibleOwner} />
        <Row label="Accountable owner" value={data.accountableOwner} />
        <Row label="Consulted party" value={data.consultedParty} />
        <Row label="Informed party" value={data.informedParty} />
        <Row label="External adviser" value={data.externalAdviser} />
        <Row label="External operational owner" value={data.externalOperationalOwner} />
      </div>

      {(["Responsible", "Accountable", "Consulted", "Informed", "External adviser", "External operational owner"] as RaciRole[]).map((role) => {
        const assignments = raciByRole.get(role) ?? [];
        if (assignments.length === 0) return null;
        return (
          <div key={role} style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-secondary)" }} title={RACI_ROLE_DEFINITIONS[role]}>{role}:</span>{" "}
            {assignments.map((a) => (
              <span key={a.id} className="badge badge-grey" style={{ marginRight: 6 }}>
                {a.party.name} ({a.party.partyType}{a.party.isExternal ? ", external" : ""})
                <form action={removeRaciAssignment.bind(null, a.id, data.returnPath)} style={{ display: "inline" }}>
                  <button type="submit" style={{ border: "none", background: "none", cursor: "pointer", marginLeft: 4, color: "var(--overdue)" }} title="Remove">×</button>
                </form>
              </span>
            ))}
          </div>
        );
      })}

      <h3 style={{ fontSize: 13, color: "var(--ink-secondary)", textTransform: "uppercase", margin: "16px 0 8px" }}>Required status flags</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {(Object.keys(REQUIREMENT_FLAG_LABELS) as Array<keyof typeof REQUIREMENT_FLAG_LABELS>).map((key) => (
          <span key={key} className={`badge ${data[key] ? "badge-blue" : "badge-grey"}`}>
            {REQUIREMENT_FLAG_LABELS[key]}: {data[key] ? "Required" : "Not required"}
          </span>
        ))}
      </div>

      <h3 style={{ fontSize: 13, color: "var(--ink-secondary)", textTransform: "uppercase", margin: "16px 0 8px" }}>Statuses</h3>
      <div className="detail-grid cols3" style={{ marginBottom: 16 }}>
        {(Object.keys(STATUS_FIELD_LABELS) as Array<keyof typeof STATUS_FIELD_LABELS>).map((key) => (
          <Row key={key} label={STATUS_FIELD_LABELS[key]} value={<StatusBadge status={data[key]} />} />
        ))}
        <Row
          label="Overall status"
          value={
            <>
              <StatusBadge status={data.overallStatus} />
              {data.overallStatusIsOverride && <span className="badge badge-yellow" style={{ marginLeft: 6 }}>Manually overridden</span>}
            </>
          }
        />
        <Row label="Risk level" value={data.riskLevel} />
        <Row label="Open exception" value={data.exceptionRequired ? "Yes" : "No"} />
      </div>

      {data.openIssueBlocker && (
        <div style={{ marginBottom: 12 }}>
          <div className="detail-label">Blocker</div>
          <div className="detail-value" style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{data.openIssueBlocker}</div>
        </div>
      )}
      {data.notes && (
        <div style={{ marginBottom: 16 }}>
          <div className="detail-label">Notes</div>
          <div className="detail-value" style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{data.notes}</div>
        </div>
      )}

      <h3 style={{ fontSize: 13, color: "var(--ink-secondary)", textTransform: "uppercase", margin: "16px 0 8px" }}>Status history</h3>
      {data.statusHistory.length === 0 ? (
        <p className="text-sm text-muted">No status changes recorded yet.</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Field</th><th>From</th><th>To</th><th>Changed by</th><th>When</th><th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {data.statusHistory.map((h) => (
                <tr key={h.id}>
                  <td>{h.statusField}</td>
                  <td>{h.oldValue ?? "—"}</td>
                  <td>{h.newValue ?? "—"}</td>
                  <td>{h.changedBy ? `${h.changedBy.name} (${h.changedBy.id})` : "—"}</td>
                  <td className="text-sm text-muted">{h.changedAt.toLocaleString("en-GB")}</td>
                  <td className="text-sm text-muted">{h.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
