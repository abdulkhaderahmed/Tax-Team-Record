"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { computeOverallStatus } from "@/lib/ownership-control";
import { recordFieldChanges, recordOverallStatusRecalculated } from "@/lib/status-history";
import { requirePermission } from "@/lib/auth";
import { requireDocumentAccess } from "@/lib/authz";
import { recordUserAuditEvent } from "@/lib/audit";
import { hasPermission } from "@/lib/authz-policy";
import {
  initialControlledRecordState,
  protectControlledRecordState,
} from "@/lib/record-control-policy";

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
    sourceDocumentId:        str(formData, "sourceDocumentId"),
    sourceDocumentReference: str(formData, "sourceDocumentReference"),
    sourcePageParagraph:     str(formData, "sourcePageParagraph"),
  };
}

type ActionFormData = ReturnType<typeof parseActionForm>;

function resolveOverallStatus(
  data: ActionFormData,
  formData: FormData,
  hasExternalBlocker = false,
  allowOverride = false,
): { overallStatus: string; overallStatusIsOverride: boolean; computed: string } {
  if (hasExternalBlocker) {
    return { overallStatus: "Blocked", overallStatusIsOverride: false, computed: "Blocked" };
  }
  const computed = computeOverallStatus({ ...data, responsibleOwner: data.responsibleParty }).status;
  const overrideValue = (formData.get("overallStatusOverride") as string || "").trim();
  if (overrideValue && !allowOverride) {
    throw new Error("Review permission is required to override overall readiness.");
  }
  if (overrideValue && overrideValue !== computed) {
    return { overallStatus: overrideValue, overallStatusIsOverride: true, computed };
  }
  return { overallStatus: computed, overallStatusIsOverride: false, computed };
}

async function assertEntityScope(entityId: string | null, organisationId: string) {
  if (!entityId) return;
  const entity = await prisma.entity.findFirst({
    where: { id: entityId, organisationId, deletedAt: null },
    select: { id: true },
  });
  if (!entity) throw new Error("Entity not found.");
}

export async function createAction(formData: FormData) {
  const context = await requirePermission("record:write");

  const data = initialControlledRecordState(parseActionForm(formData));
  await assertEntityScope(data.entityId, context.orgId);
  if (data.sourceDocumentId) await requireDocumentAccess(data.sourceDocumentId, "view", context);
  const { overallStatus, overallStatusIsOverride, computed } = resolveOverallStatus(data, formData);

  const created = await prisma.$transaction(async (tx) => {
    const action = await tx.action.create({
      data: {
      organisationId: context.orgId,
      ...data,
      overallStatus,
      overallStatusIsOverride,
      createdById: context.userId,
      lastUpdatedById: context.userId,
      },
    });
    if (action.sourceDocumentId) {
      await tx.documentRecordLink.createMany({
        data: [{
          organisationId: context.orgId,
          documentId: action.sourceDocumentId,
          actionId: action.id,
          linkType: "Source",
          pageReference: action.sourcePageParagraph,
          createdById: context.userId,
        }],
        skipDuplicates: true,
      });
    }
    await recordUserAuditEvent(context, {
      action: "ACTION_CREATED",
      target: { objectType: "Action", objectId: action.id, entityId: action.entityId, actionId: action.id },
      after: action,
    }, tx);
    await recordOverallStatusRecalculated({
      objectType: "Action",
      objectId: action.id,
      organisationId: context.orgId,
      entityId: action.entityId,
      computedStatus: computed,
      storedStatus: overallStatus,
      wasOverridden: overallStatusIsOverride,
      changedBy: context.userId,
      tx,
    });
    return action;
  });

  revalidatePath("/actions-register");
  revalidatePath("/");
  redirect(`/actions-register/${created.id}`);
}

