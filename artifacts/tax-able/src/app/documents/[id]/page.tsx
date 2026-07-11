import { prisma } from "@/lib/prisma";
import {
  archiveDocument,
  grantDocumentAccess,
  reviewDocumentReliance,
  tombstoneDocument,
  updateDocumentAccessSettings,
  verifyDocumentSource,
} from "@/app/actions/documents";
import { startExtraction } from "@/app/actions/extraction";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HEALTH_MARKERS } from "@/lib/doc-constants";
import { requireDocumentAccess } from "@/lib/authz";
import { canUseDocumentPermission } from "@/lib/authz-policy";
import {
  PRIVILEGE_STATUSES,
  RELIANCE_STATUSES,
  SENSITIVITY_LEVELS,
  SOURCE_CONFIDENCE_LEVELS,
  YES_NO_UNKNOWN,
} from "@/lib/doc-constants";


function fmt(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function bytes(n: number) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(1) + " MB";
}

const markerLabel = Object.fromEntries(HEALTH_MARKERS.map((m) => [m.key, m.label]));

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { context } = await requireDocumentAccess(id, "view");
  const orgId = context.orgId;
  const now = new Date();
  const [doc, extractionRuns] = await Promise.all([
    prisma.document.findFirst({
      where: { id, organisationId: orgId, deletedAt: null },
      include: {
        entity: { select: { id: true, legalName: true } },
        sourceSystem: { select: { id: true, name: true } },
        uploadedBy: { select: { id: true, name: true, email: true } },
        sourceVerifiedBy: { select: { id: true, name: true } },
        supersedes: {
          select: {
            id: true,
            organisationId: true,
            filename: true,
            versionNumber: true,
            restrictedAccess: true,
            deletedAt: true,
            accessGrants: {
              where: { organisationId: context.orgId, userId: context.userId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
              select: { permission: true },
              take: 1,
            },
          },
        },
        supersededBy: {
          select: {
            id: true,
            organisationId: true,
            filename: true,
            versionNumber: true,
            restrictedAccess: true,
            deletedAt: true,
            accessGrants: {
              where: { organisationId: context.orgId, userId: context.userId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
              select: { permission: true },
              take: 1,
            },
          },
        },
        accessGrants: { include: { user: { select: { id: true, name: true, email: true } } } },
        recordLinks: {
          include: {
            obligation: { select: { id: true, description: true } },
            action: { select: { id: true, description: true } },
            assumption: { select: { id: true, assumptionStatement: true } },
            caveat: { select: { id: true, caveatText: true } },
            tripwire: { select: { id: true, description: true } },
            exception: { select: { id: true, title: true } },
            evidence: { select: { id: true, title: true } },
            createdBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { obligations: true, actions: true, assumptions: true, caveats: true, tripwires: true, exceptions: true, evidenceItems: true } },
        chunks: { orderBy: { chunkIndex: "asc" } },
        healthFlags: { orderBy: { chunkIndex: "asc" } },
      },
    }),
    prisma.extractionRun.findMany({
      where: { documentId: id },
      include: { items: { select: { reviewStatus: true } } },
      orderBy: { startedAt: "desc" },
    }),
  ]);
  if (!doc) notFound();

  const archive = archiveDocument.bind(null, doc.id);
  const tombstone = tombstoneDocument.bind(null, doc.id);
  const verify = verifyDocumentSource.bind(null, doc.id);
  const reviewReliance = reviewDocumentReliance.bind(null, doc.id);
  const updateSecurity = updateDocumentAccessSettings.bind(null, doc.id);
  const grant = grantDocumentAccess.bind(null, doc.id);
  const extract = startExtraction.bind(null, doc.id);
  const isArchived = doc.status === "Archived";
  const hasText = doc.chunks.length > 0 && doc.chunks[0].text.length > 0;
  const currentGrant = doc.accessGrants.find(
    (access) =>
      access.organisationId === context.orgId &&
      access.userId === context.userId &&
      (access.expiresAt == null || access.expiresAt > now),
  );
  const canEdit = canUseDocumentPermission(
    context.user.role,
    doc.restrictedAccess,
    currentGrant?.permission,
    "edit",
  );
  const canReview = canUseDocumentPermission(
    context.user.role,
    doc.restrictedAccess,
    currentGrant?.permission,
    "review",
  );
  const canManage = canUseDocumentPermission(
    context.user.role,
    doc.restrictedAccess,
    currentGrant?.permission,
    "manage",
  );
  const canViewVersion = (version: typeof doc.supersedes) =>
    version != null &&
    version.organisationId === context.orgId &&
    version.deletedAt == null &&
    canUseDocumentPermission(
      context.user.role,
      version.restrictedAccess,
      version.accessGrants[0]?.permission,
      "view",
    );

  // Group health flags by marker key
  const flagsByMarker: Record<string, typeof doc.healthFlags> = {};
  for (const f of doc.healthFlags) {
    if (!flagsByMarker[f.marker]) flagsByMarker[f.marker] = [];
    flagsByMarker[f.marker].push(f);
  }

  const fullText = doc.chunks.map((c) => c.text).join("\n\n");

  return (
    <>
      <div style={{ padding: "28px 32px" }}>
        <div style={{ marginBottom: 16 }}>
          <Link href="/documents" style={{ color: "var(--ink-secondary)", fontSize: 13 }}>← Document Vault</Link>
        </div>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: "0 0 6px", fontFamily: "monospace", fontSize: 18 }}>{doc.filename}</h1>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span className={`badge ${doc.status === "Text extracted" ? "badge-green" : doc.status === "Extraction failed" ? "badge-red" : doc.status === "Archived" ? "badge-grey" : "badge-blue"}`}>
                {doc.status}
              </span>
              <span className={`badge ${doc.sensitivityLevel === "Highly confidential" ? "badge-purple" : doc.sensitivityLevel === "High" ? "badge-red" : doc.sensitivityLevel === "Medium" ? "badge-yellow" : "badge-grey"}`}>
                {doc.sensitivityLevel}
              </span>
              {doc.privilegeStatus !== "Not privileged" && doc.privilegeStatus !== "Unknown" && (
                <span className="badge badge-purple">{doc.privilegeStatus}</span>
              )}
              <span className={`badge ${doc.relianceStatus === "Approved for reliance" ? "badge-green" : doc.relianceStatus === "Do not rely" || doc.relianceStatus === "Superseded" ? "badge-red" : "badge-yellow"}`}>
                {doc.relianceStatus}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href={`/api/documents/${doc.id}/file`} className="btn">Download</a>
            {!isArchived && hasText && canEdit && (
              <form action={extract} style={{ display: "inline" }}>
                <button type="submit" className="btn btn-primary">Run AI Extraction</button>
              </form>
            )}
            {!isArchived && canEdit && (
              <Link href={`/documents/${doc.id}/edit`} className="btn">Edit</Link>
            )}
            {!isArchived && canEdit && (
              <form action={archive} style={{ display: "inline" }}>
                <button type="submit" className="btn"
                  style={{ color: "var(--overdue)", borderColor: "var(--overdue)" }}>
                  Archive
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Warnings */}
        {doc.privilegeStatus === "Potentially privileged" && (
          <div className="alert alert-warning" style={{ marginBottom: 12 }}>⚠ Potentially privileged document — handle with care. Do not share without legal review.</div>
        )}
        {doc.privilegeStatus === "Legally privileged" && (
          <div className="alert alert-warning" style={{ marginBottom: 12 }}>🔒 Legally privileged document — restricted circulation.</div>
        )}
        {doc.sensitivityLevel === "Highly confidential" && (
          <div className="alert alert-warning" style={{ marginBottom: 12 }}>🔒 Highly confidential document.</div>
        )}
        {doc.containsPersonalData === "Yes" && (
          <div className="alert alert-info" style={{ marginBottom: 12 }}>ⓘ Contains personal data — handle in accordance with your data protection policy.</div>
        )}
        {(doc.relianceStatus === "Draft" || doc.relianceStatus === "Under review") && (
          <div className="alert alert-warning" style={{ marginBottom: 12 }}>⚠ This document is {doc.relianceStatus.toLowerCase()} — not yet approved for reliance.</div>
        )}
        {doc.relianceStatus === "Superseded" && (
          <div className="alert alert-warning" style={{ marginBottom: 12 }}>⚠ This document has been superseded.</div>
        )}
        {doc.relianceStatus === "Do not rely" && (
          <div className="alert" style={{ background: "var(--overdue-bg)", border: "1px solid var(--overdue)", color: "var(--overdue)", marginBottom: 12 }}>
            ✕ Do not rely on this document.
          </div>
        )}
        {doc.status === "Extraction failed" && (
          <div className="alert" style={{ background: "var(--overdue-bg)", border: "1px solid var(--overdue)", color: "var(--overdue)", marginBottom: 12 }}>
            Text extraction failed: {doc.extractionError || "Unknown error"}
          </div>
        )}
        {!doc.entityId && (
          <div className="alert alert-info" style={{ marginBottom: 12 }}>ⓘ No related entity selected for this document.</div>
        )}
        {doc.healthFlags.length > 0 && (
          <div className="alert alert-warning" style={{ marginBottom: 12 }}>
            ⚠ Health check: {doc.healthFlags.length} placeholder / review flag{doc.healthFlags.length !== 1 ? "s" : ""} detected in extracted text.
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
          {/* Metadata */}
          <div className="panel">
            <h2>File metadata</h2>
            <div className="detail-grid" style={{ gap: 14 }}>
              <div className="detail-item">
                <span className="detail-label">Document type</span>
                <span className="detail-value">{doc.documentType}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">File type</span>
                <span className="detail-value">{doc.fileType.toUpperCase()}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">File size</span>
                <span className="detail-value">{bytes(doc.fileSize)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Upload date</span>
                <span className="detail-value">{fmt(doc.uploadedAt)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Uploaded by</span>
                <span className="detail-value">{doc.uploadedBy ? `${doc.uploadedBy.name} (${doc.uploadedBy.id})` : "Legacy/system"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Document date</span>
                <span className="detail-value">{fmt(doc.documentDate)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Period</span>
                <span className="detail-value">{doc.periodStart ? `${fmt(doc.periodStart)} – ${fmt(doc.periodEnd)}` : "—"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Adviser / provider</span>
                <span className="detail-value">{doc.adviserName || "—"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Version</span>
                <span className="detail-value">Record v{doc.versionNumber}{doc.versionLabel ? ` · ${doc.versionLabel}` : ""}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Supersedes</span>
                <span className="detail-value">{doc.supersedes ? (canViewVersion(doc.supersedes) ? <Link href={`/documents/${doc.supersedes.id}`}>{doc.supersedes.filename} · v{doc.supersedes.versionNumber}</Link> : "Restricted document") : "—"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Superseded by</span>
                <span className="detail-value">{doc.supersededBy ? (canViewVersion(doc.supersededBy) ? <Link href={`/documents/${doc.supersededBy.id}`}>{doc.supersededBy.filename} · v{doc.supersededBy.versionNumber}</Link> : "Restricted document") : "—"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Related entity</span>
                <span className="detail-value">
                  {doc.entity ? (
                    <Link href={`/entities/${doc.entity.id}`}>{doc.entity.legalName}</Link>
                  ) : "—"}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Source system</span>
                <span className="detail-value">{doc.sourceSystem?.name || "—"}</span>
              </div>
              <div className="detail-item" style={{ gridColumn: "1 / -1" }}>
                <span className="detail-label">Content hash (SHA-256)</span>
                <span className="detail-value" style={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-all", color: "var(--ink-secondary)" }}>{doc.contentHash}</span>
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="panel">
            <h2>Security &amp; sensitivity</h2>
            <div className="detail-grid" style={{ gap: 14 }}>
              {[
                ["Sensitivity level", doc.sensitivityLevel],
                ["Privilege status", doc.privilegeStatus],
                ["Personal data", doc.containsPersonalData],
                ["Special category data", doc.containsSpecialCategory],
                ["Payroll data", doc.containsPayrollData],
                ["M&A / restructuring data", doc.containsMaData],
                ["Restricted access", doc.restrictedAccess ? "Yes" : "No"],
              ].map(([label, value]) => (
                <div key={label} className="detail-item">
                  <span className="detail-label">{label}</span>
                  <span className="detail-value">{value}</span>
                </div>
              ))}
              {doc.accessNotes && (
                <div className="detail-item" style={{ gridColumn: "1 / -1" }}>
                  <span className="detail-label">Access notes</span>
                  <span className="detail-value">{doc.accessNotes}</span>
                </div>
              )}
            </div>
            {canManage && !isArchived && (
              <form action={updateSecurity} className="form-grid" style={{ marginTop: 16 }}>
                <div className="form-group"><label>Sensitivity level</label><select name="sensitivityLevel" defaultValue={doc.sensitivityLevel}>{SENSITIVITY_LEVELS.map((value) => <option key={value}>{value}</option>)}</select></div>
                <div className="form-group"><label>Privilege status</label><select name="privilegeStatus" defaultValue={doc.privilegeStatus}>{PRIVILEGE_STATUSES.map((value) => <option key={value}>{value}</option>)}</select></div>
                <div className="form-group"><label>Personal data</label><select name="containsPersonalData" defaultValue={doc.containsPersonalData}>{YES_NO_UNKNOWN.map((value) => <option key={value}>{value}</option>)}</select></div>
                <div className="form-group"><label>Special-category data</label><select name="containsSpecialCategory" defaultValue={doc.containsSpecialCategory}>{YES_NO_UNKNOWN.map((value) => <option key={value}>{value}</option>)}</select></div>
                <div className="form-group"><label>Payroll data</label><select name="containsPayrollData" defaultValue={doc.containsPayrollData}>{YES_NO_UNKNOWN.map((value) => <option key={value}>{value}</option>)}</select></div>
                <div className="form-group"><label>M&amp;A / restructuring data</label><select name="containsMaData" defaultValue={doc.containsMaData}>{YES_NO_UNKNOWN.map((value) => <option key={value}>{value}</option>)}</select></div>
                <label className="flex gap8"><input type="checkbox" name="restrictedAccess" value="true" defaultChecked={doc.restrictedAccess} /> Restricted access</label>
                <div className="form-group"><label>Access notes</label><textarea name="accessNotes" rows={2} defaultValue={doc.accessNotes ?? ""} /></div>
                <div className="form-group"><label>Security change rationale</label><input name="reason" required placeholder="Why this classification or restriction is changing" /></div>
                <button type="submit" className="btn btn-secondary">Update controlled security settings</button>
              </form>
            )}
          </div>
        </div>

        {/* Reliance */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <h2>Source &amp; reliance</h2>
          <div className="detail-grid cols3" style={{ gap: 14 }}>
            <div className="detail-item">
              <span className="detail-label">Reliance status</span>
              <span className="detail-value">{doc.relianceStatus}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Authoritative source?</span>
              <span className="detail-value">{doc.isAuthoritativeSource}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Source confidence</span>
              <span className="detail-value">{doc.sourceConfidence}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Last source verification</span>
              <span className="detail-value">
                {doc.sourceVerifiedAt ? `${fmt(doc.sourceVerifiedAt)} · ${doc.sourceVerifiedBy?.name ?? doc.sourceVerifiedById}` : "Not verified"}
              </span>
            </div>
          </div>
          {canReview && !isArchived ? (
            <>
              <form action={reviewReliance} className="form-grid" style={{ marginTop: 16 }}>
                <div className="form-group"><label>Reliance status</label><select name="relianceStatus" defaultValue={doc.relianceStatus}>{RELIANCE_STATUSES.map((value) => <option key={value}>{value}</option>)}</select></div>
                <div className="form-group"><label>Authoritative source?</label><select name="isAuthoritativeSource" defaultValue={doc.isAuthoritativeSource}>{YES_NO_UNKNOWN.map((value) => <option key={value}>{value}</option>)}</select></div>
                <div className="form-group"><label>Source confidence</label><select name="sourceConfidence" defaultValue={doc.sourceConfidence}>{SOURCE_CONFIDENCE_LEVELS.map((value) => <option key={value}>{value}</option>)}</select></div>
                <div className="form-group"><label>Review rationale</label><input name="note" required placeholder="Evidence and judgement supporting this decision" /></div>
                <button type="submit" className="btn btn-secondary">Record reliance review</button>
              </form>
              <form action={verify} style={{ marginTop: 12 }}>
                <input name="note" className="form-input" required placeholder="Independent source-verification rationale" />
                <button type="submit" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }}>Confirm source verification</button>
              </form>
            </>
          ) : (
            <p className="text-sm text-muted" style={{ marginTop: 12 }}>
              Reliance and authority decisions require document-review permission and, for restricted files, an explicit review grant.
            </p>
          )}
        </div>

        <div className="panel" style={{ marginBottom: 20 }}>
          <h2>Linked system-of-record items</h2>
          <p className="text-sm text-muted">{doc.recordLinks.length} relational provenance link(s). The counts below also include legacy primary-document pointers.</p>
          <div className="detail-grid cols3">
            <div className="detail-item"><span className="detail-label">Obligations</span><span className="detail-value">{doc._count.obligations}</span></div>
            <div className="detail-item"><span className="detail-label">Actions</span><span className="detail-value">{doc._count.actions}</span></div>
            <div className="detail-item"><span className="detail-label">Assumptions / caveats / tripwires</span><span className="detail-value">{doc._count.assumptions + doc._count.caveats + doc._count.tripwires}</span></div>
            <div className="detail-item"><span className="detail-label">Exceptions</span><span className="detail-value">{doc._count.exceptions}</span></div>
            <div className="detail-item"><span className="detail-label">Evidence</span><span className="detail-value">{doc._count.evidenceItems}</span></div>
          </div>
          {doc.recordLinks.length > 0 && (
            <div className="table-scroll" style={{ marginTop: 14 }}>
              <table className="data-table">
                <thead><tr><th>Record</th><th>Relationship</th><th>Source location</th><th>Linked by</th></tr></thead>
                <tbody>
                  {doc.recordLinks.map((link) => {
                    const record = link.obligation
                      ? { label: link.obligation.description, href: `/obligations/${link.obligation.id}`, type: "Obligation" }
                      : link.action
                        ? { label: link.action.description, href: `/actions-register/${link.action.id}`, type: "Action" }
                        : link.assumption
                          ? { label: link.assumption.assumptionStatement, href: "/assumptions", type: "Assumption" }
                          : link.caveat
                            ? { label: link.caveat.caveatText, href: "/caveats", type: "Caveat" }
                            : link.tripwire
                              ? { label: link.tripwire.description, href: "/tripwires", type: "Tripwire" }
                              : link.exception
                                ? { label: link.exception.title, href: "/exceptions", type: "Exception" }
                                : link.evidence
                                  ? { label: link.evidence.title, href: "/evidence", type: "Evidence" }
                                  : null;
                    return record ? (
                      <tr key={link.id}>
                        <td><span className="badge badge-grey">{record.type}</span> <Link href={record.href}>{record.label}</Link></td>
                        <td>{link.linkType}</td>
                        <td>{link.pageReference ?? "—"}</td>
                        <td>{link.createdBy ? `${link.createdBy.name} (${link.createdBy.id})` : "Migration/system"}</td>
                      </tr>
                    ) : null;
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {doc.restrictedAccess && canManage && (
          <div className="panel" style={{ marginBottom: 20 }}>
            <h2>Document access</h2>
            {doc.accessGrants.map((access) => (
              <div key={access.id} className="text-sm" style={{ marginBottom: 6 }}>
                {access.user.name} ({access.user.id}) · {access.permission}
              </div>
            ))}
            <form action={grant} className="form-grid" style={{ marginTop: 12 }}>
              <input name="userId" className="form-input" required placeholder="Authenticated user ID" />
              <select name="permission" className="form-input" defaultValue="view">
                <option value="view">View</option><option value="edit">Edit</option><option value="review">Review</option><option value="manage">Manage</option>
              </select>
              <input name="reason" className="form-input" placeholder="Grant reason" />
              <button type="submit" className="btn btn-secondary">Grant access</button>
            </form>
          </div>
        )}

        {/* Health flags */}
        {doc.healthFlags.length > 0 && (
          <div className="panel" style={{ marginBottom: 20, borderColor: "var(--due-soon)" }}>
            <h2>Health check flags</h2>
            <p style={{ color: "var(--ink-secondary)", fontSize: 13, marginBottom: 14 }}>
              The following placeholder or review markers were detected in the extracted text. Review before relying on this document.
            </p>
            {Object.entries(flagsByMarker).map(([key, flags]) => (
              <div key={key} style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                  ⚠ {markerLabel[key] || key}
                  <span style={{ marginLeft: 8, fontWeight: 400, color: "var(--ink-secondary)", fontSize: 12 }}>({flags.length} occurrence{flags.length !== 1 ? "s" : ""})</span>
                </div>
                {flags.slice(0, 3).map((f, i) => (
                  <div key={i} style={{ background: "var(--due-soon-bg)", border: "1px solid var(--due-soon)", borderRadius: 5, padding: "8px 12px", marginBottom: 6, fontFamily: "monospace", fontSize: 12, color: "var(--due-soon)" }}>
                    {f.context}
                  </div>
                ))}
                {flags.length > 3 && (
                  <div style={{ color: "var(--ink-tertiary)", fontSize: 12 }}>+{flags.length - 3} more occurrence{flags.length - 3 !== 1 ? "s" : ""}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Extracted text */}
        {fullText && (
          <div className="panel" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>Extracted text</h2>
              <span style={{ color: "var(--ink-secondary)", fontSize: 12 }}>{fullText.length.toLocaleString()} characters</span>
            </div>
            <div style={{
              background: "var(--surface-sunken)", border: "1px solid var(--border)", borderRadius: 6,
              padding: 16, maxHeight: 480, overflowY: "auto",
              fontFamily: "monospace", fontSize: 12, lineHeight: 1.6,
              whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--ink-secondary)"
            }}>
              {fullText}
            </div>
          </div>
        )}

        {/* AI Extraction runs */}
        <div className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ margin: 0 }}>AI Extraction runs</h2>
            {hasText && !isArchived && canEdit && (
              <form action={extract}>
                <button type="submit" className="btn btn-primary btn-sm">Run new extraction</button>
              </form>
            )}
          </div>

          {!hasText && (
            <p style={{ color: "var(--ink-secondary)", fontSize: 13 }}>
              AI extraction requires extracted text. Upload a PDF or DOCX document with readable content first.
            </p>
          )}

          {hasText && extractionRuns.length === 0 && (
            <p style={{ color: "var(--ink-secondary)", fontSize: 13 }}>
              No extraction runs yet. Click "Run AI Extraction" to have the AI identify obligations, actions, assumptions, and other structured items from this document.
            </p>
          )}

          {extractionRuns.length > 0 && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Model</th>
                  <th>Status</th>
                  <th>Items</th>
                  <th>Reviewed</th>
                  <th>Confirmed</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {extractionRuns.map((run) => {
                  const total = run.items.length;
                  const reviewed = run.items.filter(i => !["Needs review","In review"].includes(i.reviewStatus)).length;
                  const confirmed = run.items.filter(i => ["Confirmed","Edited and confirmed"].includes(i.reviewStatus)).length;
                  return (
                    <tr key={run.id}>
                      <td style={{ fontSize: 12, color: "var(--ink-secondary)", whiteSpace: "nowrap" }}>
                        {run.startedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td style={{ fontSize: 12 }}>{run.modelProvider} / {run.modelName}</td>
                      <td>
                        <span className={`badge ${run.status === "Completed" ? "badge-green" : run.status === "Failed" ? "badge-red" : run.status === "Running" ? "badge-blue" : "badge-grey"}`}>
                          {run.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>{total}</td>
                      <td style={{ fontSize: 13 }}>{reviewed}/{total}</td>
                      <td style={{ fontSize: 13, color: confirmed > 0 ? "var(--on-track)" : "var(--ink-secondary)" }}>{confirmed}</td>
                      <td>
                        <Link href={`/documents/${doc.id}/extraction/${run.id}`} className="btn btn-sm">
                          Review →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {canManage && (
          <div className="panel" style={{ borderColor: "var(--overdue)", marginTop: 20 }}>
            <h2>Deletion control</h2>
            <p className="text-sm text-muted">
              Tombstone this record and remove it from active views while preserving audit provenance. The stored file is retained for controlled retention review.
            </p>
            <form action={tombstone}>
              <input name="reason" className="form-input" required placeholder="Deletion reason" />
              <button type="submit" className="btn btn-danger btn-sm" style={{ marginTop: 8 }}>Tombstone document</button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
