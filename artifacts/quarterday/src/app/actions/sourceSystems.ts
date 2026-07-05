"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const ORG_ID = "demo-org";
const USER_ID = undefined; // until auth is added

export async function createSourceSystem(formData: FormData) {
  const name = formData.get("name") as string;
  const systemType = formData.get("systemType") as string;
  if (!name?.trim() || !systemType?.trim()) {
    throw new Error("Name and system type are required.");
  }

  const ss = await prisma.sourceSystem.create({
    data: {
      organisationId: ORG_ID,
      name: name.trim(),
      systemType: systemType.trim(),
      description: (formData.get("description") as string) || null,
      owner: (formData.get("owner") as string) || null,
      department: (formData.get("department") as string) || null,
      externalProvider: (formData.get("externalProvider") as string) || null,
      accessMethod: (formData.get("accessMethod") as string) || null,
      refreshFrequency: (formData.get("refreshFrequency") as string) || null,
      containsPersonalData: formData.get("containsPersonalData") === "true",
      containsPrivilegedData: formData.get("containsPrivilegedData") === "true",
      status: (formData.get("status") as string) || "Active",
    },
  });

  await prisma.auditEvent.create({
    data: {
      organisationId: ORG_ID,
      userId: USER_ID,
      action: "source_system_created",
      detail: `Source system created: ${ss.name}`,
    },
  });

  revalidatePath("/sources");
  redirect("/sources");
}

export async function updateSourceSystem(id: string, formData: FormData) {
  const name = formData.get("name") as string;
  const systemType = formData.get("systemType") as string;
  if (!name?.trim() || !systemType?.trim()) {
    throw new Error("Name and system type are required.");
  }

  const ss = await prisma.sourceSystem.update({
    where: { id },
    data: {
      name: name.trim(),
      systemType: systemType.trim(),
      description: (formData.get("description") as string) || null,
      owner: (formData.get("owner") as string) || null,
      department: (formData.get("department") as string) || null,
      externalProvider: (formData.get("externalProvider") as string) || null,
      accessMethod: (formData.get("accessMethod") as string) || null,
      refreshFrequency: (formData.get("refreshFrequency") as string) || null,
      containsPersonalData: formData.get("containsPersonalData") === "true",
      containsPrivilegedData: formData.get("containsPrivilegedData") === "true",
      status: (formData.get("status") as string) || "Active",
    },
  });

  await prisma.auditEvent.create({
    data: {
      organisationId: ORG_ID,
      userId: USER_ID,
      action: "source_system_edited",
      detail: `Source system edited: ${ss.name}`,
    },
  });

  revalidatePath("/sources");
  revalidatePath(`/sources/${id}/edit`);
  redirect("/sources");
}

export async function archiveSourceSystem(id: string) {
  const ss = await prisma.sourceSystem.update({
    where: { id },
    data: { status: "Archived" },
  });

  await prisma.auditEvent.create({
    data: {
      organisationId: ORG_ID,
      userId: USER_ID,
      action: "source_system_archived",
      detail: `Source system archived: ${ss.name}`,
    },
  });

  revalidatePath("/sources");
  revalidatePath(`/sources/${id}/edit`);
}
