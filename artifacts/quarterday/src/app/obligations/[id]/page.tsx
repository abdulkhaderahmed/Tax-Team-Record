import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/obligations";
import {
  archiveManualObligation,
  unarchiveManualObligation,
  deleteManualObligation,
} from "@/app/actions/manualObligations";
import { OwnershipAndControls } from "@/components/ownership-controls";

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

  const [ob, raciAssignments, statusHistory] = await Promise.all([
    prisma.manualObligation.findUnique({
      where: { id },
      include: { entity: { select: { id: true, legalName: true } } },
    }),
    prisma.raciAssignment.findMany({ where: { manualObligationId: id }, include: { party: true } }),
    prisma.statusHistory.findMany({ where: { objectType: "ManualObligation", objectId: id }, orderBy: { changedAt: "desc" }, take: 50 }),
  ]);

  if (!ob) notFound();

  const archiveAction = archiveManualObligation.bind(null, id);
  const unarchiveAction = unarchiveManualObligation.bind(null, id);
  const deleteAction = deleteManualObligation.bind(null, id);

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
        objectType="ManualObligation"
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
          <Row label="Source document" value={ob.sourceDocumentReference} />
          <Row label="Source page / paragraph" value={ob.sourcePageParagraph} />
          <Row label="Created by" value={ob.createdBy} />
          <Row label="Last updated by" value={ob.lastUpdatedBy} />
          <Row label="Created" value={fmtDate(ob.createdAt)} />
          <Row label="Last updated" value={fmtDate(ob.updatedAt)} />
        </div>
      </div>

      {/* Danger zone */}
      <div className="panel" style={{ borderColor: "#fecaca" }}>
        <h2>Danger zone</h2>
        <p className="text-sm text-muted">
          Permanently deletes this obligation and all its data. This cannot be undone.
          {!ob.archivedAt && " Consider archiving instead."}
        </p>
        <form action={deleteAction}>
          <button type="submit" className="btn btn-danger btn-sm">Delete obligation</button>
        </form>
      </div>
    </>
  );
}
