"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { runAIExtraction, MODEL, PROMPT_VERSION, SCHEMA_VERSION } from "@/lib/ai-extraction";
import { ITEM_TYPE_LABELS, type ItemType } from "@/lib/extraction-schema";
import type { ReviewItem } from "@prisma/client";
import { requireOrg } from "@/lib/auth";

const REVIEWER = "Alex Smith";
const LOW_CONFIDENCE_THRESHOLD = 0.5;

function plainSummary(itemType: ItemType, data: Record<string, unknown>): string {
  switch (itemType) {
    case "obligation":
      return `${data.regime ?? "Unknown regime"} — ${data.obligationType ?? ""}: ${data.description ?? ""}`.trim();
    case "action":
      return String(data.description ?? "");
    case "assumption":
      return String(data.assumptionStatement ?? "");
    case "caveat":
      return String(data.caveatText ?? "");
    case "tripwire":
      return `${data.description ?? ""} (trigger: ${data.triggerEvent ?? "?"})`.trim();
    case "evidence":
      return String(data.description ?? "");
    case "valuation":
      return String(data.description ?? "");
    case "rd":
      return "R&D reference extracted — review required.";
    case "capital_allowances":
      return "Capital allowances reference extracted — review required.";
    case "conflict":
      return String(data.description ?? "");
    default:
      return ITEM_TYPE_LABELS[itemType] ?? itemType;
  }
}

export async function startExtraction(documentId: string) {
  const { organisation: org, user } = await requireOrg();
  const orgId = org.id;

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { chunks: true },
  });
  if (!doc) throw new Error("Document not found.");
  if (doc.organisationId !== orgId) throw new Error("Access denied.");
  if (doc.chunks.length === 0 || !doc.chunks[0].text) {
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
      createdBy: user.name,
    },
  });

  await prisma.auditEvent.create({
    data: {
      organisationId: orgId,
      entityId: doc.entityId ?? null,
      action: "extraction_run_queued",
      detail: `AI extraction queued for document: ${doc.filename} (run ${run.id}, model ${MODEL}).`,
    },
  });

  void processExtractionRun(run.id);

  revalidatePath(`/documents/${documentId}`);
  redirect(`/documents/${documentId}/extraction/${run.id}`);
}

