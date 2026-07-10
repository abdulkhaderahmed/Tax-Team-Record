import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/obligations";
import { rejectDraft } from "@/app/actions/draftObligations";

export default async function RejectDraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ob = await prisma.manualObligation.findUnique({
    where: { id },
    include: { entity: { select: { id: true, legalName: true } } },
  });

  if (!ob || ob.draftReviewStatus !== "pending") notFound();

  const action = rejectDraft.bind(null, id);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/">Dashboard</Link> /{" "}
            <Link href="/obligations/drafts">Draft Generated Obligations</Link> / Reject
          </div>
          <h1>Reject draft obligation</h1>
        </div>
      </div>

      <div className="panel form-page">
        <div className="detail-grid" style={{ marginBottom: 20 }}>
          <div className="detail-item">
            <div className="detail-label">Entity</div>
            <div className="detail-value">{ob.entity?.legalName ?? "—"}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Regime</div>
            <div className="detail-value">{ob.regime}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Description</div>
            <div className="detail-value">{ob.description}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Filing deadline</div>
            <div className="detail-value">{ob.filingDeadline ? fmtDate(ob.filingDeadline) : "—"}</div>
          </div>
          <div className="detail-item" style={{ gridColumn: "1 / -1" }}>
            <div className="detail-label">Why generated</div>
            <div className="detail-value text-sm" style={{ color: "var(--ink-secondary)" }}>{ob.humanExplanation ?? "—"}</div>
          </div>
          <div className="detail-item" style={{ gridColumn: "1 / -1" }}>
            <div className="detail-label">Calculation basis</div>
            <div className="detail-value text-sm" style={{ color: "var(--ink-secondary)" }}>{ob.calculationBasis ?? "—"}</div>
          </div>
        </div>

        <form action={action}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">
              Rejection note <span className="text-muted text-sm">(optional — explain why this obligation does not apply)</span>
            </label>
            <textarea name="note" rows={3} placeholder="e.g. This entity exited the large company regime; QIPs no longer apply." />
          </div>

          <div className="flex gap8">
            <button type="submit" className="btn btn-danger">Confirm rejection</button>
            <Link href="/obligations/drafts" className="btn btn-secondary">Cancel</Link>
          </div>
        </form>
      </div>
    </>
  );
}
