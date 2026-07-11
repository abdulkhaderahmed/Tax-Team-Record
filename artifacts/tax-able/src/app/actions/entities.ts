"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { recordUserAuditEvent } from "@/lib/audit";

function parseDate(raw: string | null): Date | null {
  if (!raw || raw.trim() === "") return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function parseIntOrNull(raw: string | null): number | null {
  if (!raw || raw.trim() === "") return null;
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}

function parseEntityForm(formData: FormData) {
  return {
    legalName: (formData.get("legalName") as string).trim(),
    companiesHouseNumber: ((formData.get("companiesHouseNumber") as string) || "").trim() || null,
    jurisdiction: (formData.get("jurisdiction") as string) || "England & Wales",
    entityType: ((formData.get("entityType") as string) || "").trim() || null,
    ukTaxResident: formData.get("ukTaxResident") === "on",

    corporationTaxUtr: ((formData.get("corporationTaxUtr") as string) || "").trim() || null,
    accountingPeriodStart: parseDate(formData.get("accountingPeriodStart") as string),
    accountingPeriodEnd: parseDate(formData.get("accountingPeriodEnd") as string),
    companiesHouseAccountsDue: parseDate(formData.get("companiesHouseAccountsDue") as string),
    ctReturnRequired: formData.get("ctReturnRequired") === "on",
    ctPaymentMethod: ((formData.get("ctPaymentMethod") as string) || "").trim() || null,
    isLargeCompany: formData.get("isLargeCompany") === "on",
    isVeryLargeCompany: formData.get("isVeryLargeCompany") === "on",
    taxableProfitsBand: ((formData.get("taxableProfitsBand") as string) || "").trim() || null,
    qipAssociatedCompanyCount: Math.max(1, parseIntOrNull(formData.get("qipAssociatedCompanyCount") as string) ?? 1),

    vatRegistered: formData.get("vatRegistered") === "on",
    vatRegistrationNumber: ((formData.get("vatRegistrationNumber") as string) || "").trim() || null,
    vatQuarterEndMonth: parseIntOrNull(formData.get("vatQuarterEndMonth") as string),

    payeRegistered: formData.get("payeRegistered") === "on",
    hasErs: formData.get("hasErs") === "on",
    hasEmi: formData.get("hasEmi") === "on",
    p11dRequired: formData.get("p11dRequired") === "on",
    psaRequired: formData.get("psaRequired") === "on",
    benefitsReportingMethod: (formData.get("benefitsReportingMethod") as string) || "P11D",
    hasLoansOrAccommodationBenefits: formData.get("hasLoansOrAccommodationBenefits") === "on",
    psaAgreementStatus: (formData.get("psaAgreementStatus") as string) || "Not in place",
    psaPaymentMethod: (formData.get("psaPaymentMethod") as string) || "Electronic",

    rdClaimExpected: formData.get("rdClaimExpected") === "on",
    rdNotificationNeeded: formData.get("rdNotificationNeeded") === "on",
    rdAifNeeded: formData.get("rdAifNeeded") === "on",

    capitalAllowancesActivity: formData.get("capitalAllowancesActivity") === "on",
    fullExpensingRelevant: formData.get("fullExpensingRelevant") === "on",
    aiaRelevant: formData.get("aiaRelevant") === "on",
    specialRatePoolRelevant: formData.get("specialRatePoolRelevant") === "on",

    groupReliefRelevant: formData.get("groupReliefRelevant") === "on",
    lossesBroughtForward: formData.get("lossesBroughtForward") === "on",
    transferPricingRelevant: formData.get("transferPricingRelevant") === "on",
    hasPillar2: formData.get("hasPillar2") === "on",
    pillar2FirstReportingPeriod: formData.get("pillar2FirstReportingPeriod") === "on",

    saoInScope: formData.get("saoInScope") === "on",
    ccoInScope: formData.get("ccoInScope") === "on",
    publishedTaxStrategyInScope: formData.get("publishedTaxStrategyInScope") === "on",

    primaryTaxOwner: ((formData.get("primaryTaxOwner") as string) || "").trim() || null,
    financeOwner: ((formData.get("financeOwner") as string) || "").trim() || null,
    payrollOwner: ((formData.get("payrollOwner") as string) || "").trim() || null,
    externalAdviser: ((formData.get("externalAdviser") as string) || "").trim() || null,
  };
}

export async function createEntity(formData: FormData) {
  const context = await requirePermission("entity:write");

  const data = parseEntityForm(formData);
  if (!data.legalName) throw new Error("Legal name is required");

  const entity = await prisma.$transaction(async (tx) => {
    const created = await tx.entity.create({
      data: { organisationId: context.orgId, ...data },
    });
    await recordUserAuditEvent(
      context,
      {
        action: "ENTITY_CREATED",
        target: { objectType: "Entity", objectId: created.id, entityId: created.id },
        after: created,
      },
      tx,
    );
    return created;
  });

  revalidatePath("/entities");
  revalidatePath("/");
  redirect(`/entities/${entity.id}`);
}

export async function updateEntity(entityId: string, formData: FormData) {
  const context = await requirePermission("entity:write");
  const data = parseEntityForm(formData);
  if (!data.legalName) throw new Error("Legal name is required");

  await prisma.$transaction(async (tx) => {
    const before = await tx.entity.findFirst({
      where: { id: entityId, organisationId: context.orgId, deletedAt: null },
    });
    if (!before) throw new Error("Entity not found.");
    const updated = await tx.entity.update({ where: { id: entityId }, data });
    await recordUserAuditEvent(
      context,
      {
        action: "ENTITY_UPDATED",
        target: { objectType: "Entity", objectId: entityId, entityId },
        before,
        after: updated,
      },
      tx,
    );
  });

  revalidatePath(`/entities/${entityId}`);
  revalidatePath(`/entities/${entityId}/edit`);
  revalidatePath("/entities");
  revalidatePath("/");
  redirect(`/entities/${entityId}`);
}

export async function deleteEntity(entityId: string, formData: FormData) {
  const context = await requirePermission("entity:delete");
  const reason = ((formData.get("reason") as string) || "").trim();
  if (!reason) throw new Error("An archive reason is required.");

  await prisma.$transaction(async (tx) => {
    const before = await tx.entity.findFirst({
      where: { id: entityId, organisationId: context.orgId, deletedAt: null },
    });
    if (!before) throw new Error("Entity not found.");
    const archived = await tx.entity.update({
      where: { id: entityId },
      data: { archivedAt: new Date(), deletionReason: reason },
    });
    await recordUserAuditEvent(
      context,
      {
        action: "ENTITY_ARCHIVED",
        target: { objectType: "Entity", objectId: entityId, entityId },
        before,
        after: archived,
        reason,
      },
      tx,
    );
  });
  revalidatePath("/entities");
  revalidatePath("/");
  redirect("/entities");
}
