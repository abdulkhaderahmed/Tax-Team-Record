"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { extractText } from "@/lib/text-extraction";

const ORG_ID = "demo-org";
const USER_ID = undefined;

function uploadsDir() {
  return path.join(process.cwd(), "uploads");
}

export async function uploadDocument(formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("No file provided.");

  const originalName = file.name;
  const ext = originalName.split(".").pop()?.toLowerCase() ?? "";
  if (ext !== "pdf" && ext !== "docx") {
    throw new Error("Only PDF and DOCX files are accepted.");
  }
  const fileType = ext as "pdf" | "docx";

  const buffer = Buffer.from(await file.arrayBuffer());
  const contentHash = createHash("sha256").update(buffer).digest("hex");

  // Ensure uploads directory exists
  const dir = uploadsDir();
  await mkdir(dir, { recursive: true });

  // Generate a unique storage key
  const { randomUUID } = await import("crypto");
  const storageKey = `${randomUUID()}.${ext}`;
  await writeFile(path.join(dir, storageKey), buffer);

  // Extract text
  const extraction = await extractText(buffer, fileType);
  const status = extraction.error
    ? "Extraction failed"
    : extraction.chunks.length > 0 && extraction.chunks[0].text.length > 0
    ? "Text extracted"
    : "Uploaded";

  // Metadata from form
  const documentType = (formData.get("documentType") as string) || "Other";
  const entityId = (formData.get("entityId") as string) || null;
  const sourceSystemId = (formData.get("sourceSystemId") as string) || null;
  const documentDateRaw = formData.get("documentDate") as string;
  const periodStartRaw = formData.get("periodStart") as string;
  const periodEndRaw = formData.get("periodEnd") as string;

  const doc = await prisma.document.create({
    data: {
      organisationId: ORG_ID,
      entityId,
      sourceSystemId,
      filename: originalName,
      fileType,
      fileSize: buffer.byteLength,
      contentHash,
      storageKey,
      uploadedBy: formData.get("uploadedBy") as string || "Alex Smith",
      documentType,
      documentDate: documentDateRaw ? new Date(documentDateRaw) : null,
      periodStart: periodStartRaw ? new Date(periodStartRaw) : null,
      periodEnd: periodEndRaw ? new Date(periodEndRaw) : null,
      adviserName: (formData.get("adviserName") as string) || null,
      versionLabel: (formData.get("versionLabel") as string) || null,
      sensitivityLevel: (formData.get("sensitivityLevel") as string) || "Low",
      privilegeStatus: (formData.get("privilegeStatus") as string) || "Unknown",
      containsPersonalData: (formData.get("containsPersonalData") as string) || "Unknown",
      containsSpecialCategory: (formData.get("containsSpecialCategory") as string) || "Unknown",
      containsPayrollData: (formData.get("containsPayrollData") as string) || "Unknown",
      containsMaData: (formData.get("containsMaData") as string) || "Unknown",
      restrictedAccess: formData.get("restrictedAccess") === "true",
      accessNotes: (formData.get("accessNotes") as string) || null,
      isAuthoritativeSource: (formData.get("isAuthoritativeSource") as string) || "Unknown",
      sourceConfidence: (formData.get("sourceConfidence") as string) || "Unknown",
      relianceStatus: (formData.get("relianceStatus") as string) || "Draft",
      extractionError: extraction.error ?? null,
      status,
    },
  });

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

  await prisma.auditEvent.create({
    data: {
      organisationId: ORG_ID,
      userId: USER_ID,
      entityId: entityId ?? null,
      action: "document_uploaded",
      detail: `Document uploaded: ${originalName} (${documentType})`,
    },
  });

  revalidatePath("/documents");
  redirect(`/documents/${doc.id}`);
}

export async function updateDocument(id: string, formData: FormData) {
  const entityId = (formData.get("entityId") as string) || null;
  const sourceSystemId = (formData.get("sourceSystemId") as string) || null;
  const documentDateRaw = formData.get("documentDate") as string;
  const periodStartRaw = formData.get("periodStart") as string;
  const periodEndRaw = formData.get("periodEnd") as string;

  await prisma.document.update({
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
      sensitivityLevel: (formData.get("sensitivityLevel") as string) || "Low",
      privilegeStatus: (formData.get("privilegeStatus") as string) || "Unknown",
      containsPersonalData: (formData.get("containsPersonalData") as string) || "Unknown",
      containsSpecialCategory: (formData.get("containsSpecialCategory") as string) || "Unknown",
      containsPayrollData: (formData.get("containsPayrollData") as string) || "Unknown",
      containsMaData: (formData.get("containsMaData") as string) || "Unknown",
      restrictedAccess: formData.get("restrictedAccess") === "true",
      accessNotes: (formData.get("accessNotes") as string) || null,
      isAuthoritativeSource: (formData.get("isAuthoritativeSource") as string) || "Unknown",
      sourceConfidence: (formData.get("sourceConfidence") as string) || "Unknown",
      relianceStatus: (formData.get("relianceStatus") as string) || "Draft",
    },
  });

  revalidatePath("/documents");
  revalidatePath(`/documents/${id}`);
  redirect(`/documents/${id}`);
}

export async function archiveDocument(id: string) {
  await prisma.document.update({
    where: { id },
    data: { status: "Archived", archivedAt: new Date() },
  });
  await prisma.auditEvent.create({
    data: {
      organisationId: ORG_ID,
      userId: USER_ID,
      action: "document_archived",
      detail: `Document archived: ${id}`,
    },
  });
  revalidatePath("/documents");
  revalidatePath(`/documents/${id}`);
  redirect("/documents");
}