export async function processExtractionRun(runId: string) {
  const run = await prisma.extractionRun.findUnique({
    where: { id: runId },
    include: {
      document: {
        include: { chunks: true, entity: { select: { legalName: true, jurisdiction: true } } },
      },
    },
  });
  if (!run || run.status === "Completed") return;

  const activeRun = run;
  const doc = activeRun.document;
  await prisma.extractionRun.update({
    where: { id: activeRun.id },
    data: { status: "Running", errorMessage: null, completedAt: null },
  });
  await prisma.reviewItem.deleteMany({ where: { extractionRunId: activeRun.id } });

  async function failRun(errorMessage: string) {
    await prisma.extractionRun.update({
      where: { id: activeRun.id },
      data: { status: "Failed", errorMessage, completedAt: new Date(), totalChunksProcessed: doc.chunks.length },
    });
    await prisma.auditEvent.create({
      data: {
        organisationId: activeRun.organisationId,
        entityId: doc.entityId ?? null,
        action: "extraction_run_failed",
        detail: `AI extraction failed for document: ${doc.filename} (run ${activeRun.id}). ${errorMessage}`,
      },
    });
  }

  try {
    const fullText = doc.chunks.map((c) => c.text).join("\n\n");
    const entityContext = doc.entity ? `${doc.entity.legalName} (${doc.entity.jurisdiction})` : "";
    const result = await runAIExtraction(fullText, doc.documentType, entityContext);

    if (result.apiError) {
      await failRun(result.apiError);
      return;
    }

    if (result.validationError) {
      await failRun(`AI output failed schema validation: ${result.validationError}`);
      return;
    }

    const items = result.response!.items;

    if (items.length > 0) {
      await prisma.reviewItem.createMany({
        data: items.map((item) => {
          const data = item.data as Record<string, unknown>;
          return {
            organisationId: activeRun.organisationId,
            extractionRunId: activeRun.id,
            documentId: doc.id,
            entityId: doc.entityId ?? null,
            itemType: item.itemType,
            structuredJson: data as object,
            plainSummary: plainSummary(item.itemType as ItemType, data),
            confidenceScore: (data.confidenceScore as number) ?? 0,
            sourceChunkId: null,
            sourcePageSection: (data.sourceChunkPage as string) ?? null,
            sourceTextExcerpt: (data.sourceText as string) ?? null,
            conditionText: (data.conditionText as string) ?? null,
            assumptionText: item.itemType === "assumption" ? (data.assumptionStatement as string) ?? null : null,
            caveatText: item.itemType === "caveat" ? (data.caveatText as string) ?? null : null,
            isConditional: Boolean(data.isConditional),
            isDraft: Boolean(data.isDraft),
            requiresHumanTaxReview: data.requiresHumanTaxReview !== false,
            requiresSourceVerification: Boolean(data.requiresSourceVerification),
            suggestedRegime: (data.regime as string) ?? null,
            suggestedObligationType: (data.obligationType as string) ?? null,
            suggestedOwner: (data.suggestedOwner ?? data.responsibleParty ?? data.owner) as string | null,
            suggestedEvidenceRequired: (data.evidenceRequired as string) ?? null,
            reviewStatus: "Needs review",
          };
        }),
      });

      const byType = items.reduce<Record<string, number>>((acc, item) => {
        acc[item.itemType] = (acc[item.itemType] ?? 0) + 1;
        return acc;
      }, {});
      await prisma.auditEvent.create({
        data: {
          organisationId: activeRun.organisationId,
          entityId: doc.entityId ?? null,
          action: "review_item_created",
          detail: `${items.length} draft review item(s) created from extraction run ${activeRun.id}: ${JSON.stringify(byType)}`,
        },
      });
    }

    await prisma.extractionRun.update({
      where: { id: activeRun.id },
      data: { status: "Completed", completedAt: new Date(), totalChunksProcessed: doc.chunks.length },
    });

    await prisma.auditEvent.create({
      data: {
        organisationId: activeRun.organisationId,
        entityId: doc.entityId ?? null,
        action: "extraction_run_completed",
        detail: `AI extraction completed for document: ${doc.filename}. ${items.length} item(s) extracted.`,
      },
    });
  } catch (err) {
    await failRun(String(err));
  } finally {
    revalidatePath(`/documents/${doc.id}`);
    revalidatePath(`/documents/${doc.id}/extraction/${activeRun.id}`);
    revalidatePath("/review");
  }
}

const STATUS_AUDIT_ACTION: Record<string, string> = {
  Confirmed: "review_item_confirmed",
  Rejected: "review_item_rejected",
  Duplicate: "review_item_marked_duplicate",
  "Not applicable": "review_item_marked_not_applicable",
  "Needs adviser input": "review_item_marked_needs_adviser_input",
  "Needs source verification": "review_item_marked_needs_source_verification",
  "In review": "review_item_marked_in_review",
};

export async function updateReviewStatus(
  itemId: string,
  status: string,
  notes?: string,
  rejectionReason?: string
) {
  const { organisation: org, user } = await requireOrg();
  const orgId = org.id;
  const userId = user.id;

  const item = await prisma.reviewItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error("Review item not found.");

  if (status === "Confirmed" && item.confidenceScore < LOW_CONFIDENCE_THRESHOLD && !notes?.trim()) {
    throw new Error("This is a low-confidence item — add a reviewer note before confirming it.");
  }
  if (status === "Rejected" && !rejectionReason?.trim()) {
    throw new Error("A rejection reason is required to reject an item.");
  }

  await prisma.reviewItem.update({
    where: { id: itemId },
    data: {
      reviewStatus: status,
      reviewedBy: REVIEWER,
      reviewedAt: new Date(),
      reviewerNotes: notes ?? null,
      rejectionReason: rejectionReason ?? null,
    },
  });

  await prisma.auditEvent.create({
    data: {
      organisationId: orgId,
      entityId: item.entityId ?? null,
      action: STATUS_AUDIT_ACTION[status] ?? "review_item_status_changed",
      detail: `Review item ${itemId} (${item.itemType}) set to "${status}".${notes ? ` Note: ${notes}` : ""}${rejectionReason ? ` Reason: ${rejectionReason}` : ""}`,
    },
  });

  revalidatePath(`/documents/${item.documentId}/extraction/${item.extractionRunId}`);
  revalidatePath("/review");
}

