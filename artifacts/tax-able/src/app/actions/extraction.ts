"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MODEL, PROMPT_VERSION, SCHEMA_VERSION } from "@/lib/ai-extraction";
import { workOneExtractionRun } from "@/lib/extraction-worker";
import { processExtractionRun as processQueuedExtractionRun } from "@/lib/process-extraction-run";
import { Prisma, type ReviewItem } from "@prisma/client";
import { requirePermission, type OrgContext } from "@/lib/auth";
import { documentAccessWhere, requireDocumentAccess } from "@/lib/authz";

const LOW_CONFIDENCE_THRESHOLD = 0.5;
type LinkedRecordType = "Obligation" | "Action" | "Assumption" | "Caveat" | "Tripwire" | "Evidence" | "Exception";

function targetKey(type: LinkedRecordType) {
  return {
    Obligation: "obligationId",
    Action: "actionId",
    Assumption: "assumptionId",
    Caveat: "caveatId",
    Tripwire: "tripwireId",
    Evidence: "evidenceId",
    Exception: "exceptionId",
  }[type] as "obligationId" | "actionId" | "assumptionId" | "caveatId" | "tripwireId" | "evidenceId" | "exceptionId";
}

async function persistReviewLineage(
  tx: Prisma.TransactionClient,
  item: ReviewItem,
  type: LinkedRecordType,
  recordId: string,
  context: OrgContext,
  relationType: "Created" | "Linked",
) {
  const key = targetKey(type);
  await tx.reviewItemRecordLink.createMany({
    data: [{
      organisationId: context.orgId,
      reviewItemId: item.id,
      relationType,
      createdById: context.userId,
      [key]: recordId,
    }] as Prisma.ReviewItemRecordLinkCreateManyInput[],
    skipDuplicates: true,
  });
  await tx.documentRecordLink.createMany({
    data: [{
      organisationId: context.orgId,
      documentId: item.documentId,
      linkType: "Source",
      pageReference: item.sourcePageSection,
      sourceExcerpt: item.sourceTextExcerpt,
      createdById: context.userId,
      [key]: recordId,
    }] as Prisma.DocumentRecordLinkCreateManyInput[],
    skipDuplicates: true,
  });
}

async function requireReviewItem(itemId: string) {
  const context = await requirePermission("review:perform");
  const item = await prisma.reviewItem.findFirst({
    where: {
      id: itemId,
      organisationId: context.orgId,
      document: documentAccessWhere(context, "review"),
    },
    include: { document: true },
  });
  if (!item) throw new Error("Review item not found or access denied.");
  return { context, item };
}

async function assertEntityInOrganisation(entityId: string, organisationId: string) {
  const entity = await prisma.entity.findFirst({
    where: { id: entityId, organisationId, deletedAt: null },
    select: { id: true },
  });
  if (!entity) throw new Error("Entity not found.");
}

export async function startExtraction(documentId: string) {
  const { context } = await requireDocumentAccess(documentId, "edit");
  const orgId = context.orgId;

  const doc = await prisma.document.findFirst({
    where: { id: documentId, organisationId: orgId, deletedAt: null },
    include: { chunks: true },
  });
  if (!doc) throw new Error("Document not found.");
  if (doc.chunks.length === 0 || !doc.chunks.some((chunk) => chunk.text.trim().length > 0)) {
    throw new Error("Document has no extracted text. Please upload a document with readable text.");
  }

  const run = await prisma.extractionRun.create({
    data: {
      organisationId: orgId,
      documentId,
      modelProvider: "openai",
      modelName: MODEL,
      promptVersion: PROMPT_VERSION,
      extractionSchemaVersion: SCHEMA_VERSION,
      status: "Pending",
      createdById: context.userId,
    },
  });

  await prisma.auditEvent.create({
    data: {
      organisationId: orgId,
      userId: context.userId,
      entityId: doc.entityId ?? null,
      action: "extraction_run_queued",
      detail: `AI extraction queued for document: ${doc.filename} (run ${run.id}, model ${MODEL}).`,
    },
  });

  // Wake the persisted worker opportunistically. If this process dies, the standalone worker
  // reclaims the expired lease instead of leaving an untracked detached promise.
  void workOneExtractionRun(processQueuedExtractionRun).catch((error) => {
    console.error("Failed to wake extraction worker", error);
  });

  revalidatePath(`/documents/${documentId}`);
  redirect(`/documents/${documentId}/extraction/${run.id}`);
}

