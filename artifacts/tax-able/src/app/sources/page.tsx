import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { requireOrg } from "@/lib/auth";


function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "Active"
      ? "badge-green"
      : status === "Planned"
      ? "badge-blue"
      : "badge-grey";
  return <span className={`badge ${cls}`}>{status}</span>;
}

export default async function SourceSystemsPage() {
  const { organisation: org } = await requireOrg();
  const orgId = org.id;

  const [sourceSystems, openConflicts] = await Promise.all([
    prisma.sourceSystem.findMany({
      where: { organisationId: orgId },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    }),
    prisma.sourceConflict.count({
      where: { organisationId: orgId, status: { notIn: ["Resolved", "Closed as not material"] } },
    }),
  ]);

  return (
    <>
      <div style={{ padding: "28px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h1 style={{ margin: 0 }}>Source Systems</h1>
          <Link href="/sources/new" className="btn btn-primary">
            Add Source System
          </Link>
        </div>

        <div className="tab-bar" style={{ marginBottom: 24 }}>
          <Link href="/sources" className="tab tab-active">Source Systems</Link>
          <Link href="/sources/data-categories" className="tab">Data Categories</Link>
          <Link href="/sources/priority-rules" className="tab">Priority Rules</Link>
          <Link href="/sources/conflicts" className="tab">
            Conflicts{openConflicts > 0 && <span style={{ marginLeft: 6, background: "var(--overdue-bg)", color: "var(--overdue)", borderRadius: 10, padding: "1px 7px", fontSize: 11 }}>{openConflicts}</span>}
          </Link>
        </div>

        {sourceSystems.length === 0 ? (
          <div className="panel" style={{ textAlign: "center", padding: 48 }}>
            <p style={{ color: "var(--ink-secondary)", marginBottom: 16 }}>
              No source systems defined yet. Add the systems your team relies on for tax data.
            </p>
            <Link href="/sources/new" className="btn btn-primary">Add your first source system</Link>
          </div>
        ) : (
          <div className="panel">
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Owner</th>
                    <th>Department</th>
                    <th>Access</th>
                    <th>Personal data</th>
                    <th>Privileged</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sourceSystems.map((ss) => (
                    <tr key={ss.id} style={ss.status === "Archived" ? { opacity: 0.55 } : {}}>
                      <td>
                        <strong>{ss.name}</strong>
                        {ss.externalProvider && (
                          <div style={{ color: "var(--ink-secondary)", fontSize: 12, marginTop: 2 }}>
                            {ss.externalProvider}
                          </div>
                        )}
                      </td>
                      <td>{ss.systemType}</td>
                      <td>{ss.owner || "—"}</td>
                      <td>{ss.department || "—"}</td>
                      <td>{ss.accessMethod || "—"}</td>
                      <td>
                        {ss.containsPersonalData ? (
                          <span className="badge badge-yellow">Yes</span>
                        ) : (
                          <span className="badge badge-grey">No</span>
                        )}
                      </td>
                      <td>
                        {ss.containsPrivilegedData ? (
                          <span className="badge badge-purple">Yes</span>
                        ) : (
                          <span className="badge badge-grey">No</span>
                        )}
                      </td>
                      <td><StatusBadge status={ss.status} /></td>
                      <td>
                        <Link href={`/sources/${ss.id}/edit`} className="btn">Edit</Link>
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