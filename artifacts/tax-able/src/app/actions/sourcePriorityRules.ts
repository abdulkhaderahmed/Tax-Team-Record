"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/auth";

export async function upsertSourcePriorityRule(
  dataCategoryId: string,
  formData: FormData
) {
  const { organisation: org, user } = await requireOrg();
  const orgId = org.id;
  const userId = user.id;

  const authSourceId = (formData.get("authSourceId") as string) || null;
  const secondarySourceId = (formData.get("secondarySourceId") as string) || null;
  const tertiarySourceId = (formData.get("tertiarySourceId") as string) || null;
  const conflictHandling = (formData.get("conflictHandling") as string) || null;
  const reviewOwner = (formData.get("reviewOwner") as string) || null;
  const reviewFrequency = (formData.get("reviewFrequency") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  const existing = await prisma.sourcePriorityRule.findUnique({
    where: { organisationId_dataCategoryId: { organisationId: orgId, dataCategoryId } },
  });

  if (existing) {
    await prisma.sourcePriorityRule.update({
      where: { id: existing.id },
      data: { authSourceId, secondarySourceId, tertiarySourceId, conflictHandling, reviewOwner, reviewFrequency, notes },
    });
    await prisma.auditEvent.create({
      data: {
        organisationId: orgId,
        userId: userId,
        action: "source_priority_rule_edited",
        detail: `Source priority rule updated for category id: ${dataCategoryId}`,
      },
    });
  } else {
    await prisma.sourcePriorityRule.create({
      data: {
        organisationId: orgId,
        dataCategoryId,
        authSourceId,
        secondarySourceId,
        tertiarySourceId,
        conflictHandling,
        reviewOwner,
        reviewFrequency,
        notes,
      },
    });
    await prisma.auditEvent.create({
      data: {
        organisationId: orgId,
        userId: userId,
        action: "source_priority_rule_created",
        detail: `Source priority rule created for category id: ${dataCategoryId}`,
      },
    });
  }

  revalidatePath("/sources/priority-rules");
}