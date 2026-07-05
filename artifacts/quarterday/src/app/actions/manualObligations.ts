"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

function parseDate(raw: string | null | undefined): Date | null {
  if (!raw || raw.trim() === "") return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function str(formData: FormData, name: string): string | null {
  return (formData.get(name) as string || "").trim() || null;
}

function req(formData: FormData, name: string): string {
  const v = (formData.get(name) as string || "").trim();
  if (!v) throw new Error(`${name} is required`);
  return v;
}

function statusField(formData: FormData, name: string): string {
  return (formData.get(name) as string) || "Not started";
}

function bool(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

function parseManualObligationForm(formData: FormData) {
  return {
    entityId:          str(formData, "entityId"),
    regime:            req(formData, "regime"),
    obligationType:    req(formData, "obligationType"),
    description:       req(formData, "description"),
    statutoryBasis:    str(formData, "statutoryBasis"),
    filingDeadline:    parseDate(formData.get("filingDeadline") as string),
    paymentDeadline:   parseDate(formData.get("paymentDeadline") as string),
    internalTargetDate: parseDate(formData.get("internalTargetDate") as string),
    recurrence:        str(formData, "recurrence"),
    periodStart:       parseDate(formData.get("periodStart") as string),
    periodEnd:         parseDate(formData.get("periodEnd") as string),
    source:            str(formData, "source"),

    responsibleOwner:  str(formData, "responsibleOwner"),
    accountableOwner:  str(formData, "accountableOwner"),
    consultedParty:    str(formData, "consultedParty"),
    informedParty:     str(formData, "informedParty"),
    externalAdviser:   str(formData, "externalAdviser"),

    dataCompletenessStatus: statusField(formData, "dataCompletenessStatus"),
    dataValidationStatus:   statusField(formData, "dataValidationStatus"),
    technicalReviewStatus:  statusField(formData, "technicalReviewStatus"),
    approvalStatus:         statusField(formData, "approvalStatus"),
    evidenceStatus:         statusField(formData, "evidenceStatus"),
    filingPaymentStatus:    statusField(formData, "filingPaymentStatus"),
    overallWorkflowStatus:  statusField(formData, "overallWorkflowStatus"),

    evidenceRequired:    bool(formData, "evidenceRequired"),
    evidenceDescription: str(formData, "evidenceDescription"),
    evidenceFileLink:    str(formData, "evidenceFileLink"),
    evidenceOwner:       str(formData, "evidenceOwner"),

    riskLevel:                    str(formData, "riskLevel"),
    consequenceOfMissingDeadline: str(formData, "consequenceOfMissingDeadline"),
    openIssueBlocker:             str(formData, "openIssueBlocker"),
    notes:                        str(formData, "notes"),
    exceptionRequired:            bool(formData, "exceptionRequired"),

    sourceType:              str(formData, "sourceType"),
    sourceDocumentReference: str(formData, "sourceDocumentReference"),
    sourcePageParagraph:     str(formData, "sourcePageParagraph"),
    createdBy:               str(formData, "createdBy"),
    lastUpdatedBy:           str(formData, "lastUpdatedBy"),
  };
}

export async function createManualObligation(formData: FormData) {
  const org = await prisma.organisation.findFirst();
  if (!org) throw new Error("No organisation found. Please run the seed script.");

  const data = parseManualObligationForm(formData);

  const mo = await prisma.manualObligation.create({
    data: { organisationId: org.id, ...data },
  });

  await prisma.auditEvent.create({
    data: {
      organisationId: org.id,
      entityId: data.entityId,
      action: "MANUAL_OBLIGATION_CREATED",
      detail: JSON.stringify({ id: mo.id, description: mo.description, regime: mo.regime }),
    },
  });

  revalidatePath("/obligations");
  revalidatePath("/");
  redirect(`/obligations/${mo.id}`);
}

export async function updateManualObligation(id: string, formData: FormData) {
  const org = await prisma.organisation.findFirst();
  if (!org) throw new Error("No organisation found.");

  const data = parseManualObligationForm(formData);

  const mo = await prisma.manualObligation.update({
    where: { id },
    data,
  });

  await prisma.auditEvent.create({
    data: {
      organisationId: org.id,
      entityId: data.entityId,
      action: "MANUAL_OBLIGATION_UPDATED",
      detail: JSON.stringify({ id: mo.id, description: mo.description, updatedBy: data.lastUpdatedBy }),
    },
  });

  revalidatePath(`/obligations/${id}`);
  revalidatePath(`/obligations/${id}/edit`);
  revalidatePath("/obligations");
  revalidatePath("/");
  redirect(`/obligations/${id}`);
}

export async function archiveManualObligation(id: string) {
  const org = await prisma.organisation.findFirst();
  const mo = await prisma.manualObligation.update({
    where: { id },
    data: { archivedAt: new Date() },
  });

  if (org) {
    await prisma.auditEvent.create({
      data: {
        organisationId: org.id,
        entityId: mo.entityId,
        action: "MANUAL_OBLIGATION_ARCHIVED",
        detail: JSON.stringify({ id: mo.id, description: mo.description }),
      },
    });
  }

  revalidatePath(`/obligations/${id}`);
  revalidatePath("/obligations");
}

export async function unarchiveManualObligation(id: string) {
  await prisma.manualObligation.update({
    where: { id },
    data: { archivedAt: null },
  });

  revalidatePath(`/obligations/${id}`);
  revalidatePath("/obligations");
}

export async function deleteManualObligation(id: string) {
  const org = await prisma.organisation.findFirst();
  const mo = await prisma.manualObligation.findUnique({ where: { id } });

  await prisma.manualObligation.delete({ where: { id } });

  if (org && mo) {
    await prisma.auditEvent.create({
      data: {
        organisationId: org.id,
        entityId: mo.entityId,
        action: "MANUAL_OBLIGATION_DELETED",
        detail: JSON.stringify({ id, description: mo.description }),
      },
    });
  }

  revalidatePath("/obligations");
  revalidatePath("/");
  redirect("/obligations");
}
