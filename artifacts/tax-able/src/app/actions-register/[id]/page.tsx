import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/obligations";
import {
  archiveAction,
  unarchiveAction,
  deleteAction,
} from "@/app/actions/actionsRegister";
import { OwnershipAndControls } from "@/components/ownership-controls";
import { requireOrg } from "@/lib/auth";
import { canUseDocumentPermission } from "@/lib/authz-policy";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="detail-item">
      <div className="detail-label">{label}</div>
      <div className="detail-value">{value ?? <span className="text-muted">—</span>}</div>
    </div>
  );
}

export default async function ActionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await requireOrg();
  const orgId = context.orgId;
  const now = new Date();

  const [a, raciAssignments, statusHistory] = await Promise.all([
    prisma.action.findFirst({
      where: { id, organisationId: orgId, deletedAt: null },
      include: {
        entity: { select: { id: true, legalName: true } },
        createdBy: { select: { id: true, name: true } },
        lastUpdatedBy: { select: { id: true, name: true } },
        sourceDocument: {
          select: {
            id: true,
            organisationId: true,
            filename: true,
            versionNumber: true,
            restrictedAccess: true,
            deletedAt: true,
            accessGrants: { where: { organisationId: context.orgId, userId: context.userId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, select: { permission: true }, take: 1 },
          },
        },
        documentLinks: {
          include: {
            document: {
              select: {
                id: true,
                organisationId: true,
                filename: true,
                versionNumber: true,
                restrictedAccess: true,
                deletedAt: true,
                accessGrants: { where: { organisationId: context.orgId, userId: context.userId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, select: { permission: true }, take: 1 },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        exceptions: { where: { status: { in: ["Open", "In progress"] } }, orderBy: { createdAt: "desc" } },
        evidenceItems: { orderBy: { createdAt: "desc" } },
        approvals: { orderBy: { requestedAt: "desc" } },
      },
    }),
    prisma.raciAssignment.findMany({ where: { actionId: id }, include: { party: true } }),
    prisma.statusHistory.findMany({ where: { objectType: "Action", objectId: id }, include: { changedBy: { select: { id: true, name: true } } }, orderBy: { changedAt: "desc" }, take: 50 }),
  ]);

  if (!a) notFound();

  const canViewDocument = (document: {
    organisationId: string;
    restrictedAccess: boolean;
    deletedAt: Date | null;
    accessGrants: { permission: string }[];
  }) =>
    document.organisationId === context.orgId &&
    document.deletedAt == null &&
    canUseDocumentPermission(
      context.user.role,
      document.restrictedAccess,
      document.accessGrants[0]?.permission,
      "view",
    );
  const primarySourceVisible = a.sourceDocument
    ? canViewDocument(a.sourceDocument)
    : false;
  const visibleDocumentLinks = a.documentLinks.filter((link) =>
    canViewDocument(link.document),
  );

  const archiveActionBound = archiveAction.bind(null, id);
  const unarchiveActionBound = unarchiveAction.bind(null, id);
  const deleteActionBound = deleteAction.bind(null, id);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/">Dashboard</Link> /{" "}
            <Link href="/actions-register">Actions Register</Link> /{" "}
            {a.entity?.legalName ?? "Action"}
          </div>
          <h1 style={{ marginBottom: 4 }}>
            {a.description.length > 100 ? a.description.slice(0, 100) + "…" : a.description}
          </h1>
          <p className="text-sm text-muted" style={{ margin: 0 }}>
            {a.entity?.legalName ?? "No entity"} · {a.deadline ? fmtDate(a.deadline) : "No deadline"}
          </p>
        </div>
        <div className="flex gap8">
          <Link href={`/actions-register/${id}/edit`} className="btn btn-secondary">Edit</Link>
          {a.archivedAt ? (
            <form action={unarchiveActionBound} style={{ display: "inline" }}>
              <button type="submit" className="btn btn-secondary">Unarchive</button>
            </form>
          ) : (
            <form action={archiveActionBound} style={{ display: "inline" }}>
              <button type="submit" className="btn btn-secondary">Archive</button>
            </form>
          )}
        </div>
      </div>

      {a.archivedAt && (
        <div className="alert alert-warning" style={{ marginBottom: 20 }}>
          This action was archived on {fmtDate(a.archivedAt)}.
        </div>
      )}

      <OwnershipAndControls
        objectType="Action"
        objectId={a.id}
        returnPath={`/actions-register/${a.id}`}
        responsibleOwner={a.responsibleParty}
        accountableOwner={a.accountableParty}
        consultedParty={a.consultedParty}
        informedParty={a.informedParty}
        externalAdviser={a.externalAdviser}
        externalOperationalOwner={a.externalOperationalOwner}
        dataCollectionRequired={a.dataCollectionRequired}
        dataValidationRequired={a.dataValidationRequired}
        technicalReviewRequired={a.technicalReviewRequired}
        accountableApprovalRequired={a.accountableApprovalRequired}
        evidenceRequired={a.evidenceRequired}
        filingSubmissionRequired={a.filingSubmissionRequired}
        paymentRequired={a.paymentRequired}
        dataCompletenessStatus={a.dataCompletenessStatus}
        dataValidationStatus={a.dataValidationStatus}
        technicalReviewStatus={a.technicalReviewStatus}
        approvalStatus={a.approvalStatus}
        workflowProgressStatus={a.workflowProgressStatus}
        evidenceStatus={a.evidenceStatus}
        filingSubmissionStatus={a.filingSubmissionStatus}
        paymentStatus={a.paymentStatus}
        overallStatus={a.overallStatus}
        overallStatusIsOverride={a.overallStatusIsOverride}
        riskLevel={a.riskLevel}
        exceptionRequired={a.exceptionRequired}
        openIssueBlocker={a.openIssueBlocker}
        notes={a.notes}
        raciAssignments={raciAssignments}
        statusHistory={statusHistory}
      />

      {(a.exceptions.length > 0 || a.evidenceItems.length > 0 || a.approvals.length > 0) && (
        <div className="panel">
          <h2>Readiness controls</h2>
          {a.exceptions.map((exception) => (
            <div key={exception.id} className="alert alert-warning" style={{ marginBottom: 8 }}>
              <strong>{exception.title}</strong> · {exception.status}{exception.blocksFiling ? " · Blocks readiness" : ""}
            </div>
          ))}
          <div className="detail-grid">
            <Row label="Evidence items" value={`${a.evidenceItems.filter((item) => item.status === "Verified").length}/${a.evidenceItems.length} verified`} />
            <Row label="Approval gates" value={`${a.approvals.filter((item) => item.status === "Approved").length}/${a.approvals.length} approved`} />
          </div>
        </div>
      )}

      {/* Core details */}
      <div className="panel">
        <h2>Core details</h2>
        <div className="detail-grid">
          <Row label="Entity" value={a.entity ? <Link href={`/entities/${a.entity.id}`}>{a.entity.legalName}</Link> : null} />
          <Row label="Deadline" value={a.deadline ? fmtDate(a.deadline) : null} />
          <Row label="Relative deadline trigger" value={a.relativeDeadlineTrigger} />
          <Row label="Relative deadline offset" value={a.relativeDeadlineOffset} />
        </div>
        {a.description && (
          <div style={{ marginTop: 16 }}>
            <div className="detail-label">Description</div>
            <div className="detail-value" style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{a.description}</div>
          </div>
        )}
        {a.conditionText && (
          <div style={{ marginTop: 16 }}>
            <div className="detail-label">Condition</div>
            <div className="detail-value" style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{a.conditionText}</div>
          </div>
        )}
      </div>

      {/* Evidence */}
      {a.evidenceDescription && (
        <div className="panel">
          <h2>Evidence</h2>
          <div className="detail-label">Evidence description</div>
          <div className="detail-value" style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{a.evidenceDescription}</div>
        </div>
      )}

      {/* Source & Audit */}
      <div className="panel">
        <h2>Source &amp; Audit</h2>
        <div className="detail-grid">
          <Row label="Source type" value={a.sourceType} />
          <Row label="Primary source document" value={a.sourceDocument ? (primarySourceVisible ? <Link href={`/documents/${a.sourceDocument.id}`}>{a.sourceDocument.filename} · v{a.sourceDocument.versionNumber}</Link> : "Restricted document") : a.sourceDocumentReference ? "Legacy source reference withheld until linked and access-checked" : null} />
          <Row label="Source page / paragraph" value={primarySourceVisible ? a.sourcePageParagraph : a.sourceDocumentId ? "Restricted" : null} />
          <Row label="Created by" value={a.createdBy ? `${a.createdBy.name} (${a.createdBy.id})` : null} />
          <Row label="Last updated by" value={a.lastUpdatedBy ? `${a.lastUpdatedBy.name} (${a.lastUpdatedBy.id})` : null} />
          <Row label="Created" value={fmtDate(a.createdAt)} />
          <Row label="Last updated" value={fmtDate(a.updatedAt)} />
        </div>
        {visibleDocumentLinks.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="detail-label">All document links</div>
            {visibleDocumentLinks.map((link) => (
              <div key={link.id} className="text-sm" style={{ marginTop: 5 }}>
                <Link href={`/documents/${link.document.id}`}>{link.document.filename} · v{link.document.versionNumber}</Link>
                {` · ${link.linkType}${link.pageReference ? ` · ${link.pageReference}` : ""}`}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="panel" style={{ borderColor: "var(--overdue)" }}>
        <h2>Danger zone</h2>
        <p className="text-sm text-muted">
          Tombstone this action while retaining its audit history. A reason is required.
        </p>
        <form action={deleteActionBound}>
          <input name="reason" className="form-input" required placeholder="Deletion reason" style={{ marginBottom: 8 }} />
          <button type="submit" className="btn btn-danger btn-sm">Tombstone action</button>
        </form>
      </div>
    </>
  );
}
