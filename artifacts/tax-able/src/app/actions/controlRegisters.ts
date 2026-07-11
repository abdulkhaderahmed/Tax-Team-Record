"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOrg, requirePermission, type OrgContext } from "@/lib/auth";
import { requireDocumentAccess } from "@/lib/authz";
import { assertPermission, hasPermission } from "@/lib/authz-policy";
import { recordUserAuditEvent } from "@/lib/audit";
import { computeOverallStatus } from "@/lib/ownership-control";
import {
  APPROVAL_DECISIONS,
  APPROVAL_GATES,
  ASSUMPTION_STATUSES,
  CAVEAT_STATUSES,
  DATA_REQUEST_STATUSES,
  EVIDENCE_STATUSES,
  EXCEPTION_SEVERITIES,
  EXCEPTION_STATUSES,
  RELIANCE_LEVELS,
  TRIPWIRE_STATUSES,
  allowedValue,
  aggregateApprovalStatus,
  assertApprovalDecision,
  assertApprovalRequest,
  assertExactlyOneApprovalTarget,
  isCompletedDataRequestStatus,
  isResolvedExceptionStatus,
} from "@/lib/control-register-policy";

type Tx = Prisma.TransactionClient;

type OrgLinks = {
  entityId?: string | null;
  obligationId?: string | null;
  actionId?: string | null;
  assumptionId?: string | null;
  caveatId?: string | null;
  tripwireId?: string | null;
  exceptionId?: string | null;
  documentId?: string | null;
  partyId?: string | null;
  userIds?: Array<string | null | undefined>;
};

function text(formData: FormData, name: string): string | null {
  return String(formData.get(name) ?? "").trim() || null;
}

