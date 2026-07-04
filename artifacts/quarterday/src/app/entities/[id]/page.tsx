import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/obligations";
import { deleteEntity } from "@/app/actions/entities";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function EntityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const entity = await prisma.entity.findUnique({
    where: { id },
    include: {
      _count: { select: { obligations: true } },
      obligations: {
        where: {
          dueDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { dueDate: "asc" },
        take: 5,
        include: { rule: true },
      },
    },
  });

  if (!entity) notFound();

  const flags = [
    { key: "isLargeCompany", label: "Large company", active: entity.isLargeCompany },
    { key: "isVeryLargeCompany", label: "Very large company", active: entity.isVeryLargeCompany },
    { key: "hasErs", label: "ERS", active: entity.hasErs },
    { key: "hasPillar2", label: "Pillar 2", active: entity.hasPillar2 },
  ];

  const vatLabel = entity.vatQuarterEndMonth
    ? `${MONTHS[entity.vatQuarterEndMonth - 1]} stagger`
    : "Not registered";

  const yearEndLabel = `${entity.accountingYearEndDay} ${
    MONTHS[entity.accountingYearEndMonth - 1]
  }`;

  const deleteAction = deleteEntity.bind(null, entity.id);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/">Dashboard</Link> /{" "}
            <Link href="/entities">Entity Register</Link> / {entity.legalName}
          </div>
          <h1>{entity.legalName}</h1>
        </div>
        <div className="flex gap8">
          <Link
            href={`/entities/${entity.id}/obligations`}
            className="btn btn-primary"
          >
            View Obligations Calendar
          </Link>
        </div>
      </div>

      {/* Core details */}
      <div className="panel">
        <h2>Entity details</h2>
        <div className="detail-grid">
          <div className="detail-item">
            <div className="detail-label">Legal name</div>
            <div className="detail-value">{entity.legalName}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Companies House number</div>
            <div className="detail-value">
              {entity.companiesHouseNumber || "—"}
            </div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Jurisdiction</div>
            <div className="detail-value">{entity.jurisdiction}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Accounting year end</div>
            <div className="detail-value">{yearEndLabel}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">VAT quarter</div>
            <div className="detail-value">{vatLabel}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Obligations on record</div>
            <div className="detail-value">{entity._count.obligations}</div>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <div
            className="detail-label"
            style={{ marginBottom: 8 }}
          >
            Classification flags
          </div>
          <div className="flag-row">
            {flags.map((f) => (
              <span
                key={f.key}
                className={`badge ${f.active ? "badge-blue" : "badge-grey"}`}
              >
                {f.label}
              </span>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 16, fontSize: 12, color: "#9ca3af" }}>
          Added {fmtDate(entity.createdAt)} · Last updated{" "}
          {fmtDate(entity.updatedAt)}
        </div>
      </div>

      {/* Upcoming obligations */}
      {entity.obligations.length > 0 && (
        <div className="panel">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <h2 style={{ margin: 0 }}>Upcoming obligations (next 90 days)</h2>
            <Link
              href={`/entities/${entity.id}/obligations`}
              className="text-sm"
            >
              Full calendar →
            </Link>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Due Date</th>
                <th>Obligation</th>
                <th>Period</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {entity.obligations.map((ob) => (
                <tr key={ob.id}>
                  <td>{fmtDate(ob.dueDate)}</td>
                  <td>{ob.title}</td>
                  <td className="text-muted text-sm">{ob.period}</td>
                  <td>
                    <span className="badge badge-grey">{ob.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {entity._count.obligations === 0 && (
        <div className="alert alert-info">
          No obligations have been generated yet.{" "}
          <Link href={`/entities/${entity.id}/obligations`}>
            Generate the obligations calendar →
          </Link>
        </div>
      )}

      {/* Danger zone */}
      <div
        className="panel"
        style={{ borderColor: "#fecaca", marginTop: 32 }}
      >
        <h2>Danger zone</h2>
        <p className="text-sm text-muted">
          Deleting an entity will permanently remove it and all its associated
          obligations. This cannot be undone.
        </p>
        <form action={deleteAction}>
          <button type="submit" className="btn btn-danger btn-sm">
            Delete entity
          </button>
        </form>
      </div>
    </>
  );
}
