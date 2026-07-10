import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/obligations";
import { RISK_LEVELS } from "@/app/obligations/_constants";
import { ACTION_STATUS_VALUES } from "./_constants";
import { requireOrg } from "@/lib/auth";


function statusBadgeClass(status: string): string {
  if (status === "Complete" || status === "Approved" || status === "Submitted" || status === "Paid") return "badge-green";
  if (status === "In progress" || status === "Under review") return "badge-blue";
  if (status === "Blocked" || status === "Needs owner") return "badge-red";
  if (status === "Needs adviser input" || status === "Needs source verification") return "badge-orange";
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

export default async function ActionsRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{
    entity?: string;
    status?: string;
    risk?: string;
    owner?: string;
    q?: string;
    archived?: string;
  }>;
}) {
  const { organisation: org } = await requireOrg();
  const orgId = org.id;

  const sp = await searchParams;
  const showArchived = sp.archived === "1";

  const entities = await prisma.entity.findMany({
    where: { organisationId: orgId },
    orderBy: { legalName: "asc" },
  });

  const conditions: Prisma.ActionWhereInput[] = [
    { organisationId: orgId },
    { archivedAt: showArchived ? { not: null } : null },
  ];

  if (sp.entity) conditions.push({ entityId: sp.entity });
  if (sp.status) conditions.push({ overallStatus: sp.status });
  if (sp.risk) conditions.push({ riskLevel: sp.risk });
  if (sp.owner) {
    conditions.push({
      OR: [
        { responsibleParty: { contains: sp.owner, mode: "insensitive" } },
        { accountableParty: { contains: sp.owner, mode: "insensitive" } },
      ],
    });
  }
  if (sp.q) {
    conditions.push({ description: { contains: sp.q, mode: "insensitive" } });
  }

  const actions = await prisma.action.findMany({
    where: { AND: conditions },
    include: { entity: { select: { id: true, legalName: true } } },
    orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
    take: 250,
  });

  const hasFilters = !!(sp.entity || sp.status || sp.risk || sp.owner || sp.q);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/">Dashboard</Link> / Actions Register
          </div>
          <h1>Actions Register</h1>
        </div>
        <Link href="/actions-register/new" className="btn btn-primary">+ New Action</Link>
      </div>

      {/* Filter bar */}
      <div className="panel" style={{ padding: "14px 20px", marginBottom: 16 }}>
        <form method="GET" action="/actions-register">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 16px", alignItems: "flex-end" }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ink-secondary)", marginBottom: 3 }}>Entity</label>
              <select name="entity" defaultValue={sp.entity ?? ""} style={{ fontSize: 12, padding: "5px 8px" }}>
                <option value="">All entities</option>
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>{e.legalName}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ink-secondary)", marginBottom: 3 }}>Overall status</label>
              <select name="status" defaultValue={sp.status ?? ""} style={{ fontSize: 12, padding: "5px 8px" }}>
                <option value="">Any status</option>
                {ACTION_STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ink-secondary)", marginBottom: 3 }}>Risk</label>
              <select name="risk" defaultValue={sp.risk ?? ""} style={{ fontSize: 12, padding: "5px 8px" }}>
                <option value="">Any risk</option>
                {RISK_LEVELS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ink-secondary)", marginBottom: 3 }}>Owner</label>
              <input type="text" name="owner" defaultValue={sp.owner ?? ""}
                placeholder="Responsible or accountable owner" style={{ fontSize: 12, padding: "5px 8px", width: 180 }} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ink-secondary)", marginBottom: 3 }}>Search</label>
              <input type="text" name="q" defaultValue={sp.q ?? ""}
                placeholder="Description" style={{ fontSize: 12, padding: "5px 8px", width: 200 }} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ink-secondary)", marginBottom: 3 }}>View</label>
              <div style={{ display: "flex", gap: 6 }}>
                {showArchived
                  ? <a href="/actions-register" className="btn btn-secondary btn-sm">Active</a>
                  : <a href="/actions-register?archived=1" className="btn btn-secondary btn-sm">Archived</a>}
              </div>
            </div>

            <div style={{ display: "flex", gap: 6 }}>
              <button type="submit" className="btn btn-primary btn-sm">Apply</button>
              {hasFilters && (
                <a href={showArchived ? "/actions-register?archived=1" : "/actions-register"} className="btn btn-secondary btn-sm">
                  Clear
                </a>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Table */}
      {actions.length === 0 ? (
        <div className="panel" style={{ textAlign: "center", padding: "48px 24px" }}>
          <p style={{ color: "var(--ink-secondary)", marginBottom: 16 }}>
            {hasFilters || showArchived
              ? "No actions match the current filters."
              : "No actions yet. Create the first one to get started."}
          </p>
          {!hasFilters && !showArchived && (
            <Link href="/actions-register/new" className="btn btn-primary">+ New Action</Link>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted" style={{ marginBottom: 8 }}>
            {actions.length} action{actions.length !== 1 ? "s" : ""}
            {showArchived ? " (archived)" : ""}
            {hasFilters ? " matching filters" : ""}
          </p>
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: 1400 }}>
              <thead>
                <tr>
                  <th>Entity</th>
                  <th style={{ minWidth: 220 }}>Description</th>
                  <th>Responsible owner</th>
                  <th>Accountable owner</th>
                  <th>Deadline</th>
                  <th>Risk</th>
                  <th>Data status</th>
                  <th>Tech review</th>
                  <th>Evidence</th>
                  <th>Filing/submission</th>
                  <th>Payment</th>
                  <th>Overall status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {actions.map((a) => (
                  <tr key={a.id}>
                    <td>{a.entity?.legalName ?? <span className="text-muted">—</span>}</td>
                    <td>
                      <Link href={`/actions-register/${a.id}`} title={a.description}>
                        {a.description.length > 80 ? a.description.slice(0, 80) + "…" : a.description}
                      </Link>
                    </td>
                    <td>{a.responsibleParty ?? <span className="text-muted">—</span>}</td>
                    <td>{a.accountableParty ?? <span className="text-muted">—</span>}</td>
                    <td className={dueDateClass(a.deadline)}>
                      {a.deadline ? fmtDate(a.deadline) : <span className="text-muted">—</span>}
                    </td>
                    <td>
                      {a.riskLevel
                        ? <span className={`badge ${riskBadgeClass(a.riskLevel)}`}>{a.riskLevel}</span>
                        : <span className="text-muted">—</span>}
                    </td>
                    <td>
                      <span className={`badge ${statusBadgeClass(a.dataCompletenessStatus)}`}>
                        {a.dataCompletenessStatus}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${statusBadgeClass(a.technicalReviewStatus)}`}>
                        {a.technicalReviewStatus}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${statusBadgeClass(a.evidenceStatus)}`}>
                        {a.evidenceStatus}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${statusBadgeClass(a.filingSubmissionStatus)}`}>
                        {a.filingSubmissionStatus}
                      </span>
                    </td>
                    <td>
                      {a.paymentRequired
                        ? <span className={`badge ${statusBadgeClass(a.paymentStatus)}`}>{a.paymentStatus}</span>
                        : <span className="text-muted">N/A</span>}
                    </td>
                    <td>
                      <span className={`badge ${statusBadgeClass(a.overallStatus)}`}>
                        {a.overallStatus}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap8">
                        <Link href={`/actions-register/${a.id}`} className="btn btn-secondary btn-sm">View</Link>
                        <Link href={`/actions-register/${a.id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
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