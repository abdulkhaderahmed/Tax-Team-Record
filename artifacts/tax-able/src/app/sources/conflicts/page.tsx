import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { requireOrg } from "@/lib/auth";


const STATUS_TABS = ["All", "Open", "Under review", "Resolved"];

function SeverityBadge({ severity }: { severity: string | null }) {
  if (!severity) return <span style={{ color: "var(--ink-tertiary)" }}>—</span>;
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

export default async function ConflictsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { organisation: org } = await requireOrg();
  const orgId = org.id;

  const { status } = await searchParams;
  const activeTab = status || "All";

  const where = {
    organisationId: orgId,
    ...(activeTab !== "All"
      ? activeTab === "Resolved"
        ? { status: { in: ["Resolved", "Closed as not material"] as string[] } }
        : { status: activeTab }
      : {}),
  };

  const [conflicts, openCount] = await Promise.all([
    prisma.sourceConflict.findMany({
      where,
      include: { dataCategory: true, entity: true, sourceA: true, sourceB: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.sourceConflict.count({
      where: { organisationId: orgId, status: { notIn: ["Resolved", "Closed as not material"] } },
    }),
  ]);

  return (
    <>
      <div style={{ padding: "28px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h1 style={{ margin: 0 }}>Source Conflicts</h1>
          <Link href="/sources/conflicts/new" className="btn btn-primary">
            Record Conflict
          </Link>
        </div>

        <div className="tab-bar" style={{ marginBottom: 24 }}>
          <Link href="/sources" className="tab">Source Systems</Link>
          <Link href="/sources/data-categories" className="tab">Data Categories</Link>
          <Link href="/sources/priority-rules" className="tab">Priority Rules</Link>
          <Link href="/sources/conflicts" className="tab tab-active">
            Conflicts{openCount > 0 && <span style={{ marginLeft: 6, background: "var(--overdue-bg)", color: "var(--overdue)", borderRadius: 10, padding: "1px 7px", fontSize: 11 }}>{openCount}</span>}
          </Link>
        </div>

        <div className="tab-bar" style={{ marginBottom: 20 }}>
          {STATUS_TABS.map((t) => (
            <Link
              key={t}
              href={`/sources/conflicts${t !== "All" ? `?status=${encodeURIComponent(t)}` : ""}`}
              className={`tab${activeTab === t ? " tab-active" : ""}`}
            >
              {t}
            </Link>
          ))}
        </div>

        {conflicts.length === 0 ? (
          <div className="panel" style={{ textAlign: "center", padding: 48 }}>
            <p style={{ color: "var(--ink-secondary)", marginBottom: 16 }}>
              {activeTab === "All"
                ? "No source conflicts recorded yet."
                : `No conflicts with status "${activeTab}".`}
            </p>
            {activeTab === "All" && (
              <Link href="/sources/conflicts/new" className="btn btn-primary">
                Record a conflict
              </Link>
            )}
          </div>
        ) : (
          <div className="panel">
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Data category</th>
                    <th>Entity</th>
                    <th>Source A vs B</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Review owner</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {conflicts.map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.dataCategory.name}</strong></td>
                      <td>{c.entity?.legalName || <span style={{ color: "var(--ink-tertiary)" }}>—</span>}</td>
                      <td style={{ fontSize: 12 }}>
                        <span style={{ fontWeight: 500 }}>{c.sourceA.name}</span>
                        <span style={{ color: "var(--ink-tertiary)", margin: "0 6px" }}>vs</span>
                        <span style={{ fontWeight: 500 }}>{c.sourceB.name}</span>
                      </td>
                      <td><SeverityBadge severity={c.severity} /></td>
                      <td><StatusBadge status={c.status} /></td>
                      <td>{c.reviewOwner || <span style={{ color: "var(--ink-tertiary)" }}>—</span>}</td>
                      <td>
                        <Link href={`/sources/conflicts/${c.id}`} className="btn">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}