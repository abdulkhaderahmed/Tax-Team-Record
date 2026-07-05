import { AppShell } from "@/components/nav";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

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

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "Text extracted" ? "badge-green" :
    status === "Extraction failed" ? "badge-red" :
    status === "Archived" ? "badge-grey" : "badge-blue";
  return <span className={`badge ${cls}`}>{status}</span>;
}

function SensitivityBadge({ level }: { level: string }) {
  const cls =
    level === "Highly confidential" ? "badge-purple" :
    level === "High" ? "badge-red" :
    level === "Medium" ? "badge-yellow" : "badge-grey";
  return <span className={`badge ${cls}`}>{level}</span>;
}

function PrivilegeBadge({ status }: { status: string }) {
  if (status === "Not privileged") return <span className="badge badge-grey">{status}</span>;
  if (status === "Legally privileged") return <span className="badge badge-purple">{status}</span>;
  if (status === "Potentially privileged") return <span className="badge badge-yellow">{status}</span>;
  return <span className="badge badge-grey">{status}</span>;
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const filterType = sp.type || "";
  const filterEntity = sp.entity || "";
  const filterStatus = sp.status || "";

  const [documents, entities] = await Promise.all([
    prisma.document.findMany({
      where: {
        organisationId: ORG_ID,
        ...(filterType ? { documentType: filterType } : {}),
        ...(filterEntity ? { entityId: filterEntity } : {}),
        ...(filterStatus ? { status: filterStatus } : {}),
      },
      include: { entity: { select: { legalName: true } } },
      orderBy: { uploadedAt: "desc" },
    }),
    prisma.entity.findMany({ where: { organisationId: ORG_ID }, orderBy: { legalName: "asc" } }),
  ]);

  const totalHealthFlags = documents.length > 0
    ? await prisma.documentHealthFlag.count({ where: { documentId: { in: documents.map((d) => d.id) } } })
    : 0;

  return (
    <AppShell>
      <div style={{ padding: "28px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: "0 0 4px" }}>Document Vault</h1>
            <p style={{ margin: 0, color: "#6b7280", fontSize: 13 }}>
              {documents.length} document{documents.length !== 1 ? "s" : ""}
              {totalHealthFlags > 0 && (
                <span style={{ marginLeft: 10, color: "#b45309" }}>· {totalHealthFlags} health flag{totalHealthFlags !== 1 ? "s" : ""} detected</span>
              )}
            </p>
          </div>
          <Link href="/documents/new" className="btn btn-primary">Upload Document</Link>
        </div>

        {/* Filters */}
        <form method="GET" style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <select name="type" className="form-input" style={{ width: "auto" }} defaultValue={filterType}>
            <option value="">All types</option>
            {["Adviser tax memo","Adviser proposal","Steps paper","Valuation report","R&D report","R&D claim schedule","Capital allowances analysis","Fixed asset register","CT computation","CT600 draft/final","VAT return","ERS return","EMI return","P11D/P11D(b)","PSA calculation","Payroll report","HR report","Cap table","Legal agreement","Board minutes/approval","HMRC correspondence","Filing confirmation","Payment evidence","Other"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select name="entity" className="form-input" style={{ width: "auto" }} defaultValue={filterEntity}>
            <option value="">All entities</option>
            {entities.map((e) => <option key={e.id} value={e.id}>{e.legalName}</option>)}
          </select>
          <select name="status" className="form-input" style={{ width: "auto" }} defaultValue={filterStatus}>
            <option value="">All statuses</option>
            {["Uploaded", "Text extracted", "Extraction failed", "Archived"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button type="submit" className="btn">Filter</button>
          {(filterType || filterEntity || filterStatus) && (
            <Link href="/documents" className="btn">Clear</Link>
          )}
        </form>

        {documents.length === 0 ? (
          <div className="panel" style={{ textAlign: "center", padding: 48 }}>
            <p style={{ color: "#6b7280", marginBottom: 16 }}>
              {filterType || filterEntity || filterStatus
                ? "No documents match the selected filters."
                : "No documents uploaded yet."}
            </p>
            {!filterType && !filterEntity && !filterStatus && (
              <Link href="/documents/new" className="btn btn-primary">Upload your first document</Link>
            )}
          </div>
        ) : (
          <div className="panel">
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Filename</th>
                    <th>Type</th>
                    <th>Entity</th>
                    <th>Sensitivity</th>
                    <th>Privilege</th>
                    <th>Reliance</th>
                    <th>Size</th>
                    <th>Uploaded</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} style={doc.status === "Archived" ? { opacity: 0.55 } : {}}>
                      <td>
                        <strong style={{ fontFamily: "monospace", fontSize: 12 }}>{doc.filename}</strong>
                        {doc.versionLabel && (
                          <span style={{ marginLeft: 6, color: "#6b7280", fontSize: 11 }}>v{doc.versionLabel}</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12 }}>{doc.documentType}</td>
                      <td style={{ fontSize: 12 }}>{doc.entity?.legalName || <span style={{ color: "#9ca3af" }}>—</span>}</td>
                      <td><SensitivityBadge level={doc.sensitivityLevel} /></td>
                      <td><PrivilegeBadge status={doc.privilegeStatus} /></td>
                      <td>
                        <span className={`badge ${doc.relianceStatus === "Approved for reliance" ? "badge-green" : doc.relianceStatus === "Do not rely" || doc.relianceStatus === "Superseded" ? "badge-red" : "badge-yellow"}`}>
                          {doc.relianceStatus}
                        </span>
                      </td>
                      <td style={{ color: "#6b7280", fontSize: 12 }}>{bytes(doc.fileSize)}</td>
                      <td style={{ color: "#6b7280", fontSize: 12, whiteSpace: "nowrap" }}>{fmt(doc.uploadedAt)}</td>
                      <td><StatusBadge status={doc.status} /></td>
                      <td>
                        <Link href={`/documents/${doc.id}`} className="btn">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
