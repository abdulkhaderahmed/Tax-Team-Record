"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createHash, randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { extractText } from "@/lib/text-extraction";
import { requirePermission } from "@/lib/auth";
import { requireDocumentAccess } from "@/lib/authz";
import {
  assertIndependentDocumentReviewer,
  isPositiveDocumentReviewDecision,
} from "@/lib/authz-policy";
import { recordUserAuditEvent } from "@/lib/audit";
import {
  PRIVILEGE_STATUSES,
  RELIANCE_STATUSES,
  SENSITIVITY_LEVELS,
  SOURCE_CONFIDENCE_LEVELS,
  YES_NO_UNKNOWN,
} from "@/lib/doc-constants";
import { documentContentType, getStorageDriver } from "@/lib/storage";

const CONTROLLED_DOCUMENT_FIELDS = [
  "sensitivityLevel",
  "privilegeStatus",
  "containsPersonalData",
  "containsSpecialCategory",
  "containsPayrollData",
  "containsMaData",
  "restrictedAccess",
  "accessNotes",
  "isAuthoritativeSource",
  "sourceConfidence",
  "relianceStatus",
] as const;

function allowedValue(name: string, value: string, allowed: readonly string[]) {
  if (!allowed.includes(value)) throw new Error(`Invalid ${name}.`);
  return value;
}

function assertNoControlledDocumentFields(formData: FormData) {
  if (CONTROLLED_DOCUMENT_FIELDS.some((field) => formData.has(field))) {
    throw new Error(
      "Security, access and reliance fields must be changed through their controlled review actions.",
    );
  }
}

