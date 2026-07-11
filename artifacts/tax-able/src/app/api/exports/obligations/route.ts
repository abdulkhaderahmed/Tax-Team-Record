import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/auth";
import { toCsv } from "@/lib/csv";

const HEADERS = [
  "recordId", "entityId", "entityName", "regime", "obligationType", "description",
  "periodStart", "periodEnd", "filingDeadline", "paymentDeadline", "internalTargetDate",
  "responsibleOwner", "accountableOwner", "overallStatus", "riskLevel", "ruleKey",
  "ruleVersion", "whyApplies", "sourceDocumentId", "updatedAt",
] as const;

function iso(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? "";
}

export async function GET() {
  const { orgId } = await requireOrg();
  const obligations = await prisma.obligation.findMany({
    where: {
      organisationId: orgId,
      deletedAt: null,
      OR: [{ draftReviewStatus: null }, { draftReviewStatus: "activated" }],
    },
    include: { entity: { select: { legalName: true } }, ruleVersion: true },
    orderBy: [{ filingDeadline: "asc" }, { paymentDeadline: "asc" }, { description: "asc" }],
  });
  const csv = toCsv(HEADERS, obligations.map((record) => ({
    recordId: record.id,
    entityId: record.entityId,
    entityName: record.entity?.legalName,
    regime: record.regime,
    obligationType: record.obligationType,
    description: record.description,
    periodStart: iso(record.periodStart),
    periodEnd: iso(record.periodEnd),
    filingDeadline: iso(record.filingDeadline),
    paymentDeadline: iso(record.paymentDeadline),
    internalTargetDate: iso(record.internalTargetDate),
    responsibleOwner: record.responsibleOwner,
    accountableOwner: record.accountableOwner,
    overallStatus: record.overallWorkflowStatus,
    riskLevel: record.riskLevel,
    ruleKey: record.ruleKey,
    ruleVersion: record.ruleVersion?.version,
    whyApplies: record.whyApplies,
    sourceDocumentId: record.sourceDocumentId,
    updatedAt: record.updatedAt.toISOString(),
  })));
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tax-able-obligations-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
