import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ITEM_TYPE_LABELS, type ItemType } from "@/lib/extraction-schema";
import {
  updateReviewStatus,
  editReviewItem,
  finalizeReviewWithoutRecord,
  linkReviewItemToExisting,
  confirmItemAsObligation,
  confirmItemAsAction,
  confirmItemAsAssumption,
  confirmItemAsCaveat,
  confirmItemAsEvidence,
  confirmItemAsTripwire,
} from "@/app/actions/extraction";
import { requireDocumentAccess } from "@/lib/authz";

const LOW_CONFIDENCE_THRESHOLD = 0.5;

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
    status === "Rejected" || status === "Duplicate" || status === "Not applicable" || status === "Reviewed - no record required" ? "badge-grey" :
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
  const skip = new Set(["sourceText","sourceBlockId","sourcePageNumber","sourceChunkPage","sourceQuoteVerified","confidenceScore","isConditional","conditionText","isDraft","requiresHumanTaxReview","requiresSourceVerification"]);
  const entries = Object.entries(obj).filter(([k, v]) => !skip.has(k) && v !== null && v !== undefined && v !== "" && v !== false);
  if (entries.length === 0) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", marginTop: 8 }}>
      {entries.map(([key, val]) => (
        <div key={key}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}
          </span>
          <div style={{ fontSize: 13, color: "var(--ink)" }}>
            {Array.isArray(val) ? val.join(", ") : typeof val === "boolean" ? (val ? "Yes" : "No") : String(val)}
          </div>
        </div>
      ))}
    </div>
  );
}

function ConfirmGuardrailFields({
  item,
  sourceIsAuthoritative,
  linkingExisting = false,
}: {
  item: {
    confidenceScore: number;
    isConditional: boolean;
    conditionText: string | null;
    requiresSourceVerification: boolean;
  };
  sourceIsAuthoritative: boolean;
  linkingExisting?: boolean;
}) {
  const lowConfidence = item.confidenceScore < LOW_CONFIDENCE_THRESHOLD;
  const needsSourceVerification =
    item.requiresSourceVerification || !sourceIsAuthoritative;
  return (
    <>
      {(lowConfidence || item.isConditional || needsSourceVerification) && (
        <div style={{ background: "var(--due-soon-bg)", border: "1px solid var(--due-soon)", borderRadius: 5, padding: 12, marginBottom: 12, fontSize: 12, color: "var(--due-soon)" }}>
          {lowConfidence && <div>⚠ Low confidence — a reviewer note is required to confirm this item.</div>}
          {item.isConditional && <div>⚠ Conditional item — the condition will be preserved unless you explicitly resolve it below.</div>}
          {needsSourceVerification && <div>⚠ Source verification is required — verify the source or give an override reason below.</div>}
        </div>
      )}
      <div className="form-row">
        <label className="form-label">
          Reviewer note {lowConfidence && <span style={{ color: "var(--overdue)" }}>* required (low confidence)</span>}
        </label>
        <textarea name="reviewerNotes" className="form-input" rows={2} required={lowConfidence} />
      </div>
      {item.isConditional && (
        <div className="form-row">
          {linkingExisting && (
            <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" name="conditionPreservedInLinkedRecord" /> The linked record preserves this condition
            </label>
          )}
          <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" name="resolveCondition" /> This condition no longer applies (requires a note)
          </label>
          <textarea name="conditionResolutionNote" className="form-input" rows={2} placeholder={`Why "${item.conditionText}" no longer applies...`} />
        </div>
      )}
      {needsSourceVerification && (
        <div className="form-row">
          <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" name="sourceVerified" /> I have independently verified this source
          </label>
          <input name="sourceOverrideReason" className="form-input" placeholder="Or give a reason to override the non-authoritative source warning" />
        </div>
      )}
    </>
  );
}

