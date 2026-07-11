import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/auth";
import { assignEntityGroup, createEntityGroup, createEntityRelation } from "@/app/actions/structure";

export default async function GroupsPage() {
  const { orgId } = await requireOrg();
  const [groups, entities, relations] = await Promise.all([
    prisma.entityGroup.findMany({ where: { organisationId: orgId }, include: { entities: { where: { deletedAt: null }, orderBy: { legalName: "asc" } } }, orderBy: { name: "asc" } }),
    prisma.entity.findMany({ where: { organisationId: orgId, deletedAt: null }, orderBy: { legalName: "asc" } }),
    prisma.entityRelation.findMany({ where: { organisationId: orgId }, include: { fromEntity: true, toEntity: true }, orderBy: { createdAt: "desc" } }),
  ]);
  return <>
    <div className="page-header"><div><div className="breadcrumb"><Link href="/entities">Entities</Link> / Group structure</div><h1>Group & associated-company structure</h1></div></div>
    <div className="panel"><h2>Create group</h2><form action={createEntityGroup} className="form-grid"><input name="name" required placeholder="Group name" /><input name="associatedCompanyCount" type="number" min="1" defaultValue="1" /><textarea name="description" placeholder="Scope and notes" /><button className="btn btn-primary">Create group</button></form></div>
    <div className="panel"><h2>Assign entity</h2><form action={assignEntityGroup} className="form-grid"><select name="entityId" required><option value="">Entity</option>{entities.map((e) => <option key={e.id} value={e.id}>{e.legalName}</option>)}</select><select name="groupId" required><option value="">Group</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select><button className="btn btn-primary">Assign</button></form></div>
    {groups.map((group) => <div className="panel" key={group.id}><h2>{group.name}</h2><p className="text-sm text-muted">Associated companies including self for QIP: {group.associatedCompanyCount}</p>{group.entities.length ? <ul>{group.entities.map((entity) => <li key={entity.id}><Link href={`/entities/${entity.id}`}>{entity.legalName}</Link></li>)}</ul> : <p className="text-muted">No members assigned.</p>}</div>)}
    <div className="panel"><h2>Effective-dated entity relationship</h2><form action={createEntityRelation} className="form-grid"><select name="fromEntityId" required><option value="">From entity</option>{entities.map((e) => <option key={e.id} value={e.id}>{e.legalName}</option>)}</select><select name="toEntityId" required><option value="">To entity</option>{entities.map((e) => <option key={e.id} value={e.id}>{e.legalName}</option>)}</select><select name="relationType" required><option>Parent</option><option>Subsidiary</option><option>Associated company</option><option>VAT group</option><option>CT group</option><option>Other</option></select><input name="ownershipPct" type="number" min="0" max="100" step="0.0001" placeholder="Ownership %" /><input name="effectiveFrom" type="date" /><input name="effectiveTo" type="date" /><input name="notes" placeholder="Notes" /><button className="btn btn-primary">Add relationship</button></form></div>
    {relations.length > 0 && <table className="data-table"><thead><tr><th>From</th><th>Relationship</th><th>To</th><th>Ownership</th><th>Effective</th></tr></thead><tbody>{relations.map((r) => <tr key={r.id}><td>{r.fromEntity.legalName}</td><td>{r.relationType}</td><td>{r.toEntity.legalName}</td><td>{r.ownershipPct?.toString() ?? "—"}%</td><td>{r.effectiveFrom?.toISOString().slice(0, 10) ?? "—"} – {r.effectiveTo?.toISOString().slice(0, 10) ?? "open"}</td></tr>)}</tbody></table>}
  </>;
}
