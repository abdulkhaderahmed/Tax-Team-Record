import { AppShell } from "@/components/nav";
import { prisma } from "@/lib/prisma";
import { updateDocument } from "@/app/actions/documents";
import {
  DOCUMENT_TYPES,
  SENSITIVITY_LEVELS,
  PRIVILEGE_STATUSES,
  RELIANCE_STATUSES,
  SOURCE_CONFIDENCE_LEVELS,
  YES_NO_UNKNOWN,
} from "@/lib/doc-constants";
import Link from "next/link";
import { notFound } from "next/navigation";

const ORG_ID = "demo-org";

function dateVal(d: Date | null) {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export default async function EditDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [doc, entities, sourceSystems] = await Promise.all([
    prisma.document.findUnique({ where: { id } }),
    prisma.entity.findMany({ where: { organisationId: ORG_ID }, orderBy: { legalName: "asc" } }),
    prisma.sourceSystem.findMany({ where: { organisationId: ORG_ID, status: { not: "Archived" } }, orderBy: { name: "asc" } }),
  ]);
  if (!doc || doc.organisationId !== ORG_ID) notFound();

  const save = updateDocument.bind(null, id);

  return (
    <AppShell>
      <div style={{ padding: "28px 32px", maxWidth: 820 }}>
        <div style={{ marginBottom: 20 }}>
          <Link href={`/documents/${id}`} style={{ color: "#6b7280", fontSize: 13 }}>← {doc.filename}</Link>
        </div>
        <h1>Edit Document Metadata</h1>
        <p style={{ color: "#6b7280", marginBottom: 24 }}>
          File cannot be replaced — to update the file, archive this document and upload a new version.
        </p>

        <form action={save}>
          {/* Classification */}
          <div className="panel" style={{ marginBottom: 20 }}>
            <h2>Document classification</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="form-row">
                <label className="form-label">Document type <span style={{ color: "#b91c1c" }}>*</span></label>
                <select name="documentType" className="form-input" required defaultValue={doc.documentType}>
                  {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Document date</label>
                <input name="documentDate" type="date" className="form-input" defaultValue={dateVal(doc.documentDate)} />
              </div>
              <div className="form-row">
                <label className="form-label">Period start</label>
                <input name="periodStart" type="date" className="form-input" defaultValue={dateVal(doc.periodStart)} />
              </div>
              <div className="form-row">
                <label className="form-label">Period end</label>
                <input name="periodEnd" type="date" className="form-input" defaultValue={dateVal(doc.periodEnd)} />
              </div>
              <div className="form-row">
                <label className="form-label">Adviser / provider name</label>
                <input name="adviserName" className="form-input" defaultValue={doc.adviserName ?? ""} />
              </div>
              <div className="form-row">
                <label className="form-label">Version label</label>
                <input name="versionLabel" className="form-input" defaultValue={doc.versionLabel ?? ""} />
              </div>
              <div className="form-row">
                <label className="form-label">Related entity</label>
                <select name="entityId" className="form-input" defaultValue={doc.entityId ?? ""}>
                  <option value="">— not entity-specific —</option>
                  {entities.map((e) => <option key={e.id} value={e.id}>{e.legalName}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Related source system</label>
                <select name="sourceSystemId" className="form-input" defaultValue={doc.sourceSystemId ?? ""}>
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
                <select name="sensitivityLevel" className="form-input" defaultValue={doc.sensitivityLevel}>
                  {SENSITIVITY_LEVELS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Privilege status</label>
                <select name="privilegeStatus" className="form-input" defaultValue={doc.privilegeStatus}>
                  {PRIVILEGE_STATUSES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Contains personal data?</label>
                <select name="containsPersonalData" className="form-input" defaultValue={doc.containsPersonalData}>
                  {YES_NO_UNKNOWN.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Contains special category data?</label>
                <select name="containsSpecialCategory" className="form-input" defaultValue={doc.containsSpecialCategory}>
                  {YES_NO_UNKNOWN.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Contains payroll data?</label>
                <select name="containsPayrollData" className="form-input" defaultValue={doc.containsPayrollData}>
                  {YES_NO_UNKNOWN.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Contains M&amp;A / restructuring data?</label>
                <select name="containsMaData" className="form-input" defaultValue={doc.containsMaData}>
                  {YES_NO_UNKNOWN.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 4, marginBottom: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" name="restrictedAccess" value="true" defaultChecked={doc.restrictedAccess} />
                Restricted access
              </label>
            </div>
            <div className="form-row" style={{ marginBottom: 0 }}>
              <label className="form-label">Access notes</label>
              <textarea name="accessNotes" className="form-input" rows={2} defaultValue={doc.accessNotes ?? ""} />
            </div>
          </div>

          {/* Reliance */}
          <div className="panel" style={{ marginBottom: 24 }}>
            <h2>Source &amp; reliance</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div className="form-row">
                <label className="form-label">Reliance status</label>
                <select name="relianceStatus" className="form-input" defaultValue={doc.relianceStatus}>
                  {RELIANCE_STATUSES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Is authoritative source?</label>
                <select name="isAuthoritativeSource" className="form-input" defaultValue={doc.isAuthoritativeSource}>
                  {YES_NO_UNKNOWN.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Source confidence</label>
                <select name="sourceConfidence" className="form-input" defaultValue={doc.sourceConfidence}>
                  {SOURCE_CONFIDENCE_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" className="btn btn-primary">Save changes</button>
            <Link href={`/documents/${id}`} className="btn">Cancel</Link>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
