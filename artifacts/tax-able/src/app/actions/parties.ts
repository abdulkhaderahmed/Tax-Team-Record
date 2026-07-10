"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/auth";


function str(formData: FormData, name: string): string | null {
  return ((formData.get(name) as string) || "").trim() || null;
}

function req(formData: FormData, name: string): string {
  const v = ((formData.get(name) as string) || "").trim();
  if (!v) throw new Error(`${name} is required`);
  return v;
}

export async function createParty(formData: FormData) {
  const { organisation: org, user } = await requireOrg();
  const orgId = org.id;
  const userId = user.id;

  const party = await prisma.party.create({
    data: {
      organisationId: orgId,
      name: req(formData, "name"),
      email: str(formData, "email"),
      organisationOrTeam: str(formData, "organisationOrTeam"),
      partyType: req(formData, "partyType"),
      isExternal: formData.get("isExternal") === "on",
      notes: str(formData, "notes"),
    },
  });
  return party;
}

export async function assignRaci(params: {
  objectType: "ManualObligation" | "Action";
  objectId: string;
  role: string;
  partyId: string;
  returnPath: string;
}) {
  const { organisation: org, user } = await requireOrg();
  const orgId = org.id;
  const userId = user.id;

  await prisma.raciAssignment.create({
    data: {
      role: params.role,
      partyId: params.partyId,
      manualObligationId: params.objectType === "ManualObligation" ? params.objectId : undefined,
      actionId: params.objectType === "Action" ? params.objectId : undefined,
    },
  });

  const party = await prisma.party.findUnique({ where: { id: params.partyId } });
  const [entity] =
    params.objectType === "ManualObligation"
      ? await prisma.$transaction([prisma.manualObligation.findUnique({ where: { id: params.objectId } })])
      : await prisma.$transaction([prisma.action.findUnique({ where: { id: params.objectId } })]);

  await prisma.auditEvent.create({
    data: {
      organisationId: orgId,
      entityId: entity?.entityId ?? null,
      manualObligationId: params.objectType === "ManualObligation" ? params.objectId : undefined,
      actionId: params.objectType === "Action" ? params.objectId : undefined,
      action:
        params.role === "Consulted"
          ? "consulted_parties_changed"
          : params.role === "Informed"
          ? "informed_parties_changed"
          : "raci_assignment_added",
      detail: `${params.role} party added: ${party?.name ?? params.partyId}.`,
    },
  });

  revalidatePath(params.returnPath);
}

export async function assignRaciFromForm(objectType: "ManualObligation" | "Action", objectId: string, returnPath: string, formData: FormData) {
  const role = req(formData, "role");
  const partyId = req(formData, "partyId");
  await assignRaci({ objectType, objectId, role, partyId, returnPath });
}

export async function removeRaciAssignment(assignmentId: string, returnPath: string) {
  const { organisation: org } = await requireOrg();
  const orgId = org.id;

  const assignment = await prisma.raciAssignment.findUnique({ where: { id: assignmentId }, include: { party: true } });
  if (!assignment) return;

  await prisma.raciAssignment.delete({ where: { id: assignmentId } });

  const entity = assignment.manualObligationId
    ? await prisma.manualObligation.findUnique({ where: { id: assignment.manualObligationId } })
    : assignment.actionId
    ? await prisma.action.findUnique({ where: { id: assignment.actionId } })
    : null;

  await prisma.auditEvent.create({
    data: {
      organisationId: orgId,
      entityId: entity?.entityId ?? null,
      manualObligationId: assignment.manualObligationId ?? undefined,
      actionId: assignment.actionId ?? undefined,
      action:
        assignment.role === "Consulted"
          ? "consulted_parties_changed"
          : assignment.role === "Informed"
          ? "informed_parties_changed"
          : "raci_assignment_removed",
      detail: `${assignment.role} party removed: ${assignment.party.name}.`,
    },
  });

  revalidatePath(returnPath);
}

export async function listParties() {
  const { organisation: org } = await requireOrg();
  const orgId = org.id;
  return prisma.party.findMany({ where: { organisationId: orgId }, orderBy: { name: "asc" } });
}