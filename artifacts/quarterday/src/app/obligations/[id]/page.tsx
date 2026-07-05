import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/obligations";
import {
  archiveManualObligation,
  unarchiveManualObligation,
  deleteManualObligation,
} from "@/app/actions/manualObligations";

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "Complete" || status === "Approved" ? "badge-green" :
    status === "In progress" ? "badge-blue" :
    status === "Blocked" ? "badge-red" :
    status === "Ready for review" ? "badge-yellow" :
    "badge-grey";
  return <span className={`badge ${cls}`}>{status}</span>;
}

function RiskBadge({ risk }: { risk: string | null }) {
  if (!risk) return <span className="text-muted">—</span>;
  const cls =
    risk === "Critical" ? "badge-red" :
    risk === "High" ? "badge-orange" :
    risk === "Medium" ? "badge-yellow" :
    "badge-green";
  return <span className={`badge ${cls}`}>{risk}</span>;
}

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

  const ob = await prisma.manualObligation.findUnique({
    where: { id },
    include: { entity: { select: { id: true, legalName: true } } },
  });

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

      {/* Status overview */}
      <div className="panel">
        <h2>Status</h2>
        <div className="detail-grid cols3">
          <Row label="Overall workflow" value={<StatusBadge status={ob.overallWorkflowStatus} />} />
          <Row label="Data completeness" value={<StatusBadge status={ob.dataCompletenessStatus} />} />
          <Row label="Data validation" value={<StatusBadge status={ob.dataValidationStatus} />} />
          <Row label="Technical review" value={<StatusBadge status={ob.technicalReviewStatus} />} />
          <Row label="Approval" value={<StatusBadge status={ob.approvalStatus} />} />
          <Row label="Evidence" value={<StatusBadge status={ob.evidenceStatus} />} />
          <Row label="Filing / payment" value={<StatusBadge status={ob.filingPaymentStatus} />} />
          <Row label="Risk level" value={<RiskBadge risk={ob.riskLevel} />} />
          <Row label="Exception required" value={ob.exceptionRequired ? "Yes" : "No"} />
        </div>
      </div>

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

      {/* Ownership */}
      <div className="panel">
        <h2>Ownership</h2>
        <div className="detail-grid">
          <Row label="Responsible owner" value={ob.responsibleOwner} />
          <Row label="Accountable owner" value={ob.accountableOwner} />
          <Row label="Consulted party" value={ob.consultedParty} />
          <Row label="Informed party" value={ob.informedParty} />
          <Row label="External adviser" value={ob.externalAdviser} />
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
