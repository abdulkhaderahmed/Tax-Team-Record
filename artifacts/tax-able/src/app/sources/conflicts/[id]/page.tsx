import { prisma } from "@/lib/prisma";
import { updateConflictStatus, resolveSourceConflict } from "@/app/actions/sourceConflicts";
import { CONFLICT_STATUSES, SEVERITY_LEVELS } from "@/lib/source-constants";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/auth";

function fmt(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function SeverityBadge({ severity }: { severity: string | null }) {
  if (!severity) return <span className="badge badge-grey">Not set</span>;
  const cls =
    severity === "High" ? "badge-red" : severity === "Medium" ? "badge-yellow" : "badge-grey";
  return <span className={`badge ${cls}`}>{severity}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "Resolved" || status === "Closed as not material"
      ? "badge-green"
      : status === "Open"
      ? "badge-red"
      : "badge-blue";
  return <span className={`badge ${cls}`}>{status}</span>;
}


export default async function ConflictDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { organisation: org } = await requireOrg();
  const orgId = org.id;

  const { id } = await params;
  const conflict = await prisma.sourceConflict.findUnique({
    where: { id },
    include: { dataCategory: true, entity: true, sourceA: true, sourceB: true, reviewOwner: true },
  });
  if (!conflict || conflict.organisationId !== orgId) notFound();
  const users = await prisma.user.findMany({
    where: { organisationId: orgId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  const isResolved =
    conflict.status === "Resolved" || conflict.status === "Closed as not material";

  const updateStatus = updateConflictStatus.bind(null, id);
  const resolve = resolveSourceConflict.bind(null, id);

  return (
    <>
      <div style={{ padding: "28px 32px" }}>
        <div style={{ marginBottom: 20 }}>
          <Link href="/sources/conflicts" style={{ color: "var(--ink-secondary)", fontSize: 13 }}>
            ← Source Conflicts
          </Link>
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: "0 0 6px" }}>{conflict.dataCategory.name}</h1>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <StatusBadge status={conflict.status} />
              <SeverityBadge severity={conflict.severity} />
              {conflict.entity && (
                <span style={{ fontSize: 13, color: "var(--ink-secondary)" }}>
                  Entity: <strong style={{ color: "var(--ink)" }}>{conflict.entity.legalName}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {!isResolved && (
          <div className="panel" style={{ marginBottom: 20, background: "var(--due-soon-bg)", borderColor: "var(--due-soon)" }}>
            <p style={{ margin: 0, color: "var(--due-soon)", fontWeight: 500 }}>
              ⚠ This conflict is open. Review both source values and resolve before using this data in any obligation or filing.
            </p>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
          <div className="panel">
            <h2>Source A</h2>
            <div style={{ marginBottom: 8 }}>
              <div className="detail-label">System</div>
              <div style={{ fontWeight: 600 }}>{conflict.sourceA.name}</div>
              <div style={{ color: "var(--ink-secondary)", fontSize: 12 }}>{conflict.sourceA.systemType}</div>
            </div>
            <div>
              <div className="detail-label">Value</div>
              <div style={{ background: "var(--surface-sunken)", border: "1px solid var(--border)", borderRadius: 6, padding: "10px 12px", fontFamily: "monospace", fontSize: 13 }}>
                {conflict.sourceAValue}
              </div>
            </div>
          </div>

          <div className="panel">
            <h2>Source B</h2>
            <div style={{ marginBottom: 8 }}>
              <div className="detail-label">System</div>
              <div style={{ fontWeight: 600 }}>{conflict.sourceB.name}</div>
              <div style={{ color: "var(--ink-secondary)", fontSize: 12 }}>{conflict.sourceB.systemType}</div>
            </div>
            <div>
              <div className="detail-label">Value</div>
              <div style={{ background: "var(--surface-sunken)", border: "1px solid var(--border)", borderRadius: 6, padding: "10px 12px", fontFamily: "monospace", fontSize: 13 }}>
                {conflict.sourceBValue}
              </div>
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 20 }}>
          <h2>Review details</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            <div>
              <div className="detail-label">Review owner</div>
              <div>{conflict.reviewOwner ? `${conflict.reviewOwner.name} (${conflict.reviewOwner.id})` : "—"}</div>
            </div>
            <div>
              <div className="detail-label">Required confirmation</div>
              <div>{conflict.requiredConfirmation || "—"}</div>
            </div>
            <div>
              <div className="detail-label">Opened</div>
              <div>{fmt(conflict.createdAt)}</div>
            </div>
          </div>
        </div>

        {isResolved ? (
          <div className="panel" style={{ marginBottom: 20, background: "var(--on-track-bg)" }}>
            <h2>Resolution</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 16 }}>
              <div>
                <div className="detail-label">Resolved value</div>
                <div style={{ fontWeight: 500 }}>{conflict.resolvedValue || "—"}</div>
              </div>
              <div>
                <div className="detail-label">Resolved at</div>
                <div>{fmt(conflict.resolvedAt)}</div>
              </div>
            </div>
            <div>
              <div className="detail-label">Resolution rationale</div>
              <div>{conflict.resolutionRationale || "—"}</div>
            </div>
          </div>
        ) : (
          <>
            <div className="panel" style={{ marginBottom: 20 }}>
              <h2>Update status</h2>
              <form action={updateStatus}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div className="form-row">
                    <label className="form-label">Status</label>
                    <select name="status" className="form-input" defaultValue={conflict.status}>
                      {CONFLICT_STATUSES.filter((s) => s !== "Resolved" && s !== "Closed as not material").map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-row">
                    <label className="form-label">Review owner</label>
                    <select name="reviewOwnerId" className="form-input" defaultValue={conflict.reviewOwnerId ?? ""}>
                      <option value="">— unassigned —</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>{user.name} · {user.email} · {user.id}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row" style={{ marginBottom: 16 }}>
                  <label className="form-label">Required confirmation party</label>
                  <input name="requiredConfirmation" className="form-input"
                    defaultValue={conflict.requiredConfirmation ?? ""}
                    placeholder="e.g. Finance, Adviser, Payroll" />
                </div>
                <button type="submit" className="btn">Update status</button>
              </form>
            </div>

            <div className="panel" style={{ marginBottom: 20, borderColor: "var(--on-track)" }}>
              <h2>Resolve conflict</h2>
              <p style={{ color: "var(--ink-secondary)", fontSize: 13, marginBottom: 16 }}>
                Record the agreed value and rationale, then close the conflict.
              </p>
              <form action={resolve}>
                <div className="form-row">
                  <label className="form-label">Agreed resolved value</label>
                  <input name="resolvedValue" className="form-input"
                    placeholder="The correct value both parties have agreed on" />
                </div>
                <div className="form-row">
                  <label className="form-label">Resolution rationale</label>
                  <textarea name="resolutionRationale" className="form-input" rows={3}
                    placeholder="Why was this value chosen? Which source was followed and why?" />
                </div>
                <div className="form-row" style={{ marginBottom: 16 }}>
                  <label className="form-label">Close as</label>
                  <select name="resolution" className="form-input">
                    <option value="Resolved">Resolved</option>
                    <option value="Closed as not material">Closed as not material</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-primary">Resolve conflict</button>
              </form>
            </div>
          </>
        )}
      </div>
    </>
  );
}
