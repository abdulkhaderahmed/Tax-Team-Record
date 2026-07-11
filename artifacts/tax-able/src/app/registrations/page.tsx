import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/auth";
import { createTaxRegistration } from "@/app/actions/structure";
import { hasPermission } from "@/lib/authz-policy";

export default async function RegistrationsPage() {
  const context = await requireOrg();
  const orgId = context.orgId;
  const canWrite = hasPermission(context.user.role, "entity:write");
  const canVerify = hasPermission(context.user.role, "review:perform");
  const [entities, registrations] = await Promise.all([
    prisma.entity.findMany({ where: { organisationId: orgId, deletedAt: null }, orderBy: { legalName: "asc" } }),
    prisma.taxRegistration.findMany({ where: { organisationId: orgId }, include: { entity: true, sourceVerifiedBy: { select: { id: true, name: true } } }, orderBy: [{ entity: { legalName: "asc" } }, { registrationType: "asc" }] }),
  ]);
  return <>
    <div className="page-header"><div><div className="breadcrumb"><Link href="/entities">Entities</Link> / Tax registrations</div><h1>Tax registrations</h1></div></div>
    {canWrite && <div className="panel"><h2>Add registration</h2><form action={createTaxRegistration} className="form-grid"><select name="entityId" required><option value="">Entity</option>{entities.map((e) => <option key={e.id} value={e.id}>{e.legalName}</option>)}</select><select name="registrationType" required><option>Corporation Tax</option><option>VAT</option><option>PAYE</option><option>ERS</option><option>Pillar 2</option><option>FATCA</option><option>CRS</option><option>Other</option></select><input name="reference" placeholder="Registration reference" /><input name="jurisdiction" defaultValue="United Kingdom" /><select name="status" defaultValue="Active"><option>Active</option><option>Pending</option><option>Cancelled</option></select><input name="effectiveFrom" type="date" /><input name="effectiveTo" type="date" />{canVerify && <label className="checkbox-row"><input name="verified" type="checkbox" /> Source verified now</label>}<textarea name="notes" placeholder="Notes" /><button className="btn btn-primary">Add registration</button></form></div>}
    <table className="data-table"><thead><tr><th>Entity</th><th>Registration</th><th>Reference</th><th>Status</th><th>Effective</th><th>Verification</th></tr></thead><tbody>{registrations.map((r) => <tr key={r.id}><td><Link href={`/entities/${r.entityId}`}>{r.entity.legalName}</Link></td><td>{r.registrationType}</td><td>{r.reference ?? "—"}</td><td>{r.status}</td><td>{r.effectiveFrom?.toISOString().slice(0, 10) ?? "—"} – {r.effectiveTo?.toISOString().slice(0, 10) ?? "open"}</td><td>{r.sourceVerifiedAt ? `${r.sourceVerifiedAt.toISOString().slice(0, 10)} · ${r.sourceVerifiedBy?.name} (${r.sourceVerifiedBy?.id})` : "Not verified"}</td></tr>)}</tbody></table>
  </>;
}