export async function uploadDocument(formData: FormData) {
  const context = await requirePermission("document:upload");
  const orgId = context.orgId;

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("No file provided.");
  if (file.size > 15 * 1024 * 1024) throw new Error("Documents must be 15 MB or smaller.");

  const originalName = file.name;
  const ext = originalName.split(".").pop()?.toLowerCase() ?? "";
  if (ext !== "pdf" && ext !== "docx") {
    throw new Error("Only PDF and DOCX files are accepted.");
  }
  const fileType = ext as "pdf" | "docx";

  const buffer = Buffer.from(await file.arrayBuffer());
  const contentHash = createHash("sha256").update(buffer).digest("hex");

  const documentId = randomUUID();
  const storage = getStorageDriver();
  const storageKey = storage.objectKey(orgId, documentId, originalName);

  const extraction = await extractText(buffer, fileType);
  const status = extraction.error
    ? "Extraction failed"
    : extraction.chunks.some((chunk) => chunk.text.length > 0)
    ? "Text extracted"
    : "Uploaded";

  // Metadata from form
  const documentType = (formData.get("documentType") as string) || "Other";
  const entityId = (formData.get("entityId") as string) || null;
  const sourceSystemId = (formData.get("sourceSystemId") as string) || null;
  const supersedesDocumentId = (formData.get("supersedesDocumentId") as string) || null;
  const documentDateRaw = formData.get("documentDate") as string;
  const periodStartRaw = formData.get("periodStart") as string;
  const periodEndRaw = formData.get("periodEnd") as string;
  const sensitivityLevel = allowedValue(
    "sensitivity level",
    (formData.get("sensitivityLevel") as string) || "Low",
    SENSITIVITY_LEVELS,
  );
  const privilegeStatus = allowedValue(
    "privilege status",
    (formData.get("privilegeStatus") as string) || "Unknown",
    PRIVILEGE_STATUSES,
  );
  const containsPersonalData = allowedValue(
    "personal-data status",
    (formData.get("containsPersonalData") as string) || "Unknown",
    YES_NO_UNKNOWN,
  );
  const containsSpecialCategory = allowedValue(
    "special-category status",
    (formData.get("containsSpecialCategory") as string) || "Unknown",
    YES_NO_UNKNOWN,
  );
  const containsPayrollData = allowedValue(
    "payroll-data status",
    (formData.get("containsPayrollData") as string) || "Unknown",
    YES_NO_UNKNOWN,
  );
  const containsMaData = allowedValue(
    "M&A-data status",
    (formData.get("containsMaData") as string) || "Unknown",
    YES_NO_UNKNOWN,
  );

  if (entityId) {
    const entity = await prisma.entity.findFirst({ where: { id: entityId, organisationId: orgId, deletedAt: null } });
    if (!entity) throw new Error("Entity not found.");
  }
  if (sourceSystemId) {
    const sourceSystem = await prisma.sourceSystem.findFirst({ where: { id: sourceSystemId, organisationId: orgId } });
    if (!sourceSystem) throw new Error("Source system not found.");
  }
  let priorVersion: {
    id: string;
    versionNumber: number;
    relianceStatus: string;
    isAuthoritativeSource: string;
    uploadedById: string | null;
  } | null = null;
  if (supersedesDocumentId) {
    await requireDocumentAccess(supersedesDocumentId, "edit", context);
    priorVersion = await prisma.document.findFirst({
      where: { id: supersedesDocumentId, organisationId: orgId, deletedAt: null },
      select: {
        id: true,
        versionNumber: true,
        relianceStatus: true,
        isAuthoritativeSource: true,
        uploadedById: true,
      },
    });
    if (!priorVersion) throw new Error("Prior document version not found.");
    if (
      priorVersion.relianceStatus === "Approved for reliance" ||
      priorVersion.isAuthoritativeSource === "Yes"
    ) {
      await requireDocumentAccess(supersedesDocumentId, "review", context);
      const latestEdit = await prisma.auditEvent.findFirst({
        where: {
          organisationId: orgId,
          objectType: "Document",
          objectId: supersedesDocumentId,
          action: "DOCUMENT_UPDATED",
        },
        orderBy: { createdAt: "desc" },
        select: { userId: true },
      });
      assertIndependentDocumentReviewer({
        actorUserId: context.userId,
        uploadedById: priorVersion.uploadedById,
        lastEditedById: latestEdit?.userId,
      });
    }
  }

  await storage.putObject({
    key: storageKey,
    body: buffer,
    contentType: documentContentType(fileType),
  });

  let doc;
  try {
    doc = await prisma.$transaction(async (tx) => {
      const created = await tx.document.create({
        data: {
          id: documentId,
          organisationId: orgId,
          entityId,
          sourceSystemId,
          filename: originalName,
          fileType,
          fileSize: buffer.byteLength,
          contentHash,
          storageKey,
          uploadedById: context.userId,
          documentType,
          documentDate: documentDateRaw ? new Date(documentDateRaw) : null,
          periodStart: periodStartRaw ? new Date(periodStartRaw) : null,
          periodEnd: periodEndRaw ? new Date(periodEndRaw) : null,
          adviserName: (formData.get("adviserName") as string) || null,
          versionLabel: (formData.get("versionLabel") as string) || null,
          versionNumber: (priorVersion?.versionNumber ?? 0) + 1,
          supersedesDocumentId: priorVersion?.id ?? null,
          versionNotes: (formData.get("versionNotes") as string) || null,
          sensitivityLevel,
          privilegeStatus,
          containsPersonalData,
          containsSpecialCategory,
          containsPayrollData,
          containsMaData,
          restrictedAccess: formData.get("restrictedAccess") === "true",
          accessNotes: (formData.get("accessNotes") as string) || null,
          isAuthoritativeSource: "Unknown",
          sourceConfidence: "Unknown",
          relianceStatus: "Draft",
          extractionError: extraction.error ?? null,
          status,
        },
      });
      if (created.restrictedAccess) {
        await tx.documentAccess.create({
          data: {
            organisationId: orgId,
            documentId: created.id,
            userId: context.userId,
            permission: "manage",
            grantedById: context.userId,
            reason: "Uploader access",
          },
        });
      }
      if (priorVersion) {
        const priorBefore = await tx.document.findUnique({ where: { id: priorVersion.id } });
        if (!priorBefore) throw new Error("Prior document version not found.");
        const priorAfter = await tx.document.update({
          where: { id: priorVersion.id },
          data: { relianceStatus: "Superseded" },
        });
        await recordUserAuditEvent(
          context,
          {
            action: "DOCUMENT_SUPERSEDED_BY_VERSION",
            target: {
              objectType: "Document",
              objectId: priorVersion.id,
              entityId: priorBefore.entityId,
            },
            before: priorBefore,
            after: priorAfter,
            reason: `Superseded by document ${created.id}.`,
          },
          tx,
        );
      }
      await recordUserAuditEvent(
        context,
        {
          action: "DOCUMENT_UPLOADED",
          target: { objectType: "Document", objectId: created.id, entityId },
          after: created,
        },
        tx,
      );
      return created;
    });
  } catch (error) {
    await storage.deleteObject(storageKey).catch(() => undefined);
    throw error;
  }

  // Store chunks
  if (extraction.chunks.length > 0) {
    await prisma.documentChunk.createMany({
      data: extraction.chunks.map((c) => ({
        documentId: doc.id,
        chunkIndex: c.chunkIndex,
        pageNumber: c.pageNumber ?? null,
        text: c.text,
      })),
    });
  }

  // Store health flags
  if (extraction.healthFlags.length > 0) {
    await prisma.documentHealthFlag.createMany({
      data: extraction.healthFlags.map((f) => ({
        documentId: doc.id,
        marker: f.marker,
        context: f.context,
        chunkIndex: f.chunkIndex,
        pageNumber: f.pageNumber ?? null,
      })),
    });
  }

  revalidatePath("/documents");
  redirect(`/documents/${doc.id}`);
}

