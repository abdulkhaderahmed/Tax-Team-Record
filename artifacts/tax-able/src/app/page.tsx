import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/obligations";
import { requireOrg } from "@/lib/auth";

const OPEN_REVIEW_STATUSES = ["Needs review", "In review", "Needs adviser input", "Needs source verification"];

export default async function DashboardPage() {
  const { organisation: org } = await requireOrg();
  const orgId = org.id;
  const [entityCount, obligationCount, openReviewCount, runningExtractionCount, upcoming, recentEntities] =
    await Promise.all([
      prisma.entity.count({ where: { organisationId: orgId } }),
      prisma.obligation.count(),
      prisma.reviewItem.count({ where: { organisationId: orgId, reviewStatus: { in: OPEN_REVIEW_STATUSES } } }),
      prisma.extractionRun.count({ where: { organisationId: orgId, status: { in: ["Pending", "Running"] } } }),
      prisma.obligation.findMany({
        where: {
          dueDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          },
          status: "DRAFT",
        },
        orderBy: { dueDate: "asc" },
        take: 10,
        include: { entity: true, rule: true },
      }),
      prisma.entity.findMany({
        where: { organisationId: orgId },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
        </div>
        <Link href="/entities/new" className="btn btn-primary">
          + New Entity
        </Link>
      </div>

      {/* Stats */}
      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-value">{entityCount}</div>
          <div className="stat-label">Entities</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{obligationCount}</div>
          <div className="stat-label">Obligations on record</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{upcoming.length}</div>
          <div className="stat-label">Due in next 90 days</div>
        </div>
        <Link href="/review" className="stat-card" style={{ textDecoration: "none" }}>
          <div className="stat-value">{openReviewCount}</div>
          <div className="stat-label">Review queue</div>
        </Link>
        <div className="stat-card">
          <div className="stat-value">{runningExtractionCount}</div>
          <div className="stat-label">Extractions running</div>
        </div>
      </div>

      {/* Upcoming obligations */}
      <div className="panel">
        <h2>Upcoming obligations (next 90 days)</h2>
        {upcoming.length === 0 ? (
          <p className="text-muted">
            No upcoming obligations.{" "}
            {entityCount === 0 ? (
              <>
                <Link href="/entities/new">Add an entity</Link> to get started.
              </>
            ) : (
              <>
                Open an entity and generate its{" "}
                <Link href="/entities">obligations calendar</Link>.
              </>
            )}
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Due Date</th>
                <th>Obligation</th>
                <th>Entity</th>
                <th>Period</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((ob) => {
                const isOverdue = ob.dueDate < new Date();
                const isSoon =
                  !isOverdue &&
                  ob.dueDate < new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
                return (
                  <tr key={ob.id}>
                    <td
                      className={
                        isOverdue
                          ? "due-overdue"
                          : isSoon
                          ? "due-soon"
                          : undefined
                      }
                    >
                      {fmtDate(ob.dueDate)}
                    </td>
                    <td>{ob.title}</td>
                    <td>
                      <Link href={`/entities/${ob.entityId}`}>
                        {ob.entity.legalName}
                      </Link>
                    </td>
                    <td className="text-muted text-sm">{ob.period}</td>
                    <td>
                      <span className="badge badge-grey">{ob.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent entities */}
      {recentEntities.length > 0 && (
        <div className="panel">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <h2 style={{ margin: 0 }}>Recent entities</h2>
            <Link href="/entities" className="text-sm">
              View all →
            </Link>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Legal Name</th>
                <th>Jurisdiction</th>
                <th>Period End</th>
                <th>Added</th>
              </tr>
            </thead>
            <tbody>
              {recentEntities.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link href={`/entities/${e.id}`}>{e.legalName}</Link>
                  </td>
                  <td>{e.jurisdiction}</td>
                  <td>
                    {e.accountingPeriodEnd ? fmtDate(e.accountingPeriodEnd) : "—"}
                  </td>
                  <td className="text-muted text-sm">
                    {fmtDate(e.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
