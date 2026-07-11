import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { redactAuditEventForRestrictedDocuments } from "@/lib/audit";
import { canUseDocumentPermission } from "@/lib/authz-policy";

function json(value: unknown) {
  return value == null ? "—" : JSON.stringify(value, null, 2);
}

export default async function AuditHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ objectType?: string; action?: string }>;
}) {
  const context = await requirePermission("audit:read");
  const filters = await searchParams;
  const where: Prisma.AuditEventWhereInput = {
    organisationId: context.orgId,
    ...(filters.objectType ? { objectType: filters.objectType } : {}),
    ...(filters.action ? { action: { contains: filters.action, mode: "insensitive" } } : {}),
  };
  const [rawEvents, objectTypes, restrictedDocuments] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.auditEvent.findMany({
      where: { organisationId: context.orgId, objectType: { not: null } },
      distinct: ["objectType"],
      select: { objectType: true },
      orderBy: { objectType: "asc" },
    }),
    prisma.document.findMany({
      where: { organisationId: context.orgId, restrictedAccess: true },
      select: {
        id: true,
        filename: true,
        accessGrants: {
          where: {
            organisationId: context.orgId,
            userId: context.userId,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          select: { permission: true },
          take: 1,
        },
      },
    }),
  ]);
  const inaccessibleDocuments = restrictedDocuments
    .filter(
      (document) =>
        !canUseDocumentPermission(
          context.user.role,
          true,
          document.accessGrants[0]?.permission,
          "view",
        ),
    )
    .map(({ id, filename }) => ({ id, filename }));
  const events = rawEvents.map((event) =>
    redactAuditEventForRestrictedDocuments(event, inaccessibleDocuments),
  );

  return (
    <>
      <div className="page-header">
        <div><div className="breadcrumb"><Link href="/">Dashboard</Link> / Audit history</div><h1>Audit history</h1></div>
        <span className="badge badge-grey">Append-only view · latest 200</span>
      </div>

      <form className="panel form-grid" method="get">
        <div className="form-group"><label>Object type</label><select name="objectType" defaultValue={filters.objectType ?? ""}><option value="">All objects</option>{objectTypes.map((row) => row.objectType ? <option key={row.objectType} value={row.objectType}>{row.objectType}</option> : null)}</select></div>
        <div className="form-group"><label>Action contains</label><input name="action" defaultValue={filters.action ?? ""} /></div>
        <div className="flex gap8"><button className="btn btn-primary">Filter</button><Link href="/audit" className="btn btn-secondary">Clear</Link></div>
      </form>

      <div className="panel">
        {events.length === 0 ? <p className="text-muted">No audit events match this filter.</p> : (
          <div className="table-scroll"><table className="data-table" style={{ minWidth: 1100 }}>
            <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Object</th><th>Reason / detail</th><th>Change snapshots</th></tr></thead>
            <tbody>{events.map((event) => (
              <tr key={event.id}>
                <td className="text-sm">{event.createdAt.toLocaleString("en-GB")}</td>
                <td className="text-sm">{event.user ? `${event.user.name} (${event.user.id})` : event.actorNameSnapshot ? `${event.actorNameSnapshot} (legacy snapshot)` : "System"}<div className="text-muted">{event.actorEmailSnapshot ?? event.user?.email ?? ""}</div></td>
                <td><strong>{event.action}</strong><div className="text-muted text-sm">{event.correlationId ?? ""}</div></td>
                <td className="text-sm">{event.objectType ?? "—"}<div className="text-muted">{event.objectId ?? "—"}</div></td>
                <td className="text-sm">{event.reason ?? event.detail ?? "—"}</td>
                <td>{event.beforeJson != null || event.afterJson != null ? <details><summary className="btn btn-secondary btn-sm">Inspect</summary><div className="form-grid" style={{ marginTop: 8 }}><pre style={{ whiteSpace: "pre-wrap", fontSize: 11 }}>Before\n{json(event.beforeJson)}</pre><pre style={{ whiteSpace: "pre-wrap", fontSize: 11 }}>After\n{json(event.afterJson)}</pre></div></details> : "—"}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </>
  );
}