export async function updateDocument(id: string, formData: FormData) {
  const { context } = await requireDocumentAccess(id, "edit");
  assertNoControlledDocumentFields(formData);
  const entityId = (formData.get("entityId") as string) || null;
  const sourceSystemId = (formData.get("sourceSystemId") as string) || null;
  const documentDateRaw = formData.get("documentDate") as string;
  const periodStartRaw = formData.get("periodStart") as string;
  const periodEndRaw = formData.get("periodEnd") as string;

  if (entityId) {
    const entity = await prisma.entity.findFirst({ where: { id: entityId, organisationId: context.orgId, deletedAt: null } });
    if (!entity) throw new Error("Entity not found.");
  }
  if (sourceSystemId) {
    const sourceSystem = await prisma.sourceSystem.findFirst({ where: { id: sourceSystemId, organisationId: context.orgId } });
    if (!sourceSystem) throw new Error("Source system not found.");
  }

  await prisma.$transaction(async (tx) => {
    const before = await tx.document.findFirst({ where: { id, organisationId: context.orgId, deletedAt: null } });
    if (!before) throw new Error("Document not found.");
    const updated = await tx.document.update({
      where: { id },
      data: {
      documentType: (formData.get("documentType") as string) || "Other",
      entityId,
      sourceSystemId,
      documentDate: documentDateRaw ? new Date(documentDateRaw) : null,
      periodStart: periodStartRaw ? new Date(periodStartRaw) : null,
      periodEnd: periodEndRaw ? new Date(periodEndRaw) : null,
      adviserName: (formData.get("adviserName") as string) || null,
      versionLabel: (formData.get("versionLabel") as string) || null,
      },
    });
    await recordUserAuditEvent(
      context,
      {
        action: "DOCUMENT_UPDATED",
        target: { objectType: "Document", objectId: id, entityId },
        before,
        after: updated,
      },
      tx,
    );
  });

  revalidatePath("/documents");
  revalidatePath(`/documents/${id}`);
  redirect(`/documents/${id}`);
}

