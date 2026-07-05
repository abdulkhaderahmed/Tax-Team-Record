import { AppShell } from "@/components/nav";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ITEM_TYPE_LABELS, REVIEW_STATUSES, type ItemType } from "@/lib/extraction-schema";
import { updateReviewStatus, confirmItemAsObligation } from "@/app/actions/extraction";

const ORG_ID = "demo-org";

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "Completed" ? "badge-green" :
    status === "Failed" || status === "Partially failed" ? "badge-red" :
    status === "Running" ? "badge-blue" :
    "badge-grey";
  return <span className={`badge ${cls}`}>{status}</span>;
}

function ReviewBadge({ status }: { status: string }) {
  const cls =
    status === "Confirmed" || status === "Edited and confirmed" ? "badge-green" :
    status === "Rejected" || status === "Duplicate" || status === "Not applicable" ? "badge-grey" :
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
  const cls =
    type === "obligation" ? "badge-blue" :
    type === "action" ? "badge-purple" :
    type === "assumption" ? "badge-yellow" :
    type === "caveat" ? "badge-orange" :
    type === "tripwire" ? "badge-red" :
    type === "rd" || type === "capital_allowances" ? "badge-green" :
    "badge-grey";
  return <span className={`badge ${cls}`}>{ITEM_TYPE_LABELS[type as ItemType] ?? type}</span>;
}

