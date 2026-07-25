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
    organisationName: "Northstar Group — £430m UK private group",
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
        href: "/demo/matter",
        tone: "blue",
      },
      {
        id: "sample-blocker",
        kind: "Blocker",
        title: "Share consideration has not been reconciled to the valuation",
        context: "Owner: Tax Manager · required before transaction approval",
        href: "/demo/matter",
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
        href: "/demo/matter",
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
        organisationName:
          context.orgId === "demo-org"
            ? "Northstar Group — £430m UK private group"
            : `${context.organisation.name} — guided sample`,
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

export default async function DashboardPage() {
  const data = await loadWorkbench();

  return (
    <div className="hq-home">
      {data.isGuidedDemo && (
        <div className="hq-demo-notice">
          <div>
            <strong>Sample workspace</strong>
            <span>
              A fictional three-person tax team managing adviser reports,
              stakeholder responses, evidence and tax sign-off.
            </span>
          </div>
          <Link href="/demo/matter" className="matter-button matter-button-primary">
            Open complete matter
          </Link>
        </div>
      )}

      <header className="hq-header">
        <div>
          <div className="eyebrow">{data.organisationName}</div>
          <h1>Today</h1>
          <p>
            Work that needs tax judgement, a response or an escalation.
          </p>
        </div>
        <div className="hq-header-actions">
          <Link href="/documents/new" className="matter-button matter-button-secondary">
            Upload adviser advice
          </Link>
          <Link href="/matters/new" className="matter-button matter-button-primary">
            Add tax matter
          </Link>
        </div>
      </header>

      <section className="hq-decision-spotlight">
        <div className="hq-spotlight-main">
          <div className="hq-spotlight-meta">
            <span>Next tax decision</span>
            <span className="matter-status matter-status-blocked">
              Sign-off blocked
            </span>
          </div>
          <h2>Can the EOT share sale proceed to board approval?</h2>
          <p>
            Finance, Legal and the valuation adviser have responded. Their
            evidence needs your acceptance before Tax releases the transaction.
          </p>
          <div className="hq-spotlight-facts">
            <span>
              <strong>3</strong> responses ready
            </span>
            <span>
              <strong>£8.2m</strong> transaction value
            </span>
            <span>
              <strong>29 Jul</strong> tax decision due
            </span>
          </div>
        </div>
        <div className="hq-spotlight-action">
          <span className="hq-progress-label">0 of 3 checks accepted</span>
          <div className="hq-progress-track">
            <span />
          </div>
          <Link href="/demo/matter" className="matter-button matter-button-primary">
            Review the decision
          </Link>
        </div>
      </section>

      <div className="hq-grid">
        <div className="hq-main-column">
          <section className="hq-card">
            <div className="hq-card-heading">
              <div>
                <div className="eyebrow">Priority queue</div>
                <h2>What needs you</h2>
              </div>
              <span>{data.attention.length} open</span>
            </div>
            {data.attention.length === 0 ? (
              <div className="hq-empty">
                No open decisions, exceptions or overdue requests.
              </div>
            ) : (
              <div className="hq-queue">
                {data.attention.map((item) => (
                  <Link className="hq-queue-item" href={item.href} key={`${item.kind}-${item.id}`}>
                    <span className={`hq-queue-marker hq-marker-${item.tone}`} />
                    <span className="hq-queue-copy">
                      <span>{item.kind}</span>
                      <strong>{item.title}</strong>
                      <small>{item.context}</small>
                    </span>
                    <span className="hq-queue-open">Review</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="hq-card">
            <div className="hq-card-heading">
              <div>
                <div className="eyebrow">Active work</div>
                <h2>Matters</h2>
              </div>
              <Link href="/demo/matter">View sample matter</Link>
            </div>
            {data.adviceMatters.length === 0 ? (
              <div className="hq-empty">
                Add an adviser report or business event to create the first matter.
              </div>
            ) : (
              <div className="hq-matter-list">
                {data.adviceMatters.map((matter) => (
                  <Link className="hq-matter-row" href={matter.href} key={matter.id}>
                    <span className="hq-matter-identity">
                      <span className="hq-matter-icon">TR</span>
                      <span>
                        <strong>{matter.title}</strong>
                        <small>
                          {matter.documentType} · {matter.entity}
                        </small>
                      </span>
                    </span>
                    <span className="hq-matter-detail">
                      <small>Next decision</small>
                      <strong>
                        {matter.conditionalCount > 0
                          ? `${matter.conditionalCount} conditions to review`
                          : "Matter brief to review"}
                      </strong>
                    </span>
                    <span className="hq-matter-status">
                      <span className="response-state">{matter.status}</span>
                      <small>{matter.candidateCount} source records</small>
                    </span>
                  </Link>
                ))}
                {data.isGuidedDemo && (
                  <>
                    <Link className="hq-matter-row" href="/demo/incentive-plan">
                      <span className="hq-matter-identity">
                        <span className="hq-matter-icon employment">ET</span>
                        <span>
                          <strong>Management incentive plan</strong>
                          <small>Incentives &amp; reward · Northstar Operations Ltd</small>
                        </span>
                      </span>
                      <span className="hq-matter-detail">
                        <small>Next decision</small>
                        <strong>Close 7 coverage gaps across 4 parties</strong>
                      </span>
                      <span className="hq-matter-status">
                        <span className="response-state">7 events live</span>
                        <small>Next clock 14 days</small>
                      </span>
                    </Link>
                    <Link className="hq-matter-row" href="/demo/positions">
                      <span className="hq-matter-identity">
                        <span className="hq-matter-icon hmrc">TX</span>
                        <span>
                          <strong>Open tax positions</strong>
                          <small>Transactions · shareholder elections and conditions</small>
                        </span>
                      </span>
                      <span className="hq-matter-detail">
                        <small>Next decision</small>
                        <strong>19 shareholders with election windows open</strong>
                      </span>
                      <span className="hq-matter-status">
                        <span className="response-state">Funding short</span>
                        <small>Earliest closes Jan 2027</small>
                      </span>
                    </Link>
                  </>
                )}
              </div>
            )}
          </section>
        </div>

        <aside className="hq-side-column">
          <section className="hq-card hq-capture-card">
            <div className="eyebrow">Start with the work</div>
            <h2>Capture tax work without a setup project</h2>
            <p>
              Begin with one document, email or business event. Link entities
              and registrations once they are known.
            </p>
            <div className="hq-capture-options">
              <Link href="/documents/new">
                <span>↑</span>
                <span>
                  <strong>Upload adviser advice</strong>
                  <small>PDF, Word or email</small>
                </span>
              </Link>
              <Link href="/matters/new">
                <span>↗</span>
                <span>
                  <strong>Report a business change</strong>
                  <small>Transaction, hire or restructuring</small>
                </span>
              </Link>
              <Link href="/obligations/import">
                <span>+</span>
                <span>
                  <strong>Import the tax calendar</strong>
                  <small>Start with an existing CSV</small>
                </span>
              </Link>
            </div>
          </section>

          <section className="hq-card">
            <div className="hq-card-heading compact">
              <div>
                <div className="eyebrow">Next dates</div>
                <h2>Calendar</h2>
              </div>
              <Link href="/obligations/calendar">Open</Link>
            </div>
            <div className="hq-deadlines">
              {data.deadlines.slice(0, 3).map((deadline) => (
                <Link href={deadline.href} key={deadline.id}>
                  <span className="hq-date">
                    <strong>{deadline.dueDate.getDate()}</strong>
                    <small>
                      {deadline.dueDate.toLocaleDateString("en-GB", {
                        month: "short",
                      })}
                    </small>
                  </span>
                  <span>
                    <strong>{deadline.title}</strong>
                    <small>{deadline.entity}</small>
                  </span>
                  <small>{deadline.status}</small>
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
