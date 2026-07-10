import Link from "next/link";
import { prisma } from "@/lib/prisma";

const APPLIES_TO_LABELS: Record<string, string> = {
  ALL: "All entities",
  STANDARD_AND_LARGE: "Standard & large companies",
  VERY_LARGE: "Very large companies",
  VAT_REGISTERED: "VAT registered entities",
  EMPLOYER: "All employers",
  ERS: "ERS entities",
};

export default async function RulesPage() {
  const rules = await prisma.obligationRule.findMany({
    orderBy: { ruleKey: "asc" },
  });

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/">Dashboard</Link> / Obligation Rules
          </div>
          <h1>Obligation Rules</h1>
        </div>
      </div>

      {rules.length === 0 ? (
        <div className="alert alert-warning">
          No obligation rules found. The seed script has not been run yet.
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Rule Key</th>
              <th>Name</th>
              <th>Description</th>
              <th>Applies to</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className="badge badge-grey">{r.ruleKey}</span>
                </td>
                <td style={{ fontWeight: 500 }}>{r.name}</td>
                <td className="text-sm text-muted">{r.description}</td>
                <td>
                  <span className="badge badge-blue">
                    {APPLIES_TO_LABELS[r.appliesTo] ?? r.appliesTo}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="text-sm text-muted mt16">
        Rules are seeded automatically. The calculation logic for each rule is
        applied in <code>src/lib/obligations.ts</code>.
      </p>
    </>
  );
}
