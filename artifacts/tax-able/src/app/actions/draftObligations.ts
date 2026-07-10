"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { generateDraftObligations, dedupKey } from "@/lib/obligation-generator";
import { randomUUID } from "crypto";

export async function generateEntityDrafts(entityId: string) {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } });
  if (!entity) throw new Error("Entity not found.");

  const org = await prisma.organisation.findFirst();
  if (!org) throw new Error("No organisation found.");

  const batchId = randomUUID();
  const today = new Date();
  const drafts = generateDraftObligations(entity, today);

  // Load all existing rule-generated obligations for this entity (any review status)
  const existing = await prisma.manualObligation.findMany({
    where: {
      entityId,
      ruleId: { not: null },
    },
    select: { ruleId: true, periodStart: true, draftReviewStatus: true },
  });

  // Build a set of dedup keys for obligations we should NOT create again
  const skipKeys = new Set<string>();
  for (const ex of existing) {
    if (!ex.ruleId) continue;
    // Skip if already activated, rejected, or not applicable — preserve those decisions
    // Skip if already pending — don't create a duplicate
    skipKeys.add(dedupKey(entityId, ex.ruleId, ex.periodStart));
  }

  let created = 0;
  for (const draft of drafts) {
    const key = dedupKey(entityId, draft.ruleId, draft.periodStart);
    if (skipKeys.has(key)) continue;

    await prisma.manualObligation.create({
      data: {
        ...draft,
        generationBatchId: batchId,
      },
    });
    created++;
  }

  await prisma.auditEvent.create({
    data: {
      organisationId: org.id,
      entityId,
      action: "DRAFTS_GENERATED",
      detail: JSON.stringify({
        entityName: entity.legalName,
        batchId,
        generated: created,
        skipped: drafts.length - created,
        today: today.toISOString().slice(0, 10),
      }),
    },
  });

  revalidatePath("/obligations/drafts");
  revalidatePath(`/entities/${entityId}`);
  redirect(`/obligations/drafts?entity=${entityId}&generated=${created}`);
}

export async function activateDraft(id: string) {
  const org = await prisma.organisation.findFirst();
  const mo = await prisma.manualObligation.update({
    where: { id },
    data: {
      draftReviewStatus: "activated",
      overallWorkflowStatus: "Not started",
    },
  });

  if (org) {
    await prisma.auditEvent.create({
      data: {
        organisationId: org.id,
        entityId: mo.entityId,
        action: "DRAFT_ACTIVATED",
        detail: JSON.stringify({
          id,
          description: mo.description,
          regime: mo.regime,
          ruleId: mo.ruleId,
        }),
      },
    });
  }

  revalidatePath("/obligations/drafts");
  revalidatePath("/obligations");
  revalidatePath("/");
}

export async function rejectDraft(id: string, formData: FormData) {
  const note = (formData.get("note") as string || "").trim();
  const org = await prisma.organisation.findFirst();

  const mo = await prisma.manualObligation.update({
    where: { id },
    data: {
      draftReviewStatus: "rejected",
      draftNote: note || null,
    },
  });

  if (org) {
    await prisma.auditEvent.create({
      data: {
        organisationId: org.id,
        entityId: mo.entityId,
        action: "DRAFT_REJECTED",
        detail: JSON.stringify({ id, description: mo.description, note }),
      },
    });
  }

  revalidatePath("/obligations/drafts");
  redirect("/obligations/drafts");
}

export async function markDraftNotApplicable(id: string, formData: FormData) {
  const note = (formData.get("note") as string || "").trim();
  const org = await prisma.organisation.findFirst();

  const mo = await prisma.manualObligation.update({
    where: { id },
    data: {
      draftReviewStatus: "not_applicable",
      draftNote: note || null,
    },
  });

  if (org) {
    await prisma.auditEvent.create({
      data: {
        organisationId: org.id,
        entityId: mo.entityId,
        action: "DRAFT_NOT_APPLICABLE",
        detail: JSON.stringify({ id, description: mo.description, note }),
      },
    });
  }

  revalidatePath("/obligations/drafts");
  redirect("/obligations/drafts");
}

export async function restoreDraftToPending(id: string) {
  const org = await prisma.organisation.findFirst();

  const mo = await prisma.manualObligation.update({
    where: { id },
    data: {
      draftReviewStatus: "pending",
      draftNote: null,
      overallWorkflowStatus: "Draft",
    },
  });

  if (org) {
    await prisma.auditEvent.create({
      data: {
        organisationId: org.id,
        entityId: mo.entityId,
        action: "DRAFT_RESTORED",
        detail: JSON.stringify({ id, description: mo.description }),
      },
    });
  }

  revalidatePath("/obligations/drafts");
}
