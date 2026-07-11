"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { recordUserAuditEvent } from "@/lib/audit";
import { parseCsv } from "@/lib/csv";

function date(value: string | undefined): Date | null {
  if (!value?.trim()) return null;
  const parsed = new Date(`${value.trim()}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid date: ${value}`);
  return parsed;
}

export async function importObligationsCsv(formData: FormData) {
  const context = await requirePermission("record:write");
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("Choose a CSV file.");
  if (file.size > 5_000_000) throw new Error("CSV import is limited to 5 MB.");
  const rows = parseCsv(await file.text());
  if (rows.length > 5_000) throw new Error("CSV import is limited to 5,000 rows.");
  const dryRun = formData.get("dryRun") === "on";
  const entities = await prisma.entity.findMany({
    where: { organisationId: context.orgId, deletedAt: null },
    select: { id: true },
  });
  const entityIds = new Set(entities.map((entity) => entity.id));
  const errors: string[] = [];
  const validated = rows.map((row, index) => {
    const line = index + 2;
    if (!row.regime?.trim()) errors.push(`Line ${line}: regime is required.`);
    if (!row.obligationType?.trim()) errors.push(`Line ${line}: obligationType is required.`);
    if (!row.description?.trim()) errors.push(`Line ${line}: description is required.`);
    if (row.entityId?.trim() && !entityIds.has(row.entityId.trim())) {
      errors.push(`Line ${line}: entityId is not in this organisation.`);
    }
    try {
      return {
        organisationId: context.orgId,
        entityId: row.entityId?.trim() || null,
        regime: row.regime?.trim() || "",
        obligationType: row.obligationType?.trim() || "",
        description: row.description?.trim() || "",
        periodStart: date(row.periodStart),
        periodEnd: date(row.periodEnd),
        filingDeadline: date(row.filingDeadline),
        paymentDeadline: date(row.paymentDeadline),
        internalTargetDate: date(row.internalTargetDate),
        responsibleOwner: row.responsibleOwner?.trim() || null,
        accountableOwner: row.accountableOwner?.trim() || null,
        riskLevel: row.riskLevel?.trim() || null,
        sourceType: "CSV import",
        source: file.name,
        createdById: context.userId,
        lastUpdatedById: context.userId,
        overallWorkflowStatus: "Not started",
      };
    } catch (error) {
      errors.push(`Line ${line}: ${String(error)}`);
      return null;
    }
  }).filter((row): row is NonNullable<typeof row> => row !== null);

  if (errors.length > 0) {
    const message = encodeURIComponent(errors.slice(0, 10).join(" | "));
    redirect(`/obligations/import?errors=${message}&validated=${validated.length}`);
  }
  if (dryRun) {
    redirect(`/obligations/import?validated=${validated.length}&dryRun=1`);
  }

  await prisma.$transaction(async (tx) => {
    for (const row of validated) await tx.obligation.create({ data: row });
    await recordUserAuditEvent(
      context,
      {
        action: "OBLIGATIONS_CSV_IMPORTED",
        target: { objectType: "Organisation", objectId: context.orgId },
        detail: `${validated.length} obligation row(s) imported from ${file.name}.`,
        after: { filename: file.name, rowCount: validated.length },
      },
      tx,
    );
  });
  revalidatePath("/obligations");
  revalidatePath("/");
  redirect(`/obligations/import?imported=${validated.length}`);
}
