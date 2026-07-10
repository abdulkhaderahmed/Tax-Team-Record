import { prisma } from "@/lib/prisma";
import { uploadDocument } from "@/app/actions/documents";
import {
  DOCUMENT_TYPES,
  SENSITIVITY_LEVELS,
  PRIVILEGE_STATUSES,
  RELIANCE_STATUSES,
  SOURCE_CONFIDENCE_LEVELS,
  YES_NO_UNKNOWN,
} from "@/lib/doc-constants";
import Link from "next/link";
import { requireOrg } from "@/lib/auth";


export default async function UploadDocumentPage() {
  const { organisation: org } = await requireOrg();
  const orgId = org.id;

  const [entities, sourceSystems] = await Promise.all([
    prisma.entity.findMany({ where: { organisationId: orgId }, orderBy: { legalName: "asc" } }),
    prisma.sourceSystem.findMany({ where: { organisationId: orgId, status: { not: "Archived" } }, orderBy: { name: "asc" } }),
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
              <label className="form-label">Uploaded by</label>
              <input name="uploadedBy" className="form-input" defaultValue="Alex Smith" />
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

          {/* Reliance */}
          <div className="panel" style={{ marginBottom: 24 }}>
            <h2>Source &amp; reliance</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div className="form-row">
                <label className="form-label">Reliance status</label>
                <select name="relianceStatus" className="form-input" defaultValue="Draft">
                  {RELIANCE_STATUSES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Is authoritative source?</label>
                <select name="isAuthoritativeSource" className="form-input" defaultValue="Unknown">
                  {YES_NO_UNKNOWN.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Source confidence</label>
                <select name="sourceConfidence" className="form-input" defaultValue="Unknown">
                  {SOURCE_CONFIDENCE_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
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