function requiredText(formData: FormData, name: string, label: string): string {
  const value = text(formData, name);
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

function dateValue(formData: FormData, name: string): Date | null {
  const raw = text(formData, name);
  if (!raw) return null;
  const value = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T00:00:00.000Z`)
    : new Date(raw);
  if (Number.isNaN(value.getTime())) throw new Error(`${name} must be a valid date.`);
  return value;
}

function checked(formData: FormData, name: string): boolean {
  return formData
    .getAll(name)
    .some((value) => value === "on" || value === "true" || value === "1");
}

function choice<const T extends readonly string[]>(
  formData: FormData,
  name: string,
  allowed: T,
  fallback: T[number],
): T[number] {
  return allowedValue(text(formData, name), allowed, name, fallback);
}

function assertAtLeastOneTarget(label: string, values: Array<string | null | undefined>): void {
  if (!values.some(Boolean)) throw new Error(`${label} must be linked to at least one record.`);
}

async function assertOrgLinks(tx: Tx, organisationId: string, links: OrgLinks): Promise<string | null> {
  if (links.obligationId && links.actionId) {
    throw new Error("Choose either an obligation or an action, not both.");
  }
  const linkedEntityIds: string[] = [];
  if (
    links.entityId &&
    !(await tx.entity.findFirst({ where: { id: links.entityId, organisationId }, select: { id: true } }))
  ) {
    throw new Error("Entity not found.");
  }
  if (links.obligationId) {
    const record = await tx.obligation.findFirst({
      where: {
        id: links.obligationId,
        organisationId,
        deletedAt: null,
        OR: [{ draftReviewStatus: null }, { draftReviewStatus: "activated" }],
      },
      select: { id: true, entityId: true },
    });
    if (!record) throw new Error("Obligation not found.");
    if (record.entityId) linkedEntityIds.push(record.entityId);
  }
  if (links.actionId) {
    const record = await tx.action.findFirst({
      where: { id: links.actionId, organisationId, deletedAt: null },
      select: { id: true, entityId: true },
    });
    if (!record) throw new Error("Action not found.");
    if (record.entityId) linkedEntityIds.push(record.entityId);
  }
  if (links.assumptionId) {
    const record = await tx.assumption.findFirst({
      where: { id: links.assumptionId, organisationId },
      select: { id: true, entityId: true },
    });
    if (!record) throw new Error("Assumption not found.");
    if (record.entityId) linkedEntityIds.push(record.entityId);
  }
  if (links.caveatId) {
    const record = await tx.caveat.findFirst({
      where: { id: links.caveatId, organisationId },
      select: { id: true, entityId: true },
    });
    if (!record) throw new Error("Caveat not found.");
    if (record.entityId) linkedEntityIds.push(record.entityId);
  }
  if (links.tripwireId) {
    const record = await tx.tripwire.findFirst({
      where: { id: links.tripwireId, organisationId },
      select: { id: true, entityId: true },
    });
    if (!record) throw new Error("Tripwire not found.");
    if (record.entityId) linkedEntityIds.push(record.entityId);
  }
  if (links.exceptionId) {
    const record = await tx.exception.findFirst({
      where: { id: links.exceptionId, organisationId },
      select: { id: true, entityId: true },
    });
    if (!record) throw new Error("Exception not found.");
    if (record.entityId) linkedEntityIds.push(record.entityId);
  }
  if (links.documentId) {
    const record = await tx.document.findFirst({
      where: { id: links.documentId, organisationId, deletedAt: null },
      select: { id: true, entityId: true },
    });
    if (!record) throw new Error("Document not found.");
    if (record.entityId) linkedEntityIds.push(record.entityId);
  }
  if (
    links.partyId &&
    !(await tx.party.findFirst({
      where: { id: links.partyId, organisationId },
      select: { id: true },
    }))
  ) {
    throw new Error("Party not found.");
  }

  for (const userId of links.userIds ?? []) {
    if (
      userId &&
      !(await tx.user.findFirst({
        where: { id: userId, organisationId },
        select: { id: true },
      }))
    ) {
      throw new Error("User not found.");
    }
  }

  const uniqueEntityIds = [...new Set(linkedEntityIds)];
  if (uniqueEntityIds.length > 1) {
    throw new Error("Linked records belong to different entities.");
  }
  const targetEntityId = uniqueEntityIds[0] ?? null;
  if (links.entityId && targetEntityId && links.entityId !== targetEntityId) {
    throw new Error("The selected entity does not match the linked record.");
  }
  return links.entityId ?? targetEntityId;
}

async function requireLinkedDocument(context: OrgContext, documentId: string | null): Promise<void> {
  if (documentId) await requireDocumentAccess(documentId, "view", context);
}

async function linkSourceDocument(
  tx: Tx,
  context: OrgContext,
  documentId: string | null,
  target: Pick<
    Prisma.DocumentRecordLinkUncheckedCreateInput,
    | "obligationId"
    | "actionId"
    | "assumptionId"
    | "caveatId"
    | "tripwireId"
    | "exceptionId"
    | "evidenceId"
  >,
  pageReference?: string | null,
) {
  if (!documentId) return;
  await tx.documentRecordLink.createMany({
    data: [{
      organisationId: context.orgId,
      documentId,
      linkType: "Source",
      pageReference: pageReference ?? null,
      createdById: context.userId,
      ...target,
    }],
    skipDuplicates: true,
  });
}

function reminderRows(params: {
  formData: FormData;
  ownerId: string;
  description: string;
}) {
  const reminderDate = dateValue(params.formData, "reminderDate");
  const escalationDate = dateValue(params.formData, "escalationDate");
  return [
    reminderDate
      ? {
          ownerId: params.ownerId,
          reminderType: "Reminder",
          scheduledFor: reminderDate,
          message:
            text(params.formData, "reminderMessage") ??
            `Data request reminder: ${params.description}`,
        }
      : null,
    escalationDate
      ? {
          ownerId: params.ownerId,
          reminderType: "Escalation",
          scheduledFor: escalationDate,
          message:
            text(params.formData, "escalationMessage") ??
            `Data request escalation: ${params.description}`,
        }
      : null,
  ].filter((row): row is NonNullable<typeof row> => Boolean(row));
}

type OperationalTarget = { obligationId: string | null; actionId: string | null };

function operationalTargetWhere(target: OperationalTarget) {
  return target.obligationId
    ? { obligationId: target.obligationId }
    : { actionId: target.actionId! };
}

async function recomputeTargetReadiness(tx: Tx, target: OperationalTarget) {
  if (!target.obligationId && !target.actionId) return;
  const targetWhere = operationalTargetWhere(target);
  const [exceptionBlockers, approvalBlockers] = await Promise.all([
    tx.exception.count({
      where: {
        ...targetWhere,
        blocksFiling: true,
        status: { in: ["Open", "In progress"] },
      },
    }),
    tx.approval.count({
      where: { ...targetWhere, status: { in: ["Pending", "Rejected"] } },
    }),
  ]);
  const externallyBlocked = exceptionBlockers + approvalBlockers > 0;

  if (target.obligationId) {
    const record = await tx.obligation.findUnique({ where: { id: target.obligationId } });
    if (!record) throw new Error("Obligation not found while recalculating readiness.");
    const computed = computeOverallStatus(record).status;
    await tx.obligation.update({
      where: { id: record.id },
      data: {
        overallWorkflowStatus: externallyBlocked ? "Blocked" : computed,
        overallStatusIsOverride: false,
      },
    });
  } else if (target.actionId) {
    const record = await tx.action.findUnique({ where: { id: target.actionId } });
    if (!record) throw new Error("Action not found while recalculating readiness.");
    const computed = computeOverallStatus({
      ...record,
      responsibleOwner: record.responsibleParty,
    }).status;
    await tx.action.update({
      where: { id: record.id },
      data: {
        overallStatus: externallyBlocked ? "Blocked" : computed,
        overallStatusIsOverride: false,
      },
    });
  }
}

async function syncApprovalTarget(tx: Tx, target: OperationalTarget) {
  if (!target.obligationId && !target.actionId) return;
  const active = await tx.approval.findMany({
    where: {
      ...operationalTargetWhere(target),
      status: { in: ["Pending", "Approved", "Rejected"] },
    },
    select: { gate: true, status: true },
  });
  const technical = active.filter((item) => item.gate === "Technical review");
  const evidenceWaivers = active.filter((item) => item.gate === "Evidence waiver");
  const accountable = active.filter((item) =>
    item.gate === "Accountable approval" || item.gate === "Filing release",
  );
  const fields = {
    ...(technical.length
      ? {
          technicalReviewRequired: true,
          technicalReviewStatus: aggregateApprovalStatus(technical.map((item) => item.status)),
        }
      : {}),
    ...(evidenceWaivers.length
      ? {
          evidenceRequired: true,
          evidenceStatus:
            aggregateApprovalStatus(evidenceWaivers.map((item) => item.status)) === "Approved"
              ? "Waived"
              : aggregateApprovalStatus(evidenceWaivers.map((item) => item.status)),
        }
      : {}),
    ...(accountable.length
      ? {
          accountableApprovalRequired: true,
          approvalStatus: aggregateApprovalStatus(accountable.map((item) => item.status)),
        }
      : {}),
  };
  if (target.obligationId) {
    await tx.obligation.update({ where: { id: target.obligationId }, data: fields });
  } else if (target.actionId) {
    await tx.action.update({ where: { id: target.actionId }, data: fields });
  }
  await recomputeTargetReadiness(tx, target);
}

async function syncExceptionTarget(
  tx: Tx,
  exception: {
    id: string;
    obligationId: string | null;
    actionId: string | null;
    blocksFiling: boolean;
    status: string;
  },
) {
  const target = { obligationId: exception.obligationId, actionId: exception.actionId };
  if (!target.obligationId && !target.actionId) return;
  const blockerCount = await tx.exception.count({
    where: {
      ...operationalTargetWhere(target),
      blocksFiling: true,
      status: { in: ["Open", "In progress"] },
    },
  });
  if (exception.obligationId) {
    await tx.obligation.update({
      where: { id: exception.obligationId },
      data: { exceptionRequired: blockerCount > 0 },
    });
  } else if (exception.actionId) {
    await tx.action.update({
      where: { id: exception.actionId },
      data: { exceptionRequired: blockerCount > 0 },
    });
  }
  await recomputeTargetReadiness(tx, target);
}

async function syncEvidenceTarget(
  tx: Tx,
  evidence: { obligationId: string | null; actionId: string | null },
) {
  if (!evidence.obligationId && !evidence.actionId) return;
  const targetFilter = evidence.obligationId
    ? { obligationId: evidence.obligationId }
    : { actionId: evidence.actionId! };
  const items = await tx.evidenceItem.findMany({
    where: targetFilter,
    select: { status: true },
  });
  const waiverApprovals = await tx.approval.findMany({
    where: {
      ...targetFilter,
      gate: "Evidence waiver",
      status: { in: ["Pending", "Approved", "Rejected"] },
    },
    select: { status: true },
  });
  const waiverStatus = aggregateApprovalStatus(
    waiverApprovals.map((approval) => approval.status),
  );
  const rejected = items.some((item) => item.status === "Rejected");
  const satisfied =
    items.length > 0 && items.every((item) => ["Verified", "Waived"].includes(item.status));
  const evidenceStatus = waiverStatus === "Approved"
    ? "Waived"
    : waiverStatus === "Blocked" || rejected
      ? "Blocked"
      : waiverStatus === "Under review"
        ? "Under review"
        : satisfied
          ? "Complete"
          : items.some((item) => ["Received", "Verified"].includes(item.status))
            ? "In progress"
            : "Not started";
  if (evidence.obligationId) {
    await tx.obligation.update({
      where: { id: evidence.obligationId },
      data: {
        evidenceRequired: true,
        evidenceStatus,
        ...(rejected ? { overallWorkflowStatus: "Blocked", overallStatusIsOverride: false } : {}),
      },
    });
  } else if (evidence.actionId) {
    await tx.action.update({
      where: { id: evidence.actionId },
      data: {
        evidenceRequired: true,
        evidenceStatus,
        ...(rejected ? { overallStatus: "Blocked", overallStatusIsOverride: false } : {}),
      },
    });
  }
  await recomputeTargetReadiness(tx, evidence);
}

async function syncDataRequestTarget(
  tx: Tx,
  request: { obligationId: string | null; actionId: string | null },
) {
  if (!request.obligationId && !request.actionId) return;
  const targetFilter = request.obligationId
    ? { obligationId: request.obligationId }
    : { actionId: request.actionId! };
  const requests = await tx.dataRequest.findMany({
    where: targetFilter,
    select: { status: true },
  });
  const complete =
    requests.length > 0 && requests.every((item) => ["Validated", "Cancelled"].includes(item.status));
  const dataCompletenessStatus = complete
    ? "Complete"
    : requests.some((item) => item.status !== "Draft")
      ? "In progress"
      : "Not started";
  if (request.obligationId) {
    await tx.obligation.update({
      where: { id: request.obligationId },
      data: { dataCollectionRequired: true, dataCompletenessStatus },
    });
  } else if (request.actionId) {
    await tx.action.update({
      where: { id: request.actionId },
      data: { dataCollectionRequired: true, dataCompletenessStatus },
    });
  }
  await recomputeTargetReadiness(tx, request);
}

export async function createAssumption(formData: FormData): Promise<void> {
  const context = await requirePermission("record:write");
  const entityId = text(formData, "entityId");
  const sourceDocumentId = text(formData, "sourceDocumentId");
  await requireLinkedDocument(context, sourceDocumentId);

  await prisma.$transaction(async (tx) => {
    await assertOrgLinks(tx, context.orgId, { entityId, documentId: sourceDocumentId });
    const created = await tx.assumption.create({
      data: {
        organisationId: context.orgId,
        entityId,
        assumptionStatement: requiredText(formData, "assumptionStatement", "Assumption"),
        factCategory: text(formData, "factCategory"),
        relianceImportance: choice(formData, "relianceImportance", RELIANCE_LEVELS, "Medium"),
        suggestedReviewCadence: text(formData, "suggestedReviewCadence"),
        linkedCaveat: text(formData, "linkedCaveat"),
        conditionText: text(formData, "conditionText"),
        status: "Active",
        sourceType: sourceDocumentId ? "Document" : "Manual",
        sourceDocumentId,
        sourcePageParagraph: text(formData, "sourcePageParagraph"),
        createdById: context.userId,
        notes: text(formData, "notes"),
      },
    });
    await linkSourceDocument(tx, context, sourceDocumentId, { assumptionId: created.id }, created.sourcePageParagraph);
    await recordUserAuditEvent(
      context,
      {
        action: "assumption_created",
        target: { objectType: "Assumption", objectId: created.id, entityId },
        after: created,
      },
      tx,
    );
  });
  revalidatePath("/assumptions");
}

export async function updateAssumption(id: string, formData: FormData): Promise<void> {
  const context = await requirePermission("record:write");
  await prisma.$transaction(async (tx) => {
    const before = await tx.assumption.findFirst({ where: { id, organisationId: context.orgId } });
    if (!before) throw new Error("Assumption not found.");
    const after = await tx.assumption.update({
      where: { id },
      data: {
        status: choice(
          formData,
          "status",
          ASSUMPTION_STATUSES,
          before.status as (typeof ASSUMPTION_STATUSES)[number],
        ),
        relianceImportance: choice(
          formData,
          "relianceImportance",
          RELIANCE_LEVELS,
          before.relianceImportance as (typeof RELIANCE_LEVELS)[number],
        ),
        notes: formData.has("notes") ? text(formData, "notes") : undefined,
      },
    });
    await recordUserAuditEvent(
      context,
      {
        action: "assumption_updated",
        target: { objectType: "Assumption", objectId: id, entityId: after.entityId },
        before,
        after,
        reason: text(formData, "reason"),
      },
      tx,
    );
  });
  revalidatePath("/assumptions");
}

export async function createCaveat(formData: FormData): Promise<void> {
  const context = await requirePermission("record:write");
  const entityId = text(formData, "entityId");
  const sourceDocumentId = text(formData, "sourceDocumentId");
  await requireLinkedDocument(context, sourceDocumentId);

  await prisma.$transaction(async (tx) => {
    await assertOrgLinks(tx, context.orgId, { entityId, documentId: sourceDocumentId });
    const created = await tx.caveat.create({
      data: {
        organisationId: context.orgId,
        entityId,
        caveatText: requiredText(formData, "caveatText", "Caveat"),
        relatedTopic: text(formData, "relatedTopic"),
        impactIfUnresolved: text(formData, "impactIfUnresolved"),
        sourceDocumentId,
        sourcePageParagraph: text(formData, "sourcePageParagraph"),
        createdById: context.userId,
      },
    });
    await linkSourceDocument(tx, context, sourceDocumentId, { caveatId: created.id }, created.sourcePageParagraph);
    await recordUserAuditEvent(
      context,
      {
        action: "caveat_created",
        target: { objectType: "Caveat", objectId: created.id, entityId },
        after: created,
      },
      tx,
    );
  });
  revalidatePath("/caveats");
}

export async function updateCaveat(id: string, formData: FormData): Promise<void> {
  const context = await requirePermission("record:write");
  await prisma.$transaction(async (tx) => {
    const before = await tx.caveat.findFirst({ where: { id, organisationId: context.orgId } });
    if (!before) throw new Error("Caveat not found.");
    const status = choice(formData, "status", CAVEAT_STATUSES, before.status as (typeof CAVEAT_STATUSES)[number]);
    const after = await tx.caveat.update({
      where: { id },
      data: {
        status,
        resolutionNote: formData.has("resolutionNote")
          ? text(formData, "resolutionNote")
          : undefined,
      },
    });
    await recordUserAuditEvent(
      context,
      {
        action: "caveat_updated",
        target: { objectType: "Caveat", objectId: id, entityId: after.entityId },
        before,
        after,
        reason: text(formData, "reason"),
      },
      tx,
    );
  });
  revalidatePath("/caveats");
}

export async function createTripwire(formData: FormData): Promise<void> {
  const context = await requirePermission("record:write");
  const entityId = text(formData, "entityId");
  const sourceDocumentId = text(formData, "sourceDocumentId");
  await requireLinkedDocument(context, sourceDocumentId);

  await prisma.$transaction(async (tx) => {
    await assertOrgLinks(tx, context.orgId, { entityId, documentId: sourceDocumentId });
    const created = await tx.tripwire.create({
      data: {
        organisationId: context.orgId,
        entityId,
        description: requiredText(formData, "description", "Description"),
        triggerEvent: requiredText(formData, "triggerEvent", "Trigger event"),
        reviewDateOrDeadline: dateValue(formData, "reviewDateOrDeadline"),
        reviewCadence: text(formData, "reviewCadence"),
        disarmCondition: text(formData, "disarmCondition"),
        conditionText: text(formData, "conditionText"),
        sourceType: sourceDocumentId ? "Document" : "Manual",
        sourceDocumentId,
        sourcePageParagraph: text(formData, "sourcePageParagraph"),
        createdById: context.userId,
        notes: text(formData, "notes"),
      },
    });
    await linkSourceDocument(tx, context, sourceDocumentId, { tripwireId: created.id }, created.sourcePageParagraph);
    await recordUserAuditEvent(
      context,
      {
        action: "tripwire_created",
        target: { objectType: "Tripwire", objectId: created.id, entityId },
        after: created,
      },
      tx,
    );
  });
  revalidatePath("/tripwires");
}

export async function updateTripwire(id: string, formData: FormData): Promise<void> {
  const context = await requirePermission("record:write");
  await prisma.$transaction(async (tx) => {
    const before = await tx.tripwire.findFirst({ where: { id, organisationId: context.orgId } });
    if (!before) throw new Error("Tripwire not found.");
    const after = await tx.tripwire.update({
      where: { id },
      data: {
        status: choice(
          formData,
          "status",
          TRIPWIRE_STATUSES,
          before.status as (typeof TRIPWIRE_STATUSES)[number],
        ),
        notes: formData.has("notes") ? text(formData, "notes") : undefined,
      },
    });
    await recordUserAuditEvent(
      context,
      {
        action: "tripwire_updated",
        target: { objectType: "Tripwire", objectId: id, entityId: after.entityId },
        before,
        after,
        reason: text(formData, "reason"),
      },
      tx,
    );
  });
  revalidatePath("/tripwires");
}

export async function createException(formData: FormData): Promise<void> {
  const context = await requirePermission("record:write");
  const links = {
    entityId: text(formData, "entityId"),
    obligationId: text(formData, "obligationId"),
    actionId: text(formData, "actionId"),
    assumptionId: text(formData, "assumptionId"),
    caveatId: text(formData, "caveatId"),
    tripwireId: text(formData, "tripwireId"),
    documentId: text(formData, "documentId"),
  };
  const ownerId = requiredText(formData, "ownerId", "Owner");
  assertAtLeastOneTarget("Exception", Object.values(links));
  await requireLinkedDocument(context, links.documentId);

  await prisma.$transaction(async (tx) => {
    const resolvedEntityId = await assertOrgLinks(tx, context.orgId, { ...links, userIds: [ownerId] });
    const created = await tx.exception.create({
      data: {
        organisationId: context.orgId,
        ...links,
        entityId: resolvedEntityId,
        title: requiredText(formData, "title", "Title"),
        reason: requiredText(formData, "exceptionReason", "Reason"),
        severity: choice(formData, "severity", EXCEPTION_SEVERITIES, "Medium"),
        status: "Open",
        blocksFiling: checked(formData, "blocksFiling"),
        ownerId,
        targetResolutionDate: dateValue(formData, "targetResolutionDate"),
      },
    });
    if (created.obligationId || created.actionId) {
      await syncExceptionTarget(tx, created);
    }
    await linkSourceDocument(tx, context, links.documentId, { exceptionId: created.id });
    await recordUserAuditEvent(
      context,
      {
        action: "exception_created",
        target: {
          objectType: "Exception",
          objectId: created.id,
          entityId: created.entityId,
          obligationId: created.obligationId,
          actionId: created.actionId,
        },
        after: created,
      },
      tx,
    );
  });
  revalidatePath("/exceptions");
}

export async function updateException(id: string, formData: FormData): Promise<void> {
  const context = await requireOrg();
  const ownerId = text(formData, "ownerId");
  await prisma.$transaction(async (tx) => {
    const before = await tx.exception.findFirst({ where: { id, organisationId: context.orgId } });
    if (!before) throw new Error("Exception not found.");
    if (ownerId) await assertOrgLinks(tx, context.orgId, { userIds: [ownerId] });
    const status = choice(
      formData,
      "status",
      EXCEPTION_STATUSES,
      before.status as (typeof EXCEPTION_STATUSES)[number],
    );
    const resolved = isResolvedExceptionStatus(status);
    const finalOwnerId = formData.has("ownerId") ? ownerId : before.ownerId;
    const removingBlocker =
      before.blocksFiling && formData.has("blocksFiling") && !checked(formData, "blocksFiling");
    const controlledTransition =
      resolved || isResolvedExceptionStatus(before.status) || removingBlocker;
    assertPermission(
      context.user.role,
      controlledTransition ? "review:perform" : "record:write",
    );
    const resolutionNote = formData.has("resolutionNote")
      ? text(formData, "resolutionNote")
      : before.resolutionNote;
    if (resolved && !resolutionNote) {
      throw new Error("A resolution or risk-acceptance note is required.");
    }
    if (resolved && finalOwnerId === context.userId) {
      throw new Error("The exception owner cannot approve their own resolution or risk acceptance.");
    }
    const after = await tx.exception.update({
      where: { id },
      data: {
        status,
        ownerId: formData.has("ownerId") ? ownerId : undefined,
        blocksFiling: formData.has("blocksFiling")
          ? checked(formData, "blocksFiling")
          : undefined,
        resolutionNote: formData.has("resolutionNote") ? resolutionNote : undefined,
        resolvedById: resolved ? context.userId : null,
        resolvedAt: resolved ? new Date() : null,
      },
    });
    if (after.obligationId || after.actionId) {
      await syncExceptionTarget(tx, after);
    }
    await recordUserAuditEvent(
      context,
      {
        action: resolved ? "exception_resolved" : "exception_updated",
        target: {
          objectType: "Exception",
          objectId: id,
          entityId: after.entityId,
          obligationId: after.obligationId,
          actionId: after.actionId,
        },
        before,
        after,
        reason: text(formData, "reason"),
      },
      tx,
    );
  });
  revalidatePath("/exceptions");
}

export async function createEvidenceItem(formData: FormData): Promise<void> {
  const context = await requirePermission("record:write");
  const links = {
    entityId: text(formData, "entityId"),
    obligationId: text(formData, "obligationId"),
    actionId: text(formData, "actionId"),
    assumptionId: text(formData, "assumptionId"),
    caveatId: text(formData, "caveatId"),
    tripwireId: text(formData, "tripwireId"),
    exceptionId: text(formData, "exceptionId"),
    documentId: text(formData, "documentId"),
  };
  const ownerId = requiredText(formData, "ownerId", "Owner");
  const initialStatus = choice(formData, "status", EVIDENCE_STATUSES, "Required");
  if (!["Required", "Requested", "Received"].includes(initialStatus)) {
    throw new Error("Evidence must be independently reviewed after it is created.");
  }
  assertAtLeastOneTarget("Evidence", Object.values(links));
  await requireLinkedDocument(context, links.documentId);

  await prisma.$transaction(async (tx) => {
    const resolvedEntityId = await assertOrgLinks(tx, context.orgId, { ...links, userIds: [ownerId] });
    const created = await tx.evidenceItem.create({
      data: {
        organisationId: context.orgId,
        ...links,
        entityId: resolvedEntityId,
        title: requiredText(formData, "title", "Title"),
        evidenceType: text(formData, "evidenceType"),
        description: text(formData, "description"),
        status: initialStatus,
        requiredBy: dateValue(formData, "requiredBy"),
        ownerId,
      },
    });
    await syncEvidenceTarget(tx, created);
    await linkSourceDocument(tx, context, links.documentId, { evidenceId: created.id });
    await recordUserAuditEvent(
      context,
      {
        action: "evidence_item_created",
        target: {
          objectType: "EvidenceItem",
          objectId: created.id,
          entityId: created.entityId,
          obligationId: created.obligationId,
          actionId: created.actionId,
        },
        after: created,
      },
      tx,
    );
  });
  revalidatePath("/evidence");
}

export async function updateEvidenceItem(id: string, formData: FormData): Promise<void> {
  const context = await requireOrg();
  const ownerId = text(formData, "ownerId");
  await prisma.$transaction(async (tx) => {
    const before = await tx.evidenceItem.findFirst({ where: { id, organisationId: context.orgId } });
    if (!before) throw new Error("Evidence item not found.");
    if (ownerId) await assertOrgLinks(tx, context.orgId, { userIds: [ownerId] });
    const status = choice(
      formData,
      "status",
      EVIDENCE_STATUSES,
      before.status as (typeof EVIDENCE_STATUSES)[number],
    );
    if (status === "Waived") {
      throw new Error("Use an independent Evidence waiver approval gate to waive evidence.");
    }
    const independentlyReviewed = status === "Verified" || status === "Rejected";
    const wasIndependentlyReviewed = before.status === "Verified" || before.status === "Rejected";
    assertPermission(
      context.user.role,
      independentlyReviewed || wasIndependentlyReviewed ? "review:perform" : "record:write",
    );
    const finalOwnerId = formData.has("ownerId") ? ownerId : before.ownerId;
    if (independentlyReviewed && finalOwnerId === context.userId) {
      throw new Error("The evidence owner cannot verify or reject their own evidence.");
    }
    const verificationNote = formData.has("verificationNote")
      ? text(formData, "verificationNote")
      : before.verificationNote;
    if (independentlyReviewed && !verificationNote) {
      throw new Error("A verification note is required for an evidence decision.");
    }
    const verified = status === "Verified";
    const after = await tx.evidenceItem.update({
      where: { id },
      data: {
        status,
        ownerId: formData.has("ownerId") ? ownerId : undefined,
        verificationNote: formData.has("verificationNote") ? verificationNote : undefined,
        verifiedAt: verified ? new Date() : null,
        verifiedById: verified ? context.userId : null,
      },
    });
    await syncEvidenceTarget(tx, after);
    await recordUserAuditEvent(
      context,
      {
        action: verified ? "evidence_item_verified" : "evidence_item_updated",
        target: {
          objectType: "EvidenceItem",
          objectId: id,
          entityId: after.entityId,
          obligationId: after.obligationId,
          actionId: after.actionId,
        },
        before,
        after,
        reason: text(formData, "reason"),
      },
      tx,
    );
  });
  revalidatePath("/evidence");
}

export async function createDataRequest(formData: FormData): Promise<void> {
  const context = await requirePermission("record:write");
  const entityId = text(formData, "entityId");
  const obligationId = text(formData, "obligationId");
  const actionId = text(formData, "actionId");
  const requestedFromPartyId = text(formData, "requestedFromPartyId");
  const requestedFromDepartment = text(formData, "requestedFromDepartment");
  const assignedToId = text(formData, "assignedToId");
  const description = requiredText(formData, "description", "Description");
  const initialStatus = choice(formData, "status", DATA_REQUEST_STATUSES, "Open");
  if (!["Draft", "Open"].includes(initialStatus)) {
    throw new Error("A data request must start as Draft or Open.");
  }
  if (!requestedFromPartyId && !requestedFromDepartment) {
    throw new Error("Choose a party or enter a department for the request.");
  }
  const dueDate = dateValue(formData, "dueDate");
  if (!dueDate) throw new Error("Due date is required.");
  const reminderOwnerId = assignedToId ?? context.userId;
  const reminders = reminderRows({ formData, ownerId: reminderOwnerId, description });

  await prisma.$transaction(async (tx) => {
    const resolvedEntityId = await assertOrgLinks(tx, context.orgId, {
      entityId,
      obligationId,
      actionId,
      partyId: requestedFromPartyId,
      userIds: [assignedToId],
    });
    const created = await tx.dataRequest.create({
      data: {
        organisationId: context.orgId,
        entityId: resolvedEntityId,
        obligationId,
        actionId,
        requestedFromPartyId,
        requestedFromDepartment,
        description,
        status: initialStatus,
        dueDate,
        escalationDate: dateValue(formData, "escalationDate"),
        createdById: context.userId,
        assignedToId,
        reminders: reminders.length
          ? {
              create: reminders.map((reminder) => ({
                ...reminder,
                organisationId: context.orgId,
              })),
            }
          : undefined,
      },
      include: { reminders: true },
    });
    await syncDataRequestTarget(tx, created);
    await recordUserAuditEvent(
      context,
      {
        action: "data_request_created",
        target: {
          objectType: "DataRequest",
          objectId: created.id,
          entityId: resolvedEntityId,
          obligationId,
          actionId,
        },
        after: created,
      },
      tx,
    );
  });
  revalidatePath("/data-requests");
}

export async function updateDataRequest(id: string, formData: FormData): Promise<void> {
  const context = await requireOrg();
  const assignedToId = text(formData, "assignedToId");
  await prisma.$transaction(async (tx) => {
    const before = await tx.dataRequest.findFirst({
      where: { id, organisationId: context.orgId },
      include: { reminders: true },
    });
    if (!before) throw new Error("Data request not found.");
    if (assignedToId) await assertOrgLinks(tx, context.orgId, { userIds: [assignedToId] });
    const status = choice(
      formData,
      "status",
      DATA_REQUEST_STATUSES,
      before.status as (typeof DATA_REQUEST_STATUSES)[number],
    );
    const reviewedTransition =
      ["Validated", "Cancelled"].includes(status) ||
      ["Validated", "Cancelled"].includes(before.status);
    assertPermission(
      context.user.role,
      reviewedTransition ? "review:perform" : "record:write",
    );

    if (formData.has("reminderDate") || formData.has("escalationDate")) {
      await tx.reminder.deleteMany({
        where: { dataRequestId: id, status: "Scheduled" },
      });
      const reminders = reminderRows({
        formData,
        ownerId: assignedToId ?? before.assignedToId ?? context.userId,
        description: before.description,
      });
      if (reminders.length) {
        await tx.reminder.createMany({
          data: reminders.map((reminder) => ({
            ...reminder,
            organisationId: context.orgId,
            dataRequestId: id,
          })),
        });
      }
    }

    const after = await tx.dataRequest.update({
      where: { id },
      data: {
        status,
        assignedToId: formData.has("assignedToId") ? assignedToId : undefined,
        responseNote: formData.has("responseNote")
          ? text(formData, "responseNote")
          : undefined,
        dueDate: formData.has("dueDate") ? dateValue(formData, "dueDate") : undefined,
        escalationDate: formData.has("escalationDate")
          ? dateValue(formData, "escalationDate")
          : undefined,
        completedAt: isCompletedDataRequestStatus(status) ? new Date() : null,
      },
      include: { reminders: true },
    });
    await syncDataRequestTarget(tx, after);
    await recordUserAuditEvent(
      context,
      {
        action: "data_request_updated",
        target: {
          objectType: "DataRequest",
          objectId: id,
          entityId: after.entityId,
          obligationId: after.obligationId,
          actionId: after.actionId,
        },
        before,
        after,
        reason: text(formData, "reason"),
      },
      tx,
    );
  });
  revalidatePath("/data-requests");
}

export async function createApproval(formData: FormData): Promise<void> {
  const context = await requirePermission("record:write");
  const entityId = text(formData, "entityId");
  const obligationId = text(formData, "obligationId");
  const actionId = text(formData, "actionId");
  const approverId = requiredText(formData, "approverId", "Approver");
  const gate = choice(formData, "gate", APPROVAL_GATES, "Accountable approval");
  assertApprovalRequest(context.userId, approverId);
  assertExactlyOneApprovalTarget(obligationId, actionId);

  await prisma.$transaction(async (tx) => {
    const resolvedEntityId = await assertOrgLinks(tx, context.orgId, {
      entityId,
      obligationId,
      actionId,
      userIds: [approverId],
    });
    const approver = await tx.user.findFirst({ where: { id: approverId, organisationId: context.orgId } });
    if (!approver || !hasPermission(approver.role, "approval:decide")) {
      throw new Error("The selected user does not have approval permission.");
    }
    const targetWhere = obligationId ? { obligationId } : { actionId: actionId! };
    const pending = await tx.approval.count({
      where: { organisationId: context.orgId, ...targetWhere, gate, status: "Pending" },
    });
    if (pending > 0) {
      throw new Error("This control gate already has a pending approval.");
    }
    const superseded = await tx.approval.updateMany({
      where: {
        organisationId: context.orgId,
        ...targetWhere,
        gate,
        status: { in: ["Approved", "Rejected", "Cancelled"] },
      },
      data: { status: "Superseded" },
    });
    const created = await tx.approval.create({
      data: {
        organisationId: context.orgId,
        entityId: resolvedEntityId,
        obligationId,
        actionId,
        gate,
        status: "Pending",
        requestedById: context.userId,
        approverId,
      },
    });
    await syncApprovalTarget(tx, created);
    await recordUserAuditEvent(
      context,
      {
        action: "approval_requested",
        target: {
          objectType: "Approval",
          objectId: created.id,
          entityId: resolvedEntityId,
          obligationId,
          actionId,
        },
        after: created,
        detail: `${superseded.count} prior decision(s) superseded by this approval cycle.`,
      },
      tx,
    );
  });
  revalidatePath("/approvals");
}

export async function decideApproval(id: string, decision: string, formData: FormData): Promise<void> {
  const context = await requirePermission("approval:decide");
  const approvedDecision = allowedValue(
    decision,
    APPROVAL_DECISIONS,
    "decision",
    "Rejected",
  );
  const decisionNote = text(formData, "decisionNote");
  if (approvedDecision === "Rejected" && !decisionNote) {
    throw new Error("A rejection reason is required.");
  }

  await prisma.$transaction(async (tx) => {
    const before = await tx.approval.findFirst({ where: { id, organisationId: context.orgId } });
    if (!before) throw new Error("Approval not found.");
    assertApprovalDecision({
      actorId: context.userId,
      actorRole: context.user.role,
      requesterId: before.requestedById,
      approverId: before.approverId,
      currentStatus: before.status,
      decision: approvedDecision,
    });
    const updated = await tx.approval.updateMany({
      where: { id, organisationId: context.orgId, status: "Pending" },
      data: {
        status: approvedDecision,
        decidedById: context.userId,
        decidedAt: new Date(),
        decisionNote,
      },
    });
    if (updated.count !== 1) {
      throw new Error("This approval was already decided by another request.");
    }
    const after = await tx.approval.findUnique({ where: { id } });
    if (!after) throw new Error("Approval not found after decision.");
    await syncApprovalTarget(tx, after);
    await recordUserAuditEvent(
      context,
      {
        action: approvedDecision === "Approved" ? "approval_approved" : "approval_rejected",
        target: {
          objectType: "Approval",
          objectId: id,
          entityId: after.entityId,
          obligationId: after.obligationId,
          actionId: after.actionId,
        },
        before,
        after,
        reason: after.decisionNote,
      },
      tx,
    );
  });
  revalidatePath("/approvals");
}
