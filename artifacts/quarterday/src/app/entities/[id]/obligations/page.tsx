import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { generateDraftObligations, fmtDate } from "@/lib/obligations";
import { saveObligations } from "@/app/actions/entities";

type Obligation = {
  ruleKey: string;
  ruleId: string;
  title: string;
  dueDate: Date;
  period: string;
};

function groupByYear(obligations: Obligation[]) {
  const map = new Map<number, Obligation[]>();
  for (const ob of obligations) {
    const year = ob.dueDate.getFullYear();
    if (!map.has(year)) map.set(year, []);
    map.get(year)!.push(ob);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

function dueDateClass(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(date);
  due.setHours(0, 0, 0, 0);
  if (due < today) return "due-overdue";
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 30);
  if (due <= soon) return "due-soon";
  return "";
}

export default async function ObligationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const entity = await prisma.entity.findUnique({ where: { id } });
  if (!entity) notFound();

  const rules = await prisma.obligationRule.findMany();

  // Always compute from entity data (live draft)
  const draft = generateDraftObligations(entity, rules);
  const grouped = groupByYear(draft);

  // How many are already saved in DB?
  const savedCount = await prisma.obligation.count({ where: { entityId: id } });

  const saveAction = saveObligations.bind(null, id);

  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/">Dashboard</Link> /{" "}
            <Link href="/entities">Entity Register</Link> /{" "}
            <Link href={`/entities/${id}`}>{entity.legalName}</Link> / Obligations
            Calendar
          </div>
          <h1>Obligations Calendar</h1>
          <p
            className="text-sm text-muted"
            style={{ marginTop: 4, marginBottom: 0 }}
          >
            {entity.legalName} · Year end:{" "}
            {entity.accountingYearEndDay} {MONTHS[entity.accountingYearEndMonth - 1]}
            {entity.vatQuarterEndMonth
              ? ` · VAT: ${MONTHS[entity.vatQuarterEndMonth - 1]} stagger`
              : ""}
          </p>
        </div>
        <form action={saveAction}>
          <button type="submit" className="btn btn-primary">
            {savedCount > 0 ? "Regenerate & Save" : "Save to Database"}
          </button>
        </form>
      </div>

      <div className="alert alert-info">
        <strong>Draft calendar</strong> — {draft.length} obligations generated
        from entity data.{" "}
        {savedCount > 0
          ? `${savedCount} obligations currently saved to the database.`
          : "No obligations saved yet. Click \u201cSave to Database\u201d to persist this calendar."}
      </div>

      {/* Entity flags summary */}
      <div
        className="panel"
        style={{ padding: "12px 16px", marginBottom: 16 }}
      >
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 12, color: "#6b7280" }}>
          <span>
            <strong style={{ color: "#374151" }}>CT regime:</strong>{" "}
            {entity.isVeryLargeCompany
              ? "Very large (QIPs)"
              : entity.isLargeCompany
              ? "Large"
              : "Standard"}
          </span>
          <span>
            <strong style={{ color: "#374151" }}>VAT:</strong>{" "}
            {entity.vatQuarterEndMonth
              ? `Registered (${MONTHS[entity.vatQuarterEndMonth - 1]} stagger)`
              : "Not registered"}
          </span>
          <span>
            <strong style={{ color: "#374151" }}>ERS:</strong>{" "}
            {entity.hasErs ? "Yes" : "No"}
          </span>
          <span>
            <strong style={{ color: "#374151" }}>Pillar 2:</strong>{" "}
            {entity.hasPillar2 ? "In scope" : "Not in scope"}
          </span>
        </div>
      </div>

      {/* Obligations table grouped by year */}
      {grouped.map(([year, obs]) => (
        <div key={year} style={{ marginBottom: 24 }}>
          <table className="data-table">
            <thead className="year-group">
              <tr>
                <th colSpan={4}>{year}</th>
              </tr>
            </thead>
            <thead>
              <tr>
                <th style={{ width: 130 }}>Due Date</th>
                <th>Obligation</th>
                <th>Period</th>
                <th>Rule</th>
              </tr>
            </thead>
            <tbody>
              {obs.map((ob, i) => (
                <tr key={`${ob.ruleKey}-${i}`}>
                  <td className={dueDateClass(ob.dueDate)}>
                    {fmtDate(ob.dueDate)}
                  </td>
                  <td>{ob.title}</td>
                  <td className="text-muted text-sm">{ob.period}</td>
                  <td>
                    <span className="badge badge-grey text-sm">
                      {ob.ruleKey}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {draft.length === 0 && (
        <div className="panel" style={{ textAlign: "center", padding: "40px 24px" }}>
          <p className="text-muted">
            No obligations could be generated. Check that the obligation rules
            have been seeded.
          </p>
          <Link href="/rules" className="btn btn-secondary mt16">
            View obligation rules
          </Link>
        </div>
      )}
    </>
  );
}
