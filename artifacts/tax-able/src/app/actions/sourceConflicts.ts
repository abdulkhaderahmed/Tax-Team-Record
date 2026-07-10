"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/auth";

export async function createSourceConflict(formData: FormData) {
  const { organisation: org, user } = await requireOrg();
  const orgId = org.id;
  const userId = user.id;

  const dataCategoryId = formData.get("dataCategoryId") as string;
  const sourceAId = formData.get("sourceAId") as string;
  const sourceBId = formData.get("sourceBId") as string;
  const sourceAValue = formData.get("sourceAValue") as string;
  const sourceBValue = formData.get("sourceBValue") as string;

  if (!dataCategoryId || !sourceAId || !sourceBId || !sourceAValue || !sourceBValue) {
    throw new Error("Data category, both sources, and their values are required.");
  }

  const conflict = await prisma.sourceConflict.create({
    data: {
      organisationId: orgId,
      dataCategoryId,
      entityId: (formData.get("entityId") as string) || null,
      sourceAId,
      sourceAValue,
      sourceBId,
      sourceBValue,
      severity: (formData.get("severity") as string) || null,
      reviewOwner: (formData.get("reviewOwner") as string) || null,
      requiredConfirmation: (formData.get("requiredConfirmation") as string) || null,
      status: "Open",
    },
  });

  await prisma.auditEvent.create({
    data: {
      organisationId: orgId,
      userId: userId,
      entityId: conflict.entityId,
      action: "source_conflict_created",
      detail: `Source conflict created for data category id: ${dataCategoryId}`,
    },
  });

  revalidatePath("/sources/conflicts");
  redirect(`/sources/conflicts/${conflict.id}`);
}

export async function updateConflictStatus(id: string, formData: FormData) {
  const status = formData.get("status") as string;
  const reviewOwner = (formData.get("reviewOwner") as string) || null;
  const requiredConfirmation = (formData.get("requiredConfirmation") as string) || null;

  await prisma.sourceConflict.update({
    where: { id },
    data: { status, reviewOwner, requiredConfirmation },
  });

  revalidatePath(`/sources/conflicts/${id}`);
  revalidatePath("/sources/conflicts");
}

export async function resolveSourceConflict(id: string, formData: FormData) {
  const { organisation: org, user } = await requireOrg();
  const orgId = org.id;
  const userId = user.id;

  const resolvedValue = (formData.get("resolvedValue") as string) || null;
  const resolutionRationale = (formData.get("resolutionRationale") as string) || null;
  const resolution = (formData.get("resolution") as string) || null;

  const conflict = await prisma.sourceConflict.update({
    where: { id },
    data: {
      status: resolution || "Resolved",
      resolvedValue,
      resolutionRationale,
      resolution,
      resolvedAt: new Date(),
    },
  });

  await prisma.auditEvent.create({
    data: {
      organisationId: orgId,
      userId: userId,
      action: "source_conflict_resolved",
      detail: `Source conflict resolved: ${conflict.id} — ${resolution}`,
    },
  });

  revalidatePath(`/sources/conflicts/${id}`);
  revalidatePath("/sources/conflicts");
}