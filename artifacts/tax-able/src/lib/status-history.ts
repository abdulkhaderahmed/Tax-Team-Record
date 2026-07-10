import { prisma } from "./prisma";

export type TrackedObjectType = "ManualObligation" | "Action";

const AUDIT_ACTION_MAP: Record<string, string> = {
  responsibleOwner: "responsible_owner_changed",
  accountableOwner: "accountable_owner_changed",
  consultedParty: "consulted_parties_changed",
  informedParty: "informed_parties_changed",
  externalAdviser: "external_adviser_changed",
  externalOperationalOwner: "external_operational_owner_changed",
  responsibleParty: "responsible_owner_changed",
  accountableParty: "accountable_owner_changed",

  dataCompletenessStatus: "status_changed",
  dataValidationStatus: "status_changed",
  technicalReviewStatus: "status_changed",
  approvalStatus: "status_changed",
  workflowProgressStatus: "status_changed",
  evidenceStatus: "status_changed",
  filingSubmissionStatus: "status_changed",
  paymentStatus: "status_changed",
  overallWorkflowStatus: "status_changed",
  overallStatus: "status_changed",

  dataCollectionRequired: "requirement_flag_changed",
  dataValidationRequired: "requirement_flag_changed",
  technicalReviewRequired: "requirement_flag_changed",
  accountableApprovalRequired: "requirement_flag_changed",
  evidenceRequired: "requirement_flag_changed",
  filingSubmissionRequired: "requirement_flag_changed",
  paymentRequired: "requirement_flag_changed",
};

function normalize(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/**
 * Diffs `before`/`after` on the given fields, writing a StatusHistory row and
 * a matching AuditEvent for every field that actually changed. Call this
 * after the record has already been saved.
 */
export async function recordFieldChanges(params: {
  objectType: TrackedObjectType;
  objectId: string;
  organisationId: string;
  entityId: string | null;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  fields: string[];
  changedBy: string | null;
  reason?: string | null;
}) {
  const { objectType, objectId, organisationId, entityId, before, after, fields, changedBy, reason } = params;

  for (const field of fields) {
    const oldValue = normalize(before[field]);
    const newValue = normalize(after[field]);
    if (oldValue === newValue) continue;

    await prisma.statusHistory.create({
      data: { objectType, objectId, statusField: field, oldValue, newValue, changedBy, reason: reason ?? null },
    });

    await prisma.auditEvent.create({
      data: {
        organisationId,
        entityId,
        manualObligationId: objectType === "ManualObligation" ? objectId : undefined,
        actionId: objectType === "Action" ? objectId : undefined,
        action: AUDIT_ACTION_MAP[field] ?? "field_changed",
        detail: `${field} changed from "${oldValue ?? "—"}" to "${newValue ?? "—"}"${reason ? ` — ${reason}` : ""}`,
      },
    });
  }
}

export async function recordOverallStatusRecalculated(params: {
  objectType: TrackedObjectType;
  objectId: string;
  organisationId: string;
  entityId: string | null;
  computedStatus: string;
  storedStatus: string;
  wasOverridden: boolean;
}) {
  const { objectType, objectId, organisationId, entityId, computedStatus, storedStatus, wasOverridden } = params;
  await prisma.auditEvent.create({
    data: {
      organisationId,
      entityId,
      manualObligationId: objectType === "ManualObligation" ? objectId : undefined,
      actionId: objectType === "Action" ? objectId : undefined,
      action: "overall_status_recalculated",
      detail: wasOverridden
        ? `Computed overall status was "${computedStatus}" but reviewer overrode it to "${storedStatus}".`
        : `Overall status recalculated to "${computedStatus}".`,
    },
  });

  if (wasOverridden && computedStatus !== "Complete" && storedStatus === "Complete") {
    await prisma.auditEvent.create({
      data: {
        organisationId,
        entityId,
        manualObligationId: objectType === "ManualObligation" ? objectId : undefined,
        actionId: objectType === "Action" ? objectId : undefined,
        action: "completion_blocked_by_missing_status",
        detail: `Overall status was manually set to "Complete" despite outstanding requirements (computed status: "${computedStatus}").`,
      },
    });
  }
}
