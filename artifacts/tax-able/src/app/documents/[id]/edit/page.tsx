import { prisma } from "@/lib/prisma";
import { updateDocument } from "@/app/actions/documents";
import { DOCUMENT_TYPES } from "@/lib/doc-constants";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDocumentAccess } from "@/lib/authz";


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
  const { context } = await requireDocumentAccess(id, "edit");
  const orgId = context.orgId;
  const [doc, entities, sourceSystems] = await Promise.all([
    prisma.document.findFirst({ where: { id, organisationId: orgId, deletedAt: null } }),
    prisma.entity.findMany({ where: { organisationId: orgId }, orderBy: { legalName: "asc" } }),
    prisma.sourceSystem.findMany({ where: { organisationId: orgId, status: { not: "Archived" } }, orderBy: { name: "asc" } }),
  ]);
  if (!doc) notFound();

  const save = updateDocument.bind(null, id);

  return (
    <>
      <div style={{ padding: "28px 32px", maxWidth: 820 }}>
        <div style={{ marginBottom: 20 }}>
          <Link href={`/documents/${id}`} style={{ color: "var(--ink-secondary)", fontSize: 13 }}>← {doc.filename}</Link>
        </div>
        <h1>Edit Document Metadata</h1>
        <p style={{ color: "var(--ink-secondary)", marginBottom: 24 }}>
          File cannot be replaced — to update the file, archive this document and upload a new version.
        </p>

        <form action={save}>
          {/* Classification */}
          <div className="panel" style={{ marginBottom: 20 }}>
            <h2>Document classification</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="form-row">
                <label className="form-label">Document type <span style={{ color: "var(--overdue)" }}>*</span></label>
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

          <div className="alert alert-info" style={{ marginBottom: 24 }}>
            Access restrictions and security classifications are controlled on the document page by an access manager. Source authority and reliance are decided there by an independent reviewer.
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" className="btn btn-primary">Save changes</button>
            <Link href={`/documents/${id}`} className="btn">Cancel</Link>
          </div>
        </form>
      </div>
    </>
  );
}
