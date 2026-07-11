import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { runAIExtraction } from "./ai-extraction";
import { ITEM_TYPE_LABELS, type ItemType } from "./extraction-schema";

function plainSummary(itemType: ItemType, data: Record<string, unknown>): string {
  switch (itemType) {
    case "obligation":
      return `${data.regime ?? "Unknown regime"} — ${data.obligationType ?? ""}: ${data.description ?? ""}`.trim();
    case "action":
    case "evidence":
    case "valuation":
    case "conflict":
      return String(data.description ?? "");
    case "assumption":
      return String(data.assumptionStatement ?? "");
    case "caveat":
      return String(data.caveatText ?? "");
    case "tripwire":
      return `${data.description ?? ""} (trigger: ${data.triggerEvent ?? "?"})`.trim();
    case "rd":
      return "R&D reference extracted — review required.";
    case "capital_allowances":
      return "Capital allowances reference extracted — review required.";
    default:
      return ITEM_TYPE_LABELS[itemType] ?? itemType;
  }
}

/**
 * Processes one already-leased run. Candidates are published together only
 * after every page-aware model block succeeds and validates.
 */
export async function processExtractionRun(runId: string): Promise<void> {
  const run = await prisma.extractionRun.findUnique({
    where: { id: runId },
    include: {
      document: {
        include: {
          chunks: { orderBy: { chunkIndex: "asc" } },
          entity: { select: { legalName: true, jurisdiction: true } },
        },
      },
    },
  });
  if (!run || run.status === "Completed") return;
  const document = run.document;
  const entityContext = document.entity
    ? `${document.entity.legalName} (${document.entity.jurisdiction})`
    : "";

  const result = await runAIExtraction(
    document.chunks.map((chunk) => ({
      sourceId: chunk.id,
      pageNumber: chunk.pageNumber,
      text: chunk.text,
    })),
    document.documentType,
    entityContext,
  );
  if (result.apiError) {
    await prisma.auditEvent.create({
      data: {
        organisationId: run.organisationId,
        entityId: document.entityId,
        action: "EXTRACTION_ATTEMPT_FAILED",
        objectType: "ExtractionRun",
        objectId: run.id,
        detail: result.apiError,
      },
    });
    throw new Error(result.apiError);
  }
  if (result.validationError) {
    await prisma.extractionRun.update({
      where: { id: run.id },
      data: {
        status: "Failed",
        completedAt: new Date(),
        errorMessage: `AI output failed schema validation: ${result.validationError}`,
        lockedAt: null,
        heartbeatAt: null,
      },
    });
    return;
  }

  const items = result.response?.items ?? [];
  await prisma.$transaction(async (tx) => {
    // A run is not reviewable until Completed, so replacing candidates here is
    // idempotent and cannot destroy a human-reviewed item.
    await tx.reviewItem.deleteMany({ where: { extractionRunId: run.id } });
    if (items.length > 0) {
      await tx.reviewItem.createMany({
        data: items.map((item) => {
          const data = item.data as Record<string, unknown>;
          return {
            organisationId: run.organisationId,
            extractionRunId: run.id,
            documentId: document.id,
            entityId: document.entityId,
            itemType: item.itemType,
            structuredJson: data as Prisma.InputJsonValue,
            plainSummary: plainSummary(item.itemType as ItemType, data),
            confidenceScore: (data.confidenceScore as number) ?? 0,
            sourceChunkId: (data.sourceBlockId as string) ?? null,
            sourcePageSection: (data.sourceChunkPage as string) ?? null,
            sourceTextExcerpt: (data.sourceText as string) ?? null,
            conditionText: (data.conditionText as string) ?? null,
            assumptionText:
              item.itemType === "assumption"
                ? (data.assumptionStatement as string) ?? null
                : null,
            caveatText:
              item.itemType === "caveat" ? (data.caveatText as string) ?? null : null,
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
    await tx.extractionRun.update({
      where: { id: run.id },
      data: {
        status: "Completed",
        completedAt: new Date(),
        errorMessage: null,
        totalChunksProcessed: document.chunks.length,
        lockedAt: null,
        heartbeatAt: null,
      },
    });
    await tx.auditEvent.create({
      data: {
        organisationId: run.organisationId,
        entityId: document.entityId,
        action: "EXTRACTION_RUN_COMPLETED",
        objectType: "ExtractionRun",
        objectId: run.id,
        detail: `${items.length} grounded draft item(s) published from ${document.chunks.length} physical page chunk(s).`,
      },
    });
  });
}
