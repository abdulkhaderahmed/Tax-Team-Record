"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { recordUserAuditEvent } from "@/lib/audit";
import { CONTROLLED_RULE_ENGINE_VERSION } from "@/lib/controlled-rule-definitions";
import {
  generateControlledResults,
  resultDueDate,
  resultOccurrenceKey,
  controlledRuleWhy,
  resultApplicabilityDate,
  selectEffectiveRuleVersion,
  type ApprovedRuleVersion,
} from "@/lib/controlled-obligation-generator";
import type { GeneratedRuleResult } from "@/domain/rules";

function iso(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "none";
}

function storedOccurrenceKey(record: {
  ruleKey: string | null;
  obligationType: string;
  periodStart: Date | null;
  periodEnd: Date | null;
  filingDeadline: Date | null;
  paymentDeadline: Date | null;
  description: string;
  occurrenceKey: string | null;
}): string {
  if (record.occurrenceKey) return record.occurrenceKey;
  return [
    record.ruleKey ?? "none",
    record.obligationType,
    iso(record.periodStart),
    iso(record.periodEnd),
    iso(record.paymentDeadline ?? record.filingDeadline),
    record.description,
  ].join("|");
}

function deadlineFields(result: GeneratedRuleResult) {
  const dueDate = resultDueDate(result);
  const payment = result.obligationType.toLowerCase().includes("payment");
  const combined = result.obligationType.toLowerCase().includes("filing and payment");
  return {
    filingDeadline: payment && !combined ? null : dueDate,
    paymentDeadline: payment || combined ? dueDate : null,
    internalTargetDate:
      dueDate && !payment ? new Date(dueDate.getTime() - 14 * 86_400_000) : null,
  };
}

async function approvedRules(organisationId: string) {
  const versions = await prisma.taxRuleVersion.findMany({
    where: {
      status: { in: ["Approved", "Superseded"] },
      rule: { organisationId, active: true },
    },
    include: { rule: true },
    orderBy: [{ ruleId: "asc" }, { version: "desc" }],
  });
  const map = new Map<string, ApprovedRuleVersion[]>();
  for (const version of versions) {
    const ruleVersions = map.get(version.rule.ruleKey) ?? [];
    ruleVersions.push(version);
    map.set(version.rule.ruleKey, ruleVersions);
  }
  return map;
}

function revalidateDrafts(entityId?: string | null) {
  revalidatePath("/obligations/drafts");
  revalidatePath("/obligations");
  revalidatePath("/");
  if (entityId) revalidatePath(`/entities/${entityId}`);
}

export async function generateEntityDrafts(entityId: string) {
  const context = await requirePermission("record:write");
  const entity = await prisma.entity.findFirst({
    where: { id: entityId, organisationId: context.orgId, deletedAt: null },
    include: {
      accountingPeriods: {
        where: { status: "Confirmed" },
        orderBy: { ctPeriodStart: "asc" },
      },
    },
  });
  if (!entity) throw new Error("Entity not found.");

  const ruleVersions = await approvedRules(context.orgId);
  if (ruleVersions.size === 0) {
    throw new Error("No approved controlled rules are available. Run the controlled-content seed first.");
  }

  const batchId = randomUUID();
  const asOf = new Date();
  const generation = generateControlledResults(entity, entity.accountingPeriods, asOf);
  // Preflight the exact content versions before opening a write transaction.
  // A stale engine binding throws here, so generation cannot partially create
  // records and then discover an incompatible rule later in the batch.
  for (const result of [...generation.obligations, ...generation.impacts]) {
    selectEffectiveRuleVersion(
      ruleVersions.get(result.ruleKey) ?? [],
      resultApplicabilityDate(result, asOf),
    );
  }
  const existing = await prisma.obligation.findMany({
    where: { entityId, organisationId: context.orgId, ruleVersionId: { not: null } },
    select: {
      ruleKey: true,
      obligationType: true,
      periodStart: true,
      periodEnd: true,
      filingDeadline: true,
      paymentDeadline: true,
      description: true,
      occurrenceKey: true,
    },
  });
  const seen = new Set(existing.map(storedOccurrenceKey));

  let created = 0;
  let skipped = 0;
  let impactsCreated = 0;
  const missingRules = new Set<string>();

  await prisma.$transaction(async (tx) => {
    for (const result of generation.obligations) {
      const applicabilityDate = resultApplicabilityDate(result, asOf);
      const ruleVersion = selectEffectiveRuleVersion(
        ruleVersions.get(result.ruleKey) ?? [],
        applicabilityDate,
      );
      if (!ruleVersion) {
        missingRules.add(`${result.ruleKey}@${iso(applicabilityDate)}`);
        continue;
      }
      const key = resultOccurrenceKey(result);
      if (seen.has(key)) {
        skipped++;
        continue;
      }
      seen.add(key);
      const why = controlledRuleWhy(result, ruleVersion, applicabilityDate);
      const deadlines = deadlineFields(result);
      const inserted = await tx.obligation.createMany({
        data: {
          organisationId: context.orgId,
          entityId,
          regime: ruleVersion.rule.regime,
          obligationType: result.obligationType,
          description: result.title,
          statutoryBasis: ruleVersion.statutoryBasis,
          ...deadlines,
          periodStart: result.period ? new Date(`${result.period.start}T00:00:00.000Z`) : null,
          periodEnd: result.period ? new Date(`${result.period.end}T00:00:00.000Z`) : null,
          recurrence: ruleVersion.recurrence,
          source: "Controlled UK rules pack",
          sourceType: "Controlled rule",
          responsibleOwner: entity.primaryTaxOwner,
          accountableOwner: entity.financeOwner,
          externalAdviser: entity.externalAdviser,
          ruleId: ruleVersion.ruleId,
          ruleKey: result.ruleKey,
          ruleVersionId: ruleVersion.id,
          ruleVersionNumber: ruleVersion.version,
          calculationBasis: ruleVersion.calculationDescription,
          humanExplanation: why,
          whyApplies: why,
          draftReviewStatus: "pending",
          generationBatchId: batchId,
          occurrenceKey: key,
          overallWorkflowStatus: "Draft",
          technicalReviewStatus: result.humanReviewRequired ? "Not started" : "Not required",
          exceptionRequired: result.blocksReadiness,
          openIssueBlocker: result.blocksReadiness
            ? "Controlled rule requires human review before filing readiness."
            : null,
          evidenceRequired: true,
          evidenceDescription: "Evidence supporting the applicability facts and completed filing/payment.",
          createdById: context.userId,
          lastUpdatedById: context.userId,
        },
        skipDuplicates: true,
      });
      if (inserted.count === 1) created++;
      else skipped++;
    }

    for (const impact of generation.impacts) {
      const applicabilityDate = resultApplicabilityDate(impact, asOf);
      const ruleVersion = selectEffectiveRuleVersion(
        ruleVersions.get(impact.ruleKey) ?? [],
        applicabilityDate,
      );
      if (!ruleVersion) {
        missingRules.add(`${impact.ruleKey}@${iso(applicabilityDate)}`);
        continue;
      }
      await tx.ruleImpactReview.upsert({
        where: { ruleVersionId_entityId: { ruleVersionId: ruleVersion.id, entityId } },
        update: {
          status: "Needs review",
          impactSummary: `${impact.title}\n${controlledRuleWhy(impact, ruleVersion, applicabilityDate)}`,
          dueDate: resultDueDate(impact),
          reviewedById: null,
          reviewedAt: null,
          reviewNote: null,
        },
        create: {
          organisationId: context.orgId,
          ruleVersionId: ruleVersion.id,
          entityId,
          status: "Needs review",
          impactSummary: `${impact.title}\n${controlledRuleWhy(impact, ruleVersion, applicabilityDate)}`,
          dueDate: resultDueDate(impact),
        },
      });
      impactsCreated++;
    }

    await recordUserAuditEvent(
      context,
      {
        action: "CONTROLLED_OBLIGATIONS_GENERATED",
        target: { objectType: "Entity", objectId: entityId, entityId },
        detail: JSON.stringify({
          batchId,
          generated: created,
          skipped,
          impactReviews: impactsCreated,
          missingRules: [...missingRules],
          warnings: generation.warnings,
          engineVersion: CONTROLLED_RULE_ENGINE_VERSION,
          asOf: asOf.toISOString(),
        }),
      },
      tx,
    );
  });

  revalidateDrafts(entityId);
  redirect(
    `/obligations/drafts?entity=${encodeURIComponent(entityId)}&generated=${created}&impacts=${impactsCreated}`,
  );
}

