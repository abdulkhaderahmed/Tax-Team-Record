"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { runAIExtraction, MODEL, PROMPT_VERSION, SCHEMA_VERSION } from "@/lib/ai-extraction";
import { ITEM_TYPE_LABELS, type ItemType } from "@/lib/extraction-schema";

const ORG_ID = "demo-org";

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
  // Check document exists and has extracted text
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { chunks: true, entity: { select: { legalName: true, jurisdiction: true } } },
  });
  if (!doc) throw new Error("Document not found.");
  if (doc.organisationId !== ORG_ID) throw new Error("Access denied.");
  if (doc.chunks.length === 0 || !doc.chunks[0].text) {
    throw new Error("Document has no extracted text. Please upload a document with readable text.");
  }

  // Create the run record
  const run = await prisma.extractionRun.create({
    data: {
      organisationId: ORG_ID,
      documentId,
      modelProvider: "openai",
      modelName: MODEL,
      promptVersion: PROMPT_VERSION,
      extractionSchemaVersion: SCHEMA_VERSION,
      status: "Running",
      createdBy: "Alex Smith",
    },
  });

  const fullText = doc.chunks.map((c) => c.text).join("\n\n");
  const entityContext = doc.entity
    ? `${doc.entity.legalName} (${doc.entity.jurisdiction})`
    : "";

  try {
    const result = await runAIExtraction(fullText, doc.documentType, entityContext);

    if (result.apiError) {
      await prisma.extractionRun.update({
        where: { id: run.id },
        data: { status: "Failed", errorMessage: result.apiError, completedAt: new Date() },
      });
      revalidatePath(`/documents/${documentId}`);
      redirect(`/documents/${documentId}/extraction/${run.id}`);
    }

    if (result.validationError) {
      await prisma.extractionRun.update({
        where: { id: run.id },
        data: {
          status: "Failed",
          errorMessage: `AI output failed schema validation: ${result.validationError}`,
          completedAt: new Date(),
          totalChunksProcessed: doc.chunks.length,
        },
      });
      revalidatePath(`/documents/${documentId}`);
      redirect(`/documents/${documentId}/extraction/${run.id}`);
    }

    const items = result.response!.items;

    // Save all review items
    if (items.length > 0) {
      await prisma.reviewItem.createMany({
        data: items.map((item) => {
          const data = item.data as Record<string, unknown>;
          return {
            extractionRunId: run.id,
            documentId,
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
    }

    await prisma.extractionRun.update({
      where: { id: run.id },
      data: {
        status: "Completed",
        completedAt: new Date(),
        totalChunksProcessed: doc.chunks.length,
        errorMessage: result.validationError ?? null,
      },
    });

    await prisma.auditEvent.create({
      data: {
        organisationId: ORG_ID,
        entityId: doc.entityId ?? null,
        action: "extraction_run_completed",
        detail: `AI extraction completed for document: ${doc.filename}. ${items.length} item(s) extracted.`,
      },
    });
  } catch (err) {
    await prisma.extractionRun.update({
      where: { id: run.id },
      data: { status: "Failed", errorMessage: String(err), completedAt: new Date() },
    });
  }

  revalidatePath(`/documents/${documentId}`);
  revalidatePath(`/documents/${documentId}/extraction/${run.id}`);
  redirect(`/documents/${documentId}/extraction/${run.id}`);
}

export async function updateReviewStatus(
  itemId: string,
  status: string,
  notes?: string,
  rejectionReason?: string
) {
  await prisma.reviewItem.update({
    where: { id: itemId },
    data: {
      reviewStatus: status,
      reviewedBy: "Alex Smith",
      reviewedAt: new Date(),
      reviewerNotes: notes ?? null,
      rejectionReason: rejectionReason ?? null,
    },
  });

  const item = await prisma.reviewItem.findUnique({ where: { id: itemId } });
  revalidatePath(`/documents/${item?.documentId}/extraction/${item?.extractionRunId}`);
}

export async function confirmItemAsObligation(itemId: string, formData: FormData) {
  const item = await prisma.reviewItem.findUnique({
    where: { id: itemId },
    include: { document: true },
  });
  if (!item) throw new Error("Review item not found.");

  const entityId = formData.get("entityId") as string;
  if (!entityId) throw new Error("Entity is required to create a live obligation.");

  const regime = (formData.get("regime") as string) || item.suggestedRegime || "Unknown";
  const obligationType = (formData.get("obligationType") as string) || item.suggestedObligationType || "General";
  const description = formData.get("description") as string;
  const filingDeadlineRaw = formData.get("filingDeadline") as string;
  const periodStartRaw = formData.get("periodStart") as string;
  const periodEndRaw = formData.get("periodEnd") as string;
  const responsibleOwner = (formData.get("responsibleOwner") as string) || item.suggestedOwner || null;

  const obligation = await prisma.manualObligation.create({
    data: {
      organisationId: ORG_ID,
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
      createdBy: "Alex Smith",
      notes: item.conditionText ? `Condition: ${item.conditionText}` : null,
    },
  });

  await prisma.reviewItem.update({
    where: { id: itemId },
    data: {
      reviewStatus: "Confirmed",
      reviewedBy: "Alex Smith",
      reviewedAt: new Date(),
      createdLiveObjectType: "ManualObligation",
      createdLiveObjectId: obligation.id,
    },
  });

  await prisma.auditEvent.create({
    data: {
      organisationId: ORG_ID,
      entityId,
      action: "obligation_created_from_extraction",
      detail: `Live obligation created from AI extraction item ${itemId}: ${description}`,
    },
  });

  revalidatePath(`/documents/${item.documentId}/extraction/${item.extractionRunId}`);
  revalidatePath("/obligations");
  redirect(`/documents/${item.documentId}/extraction/${item.extractionRunId}`);
}
