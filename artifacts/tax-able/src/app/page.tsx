import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/auth";
import { documentAccessWhere } from "@/lib/authz";

export const dynamic = "force-dynamic";

const OPEN_REVIEW_STATUSES = [
  "Needs review",
  "In review",
  "Needs adviser input",
  "Needs source verification",
];

type AttentionItem = {
  id: string;
  kind: string;
  title: string;
  context: string;
  href: string;
  tone: "red" | "amber" | "blue";
};

type AdviceMatter = {
  id: string;
  title: string;
  documentType: string;
  entity: string;
  status: string;
  candidateCount: number;
  conditionalCount: number;
  href: string;
};

type DeadlineItem = {
  id: string;
  title: string;
  entity: string;
  dueDate: Date;
  status: string;
  href: string;
};

type WorkbenchData = {
  isGuidedDemo: boolean;
  organisationName: string;
  reviewCount: number;
  blockerCount: number;
  pendingApprovalCount: number;
  overdueRequestCount: number;
  attention: AttentionItem[];
  adviceMatters: AdviceMatter[];
  deadlines: DeadlineItem[];
};

function fmtDate(date: Date) {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function demoWorkbench(): WorkbenchData {
  return {
    isGuidedDemo: true,
    organisationName: "Northstar Group — sample workspace",
    reviewCount: 6,
    blockerCount: 2,
    pendingApprovalCount: 1,
    overdueRequestCount: 2,
    attention: [
      {
        id: "sample-advice",
        kind: "Advice review",
        title: "Confirm the controls arising from an EOT valuation",
        context: "3 cited candidates · all preserve a condition",
        href: "/demo/advice",
        tone: "blue",
      },
      {
        id: "sample-blocker",
        kind: "Blocker",
        title: "Share consideration has not been reconciled to the valuation",
        context: "Owner: Tax Manager · required before transaction approval",
        href: "/demo/advice",
        tone: "red",
      },
      {
        id: "sample-request",
        kind: "Data request",
        title: "Payroll confirmation for benefits population is overdue",
        context: "Payroll · due 23 Jul 2026",
        href: "/data-requests",
        tone: "amber",
      },
    ],
    adviceMatters: [
      {
        id: "sample-valuation",
        title: "EOT valuation reliance",
        documentType: "Valuation report",
        entity: "Northstar Operations Ltd",
        status: "Human review",
        candidateCount: 3,
        conditionalCount: 3,
        href: "/demo/advice",
      },
    ],
    deadlines: [
      {
        id: "sample-psa",
        title: "PSA calculation and approval",
        entity: "Northstar Operations Ltd",
        dueDate: new Date("2026-07-31T12:00:00.000Z"),
        status: "Blocked",
        href: "/obligations",
      },
      {
        id: "sample-ct",
        title: "Corporation Tax payment",
        entity: "Northstar Services Ltd",
        dueDate: new Date("2026-08-05T12:00:00.000Z"),
        status: "In progress",
        href: "/obligations",
      },
      {
        id: "sample-vat",
        title: "VAT return",
        entity: "Northstar Trading Ltd",
        dueDate: new Date("2026-08-07T12:00:00.000Z"),
        status: "On track",
        href: "/obligations",
      },
    ],
  };
}

async function loadWorkbench(): Promise<WorkbenchData> {
  try {
    const context = await requireOrg();
    const now = new Date();
    const horizon = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const documentWhere = documentAccessWhere(context, "view");

    const [
      reviewCount,
      blockerCount,
      pendingApprovalCount,
      overdueRequestCount,
      reviewItems,
      blockers,
      overdueRequests,
      pendingApprovals,
      recentDocuments,
      upcomingObligations,
    ] = await Promise.all([
      prisma.reviewItem.count({
        where: {
          organisationId: context.orgId,
          document: documentWhere,
          reviewStatus: { in: OPEN_REVIEW_STATUSES },
        },
      }),
      prisma.exception.count({
        where: {
          organisationId: context.orgId,
          blocksFiling: true,
          status: { in: ["Open", "In progress"] },
        },
      }),
      prisma.approval.count({
        where: { organisationId: context.orgId, status: "Pending" },
      }),
      prisma.dataRequest.count({
        where: {
          organisationId: context.orgId,
          status: { in: ["Open", "Draft"] },
          dueDate: { lt: now },
        },
      }),
      prisma.reviewItem.findMany({
        where: {
          organisationId: context.orgId,
          document: documentAccessWhere(context, "review"),
          reviewStatus: { in: OPEN_REVIEW_STATUSES },
        },
        include: {
          document: { select: { filename: true } },
          extractionRun: { select: { id: true } },
        },
        orderBy: [{ requiresSourceVerification: "desc" }, { updatedAt: "desc" }],
        take: 3,
      }),
      prisma.exception.findMany({
        where: {
          organisationId: context.orgId,
          blocksFiling: true,
          status: { in: ["Open", "In progress"] },
        },
        orderBy: [{ severity: "desc" }, { targetResolutionDate: "asc" }],
        take: 3,
      }),
      prisma.dataRequest.findMany({
        where: {
          organisationId: context.orgId,
          status: { in: ["Open", "Draft"] },
          dueDate: { lt: now },
        },
        orderBy: { dueDate: "asc" },
        take: 3,
      }),
      prisma.approval.findMany({
        where: { organisationId: context.orgId, status: "Pending" },
        include: {
          action: { select: { description: true } },
          obligation: { select: { description: true } },
          entity: { select: { legalName: true } },
        },
        orderBy: { requestedAt: "asc" },
        take: 3,
      }),
      prisma.document.findMany({
        where: { AND: [documentWhere, { deletedAt: null }] },
        include: {
          entity: { select: { legalName: true } },
          reviewItems: {
            where: { reviewStatus: { in: OPEN_REVIEW_STATUSES } },
            select: { isConditional: true },
          },
        },
        orderBy: { uploadedAt: "desc" },
        take: 5,
      }),
      prisma.obligation.findMany({
        where: {
          organisationId: context.orgId,
          archivedAt: null,
          deletedAt: null,
          OR: [{ draftReviewStatus: null }, { draftReviewStatus: "activated" }],
          AND: [
            {
              OR: [
                { filingDeadline: { gte: now, lte: horizon } },
                { paymentDeadline: { gte: now, lte: horizon } },
                { internalTargetDate: { gte: now, lte: horizon } },
              ],
            },
          ],
        },
        include: { entity: { select: { legalName: true } } },
        orderBy: [{ filingDeadline: "asc" }, { paymentDeadline: "asc" }],
        take: 6,
      }),
    ]);

    const hasOperationalData =
      reviewCount > 0 ||
      blockerCount > 0 ||
      pendingApprovalCount > 0 ||
      overdueRequestCount > 0 ||
      recentDocuments.length > 0 ||
      upcomingObligations.length > 0;

    if (!hasOperationalData) {
      return {
        ...demoWorkbench(),
        organisationName: `${context.organisation.name} — guided sample`,
      };
    }

    const attention: AttentionItem[] = [
      ...blockers.map((item) => ({
        id: item.id,
        kind: "Blocker",
        title: item.title,
        context: `${item.severity} severity${item.targetResolutionDate ? ` · target ${fmtDate(item.targetResolutionDate)}` : ""}`,
        href: "/exceptions",
        tone: "red" as const,
      })),
      ...overdueRequests.map((item) => ({
        id: item.id,
        kind: "Data request",
        title: item.description,
        context: `${item.requestedFromDepartment ?? "Internal stakeholder"}${item.dueDate ? ` · due ${fmtDate(item.dueDate)}` : ""}`,
        href: "/data-requests",
        tone: "amber" as const,
      })),
      ...pendingApprovals.map((item) => ({
        id: item.id,
        kind: "Approval",
        title:
          item.action?.description ??
          item.obligation?.description ??
          item.entity?.legalName ??
          item.gate,
        context: item.gate,
        href: "/approvals",
        tone: "blue" as const,
      })),
      ...reviewItems.map((item) => ({
        id: item.id,
        kind: "Advice review",
        title: item.plainSummary,
        context: `${item.document.filename}${item.isConditional ? " · conditional" : ""}`,
        href: `/documents/${item.documentId}/extraction/${item.extractionRun.id}`,
        tone: "blue" as const,
      })),
    ].slice(0, 7);

    return {
      isGuidedDemo: false,
      organisationName: context.organisation.name,
      reviewCount,
      blockerCount,
      pendingApprovalCount,
      overdueRequestCount,
      attention,
      adviceMatters: recentDocuments.map((document) => ({
        id: document.id,
        title: document.filename,
        documentType: document.documentType,
        entity: document.entity?.legalName ?? "Group / entity to confirm",
        status:
          document.reviewItems.length > 0
            ? "Human review"
            : document.relianceStatus,
        candidateCount: document.reviewItems.length,
        conditionalCount: document.reviewItems.filter(
          (item) => item.isConditional,
        ).length,
        href:
          document.reviewItems.length > 0
            ? "/review"
            : `/documents/${document.id}`,
      })),
      deadlines: upcomingObligations.flatMap((obligation) => {
        const dueDate =
          obligation.internalTargetDate ??
          obligation.filingDeadline ??
          obligation.paymentDeadline;
        if (!dueDate) return [];
        return [
          {
            id: obligation.id,
            title: obligation.description,
            entity: obligation.entity?.legalName ?? "Group",
            dueDate,
            status: obligation.overallWorkflowStatus,
            href: `/obligations/${obligation.id}`,
          },
        ];
      }),
    };
  } catch (error) {
    console.error("Workbench data unavailable; showing guided demo.", error);
    return demoWorkbench();
  }
}

function Metric({
  value,
  label,
  href,
  alert,
}: {
  value: number;
  label: string;
  href: string;
  alert?: boolean;
}) {
  return (
    <Link className={`work-metric${alert ? " work-metric-alert" : ""}`} href={href}>
      <span className="work-metric-value">{value}</span>
      <span className="work-metric-label">{label}</span>
    </Link>
  );
}

export default async function DashboardPage() {
  const data = await loadWorkbench();

  return (
    <div className="workbench">
      {data.isGuidedDemo && (
        <div className="demo-notice">
          <div>
            <strong>Guided demo data is active.</strong>
            <span>
              {" "}
              This workspace has no live work to show, so the page uses a
              complete sample matter without writing to the database.
            </span>
          </div>
          <Link href="/demo/advice" className="btn btn-primary btn-sm">
            Start the advice review
          </Link>
        </div>
      )}

      <header className="workbench-header">
        <div>
          <div className="eyebrow">{data.organisationName}</div>
          <h1>Tax workbench</h1>
          <p>
            Decisions, blockers and evidence that need the tax team’s attention.
          </p>
        </div>
        <div className="workbench-actions">
          <Link href="/demo/advice" className="btn">
            View guided example
          </Link>
          <Link href="/documents/new" className="btn btn-primary">
            Upload advice
          </Link>
        </div>
      </header>

      <section className="work-metrics" aria-label="Current workload">
        <Metric value={data.reviewCount} label="Advice items to review" href="/review" />
        <Metric
          value={data.blockerCount}
          label="Controls blocked"
          href="/exceptions"
          alert={data.blockerCount > 0}
        />
        <Metric
          value={data.overdueRequestCount}
          label="Overdue data requests"
          href="/data-requests"
          alert={data.overdueRequestCount > 0}
        />
        <Metric
          value={data.pendingApprovalCount}
          label="Decisions awaiting approval"
          href="/approvals"
        />
      </section>

      <div className="workbench-grid">
        <div>
          <section className="work-card">
            <div className="work-card-header">
              <div>
                <div className="eyebrow">Daily queue</div>
                <h2>Needs attention</h2>
              </div>
              <span className="text-muted text-sm">
                Ordered by control risk
              </span>
            </div>
            {data.attention.length === 0 ? (
              <div className="work-empty">
                No open blockers, overdue requests, approvals or advice reviews.
              </div>
            ) : (
              <div className="attention-list">
                {data.attention.map((item) => (
                  <Link className="attention-item" href={item.href} key={`${item.kind}-${item.id}`}>
                    <span className={`attention-marker attention-${item.tone}`} />
                    <span className="attention-copy">
                      <span className="attention-kind">{item.kind}</span>
                      <strong>{item.title}</strong>
                      <span>{item.context}</span>
                    </span>
                    <span className="attention-open">Open</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="work-card">
            <div className="work-card-header">
              <div>
                <div className="eyebrow">Advice implementation</div>
                <h2>Recent matters</h2>
              </div>
              <Link href="/documents">All source documents</Link>
            </div>
            {data.adviceMatters.length === 0 ? (
              <div className="work-empty">
                Upload an adviser report to create the first review matter.
              </div>
            ) : (
              <div className="matter-list">
                {data.adviceMatters.map((matter) => (
                  <Link className="matter-item" href={matter.href} key={matter.id}>
                    <span className="matter-main">
                      <strong>{matter.title}</strong>
                      <span>
                        {matter.documentType} · {matter.entity}
                      </span>
                    </span>
                    <span className="matter-counts">
                      <span>{matter.candidateCount} candidates</span>
                      {matter.conditionalCount > 0 && (
                        <span>{matter.conditionalCount} conditional</span>
                      )}
                    </span>
                    <span className="badge badge-blue">{matter.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside>
          <section className="work-card workflow-card">
            <div className="eyebrow">First-session workflow</div>
            <h2>Turn advice into owned work</h2>
            <ol className="workflow-steps">
              <li>
                <span>1</span>
                <div>
                  <strong>Add the source</strong>
                  <p>Upload a memo, report or HMRC letter.</p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Review cited candidates</strong>
                  <p>Keep conditions and source pages attached.</p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>Confirm the decision</strong>
                  <p>Approve the treatment or request missing facts.</p>
                </div>
              </li>
              <li>
                <span>4</span>
                <div>
                  <strong>Track implementation</strong>
                  <p>Assign actions, evidence and future review events.</p>
                </div>
              </li>
            </ol>
            <Link href="/demo/advice" className="btn btn-primary workflow-cta">
              Try the sample matter
            </Link>
            <p className="workflow-boundary">
              AI proposes records. A tax reviewer decides what becomes live.
            </p>
          </section>

          <section className="work-card">
            <div className="work-card-header compact">
              <div>
                <div className="eyebrow">Next 90 days</div>
                <h2>Deadlines</h2>
              </div>
              <Link href="/obligations/calendar">Calendar</Link>
            </div>
            {data.deadlines.length === 0 ? (
              <div className="work-empty small">
                No confirmed deadlines in the next 90 days.
              </div>
            ) : (
              <div className="deadline-list">
                {data.deadlines.map((deadline) => (
                  <Link href={deadline.href} className="deadline-item" key={deadline.id}>
                    <span className="deadline-date">
                      <strong>{deadline.dueDate.getDate()}</strong>
                      <span>
                        {deadline.dueDate.toLocaleDateString("en-GB", {
                          month: "short",
                        })}
                      </span>
                    </span>
                    <span className="deadline-copy">
                      <strong>{deadline.title}</strong>
                      <span>{deadline.entity}</span>
                    </span>
                    <span className="text-sm text-muted">{deadline.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
