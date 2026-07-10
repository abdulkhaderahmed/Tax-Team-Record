"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { computeOverallStatus } from "@/lib/ownership-control";
import { recordFieldChanges, recordOverallStatusRecalculated } from "@/lib/status-history";

const TRACKED_FIELDS = [
  "responsibleParty", "accountableParty", "consultedParty", "informedParty", "externalAdviser", "externalOperationalOwner",
  "dataCompletenessStatus", "dataValidationStatus", "technicalReviewStatus", "approvalStatus",
  "workflowProgressStatus", "evidenceStatus", "filingSubmissionStatus", "paymentStatus", "overallStatus",
  "dataCollectionRequired", "dataValidationRequired", "technicalReviewRequired", "accountableApprovalRequired",
  "evidenceRequired", "filingSubmissionRequired", "paymentRequired",
];

function parseDate(raw: string | null | undefined): Date | null {
  if (!raw || raw.trim() === "") return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function str(formData: FormData, name: string): string | null {
  return (formData.get(name) as string || "").trim() || null;
}

function req(formData: FormData, name: string): string {
  const v = (formData.get(name) as string || "").trim();
  if (!v) throw new Error(`${name} is required`);
  return v;
}

function statusField(formData: FormData, name: string): string {
  return (formData.get(name) as string) || "Not started";
}

function bool(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

function parseActionForm(formData: FormData) {
  return {
    entityId:                str(formData, "entityId"),
    description:             req(formData, "description"),
    deadline:                parseDate(formData.get("deadline") as string),
    relativeDeadlineTrigger: str(formData, "relativeDeadlineTrigger"),
    relativeDeadlineOffset:  str(formData, "relativeDeadlineOffset"),
    conditionText:           str(formData, "conditionText"),

    responsibleParty:         str(formData, "responsibleParty"),
    accountableParty:         str(formData, "accountableParty"),
    consultedParty:           str(formData, "consultedParty"),
    informedParty:            str(formData, "informedParty"),
    externalAdviser:          str(formData, "externalAdviser"),
    externalOperationalOwner: str(formData, "externalOperationalOwner"),

    dataCollectionRequired:      bool(formData, "dataCollectionRequired"),
    dataValidationRequired:      bool(formData, "dataValidationRequired"),
    technicalReviewRequired:     bool(formData, "technicalReviewRequired"),
    accountableApprovalRequired: bool(formData, "accountableApprovalRequired"),
    filingSubmissionRequired:    bool(formData, "filingSubmissionRequired"),
    paymentRequired:             bool(formData, "paymentRequired"),

    dataCompletenessStatus: statusField(formData, "dataCompletenessStatus"),
    dataValidationStatus:   statusField(formData, "dataValidationStatus"),
    technicalReviewStatus:  statusField(formData, "technicalReviewStatus"),
    approvalStatus:         statusField(formData, "approvalStatus"),
    workflowProgressStatus: statusField(formData, "workflowProgressStatus"),
    evidenceStatus:         statusField(formData, "evidenceStatus"),
    filingSubmissionStatus: statusField(formData, "filingSubmissionStatus"),
    paymentStatus:          statusField(formData, "paymentStatus"),

    evidenceRequired:    bool(formData, "evidenceRequired"),
    evidenceDescription: str(formData, "evidenceDescription"),

    riskLevel:         str(formData, "riskLevel"),
    openIssueBlocker:  str(formData, "openIssueBlocker"),
    notes:             str(formData, "notes"),
    exceptionRequired: bool(formData, "exceptionRequired"),

    sourceType:              str(formData, "sourceType"),
    sourceDocumentReference: str(formData, "sourceDocumentReference"),
    sourcePageParagraph:     str(formData, "sourcePageParagraph"),
    createdBy:               str(formData, "createdBy"),
  };
}

function resolveOverallStatus(
  data: ReturnType<typeof parseActionForm>,
  formData: FormData
): { overallStatus: string; overallStatusIsOverride: boolean; computed: string } {
  const computed = computeOverallStatus({ ...data, responsibleOwner: data.responsibleParty }).status;
  const overrideValue = (formData.get("overallStatusOverride") as string || "").trim();
  if (overrideValue && overrideValue !== computed) {
    return { overallStatus: overrideValue, overallStatusIsOverride: true, computed };
  }
  return { overallStatus: computed, overallStatusIsOverride: false, computed };
}

export async function createAction(formData: FormData) {
  const org = await prisma.organisation.findFirst();
  if (!org) throw new Error("No organisation found. Please run the seed script.");

  const data = parseActionForm(formData);
  const { overallStatus, overallStatusIsOverride, computed } = resolveOverallStatus(data, formData);

  const created = await prisma.action.create({
    data: { organisationId: org.id, ...data, overallStatus, overallStatusIsOverride },
  });

  await prisma.auditEvent.create({
    data: {
      organisationId: org.id,
      entityId: data.entityId,
      actionId: created.id,
      action: "ACTION_CREATED",
      detail: JSON.stringify({ id: created.id, description: created.description }),
    },
  });

  await recordOverallStatusRecalculated({
    objectType: "Action", objectId: created.id, organisationId: org.id, entityId: data.entityId,
    computedStatus: computed, storedStatus: overallStatus, wasOverridden: overallStatusIsOverride,
  });

  revalidatePath("/actions-register");
  revalidatePath("/");
  redirect(`/actions-register/${created.id}`);
}

export async function updateAction(id: string, formData: FormData) {
  const org = await prisma.organisation.findFirst();
  if (!org) throw new Error("No organisation found.");

  const before = await prisma.action.findUnique({ where: { id } });
  if (!before) throw new Error("Action not found.");

  const data = parseActionForm(formData);
  const statusChangeReason = str(formData, "statusChangeReason");
  const { overallStatus, overallStatusIsOverride, computed } = resolveOverallStatus(data, formData);

  const updated = await prisma.action.update({
    where: { id },
    data: { ...data, overallStatus, overallStatusIsOverride },
  });

  await recordFieldChanges({
    objectType: "Action", objectId: id, organisationId: org.id, entityId: data.entityId,
    before: before as unknown as Record<string, unknown>, after: updated as unknown as Record<string, unknown>,
    fields: TRACKED_FIELDS, changedBy: data.createdBy, reason: statusChangeReason,
  });

  if (before.overallStatus !== overallStatus) {
    await recordOverallStatusRecalculated({
      objectType: "Action", objectId: id, organisationId: org.id, entityId: data.entityId,
      computedStatus: computed, storedStatus: overallStatus, wasOverridden: overallStatusIsOverride,
    });
  }

  await prisma.auditEvent.create({
    data: {
      organisationId: org.id,
      entityId: data.entityId,
      actionId: updated.id,
      action: "ACTION_UPDATED",
      detail: JSON.stringify({ id: updated.id, description: updated.description }),
    },
  });

  revalidatePath(`/actions-register/${id}`);
  revalidatePath(`/actions-register/${id}/edit`);
  revalidatePath("/actions-register");
  revalidatePath("/");
  redirect(`/actions-register/${id}`);
}

export async function archiveAction(id: string) {
  const org = await prisma.organisation.findFirst();
  const updated = await prisma.action.update({
    where: { id },
    data: { archivedAt: new Date() },
  });

  if (org) {
    await prisma.auditEvent.create({
      data: {
        organisationId: org.id,
        entityId: updated.entityId,
        actionId: updated.id,
        action: "ACTION_ARCHIVED",
        detail: JSON.stringify({ id: updated.id, description: updated.description }),
      },
    });
  }

  revalidatePath(`/actions-register/${id}`);
  revalidatePath("/actions-register");
}

export async function unarchiveAction(id: string) {
  await prisma.action.update({
    where: { id },
    data: { archivedAt: null },
  });

  revalidatePath(`/actions-register/${id}`);
  revalidatePath("/actions-register");
}

export async function deleteAction(id: string) {
  const org = await prisma.organisation.findFirst();
  const existing = await prisma.action.findUnique({ where: { id } });

  await prisma.action.delete({ where: { id } });

  if (org && existing) {
    await prisma.auditEvent.create({
      data: {
        organisationId: org.id,
        entityId: existing.entityId,
        action: "ACTION_DELETED",
        detail: JSON.stringify({ id, description: existing.description }),
      },
    });
  }

  revalidatePath("/actions-register");
  revalidatePath("/");
  redirect("/actions-register");
}
