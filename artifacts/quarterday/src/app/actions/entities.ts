"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { generateDraftObligations } from "@/lib/obligations";

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

    vatRegistered: formData.get("vatRegistered") === "on",
    vatRegistrationNumber: ((formData.get("vatRegistrationNumber") as string) || "").trim() || null,
    vatQuarterEndMonth: parseIntOrNull(formData.get("vatQuarterEndMonth") as string),

    payeRegistered: formData.get("payeRegistered") === "on",
    hasErs: formData.get("hasErs") === "on",
    hasEmi: formData.get("hasEmi") === "on",
    p11dRequired: formData.get("p11dRequired") === "on",
    psaRequired: formData.get("psaRequired") === "on",

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
  const org = await prisma.organisation.findFirst();
  if (!org) throw new Error("No organisation found. Please run the seed script.");

  const data = parseEntityForm(formData);
  if (!data.legalName) throw new Error("Legal name is required");

  const entity = await prisma.entity.create({
    data: { organisationId: org.id, ...data },
  });

  revalidatePath("/entities");
  revalidatePath("/");
  redirect(`/entities/${entity.id}`);
}

export async function updateEntity(entityId: string, formData: FormData) {
  const data = parseEntityForm(formData);
  if (!data.legalName) throw new Error("Legal name is required");

  await prisma.entity.update({
    where: { id: entityId },
    data,
  });

  revalidatePath(`/entities/${entityId}`);
  revalidatePath(`/entities/${entityId}/edit`);
  revalidatePath("/entities");
  revalidatePath("/");
  redirect(`/entities/${entityId}`);
}

export async function saveObligations(entityId: string) {
  const entity = await prisma.entity.findUniqueOrThrow({ where: { id: entityId } });
  const rules = await prisma.obligationRule.findMany();

  const drafts = generateDraftObligations(entity, rules);

  await prisma.obligation.deleteMany({ where: { entityId, status: "DRAFT" } });

  if (drafts.length > 0) {
    await prisma.obligation.createMany({
      data: drafts.map((d) => ({
        entityId,
        ruleId: d.ruleId,
        title: d.title,
        dueDate: d.dueDate,
        period: d.period,
        status: "DRAFT",
      })),
    });
  }

  revalidatePath(`/entities/${entityId}/obligations`);
  revalidatePath(`/entities/${entityId}`);
  revalidatePath("/");
}

export async function deleteEntity(entityId: string) {
  await prisma.entity.delete({ where: { id: entityId } });
  revalidatePath("/entities");
  revalidatePath("/");
  redirect("/entities");
}