export async function editAndConfirmReviewItem(itemId: string, formData: FormData) {
  const { organisation: org, user } = await requireOrg();
  const orgId = org.id;
  const userId = user.id;

  const item = await prisma.reviewItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error("Review item not found.");

  const plainSummaryEdit = (formData.get("plainSummary") as string)?.trim();
  const notes = (formData.get("reviewerNotes") as string)?.trim();
  if (!plainSummaryEdit) throw new Error("Summary cannot be empty.");
  if (item.confidenceScore < LOW_CONFIDENCE_THRESHOLD && !notes) {
    throw new Error("This is a low-confidence item — add a reviewer note before confirming your edit.");
  }

  await prisma.reviewItem.update({
    where: { id: itemId },
    data: {
      plainSummary: plainSummaryEdit,
      reviewStatus: "Edited and confirmed",
      reviewedBy: REVIEWER,
      reviewedAt: new Date(),
      reviewerNotes: notes || null,
    },
  });

  await prisma.auditEvent.create({
    data: {
      organisationId: orgId,
      entityId: item.entityId ?? null,
      action: "review_item_edited",
      detail: `Review item ${itemId} (${item.itemType}) edited and confirmed by ${REVIEWER}.`,
    },
  });

  revalidatePath(`/documents/${item.documentId}/extraction/${item.extractionRunId}`);
  revalidatePath("/review");
}

export async function linkReviewItemToExisting(itemId: string, formData: FormData) {
  const { organisation: org } = await requireOrg();
  const orgId = org.id;

  const item = await prisma.reviewItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error("Review item not found.");

  const liveObjectType = formData.get("liveObjectType") as string;
  const liveObjectId = (formData.get("liveObjectId") as string)?.trim();
  if (!liveObjectType || !liveObjectId) throw new Error("Both a type and an ID are required to link to an existing record.");

  await prisma.reviewItem.update({
    where: { id: itemId },
    data: {
      reviewStatus: "Confirmed",
      reviewedBy: REVIEWER,
      reviewedAt: new Date(),
      createdLiveObjectType: liveObjectType,
      createdLiveObjectId: liveObjectId,
    },
  });

  await prisma.auditEvent.create({
    data: {
      organisationId: orgId,
      entityId: item.entityId ?? null,
      action: "review_item_linked_to_existing_object",
      detail: `Review item ${itemId} (${item.itemType}) linked to existing ${liveObjectType} ${liveObjectId}.`,
    },
  });

  revalidatePath(`/documents/${item.documentId}/extraction/${item.extractionRunId}`);
  revalidatePath("/review");
}

/**
 * Shared guardrails applied before any confirmed review item is allowed to
 * create a live obligation/action/assumption/tripwire. Throws with a message
 * safe to surface to the reviewer if a required confirmation is missing.
 */
async function runConfirmGuardrails(item: ReviewItem, formData: FormData) {
  const notes = (formData.get("reviewerNotes") as string)?.trim() || "";

  if (item.confidenceScore < LOW_CONFIDENCE_THRESHOLD && !notes) {
    throw new Error("This is a low-confidence item — add a reviewer note before creating a live record from it.");
  }

  let conditionResolutionNote: string | null = null;
  const resolveCondition = formData.get("resolveCondition") === "on";
  if (item.isConditional) {
    if (resolveCondition) {
      conditionResolutionNote = (formData.get("conditionResolutionNote") as string)?.trim() || "";
      if (!conditionResolutionNote) {
        throw new Error("This item is conditional — add a note explaining why the condition no longer applies, or leave it as conditional.");
      }
    }
  }

  const document = await prisma.document.findUnique({ where: { id: item.documentId } });
  let sourceOverrideReason: string | null = null;
  if (document && document.isAuthoritativeSource !== "Yes") {
    const sourceVerified = formData.get("sourceVerified") === "on";
    sourceOverrideReason = (formData.get("sourceOverrideReason") as string)?.trim() || "";
    if (!sourceVerified && !sourceOverrideReason) {
      throw new Error(
        "This item's source document is not marked as authoritative — verify the source or give an override reason before creating a live record."
      );
    }
  }

  return { notes, conditionResolutionNote, sourceOverrideReason };
}

