import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/auth";
import { ITEM_TYPE_LABELS, type ItemType } from "@/lib/extraction-schema";
import { updateReviewStatus } from "@/app/actions/extraction";

const OPEN_REVIEW_STATUSES = ["Needs review", "In review", "Needs adviser input", "Needs source verification"];

function ReviewBadge({ status }: { status: string }) {
  const cls =
    status === "Needs adviser input" || status === "Needs source verification" ? "badge-orange" :
    status === "In review" ? "badge-blue" :
    "badge-yellow";
  return <span className={`badge ${cls}`}>{status}</span>;
}

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const cls = pct >= 75 ? "badge-green" : pct >= 50 ? "badge-yellow" : "badge-red";
  return <span className={`badge ${cls}`}>{pct}%</span>;
}

function ItemTypeTag({ type }: { type: string }) {
  return <span className="badge badge-grey">{ITEM_TYPE_LABELS[type as ItemType] ?? type}</span>;
}

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>;
}) {
  const { organisation: org } = await requireOrg();
  const orgId = org.id;
  const sp = await searchParams;
  const status = sp.status;
  const type = sp.type;

  const where = {
    organisationId: orgId,
    reviewStatus: status ? status : { in: OPEN_REVIEW_STATUSES },
    ...(type ? { itemType: type } : {}),
  };

  const [items, countsByStatus] = await Promise.all([
    prisma.reviewItem.findMany({
      where,
      include: {
        document: { select: { id: true, filename: true, documentType: true } },
        extractionRun: { select: { id: true, status: true, startedAt: true } },
        entity: { select: { id: true, legalName: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { confidenceScore: "asc" }],
      take: 100,
    }),
    prisma.reviewItem.groupBy({
      by: ["reviewStatus"],
      where: { organisationId: orgId, reviewStatus: { in: OPEN_REVIEW_STATUSES } },
      _count: { _all: true },
    }),
  ]);

  const totalOpen = countsByStatus.reduce((sum, row) => sum + row._count._all, 0);

  return (
    <div style={{ padding: "28px 32px" }}>
      <div className="page-header">
        <div>
          <h1>Review queue</h1>
          <p className="text-muted" style={{ margin: "6px 0 0" }}>
            AI-generated draft items awaiting human review across the document vault.
          </p>
        </div>
        <Link href="/documents" className="btn">Document Vault</Link>
      </div>

      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-value">{totalOpen}</div>
          <div className="stat-label">Open review items</div>
        </div>
        {countsByStatus.map((row) => (
          <div className="stat-card" key={row.reviewStatus}>
            <div className="stat-value">{row._count._all}</div>
            <div className="stat-label">{row.reviewStatus}</div>
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/review" className="btn btn-sm">Open items</Link>
          {OPEN_REVIEW_STATUSES.map((s) => (
            <Link key={s} href={`/review?status=${encodeURIComponent(s)}`} className="btn btn-sm btn-secondary">{s}</Link>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>Items</h2>
        {items.length === 0 ? (
          <p className="text-muted">No review items match this queue.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Document</th>
                <th>Status</th>
                <th>Confidence</th>
                <th>Entity</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const markInReview = updateReviewStatus.bind(null, item.id, "In review", undefined, undefined);
                const markDuplicate = updateReviewStatus.bind(null, item.id, "Duplicate", undefined, undefined);
                const markNotApplicable = updateReviewStatus.bind(null, item.id, "Not applicable", undefined, undefined);
                return (
                  <tr key={item.id}>
                    <td>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                        <ItemTypeTag type={item.itemType} />
                        {item.isConditional && <span className="badge badge-orange">Conditional</span>}
                      </div>
                      <div style={{ fontWeight: 600 }}>{item.plainSummary}</div>
                      {item.sourceTextExcerpt && (
                        <div className="text-muted text-sm" style={{ maxWidth: 520, marginTop: 4 }}>
                          {item.sourceTextExcerpt.slice(0, 180)}{item.sourceTextExcerpt.length > 180 ? "…" : ""}
                        </div>
                      )}
                    </td>
                    <td>
                      <Link href={`/documents/${item.document.id}/extraction/${item.extractionRun.id}`}>{item.document.filename}</Link>
                      <div className="text-muted text-sm">{item.document.documentType} · run {item.extractionRun.status}</div>
                    </td>
                    <td><ReviewBadge status={item.reviewStatus} /></td>
                    <td><ConfidenceBadge score={item.confidenceScore} /></td>
                    <td>{item.entity ? <Link href={`/entities/${item.entity.id}`}>{item.entity.legalName}</Link> : "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Link href={`/documents/${item.document.id}/extraction/${item.extractionRun.id}`} className="btn btn-sm">Review</Link>
                        {item.reviewStatus === "Needs review" && (
                          <form action={markInReview}><button className="btn btn-secondary btn-sm" type="submit">In review</button></form>
                        )}
                        <form action={markDuplicate}><button className="btn btn-secondary btn-sm" type="submit">Duplicate</button></form>
                        <form action={markNotApplicable}><button className="btn btn-secondary btn-sm" type="submit">N/A</button></form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
