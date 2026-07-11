import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/auth";
import { documentAccessWhere } from "@/lib/authz";
import { createAccountingPeriod } from "@/app/actions/structure";
import { hasPermission } from "@/lib/authz-policy";

export default async function PeriodsPage() {
  const context = await requireOrg();
  const canConfirm = hasPermission(context.user.role, "review:perform");
  const [entities, documents, periods] = await Promise.all([
    prisma.entity.findMany({ where: { organisationId: context.orgId, deletedAt: null }, orderBy: { legalName: "asc" } }),
    prisma.document.findMany({ where: documentAccessWhere(context), select: { id: true, filename: true, versionNumber: true }, orderBy: { uploadedAt: "desc" }, take: 100 }),
    prisma.accountingPeriod.findMany({ where: { organisationId: context.orgId }, include: { entity: true, verifiedBy: { select: { id: true, name: true } } }, orderBy: [{ entity: { legalName: "asc" } }, { ctPeriodStart: "asc" }] }),
  ]);
  const documentById = new Map(documents.map((document) => [document.id, document]));
  return <>
    <div className="page-header"><div><div className="breadcrumb"><Link href="/entities">Entities</Link> / Accounting periods</div><h1>Confirmed accounting periods</h1></div></div>
    {canConfirm && <div className="panel"><h2>Add verified CT period</h2><p className="text-sm text-muted">For a long period of account, add every Corporation Tax accounting period with the same period-of-account start/end. Generation fails closed until the sequence is complete and contiguous.</p><form action={createAccountingPeriod} className="form-grid"><select name="entityId" required><option value="">Entity</option>{entities.map((e) => <option key={e.id} value={e.id}>{e.legalName}</option>)}</select><div className="form-group"><label>Period of account start</label><input name="periodOfAccountStart" type="date" required /></div><div className="form-group"><label>Period of account end</label><input name="periodOfAccountEnd" type="date" required /></div><div className="form-group"><label>CT period start</label><input name="ctPeriodStart" type="date" required /></div><div className="form-group"><label>CT period end</label><input name="ctPeriodEnd" type="date" required /></div><select name="sourceDocumentId"><option value="">No source document</option>{documents.map((d) => <option key={d.id} value={d.id}>{d.filename} · v{d.versionNumber}</option>)}</select><button className="btn btn-primary">Confirm period</button></form></div>}
    <table className="data-table"><thead><tr><th>Entity</th><th>Period of account</th><th>CT accounting period</th><th>Source</th><th>Verified</th></tr></thead><tbody>{periods.map((p) => { const source = p.sourceDocumentId ? documentById.get(p.sourceDocumentId) : null; return <tr key={p.id}><td><Link href={`/entities/${p.entityId}`}>{p.entity.legalName}</Link></td><td>{p.periodOfAccountStart.toISOString().slice(0, 10)} – {p.periodOfAccountEnd.toISOString().slice(0, 10)}</td><td>{p.ctPeriodStart.toISOString().slice(0, 10)} – {p.ctPeriodEnd.toISOString().slice(0, 10)}</td><td>{source ? <Link href={`/documents/${source.id}`}>{source.filename}</Link> : p.sourceDocumentId ? "Restricted source" : "—"}</td><td>{p.verifiedAt?.toISOString().slice(0, 10)} · {p.verifiedBy?.name} ({p.verifiedBy?.id})</td></tr>; })}</tbody></table>
  </>;
}
