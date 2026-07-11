"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { recordUserAuditEvent } from "@/lib/audit";

const OPEN_STATUSES = new Set(["Open", "Under review", "Awaiting confirmation"]);

export async function createSourceConflict(formData: FormData) {
  const context = await requirePermission("record:write");

  const dataCategoryId = formData.get("dataCategoryId") as string;
  const sourceAId = formData.get("sourceAId") as string;
  const sourceBId = formData.get("sourceBId") as string;
  const sourceAValue = formData.get("sourceAValue") as string;
  const sourceBValue = formData.get("sourceBValue") as string;

  if (!dataCategoryId || !sourceAId || !sourceBId || !sourceAValue || !sourceBValue) {
    throw new Error("Data category, both sources, and their values are required.");
  }

  if (sourceAId === sourceBId) {
    throw new Error("A conflict requires two different source systems.");
  }
  const entityId = (formData.get("entityId") as string) || null;
  const reviewOwnerId = (formData.get("reviewOwnerId") as string) || null;

  const conflict = await prisma.$transaction(async (tx) => {
    const [category, sources, entity, reviewOwner] = await Promise.all([
      tx.dataCategory.findUnique({ where: { id: dataCategoryId }, select: { id: true } }),
      tx.sourceSystem.count({
        where: { id: { in: [sourceAId, sourceBId] }, organisationId: context.orgId },
      }),
      entityId
        ? tx.entity.findFirst({
            where: { id: entityId, organisationId: context.orgId, deletedAt: null },
            select: { id: true },
          })
        : null,
      reviewOwnerId
        ? tx.user.findFirst({
            where: { id: reviewOwnerId, organisationId: context.orgId },
            select: { id: true },
          })
        : null,
    ]);
    if (!category) throw new Error("Data category not found.");
    if (sources !== 2) throw new Error("Source system not found in this organisation.");
    if (entityId && !entity) throw new Error("Entity not found in this organisation.");
    if (reviewOwnerId && !reviewOwner) {
      throw new Error("Review owner not found in this organisation.");
    }

    const created = await tx.sourceConflict.create({
      data: {
        organisationId: context.orgId,
        dataCategoryId,
        entityId,
        sourceAId,
        sourceAValue: sourceAValue.trim(),
        sourceBId,
        sourceBValue: sourceBValue.trim(),
        severity: (formData.get("severity") as string) || null,
        reviewOwnerId,
        requiredConfirmation: (formData.get("requiredConfirmation") as string) || null,
        status: "Open",
      },
    });
    await recordUserAuditEvent(
      context,
      {
        action: "SOURCE_CONFLICT_CREATED",
        target: { objectType: "SourceConflict", objectId: created.id, entityId },
        after: created,
      },
      tx,
    );
    return created;
  });

  revalidatePath("/sources/conflicts");
  redirect(`/sources/conflicts/${conflict.id}`);
}

export async function updateConflictStatus(id: string, formData: FormData) {
  const context = await requirePermission("record:write");
  const status = formData.get("status") as string;
  if (!OPEN_STATUSES.has(status)) throw new Error("Invalid open conflict status.");
  const reviewOwnerId = (formData.get("reviewOwnerId") as string) || null;
  const requiredConfirmation = (formData.get("requiredConfirmation") as string) || null;

  await prisma.$transaction(async (tx) => {
    const before = await tx.sourceConflict.findFirst({
      where: { id, organisationId: context.orgId },
    });
    if (!before) throw new Error("Source conflict not found.");
    if (reviewOwnerId) {
      const owner = await tx.user.findFirst({
        where: { id: reviewOwnerId, organisationId: context.orgId },
        select: { id: true },
      });
      if (!owner) throw new Error("Review owner not found in this organisation.");
    }
    const updated = await tx.sourceConflict.update({
      where: { id },
      data: { status, reviewOwnerId, requiredConfirmation },
    });
    await recordUserAuditEvent(
      context,
      {
        action: "SOURCE_CONFLICT_UPDATED",
        target: { objectType: "SourceConflict", objectId: id, entityId: updated.entityId },
        before,
        after: updated,
      },
      tx,
    );
  });

  revalidatePath(`/sources/conflicts/${id}`);
  revalidatePath("/sources/conflicts");
}

export async function resolveSourceConflict(id: string, formData: FormData) {
  const context = await requirePermission("record:write");

  const resolvedValue = (formData.get("resolvedValue") as string) || null;
  const resolutionRationale = (formData.get("resolutionRationale") as string) || null;
  const resolution = (formData.get("resolution") as string) || null;

  const resolutionStatus = resolution || "Resolved";
  if (!["Resolved", "Closed as not material"].includes(resolutionStatus)) {
    throw new Error("Invalid resolution status.");
  }

  await prisma.$transaction(async (tx) => {
    const before = await tx.sourceConflict.findFirst({
      where: { id, organisationId: context.orgId },
    });
    if (!before) throw new Error("Source conflict not found.");
    const conflict = await tx.sourceConflict.update({
      where: { id },
      data: {
        status: resolutionStatus,
        resolvedValue,
        resolutionRationale,
        resolution: resolutionStatus,
        resolvedAt: new Date(),
      },
    });
    await recordUserAuditEvent(
      context,
      {
        action: "SOURCE_CONFLICT_RESOLVED",
        target: { objectType: "SourceConflict", objectId: id, entityId: conflict.entityId },
        before,
        after: conflict,
        reason: resolutionRationale,
      },
      tx,
    );
  });

  revalidatePath(`/sources/conflicts/${id}`);
  revalidatePath("/sources/conflicts");
}