export default async function ExtractionRunPage({
  params,
}: {
  params: Promise<{ id: string; runId: string }>;
}) {
  const { id: documentId, runId } = await params;
  const { context } = await requireDocumentAccess(documentId, "review");
  const orgId = context.orgId;

  const [doc, run, entities] = await Promise.all([
    prisma.document.findFirst({
      where: { id: documentId, organisationId: orgId, deletedAt: null },
      select: { id: true, filename: true, organisationId: true, documentType: true, isAuthoritativeSource: true, sourceConfidence: true },
    }),
    prisma.extractionRun.findFirst({
      where: { id: runId, documentId, organisationId: orgId },
      include: {
        items: { orderBy: [{ itemType: "asc" }, { confidenceScore: "desc" }] },
      },
    }),
    prisma.entity.findMany({ where: { organisationId: orgId, deletedAt: null }, orderBy: { legalName: "asc" } }),
  ]);

  if (!doc || !run) notFound();

  const sourceIsAuthoritative = doc.isAuthoritativeSource === "Yes";
  const items = run.items;
  const needsReview = items.filter(i =>
    ["Needs review", "In review", "Needs adviser input", "Needs source verification"].includes(i.reviewStatus) ||
    (["Confirmed", "Edited and confirmed"].includes(i.reviewStatus) && (!i.createdLiveObjectType || !i.createdLiveObjectId))
  ).length;
  const confirmed = items.filter(i =>
    ["Confirmed", "Edited and confirmed"].includes(i.reviewStatus) && i.createdLiveObjectType && i.createdLiveObjectId
  ).length;
  const rejected = items.filter(i =>
    ["Rejected", "Duplicate", "Not applicable", "Reviewed - no record required"].includes(i.reviewStatus)
  ).length;

  // Group by item type
  const byType: Record<string, typeof items> = {};
  for (const item of items) {
    if (!byType[item.itemType]) byType[item.itemType] = [];
    byType[item.itemType].push(item);
  }

  return (
    <>
      <div style={{ padding: "28px 32px" }}>
        {/* Breadcrumb */}
        <div style={{ marginBottom: 16, fontSize: 13, color: "var(--ink-secondary)" }}>
          <Link href="/documents" style={{ color: "var(--ink-secondary)" }}>Document Vault</Link>
          {" / "}
          <Link href={`/documents/${documentId}`} style={{ color: "var(--ink-secondary)" }}>{doc.filename}</Link>
          {" / "}
          AI Extraction
        </div>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: "0 0 6px" }}>AI Extraction Review</h1>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <StatusBadge status={run.status} />
              <span style={{ color: "var(--ink-secondary)", fontSize: 12 }}>
                {run.modelProvider} / {run.modelName} · prompt v{run.promptVersion} · schema v{run.extractionSchemaVersion}
              </span>
              <span style={{ color: "var(--ink-secondary)", fontSize: 12 }}>
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

        {!sourceIsAuthoritative && (
          <div className="alert" style={{ background: "var(--due-soon-bg)", border: "1px solid var(--due-soon)", color: "var(--due-soon)", marginBottom: 16 }}>
            <strong>Source not marked authoritative</strong> (source confidence: {doc.sourceConfidence}). Creating a live record from
            these items will require source verification or an override reason.
          </div>
        )}

        {/* Error */}
        {run.status === "Failed" && run.errorMessage && (
          <div className="alert" style={{ background: "var(--overdue-bg)", border: "1px solid var(--overdue)", color: "var(--overdue)", marginBottom: 16 }}>
            <strong>Extraction failed:</strong> {run.errorMessage}
          </div>
        )}

        {/* Stats */}
        {items.length > 0 && (
          <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
            <div className="panel" style={{ flex: 1, minWidth: 120, textAlign: "center", padding: "14px 20px" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ink)" }}>{items.length}</div>
              <div style={{ fontSize: 12, color: "var(--ink-secondary)" }}>Items extracted</div>
            </div>
            <div className="panel" style={{ flex: 1, minWidth: 120, textAlign: "center", padding: "14px 20px" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "var(--due-soon)" }}>{needsReview}</div>
              <div style={{ fontSize: 12, color: "var(--ink-secondary)" }}>Needs review</div>
            </div>
            <div className="panel" style={{ flex: 1, minWidth: 120, textAlign: "center", padding: "14px 20px" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "var(--on-track)" }}>{confirmed}</div>
              <div style={{ fontSize: 12, color: "var(--ink-secondary)" }}>Confirmed</div>
            </div>
            <div className="panel" style={{ flex: 1, minWidth: 120, textAlign: "center", padding: "14px 20px" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ink-secondary)" }}>{rejected}</div>
              <div style={{ fontSize: 12, color: "var(--ink-secondary)" }}>Rejected / N/A</div>
            </div>
          </div>
        )}

        {items.length === 0 && run.status === "Completed" && (
          <div className="panel" style={{ textAlign: "center", padding: 48, color: "var(--ink-secondary)" }}>
            No items were extracted from this document. This may mean the document does not contain structured tax obligations, or the text was too short.
          </div>
        )}

        {/* Items grouped by type */}
        {Object.entries(byType).map(([type, typeItems]) => (
          <div key={type} style={{ marginBottom: 32 }}>
            <h2 style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <ItemTypeTag type={type} />
              <span style={{ fontSize: 13, color: "var(--ink-secondary)", fontWeight: 400 }}>
                {typeItems.length} item{typeItems.length !== 1 ? "s" : ""}
              </span>
            </h2>

            {typeItems.map((item) => {
              const hasLiveRecordLink = Boolean(item.createdLiveObjectType && item.createdLiveObjectId);
              const confirmedWithRecord = ["Confirmed", "Edited and confirmed"].includes(item.reviewStatus) && hasLiveRecordLink;
              const noRecordFinal = ["Rejected", "Duplicate", "Not applicable", "Reviewed - no record required"].includes(item.reviewStatus);
              const isActionable = !confirmedWithRecord && !noRecordFinal;
              const data = item.structuredJson as Record<string, unknown>;
              const needsSourceGuardrail = item.requiresSourceVerification || !sourceIsAuthoritative;

              return (
                <div key={item.id} className="panel" style={{
                  marginBottom: 14,
                  borderLeft: `4px solid ${item.confidenceScore >= 0.75 ? "var(--on-track)" : item.confidenceScore >= 0.5 ? "var(--due-soon)" : "var(--overdue)"}`,
                  opacity: noRecordFinal ? 0.6 : 1,
                }}>
                  {/* Item header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)", marginBottom: 4 }}>
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
                    <div style={{ background: "var(--due-soon-bg)", border: "1px solid var(--due-soon)", borderRadius: 5, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: "var(--due-soon)" }}>
                      <strong>Condition:</strong> {item.conditionText}
                    </div>
                  )}

                  {/* Source excerpt */}
                  {item.sourceTextExcerpt && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-tertiary)", textTransform: "uppercase", marginBottom: 4 }}>
                        Source text {item.sourcePageSection ? `· ${item.sourcePageSection}` : ""}
                      </div>
                      <div style={{ background: "var(--surface-sunken)", border: "1px solid var(--border)", borderRadius: 5, padding: "8px 12px", fontFamily: "monospace", fontSize: 12, color: "var(--ink-secondary)", maxHeight: 120, overflowY: "auto" }}>
                        {item.sourceTextExcerpt}
                      </div>
                    </div>
                  )}

                  {/* Structured fields */}
                  <StructuredFields json={item.structuredJson} />

                  {/* Reviewer notes */}
                  {item.reviewerNotes && (
                    <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-secondary)" }}>
                      <strong>Reviewer notes:</strong> {item.reviewerNotes}
                    </div>
                  )}
                  {item.rejectionReason && (
                    <div style={{ marginTop: 4, fontSize: 12, color: "var(--overdue)" }}>
                      <strong>Disposition reason:</strong> {item.rejectionReason}
                    </div>
                  )}
                  {item.createdLiveObjectType && item.createdLiveObjectId && (
                    <div style={{ marginTop: 8 }}>
                      <span className="badge badge-green">
                        ✓ Durable {item.createdLiveObjectType} record linked
                      </span>
                      {item.createdLiveObjectType === "Obligation" && (
                        <Link href={`/obligations/${item.createdLiveObjectId}`} style={{ marginLeft: 8, fontSize: 12 }}>View →</Link>
                      )}
                    </div>
                  )}
                  {["Confirmed", "Edited and confirmed"].includes(item.reviewStatus) && !hasLiveRecordLink && (
                    <div className="alert alert-warning" style={{ marginTop: 8, fontSize: 12 }}>
                      Legacy confirmed state has no durable record link. Create or link a record, or use a reviewed/no-record disposition with a reason.
                    </div>
                  )}

                  {/* Review actions */}
                  {isActionable && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--surface-sunken)" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-tertiary)", textTransform: "uppercase", marginBottom: 10 }}>Review actions</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                        {(["In review","Needs adviser input","Needs source verification"] as const).filter((status) => status !== item.reviewStatus).map((status) => {
                          const action = updateReviewStatus.bind(null, item.id, status, undefined, undefined);
                          return (
                            <form key={status} action={action} style={{ display: "inline" }}>
                              <button type="submit" className="btn btn-secondary btn-sm">{status}</button>
                            </form>
                          );
                        })}
                      </div>

                      {/* Final disposition without creating a live record */}
                      <details style={{ marginBottom: 8 }}>
                        <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--ink-secondary)", fontWeight: 600 }}>
                          Close review without creating a record →
                        </summary>
                        <form action={finalizeReviewWithoutRecord.bind(null, item.id)} style={{ marginTop: 12, background: "var(--surface-sunken)", padding: 16, borderRadius: 6, border: "1px solid var(--border)" }}>
                          <div className="alert alert-warning" style={{ marginBottom: 12, fontSize: 12 }}>
                            This is a final reviewed outcome. It will not create an obligation, action or other live control record.
                          </div>
                          <div className="form-row">
                            <label className="form-label">Disposition <span style={{ color: "var(--overdue)" }}>*</span></label>
                            <select name="reviewStatus" className="form-input" required defaultValue="Reviewed - no record required">
                              <option value="Reviewed - no record required">Reviewed - no record required</option>
                              <option value="Not applicable">Not applicable</option>
                              <option value="Duplicate">Duplicate</option>
                              <option value="Rejected">Rejected extraction</option>
                            </select>
                          </div>
                          <div className="form-row">
                            <label className="form-label">Disposition reason <span style={{ color: "var(--overdue)" }}>*</span></label>
                            <textarea name="dispositionReason" className="form-input" rows={2} required placeholder="Why no durable live record is required" />
                          </div>
                          {item.isConditional && (
                            <div className="form-row">
                              <label className="form-label">How the condition was considered <span style={{ color: "var(--overdue)" }}>*</span></label>
                              <textarea name="conditionDispositionNote" className="form-input" rows={2} required placeholder={`Explain how "${item.conditionText ?? "the source condition"}" affects this disposition`} />
                            </div>
                          )}
                          {needsSourceGuardrail && (
                            <div className="form-row">
                              <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <input type="checkbox" name="sourceVerified" /> I independently verified the cited source
                              </label>
                              <textarea name="sourceOverrideReason" className="form-input" rows={2} placeholder="Or provide a specific rationale for making this final decision despite the source warning" />
                            </div>
                          )}
                          <div className="form-row">
                            <label className="form-label">Additional reviewer note</label>
                            <textarea name="reviewerNotes" className="form-input" rows={2} />
                          </div>
                          <button type="submit" className="btn btn-secondary btn-sm">Save final no-record disposition</button>
                        </form>
                      </details>

                      {/* Edit while keeping the item open */}
                      <details style={{ marginTop: 8, marginBottom: 8 }}>
                        <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--brand)", fontWeight: 600 }}>Edit item →</summary>
                        <form action={editReviewItem.bind(null, item.id)} style={{ marginTop: 12, background: "var(--surface-sunken)", padding: 16, borderRadius: 6, border: "1px solid var(--border)" }}>
                          <div className="form-row">
                            <label className="form-label">Summary</label>
                            <textarea name="plainSummary" className="form-input" rows={2} required defaultValue={item.plainSummary} />
                          </div>
                          <div className="form-row">
                            <label className="form-label">
                              Reviewer note
                            </label>
                            <textarea name="reviewerNotes" className="form-input" rows={2} />
                          </div>
                          <button type="submit" className="btn btn-secondary btn-sm">Save edit and keep in review</button>
                        </form>
                      </details>

                      {/* Create live obligation */}
                      {item.itemType === "obligation" && (
                        <details style={{ marginTop: 8 }}>
                          <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--brand)", fontWeight: 600 }}>
                            Create live obligation from this item →
                          </summary>
                          <form action={confirmItemAsObligation.bind(null, item.id)} style={{ marginTop: 12, background: "var(--surface-sunken)", padding: 16, borderRadius: 6, border: "1px solid var(--border)" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                              <div className="form-row" style={{ marginBottom: 0 }}>
                                <label className="form-label">Entity <span style={{ color: "var(--overdue)" }}>*</span></label>
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
                              <label className="form-label">Description <span style={{ color: "var(--overdue)" }}>*</span></label>
                              <textarea name="description" className="form-input" rows={2} required
                                defaultValue={item.plainSummary} />
                            </div>
                            <ConfirmGuardrailFields item={item} sourceIsAuthoritative={sourceIsAuthoritative} />
                            <div className="alert alert-warning" style={{ margin: "12px 0", fontSize: 12 }}>
                              ⚠ This will create a live draft obligation. Review all fields carefully before confirming.
                            </div>
                            <button type="submit" className="btn btn-primary btn-sm">Confirm and create obligation</button>
                          </form>
                        </details>
                      )}

                      {/* Create live action */}
                      {item.itemType === "action" && (
                        <details style={{ marginTop: 8 }}>
                          <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--brand)", fontWeight: 600 }}>
                            Create live action from this item →
                          </summary>
                          <form action={confirmItemAsAction.bind(null, item.id)} style={{ marginTop: 12, background: "var(--surface-sunken)", padding: 16, borderRadius: 6, border: "1px solid var(--border)" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                              <div className="form-row" style={{ marginBottom: 0 }}>
                                <label className="form-label">Entity <span style={{ color: "var(--overdue)" }}>*</span></label>
                                <select name="entityId" className="form-input" required>
                                  <option value="">— select entity —</option>
                                  {entities.map(e => <option key={e.id} value={e.id}>{e.legalName}</option>)}
                                </select>
                              </div>
                              <div className="form-row" style={{ marginBottom: 0 }}>
                                <label className="form-label">Responsible party</label>
                                <input name="responsibleParty" className="form-input" defaultValue={(data.responsibleParty as string) ?? item.suggestedOwner ?? ""} />
                              </div>
                              <div className="form-row" style={{ marginBottom: 0 }}>
                                <label className="form-label">Deadline</label>
                                <input name="deadline" type="date" className="form-input" defaultValue={(data.deadline as string) ?? ""} />
                              </div>
                              <div className="form-row" style={{ marginBottom: 0 }}>
                                <label className="form-label">Evidence required</label>
                                <input name="evidenceDescription" className="form-input" defaultValue={(data.evidenceRequired as string) ?? ""} />
                              </div>
                            </div>
                            <div className="form-row">
                              <label className="form-label">Description <span style={{ color: "var(--overdue)" }}>*</span></label>
                              <textarea name="description" className="form-input" rows={2} required defaultValue={item.plainSummary} />
                            </div>
                            <ConfirmGuardrailFields item={item} sourceIsAuthoritative={sourceIsAuthoritative} />
                            <div className="alert alert-warning" style={{ margin: "12px 0", fontSize: 12 }}>
                              ⚠ This will create a live draft action. Review all fields carefully before confirming.
                            </div>
                            <button type="submit" className="btn btn-primary btn-sm">Confirm and create action</button>
                          </form>
                        </details>
                      )}

                      {/* Create live assumption */}
                      {item.itemType === "assumption" && (
                        <details style={{ marginTop: 8 }}>
                          <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--brand)", fontWeight: 600 }}>
                            Create live assumption from this item →
                          </summary>
                          <form action={confirmItemAsAssumption.bind(null, item.id)} style={{ marginTop: 12, background: "var(--surface-sunken)", padding: 16, borderRadius: 6, border: "1px solid var(--border)" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                              <div className="form-row" style={{ marginBottom: 0 }}>
                                <label className="form-label">Entity <span style={{ color: "var(--overdue)" }}>*</span></label>
                                <select name="entityId" className="form-input" required>
                                  <option value="">— select entity —</option>
                                  {entities.map(e => <option key={e.id} value={e.id}>{e.legalName}</option>)}
                                </select>
                              </div>
                              <div className="form-row" style={{ marginBottom: 0 }}>
                                <label className="form-label">Reliance importance</label>
                                <select name="relianceImportance" className="form-input" defaultValue="Medium">
                                  <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
                                </select>
                              </div>
                              <div className="form-row" style={{ marginBottom: 0 }}>
                                <label className="form-label">Suggested review cadence</label>
                                <input name="suggestedReviewCadence" className="form-input" defaultValue={(data.suggestedReviewCadence as string) ?? ""} />
                              </div>
                            </div>
                            <div className="form-row">
                              <label className="form-label">Assumption statement <span style={{ color: "var(--overdue)" }}>*</span></label>
                              <textarea name="assumptionStatement" className="form-input" rows={2} required
                                defaultValue={item.assumptionText ?? item.plainSummary} />
                            </div>
                            <ConfirmGuardrailFields item={item} sourceIsAuthoritative={sourceIsAuthoritative} />
                            <div className="alert alert-warning" style={{ margin: "12px 0", fontSize: 12 }}>
                              ⚠ This will create a live assumption. Review all fields carefully before confirming.
                            </div>
                            <button type="submit" className="btn btn-primary btn-sm">Confirm and create assumption</button>
                          </form>
                        </details>
                      )}

                      {/* Create live caveat */}
                      {item.itemType === "caveat" && (
                        <details style={{ marginTop: 8 }}>
                          <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--brand)", fontWeight: 600 }}>
                            Create live caveat from this item →
                          </summary>
                          <form action={confirmItemAsCaveat.bind(null, item.id)} style={{ marginTop: 12, background: "var(--surface-sunken)", padding: 16, borderRadius: 6, border: "1px solid var(--border)" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                              <div className="form-row" style={{ marginBottom: 0 }}>
                                <label className="form-label">Entity <span style={{ color: "var(--overdue)" }}>*</span></label>
                                <select name="entityId" className="form-input" required>
                                  <option value="">— select entity —</option>
                                  {entities.map(e => <option key={e.id} value={e.id}>{e.legalName}</option>)}
                                </select>
                              </div>
                              <div className="form-row" style={{ marginBottom: 0 }}>
                                <label className="form-label">Related topic</label>
                                <input name="relatedTopic" className="form-input" defaultValue={(data.relatedTopic as string) ?? ""} />
                              </div>
                            </div>
                            <div className="form-row">
                              <label className="form-label">Caveat <span style={{ color: "var(--overdue)" }}>*</span></label>
                              <textarea name="caveatText" className="form-input" rows={2} required defaultValue={item.caveatText ?? item.plainSummary} />
                            </div>
                            <div className="form-row">
                              <label className="form-label">Impact if unresolved</label>
                              <textarea name="impactIfUnresolved" className="form-input" rows={2} defaultValue={(data.impactIfUnresolved as string) ?? ""} />
                            </div>
                            <ConfirmGuardrailFields item={item} sourceIsAuthoritative={sourceIsAuthoritative} />
                            <button type="submit" className="btn btn-primary btn-sm">Confirm and create caveat</button>
                          </form>
                        </details>
                      )}

                      {/* Create live tripwire */}
                      {item.itemType === "tripwire" && (
                        <details style={{ marginTop: 8 }}>
                          <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--brand)", fontWeight: 600 }}>
                            Create live tripwire from this item →
                          </summary>
                          <form action={confirmItemAsTripwire.bind(null, item.id)} style={{ marginTop: 12, background: "var(--surface-sunken)", padding: 16, borderRadius: 6, border: "1px solid var(--border)" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                              <div className="form-row" style={{ marginBottom: 0 }}>
                                <label className="form-label">Entity <span style={{ color: "var(--overdue)" }}>*</span></label>
                                <select name="entityId" className="form-input" required>
                                  <option value="">— select entity —</option>
                                  {entities.map(e => <option key={e.id} value={e.id}>{e.legalName}</option>)}
                                </select>
                              </div>
                              <div className="form-row" style={{ marginBottom: 0 }}>
                                <label className="form-label">Trigger event <span style={{ color: "var(--overdue)" }}>*</span></label>
                                <input name="triggerEvent" className="form-input" required defaultValue={(data.triggerEvent as string) ?? ""} />
                              </div>
                              <div className="form-row" style={{ marginBottom: 0 }}>
                                <label className="form-label">Review date / deadline</label>
                                <input name="reviewDateOrDeadline" type="date" className="form-input" defaultValue={(data.reviewDateOrDeadline as string) ?? ""} />
                              </div>
                              <div className="form-row" style={{ marginBottom: 0 }}>
                                <label className="form-label">Review cadence</label>
                                <input name="reviewCadence" className="form-input" defaultValue={(data.reviewCadence as string) ?? ""} />
                              </div>
                              <div className="form-row" style={{ marginBottom: 0 }}>
                                <label className="form-label">Disarm condition</label>
                                <input name="disarmCondition" className="form-input" defaultValue={(data.disarmCondition as string) ?? ""} />
                              </div>
                            </div>
                            <div className="form-row">
                              <label className="form-label">Description <span style={{ color: "var(--overdue)" }}>*</span></label>
                              <textarea name="description" className="form-input" rows={2} required defaultValue={item.plainSummary} />
                            </div>
                            <ConfirmGuardrailFields item={item} sourceIsAuthoritative={sourceIsAuthoritative} />
                            <div className="alert alert-warning" style={{ margin: "12px 0", fontSize: 12 }}>
                              ⚠ This will create a live tripwire. Review all fields carefully before confirming.
                            </div>
                            <button type="submit" className="btn btn-primary btn-sm">Confirm and create tripwire</button>
                          </form>
                        </details>
                      )}

                      {/* Evidence and valuation reports are promoted as evidence, never obligations. */}
                      {(item.itemType === "evidence" || item.itemType === "valuation") && (
                        <details style={{ marginTop: 8 }}>
                          <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--brand)", fontWeight: 600 }}>
                            Create evidence record from this item →
                          </summary>
                          <form action={confirmItemAsEvidence.bind(null, item.id)} style={{ marginTop: 12, background: "var(--surface-sunken)", padding: 16, borderRadius: 6, border: "1px solid var(--border)" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                              <div className="form-row" style={{ marginBottom: 0 }}>
                                <label className="form-label">Entity <span style={{ color: "var(--overdue)" }}>*</span></label>
                                <select name="entityId" className="form-input" required>
                                  <option value="">— select entity —</option>
                                  {entities.map(e => <option key={e.id} value={e.id}>{e.legalName}</option>)}
                                </select>
                              </div>
                              <div className="form-row" style={{ marginBottom: 0 }}>
                                <label className="form-label">Evidence type</label>
                                <input name="evidenceType" className="form-input" defaultValue={(data.evidenceType as string) ?? (item.itemType === "valuation" ? "Valuation report" : "Document evidence")} />
                              </div>
                            </div>
                            <div className="form-row">
                              <label className="form-label">Title <span style={{ color: "var(--overdue)" }}>*</span></label>
                              <input name="title" className="form-input" required defaultValue={item.plainSummary} />
                            </div>
                            <div className="form-row">
                              <label className="form-label">Description</label>
                              <textarea name="description" className="form-input" rows={2} defaultValue={item.plainSummary} />
                            </div>
                            <ConfirmGuardrailFields item={item} sourceIsAuthoritative={sourceIsAuthoritative} />
                            <div className="alert alert-warning" style={{ margin: "12px 0", fontSize: 12 }}>
                              This creates an evidence record only; it does not infer a statutory obligation from a valuation report.
                            </div>
                            <button type="submit" className="btn btn-primary btn-sm">Confirm and create evidence</button>
                          </form>
                        </details>
                      )}

                      {/* Link to an existing live record instead of creating a new one */}
                      <details style={{ marginTop: 8 }}>
                        <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--ink-secondary)", fontWeight: 600 }}>
                          Link to an existing record →
                        </summary>
                        <form action={linkReviewItemToExisting.bind(null, item.id)} style={{ marginTop: 12, background: "var(--surface-sunken)", padding: 16, borderRadius: 6, border: "1px solid var(--border)" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8, marginBottom: 12 }}>
                            <div className="form-row" style={{ marginBottom: 0 }}>
                              <label className="form-label">Record type</label>
                              <select name="liveObjectType" className="form-input" required>
                                <option value="Obligation">Obligation</option>
                                <option value="Action">Action</option>
                                <option value="Assumption">Assumption</option>
                                <option value="Caveat">Caveat</option>
                                <option value="Tripwire">Tripwire</option>
                                <option value="Evidence">Evidence</option>
                                <option value="Exception">Exception</option>
                              </select>
                            </div>
                            <div className="form-row" style={{ marginBottom: 0 }}>
                              <label className="form-label">Record ID</label>
                              <input name="liveObjectId" className="form-input" required placeholder="Existing record ID" />
                            </div>
                          </div>
                          <ConfirmGuardrailFields item={item} sourceIsAuthoritative={sourceIsAuthoritative} linkingExisting />
                          <button type="submit" className="btn btn-primary btn-sm">Confirm and link record</button>
                        </form>
                      </details>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
