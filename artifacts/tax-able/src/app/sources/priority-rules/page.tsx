import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { requireOrg } from "@/lib/auth";


export default async function PriorityRulesPage() {
  const { organisation: org } = await requireOrg();
  const orgId = org.id;

  const [categories, rules, openConflicts] = await Promise.all([
    prisma.dataCategory.findMany({ orderBy: { displayOrder: "asc" } }),
    prisma.sourcePriorityRule.findMany({
      where: { organisationId: orgId },
      include: {
        dataCategory: true,
        authSource: true,
        secondarySource: true,
        tertiarySource: true,
        reviewOwner: true,
      },
    }),
    prisma.sourceConflict.count({
      where: { organisationId: orgId, status: { notIn: ["Resolved", "Closed as not material"] } },
    }),
  ]);

  const ruleByCategory = Object.fromEntries(rules.map((r) => [r.dataCategoryId, r]));
  const configured = rules.filter((r) => r.authSourceId).length;
  const notConfigured = categories.length - configured;

  return (
    <>
      <div style={{ padding: "28px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h1 style={{ margin: 0 }}>Source Priority Rules</h1>
          <div style={{ display: "flex", gap: 12, fontSize: 13, color: "var(--ink-secondary)" }}>
            <span><strong style={{ color: "var(--ink)" }}>{configured}</strong> configured</span>
            {notConfigured > 0 && (
              <span className="badge badge-yellow">{notConfigured} without authoritative source</span>
            )}
          </div>
        </div>

        <div className="tab-bar" style={{ marginBottom: 24 }}>
          <Link href="/sources" className="tab">Source Systems</Link>
          <Link href="/sources/data-categories" className="tab">Data Categories</Link>
          <Link href="/sources/priority-rules" className="tab tab-active">Priority Rules</Link>
          <Link href="/sources/conflicts" className="tab">
            Conflicts{openConflicts > 0 && <span style={{ marginLeft: 6, background: "var(--overdue-bg)", color: "var(--overdue)", borderRadius: 10, padding: "1px 7px", fontSize: 11 }}>{openConflicts}</span>}
          </Link>
        </div>

        <div className="panel">
          <p style={{ color: "var(--ink-secondary)", marginBottom: 16, fontSize: 13 }}>
            For each data category, specify which source system is authoritative. When the selected source
            is not authoritative, tax-able will show a warning and require an override reason.
          </p>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data category</th>
                  <th>Authoritative source</th>
                  <th>Secondary source</th>
                  <th>Tertiary source</th>
                  <th>Conflict handling</th>
                  <th>Review owner</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => {
                  const rule = ruleByCategory[cat.id];
                  const noAuth = !rule?.authSourceId;
                  return (
                    <tr key={cat.id} style={noAuth ? { background: "var(--due-soon-bg)" } : {}}>
                      <td>
                        <strong>{cat.name}</strong>
                        {noAuth && (
                          <div style={{ fontSize: 11, color: "var(--due-soon)", marginTop: 2 }}>
                            ⚠ No authoritative source defined
                          </div>
                        )}
                      </td>
                      <td>
                        {rule?.authSource ? (
                          <span style={{ fontWeight: 500 }}>{rule.authSource.name}</span>
                        ) : (
                          <span style={{ color: "var(--ink-tertiary)" }}>—</span>
                        )}
                      </td>
                      <td>{rule?.secondarySource?.name || <span style={{ color: "var(--ink-tertiary)" }}>—</span>}</td>
                      <td>{rule?.tertiarySource?.name || <span style={{ color: "var(--ink-tertiary)" }}>—</span>}</td>
                      <td>
                        {rule?.conflictHandling ? (
                          <span style={{ fontSize: 12 }}>{rule.conflictHandling}</span>
                        ) : (
                          <span style={{ color: "var(--ink-tertiary)" }}>—</span>
                        )}
                      </td>
                      <td>{rule?.reviewOwner ? `${rule.reviewOwner.name} (${rule.reviewOwner.id})` : <span style={{ color: "var(--ink-tertiary)" }}>—</span>}</td>
                      <td>
                        <Link href={`/sources/priority-rules/${cat.id}`} className="btn">
                          {rule ? "Edit" : "Configure"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