const STATUS_AUDIT_ACTION: Record<string, string> = {
  Rejected: "review_item_rejected",
  Duplicate: "review_item_marked_duplicate",
  "Not applicable": "review_item_marked_not_applicable",
  "Reviewed - no record required": "review_item_reviewed_no_record_required",
  "Needs adviser input": "review_item_marked_needs_adviser_input",
  "Needs source verification": "review_item_marked_needs_source_verification",
  "In review": "review_item_marked_in_review",
};

const OPEN_REVIEW_STATUSES = new Set([
  "Needs review",
  "In review",
  "Needs adviser input",
  "Needs source verification",
]);
const WORKFLOW_REVIEW_STATUSES = new Set([
  "In review",
  "Needs adviser input",
  "Needs source verification",
]);
const NO_RECORD_FINAL_STATUSES = new Set([
  "Rejected",
  "Duplicate",
  "Not applicable",
  "Reviewed - no record required",
]);

function assertOpenReviewItem(item: ReviewItem) {
  const legacyConfirmedWithoutRecord =
    ["Confirmed", "Edited and confirmed"].includes(item.reviewStatus) &&
    (!item.createdLiveObjectType || !item.createdLiveObjectId);
  if (!OPEN_REVIEW_STATUSES.has(item.reviewStatus) && !legacyConfirmedWithoutRecord) {
    throw new Error(`Review item is already final with status "${item.reviewStatus}".`);
  }
}

function assertWorkflowTransition(item: ReviewItem, status: string) {
  if (!WORKFLOW_REVIEW_STATUSES.has(status)) {
    throw new Error(
      "This status cannot be set directly. Confirmed items must create or link a durable record; final no-record outcomes require the disposition form."
    );
  }
  if (!OPEN_REVIEW_STATUSES.has(item.reviewStatus)) {
    throw new Error(`Cannot move a final review item from "${item.reviewStatus}" to "${status}".`);
  }
}

export async function updateReviewStatus(
  itemId: string,
  status: string,
  notes?: string,
  _rejectionReason?: string
) {
  const { context, item } = await requireReviewItem(itemId);
  const orgId = context.orgId;
  assertWorkflowTransition(item, status);

  await prisma.reviewItem.update({
    where: { id: itemId },
    data: {
      reviewStatus: status,
      reviewedById: context.userId,
      reviewedAt: null,
      reviewerNotes: notes?.trim() || item.reviewerNotes,
      rejectionReason: null,
    },
  });

  await prisma.auditEvent.create({
    data: {
      organisationId: orgId,
      userId: context.userId,
      entityId: item.entityId ?? null,
      action: STATUS_AUDIT_ACTION[status] ?? "review_item_status_changed",
      detail: `Review item ${itemId} (${item.itemType}) set to "${status}".${notes ? ` Note: ${notes}` : ""}`,
    },
  });

  revalidatePath(`/documents/${item.documentId}/extraction/${item.extractionRunId}`);
  revalidatePath("/review");
}

export async function editReviewItem(itemId: string, formData: FormData) {
  const { context, item } = await requireReviewItem(itemId);
  const orgId = context.orgId;
  assertOpenReviewItem(item);

  const plainSummaryEdit = (formData.get("plainSummary") as string)?.trim();
  const notes = (formData.get("reviewerNotes") as string)?.trim();
  if (!plainSummaryEdit) throw new Error("Summary cannot be empty.");

  await prisma.reviewItem.update({
    where: { id: itemId },
    data: {
      plainSummary: plainSummaryEdit,
      reviewStatus: "In review",
      reviewedById: context.userId,
      reviewedAt: null,
      reviewerNotes: notes || null,
      rejectionReason: null,
    },
  });

  await prisma.auditEvent.create({
    data: {
      organisationId: orgId,
      userId: context.userId,
      entityId: item.entityId ?? null,
      action: "review_item_edited_in_review",
      detail: `Review item ${itemId} (${item.itemType}) edited and kept in review by authenticated user ${context.userId}.`,
    },
  });

  revalidatePath(`/documents/${item.documentId}/extraction/${item.extractionRunId}`);
  revalidatePath("/review");
}