export async function updateDocumentAccessSettings(id: string, formData: FormData) {
  const { context } = await requireDocumentAccess(id, "manage");
  const reason = ((formData.get("reason") as string) || "").trim();
  if (!reason) throw new Error("A security change rationale is required.");

  const sensitivityLevel = allowedValue(
    "sensitivity level",
    (formData.get("sensitivityLevel") as string) || "Low",
    SENSITIVITY_LEVELS,
  );
  const privilegeStatus = allowedValue(
    "privilege status",
    (formData.get("privilegeStatus") as string) || "Unknown",
    PRIVILEGE_STATUSES,
  );
  const containsPersonalData = allowedValue(
    "personal-data status",
    (formData.get("containsPersonalData") as string) || "Unknown",
    YES_NO_UNKNOWN,
  );
  const containsSpecialCategory = allowedValue(
    "special-category status",
    (formData.get("containsSpecialCategory") as string) || "Unknown",
    YES_NO_UNKNOWN,
  );
  const containsPayrollData = allowedValue(
    "payroll-data status",
    (formData.get("containsPayrollData") as string) || "Unknown",
    YES_NO_UNKNOWN,
  );
  const containsMaData = allowedValue(
    "M&A-data status",
    (formData.get("containsMaData") as string) || "Unknown",
    YES_NO_UNKNOWN,
  );
  const restrictedAccess = formData.get("restrictedAccess") === "true";
  const accessNotes = ((formData.get("accessNotes") as string) || "").trim() || null;

  await prisma.$transaction(async (tx) => {
    const before = await tx.document.findFirst({
      where: { id, organisationId: context.orgId, deletedAt: null },
    });
    if (!before) throw new Error("Document not found.");
    const updated = await tx.document.update({
      where: { id },
      data: {
        sensitivityLevel,
        privilegeStatus,
        containsPersonalData,
        containsSpecialCategory,
        containsPayrollData,
        containsMaData,
        restrictedAccess,
        accessNotes,
      },
    });
    if (restrictedAccess) {
      await tx.documentAccess.upsert({
        where: { documentId_userId: { documentId: id, userId: context.userId } },
        update: {
          organisationId: context.orgId,
          permission: "manage",
          grantedById: context.userId,
          grantedAt: new Date(),
          reason: "Security settings owner",
        },
        create: {
          organisationId: context.orgId,
          documentId: id,
          userId: context.userId,
          permission: "manage",
          grantedById: context.userId,
          reason: "Security settings owner",
        },
      });
    }
    await recordUserAuditEvent(
      context,
      {
        action: "DOCUMENT_SECURITY_UPDATED",
        target: { objectType: "Document", objectId: id, entityId: before.entityId },
        before,
        after: updated,
        reason,
      },
      tx,
    );
  });

  revalidatePath("/documents");
  revalidatePath(`/documents/${id}`);
}

export async function reviewDocumentReliance(id: string, formData: FormData) {
  const { context } = await requireDocumentAccess(id, "review");
  const note = ((formData.get("note") as string) || "").trim();
  if (!note) throw new Error("A review rationale is required.");
  const relianceStatus = allowedValue(
    "reliance status",
    (formData.get("relianceStatus") as string) || "Draft",
    RELIANCE_STATUSES,
  );
  const isAuthoritativeSource = allowedValue(
    "authoritative-source status",
    (formData.get("isAuthoritativeSource") as string) || "Unknown",
    YES_NO_UNKNOWN,
  );
  const sourceConfidence = allowedValue(
    "source confidence",
    (formData.get("sourceConfidence") as string) || "Unknown",
    SOURCE_CONFIDENCE_LEVELS,
  );

  await prisma.$transaction(async (tx) => {
    const before = await tx.document.findFirst({
      where: { id, organisationId: context.orgId, deletedAt: null },
    });
    if (!before) throw new Error("Document not found.");
    if (
      isPositiveDocumentReviewDecision({
        relianceStatus,
        isAuthoritativeSource,
        sourceConfidence,
      })
    ) {
      const latestEdit = await tx.auditEvent.findFirst({
        where: {
          organisationId: context.orgId,
          objectType: "Document",
          objectId: id,
          action: "DOCUMENT_UPDATED",
        },
        orderBy: { createdAt: "desc" },
        select: { userId: true },
      });
      assertIndependentDocumentReviewer({
        actorUserId: context.userId,
        uploadedById: before.uploadedById,
        lastEditedById: latestEdit?.userId,
      });
    }
    const updated = await tx.document.update({
      where: { id },
      data: {
        relianceStatus,
        isAuthoritativeSource,
        sourceConfidence,
      },
    });
    await recordUserAuditEvent(
      context,
      {
        action: "DOCUMENT_RELIANCE_REVIEWED",
        target: { objectType: "Document", objectId: id, entityId: before.entityId },
        before,
        after: updated,
        reason: note,
      },
      tx,
    );
  });

  revalidatePath("/documents");
  revalidatePath(`/documents/${id}`);
}

