"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { generateDraftObligations } from "@/lib/obligations";

export async function createEntity(formData: FormData) {
  const org = await prisma.organisation.findFirst();
  if (!org) throw new Error("No default organisation found. Please run the seed script.");

  const legalName = (formData.get("legalName") as string).trim();
  if (!legalName) throw new Error("Legal name is required");

  const companiesHouseNumber =
    ((formData.get("companiesHouseNumber") as string) || "").trim() || null;
  const jurisdiction = (formData.get("jurisdiction") as string) || "England & Wales";
  const accountingYearEndMonth = parseInt(formData.get("accountingYearEndMonth") as string, 10);
  const accountingYearEndDay = parseInt(formData.get("accountingYearEndDay") as string, 10);
  const vatMonthRaw = (formData.get("vatQuarterEndMonth") as string) || "";
  const vatQuarterEndMonth = vatMonthRaw ? parseInt(vatMonthRaw, 10) : null;
  const isLargeCompany = formData.get("isLargeCompany") === "on";
  const isVeryLargeCompany = formData.get("isVeryLargeCompany") === "on";
  const hasErs = formData.get("hasErs") === "on";
  const hasPillar2 = formData.get("hasPillar2") === "on";

  const entity = await prisma.entity.create({
    data: {
      organisationId: org.id,
      legalName,
      companiesHouseNumber,
      jurisdiction,
      accountingYearEndMonth,
      accountingYearEndDay,
      vatQuarterEndMonth,
      isLargeCompany,
      isVeryLargeCompany,
      hasErs,
      hasPillar2,
    },
  });

  revalidatePath("/entities");
  redirect(`/entities/${entity.id}`);
}

export async function saveObligations(entityId: string) {
  const entity = await prisma.entity.findUniqueOrThrow({ where: { id: entityId } });
  const rules = await prisma.obligationRule.findMany();

  const drafts = generateDraftObligations(entity, rules);

  // Replace existing DRAFT obligations for this entity
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