async function resolveSourceGuardrail(item: ReviewItem, formData: FormData) {
  const document = await prisma.document.findFirst({
    where: {
      id: item.documentId,
      organisationId: item.organisationId,
      deletedAt: null,
    },
    select: { isAuthoritativeSource: true },
  });
  const sourceVerified = formData.get("sourceVerified") === "on";
  const sourceOverrideReason =
    (formData.get("sourceOverrideReason") as string)?.trim() || "";
  const needsSourceGuardrail =
    !document ||
    item.requiresSourceVerification ||
    document.isAuthoritativeSource !== "Yes";

  if (needsSourceGuardrail && !sourceVerified && !sourceOverrideReason) {
    throw new Error(
      "This item requires source verification — verify the source or provide a specific source override rationale before making a final decision."
    );
  }

  return {
    sourceVerified,
    sourceOverrideReason: sourceOverrideReason || null,
  };
}

export async function finalizeReviewWithoutRecord(
  itemId: string,
  formData: FormData
) {
  const { context, item } = await requireReviewItem(itemId);
  assertOpenReviewItem(item);

  const status = String(formData.get("reviewStatus") ?? "").trim();
  if (!NO_RECORD_FINAL_STATUSES.has(status)) {
    throw new Error("Select an allowed reviewed/no-record disposition.");
  }
  const dispositionReason = String(
    formData.get("dispositionReason") ?? ""
  ).trim();
  if (!dispositionReason) {
    throw new Error("A disposition reason is required when no live record is created.");
  }

  const conditionDispositionNote = String(
    formData.get("conditionDispositionNote") ?? ""
  ).trim();
  if (item.isConditional && !conditionDispositionNote) {
    throw new Error(
      "This item is conditional — explain how the condition was considered before closing it without a live record."
    );
  }
  const reviewerNotes = (formData.get("reviewerNotes") as string)?.trim();
  const { sourceVerified, sourceOverrideReason } = await resolveSourceGuardrail(
    item,
    formData
  );

  await prisma.$transaction(async (tx) => {
    const existingLink = await tx.reviewItemRecordLink.findFirst({
      where: { reviewItemId: item.id, organisationId: context.orgId },
      select: { id: true },
    });
    if (existingLink) {
      throw new Error(
        "This review item already has a durable record link and cannot be closed as no-record-required."
      );
    }
    await tx.reviewItem.update({
      where: { id: item.id },
      data: {
        reviewStatus: status,
        reviewedById: context.userId,
        reviewedAt: new Date(),
        reviewerNotes: reviewerNotes || null,
        rejectionReason: dispositionReason,
        requiresSourceVerification: sourceVerified
          ? false
          : item.requiresSourceVerification,
        createdLiveObjectType: null,
        createdLiveObjectId: null,
      },
    });
    await tx.auditEvent.create({
      data: {
        organisationId: context.orgId,
        userId: context.userId,
        entityId: item.entityId ?? null,
        objectType: "ReviewItem",
        objectId: item.id,
        action:
          STATUS_AUDIT_ACTION[status] ?? "review_item_finalised_without_record",
        reason: dispositionReason,
        detail: `Review item ${item.id} (${item.itemType}) finalised as "${status}" without a live record.`,
      },
    });
    if (conditionDispositionNote) {
      await tx.auditEvent.create({
        data: {
          organisationId: context.orgId,
          userId: context.userId,
          entityId: item.entityId ?? null,
          objectType: "ReviewItem",
          objectId: item.id,
          action: "review_item_condition_considered",
          reason: conditionDispositionNote,
          detail: `Conditionality considered for no-record disposition on review item ${item.id}.`,
        },
      });
    }
    if (sourceVerified) {
      await tx.auditEvent.create({
        data: {
          organisationId: context.orgId,
          userId: context.userId,
          entityId: item.entityId ?? null,
          objectType: "ReviewItem",
          objectId: item.id,
          action: "review_item_source_verified",
          detail: `Reviewer attested that the source was independently verified for review item ${item.id}.`,
        },
      });
    }
    if (sourceOverrideReason) {
      await tx.auditEvent.create({
        data: {
          organisationId: context.orgId,
          userId: context.userId,
          entityId: item.entityId ?? null,
          objectType: "ReviewItem",
          objectId: item.id,
          action: "source_override_used",
          reason: sourceOverrideReason,
          detail: `Source override used for no-record disposition on review item ${item.id}.`,
        },
      });
    }
  });

  revalidatePath(
    `/documents/${item.documentId}/extraction/${item.extractionRunId}`
  );
  revalidatePath("/review");
}

