import {
  createDataRequest,
  updateDataRequest,
} from "@/app/actions/controlRegisters";
import {
  CONTROL_FORM_GRID,
  ControlField,
  controlStatusBadge,
  fmtControlDate,
} from "@/components/control-register-ui";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/authz-policy";
import { DATA_REQUEST_STATUSES } from "@/lib/control-register-policy";
import { prisma } from "@/lib/prisma";

export default async function DataRequestsPage() {
  const context = await requirePermission("record:read");
  const canWrite = hasPermission(context.user.role, "record:write");
  const canReview = hasPermission(context.user.role, "review:perform");
  const [items, entities, obligations, actions, parties, users] =
    await Promise.all([
      prisma.dataRequest.findMany({
        where: { organisationId: context.orgId },
        include: {
          entity: { select: { legalName: true } },
          obligation: { select: { description: true } },
          action: { select: { description: true } },
          requestedFromParty: { select: { name: true, organisationOrTeam: true } },
          assignedTo: { select: { name: true } },
          reminders: {
            where: { status: { in: ["Scheduled", "Due"] } },
            orderBy: { scheduledFor: "asc" },
          },
        },
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
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
      prisma.party.findMany({
        where: { organisationId: context.orgId },
        select: { id: true, name: true, organisationOrTeam: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: { organisationId: context.orgId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Data Requests</h1>
          <p className="text-sm text-muted">
            Requests to Finance, Payroll, HR, Legal and other data owners, with reminders and escalation.
          </p>
        </div>
      </div>
      {canWrite && (
        <div className="panel">
          <h2>Create data request</h2>
          <form action={createDataRequest}>
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
              <ControlField label="Requested from party">
                <select name="requestedFromPartyId" className="form-input">
                  <option value="">Use department instead</option>
                  {parties.map((party) => (
                    <option key={party.id} value={party.id}>
                      {party.name}
                      {party.organisationOrTeam ? ` · ${party.organisationOrTeam}` : ""}
                    </option>
                  ))}
                </select>
              </ControlField>
              <ControlField label="Requested from department">
                <input
                  name="requestedFromDepartment"
                  className="form-input"
                  placeholder="Finance / Payroll / Legal / HR"
                />
              </ControlField>
              <ControlField label="Assigned tax-team owner">
                <select name="assignedToId" className="form-input">
                  <option value="">Requester owns it</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
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
              <ControlField label="Due date">
                <input name="dueDate" type="date" className="form-input" required />
              </ControlField>
              <ControlField label="Reminder date">
                <input name="reminderDate" type="date" className="form-input" />
              </ControlField>
              <ControlField label="Escalation date">
                <input name="escalationDate" type="date" className="form-input" />
              </ControlField>
              <ControlField label="Request" wide>
                <textarea name="description" className="form-input" rows={3} required />
              </ControlField>
            </div>
            <button className="btn btn-primary" type="submit">
              Create request
            </button>
          </form>
        </div>
      )}
      <div className="panel">
        <h2>Requests ({items.length})</h2>
        {items.length === 0 ? (
          <p className="text-muted">No data requests recorded.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: 1150 }}>
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Requested from</th>
                  <th>Owner</th>
                  <th>Linked record</th>
                  <th>Due</th>
                  <th>Reminder / escalation</th>
                  <th>Status</th>
                  {(canWrite || canReview) && <th>Review / update</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td style={{ maxWidth: 360 }}>{item.description}</td>
                    <td>
                      {item.requestedFromParty?.name ?? item.requestedFromDepartment ?? "—"}
                    </td>
                    <td>{item.assignedTo?.name ?? "Requester"}</td>
                    <td>
                      {item.obligation?.description ??
                        item.action?.description ??
                        item.entity?.legalName ??
                        "—"}
                    </td>
                    <td>{fmtControlDate(item.dueDate)}</td>
                    <td>
                      {item.reminders.length === 0
                        ? "—"
                        : item.reminders
                            .map(
                              (reminder) =>
                                `${reminder.reminderType}: ${fmtControlDate(reminder.scheduledFor)}`,
                            )
                            .join(" · ")}
                    </td>
                    <td>
                      <span className={`badge ${controlStatusBadge(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    {(canWrite || canReview) && (
                      <td>
                        {canReview || (canWrite && !["Validated", "Cancelled"].includes(item.status)) ? (
                        <form
                          action={updateDataRequest.bind(null, item.id)}
                          style={{ minWidth: 250 }}
                        >
                          <select name="status" className="form-input" defaultValue={item.status}>
                            {DATA_REQUEST_STATUSES.filter((value) =>
                              canReview
                                ? true
                                : ["Draft", "Open", "Received"].includes(value),
                            ).map((value) => (
                              <option key={value}>{value}</option>
                            ))}
                          </select>
                          <select
                            name="assignedToId"
                            className="form-input"
                            defaultValue={item.assignedToId ?? ""}
                          >
                            <option value="">Requester owns it</option>
                            {users.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.name} ({user.id})
                              </option>
                            ))}
                          </select>
                          <input
                            name="responseNote"
                            className="form-input"
                            defaultValue={item.responseNote ?? ""}
                            placeholder="Response / validation note"
                          />
                          <button className="btn btn-secondary btn-sm" type="submit">
                            Save
                          </button>
                        </form>
                        ) : (
                          <span className="text-sm text-muted">Reviewer-controlled outcome.</span>
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
