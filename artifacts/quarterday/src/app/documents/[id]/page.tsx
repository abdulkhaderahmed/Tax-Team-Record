import { AppShell } from "@/components/nav";
import { prisma } from "@/lib/prisma";
import { archiveDocument } from "@/app/actions/documents";
import { startExtraction } from "@/app/actions/extraction";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HEALTH_MARKERS } from "@/lib/doc-constants";

const ORG_ID = "demo-org";

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
  const [doc, extractionRuns] = await Promise.all([
    prisma.document.findUnique({
      where: { id },
      include: {
        entity: { select: { id: true, legalName: true } },
        sourceSystem: { select: { id: true, name: true } },
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
  if (!doc || doc.organisationId !== ORG_ID) notFound();

  const archive = archiveDocument.bind(null, doc.id);
  const extract = startExtraction.bind(null, doc.id);
  const isArchived = doc.status === "Archived";
  const hasText = doc.chunks.length > 0 && doc.chunks[0].text.length > 0;

  // Group health flags by marker key
  const flagsByMarker: Record<string, typeof doc.healthFlags> = {};
  for (const f of doc.healthFlags) {
    if (!flagsByMarker[f.marker]) flagsByMarker[f.marker] = [];
    flagsByMarker[f.marker].push(f);
  }

  const fullText = doc.chunks.map((c) => c.text).join("\n\n");

  return (
    <AppShell>
      <div style={{ padding: "28px 32px" }}>
        <div style={{ marginBottom: 16 }}>
          <Link href="/documents" style={{ color: "#6b7280", fontSize: 13 }}>← Document Vault</Link>
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
            {!isArchived && hasText && (
              <form action={extract} style={{ display: "inline" }}>
                <button type="submit" className="btn btn-primary">Run AI Extraction</button>
              </form>
            )}
            {!isArchived && (
              <Link href={`/documents/${doc.id}/edit`} className="btn">Edit</Link>
            )}
            {!isArchived && (
              <form action={archive} style={{ display: "inline" }}>
                <button type="submit" className="btn"
                  style={{ color: "#b91c1c", borderColor: "#fca5a5" }}>
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
          <div className="alert" style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#b91c1c", marginBottom: 12 }}>
            ✕ Do not rely on this document.
          </div>
        )}
        {doc.status === "Extraction failed" && (
          <div className="alert" style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#b91c1c", marginBottom: 12 }}>
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
                <span className="detail-value">{doc.uploadedBy || "—"}</span>
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
                <span className="detail-value">{doc.versionLabel || "—"}</span>
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
                <span className="detail-value" style={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-all", color: "#6b7280" }}>{doc.contentHash}</span>
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
          </div>
        </div>

        {/* Health flags */}
        {doc.healthFlags.length > 0 && (
          <div className="panel" style={{ marginBottom: 20, borderColor: "#fde68a" }}>
            <h2>Health check flags</h2>
            <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 14 }}>
              The following placeholder or review markers were detected in the extracted text. Review before relying on this document.
            </p>
            {Object.entries(flagsByMarker).map(([key, flags]) => (
              <div key={key} style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                  ⚠ {markerLabel[key] || key}
                  <span style={{ marginLeft: 8, fontWeight: 400, color: "#6b7280", fontSize: 12 }}>({flags.length} occurrence{flags.length !== 1 ? "s" : ""})</span>
                </div>
                {flags.slice(0, 3).map((f, i) => (
                  <div key={i} style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 5, padding: "8px 12px", marginBottom: 6, fontFamily: "monospace", fontSize: 12, color: "#92400e" }}>
                    {f.context}
                  </div>
                ))}
                {flags.length > 3 && (
                  <div style={{ color: "#9ca3af", fontSize: 12 }}>+{flags.length - 3} more occurrence{flags.length - 3 !== 1 ? "s" : ""}</div>
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
              <span style={{ color: "#6b7280", fontSize: 12 }}>{fullText.length.toLocaleString()} characters</span>
            </div>
            <div style={{
              background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6,
              padding: 16, maxHeight: 480, overflowY: "auto",
              fontFamily: "monospace", fontSize: 12, lineHeight: 1.6,
              whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#374151"
            }}>
              {fullText}
            </div>
          </div>
        )}

        {/* AI Extraction runs */}
        <div className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ margin: 0 }}>AI Extraction runs</h2>
            {hasText && !isArchived && (
              <form action={extract}>
                <button type="submit" className="btn btn-primary btn-sm">Run new extraction</button>
              </form>
            )}
          </div>

          {!hasText && (
            <p style={{ color: "#6b7280", fontSize: 13 }}>
              AI extraction requires extracted text. Upload a PDF or DOCX document with readable content first.
            </p>
          )}

          {hasText && extractionRuns.length === 0 && (
            <p style={{ color: "#6b7280", fontSize: 13 }}>
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
                      <td style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>
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
                      <td style={{ fontSize: 13, color: confirmed > 0 ? "#15803d" : "#6b7280" }}>{confirmed}</td>
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
      </div>
    </AppShell>
  );
}
