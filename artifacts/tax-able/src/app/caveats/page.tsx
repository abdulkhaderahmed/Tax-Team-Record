import { createCaveat, updateCaveat } from "@/app/actions/controlRegisters";
import { CONTROL_FORM_GRID, ControlField, controlStatusBadge } from "@/components/control-register-ui";
import { requirePermission } from "@/lib/auth";
import { documentAccessWhere } from "@/lib/authz";
import { hasPermission } from "@/lib/authz-policy";
import { CAVEAT_STATUSES } from "@/lib/control-register-policy";
import { prisma } from "@/lib/prisma";

export default async function CaveatsPage() {
  const context = await requirePermission("record:read");
  const canWrite = hasPermission(context.user.role, "record:write");
  const [items, entities, documents] = await Promise.all([
    prisma.caveat.findMany({
      where: { organisationId: context.orgId, archivedAt: null },
      include: {
        entity: { select: { legalName: true } },
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 250,
    }),
    prisma.entity.findMany({
      where: { organisationId: context.orgId },
      select: { id: true, legalName: true },
      orderBy: { legalName: "asc" },
    }),
    prisma.document.findMany({
      where: { AND: [documentAccessWhere(context), { status: { not: "Archived" } }] },
      select: { id: true, filename: true },
      orderBy: { uploadedAt: "desc" },
      take: 100,
    }),
  ]);
  const documentById = new Map(documents.map((document) => [document.id, document]));

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Caveat Register</h1>
          <p className="text-sm text-muted">Qualifications that constrain reliance on advice or facts.</p>
        </div>
      </div>
      {canWrite && (
        <div className="panel">
          <h2>Add caveat</h2>
          <form action={createCaveat}>
            <div style={CONTROL_FORM_GRID}>
              <ControlField label="Entity">
                <select name="entityId" className="form-input">
                  <option value="">Group-wide / not assigned</option>
                  {entities.map((entity) => (
                    <option key={entity.id} value={entity.id}>
                      {entity.legalName}
                    </option>
                  ))}
                </select>
              </ControlField>
              <ControlField label="Related topic">
                <input name="relatedTopic" className="form-input" />
              </ControlField>
              <ControlField label="Source document">
                <select name="sourceDocumentId" className="form-input">
                  <option value="">Manual / none</option>
                  {documents.map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.filename}
                    </option>
                  ))}
                </select>
              </ControlField>
              <ControlField label="Page / paragraph">
                <input name="sourcePageParagraph" className="form-input" />
              </ControlField>
              <ControlField label="Caveat" wide>
                <textarea name="caveatText" className="form-input" rows={3} required />
              </ControlField>
              <ControlField label="Impact if unresolved" wide>
                <textarea name="impactIfUnresolved" className="form-input" rows={2} />
              </ControlField>
            </div>
            <button className="btn btn-primary" type="submit">
              Add caveat
            </button>
          </form>
        </div>
      )}
      <div className="panel">
        <h2>Caveats ({items.length})</h2>
        {items.length === 0 ? (
          <p className="text-muted">No caveats recorded.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Caveat</th>
                  <th>Entity</th>
                  <th>Impact</th>
                  <th>Source</th>
                  <th>Status</th>
                  {canWrite && <th>Resolve / update</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td style={{ maxWidth: 420 }}>{item.caveatText}</td>
                    <td>{item.entity?.legalName ?? "—"}</td>
                    <td>{item.impactIfUnresolved ?? "—"}</td>
                    <td>{item.sourceDocumentId ? (documentById.get(item.sourceDocumentId)?.filename ?? "Restricted source") : "Manual"}</td>
                    <td>
                      <span className={`badge ${controlStatusBadge(item.status)}`}>{item.status}</span>
                    </td>
                    {canWrite && (
                      <td>
                        <form action={updateCaveat.bind(null, item.id)} style={{ minWidth: 240 }}>
                          <select name="status" className="form-input" defaultValue={item.status}>
                            {CAVEAT_STATUSES.map((value) => (
                              <option key={value}>{value}</option>
                            ))}
                          </select>
                          <input
                            name="resolutionNote"
                            className="form-input"
                            defaultValue={item.resolutionNote ?? ""}
                            placeholder="Resolution note"
                          />
                          <button className="btn btn-secondary btn-sm" type="submit">
                            Save
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
