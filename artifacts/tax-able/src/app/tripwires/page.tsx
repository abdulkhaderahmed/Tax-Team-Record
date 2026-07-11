import { createTripwire, updateTripwire } from "@/app/actions/controlRegisters";
import {
  CONTROL_FORM_GRID,
  ControlField,
  controlStatusBadge,
  fmtControlDate,
} from "@/components/control-register-ui";
import { requirePermission } from "@/lib/auth";
import { documentAccessWhere } from "@/lib/authz";
import { hasPermission } from "@/lib/authz-policy";
import { TRIPWIRE_STATUSES } from "@/lib/control-register-policy";
import { prisma } from "@/lib/prisma";

export default async function TripwiresPage() {
  const context = await requirePermission("record:read");
  const canWrite = hasPermission(context.user.role, "record:write");
  const [items, entities, documents] = await Promise.all([
    prisma.tripwire.findMany({
      where: { organisationId: context.orgId, archivedAt: null },
      include: {
        entity: { select: { legalName: true } },
      },
      orderBy: [{ status: "asc" }, { reviewDateOrDeadline: "asc" }],
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
          <h1>Tripwire Register</h1>
          <p className="text-sm text-muted">Events that require a tax position or workflow to be revisited.</p>
        </div>
      </div>
      {canWrite && (
        <div className="panel">
          <h2>Add tripwire</h2>
          <form action={createTripwire}>
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
              <ControlField label="Review date">
                <input name="reviewDateOrDeadline" type="date" className="form-input" />
              </ControlField>
              <ControlField label="Review cadence">
                <input name="reviewCadence" className="form-input" placeholder="On event / quarterly" />
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
              <ControlField label="Description" wide>
                <textarea name="description" className="form-input" rows={2} required />
              </ControlField>
              <ControlField label="Trigger event" wide>
                <textarea name="triggerEvent" className="form-input" rows={2} required />
              </ControlField>
              <ControlField label="Disarm condition" wide>
                <input name="disarmCondition" className="form-input" />
              </ControlField>
            </div>
            <button className="btn btn-primary" type="submit">
              Add tripwire
            </button>
          </form>
        </div>
      )}
      <div className="panel">
        <h2>Tripwires ({items.length})</h2>
        {items.length === 0 ? (
          <p className="text-muted">No tripwires recorded.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tripwire</th>
                  <th>Trigger</th>
                  <th>Entity</th>
                  <th>Review</th>
                  <th>Source</th>
                  <th>Status</th>
                  {canWrite && <th>Update</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.description}</td>
                    <td style={{ maxWidth: 360 }}>{item.triggerEvent}</td>
                    <td>{item.entity?.legalName ?? "—"}</td>
                    <td>
                      {fmtControlDate(item.reviewDateOrDeadline)}
                      {item.reviewCadence ? ` · ${item.reviewCadence}` : ""}
                    </td>
                    <td>{item.sourceDocumentId ? (documentById.get(item.sourceDocumentId)?.filename ?? "Restricted source") : "Manual"}</td>
                    <td>
                      <span className={`badge ${controlStatusBadge(item.status)}`}>{item.status}</span>
                    </td>
                    {canWrite && (
                      <td>
                        <form action={updateTripwire.bind(null, item.id)} className="flex gap8">
                          <select name="status" className="form-input" defaultValue={item.status}>
                            {TRIPWIRE_STATUSES.map((value) => (
                              <option key={value}>{value}</option>
                            ))}
                          </select>
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
