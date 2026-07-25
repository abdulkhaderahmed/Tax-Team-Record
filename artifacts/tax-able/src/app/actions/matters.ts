"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { recordUserAuditEvent } from "@/lib/audit";

function str(formData: FormData, name: string): string | null {
  return ((formData.get(name) as string) || "").trim() || null;
}

function req(formData: FormData, name: string): string {
  const value = ((formData.get(name) as string) || "").trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function parseDate(raw: FormDataEntryValue | null): Date | null {
  const value = ((raw as string) || "").trim();
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Allocate the next reference for the organisation: MAT-<year>-<nnn>.
 * Scoped per organisation, so two tenants never collide.
 */
async function nextReference(organisationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `MAT-${year}-`;
  const latest = await prisma.matter.findFirst({
    where: { organisationId, reference: { startsWith: prefix } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });
  const lastNumber = latest ? Number(latest.reference.slice(prefix.length)) : 0;
  const next = Number.isFinite(lastNumber) ? lastNumber + 1 : 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

export async function createMatter(formData: FormData) {
  const context = await requirePermission("record:write");

  const entityId = str(formData, "entityId");
  if (entityId) {
    const entity = await prisma.entity.findFirst({
      where: { id: entityId, organisationId: context.orgId },
      select: { id: true },
    });
    if (!entity) throw new Error("Entity not found in this organisation");
  }

  const data = {
    organisationId: context.orgId,
    entityId,
    reference: await nextReference(context.orgId),
    title: req(formData, "title"),
    matterType: req(formData, "matterType"),
    decisionQuestion: req(formData, "decisionQuestion"),
    summary: str(formData, "summary"),
    status: (formData.get("status") as string) || "Open",
    priority: (formData.get("priority") as string) || "Normal",
    taxAreas: str(formData, "taxAreas"),
    taxOwner: str(formData, "taxOwner"),
    businessSponsor: str(formData, "businessSponsor"),
    externalAdviser: str(formData, "externalAdviser"),
    targetDecisionDate: parseDate(formData.get("targetDecisionDate")),
    createdByUserId: context.userId,
  };

  const matter = await prisma.matter.create({ data });

  await recordUserAuditEvent(context, {
    action: "matter.created",
    target: { objectType: "Matter", objectId: matter.id, entityId },
    detail: `${matter.reference} — ${matter.title}`,
    after: data,
  });

  revalidatePath("/matters");
  revalidatePath("/");
  redirect(`/matters/${matter.id}`);
}

export async function resolveMatter(formData: FormData) {
  const context = await requirePermission("record:write");
  const id = req(formData, "id");

  const existing = await prisma.matter.findFirst({
    where: { id, organisationId: context.orgId },
  });
  if (!existing) throw new Error("Matter not found in this organisation");

  const resolutionNote = req(formData, "resolutionNote");
  const status = (formData.get("status") as string) || "Resolved";

  const updated = await prisma.matter.update({
    where: { id },
    data: {
      status,
      resolutionNote,
      resolvedAt: status === "Resolved" || status === "Not proceeded" ? new Date() : null,
    },
  });

  await recordUserAuditEvent(context, {
    action: "matter.resolved",
    target: { objectType: "Matter", objectId: id, entityId: existing.entityId },
    detail: `${existing.reference} → ${status}`,
    before: { status: existing.status, resolutionNote: existing.resolutionNote },
    after: { status: updated.status, resolutionNote: updated.resolutionNote },
  });

  revalidatePath("/matters");
  revalidatePath(`/matters/${id}`);
  revalidatePath("/");
}