function StructuredFields({ json }: { json: unknown }) {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;
  const skip = new Set(["sourceText","sourceChunkPage","confidenceScore","isConditional","conditionText","isDraft","requiresHumanTaxReview","requiresSourceVerification"]);
  const entries = Object.entries(obj).filter(([k, v]) => !skip.has(k) && v !== null && v !== undefined && v !== "" && v !== false);
  if (entries.length === 0) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", marginTop: 8 }}>
      {entries.map(([key, val]) => (
        <div key={key}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}
          </span>
          <div style={{ fontSize: 13, color: "#111827" }}>
            {Array.isArray(val) ? val.join(", ") : typeof val === "boolean" ? (val ? "Yes" : "No") : String(val)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function ExtractionRunPage({
  params,
}: {
  params: Promise<{ id: string; runId: string }>;
}) {
  const { id: documentId, runId } = await params;

  const [doc, run, entities] = await Promise.all([
    prisma.document.findUnique({ where: { id: documentId }, select: { id: true, filename: true, organisationId: true, documentType: true } }),
    prisma.extractionRun.findUnique({
      where: { id: runId },
      include: {
        items: { orderBy: [{ itemType: "asc" }, { confidenceScore: "desc" }] },
      },
    }),
    prisma.entity.findMany({ where: { organisationId: ORG_ID }, orderBy: { legalName: "asc" } }),
  ]);

  if (!doc || doc.organisationId !== ORG_ID || !run) notFound();

  const items = run.items;
  const needsReview = items.filter(i => i.reviewStatus === "Needs review" || i.reviewStatus === "In review").length;
  const confirmed = items.filter(i => i.reviewStatus === "Confirmed" || i.reviewStatus === "Edited and confirmed").length;
  const rejected = items.filter(i => ["Rejected","Duplicate","Not applicable"].includes(i.reviewStatus)).length;

  // Group by item type
  const byType: Record<string, typeof items> = {};
  for (const item of items) {
    if (!byType[item.itemType]) byType[item.itemType] = [];
    byType[item.itemType].push(item);
  }

  return (
    <AppShell>
      <div style={{ padding: "28px 32px" }}>
        {/* Breadcrumb */}
        <div style={{ marginBottom: 16, fontSize: 13, color: "#6b7280" }}>
          <Link href="/documents" style={{ color: "#6b7280" }}>Document Vault</Link>
          {" / "}
          <Link href={`/documents/${documentId}`} style={{ color: "#6b7280" }}>{doc.filename}</Link>
          {" / "}
          AI Extraction
        </div>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: "0 0 6px" }}>AI Extraction Review</h1>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <StatusBadge status={run.status} />
              <span style={{ color: "#6b7280", fontSize: 12 }}>
                {run.modelProvider} / {run.modelName} · prompt v{run.promptVersion} · schema v{run.extractionSchemaVersion}
              </span>
              <span style={{ color: "#6b7280", fontSize: 12 }}>
                {run.completedAt ? `Completed ${run.completedAt.toLocaleString("en-GB")}` : `Started ${run.startedAt.toLocaleString("en-GB")}`}
              </span>
            </div>
          </div>
          <Link href={`/documents/${documentId}`} className="btn">← Back to document</Link>
        </div>

        {/* Important disclaimer */}
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          ⚠ All items below are <strong>AI-generated drafts</strong>. They have not been reviewed by a tax professional and must not be relied upon. Humans must confirm, edit or reject every item before it is used.
        </div>

        {/* Error */}
        {run.status === "Failed" && run.errorMessage && (
          <div className="alert" style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#b91c1c", marginBottom: 16 }}>
            <strong>Extraction failed:</strong> {run.errorMessage}
          </div>
        )}

        {/* Stats */}
        {items.length > 0 && (
          <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
            <div className="panel" style={{ flex: 1, minWidth: 120, textAlign: "center", padding: "14px 20px" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#111827" }}>{items.length}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Items extracted</div>
            </div>
            <div className="panel" style={{ flex: 1, minWidth: 120, textAlign: "center", padding: "14px 20px" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#854d0e" }}>{needsReview}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Needs review</div>
            </div>
            <div className="panel" style={{ flex: 1, minWidth: 120, textAlign: "center", padding: "14px 20px" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#15803d" }}>{confirmed}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Confirmed</div>
            </div>
            <div className="panel" style={{ flex: 1, minWidth: 120, textAlign: "center", padding: "14px 20px" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#6b7280" }}>{rejected}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Rejected / N/A</div>
            </div>
          </div>
        )}

        {items.length === 0 && run.status === "Completed" && (
          <div className="panel" style={{ textAlign: "center", padding: 48, color: "#6b7280" }}>
            No items were extracted from this document. This may mean the document does not contain structured tax obligations, or the text was too short.
          </div>
        )}

        {/* Items grouped by type */}
        {Object.entries(byType).map(([type, typeItems]) => (
          <div key={type} style={{ marginBottom: 32 }}>
            <h2 style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <ItemTypeTag type={type} />
              <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 400 }}>
                {typeItems.length} item{typeItems.length !== 1 ? "s" : ""}
              </span>
            </h2>

            {typeItems.map((item) => {
              const isActionable = !["Confirmed","Edited and confirmed","Rejected","Duplicate","Not applicable"].includes(item.reviewStatus);
              const data = item.structuredJson as Record<string, unknown>;

              return (
                <div key={item.id} className="panel" style={{
                  marginBottom: 14,
                  borderLeft: `4px solid ${item.confidenceScore >= 0.75 ? "#16a34a" : item.confidenceScore >= 0.5 ? "#d97706" : "#dc2626"}`,
                  opacity: ["Rejected","Duplicate","Not applicable"].includes(item.reviewStatus) ? 0.6 : 1,
                }}>
                  {/* Item header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "#111827", marginBottom: 4 }}>
                        {item.plainSummary}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <ReviewBadge status={item.reviewStatus} />
                        <ConfidenceBadge score={item.confidenceScore} />
                        {item.isConditional && <span className="badge badge-orange">Conditional</span>}
                        {item.isDraft && <span className="badge badge-yellow">Draft document</span>}
                        {item.requiresHumanTaxReview && <span className="badge badge-red">Human tax review required</span>}
                        {item.requiresSourceVerification && <span className="badge badge-orange">Source verification required</span>}
                        {item.confidenceScore < 0.5 && (
                          <span className="badge badge-red">Low confidence — treat with caution</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Condition warning */}
                  {item.isConditional && item.conditionText && (
                    <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 5, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: "#92400e" }}>
                      <strong>Condition:</strong> {item.conditionText}
                    </div>
                  )}

                  {/* Source excerpt */}
                  {item.sourceTextExcerpt && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", marginBottom: 4 }}>
                        Source text {item.sourcePageSection ? `· ${item.sourcePageSection}` : ""}
                      </div>
                      <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 5, padding: "8px 12px", fontFamily: "monospace", fontSize: 12, color: "#374151", maxHeight: 120, overflowY: "auto" }}>
                        {item.sourceTextExcerpt}
                      </div>
                    </div>
                  )}

                  {/* Structured fields */}
                  <StructuredFields json={item.structuredJson} />

                  {/* Reviewer notes */}
                  {item.reviewerNotes && (
                    <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
                      <strong>Reviewer notes:</strong> {item.reviewerNotes}
                    </div>
                  )}
                  {item.rejectionReason && (
                    <div style={{ marginTop: 4, fontSize: 12, color: "#b91c1c" }}>
                      <strong>Rejection reason:</strong> {item.rejectionReason}
                    </div>
                  )}
                  {item.createdLiveObjectType && item.createdLiveObjectId && (
                    <div style={{ marginTop: 8 }}>
                      <span className="badge badge-green">
                        ✓ {item.createdLiveObjectType === "ManualObligation" ? "Obligation" : item.createdLiveObjectType} created
                      </span>
                      {item.createdLiveObjectType === "ManualObligation" && (
                        <Link href={`/obligations/${item.createdLiveObjectId}`} style={{ marginLeft: 8, fontSize: 12 }}>View →</Link>
                      )}
                    </div>
                  )}

                  {/* Review actions */}
                  {isActionable && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #f3f4f6" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", marginBottom: 10 }}>Review actions</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                        {(["Confirmed","In review","Needs adviser input","Needs source verification","Rejected","Duplicate","Not applicable"] as const).map((status) => {
                          const action = updateReviewStatus.bind(null, item.id, status, undefined, undefined);
                          const cls =
                            status === "Confirmed" ? "btn btn-primary btn-sm" :
                            status === "Rejected" ? "btn btn-sm" :
                            "btn btn-secondary btn-sm";
                          return (
                            <form key={status} action={action} style={{ display: "inline" }}>
                              <button type="submit" className={cls}
                                style={status === "Rejected" ? { color: "#b91c1c", borderColor: "#fca5a5" } : {}}>
                                {status}
                              </button>
                            </form>
                          );
                        })}
                      </div>

                      {/* Create live obligation form */}
                      {item.itemType === "obligation" && (
                        <details style={{ marginTop: 8 }}>
                          <summary style={{ cursor: "pointer", fontSize: 13, color: "#1d4ed8", fontWeight: 600 }}>
                            Create live obligation from this item →
                          </summary>
                          <form action={confirmItemAsObligation.bind(null, item.id)} style={{ marginTop: 12, background: "#f9fafb", padding: 16, borderRadius: 6, border: "1px solid #e5e7eb" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                              <div className="form-row" style={{ marginBottom: 0 }}>
                                <label className="form-label">Entity <span style={{ color: "#b91c1c" }}>*</span></label>
                                <select name="entityId" className="form-input" required>
                                  <option value="">— select entity —</option>
                                  {entities.map(e => <option key={e.id} value={e.id}>{e.legalName}</option>)}
                                </select>
                              </div>
                              <div className="form-row" style={{ marginBottom: 0 }}>
                                <label className="form-label">Regime</label>
                                <input name="regime" className="form-input" defaultValue={(data.regime as string) ?? item.suggestedRegime ?? ""} />
                              </div>
                              <div className="form-row" style={{ marginBottom: 0 }}>
                                <label className="form-label">Obligation type</label>
                                <input name="obligationType" className="form-input" defaultValue={(data.obligationType as string) ?? item.suggestedObligationType ?? ""} />
                              </div>
                              <div className="form-row" style={{ marginBottom: 0 }}>
                                <label className="form-label">Filing deadline</label>
                                <input name="filingDeadline" type="date" className="form-input" defaultValue={(data.filingDeadline as string) ?? ""} />
                              </div>
                              <div className="form-row" style={{ marginBottom: 0 }}>
                                <label className="form-label">Period start</label>
                                <input name="periodStart" type="date" className="form-input" />
                              </div>
                              <div className="form-row" style={{ marginBottom: 0 }}>
                                <label className="form-label">Period end</label>
                                <input name="periodEnd" type="date" className="form-input" />
                              </div>
                              <div className="form-row" style={{ marginBottom: 0 }}>
                                <label className="form-label">Responsible owner</label>
                                <input name="responsibleOwner" className="form-input" defaultValue={(item.suggestedOwner ?? "") as string} />
                              </div>
                            </div>
                            <div className="form-row">
                              <label className="form-label">Description <span style={{ color: "#b91c1c" }}>*</span></label>
                              <textarea name="description" className="form-input" rows={2} required
                                defaultValue={item.plainSummary} />
                            </div>
                            <div className="alert alert-warning" style={{ marginBottom: 12, fontSize: 12 }}>
                              ⚠ This will create a live draft obligation. Review all fields carefully before confirming.
                              {item.isConditional && " This item is conditional — ensure the condition has been resolved."}
                            </div>
                            <button type="submit" className="btn btn-primary btn-sm">Confirm and create obligation</button>
                          </form>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
