"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { recordUserAuditEvent } from "@/lib/audit";

export async function upsertSourcePriorityRule(
  dataCategoryId: string,
  formData: FormData
) {
  const context = await requirePermission("record:write");

  const authSourceId = (formData.get("authSourceId") as string) || null;
  const secondarySourceId = (formData.get("secondarySourceId") as string) || null;
  const tertiarySourceId = (formData.get("tertiarySourceId") as string) || null;
  const conflictHandling = (formData.get("conflictHandling") as string) || null;
  const reviewOwnerId = (formData.get("reviewOwnerId") as string) || null;
  const reviewFrequency = (formData.get("reviewFrequency") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  const sourceIds = [authSourceId, secondarySourceId, tertiarySourceId].filter(
    (id): id is string => Boolean(id),
  );

  await prisma.$transaction(async (tx) => {
    const [category, validSourceCount, reviewOwner] = await Promise.all([
      tx.dataCategory.findUnique({ where: { id: dataCategoryId }, select: { id: true } }),
      tx.sourceSystem.count({
        where: { id: { in: sourceIds }, organisationId: context.orgId },
      }),
      reviewOwnerId
        ? tx.user.findFirst({
            where: { id: reviewOwnerId, organisationId: context.orgId },
            select: { id: true },
          })
        : null,
    ]);
    if (!category) throw new Error("Data category not found.");
    if (validSourceCount !== new Set(sourceIds).size) {
      throw new Error("One or more source systems are not available in this organisation.");
    }
    if (reviewOwnerId && !reviewOwner) {
      throw new Error("Review owner not found in this organisation.");
    }

    const existing = await tx.sourcePriorityRule.findUnique({
      where: {
        organisationId_dataCategoryId: {
          organisationId: context.orgId,
          dataCategoryId,
        },
      },
    });
    const data = {
      authSourceId,
      secondarySourceId,
      tertiarySourceId,
      conflictHandling,
      reviewOwnerId,
      reviewFrequency,
      notes,
    };
    const rule = existing
      ? await tx.sourcePriorityRule.update({ where: { id: existing.id }, data })
      : await tx.sourcePriorityRule.create({
          data: { organisationId: context.orgId, dataCategoryId, ...data },
        });

    await recordUserAuditEvent(
      context,
      {
        action: existing
          ? "SOURCE_PRIORITY_RULE_UPDATED"
          : "SOURCE_PRIORITY_RULE_CREATED",
        target: { objectType: "SourcePriorityRule", objectId: rule.id },
        before: existing,
        after: rule,
      },
      tx,
    );
  });

  revalidatePath("/sources/priority-rules");
}
