import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/obligations";
import { REGIMES, STATUS_VALUES, RISK_LEVELS } from "./_constants";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function statusBadgeClass(status: string): string {
  if (status === "Complete" || status === "Approved") return "badge-green";
  if (status === "In progress") return "badge-blue";
  if (status === "Blocked") return "badge-red";
  if (status === "Ready for review") return "badge-yellow";
  return "badge-grey";
}

function riskBadgeClass(risk: string | null): string {
  if (risk === "Critical") return "badge-red";
  if (risk === "High") return "badge-orange";
  if (risk === "Medium") return "badge-yellow";
  if (risk === "Low") return "badge-green";
  return "badge-grey";
}

function dueDateClass(date: Date | null): string {
  if (!date) return "";
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  if (d < now) return "due-overdue";
  const soon = new Date(now);
  soon.setDate(soon.getDate() + 14);
  if (d <= soon) return "due-soon";
  return "";
}

export default async function ObligationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    entity?: string;
    regime?: string;
    status?: string;
    risk?: string;
    due?: string;
    owner?: string;
    q?: string;
    archived?: string;
  }>;
}) {
  const sp = await searchParams;
  const showArchived = sp.archived === "1";
  const now = new Date();

  const org = await prisma.organisation.findFirst();
  const entities = org
    ? await prisma.entity.findMany({ where: { organisationId: org.id }, orderBy: { legalName: "asc" } })
    : [];

  const conditions: Prisma.ManualObligationWhereInput[] = [
    { organisationId: org?.id ?? "" },
    { archivedAt: showArchived ? { not: null } : null },
  ];

  if (sp.entity) conditions.push({ entityId: sp.entity });
  if (sp.regime) conditions.push({ regime: sp.regime });
  if (sp.status) conditions.push({ overallWorkflowStatus: sp.status });
  if (sp.risk) conditions.push({ riskLevel: sp.risk });
  if (sp.owner) conditions.push({ responsibleOwner: { contains: sp.owner, mode: "insensitive" } });
  if (sp.q) {
    conditions.push({
      OR: [
        { description: { contains: sp.q, mode: "insensitive" } },
        { statutoryBasis: { contains: sp.q, mode: "insensitive" } },
      ],
    });
  }
  if (sp.due === "overdue") conditions.push({ filingDeadline: { lt: now } });
  else if (sp.due === "7d") conditions.push({ filingDeadline: { gte: now, lte: addDays(now, 7) } });
  else if (sp.due === "30d") conditions.push({ filingDeadline: { gte: now, lte: addDays(now, 30) } });
  else if (sp.due === "90d") conditions.push({ filingDeadline: { gte: now, lte: addDays(now, 90) } });

  const obligations = await prisma.manualObligation.findMany({
    where: { AND: conditions },
    include: { entity: { select: { id: true, legalName: true } } },
    orderBy: [{ filingDeadline: "asc" }, { createdAt: "desc" }],
    take: 250,
  });

  const hasFilters = !!(sp.entity || sp.regime || sp.status || sp.risk || sp.due || sp.owner || sp.q);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/">Dashboard</Link> / Obligation Register
          </div>
          <h1>Obligation Register</h1>
        </div>
        <Link href="/obligations/new" className="btn btn-primary">+ New Obligation</Link>
      </div>

      {/* Filter bar */}
      <div className="panel" style={{ padding: "14px 20px", marginBottom: 16 }}>
        <form method="GET" action="/obligations">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 16px", alignItems: "flex-end" }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 3 }}>Entity</label>
              <select name="entity" defaultValue={sp.entity ?? ""} style={{ fontSize: 12, padding: "5px 8px" }}>
                <option value="">All entities</option>
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>{e.legalName}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 3 }}>Regime</label>
              <select name="regime" defaultValue={sp.regime ?? ""} style={{ fontSize: 12, padding: "5px 8px" }}>
                <option value="">All regimes</option>
                {REGIMES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 3 }}>Overall status</label>
              <select name="status" defaultValue={sp.status ?? ""} style={{ fontSize: 12, padding: "5px 8px" }}>
                <option value="">Any status</option>
                {STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 3 }}>Risk</label>
              <select name="risk" defaultValue={sp.risk ?? ""} style={{ fontSize: 12, padding: "5px 8px" }}>
                <option value="">Any risk</option>
                {RISK_LEVELS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 3 }}>Filing due</label>
              <select name="due" defaultValue={sp.due ?? ""} style={{ fontSize: 12, padding: "5px 8px" }}>
                <option value="">Any date</option>
                <option value="overdue">Overdue</option>
                <option value="7d">Due in 7 days</option>
                <option value="30d">Due in 30 days</option>
                <option value="90d">Due in 90 days</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 3 }}>Owner</label>
              <input type="text" name="owner" defaultValue={sp.owner ?? ""}
                placeholder="Responsible owner" style={{ fontSize: 12, padding: "5px 8px", width: 140 }} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 3 }}>Search</label>
              <input type="text" name="q" defaultValue={sp.q ?? ""}
                placeholder="Description or statutory basis" style={{ fontSize: 12, padding: "5px 8px", width: 200 }} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 3 }}>View</label>
              <div style={{ display: "flex", gap: 6 }}>
                {showArchived
                  ? <a href="/obligations" className="btn btn-secondary btn-sm">Active</a>
                  : <a href="/obligations?archived=1" className="btn btn-secondary btn-sm">Archived</a>}
              </div>
            </div>

            <div style={{ display: "flex", gap: 6 }}>
              <button type="submit" className="btn btn-primary btn-sm">Apply</button>
              {hasFilters && (
                <a href={showArchived ? "/obligations?archived=1" : "/obligations"} className="btn btn-secondary btn-sm">
                  Clear
                </a>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Table */}
      {obligations.length === 0 ? (
        <div className="panel" style={{ textAlign: "center", padding: "48px 24px" }}>
          <p style={{ color: "#6b7280", marginBottom: 16 }}>
            {hasFilters || showArchived
              ? "No obligations match the current filters."
              : "No obligations yet. Create the first one to get started."}
          </p>
          {!hasFilters && !showArchived && (
            <Link href="/obligations/new" className="btn btn-primary">+ New Obligation</Link>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted" style={{ marginBottom: 8 }}>
            {obligations.length} obligation{obligations.length !== 1 ? "s" : ""}
            {showArchived ? " (archived)" : ""}
            {hasFilters ? " matching filters" : ""}
          </p>
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: 1400 }}>
              <thead>
                <tr>
                  <th>Entity</th>
                  <th>Regime</th>
                  <th>Type</th>
                  <th style={{ minWidth: 220 }}>Description</th>
                  <th>Filing deadline</th>
                  <th>Payment deadline</th>
                  <th>Responsible owner</th>
                  <th>Risk</th>
                  <th>Overall status</th>
                  <th>Evidence</th>
                  <th>Tech review</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {obligations.map((ob) => (
                  <tr key={ob.id}>
                    <td>{ob.entity?.legalName ?? <span className="text-muted">—</span>}</td>
                    <td>
                      <span className="badge badge-grey" style={{ fontWeight: 500 }}>{ob.regime}</span>
                    </td>
                    <td className="text-sm text-muted">{ob.obligationType}</td>
                    <td>
                      <Link href={`/obligations/${ob.id}`} title={ob.description}>
                        {ob.description.length > 80 ? ob.description.slice(0, 80) + "…" : ob.description}
                      </Link>
                    </td>
                    <td className={dueDateClass(ob.filingDeadline)}>
                      {ob.filingDeadline ? fmtDate(ob.filingDeadline) : <span className="text-muted">—</span>}
                    </td>
                    <td className={dueDateClass(ob.paymentDeadline)}>
                      {ob.paymentDeadline ? fmtDate(ob.paymentDeadline) : <span className="text-muted">—</span>}
                    </td>
                    <td>{ob.responsibleOwner ?? <span className="text-muted">—</span>}</td>
                    <td>
                      {ob.riskLevel
                        ? <span className={`badge ${riskBadgeClass(ob.riskLevel)}`}>{ob.riskLevel}</span>
                        : <span className="text-muted">—</span>}
                    </td>
                    <td>
                      <span className={`badge ${statusBadgeClass(ob.overallWorkflowStatus)}`}>
                        {ob.overallWorkflowStatus}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${statusBadgeClass(ob.evidenceStatus)}`}>
                        {ob.evidenceStatus}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${statusBadgeClass(ob.technicalReviewStatus)}`}>
                        {ob.technicalReviewStatus}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap8">
                        <Link href={`/obligations/${ob.id}`} className="btn btn-secondary btn-sm">View</Link>
                        <Link href={`/obligations/${ob.id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