export async function linkReviewItemToExisting(itemId: string, formData: FormData) {
  const { context, item } = await requireReviewItem(itemId);
  const orgId = context.orgId;
  const {
    notes,
    conditionResolutionNote,
    conditionPreservedInLinkedRecord,
    sourceVerified,
    sourceOverrideReason,
  } = await runConfirmGuardrails(item, formData, {
    requireLinkedConditionAcknowledgement: true,
  });

  const liveObjectType = formData.get("liveObjectType") as string;
  const liveObjectId = (formData.get("liveObjectId") as string)?.trim();
  if (!liveObjectType || !liveObjectId) throw new Error("Both a type and an ID are required to link to an existing record.");

  const exists =
    liveObjectType === "Obligation"
      ? await prisma.obligation.findFirst({ where: { id: liveObjectId, organisationId: orgId, deletedAt: null }, select: { id: true } })
      : liveObjectType === "Action"
        ? await prisma.action.findFirst({ where: { id: liveObjectId, organisationId: orgId, deletedAt: null }, select: { id: true } })
        : liveObjectType === "Assumption"
          ? await prisma.assumption.findFirst({ where: { id: liveObjectId, organisationId: orgId }, select: { id: true } })
          : liveObjectType === "Caveat"
            ? await prisma.caveat.findFirst({ where: { id: liveObjectId, organisationId: orgId }, select: { id: true } })
            : liveObjectType === "Tripwire"
              ? await prisma.tripwire.findFirst({ where: { id: liveObjectId, organisationId: orgId }, select: { id: true } })
              : liveObjectType === "Evidence"
                ? await prisma.evidenceItem.findFirst({ where: { id: liveObjectId, organisationId: orgId }, select: { id: true } })
                : liveObjectType === "Exception"
                  ? await prisma.exception.findFirst({ where: { id: liveObjectId, organisationId: orgId }, select: { id: true } })
                  : null;
  if (!exists) throw new Error("The target record does not exist in this organisation.");
  const linkedType = liveObjectType as LinkedRecordType;

  await prisma.$transaction(async (tx) => {
    await tx.reviewItem.update({
      where: { id: itemId },
      data: {
        reviewStatus: "Confirmed",
        reviewedById: context.userId,
        reviewedAt: new Date(),
        reviewerNotes: notes || item.reviewerNotes,
        requiresSourceVerification: false,
        createdLiveObjectType: liveObjectType,
        createdLiveObjectId: liveObjectId,
      },
    });
    await persistReviewLineage(tx, item, linkedType, liveObjectId, context, "Linked");
    await tx.auditEvent.create({
      data: {
        organisationId: orgId,
        userId: context.userId,
        entityId: item.entityId ?? null,
        objectType: liveObjectType,
        objectId: liveObjectId,
        obligationId: liveObjectType === "Obligation" ? liveObjectId : null,
        actionId: liveObjectType === "Action" ? liveObjectId : null,
        action: "REVIEW_ITEM_LINKED",
        detail: `Review item ${itemId} (${item.itemType}) linked to existing ${liveObjectType} ${liveObjectId}.`,
      },
    });
    if (conditionResolutionNote) {
      await tx.auditEvent.create({
        data: {
          organisationId: orgId,
          userId: context.userId,
          entityId: item.entityId ?? null,
          objectType: "ReviewItem",
          objectId: item.id,
          action: "conditional_item_resolved",
          reason: conditionResolutionNote,
          detail: `Condition resolved before linking review item ${item.id} to ${liveObjectType} ${liveObjectId}.`,
        },
      });
    }
    if (conditionPreservedInLinkedRecord) {
      await tx.auditEvent.create({
        data: {
          organisationId: orgId,
          userId: context.userId,
          entityId: item.entityId ?? null,
          objectType: "ReviewItem",
          objectId: item.id,
          action: "linked_record_condition_verified",
          detail: `Reviewer verified that the linked ${liveObjectType} ${liveObjectId} preserves the condition from review item ${item.id}.`,
        },
      });
    }
    if (sourceVerified) {
      await tx.auditEvent.create({
        data: {
          organisationId: orgId,
          userId: context.userId,
          entityId: item.entityId ?? null,
          objectType: "ReviewItem",
          objectId: item.id,
          action: "review_item_source_verified",
          detail: `Reviewer attested that the source was independently verified before linking review item ${item.id}.`,
        },
      });
    }
    if (sourceOverrideReason) {
      await tx.auditEvent.create({
        data: {
          organisationId: orgId,
          userId: context.userId,
          entityId: item.entityId ?? null,
          objectType: "ReviewItem",
          objectId: item.id,
          action: "source_override_used",
          reason: sourceOverrideReason,
          detail: `Source override used before linking review item ${item.id}.`,
        },
      });
    }
  });

  revalidatePath(`/documents/${item.documentId}/extraction/${item.extractionRunId}`);
  revalidatePath("/review");
}

