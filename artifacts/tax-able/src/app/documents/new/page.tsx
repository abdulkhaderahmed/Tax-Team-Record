import { prisma } from "@/lib/prisma";
import { uploadDocument } from "@/app/actions/documents";
import {
  DOCUMENT_TYPES,
  SENSITIVITY_LEVELS,
  PRIVILEGE_STATUSES,
  YES_NO_UNKNOWN,
} from "@/lib/doc-constants";
import Link from "next/link";
import { requireOrg } from "@/lib/auth";
import { documentAccessWhere } from "@/lib/authz";


export default async function UploadDocumentPage() {
  const context = await requireOrg();
  const orgId = context.orgId;

  const [entities, sourceSystems, priorDocuments] = await Promise.all([
    prisma.entity.findMany({ where: { organisationId: orgId, deletedAt: null }, orderBy: { legalName: "asc" } }),
    prisma.sourceSystem.findMany({ where: { organisationId: orgId, status: { not: "Archived" } }, orderBy: { name: "asc" } }),
    prisma.document.findMany({
      where: { AND: [documentAccessWhere(context, "edit"), { deletedAt: null }] },
      orderBy: { uploadedAt: "desc" },
      select: { id: true, filename: true, versionNumber: true },
      take: 100,
    }),
  ]);

  return (
    <>
      <div style={{ padding: "28px 32px", maxWidth: 820 }}>
        <div style={{ marginBottom: 20 }}>
          <Link href="/documents" style={{ color: "var(--ink-secondary)", fontSize: 13 }}>← Document Vault</Link>
        </div>
        <h1>Upload Document</h1>
        <p style={{ color: "var(--ink-secondary)", marginBottom: 24 }}>
          Accepted formats: PDF, DOCX. Maximum 15 MB. Plain text will be extracted automatically.
        </p>

        <form action={uploadDocument} encType="multipart/form-data">
          {/* File */}
          <div className="panel" style={{ marginBottom: 20 }}>
            <h2>File</h2>
            <div className="form-row">
              <label className="form-label">Document file <span style={{ color: "var(--overdue)" }}>*</span></label>
              <input name="file" type="file" accept=".pdf,.docx" required
                style={{ display: "block", padding: "6px 0", fontSize: 14 }} />
            </div>
            <div className="form-row" style={{ marginBottom: 0 }}>
              <div className="form-hint">
                Uploaded by is recorded automatically as authenticated user {context.user.id}.
              </div>
            </div>
          </div>

          {/* Classification */}
          <div className="panel" style={{ marginBottom: 20 }}>
            <h2>Document classification</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="form-row">
                <label className="form-label">Document type <span style={{ color: "var(--overdue)" }}>*</span></label>
                <select name="documentType" className="form-input" required>
                  <option value="">— select —</option>
                  {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Document date</label>
                <input name="documentDate" type="date" className="form-input" />
              </div>
              <div className="form-row">
                <label className="form-label">Period start</label>
                <input name="periodStart" type="date" className="form-input" />
              </div>
              <div className="form-row">
                <label className="form-label">Period end</label>
                <input name="periodEnd" type="date" className="form-input" />
              </div>
              <div className="form-row">
                <label className="form-label">Adviser / provider name</label>
                <input name="adviserName" className="form-input" placeholder="e.g. Big4 LLP" />
              </div>
              <div className="form-row">
                <label className="form-label">Version label</label>
                <input name="versionLabel" className="form-input" placeholder="e.g. Final, Draft v2" />
              </div>
              <div className="form-row">
                <label className="form-label">Supersedes document</label>
                <select name="supersedesDocumentId" className="form-input">
                  <option value="">— first version —</option>
                  {priorDocuments.map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.filename} · record v{document.versionNumber}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Version notes</label>
                <input name="versionNotes" className="form-input" placeholder="What changed in this version" />
              </div>
              <div className="form-row">
                <label className="form-label">Related entity</label>
                <select name="entityId" className="form-input">
                  <option value="">— not entity-specific —</option>
                  {entities.map((e) => <option key={e.id} value={e.id}>{e.legalName}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Related source system</label>
                <select name="sourceSystemId" className="form-input">
                  <option value="">— none —</option>
                  {sourceSystems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="panel" style={{ marginBottom: 20 }}>
            <h2>Security &amp; sensitivity</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="form-row">
                <label className="form-label">Sensitivity level</label>
                <select name="sensitivityLevel" className="form-input" defaultValue="Low">
                  {SENSITIVITY_LEVELS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Privilege status</label>
                <select name="privilegeStatus" className="form-input" defaultValue="Unknown">
                  {PRIVILEGE_STATUSES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Contains personal data?</label>
                <select name="containsPersonalData" className="form-input" defaultValue="Unknown">
                  {YES_NO_UNKNOWN.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Contains special category data?</label>
                <select name="containsSpecialCategory" className="form-input" defaultValue="Unknown">
                  {YES_NO_UNKNOWN.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Contains payroll data?</label>
                <select name="containsPayrollData" className="form-input" defaultValue="Unknown">
                  {YES_NO_UNKNOWN.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Contains M&amp;A / restructuring data?</label>
                <select name="containsMaData" className="form-input" defaultValue="Unknown">
                  {YES_NO_UNKNOWN.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" name="restrictedAccess" value="true" />
                Restricted access
              </label>
            </div>
          </div>

          <div className="alert alert-info" style={{ marginBottom: 24 }}>
            New uploads always start as Draft with unknown source authority. A different user with document-review permission must approve reliance or authority.
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" className="btn btn-primary">Upload &amp; extract text</button>
            <Link href="/documents" className="btn">Cancel</Link>
          </div>
        </form>
      </div>
    </>
  );
}