async function finalizeConfirmedReviewItem(params: {
  item: ReviewItem;
  liveObjectType: string;
  liveObjectId: string;
  wasEdited: boolean;
  notes: string;
  conditionResolutionNote: string | null;
  sourceOverrideReason: string | null;
  organisationId: string;
}) {
  const { item, liveObjectType, liveObjectId, wasEdited, notes, conditionResolutionNote, sourceOverrideReason, organisationId } = params;
  const orgId = organisationId;

  await prisma.reviewItem.update({
    where: { id: item.id },
    data: {
      reviewStatus: wasEdited ? "Edited and confirmed" : "Confirmed",
      reviewedBy: REVIEWER,
      reviewedAt: new Date(),
      reviewerNotes: notes || item.reviewerNotes,
      requiresSourceVerification: sourceOverrideReason ? false : item.requiresSourceVerification,
      createdLiveObjectType: liveObjectType,
      createdLiveObjectId: liveObjectId,
    },
  });

  await prisma.auditEvent.create({
    data: {
      organisationId: orgId,
      entityId: item.entityId ?? null,
      action: "live_object_created_from_review_item",
      detail: `${liveObjectType} ${liveObjectId} created from review item ${item.id} (${item.itemType}).`,
    },
  });

  if (conditionResolutionNote) {
    await prisma.auditEvent.create({
      data: {
        organisationId: orgId,
        entityId: item.entityId ?? null,
        action: "conditional_item_resolved",
        detail: `Condition on review item ${item.id} resolved by ${REVIEWER}: ${conditionResolutionNote}`,
      },
    });
  }

  if (sourceOverrideReason) {
    await prisma.auditEvent.create({
      data: {
        organisationId: orgId,
        entityId: item.entityId ?? null,
        action: "source_override_used",
        detail: `Non-authoritative source override on review item ${item.id}: ${sourceOverrideReason}`,
      },
    });
  }

  revalidatePath(`/documents/${item.documentId}/extraction/${item.extractionRunId}`);
  revalidatePath("/obligations");
  revalidatePath("/review");
}

export async function confirmItemAsObligation(itemId: string, formData: FormData) {
  const { organisation: org } = await requireOrg();
  const orgId = org.id;

  const item = await prisma.reviewItem.findUnique({ where: { id: itemId }, include: { document: true } });
  if (!item) throw new Error("Review item not found.");

  const { notes, conditionResolutionNote, sourceOverrideReason } = await runConfirmGuardrails(item, formData);

  const entityId = formData.get("entityId") as string;
  if (!entityId) throw new Error("Entity is required to create a live obligation.");

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

  const obligation = await prisma.manualObligation.create({
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
      sourcePageParagraph: item.sourcePageSection ?? null,
      evidenceRequired: !!item.suggestedEvidenceRequired,
      evidenceDescription: item.suggestedEvidenceRequired ?? null,
      createdBy: REVIEWER,
      notes: conditionNote,
    },
  });

  await finalizeConfirmedReviewItem({
    item, liveObjectType: "ManualObligation", liveObjectId: obligation.id, wasEdited, notes, conditionResolutionNote, sourceOverrideReason,
    organisationId: orgId,
  });

  redirect(`/documents/${item.documentId}/extraction/${item.extractionRunId}`);
}