/**
 * Shared guardrails applied before any confirmed review item is allowed to
 * create or link a durable live control record. Throws with a message
 * safe to surface to the reviewer if a required confirmation is missing.
 */
async function runConfirmGuardrails(
  item: ReviewItem,
  formData: FormData,
  options: { requireLinkedConditionAcknowledgement?: boolean } = {}
) {
  assertOpenReviewItem(item);
  const notes = (formData.get("reviewerNotes") as string)?.trim() || "";

  if (item.confidenceScore < LOW_CONFIDENCE_THRESHOLD && !notes) {
    throw new Error("This is a low-confidence item — add a reviewer note before creating a live record from it.");
  }

  let conditionResolutionNote: string | null = null;
  const resolveCondition = formData.get("resolveCondition") === "on";
  const conditionPreservedInLinkedRecord =
    formData.get("conditionPreservedInLinkedRecord") === "on";
  if (item.isConditional) {
    if (resolveCondition) {
      conditionResolutionNote = (formData.get("conditionResolutionNote") as string)?.trim() || "";
      if (!conditionResolutionNote) {
        throw new Error("This item is conditional — add a note explaining why the condition no longer applies, or leave it as conditional.");
      }
    } else if (
      options.requireLinkedConditionAcknowledgement &&
      !conditionPreservedInLinkedRecord
    ) {
      throw new Error(
        "This item is conditional — confirm that the condition is represented in the linked record, or resolve it with a note."
      );
    }
  }

  const { sourceVerified, sourceOverrideReason } = await resolveSourceGuardrail(
    item,
    formData
  );

  return {
    notes,
    conditionResolutionNote,
    conditionPreservedInLinkedRecord,
    sourceVerified,
    sourceOverrideReason,
  };
}

async function finalizeConfirmedReviewItem(params: {
  item: ReviewItem;
  liveObjectType: LinkedRecordType;
  liveObjectId: string;
  wasEdited: boolean;
  notes: string;
  conditionResolutionNote: string | null;
  sourceOverrideReason: string | null;
  context: OrgContext;
  tx: Prisma.TransactionClient;
}) {
  const { item, liveObjectType, liveObjectId, wasEdited, notes, conditionResolutionNote, sourceOverrideReason, context, tx } = params;
  const orgId = context.orgId;

  await tx.reviewItem.update({
    where: { id: item.id },
    data: {
      reviewStatus: wasEdited ? "Edited and confirmed" : "Confirmed",
      reviewedById: context.userId,
      reviewedAt: new Date(),
      reviewerNotes: notes || item.reviewerNotes,
      requiresSourceVerification: false,
      createdLiveObjectType: liveObjectType,
      createdLiveObjectId: liveObjectId,
    },
  });
  await persistReviewLineage(tx, item, liveObjectType, liveObjectId, context, "Created");

  await tx.auditEvent.create({
    data: {
      organisationId: orgId,
      userId: context.userId,
      entityId: item.entityId ?? null,
      action: "live_object_created_from_review_item",
      detail: `${liveObjectType} ${liveObjectId} created from review item ${item.id} (${item.itemType}).`,
    },
  });

  if (conditionResolutionNote) {
    await tx.auditEvent.create({
      data: {
        organisationId: orgId,
        userId: context.userId,
        entityId: item.entityId ?? null,
        action: "conditional_item_resolved",
        detail: `Condition on review item ${item.id} resolved by authenticated user ${context.userId}: ${conditionResolutionNote}`,
      },
    });
  }

  if (sourceOverrideReason) {
    await tx.auditEvent.create({
      data: {
        organisationId: orgId,
        userId: context.userId,
        entityId: item.entityId ?? null,
        action: "source_override_used",
        detail: `Non-authoritative source override on review item ${item.id}: ${sourceOverrideReason}`,
      },
    });
  }

}

