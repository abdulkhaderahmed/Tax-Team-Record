"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOrg, requirePermission } from "@/lib/auth";
import { recordUserAuditEvent } from "@/lib/audit";
import { requireDocumentAccess } from "@/lib/authz";
import { assertPermission } from "@/lib/authz-policy";

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function required(formData: FormData, name: string) {
  const value = text(formData, name);
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function date(value: string | null) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid date.");
  return parsed;
}

export async function createEntityGroup(formData: FormData) {
  const context = await requirePermission("entity:write");
  const name = required(formData, "name");
  const associatedCompanyCount = Math.max(1, Number(text(formData, "associatedCompanyCount") ?? 1));
  const group = await prisma.entityGroup.create({
    data: { organisationId: context.orgId, name, description: text(formData, "description"), associatedCompanyCount },
  });
  await recordUserAuditEvent(context, { action: "ENTITY_GROUP_CREATED", target: { objectType: "EntityGroup", objectId: group.id }, after: group });
  revalidatePath("/groups");
}

export async function assignEntityGroup(formData: FormData) {
  const context = await requirePermission("entity:write");
  const entityId = required(formData, "entityId");
  const groupId = required(formData, "groupId");
  const [entity, group] = await Promise.all([
    prisma.entity.findFirst({ where: { id: entityId, organisationId: context.orgId, deletedAt: null } }),
    prisma.entityGroup.findFirst({ where: { id: groupId, organisationId: context.orgId } }),
  ]);
  if (!entity || !group) throw new Error("Entity or group not found.");
  const updated = await prisma.entity.update({
    where: { id: entityId },
    data: { groupId, qipAssociatedCompanyCount: group.associatedCompanyCount },
  });
  await recordUserAuditEvent(context, { action: "ENTITY_ASSIGNED_TO_GROUP", target: { objectType: "Entity", objectId: entityId, entityId }, before: entity, after: updated });
  revalidatePath("/groups");
  revalidatePath(`/entities/${entityId}`);
}

export async function createEntityRelation(formData: FormData) {
  const context = await requirePermission("entity:write");
  const fromEntityId = required(formData, "fromEntityId");
  const toEntityId = required(formData, "toEntityId");
  if (fromEntityId === toEntityId) throw new Error("An entity cannot relate to itself.");
  const entityCount = await prisma.entity.count({
    where: { id: { in: [fromEntityId, toEntityId] }, organisationId: context.orgId, deletedAt: null },
  });
  if (entityCount !== 2) throw new Error("Both entities must be in this organisation.");
  const ownershipRaw = text(formData, "ownershipPct");
  const relation = await prisma.entityRelation.create({
    data: {
      organisationId: context.orgId,
      fromEntityId,
      toEntityId,
      relationType: required(formData, "relationType"),
      ownershipPct: ownershipRaw ? Number(ownershipRaw) : null,
      effectiveFrom: date(text(formData, "effectiveFrom")),
      effectiveTo: date(text(formData, "effectiveTo")),
      notes: text(formData, "notes"),
    },
  });
  await recordUserAuditEvent(context, { action: "ENTITY_RELATION_CREATED", target: { objectType: "EntityRelation", objectId: relation.id }, after: relation });
  revalidatePath("/groups");
}

export async function createTaxRegistration(formData: FormData) {
  const context = await requireOrg();
  assertPermission(context.user.role, "entity:write");
  const sourceVerified = formData.get("verified") === "on";
  if (sourceVerified) assertPermission(context.user.role, "review:perform");
  const entityId = required(formData, "entityId");
  const entity = await prisma.entity.findFirst({ where: { id: entityId, organisationId: context.orgId, deletedAt: null } });
  if (!entity) throw new Error("Entity not found.");
  const registration = await prisma.taxRegistration.create({
    data: {
      organisationId: context.orgId,
      entityId,
      registrationType: required(formData, "registrationType"),
      reference: text(formData, "reference"),
      jurisdiction: text(formData, "jurisdiction") ?? "United Kingdom",
      status: text(formData, "status") ?? "Active",
      effectiveFrom: date(text(formData, "effectiveFrom")),
      effectiveTo: date(text(formData, "effectiveTo")),
      sourceVerifiedAt: sourceVerified ? new Date() : null,
      sourceVerifiedById: sourceVerified ? context.userId : null,
      notes: text(formData, "notes"),
    },
  });
  await recordUserAuditEvent(context, { action: "TAX_REGISTRATION_CREATED", target: { objectType: "TaxRegistration", objectId: registration.id, entityId }, after: registration });
  revalidatePath("/registrations");
  revalidatePath(`/entities/${entityId}`);
}

export async function createAccountingPeriod(formData: FormData) {
  const context = await requirePermission("review:perform");
  const entityId = required(formData, "entityId");
  const sourceDocumentId = text(formData, "sourceDocumentId");
  if (sourceDocumentId) await requireDocumentAccess(sourceDocumentId, "view", context);
  const entity = await prisma.entity.findFirst({ where: { id: entityId, organisationId: context.orgId, deletedAt: null } });
  if (!entity) throw new Error("Entity not found.");
  const periodOfAccountStart = date(required(formData, "periodOfAccountStart"))!;
  const periodOfAccountEnd = date(required(formData, "periodOfAccountEnd"))!;
  const ctPeriodStart = date(required(formData, "ctPeriodStart"))!;
  const ctPeriodEnd = date(required(formData, "ctPeriodEnd"))!;
  if (ctPeriodEnd < ctPeriodStart || periodOfAccountEnd < periodOfAccountStart) {
    throw new Error("Period end cannot precede period start.");
  }
  if (ctPeriodStart < periodOfAccountStart || ctPeriodEnd > periodOfAccountEnd) {
    throw new Error("A Corporation Tax period must sit within the period of account.");
  }
  await prisma.$transaction(async (tx) => {
    const overlap = await tx.accountingPeriod.findFirst({
      where: {
        entityId,
        organisationId: context.orgId,
        status: "Confirmed",
        ctPeriodStart: { lte: ctPeriodEnd },
        ctPeriodEnd: { gte: ctPeriodStart },
      },
      select: { id: true },
    });
    if (overlap) throw new Error("This Corporation Tax period overlaps an existing confirmed period.");
    const period = await tx.accountingPeriod.create({
      data: {
        organisationId: context.orgId,
        entityId,
        periodOfAccountStart,
        periodOfAccountEnd,
        ctPeriodStart,
        ctPeriodEnd,
        status: "Confirmed",
        sourceDocumentId,
        verifiedAt: new Date(),
        verifiedById: context.userId,
      },
    });
    await recordUserAuditEvent(context, { action: "ACCOUNTING_PERIOD_CONFIRMED", target: { objectType: "AccountingPeriod", objectId: period.id, entityId }, after: period }, tx);
  });
  revalidatePath("/periods");
  revalidatePath(`/entities/${entityId}`);
}
