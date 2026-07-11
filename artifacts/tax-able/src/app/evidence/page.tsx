import { createEvidenceItem, updateEvidenceItem } from "@/app/actions/controlRegisters";
import {
  CONTROL_FORM_GRID,
  ControlField,
  controlStatusBadge,
  fmtControlDate,
} from "@/components/control-register-ui";
import { requirePermission } from "@/lib/auth";
import { documentAccessWhere } from "@/lib/authz";
import { hasPermission } from "@/lib/authz-policy";
import { EVIDENCE_STATUSES } from "@/lib/control-register-policy";
import { prisma } from "@/lib/prisma";

export default async function EvidencePage() {
  const context = await requirePermission("record:read");
  const canWrite = hasPermission(context.user.role, "record:write");
  const canReview = hasPermission(context.user.role, "review:perform");
  const [items, entities, obligations, actions, exceptions, documents, users] =
    await Promise.all([
      prisma.evidenceItem.findMany({
        where: { organisationId: context.orgId },
        include: {
          entity: { select: { legalName: true } },
          obligation: { select: { description: true } },
          action: { select: { description: true } },
          exception: { select: { title: true } },
          owner: { select: { name: true } },
          verifiedBy: { select: { name: true } },
        },
        orderBy: [{ status: "asc" }, { requiredBy: "asc" }],
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
        where: { organisationId: context.orgId, archivedAt: null, deletedAt: null },
        select: { id: true, description: true },
        orderBy: { deadline: "asc" },
        take: 150,
      }),
      prisma.exception.findMany({
        where: { organisationId: context.orgId, status: { in: ["Open", "In progress"] } },
        select: { id: true, title: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.document.findMany({
        where: {
          AND: [documentAccessWhere(context), { status: { not: "Archived" } }],
        },
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
          <h1>Evidence Register</h1>
          <p className="text-sm text-muted">Evidence requirements and the documents that satisfy them.</p>
        </div>
      </div>
      {canWrite && (
        <div className="panel">
          <h2>Add evidence requirement</h2>
          <form action={createEvidenceItem}>
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
              <ControlField label="Evidence type">
                <input name="evidenceType" className="form-input" placeholder="Approval / filing / payment / data" />
              </ControlField>
              <ControlField label="Required by">
                <input name="requiredBy" type="date" className="form-input" />
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
              <ControlField label="Linked exception">
                <select name="exceptionId" className="form-input">
                  <option value="">None</option>
                  {exceptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </ControlField>
              <ControlField label="Evidence document">
                <select name="documentId" className="form-input">
                  <option value="">Not received / none</option>
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
              <ControlField label="Description" wide>
                <textarea name="description" className="form-input" rows={2} />
              </ControlField>
            </div>
            <button className="btn btn-primary" type="submit">
              Add evidence item
            </button>
          </form>
        </div>
      )}
      <div className="panel">
        <h2>Evidence items ({items.length})</h2>
        {items.length === 0 ? (
          <p className="text-muted">No evidence requirements recorded.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: 1050 }}>
              <thead>
                <tr>
                  <th>Evidence</th>
                  <th>Linked record</th>
                  <th>Owner</th>
                  <th>Required by</th>
                  <th>Document</th>
                  <th>Status</th>
                  <th>Verification</th>
                  {(canWrite || canReview) && <th>Independent review / update</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.title}</strong>
                      <div className="text-sm text-muted">{item.description ?? item.evidenceType ?? "—"}</div>
                    </td>
                    <td>
                      {item.obligation?.description ??
                        item.action?.description ??
                        item.exception?.title ??
                        item.entity?.legalName ??
                        "—"}
                    </td>
                    <td>{item.owner?.name ?? "Unassigned"}</td>
                    <td>{fmtControlDate(item.requiredBy)}</td>
                    <td>{item.documentId ? (documentById.get(item.documentId)?.filename ?? "Restricted source") : "—"}</td>
                    <td>
                      <span className={`badge ${controlStatusBadge(item.status)}`}>{item.status}</span>
                    </td>
                    <td>
                      {item.verifiedAt
                        ? `${item.verifiedBy?.name ?? "User"} · ${fmtControlDate(item.verifiedAt)}`
                        : "—"}
                    </td>
                    {(canWrite || canReview) && (
                      <td>
                        {(canReview || (canWrite && !["Verified", "Rejected", "Waived"].includes(item.status))) &&
                        item.status !== "Waived" ? (
                        <form action={updateEvidenceItem.bind(null, item.id)} style={{ minWidth: 240 }}>
                          <select name="status" className="form-input" defaultValue={item.status}>
                            {EVIDENCE_STATUSES.filter((value) =>
                              canReview
                                ? value !== "Waived"
                                : ["Required", "Requested", "Received"].includes(value),
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
                          <input
                            name="verificationNote"
                            className="form-input"
                            defaultValue={item.verificationNote ?? ""}
                            placeholder="Verification note"
                          />
                          <button className="btn btn-secondary btn-sm" type="submit">
                            Save
                          </button>
                        </form>
                        ) : (
                          <span className="text-sm text-muted">Independent review or an Evidence waiver approval is required.</span>
                        )}
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