function revalidateConfirmedItem(item: ReviewItem) {
  revalidatePath(`/documents/${item.documentId}/extraction/${item.extractionRunId}`);
  revalidatePath("/obligations");
  revalidatePath("/actions-register");
  revalidatePath("/assumptions");
  revalidatePath("/caveats");
  revalidatePath("/tripwires");
  revalidatePath("/evidence");
  revalidatePath("/review");
}

export async function confirmItemAsObligation(itemId: string, formData: FormData) {
  const { context, item } = await requireReviewItem(itemId);
  const orgId = context.orgId;

  const { notes, conditionResolutionNote, sourceOverrideReason } = await runConfirmGuardrails(item, formData);

  const entityId = formData.get("entityId") as string;
  if (!entityId) throw new Error("Entity is required to create a live obligation.");
  await assertEntityInOrganisation(entityId, orgId);

  const regime = (formData.get("regime") as string) || item.suggestedRegime || "Unknown";
  const obligationType = (formData.get("obligationType") as string) || item.suggestedObligationType || "General";
  const description = formData.get("description") as string;
  const filingDeadlineRaw = formData.get("filingDeadline") as string;
  const periodStartRaw = formData.get("periodStart") as string;
  const periodEndRaw = formData.get("periodEnd") as string;
  const responsibleOwner = (formData.get("responsibleOwner") as string) || item.suggestedOwner || null;

  const wasEdited =
    regime !== (item.suggestedRegime ?? regime) ||
    obligationType !== (item.suggestedObligationType ?? obligationType) ||
    description !== item.plainSummary ||
    responsibleOwner !== (item.suggestedOwner ?? responsibleOwner);

  const conditionNote = conditionResolutionNote
    ? `Condition resolved: ${conditionResolutionNote}`
    : item.conditionText
    ? `Condition (preserved, unresolved): ${item.conditionText}`
    : null;

  const obligation = await prisma.$transaction(async (tx) => {
    const created = await tx.obligation.create({
      data: {
      organisationId: orgId,
      entityId,
      regime,
      obligationType,
      description,
      filingDeadline: filingDeadlineRaw ? new Date(filingDeadlineRaw) : null,
      periodStart: periodStartRaw ? new Date(periodStartRaw) : null,
      periodEnd: periodEndRaw ? new Date(periodEndRaw) : null,
      responsibleOwner,
      sourceType: "AI extraction",
      sourceDocumentReference: item.document.filename,
      sourceDocumentId: item.documentId,
      originatingReviewItemId: item.id,
      sourcePageParagraph: item.sourcePageSection ?? null,
      evidenceRequired: !!item.suggestedEvidenceRequired,
      evidenceDescription: item.suggestedEvidenceRequired ?? null,
      createdById: context.userId,
      lastUpdatedById: context.userId,
      notes: conditionNote,
      },
    });
    await finalizeConfirmedReviewItem({
      item, liveObjectType: "Obligation", liveObjectId: created.id, wasEdited, notes, conditionResolutionNote, sourceOverrideReason,
      context, tx,
    });
    return created;
  });
  revalidateConfirmedItem(item);

  redirect(`/documents/${item.documentId}/extraction/${item.extractionRunId}`);
}

