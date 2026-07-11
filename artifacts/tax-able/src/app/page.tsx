import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/obligations";
import { requireOrg } from "@/lib/auth";
import { documentAccessWhere } from "@/lib/authz";

const OPEN_REVIEW_STATUSES = ["Needs review", "In review", "Needs adviser input", "Needs source verification"];

export default async function DashboardPage() {
  const context = await requireOrg();
  const orgId = context.orgId;
  const horizon = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const [
    entityCount,
    obligationCount,
    openReviewCount,
    runningExtractionCount,
    blockingExceptionCount,
    overdueRequestCount,
    pendingApprovalCount,
    upcoming,
    recentEntities,
  ] =
    await Promise.all([
      prisma.entity.count({ where: { organisationId: orgId, deletedAt: null } }),
      prisma.obligation.count({
        where: {
          organisationId: orgId,
          deletedAt: null,
          archivedAt: null,
          OR: [{ draftReviewStatus: null }, { draftReviewStatus: "activated" }],
        },
      }),
      prisma.reviewItem.count({ where: { organisationId: orgId, document: documentAccessWhere(context, "view"), reviewStatus: { in: OPEN_REVIEW_STATUSES } } }),
      prisma.extractionRun.count({ where: { organisationId: orgId, document: documentAccessWhere(context, "view"), status: { in: ["Pending", "Running"] } } }),
      prisma.exception.count({
        where: {
          organisationId: orgId,
          blocksFiling: true,
          status: { in: ["Open", "In progress"] },
        },
      }),
      prisma.dataRequest.count({
        where: {
          organisationId: orgId,
          status: { in: ["Open", "Draft"] },
          dueDate: { lt: new Date() },
        },
      }),
      prisma.approval.count({ where: { organisationId: orgId, status: "Pending" } }),
      prisma.obligation.findMany({
        where: {
          organisationId: orgId,
          archivedAt: null,
          deletedAt: null,
          AND: [
            { OR: [{ draftReviewStatus: "activated" }, { draftReviewStatus: null }] },
            { OR: [
              { filingDeadline: { gte: new Date(), lte: horizon } },
              { paymentDeadline: { gte: new Date(), lte: horizon } },
              { internalTargetDate: { gte: new Date(), lte: horizon } },
            ] },
          ],
        },
        orderBy: [{ filingDeadline: "asc" }, { paymentDeadline: "asc" }],
        take: 10,
        include: { entity: true, ruleVersion: { include: { rule: true } } },
      }),
      prisma.entity.findMany({
        where: { organisationId: orgId, deletedAt: null },
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
        <Link href="/exceptions" className="stat-card" style={{ textDecoration: "none" }}>
          <div className="stat-value">{blockingExceptionCount}</div>
          <div className="stat-label">Filing blockers</div>
        </Link>
        <Link href="/data-requests" className="stat-card" style={{ textDecoration: "none" }}>
          <div className="stat-value">{overdueRequestCount}</div>
          <div className="stat-label">Overdue data requests</div>
        </Link>
        <Link href="/approvals" className="stat-card" style={{ textDecoration: "none" }}>
          <div className="stat-value">{pendingApprovalCount}</div>
          <div className="stat-label">Pending approvals</div>
        </Link>
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
                const dueDate = ob.filingDeadline ?? ob.paymentDeadline ?? ob.internalTargetDate;
                if (!dueDate) return null;
                const isOverdue = dueDate < new Date();
                const isSoon =
                  !isOverdue &&
                  dueDate < new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
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
                      {fmtDate(dueDate)}
                    </td>
                    <td>
                      <Link href={`/obligations/${ob.id}`}>{ob.description}</Link>
                      {ob.ruleVersion && (
                        <div className="text-muted text-sm">
                          {ob.ruleVersion.rule.ruleKey} · v{ob.ruleVersion.version}
                        </div>
                      )}
                    </td>
                    <td>
                      {ob.entity ? (
                        <Link href={`/entities/${ob.entity.id}`}>{ob.entity.legalName}</Link>
                      ) : "—"}
                    </td>
                    <td className="text-muted text-sm">
                      {ob.periodEnd ? `Ended ${fmtDate(ob.periodEnd)}` : "—"}
                    </td>
                    <td>
                      <span className="badge badge-grey">{ob.overallWorkflowStatus}</span>
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