export async function archiveDocument(id: string) {
  const { context } = await requireDocumentAccess(id, "edit");
  await prisma.$transaction(async (tx) => {
    const before = await tx.document.findFirst({ where: { id, organisationId: context.orgId, deletedAt: null } });
    if (!before) throw new Error("Document not found.");
    const updated = await tx.document.update({
      where: { id },
      data: { status: "Archived", archivedAt: new Date() },
    });
    await recordUserAuditEvent(
      context,
      {
        action: "DOCUMENT_ARCHIVED",
        target: { objectType: "Document", objectId: id, entityId: updated.entityId },
        before,
        after: updated,
      },
      tx,
    );
  });
  revalidatePath("/documents");
  revalidatePath(`/documents/${id}`);
  redirect("/documents");
}

export async function tombstoneDocument(id: string, formData: FormData) {
  const { context } = await requireDocumentAccess(id, "manage");
  const reason = ((formData.get("reason") as string) || "").trim();
  if (!reason) throw new Error("A deletion reason is required.");
  await prisma.$transaction(async (tx) => {
    const before = await tx.document.findFirst({ where: { id, organisationId: context.orgId, deletedAt: null } });
    if (!before) throw new Error("Document not found.");
    const updated = await tx.document.update({
      where: { id },
      data: {
        archivedAt: before.archivedAt ?? new Date(),
        status: "Archived",
        deletedAt: new Date(),
        deletedById: context.userId,
        deletionReason: reason,
      },
    });
    await recordUserAuditEvent(
      context,
      {
        action: "DOCUMENT_TOMBSTONED",
        target: { objectType: "Document", objectId: id, entityId: before.entityId },
        before,
        after: updated,
        reason,
      },
      tx,
    );
  });
  revalidatePath("/documents");
  redirect("/documents");
}

export async function grantDocumentAccess(id: string, formData: FormData) {
  const { context } = await requireDocumentAccess(id, "manage");
  const userId = ((formData.get("userId") as string) || "").trim();
  const permission = ((formData.get("permission") as string) || "view").trim();
  const reason = ((formData.get("reason") as string) || "").trim() || null;
  if (!new Set(["view", "edit", "review", "manage"]).has(permission)) throw new Error("Invalid document permission.");
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({ where: { id: userId, organisationId: context.orgId } });
    if (!user) throw new Error("User not found.");
    const access = await tx.documentAccess.upsert({
      where: { documentId_userId: { documentId: id, userId } },
      update: { organisationId: context.orgId, permission, grantedById: context.userId, grantedAt: new Date(), reason },
      create: {
        organisationId: context.orgId,
        documentId: id,
        userId,
        permission,
        grantedById: context.userId,
        reason,
      },
    });
    await recordUserAuditEvent(context, {
      action: "DOCUMENT_ACCESS_GRANTED",
      target: { objectType: "Document", objectId: id },
      after: access,
      reason,
    }, tx);
  });
  revalidatePath(`/documents/${id}`);
}

export async function verifyDocumentSource(id: string, formData: FormData) {
  const { context } = await requireDocumentAccess(id, "review");
  const note = ((formData.get("note") as string) || "").trim();
  if (!note) throw new Error("A source-verification rationale is required.");
  await prisma.$transaction(async (tx) => {
    const before = await tx.document.findFirst({
      where: { id, organisationId: context.orgId, deletedAt: null },
    });
    if (!before) throw new Error("Document not found.");
    const latestEdit = await tx.auditEvent.findFirst({
      where: {
        organisationId: context.orgId,
        objectType: "Document",
        objectId: id,
        action: "DOCUMENT_UPDATED",
      },
      orderBy: { createdAt: "desc" },
      select: { userId: true },
    });
    assertIndependentDocumentReviewer({
      actorUserId: context.userId,
      uploadedById: before.uploadedById,
      lastEditedById: latestEdit?.userId,
    });
    const updated = await tx.document.update({
      where: { id },
      data: { sourceVerifiedAt: new Date(), sourceVerifiedById: context.userId },
    });
    await recordUserAuditEvent(
      context,
      {
        action: "DOCUMENT_SOURCE_VERIFIED",
        target: { objectType: "Document", objectId: id, entityId: updated.entityId },
        before,
        after: updated,
        reason: note,
      },
      tx,
    );
  });
  revalidatePath(`/documents/${id}`);
}