export async function updateAction(id: string, formData: FormData) {
  const context = await requirePermission("record:write");
  const submitted = parseActionForm(formData);
  await assertEntityScope(submitted.entityId, context.orgId);
  if (submitted.sourceDocumentId) await requireDocumentAccess(submitted.sourceDocumentId, "view", context);
  const statusChangeReason = str(formData, "statusChangeReason");
  const canReview = hasPermission(context.user.role, "review:perform");

  await prisma.$transaction(async (tx) => {
    const before = await tx.action.findFirst({
      where: { id, organisationId: context.orgId, deletedAt: null },
    });
    if (!before) throw new Error("Action not found.");
    const data = protectControlledRecordState(submitted, before, canReview);
    const [blockingExceptions, blockingApprovals] = await Promise.all([
      tx.exception.count({
        where: {
          actionId: id,
          organisationId: context.orgId,
          blocksFiling: true,
          status: { in: ["Open", "In progress"] },
        },
      }),
      tx.approval.count({
        where: {
          actionId: id,
          organisationId: context.orgId,
          status: { in: ["Pending", "Rejected"] },
        },
      }),
    ]);
    const { overallStatus, overallStatusIsOverride, computed } = resolveOverallStatus(
      data,
      formData,
      blockingExceptions + blockingApprovals > 0,
      canReview,
    );
    const updated = await tx.action.update({
      where: { id },
      data: { ...data, overallStatus, overallStatusIsOverride, lastUpdatedById: context.userId },
    });
    if (updated.sourceDocumentId) {
      await tx.documentRecordLink.createMany({
        data: [{
          organisationId: context.orgId,
          documentId: updated.sourceDocumentId,
          actionId: updated.id,
          linkType: "Source",
          pageReference: updated.sourcePageParagraph,
          createdById: context.userId,
        }],
        skipDuplicates: true,
      });
    }
    await recordFieldChanges({
      objectType: "Action",
      objectId: id,
      organisationId: context.orgId,
      entityId: data.entityId,
      before: before as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
      fields: TRACKED_FIELDS,
      changedBy: context.userId,
      reason: statusChangeReason,
      tx,
    });
    if (before.overallStatus !== overallStatus) {
      await recordOverallStatusRecalculated({
        objectType: "Action",
        objectId: id,
        organisationId: context.orgId,
        entityId: data.entityId,
        computedStatus: computed,
        storedStatus: overallStatus,
        wasOverridden: overallStatusIsOverride,
        changedBy: context.userId,
        tx,
      });
    }
    await recordUserAuditEvent(context, {
      action: "ACTION_UPDATED",
      target: { objectType: "Action", objectId: id, entityId: updated.entityId, actionId: id },
      before,
      after: updated,
      reason: statusChangeReason,
    }, tx);
  });

  revalidatePath(`/actions-register/${id}`);
  revalidatePath(`/actions-register/${id}/edit`);
  revalidatePath("/actions-register");
  revalidatePath("/");
  redirect(`/actions-register/${id}`);
}

export async function archiveAction(id: string) {
  const context = await requirePermission("record:write");
  const existing = await prisma.action.findFirst({
    where: { id, organisationId: context.orgId, deletedAt: null },
  });
  if (!existing) throw new Error("Action not found.");
  await prisma.$transaction(async (tx) => {
    const updated = await tx.action.update({
      where: { id },
      data: { archivedAt: new Date(), lastUpdatedById: context.userId },
    });
    await recordUserAuditEvent(context, {
      action: "ACTION_ARCHIVED",
      target: { objectType: "Action", objectId: id, entityId: updated.entityId, actionId: id },
      before: existing,
      after: updated,
    }, tx);
  });

  revalidatePath(`/actions-register/${id}`);
  revalidatePath("/actions-register");
}

export async function unarchiveAction(id: string) {
  const context = await requirePermission("record:write");
  const existing = await prisma.action.findFirst({
    where: { id, organisationId: context.orgId, deletedAt: null },
  });
  if (!existing) throw new Error("Action not found.");
  await prisma.$transaction(async (tx) => {
    const updated = await tx.action.update({
      where: { id },
      data: { archivedAt: null, lastUpdatedById: context.userId },
    });
    await recordUserAuditEvent(context, {
      action: "ACTION_RESTORED",
      target: { objectType: "Action", objectId: id, entityId: updated.entityId, actionId: id },
      before: existing,
      after: updated,
    }, tx);
  });

  revalidatePath(`/actions-register/${id}`);
  revalidatePath("/actions-register");
}

export async function deleteAction(id: string, formData: FormData) {
  const context = await requirePermission("record:delete");
  const reason = str(formData, "reason");
  if (!reason) throw new Error("A deletion reason is required.");
  const existing = await prisma.action.findFirst({
    where: { id, organisationId: context.orgId, deletedAt: null },
  });
  if (!existing) throw new Error("Action not found.");

  await prisma.$transaction(async (tx) => {
    const tombstone = await tx.action.update({
      where: { id },
      data: {
        archivedAt: existing.archivedAt ?? new Date(),
        deletedAt: new Date(),
        deletedById: context.userId,
        deletionReason: reason,
        lastUpdatedById: context.userId,
      },
    });
    await recordUserAuditEvent(context, {
      action: "ACTION_TOMBSTONED",
      target: { objectType: "Action", objectId: id, entityId: existing.entityId, actionId: id },
      before: existing,
      after: tombstone,
      reason,
    }, tx);
  });

  revalidatePath("/actions-register");
  revalidatePath("/");
  redirect("/actions-register");
}
