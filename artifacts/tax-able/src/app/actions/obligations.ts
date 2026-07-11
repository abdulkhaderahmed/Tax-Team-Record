"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { computeOverallStatus } from "@/lib/ownership-control";
import { requirePermission } from "@/lib/auth";
import { recordUserAuditEvent } from "@/lib/audit";
import { requireDocumentAccess } from "@/lib/authz";
import { hasPermission } from "@/lib/authz-policy";
import { recordFieldChanges, recordOverallStatusRecalculated } from "@/lib/status-history";
import {
  initialControlledRecordState,
  protectControlledRecordState,
} from "@/lib/record-control-policy";

const TRACKED_FIELDS = [
  "responsibleOwner", "accountableOwner", "consultedParty", "informedParty",
  "externalAdviser", "externalOperationalOwner", "dataCompletenessStatus",
  "dataValidationStatus", "technicalReviewStatus", "approvalStatus",
  "workflowProgressStatus", "evidenceStatus", "filingSubmissionStatus",
  "paymentStatus", "overallWorkflowStatus", "dataCollectionRequired",
  "dataValidationRequired", "technicalReviewRequired", "accountableApprovalRequired",
  "evidenceRequired", "filingSubmissionRequired", "paymentRequired",
];

function parseDate(raw: FormDataEntryValue | null): Date | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function str(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function req(formData: FormData, name: string): string {
  const value = str(formData, name);
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function status(formData: FormData, name: string): string {
  return str(formData, name) ?? "Not started";
}

function checked(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

function parseObligationForm(formData: FormData) {
  return {
    entityId: str(formData, "entityId"),
    regime: req(formData, "regime"),
    obligationType: req(formData, "obligationType"),
    description: req(formData, "description"),
    statutoryBasis: str(formData, "statutoryBasis"),
    filingDeadline: parseDate(formData.get("filingDeadline")),
    paymentDeadline: parseDate(formData.get("paymentDeadline")),
    internalTargetDate: parseDate(formData.get("internalTargetDate")),
    recurrence: str(formData, "recurrence"),
    periodStart: parseDate(formData.get("periodStart")),
    periodEnd: parseDate(formData.get("periodEnd")),
    source: str(formData, "source"),

    responsibleOwner: str(formData, "responsibleOwner"),
    accountableOwner: str(formData, "accountableOwner"),
    consultedParty: str(formData, "consultedParty"),
    informedParty: str(formData, "informedParty"),
    externalAdviser: str(formData, "externalAdviser"),
    externalOperationalOwner: str(formData, "externalOperationalOwner"),

    dataCollectionRequired: checked(formData, "dataCollectionRequired"),
    dataValidationRequired: checked(formData, "dataValidationRequired"),
    technicalReviewRequired: checked(formData, "technicalReviewRequired"),
    accountableApprovalRequired: checked(formData, "accountableApprovalRequired"),
    filingSubmissionRequired: checked(formData, "filingSubmissionRequired"),
    paymentRequired: checked(formData, "paymentRequired"),

    dataCompletenessStatus: status(formData, "dataCompletenessStatus"),
    dataValidationStatus: status(formData, "dataValidationStatus"),
    technicalReviewStatus: status(formData, "technicalReviewStatus"),
    approvalStatus: status(formData, "approvalStatus"),
    workflowProgressStatus: status(formData, "workflowProgressStatus"),
    evidenceStatus: status(formData, "evidenceStatus"),
    filingSubmissionStatus: status(formData, "filingSubmissionStatus"),
    paymentStatus: status(formData, "paymentStatus"),

    evidenceRequired: checked(formData, "evidenceRequired"),
    evidenceDescription: str(formData, "evidenceDescription"),
    evidenceFileLink: str(formData, "evidenceFileLink"),
    evidenceOwner: str(formData, "evidenceOwner"),

    riskLevel: str(formData, "riskLevel"),
    consequenceOfMissingDeadline: str(formData, "consequenceOfMissingDeadline"),
    openIssueBlocker: str(formData, "openIssueBlocker"),
    notes: str(formData, "notes"),
    exceptionRequired: checked(formData, "exceptionRequired"),

    sourceType: str(formData, "sourceType"),
    sourceDocumentId: str(formData, "sourceDocumentId"),
    sourceDocumentReference: str(formData, "sourceDocumentReference"),
    sourcePageParagraph: str(formData, "sourcePageParagraph"),
  };
}

type ObligationFormData = ReturnType<typeof parseObligationForm>;

function resolvedStatus(
  data: ObligationFormData,
  formData: FormData,
  hasExternalBlocker = false,
  allowOverride = false,
) {
  if (hasExternalBlocker) {
    return {
      overallWorkflowStatus: "Blocked",
      overallStatusIsOverride: false,
    };
  }

  const computed = computeOverallStatus(data).status;
  const requestedOverride = str(formData, "overallStatusOverride");
  if (requestedOverride && !allowOverride) {
    throw new Error("Review permission is required to override overall readiness.");
  }
  // A manual override can clarify progress, but it cannot bypass a control
  // blocker represented on the record itself.
  const recordBlocks = data.exceptionRequired && Boolean(data.openIssueBlocker);
  if (recordBlocks) {
    return {
      overallWorkflowStatus: "Blocked",
      overallStatusIsOverride: false,
    };
  }
  if (requestedOverride && requestedOverride !== computed) {
    return {
      overallWorkflowStatus: requestedOverride,
      overallStatusIsOverride: true,
    };
  }
  return {
    overallWorkflowStatus: computed,
    overallStatusIsOverride: false,
  };
}

async function assertEntityScope(entityId: string | null, orgId: string) {
  if (!entityId) return;
  const entity = await prisma.entity.findFirst({
    where: { id: entityId, organisationId: orgId, deletedAt: null },
    select: { id: true },
  });
  if (!entity) throw new Error("Entity not found.");
}

function revalidateObligation(id?: string) {
  if (id) revalidatePath(`/obligations/${id}`);
  revalidatePath("/obligations");
  revalidatePath("/obligations/calendar");
  revalidatePath("/");
}

export async function createObligation(formData: FormData) {
  const context = await requirePermission("record:write");
  const data = initialControlledRecordState(parseObligationForm(formData));
  await assertEntityScope(data.entityId, context.orgId);
  if (data.sourceDocumentId) await requireDocumentAccess(data.sourceDocumentId, "view", context);
  const readiness = resolvedStatus(data, formData);

  const obligation = await prisma.$transaction(async (tx) => {
    const created = await tx.obligation.create({
      data: {
        organisationId: context.orgId,
        ...data,
        ...readiness,
        createdById: context.userId,
        lastUpdatedById: context.userId,
      },
    });
    if (created.sourceDocumentId) {
      await tx.documentRecordLink.createMany({
        data: [{
          organisationId: context.orgId,
          documentId: created.sourceDocumentId,
          obligationId: created.id,
          linkType: "Source",
          pageReference: created.sourcePageParagraph,
          createdById: context.userId,
        }],
        skipDuplicates: true,
      });
    }
    await recordUserAuditEvent(
      context,
      {
        action: "OBLIGATION_CREATED",
        target: {
          objectType: "Obligation",
          objectId: created.id,
          entityId: created.entityId,
          obligationId: created.id,
        },
        after: created,
      },
      tx,
    );
    return created;
  });

  revalidateObligation(obligation.id);
  redirect(`/obligations/${obligation.id}`);
}

export async function updateObligation(id: string, formData: FormData) {
  const context = await requirePermission("record:write");
  const submitted = parseObligationForm(formData);
  await assertEntityScope(submitted.entityId, context.orgId);
  if (submitted.sourceDocumentId) await requireDocumentAccess(submitted.sourceDocumentId, "view", context);
  const reason = str(formData, "statusChangeReason");
  const canReview = hasPermission(context.user.role, "review:perform");

  await prisma.$transaction(async (tx) => {
    const before = await tx.obligation.findFirst({
      where: { id, organisationId: context.orgId, deletedAt: null },
    });
    if (!before) throw new Error("Obligation not found.");
    const data = protectControlledRecordState(submitted, before, canReview);
    const [blockingExceptions, blockingApprovals] = await Promise.all([
      tx.exception.count({
        where: {
          obligationId: id,
          organisationId: context.orgId,
          blocksFiling: true,
          status: { in: ["Open", "In progress"] },
        },
      }),
      tx.approval.count({
        where: {
          obligationId: id,
          organisationId: context.orgId,
          status: { in: ["Pending", "Rejected"] },
        },
      }),
    ]);
    const readiness = resolvedStatus(
      data,
      formData,
      blockingExceptions + blockingApprovals > 0,
      canReview,
    );
    const updated = await tx.obligation.update({
      where: { id },
      data: {
        ...data,
        ...readiness,
        lastUpdatedById: context.userId,
      },
    });
    if (updated.sourceDocumentId) {
      await tx.documentRecordLink.createMany({
        data: [{
          organisationId: context.orgId,
          documentId: updated.sourceDocumentId,
          obligationId: updated.id,
          linkType: "Source",
          pageReference: updated.sourcePageParagraph,
          createdById: context.userId,
        }],
        skipDuplicates: true,
      });
    }
    await recordFieldChanges({
      objectType: "Obligation",
      objectId: id,
      organisationId: context.orgId,
      entityId: updated.entityId,
      before: before as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
      fields: TRACKED_FIELDS,
      changedBy: context.userId,
      reason,
      tx,
    });
    if (before.overallWorkflowStatus !== updated.overallWorkflowStatus) {
      await recordOverallStatusRecalculated({
        objectType: "Obligation",
        objectId: id,
        organisationId: context.orgId,
        entityId: updated.entityId,
        computedStatus:
          blockingExceptions + blockingApprovals > 0
            ? "Blocked"
            : computeOverallStatus(data).status,
        storedStatus: updated.overallWorkflowStatus,
        wasOverridden: updated.overallStatusIsOverride,
        changedBy: context.userId,
        tx,
      });
    }
    await recordUserAuditEvent(
      context,
      {
        action: "OBLIGATION_UPDATED",
        target: {
          objectType: "Obligation",
          objectId: id,
          entityId: updated.entityId,
          obligationId: id,
        },
        before,
        after: updated,
        reason,
      },
      tx,
    );
  });

  revalidateObligation(id);
  redirect(`/obligations/${id}`);
}

export async function archiveObligation(id: string) {
  const context = await requirePermission("record:write");
  await prisma.$transaction(async (tx) => {
    const before = await tx.obligation.findFirst({
      where: { id, organisationId: context.orgId, deletedAt: null },
    });
    if (!before) throw new Error("Obligation not found.");
    const updated = await tx.obligation.update({
      where: { id },
      data: { archivedAt: new Date(), lastUpdatedById: context.userId },
    });
    await recordUserAuditEvent(
      context,
      {
        action: "OBLIGATION_ARCHIVED",
        target: { objectType: "Obligation", objectId: id, entityId: updated.entityId, obligationId: id },
        before,
        after: updated,
      },
      tx,
    );
  });
  revalidateObligation(id);
}

export async function unarchiveObligation(id: string) {
  const context = await requirePermission("record:write");
  await prisma.$transaction(async (tx) => {
    const before = await tx.obligation.findFirst({
      where: { id, organisationId: context.orgId, deletedAt: null },
    });
    if (!before) throw new Error("Obligation not found.");
    const updated = await tx.obligation.update({
      where: { id },
      data: { archivedAt: null, lastUpdatedById: context.userId },
    });
    await recordUserAuditEvent(
      context,
      {
        action: "OBLIGATION_RESTORED",
        target: { objectType: "Obligation", objectId: id, entityId: updated.entityId, obligationId: id },
        before,
        after: updated,
      },
      tx,
    );
  });
  revalidateObligation(id);
}

export async function deleteObligation(id: string, formData: FormData) {
  const context = await requirePermission("record:delete");
  const reason = str(formData, "reason");
  if (!reason) throw new Error("A deletion reason is required.");

  await prisma.$transaction(async (tx) => {
    const before = await tx.obligation.findFirst({
      where: { id, organisationId: context.orgId, deletedAt: null },
    });
    if (!before) throw new Error("Obligation not found.");
    const tombstone = await tx.obligation.update({
      where: { id },
      data: {
        archivedAt: before.archivedAt ?? new Date(),
        deletedAt: new Date(),
        deletedById: context.userId,
        deletionReason: reason,
        lastUpdatedById: context.userId,
      },
    });
    await recordUserAuditEvent(
      context,
      {
        action: "OBLIGATION_TOMBSTONED",
        target: { objectType: "Obligation", objectId: id, entityId: before.entityId, obligationId: id },
        before,
        after: tombstone,
        reason,
      },
      tx,
    );
  });

  revalidateObligation();
  redirect("/obligations");
}
