import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/obligations";
import { markDraftNotApplicable } from "@/app/actions/draftObligations";

export default async function NotApplicableDraftPage({
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

  const action = markDraftNotApplicable.bind(null, id);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/">Dashboard</Link> /{" "}
            <Link href="/obligations/drafts">Draft Generated Obligations</Link> / Not applicable
          </div>
          <h1>Mark as not applicable</h1>
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
            <div className="detail-value text-sm" style={{ color: "#6b7280" }}>{ob.humanExplanation ?? "—"}</div>
          </div>
          <div className="detail-item" style={{ gridColumn: "1 / -1" }}>
            <div className="detail-label">Calculation basis</div>
            <div className="detail-value text-sm" style={{ color: "#6b7280" }}>{ob.calculationBasis ?? "—"}</div>
          </div>
        </div>

        <form action={action}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">
              Note <span className="text-muted text-sm">(optional — explain why this obligation is not applicable)</span>
            </label>
            <textarea name="note" rows={3} placeholder="e.g. Entity has no employees so P11D is not required despite the flag being set." />
          </div>

          <div className="flex gap8">
            <button type="submit" className="btn btn-secondary">Confirm — not applicable</button>
            <Link href="/obligations/drafts" className="btn btn-secondary">Cancel</Link>
          </div>
        </form>
      </div>
    </>
  );
}