export async function confirmItemAsAction(itemId: string, formData: FormData) {
  const { organisation: org } = await requireOrg();
  const orgId = org.id;

  const item = await prisma.reviewItem.findUnique({ where: { id: itemId }, include: { document: true } });
  if (!item) throw new Error("Review item not found.");

  const { notes, conditionResolutionNote, sourceOverrideReason } = await runConfirmGuardrails(item, formData);

  const entityId = formData.get("entityId") as string;
  if (!entityId) throw new Error("Entity is required to create a live action.");

  const description = formData.get("description") as string;
  const responsibleParty = (formData.get("responsibleParty") as string) || null;
  const deadlineRaw = formData.get("deadline") as string;
  const evidenceDescription = (formData.get("evidenceDescription") as string) || item.suggestedEvidenceRequired || null;

  const wasEdited = description !== item.plainSummary;

  const action = await prisma.action.create({
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
      sourcePageParagraph: item.sourcePageSection ?? null,
      createdBy: REVIEWER,
      notes: conditionResolutionNote ? `Condition resolved: ${conditionResolutionNote}` : null,
    },
  });

  await finalizeConfirmedReviewItem({
    item, liveObjectType: "Action", liveObjectId: action.id, wasEdited, notes, conditionResolutionNote, sourceOverrideReason,
    organisationId: orgId,
  });

  redirect(`/documents/${item.documentId}/extraction/${item.extractionRunId}`);
}

export async function confirmItemAsAssumption(itemId: string, formData: FormData) {
  const { organisation: org } = await requireOrg();
  const orgId = org.id;

  const item = await prisma.reviewItem.findUnique({ where: { id: itemId }, include: { document: true } });
  if (!item) throw new Error("Review item not found.");

  const { notes, conditionResolutionNote, sourceOverrideReason } = await runConfirmGuardrails(item, formData);

  const entityId = formData.get("entityId") as string;
  if (!entityId) throw new Error("Entity is required to create a live assumption.");

  const assumptionStatement = (formData.get("assumptionStatement") as string) || item.assumptionText || item.plainSummary;
  const relianceImportance = (formData.get("relianceImportance") as string) || "Medium";
  const suggestedReviewCadence = (formData.get("suggestedReviewCadence") as string) || null;

  const wasEdited = assumptionStatement !== (item.assumptionText ?? item.plainSummary);

  const assumption = await prisma.assumption.create({
    data: {
      organisationId: orgId,
      entityId,
      assumptionStatement,
      relianceImportance,
      suggestedReviewCadence,
      conditionText: conditionResolutionNote ? null : item.conditionText,
      sourceType: "AI extraction",
      sourceDocumentReference: item.document.filename,
      sourcePageParagraph: item.sourcePageSection ?? null,
      createdBy: REVIEWER,
      notes: conditionResolutionNote ? `Condition resolved: ${conditionResolutionNote}` : null,
    },
  });

  await finalizeConfirmedReviewItem({
    item, liveObjectType: "Assumption", liveObjectId: assumption.id, wasEdited, notes, conditionResolutionNote, sourceOverrideReason,
    organisationId: orgId,
  });

  redirect(`/documents/${item.documentId}/extraction/${item.extractionRunId}`);
}

export async function confirmItemAsTripwire(itemId: string, formData: FormData) {
  const { organisation: org } = await requireOrg();
  const orgId = org.id;

  const item = await prisma.reviewItem.findUnique({ where: { id: itemId }, include: { document: true } });
  if (!item) throw new Error("Review item not found.");

  const { notes, conditionResolutionNote, sourceOverrideReason } = await runConfirmGuardrails(item, formData);

  const entityId = formData.get("entityId") as string;
  if (!entityId) throw new Error("Entity is required to create a live tripwire.");

  const description = formData.get("description") as string;
  const triggerEvent = formData.get("triggerEvent") as string;
  const reviewDateRaw = formData.get("reviewDateOrDeadline") as string;
  const reviewCadence = (formData.get("reviewCadence") as string) || null;
  const disarmCondition = (formData.get("disarmCondition") as string) || null;

  if (!description || !triggerEvent) throw new Error("Description and trigger event are required to create a tripwire.");

  const wasEdited = description !== item.plainSummary;

  const tripwire = await prisma.tripwire.create({
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
      sourcePageParagraph: item.sourcePageSection ?? null,
      createdBy: REVIEWER,
      notes: conditionResolutionNote ? `Condition resolved: ${conditionResolutionNote}` : null,
    },
  });

  await finalizeConfirmedReviewItem({
    item, liveObjectType: "Tripwire", liveObjectId: tripwire.id, wasEdited, notes, conditionResolutionNote, sourceOverrideReason,
    organisationId: orgId,
  });

  redirect(`/documents/${item.documentId}/extraction/${item.extractionRunId}`);
}