export async function confirmItemAsAction(itemId: string, formData: FormData) {
  const { context, item } = await requireReviewItem(itemId);
  const orgId = context.orgId;

  const { notes, conditionResolutionNote, sourceOverrideReason } = await runConfirmGuardrails(item, formData);

  const entityId = formData.get("entityId") as string;
  if (!entityId) throw new Error("Entity is required to create a live action.");
  await assertEntityInOrganisation(entityId, orgId);

  const description = formData.get("description") as string;
  const responsibleParty = (formData.get("responsibleParty") as string) || null;
  const deadlineRaw = formData.get("deadline") as string;
  const evidenceDescription = (formData.get("evidenceDescription") as string) || item.suggestedEvidenceRequired || null;

  const wasEdited = description !== item.plainSummary;

  const action = await prisma.$transaction(async (tx) => {
    const created = await tx.action.create({
      data: {
      organisationId: orgId,
      entityId,
      description,
      responsibleParty: responsibleParty || item.suggestedOwner,
      deadline: deadlineRaw ? new Date(deadlineRaw) : null,
      evidenceDescription,
      evidenceRequired: !!evidenceDescription,
      conditionText: conditionResolutionNote ? null : item.conditionText,
      sourceType: "AI extraction",
      sourceDocumentReference: item.document.filename,
      sourceDocumentId: item.documentId,
      originatingReviewItemId: item.id,
      sourcePageParagraph: item.sourcePageSection ?? null,
      createdById: context.userId,
      lastUpdatedById: context.userId,
      notes: conditionResolutionNote ? `Condition resolved: ${conditionResolutionNote}` : null,
      },
    });
    await finalizeConfirmedReviewItem({
      item, liveObjectType: "Action", liveObjectId: created.id, wasEdited, notes, conditionResolutionNote, sourceOverrideReason,
      context, tx,
    });
    return created;
  });
  revalidateConfirmedItem(item);

  redirect(`/documents/${item.documentId}/extraction/${item.extractionRunId}`);
}

export async function confirmItemAsAssumption(itemId: string, formData: FormData) {
  const { context, item } = await requireReviewItem(itemId);
  const orgId = context.orgId;

  const { notes, conditionResolutionNote, sourceOverrideReason } = await runConfirmGuardrails(item, formData);

  const entityId = formData.get("entityId") as string;
  if (!entityId) throw new Error("Entity is required to create a live assumption.");
  await assertEntityInOrganisation(entityId, orgId);

  const assumptionStatement = (formData.get("assumptionStatement") as string) || item.assumptionText || item.plainSummary;
  const relianceImportance = (formData.get("relianceImportance") as string) || "Medium";
  const suggestedReviewCadence = (formData.get("suggestedReviewCadence") as string) || null;

  const wasEdited = assumptionStatement !== (item.assumptionText ?? item.plainSummary);

  const assumption = await prisma.$transaction(async (tx) => {
    const created = await tx.assumption.create({
      data: {
      organisationId: orgId,
      entityId,
      assumptionStatement,
      relianceImportance,
      suggestedReviewCadence,
      conditionText: conditionResolutionNote ? null : item.conditionText,
      sourceType: "AI extraction",
      sourceDocumentReference: item.document.filename,
      sourceDocumentId: item.documentId,
      originatingReviewItemId: item.id,
      sourcePageParagraph: item.sourcePageSection ?? null,
      createdById: context.userId,
      notes: conditionResolutionNote ? `Condition resolved: ${conditionResolutionNote}` : null,
      },
    });
    await finalizeConfirmedReviewItem({
      item, liveObjectType: "Assumption", liveObjectId: created.id, wasEdited, notes, conditionResolutionNote, sourceOverrideReason,
      context, tx,
    });
    return created;
  });
  revalidateConfirmedItem(item);

  redirect(`/documents/${item.documentId}/extraction/${item.extractionRunId}`);
}

export async function confirmItemAsCaveat(itemId: string, formData: FormData) {
  const { context, item } = await requireReviewItem(itemId);
  const { notes, conditionResolutionNote, sourceOverrideReason } = await runConfirmGuardrails(item, formData);

  const entityId = formData.get("entityId") as string;
  if (!entityId) throw new Error("Entity is required to create a live caveat.");
  await assertEntityInOrganisation(entityId, context.orgId);

  const caveatText = (formData.get("caveatText") as string)?.trim() || item.caveatText || item.plainSummary;
  const relatedTopic = (formData.get("relatedTopic") as string)?.trim() || null;
  const impactIfUnresolved = (formData.get("impactIfUnresolved") as string)?.trim() || null;
  if (!caveatText) throw new Error("Caveat text is required.");
  const wasEdited = caveatText !== (item.caveatText ?? item.plainSummary);

  await prisma.$transaction(async (tx) => {
    const created = await tx.caveat.create({
      data: {
        organisationId: context.orgId,
        entityId,
        caveatText,
        relatedTopic,
        impactIfUnresolved,
        sourceDocumentId: item.documentId,
        originatingReviewItemId: item.id,
        sourcePageParagraph: item.sourcePageSection,
        createdById: context.userId,
        resolutionNote: conditionResolutionNote ? `Condition resolved: ${conditionResolutionNote}` : null,
      },
    });
    await finalizeConfirmedReviewItem({
      item,
      liveObjectType: "Caveat",
      liveObjectId: created.id,
      wasEdited,
      notes,
      conditionResolutionNote,
      sourceOverrideReason,
      context,
      tx,
    });
  });
  revalidateConfirmedItem(item);
  redirect(`/documents/${item.documentId}/extraction/${item.extractionRunId}`);
}

