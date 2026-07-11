import { createAssumption, updateAssumption } from "@/app/actions/controlRegisters";
import {
  CONTROL_FORM_GRID,
  ControlField,
  controlStatusBadge,
} from "@/components/control-register-ui";
import { documentAccessWhere } from "@/lib/authz";
import { hasPermission } from "@/lib/authz-policy";
import { requirePermission } from "@/lib/auth";
import { ASSUMPTION_STATUSES, RELIANCE_LEVELS } from "@/lib/control-register-policy";
import { prisma } from "@/lib/prisma";

export default async function AssumptionsPage() {
  const context = await requirePermission("record:read");
  const canWrite = hasPermission(context.user.role, "record:write");
  const [items, entities, documents] = await Promise.all([
    prisma.assumption.findMany({
      where: { organisationId: context.orgId, archivedAt: null },
      include: {
        entity: { select: { legalName: true } },
      },
      orderBy: [{ relianceImportance: "desc" }, { updatedAt: "desc" }],
      take: 250,
    }),
    prisma.entity.findMany({
      where: { organisationId: context.orgId },
      select: { id: true, legalName: true },
      orderBy: { legalName: "asc" },
    }),
    prisma.document.findMany({
      where: {
        AND: [documentAccessWhere(context), { status: { not: "Archived" } }],
      },
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
          <h1>Assumption Register</h1>
          <p className="text-sm text-muted">Facts and judgements relied on by the tax team.</p>
        </div>
      </div>

      {canWrite && (
        <div className="panel">
          <h2>Add assumption</h2>
          <form action={createAssumption}>
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
              <ControlField label="Fact category">
                <input name="factCategory" className="form-input" placeholder="e.g. Share valuation" />
              </ControlField>
              <ControlField label="Reliance importance">
                <select name="relianceImportance" className="form-input" defaultValue="Medium">
                  {RELIANCE_LEVELS.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </ControlField>
              <ControlField label="Review cadence">
                <input name="suggestedReviewCadence" className="form-input" placeholder="Quarterly / on transaction" />
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
              <ControlField label="Source page / paragraph">
                <input name="sourcePageParagraph" className="form-input" />
              </ControlField>
              <ControlField label="Assumption" wide>
                <textarea name="assumptionStatement" className="form-input" rows={3} required />
              </ControlField>
              <ControlField label="Condition / caveat" wide>
                <textarea name="conditionText" className="form-input" rows={2} />
              </ControlField>
            </div>
            <button className="btn btn-primary" type="submit">
              Add assumption
            </button>
          </form>
        </div>
      )}

      <div className="panel">
        <h2>Assumptions ({items.length})</h2>
        {items.length === 0 ? (
          <p className="text-muted">No assumptions recorded.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Assumption</th>
                  <th>Entity</th>
                  <th>Reliance</th>
                  <th>Cadence</th>
                  <th>Source</th>
                  <th>Status</th>
                  {canWrite && <th>Update</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td style={{ maxWidth: 440 }}>{item.assumptionStatement}</td>
                    <td>{item.entity?.legalName ?? "—"}</td>
                    <td>
                      <span className={`badge ${item.relianceImportance === "Critical" ? "badge-red" : "badge-grey"}`}>
                        {item.relianceImportance}
                      </span>
                    </td>
                    <td>{item.suggestedReviewCadence ?? "—"}</td>
                    <td>{item.sourceDocumentId ? (documentById.get(item.sourceDocumentId)?.filename ?? "Restricted source") : (item.sourceType ?? "Manual")}</td>
                    <td>
                      <span className={`badge ${controlStatusBadge(item.status)}`}>{item.status}</span>
                    </td>
                    {canWrite && (
                      <td>
                        <form action={updateAssumption.bind(null, item.id)} className="flex gap8">
                          <select name="status" className="form-input" defaultValue={item.status}>
                            {ASSUMPTION_STATUSES.map((value) => (
                              <option key={value}>{value}</option>
                            ))}
                          </select>
                          <select
                            name="relianceImportance"
                            className="form-input"
                            defaultValue={item.relianceImportance}
                          >
                            {RELIANCE_LEVELS.map((value) => (
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
