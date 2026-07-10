"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { computeOverallStatus } from "@/lib/ownership-control";
import { recordFieldChanges, recordOverallStatusRecalculated } from "@/lib/status-history";

const TRACKED_FIELDS = [
  "responsibleOwner", "accountableOwner", "consultedParty", "informedParty", "externalAdviser", "externalOperationalOwner",
  "dataCompletenessStatus", "dataValidationStatus", "technicalReviewStatus", "approvalStatus",
  "workflowProgressStatus", "evidenceStatus", "filingSubmissionStatus", "paymentStatus", "overallWorkflowStatus",
  "dataCollectionRequired", "dataValidationRequired", "technicalReviewRequired", "accountableApprovalRequired",
  "evidenceRequired", "filingSubmissionRequired", "paymentRequired",
];

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

    responsibleOwner:         str(formData, "responsibleOwner"),
    accountableOwner:         str(formData, "accountableOwner"),
    consultedParty:           str(formData, "consultedParty"),
    informedParty:            str(formData, "informedParty"),
    externalAdviser:          str(formData, "externalAdviser"),
    externalOperationalOwner: str(formData, "externalOperationalOwner"),

    dataCollectionRequired:      bool(formData, "dataCollectionRequired"),
    dataValidationRequired:      bool(formData, "dataValidationRequired"),
    technicalReviewRequired:     bool(formData, "technicalReviewRequired"),
    accountableApprovalRequired: bool(formData, "accountableApprovalRequired"),
    filingSubmissionRequired:    bool(formData, "filingSubmissionRequired"),
    paymentRequired:             bool(formData, "paymentRequired"),

    dataCompletenessStatus: statusField(formData, "dataCompletenessStatus"),
    dataValidationStatus:   statusField(formData, "dataValidationStatus"),
    technicalReviewStatus:  statusField(formData, "technicalReviewStatus"),
    approvalStatus:         statusField(formData, "approvalStatus"),
    workflowProgressStatus: statusField(formData, "workflowProgressStatus"),
    evidenceStatus:         statusField(formData, "evidenceStatus"),
    filingSubmissionStatus: statusField(formData, "filingSubmissionStatus"),
    paymentStatus:          statusField(formData, "paymentStatus"),

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

function resolveOverallStatus(
  data: ReturnType<typeof parseManualObligationForm>,
  formData: FormData
): { overallWorkflowStatus: string; overallStatusIsOverride: boolean; computed: string } {
  const computed = computeOverallStatus(data).status;
  const overrideValue = (formData.get("overallStatusOverride") as string || "").trim();
  if (overrideValue && overrideValue !== computed) {
    return { overallWorkflowStatus: overrideValue, overallStatusIsOverride: true, computed };
  }
  return { overallWorkflowStatus: computed, overallStatusIsOverride: false, computed };
}

export async function createManualObligation(formData: FormData) {
  const org = await prisma.organisation.findFirst();
  if (!org) throw new Error("No organisation found. Please run the seed script.");

  const data = parseManualObligationForm(formData);
  const { overallWorkflowStatus, overallStatusIsOverride, computed } = resolveOverallStatus(data, formData);

  const mo = await prisma.manualObligation.create({
    data: { organisationId: org.id, ...data, overallWorkflowStatus, overallStatusIsOverride },
  });

  await prisma.auditEvent.create({
    data: {
      organisationId: org.id,
      entityId: data.entityId,
      manualObligationId: mo.id,
      action: "MANUAL_OBLIGATION_CREATED",
      detail: JSON.stringify({ id: mo.id, description: mo.description, regime: mo.regime }),
    },
  });

  await recordOverallStatusRecalculated({
    objectType: "ManualObligation", objectId: mo.id, organisationId: org.id, entityId: data.entityId,
    computedStatus: computed, storedStatus: overallWorkflowStatus, wasOverridden: overallStatusIsOverride,
  });

  revalidatePath("/obligations");
  revalidatePath("/");
  redirect(`/obligations/${mo.id}`);
}

export async function updateManualObligation(id: string, formData: FormData) {
  const org = await prisma.organisation.findFirst();
  if (!org) throw new Error("No organisation found.");

  const before = await prisma.manualObligation.findUnique({ where: { id } });
  if (!before) throw new Error("Obligation not found.");

  const data = parseManualObligationForm(formData);
  const statusChangeReason = str(formData, "statusChangeReason");
  const { overallWorkflowStatus, overallStatusIsOverride, computed } = resolveOverallStatus(data, formData);

  const mo = await prisma.manualObligation.update({
    where: { id },
    data: { ...data, overallWorkflowStatus, overallStatusIsOverride },
  });

  await recordFieldChanges({
    objectType: "ManualObligation", objectId: id, organisationId: org.id, entityId: data.entityId,
    before: before as unknown as Record<string, unknown>, after: mo as unknown as Record<string, unknown>,
    fields: TRACKED_FIELDS, changedBy: data.lastUpdatedBy, reason: statusChangeReason,
  });

  if (before.overallWorkflowStatus !== overallWorkflowStatus) {
    await recordOverallStatusRecalculated({
      objectType: "ManualObligation", objectId: id, organisationId: org.id, entityId: data.entityId,
      computedStatus: computed, storedStatus: overallWorkflowStatus, wasOverridden: overallStatusIsOverride,
    });
  }

  await prisma.auditEvent.create({
    data: {
      organisationId: org.id,
      entityId: data.entityId,
      manualObligationId: mo.id,
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