export async function confirmItemAsEvidence(itemId: string, formData: FormData) {
  const { context, item } = await requireReviewItem(itemId);
  const { notes, conditionResolutionNote, sourceOverrideReason } = await runConfirmGuardrails(item, formData);

  const entityId = formData.get("entityId") as string;
  if (!entityId) throw new Error("Entity is required to create a live evidence record.");
  await assertEntityInOrganisation(entityId, context.orgId);

  const title = (formData.get("title") as string)?.trim() || item.plainSummary;
  const description = (formData.get("description") as string)?.trim() || item.plainSummary;
  const evidenceType = (formData.get("evidenceType") as string)?.trim() || item.itemType;
  if (!title) throw new Error("Evidence title is required.");
  const wasEdited = title !== item.plainSummary;

  await prisma.$transaction(async (tx) => {
    const created = await tx.evidenceItem.create({
      data: {
        organisationId: context.orgId,
        entityId,
        title,
        evidenceType,
        description: conditionResolutionNote
          ? `${description}\n\nCondition resolved: ${conditionResolutionNote}`
          : item.conditionText
            ? `${description}\n\nCondition (preserved): ${item.conditionText}`
            : description,
        status: "Received",
        documentId: item.documentId,
        ownerId: context.userId,
      },
    });
    await finalizeConfirmedReviewItem({
      item,
      liveObjectType: "Evidence",
      liveObjectId: created.id,
      wasEdited,
      notes,
      conditionResolutionNote,
      sourceOverrideReason,
      context,
      tx,
    });
  });
  revalidateConfirmedItem(item);
  redirect(`/documents/${item.documentId}/extraction/${item.extractionRunId}`);
}

export async function confirmItemAsTripwire(itemId: string, formData: FormData) {
  const { context, item } = await requireReviewItem(itemId);
  const orgId = context.orgId;

  const { notes, conditionResolutionNote, sourceOverrideReason } = await runConfirmGuardrails(item, formData);

  const entityId = formData.get("entityId") as string;
  if (!entityId) throw new Error("Entity is required to create a live tripwire.");
  await assertEntityInOrganisation(entityId, orgId);

  const description = formData.get("description") as string;
  const triggerEvent = formData.get("triggerEvent") as string;
  const reviewDateRaw = formData.get("reviewDateOrDeadline") as string;
  const reviewCadence = (formData.get("reviewCadence") as string) || null;
  const disarmCondition = (formData.get("disarmCondition") as string) || null;

  if (!description || !triggerEvent) throw new Error("Description and trigger event are required to create a tripwire.");

  const wasEdited = description !== item.plainSummary;

  const tripwire = await prisma.$transaction(async (tx) => {
    const created = await tx.tripwire.create({
      data: {
      organisationId: orgId,
      entityId,
      description,
      triggerEvent,
      reviewDateOrDeadline: reviewDateRaw ? new Date(reviewDateRaw) : null,
      reviewCadence,
      disarmCondition,
      conditionText: conditionResolutionNote ? null : item.conditionText,
      sourceType: "AI extraction",
      sourceDocumentReference: item.document.filename,
      sourceDocumentId: item.documentId,
      originatingReviewItemId: item.id,
      sourcePageParagraph: item.sourcePageSection ?? null,
      createdById: context.userId,
      notes: conditionResolutionNote ? `Condition resolved: ${conditionResolutionNote}` : null,
      },
    });
    await finalizeConfirmedReviewItem({
      item, liveObjectType: "Tripwire", liveObjectId: created.id, wasEdited, notes, conditionResolutionNote, sourceOverrideReason,
      context, tx,
    });
    return created;
  });
  revalidateConfirmedItem(item);

  redirect(`/documents/${item.documentId}/extraction/${item.extractionRunId}`);
}
