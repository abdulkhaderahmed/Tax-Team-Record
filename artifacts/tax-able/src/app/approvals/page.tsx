import { createApproval, decideApproval } from "@/app/actions/controlRegisters";
import {
  CONTROL_FORM_GRID,
  ControlField,
  controlStatusBadge,
  fmtControlDate,
} from "@/components/control-register-ui";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/authz-policy";
import { APPROVAL_GATES } from "@/lib/control-register-policy";
import { prisma } from "@/lib/prisma";

export default async function ApprovalsPage() {
  const context = await requirePermission("record:read");
  const canWrite = hasPermission(context.user.role, "record:write");
  const canApprove = hasPermission(context.user.role, "approval:decide");
  const [items, entities, obligations, actions, orgUsers] = await Promise.all([
    prisma.approval.findMany({
      where: { organisationId: context.orgId },
      include: {
        entity: { select: { legalName: true } },
        obligation: { select: { description: true } },
        action: { select: { description: true } },
        requestedBy: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
        decidedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
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
    prisma.user.findMany({
      where: { organisationId: context.orgId },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const approvers = orgUsers.filter(
    (user) =>
      user.id !== context.userId && hasPermission(user.role, "approval:decide"),
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Approval Gates</h1>
          <p className="text-sm text-muted">
            Independent technical, accountable and filing-release decisions.
          </p>
        </div>
      </div>
      {canWrite && (
        <div className="panel">
          <h2>Request approval</h2>
          <p className="text-sm text-muted">
            Select exactly one obligation or action. The requester cannot be the approver.
          </p>
          <form action={createApproval}>
            <div style={CONTROL_FORM_GRID}>
              <ControlField label="Gate">
                <select name="gate" className="form-input" defaultValue="Accountable approval">
                  {APPROVAL_GATES.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </ControlField>
              <ControlField label="Approver">
                <select name="approverId" className="form-input" required>
                  <option value="">Select independent approver</option>
                  {approvers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.id})
                    </option>
                  ))}
                </select>
              </ControlField>
              <ControlField label="Entity">
                <select name="entityId" className="form-input">
                  <option value="">Derived / not selected</option>
                  {entities.map((entity) => (
                    <option key={entity.id} value={entity.id}>
                      {entity.legalName}
                    </option>
                  ))}
                </select>
              </ControlField>
              <ControlField label="Obligation (choose this or action)">
                <select name="obligationId" className="form-input">
                  <option value="">None</option>
                  {obligations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.description.slice(0, 100)}
                    </option>
                  ))}
                </select>
              </ControlField>
              <ControlField label="Action (choose this or obligation)">
                <select name="actionId" className="form-input">
                  <option value="">None</option>
                  {actions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.description.slice(0, 100)}
                    </option>
                  ))}
                </select>
              </ControlField>
            </div>
            <button className="btn btn-primary" type="submit">
              Request approval
            </button>
          </form>
        </div>
      )}
      <div className="panel">
        <h2>Approvals ({items.length})</h2>
        {items.length === 0 ? (
          <p className="text-muted">No approvals requested.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: 1050 }}>
              <thead>
                <tr>
                  <th>Gate</th>
                  <th>Record</th>
                  <th>Requester</th>
                  <th>Approver</th>
                  <th>Requested</th>
                  <th>Status</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const mayDecide =
                    item.status === "Pending" &&
                    context.userId !== item.requestedById &&
                    canApprove &&
                    (context.userId === item.approverId || context.user.role === "admin");
                  return (
                    <tr key={item.id}>
                      <td>{item.gate}</td>
                      <td>
                        {item.obligation?.description ??
                          item.action?.description ??
                          item.entity?.legalName ??
                          "—"}
                      </td>
                      <td>{item.requestedBy.name} ({item.requestedBy.id})</td>
                      <td>{item.approver.name} ({item.approver.id})</td>
                      <td>{fmtControlDate(item.requestedAt)}</td>
                      <td>
                        <span className={`badge ${controlStatusBadge(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td>
                        {mayDecide ? (
                          <div style={{ minWidth: 260 }}>
                            <form action={decideApproval.bind(null, item.id, "Approved")}>
                              <input
                                name="decisionNote"
                                className="form-input"
                                placeholder="Decision note"
                              />
                              <button className="btn btn-primary btn-sm" type="submit">
                                Approve
                              </button>
                            </form>
                            <form action={decideApproval.bind(null, item.id, "Rejected")}>
                              <input
                                name="decisionNote"
                                className="form-input"
                                placeholder="Reason for rejection"
                                required
                              />
                              <button className="btn btn-danger btn-sm" type="submit">
                                Reject
                              </button>
                            </form>
                          </div>
                        ) : item.decidedAt ? (
                          <span className="text-sm text-muted">
                            {item.decidedBy ? `${item.decidedBy.name} (${item.decidedBy.id})` : "User"} · {fmtControlDate(item.decidedAt)}
                            {item.decisionNote ? ` · ${item.decisionNote}` : ""}
                          </span>
                        ) : (
                          <span className="text-sm text-muted">Awaiting assigned approver</span>
                        )}
                      </td>
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