async function scopedDraft(id: string, organisationId: string) {
  const obligation = await prisma.obligation.findFirst({
    where: { id, organisationId, deletedAt: null, ruleVersionId: { not: null } },
  });
  if (!obligation) throw new Error("Generated obligation not found.");
  return obligation;
}

export async function activateDraft(id: string) {
  const context = await requirePermission("review:perform");
  const before = await scopedDraft(id, context.orgId);
  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.obligation.update({
      where: { id },
      data: {
        draftReviewStatus: "activated",
        overallWorkflowStatus: before.exceptionRequired ? "Blocked" : "Not started",
        technicalReviewStatus: "Complete",
        lastUpdatedById: context.userId,
      },
    });
    await recordUserAuditEvent(
      context,
      {
        action: "GENERATED_OBLIGATION_ACTIVATED",
        target: { objectType: "Obligation", objectId: id, entityId: record.entityId, obligationId: id },
        before,
        after: record,
      },
      tx,
    );
    return record;
  });
  revalidateDrafts(updated.entityId);
}

async function setDraftDecision(
  id: string,
  decision: "rejected" | "not_applicable" | "pending",
  note: string | null,
) {
  const context = await requirePermission("review:perform");
  const before = await scopedDraft(id, context.orgId);
  if (decision !== "pending" && !note) throw new Error("A review note is required.");
  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.obligation.update({
      where: { id },
      data: {
        draftReviewStatus: decision,
        draftNote: decision === "pending" ? null : note,
        overallWorkflowStatus: decision === "pending" ? "Draft" : before.overallWorkflowStatus,
        lastUpdatedById: context.userId,
      },
    });
    await recordUserAuditEvent(
      context,
      {
        action:
          decision === "pending"
            ? "GENERATED_OBLIGATION_RESTORED"
            : decision === "rejected"
              ? "GENERATED_OBLIGATION_REJECTED"
              : "GENERATED_OBLIGATION_NOT_APPLICABLE",
        target: { objectType: "Obligation", objectId: id, entityId: record.entityId, obligationId: id },
        before,
        after: record,
        reason: note,
      },
      tx,
    );
    return record;
  });
  revalidateDrafts(updated.entityId);
}

export async function rejectDraft(id: string, formData: FormData) {
  await setDraftDecision(id, "rejected", ((formData.get("note") as string) || "").trim() || null);
  redirect("/obligations/drafts");
}

export async function markDraftNotApplicable(id: string, formData: FormData) {
  await setDraftDecision(id, "not_applicable", ((formData.get("note") as string) || "").trim() || null);
  redirect("/obligations/drafts");
}

export async function restoreDraftToPending(id: string) {
  await setDraftDecision(id, "pending", null);
}
