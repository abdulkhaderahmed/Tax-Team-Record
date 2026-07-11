"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { recordUserAuditEvent } from "@/lib/audit";
import { RACI_ROLES } from "@/lib/raci-constants";


function str(formData: FormData, name: string): string | null {
  return ((formData.get(name) as string) || "").trim() || null;
}

function req(formData: FormData, name: string): string {
  const v = ((formData.get(name) as string) || "").trim();
  if (!v) throw new Error(`${name} is required`);
  return v;
}

export async function createParty(formData: FormData) {
  const context = await requirePermission("record:write");

  return prisma.$transaction(async (tx) => {
    const party = await tx.party.create({
      data: {
        organisationId: context.orgId,
        name: req(formData, "name"),
        email: str(formData, "email"),
        organisationOrTeam: str(formData, "organisationOrTeam"),
        partyType: req(formData, "partyType"),
        isExternal: formData.get("isExternal") === "on",
        notes: str(formData, "notes"),
      },
    });
    await recordUserAuditEvent(context, {
      action: "PARTY_CREATED",
      target: { objectType: "Party", objectId: party.id },
      after: party,
    }, tx);
    return party;
  });
}

export async function assignRaci(params: {
  objectType: "Obligation" | "Action";
  objectId: string;
  role: string;
  partyId: string;
  returnPath: string;
}) {
  const context = await requirePermission("record:write");
  if (!(RACI_ROLES as readonly string[]).includes(params.role)) {
    throw new Error("Invalid RACI role.");
  }

  await prisma.$transaction(async (tx) => {
    const [party, target] = await Promise.all([
      tx.party.findFirst({
        where: { id: params.partyId, organisationId: context.orgId },
      }),
      params.objectType === "Obligation"
        ? tx.obligation.findFirst({
            where: { id: params.objectId, organisationId: context.orgId, deletedAt: null },
          })
        : tx.action.findFirst({
            where: { id: params.objectId, organisationId: context.orgId, deletedAt: null },
          }),
    ]);
    if (!party || !target) throw new Error("Party or target record not found.");

    const assignment = await tx.raciAssignment.create({
      data: {
        role: params.role,
        partyId: params.partyId,
        obligationId: params.objectType === "Obligation" ? params.objectId : undefined,
        actionId: params.objectType === "Action" ? params.objectId : undefined,
      },
    });
    await recordUserAuditEvent(context, {
      action: "RACI_ASSIGNMENT_ADDED",
      target: {
        objectType: params.objectType,
        objectId: params.objectId,
        entityId: target.entityId,
        obligationId: params.objectType === "Obligation" ? params.objectId : null,
        actionId: params.objectType === "Action" ? params.objectId : null,
      },
      after: assignment,
      detail: `${params.role} party added: ${party.name}.`,
    }, tx);
  });

  revalidatePath(params.returnPath);
}

export async function assignRaciFromForm(objectType: "Obligation" | "Action", objectId: string, returnPath: string, formData: FormData) {
  const role = req(formData, "role");
  const partyId = req(formData, "partyId");
  await assignRaci({ objectType, objectId, role, partyId, returnPath });
}

export async function removeRaciAssignment(assignmentId: string, returnPath: string) {
  const context = await requirePermission("record:write");

  await prisma.$transaction(async (tx) => {
    const assignment = await tx.raciAssignment.findFirst({
      where: {
        id: assignmentId,
        OR: [
          { obligation: { organisationId: context.orgId } },
          { action: { organisationId: context.orgId } },
        ],
      },
      include: { party: true, obligation: true, action: true },
    });
    if (!assignment) throw new Error("RACI assignment not found.");

    await tx.raciAssignment.delete({ where: { id: assignmentId } });
    const target = assignment.obligation ?? assignment.action;
    await recordUserAuditEvent(context, {
      action: "RACI_ASSIGNMENT_REMOVED",
      target: {
        objectType: assignment.obligationId ? "Obligation" : "Action",
        objectId: assignment.obligationId ?? assignment.actionId!,
        entityId: target?.entityId,
        obligationId: assignment.obligationId,
        actionId: assignment.actionId,
      },
      before: assignment,
      detail: `${assignment.role} party removed: ${assignment.party.name}.`,
    }, tx);
  });

  revalidatePath(returnPath);
}

export async function listParties() {
  const context = await requirePermission("record:read");
  return prisma.party.findMany({
    where: { organisationId: context.orgId },
    orderBy: { name: "asc" },
  });
}
