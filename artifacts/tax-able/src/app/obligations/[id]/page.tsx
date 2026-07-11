import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/obligations";
import {
  archiveObligation,
  unarchiveObligation,
  deleteObligation,
} from "@/app/actions/obligations";
import { OwnershipAndControls } from "@/components/ownership-controls";
import { requireOrg } from "@/lib/auth";
import { canUseDocumentPermission } from "@/lib/authz-policy";
import { redactAuditEventForRestrictedDocuments } from "@/lib/audit";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="detail-item">
      <div className="detail-label">{label}</div>
      <div className="detail-value">{value ?? <span className="text-muted">—</span>}</div>
    </div>
  );
}

export default async function ObligationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await requireOrg();
  const orgId = context.orgId;
  const now = new Date();

  const [ob, raciAssignments, statusHistory, auditEvents] = await Promise.all([
    prisma.obligation.findFirst({
      where: { id, organisationId: orgId, deletedAt: null },
      include: {
        entity: { select: { id: true, legalName: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        lastUpdatedBy: { select: { id: true, name: true, email: true } },
        ruleVersion: { include: { rule: true, citations: true } },
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
            createdBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        exceptions: { where: { status: { in: ["Open", "In progress"] } }, orderBy: { createdAt: "desc" } },
        evidenceItems: { orderBy: { createdAt: "desc" } },
        approvals: { orderBy: { requestedAt: "desc" }, include: { approver: { select: { name: true } } } },
      },
    }),
    prisma.raciAssignment.findMany({ where: { obligationId: id }, include: { party: true } }),
    prisma.statusHistory.findMany({ where: { objectType: "Obligation", objectId: id }, include: { changedBy: { select: { id: true, name: true } } }, orderBy: { changedAt: "desc" }, take: 50 }),
    prisma.auditEvent.findMany({
      where: { organisationId: orgId, objectType: "Obligation", objectId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  if (!ob) notFound();

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
  const primarySourceVisible = ob.sourceDocument
    ? canViewDocument(ob.sourceDocument)
    : false;
  const visibleDocumentLinks = ob.documentLinks.filter((link) =>
    canViewDocument(link.document),
  );
  const inaccessibleDocuments = [
    ...(ob.sourceDocument && !primarySourceVisible ? [ob.sourceDocument] : []),
    ...ob.documentLinks
      .filter((link) => !canViewDocument(link.document))
      .map((link) => link.document),
  ].map(({ id: documentId, filename }) => ({ id: documentId, filename }));
  const visibleAuditEvents = auditEvents.map((event) =>
    redactAuditEventForRestrictedDocuments(event, inaccessibleDocuments),
  );

  const archiveAction = archiveObligation.bind(null, id);
  const unarchiveAction = unarchiveObligation.bind(null, id);
  const deleteAction = deleteObligation.bind(null, id);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/">Dashboard</Link> /{" "}
            <Link href="/obligations">Obligation Register</Link> /{" "}
            {ob.obligationType}
          </div>
          <h1 style={{ marginBottom: 4 }}>
            {ob.description.length > 100 ? ob.description.slice(0, 100) + "…" : ob.description}
          </h1>
          <p className="text-sm text-muted" style={{ margin: 0 }}>
            {ob.entity?.legalName ?? "No entity"} · {ob.regime} · {ob.obligationType}
          </p>
        </div>
        <div className="flex gap8">
          <Link href={`/obligations/${id}/edit`} className="btn btn-secondary">Edit</Link>
          {ob.archivedAt ? (
            <form action={unarchiveAction} style={{ display: "inline" }}>
              <button type="submit" className="btn btn-secondary">Unarchive</button>
            </form>
          ) : (
            <form action={archiveAction} style={{ display: "inline" }}>
              <button type="submit" className="btn btn-secondary">Archive</button>
            </form>
          )}
        </div>
      </div>

      {ob.archivedAt && (
        <div className="alert alert-warning" style={{ marginBottom: 20 }}>
          This obligation was archived on {fmtDate(ob.archivedAt)}.
        </div>
      )}

      <OwnershipAndControls
        objectType="Obligation"
        objectId={ob.id}
        returnPath={`/obligations/${ob.id}`}
        responsibleOwner={ob.responsibleOwner}
        accountableOwner={ob.accountableOwner}
        consultedParty={ob.consultedParty}
        informedParty={ob.informedParty}
        externalAdviser={ob.externalAdviser}
        externalOperationalOwner={ob.externalOperationalOwner}
        dataCollectionRequired={ob.dataCollectionRequired}
        dataValidationRequired={ob.dataValidationRequired}
        technicalReviewRequired={ob.technicalReviewRequired}
        accountableApprovalRequired={ob.accountableApprovalRequired}
        evidenceRequired={ob.evidenceRequired}
        filingSubmissionRequired={ob.filingSubmissionRequired}
        paymentRequired={ob.paymentRequired}
        dataCompletenessStatus={ob.dataCompletenessStatus}
        dataValidationStatus={ob.dataValidationStatus}
        technicalReviewStatus={ob.technicalReviewStatus}
        approvalStatus={ob.approvalStatus}
        workflowProgressStatus={ob.workflowProgressStatus}
        evidenceStatus={ob.evidenceStatus}
        filingSubmissionStatus={ob.filingSubmissionStatus}
        paymentStatus={ob.paymentStatus}
        overallStatus={ob.overallWorkflowStatus}
        overallStatusIsOverride={ob.overallStatusIsOverride}
        riskLevel={ob.riskLevel}
        exceptionRequired={ob.exceptionRequired}
        openIssueBlocker={ob.openIssueBlocker}
        notes={ob.notes}
        raciAssignments={raciAssignments}
        statusHistory={statusHistory}
      />

      {ob.ruleVersion && (
        <div className="panel">
          <h2>Why this applies</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{ob.whyApplies ?? ob.humanExplanation ?? "No evaluation trace was stored."}</p>
          <div className="detail-grid">
            <Row label="Controlled rule" value={`${ob.ruleVersion.rule.ruleKey} · version ${ob.ruleVersion.version}`} />
            <Row label="Rule status" value={ob.ruleVersion.status} />
            <Row label="Effective from" value={fmtDate(ob.ruleVersion.effectiveFrom)} />
            <Row label="Legal status" value={ob.ruleVersion.legalStatus} />
            <Row label="Authority" value={ob.ruleVersion.authorityLevel} />
            <Row
              label="Primary authority"
              value={<a href={ob.ruleVersion.statutoryUrl} target="_blank" rel="noreferrer">{ob.ruleVersion.statutoryBasis}</a>}
            />
          </div>
          {ob.ruleVersion.citations.length > 0 && (
            <ul>
              {ob.ruleVersion.citations.map((citation) => (
                <li key={citation.id}>
                  <a href={citation.url} target="_blank" rel="noreferrer">{citation.title}</a>
                  {citation.locator ? ` · ${citation.locator}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(ob.exceptions.length > 0 || ob.evidenceItems.length > 0 || ob.approvals.length > 0) && (
        <div className="panel">
          <h2>Readiness controls</h2>
          {ob.exceptions.map((exception) => (
            <div key={exception.id} className="alert alert-warning" style={{ marginBottom: 8 }}>
              <strong>{exception.title}</strong> · {exception.status}
              {exception.blocksFiling && " · Blocks filing readiness"}
            </div>
          ))}
          <div className="detail-grid">
            <Row label="Evidence items" value={`${ob.evidenceItems.filter((item) => item.status === "Verified").length}/${ob.evidenceItems.length} verified`} />
            <Row label="Approval gates" value={`${ob.approvals.filter((item) => item.status === "Approved").length}/${ob.approvals.length} approved`} />
          </div>
        </div>
      )}

      {/* Core details */}
      <div className="panel">
        <h2>Core details</h2>
        <div className="detail-grid">
          <Row label="Entity" value={ob.entity ? <Link href={`/entities/${ob.entity.id}`}>{ob.entity.legalName}</Link> : null} />
          <Row label="Regime" value={ob.regime} />
          <Row label="Obligation type" value={ob.obligationType} />
          <Row label="Statutory basis" value={ob.statutoryBasis} />
          <Row label="Recurrence" value={ob.recurrence} />
          <Row label="Source" value={ob.source} />
        </div>
        {ob.description && (
          <div style={{ marginTop: 16 }}>
            <div className="detail-label">Description</div>
            <div className="detail-value" style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{ob.description}</div>
          </div>
        )}
      </div>

      {/* Dates */}
      <div className="panel">
        <h2>Dates</h2>
        <div className="detail-grid">
          <Row label="Filing deadline" value={ob.filingDeadline ? fmtDate(ob.filingDeadline) : null} />
          <Row label="Payment deadline" value={ob.paymentDeadline ? fmtDate(ob.paymentDeadline) : null} />
          <Row label="Internal target date" value={ob.internalTargetDate ? fmtDate(ob.internalTargetDate) : null} />
          <Row label="Period start" value={ob.periodStart ? fmtDate(ob.periodStart) : null} />
          <Row label="Period end" value={ob.periodEnd ? fmtDate(ob.periodEnd) : null} />
        </div>
      </div>

      {/* Evidence */}
      <div className="panel">
        <h2>Evidence</h2>
        <div className="detail-grid">
          <Row label="Evidence required" value={ob.evidenceRequired ? "Yes" : "No"} />
          <Row label="Evidence owner" value={ob.evidenceOwner} />
          <Row label="Evidence file / reference" value={ob.evidenceFileLink} />
        </div>
        {ob.evidenceDescription && (
          <div style={{ marginTop: 12 }}>
            <div className="detail-label">Evidence description</div>
            <div className="detail-value" style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{ob.evidenceDescription}</div>
          </div>
        )}
      </div>

      {/* Risk & Control */}
      {(ob.consequenceOfMissingDeadline || ob.openIssueBlocker || ob.notes) && (
        <div className="panel">
          <h2>Risk &amp; Control</h2>
          {ob.consequenceOfMissingDeadline && (
            <div style={{ marginBottom: 12 }}>
              <div className="detail-label">Consequence of missing deadline</div>
              <div className="detail-value" style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{ob.consequenceOfMissingDeadline}</div>
            </div>
          )}
          {ob.openIssueBlocker && (
            <div style={{ marginBottom: 12 }}>
              <div className="detail-label">Open issue / blocker</div>
              <div className="detail-value" style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{ob.openIssueBlocker}</div>
            </div>
          )}
          {ob.notes && (
            <div>
              <div className="detail-label">Notes</div>
              <div className="detail-value" style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{ob.notes}</div>
            </div>
          )}
        </div>
      )}

      {/* Source & Audit */}
      <div className="panel">
        <h2>Source &amp; Audit</h2>
        <div className="detail-grid">
          <Row label="Source type" value={ob.sourceType} />
          <Row label="Primary source document" value={ob.sourceDocument ? (primarySourceVisible ? <Link href={`/documents/${ob.sourceDocument.id}`}>{ob.sourceDocument.filename} · v{ob.sourceDocument.versionNumber}</Link> : "Restricted document") : ob.sourceDocumentReference ? "Legacy source reference withheld until linked and access-checked" : null} />
          <Row label="Source page / paragraph" value={primarySourceVisible ? ob.sourcePageParagraph : ob.sourceDocumentId ? "Restricted" : null} />
          <Row label="Created by" value={ob.createdBy ? `${ob.createdBy.name} (${ob.createdBy.id})` : null} />
          <Row label="Last updated by" value={ob.lastUpdatedBy ? `${ob.lastUpdatedBy.name} (${ob.lastUpdatedBy.id})` : null} />
          <Row label="Created" value={fmtDate(ob.createdAt)} />
          <Row label="Last updated" value={fmtDate(ob.updatedAt)} />
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

      <div className="panel">
        <h2>Testable audit history</h2>
        {visibleAuditEvents.length === 0 ? (
          <p className="text-muted">No structured audit events recorded.</p>
        ) : (
          <table className="data-table">
            <thead><tr><th>When</th><th>Event</th><th>Actor</th><th>Reason</th></tr></thead>
            <tbody>
              {visibleAuditEvents.map((event) => (
                <tr key={event.id}>
                  <td>{fmtDate(event.createdAt)}</td>
                  <td>{event.action}</td>
                  <td>{event.user ? `${event.user.name} (${event.userId})` : "System"}</td>
                  <td>{event.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Danger zone */}
      <div className="panel" style={{ borderColor: "var(--overdue)" }}>
        <h2>Danger zone</h2>
        <p className="text-sm text-muted">
          Tombstone this obligation while retaining the immutable audit record. This requires a reason.
        </p>
        <form action={deleteAction}>
          <input name="reason" className="form-input" required placeholder="Deletion reason" style={{ marginBottom: 8 }} />
          <button type="submit" className="btn btn-danger btn-sm">Tombstone obligation</button>
        </form>
      </div>
    </>
  );
}
