import { createException, updateException } from "@/app/actions/controlRegisters";
import {
  CONTROL_FORM_GRID,
  ControlField,
  controlStatusBadge,
  fmtControlDate,
} from "@/components/control-register-ui";
import { requirePermission } from "@/lib/auth";
import { documentAccessWhere } from "@/lib/authz";
import { hasPermission } from "@/lib/authz-policy";
import {
  EXCEPTION_SEVERITIES,
  EXCEPTION_STATUSES,
} from "@/lib/control-register-policy";
import { prisma } from "@/lib/prisma";

export default async function ExceptionsPage() {
  const context = await requirePermission("record:read");
  const canWrite = hasPermission(context.user.role, "record:write");
  const canReview = hasPermission(context.user.role, "review:perform");
  const documentWhere = documentAccessWhere(context);
  const [
    items,
    entities,
    obligations,
    actions,
    assumptions,
    caveats,
    tripwires,
    documents,
    users,
  ] = await Promise.all([
    prisma.exception.findMany({
      where: { organisationId: context.orgId },
      include: {
        entity: { select: { legalName: true } },
        obligation: { select: { description: true } },
        action: { select: { description: true } },
        assumption: { select: { assumptionStatement: true } },
        caveat: { select: { caveatText: true } },
        tripwire: { select: { description: true } },
        owner: { select: { name: true } },
      },
      orderBy: [{ blocksFiling: "desc" }, { severity: "desc" }, { createdAt: "desc" }],
      take: 250,
    }),
    prisma.entity.findMany({
      where: { organisationId: context.orgId },
      select: { id: true, legalName: true },
      orderBy: { legalName: "asc" },
    }),
    prisma.obligation.findMany({
      where: {
        organisationId: context.orgId,
        archivedAt: null,
        deletedAt: null,
        OR: [{ draftReviewStatus: null }, { draftReviewStatus: "activated" }],
      },
      select: { id: true, description: true },
      orderBy: { filingDeadline: "asc" },
      take: 150,
    }),
    prisma.action.findMany({
      where: {
        organisationId: context.orgId,
        archivedAt: null,
        deletedAt: null,
      },
      select: { id: true, description: true },
      orderBy: { deadline: "asc" },
      take: 150,
    }),
    prisma.assumption.findMany({
      where: { organisationId: context.orgId, archivedAt: null },
      select: { id: true, assumptionStatement: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.caveat.findMany({
      where: { organisationId: context.orgId, archivedAt: null },
      select: { id: true, caveatText: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.tripwire.findMany({
      where: { organisationId: context.orgId, archivedAt: null },
      select: { id: true, description: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.document.findMany({
      where: { AND: [documentWhere, { status: { not: "Archived" } }] },
      select: { id: true, filename: true },
      orderBy: { uploadedAt: "desc" },
      take: 100,
    }),
    prisma.user.findMany({
      where: { organisationId: context.orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const documentById = new Map(documents.map((document) => [document.id, document]));

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Exception Queue</h1>
          <p className="text-sm text-muted">
            Unresolved facts, source conflicts and control failures that may block filing readiness.
          </p>
        </div>
      </div>

      {canWrite && (
        <div className="panel">
          <h2>Raise exception</h2>
          <form action={createException}>
            <div style={CONTROL_FORM_GRID}>
              <ControlField label="Entity">
                <select name="entityId" className="form-input">
                  <option value="">Not entity-specific</option>
                  {entities.map((entity) => (
                    <option key={entity.id} value={entity.id}>
                      {entity.legalName}
                    </option>
                  ))}
                </select>
              </ControlField>
              <ControlField label="Owner">
                <select name="ownerId" className="form-input" required>
                  <option value="">Select owner</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </ControlField>
              <ControlField label="Severity">
                <select name="severity" className="form-input" defaultValue="Medium">
                  {EXCEPTION_SEVERITIES.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </ControlField>
              <ControlField label="Blocks filing readiness">
                <select name="blocksFiling" className="form-input" defaultValue="true">
                  <option value="true">Yes — hard blocker</option>
                  <option value="false">No — track only</option>
                </select>
              </ControlField>
              <ControlField label="Target resolution date">
                <input name="targetResolutionDate" type="date" className="form-input" />
              </ControlField>
              <ControlField label="Linked obligation">
                <select name="obligationId" className="form-input">
                  <option value="">None</option>
                  {obligations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.description.slice(0, 90)}
                    </option>
                  ))}
                </select>
              </ControlField>
              <ControlField label="Linked action">
                <select name="actionId" className="form-input">
                  <option value="">None</option>
                  {actions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.description.slice(0, 90)}
                    </option>
                  ))}
                </select>
              </ControlField>
              <ControlField label="Linked assumption">
                <select name="assumptionId" className="form-input">
                  <option value="">None</option>
                  {assumptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.assumptionStatement.slice(0, 90)}
                    </option>
                  ))}
                </select>
              </ControlField>
              <ControlField label="Linked caveat">
                <select name="caveatId" className="form-input">
                  <option value="">None</option>
                  {caveats.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.caveatText.slice(0, 90)}
                    </option>
                  ))}
                </select>
              </ControlField>
              <ControlField label="Linked tripwire">
                <select name="tripwireId" className="form-input">
                  <option value="">None</option>
                  {tripwires.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.description.slice(0, 90)}
                    </option>
                  ))}
                </select>
              </ControlField>
              <ControlField label="Linked document">
                <select name="documentId" className="form-input">
                  <option value="">None</option>
                  {documents.map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.filename}
                    </option>
                  ))}
                </select>
              </ControlField>
              <ControlField label="Title" wide>
                <input name="title" className="form-input" required />
              </ControlField>
              <ControlField label="Reason / unresolved issue" wide>
                <textarea name="exceptionReason" className="form-input" rows={3} required />
              </ControlField>
            </div>
            <button className="btn btn-primary" type="submit">
              Raise exception
            </button>
          </form>
        </div>
      )}

      <div className="panel">
        <h2>Exceptions ({items.length})</h2>
        {items.length === 0 ? (
          <p className="text-muted">No exceptions recorded.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: 1200 }}>
              <thead>
                <tr>
                  <th>Exception</th>
                  <th>Linked record</th>
                  <th>Owner</th>
                  <th>Severity</th>
                  <th>Resolution target</th>
                  <th>Filing readiness</th>
                  <th>Status</th>
                  {(canWrite || canReview) && <th>Independent resolution / update</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const linked =
                    item.obligation?.description ??
                    item.action?.description ??
                    item.assumption?.assumptionStatement ??
                    item.caveat?.caveatText ??
                    item.tripwire?.description ??
                    (item.documentId ? (documentById.get(item.documentId)?.filename ?? "Restricted source") : null) ??
                    item.entity?.legalName ??
                    "—";
                  return (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.title}</strong>
                        <div className="text-sm text-muted">{item.reason}</div>
                      </td>
                      <td style={{ maxWidth: 300 }}>{linked}</td>
                      <td>{item.owner?.name ?? "Unassigned"}</td>
                      <td>
                        <span
                          className={`badge ${
                            item.severity === "Critical"
                              ? "badge-red"
                              : item.severity === "High"
                                ? "badge-orange"
                                : "badge-grey"
                          }`}
                        >
                          {item.severity}
                        </span>
                      </td>
                      <td>{fmtControlDate(item.targetResolutionDate)}</td>
                      <td>
                        {item.blocksFiling && !["Resolved", "Accepted risk", "Closed"].includes(item.status) ? (
                          <span className="badge badge-red">BLOCKS FILING</span>
                        ) : (
                          <span className="badge badge-grey">No active block</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${controlStatusBadge(item.status)}`}>{item.status}</span>
                      </td>
                      {(canWrite || canReview) && (
                        <td>
                          {canReview || (canWrite && !["Resolved", "Accepted risk", "Closed"].includes(item.status)) ? (
                          <form action={updateException.bind(null, item.id)} style={{ minWidth: 260 }}>
                            <select name="status" className="form-input" defaultValue={item.status}>
                              {EXCEPTION_STATUSES.filter((value) =>
                                canReview
                                  ? true
                                  : ["Open", "In progress"].includes(value),
                              ).map((value) => (
                                <option key={value}>{value}</option>
                              ))}
                            </select>
                            <select name="ownerId" className="form-input" defaultValue={item.ownerId ?? ""}>
                              <option value="">Unassigned</option>
                              {users.map((user) => (
                                <option key={user.id} value={user.id}>
                                  {user.name} ({user.id})
                                </option>
                              ))}
                            </select>
                            <select
                              name="blocksFiling"
                              className="form-input"
                              defaultValue={String(item.blocksFiling)}
                            >
                              <option value="true">Blocks filing</option>
                              <option value="false">Does not block</option>
                            </select>
                            <input
                              name="resolutionNote"
                              className="form-input"
                              defaultValue={item.resolutionNote ?? ""}
                              placeholder="Resolution / risk acceptance note"
                            />
                            <button className="btn btn-secondary btn-sm" type="submit">
                              Save
                            </button>
                          </form>
                          ) : (
                            <span className="text-sm text-muted">Independent reviewer decision required.</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
