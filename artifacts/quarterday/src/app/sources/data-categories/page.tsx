import { AppShell } from "@/components/nav";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

const ORG_ID = "demo-org";

export default async function DataCategoriesPage() {
  const [categories, rules, conflicts] = await Promise.all([
    prisma.dataCategory.findMany({ orderBy: { displayOrder: "asc" } }),
    prisma.sourcePriorityRule.findMany({
      where: { organisationId: ORG_ID },
      include: { dataCategory: true, authSource: true },
    }),
    prisma.sourceConflict.findMany({
      where: { organisationId: ORG_ID, status: { notIn: ["Resolved", "Closed as not material"] } },
      select: { dataCategoryId: true },
    }),
  ]);

  const ruleByCategory = Object.fromEntries(rules.map((r) => [r.dataCategoryId, r]));
  const conflictCategories = new Set(conflicts.map((c) => c.dataCategoryId));

  const openConflicts = conflicts.length;

  return (
    <AppShell>
      <div style={{ padding: "28px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h1 style={{ margin: 0 }}>Data Categories</h1>
        </div>

        <div className="tab-bar" style={{ marginBottom: 24 }}>
          <Link href="/sources" className="tab">Source Systems</Link>
          <Link href="/sources/data-categories" className="tab tab-active">Data Categories</Link>
          <Link href="/sources/priority-rules" className="tab">Priority Rules</Link>
          <Link href="/sources/conflicts" className="tab">
            Conflicts{openConflicts > 0 && <span style={{ marginLeft: 6, background: "#fef2f2", color: "#b91c1c", borderRadius: 10, padding: "1px 7px", fontSize: 11 }}>{openConflicts}</span>}
          </Link>
        </div>

        <div className="panel">
          <p style={{ color: "#6b7280", marginBottom: 16, fontSize: 13 }}>
            35 data categories tracked across your tax obligations. For each category, define which source system is authoritative on the{" "}
            <Link href="/sources/priority-rules">Priority Rules</Link> page.
          </p>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Data category</th>
                  <th>Authoritative source</th>
                  <th>Priority rule</th>
                  <th>Open conflicts</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat, i) => {
                  const rule = ruleByCategory[cat.id];
                  const hasConflict = conflictCategories.has(cat.id);
                  return (
                    <tr key={cat.id}>
                      <td style={{ color: "#9ca3af" }}>{i + 1}</td>
                      <td><strong>{cat.name}</strong></td>
                      <td>
                        {rule?.authSource ? (
                          rule.authSource.name
                        ) : (
                          <span className="badge badge-yellow">⚠ No authoritative source defined</span>
                        )}
                      </td>
                      <td>
                        {rule ? (
                          <span className="badge badge-green">Configured</span>
                        ) : (
                          <span className="badge badge-grey">Not configured</span>
                        )}
                      </td>
                      <td>
                        {hasConflict ? (
                          <span className="badge badge-red">Open conflict</span>
                        ) : (
                          <span style={{ color: "#9ca3af" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
