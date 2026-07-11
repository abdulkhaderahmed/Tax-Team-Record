"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { recordUserAuditEvent } from "@/lib/audit";

export async function createSourceSystem(formData: FormData) {
  const context = await requirePermission("record:write");

  const name = formData.get("name") as string;
  const systemType = formData.get("systemType") as string;
  if (!name?.trim() || !systemType?.trim()) {
    throw new Error("Name and system type are required.");
  }

  const ss = await prisma.$transaction(async (tx) => {
    const created = await tx.sourceSystem.create({
      data: {
      organisationId: context.orgId,
      name: name.trim(),
      systemType: systemType.trim(),
      description: (formData.get("description") as string) || null,
      owner: (formData.get("owner") as string) || null,
      department: (formData.get("department") as string) || null,
      externalProvider: (formData.get("externalProvider") as string) || null,
      accessMethod: (formData.get("accessMethod") as string) || null,
      refreshFrequency: (formData.get("refreshFrequency") as string) || null,
      containsPersonalData: formData.get("containsPersonalData") === "true",
      containsPrivilegedData: formData.get("containsPrivilegedData") === "true",
      status: (formData.get("status") as string) || "Active",
      },
    });
    await recordUserAuditEvent(context, {
      action: "SOURCE_SYSTEM_CREATED",
      target: { objectType: "SourceSystem", objectId: created.id },
      after: created,
    }, tx);
    return created;
  });

  revalidatePath("/sources");
  redirect("/sources");
}

export async function updateSourceSystem(id: string, formData: FormData) {
  const context = await requirePermission("record:write");

  const name = formData.get("name") as string;
  const systemType = formData.get("systemType") as string;
  if (!name?.trim() || !systemType?.trim()) {
    throw new Error("Name and system type are required.");
  }

  const ss = await prisma.$transaction(async (tx) => {
    const before = await tx.sourceSystem.findFirst({
      where: { id, organisationId: context.orgId },
    });
    if (!before) throw new Error("Source system not found.");
    const updated = await tx.sourceSystem.update({
      where: { id },
      data: {
      name: name.trim(),
      systemType: systemType.trim(),
      description: (formData.get("description") as string) || null,
      owner: (formData.get("owner") as string) || null,
      department: (formData.get("department") as string) || null,
      externalProvider: (formData.get("externalProvider") as string) || null,
      accessMethod: (formData.get("accessMethod") as string) || null,
      refreshFrequency: (formData.get("refreshFrequency") as string) || null,
      containsPersonalData: formData.get("containsPersonalData") === "true",
      containsPrivilegedData: formData.get("containsPrivilegedData") === "true",
      status: (formData.get("status") as string) || "Active",
      },
    });
    await recordUserAuditEvent(context, {
      action: "SOURCE_SYSTEM_UPDATED",
      target: { objectType: "SourceSystem", objectId: id },
      before,
      after: updated,
    }, tx);
    return updated;
  });

  revalidatePath("/sources");
  revalidatePath(`/sources/${id}/edit`);
  redirect("/sources");
}

export async function archiveSourceSystem(id: string) {
  const context = await requirePermission("record:delete");

  await prisma.$transaction(async (tx) => {
    const before = await tx.sourceSystem.findFirst({
      where: { id, organisationId: context.orgId },
    });
    if (!before) throw new Error("Source system not found.");
    const archived = await tx.sourceSystem.update({
      where: { id },
      data: { status: "Archived" },
    });
    await recordUserAuditEvent(context, {
      action: "SOURCE_SYSTEM_ARCHIVED",
      target: { objectType: "SourceSystem", objectId: id },
      before,
      after: archived,
      reason: "Archived by an authorised user.",
    }, tx);
  });

  revalidatePath("/sources");
  revalidatePath(`/sources/${id}/edit`);
}
