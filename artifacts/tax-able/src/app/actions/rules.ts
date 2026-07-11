"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { recordUserAuditEvent } from "@/lib/audit";
import { CONTROLLED_RULE_ENGINE_VERSION } from "@/lib/controlled-rule-definitions";
import type { Prisma } from "@prisma/client";

function text(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function required(formData: FormData, name: string): string {
  const value = text(formData, name);
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function parseDate(value: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error("A valid effective date is required.");
  return parsed;
}

export async function proposeRuleVersion(ruleId: string, formData: FormData) {
  const context = await requirePermission("rules:edit");
  const rule = await prisma.taxRule.findFirst({
    where: { id: ruleId, organisationId: context.orgId },
    include: {
      versions: {
        include: { citations: true },
        orderBy: { version: "desc" },
      },
    },
  });
  if (!rule || rule.versions.length === 0) throw new Error("Controlled rule not found.");
  const pendingDraft = rule.versions.find((version) => version.status === "Draft");
  if (pendingDraft) {
    throw new Error(`Rule ${rule.ruleKey} already has draft v${pendingDraft.version}; review or withdraw it before proposing another.`);
  }
  const previous = rule.versions[0];
  const effectiveFrom = parseDate(required(formData, "effectiveFrom"));
  if (effectiveFrom.getTime() <= previous.effectiveFrom.getTime()) {
    throw new Error("A successor version must start after the version it supersedes.");
  }

  const created = await prisma.$transaction(async (tx) => {
    const version = await tx.taxRuleVersion.create({
      data: {
        ruleId: rule.id,
        version: previous.version + 1,
        name: text(formData, "name") ?? previous.name,
        description: text(formData, "description") ?? previous.description,
        obligationType: text(formData, "obligationType") ?? previous.obligationType,
        statutoryBasis: text(formData, "statutoryBasis") ?? previous.statutoryBasis,
        statutoryUrl: text(formData, "statutoryUrl") ?? previous.statutoryUrl,
        authorityLevel: text(formData, "authorityLevel") ?? previous.authorityLevel,
        legalStatus: text(formData, "legalStatus") ?? previous.legalStatus,
        triggerDescription: text(formData, "triggerDescription") ?? previous.triggerDescription,
        triggerConfig: previous.triggerConfig as Prisma.InputJsonValue,
        calculationKey: previous.calculationKey,
        calculationDescription:
          text(formData, "calculationDescription") ?? previous.calculationDescription,
        recurrence: previous.recurrence,
        effectiveFrom,
        status: "Draft",
        humanReviewRequired: previous.humanReviewRequired,
        changeRationale: required(formData, "changeRationale"),
        sourceLastCheckedAt: parseDate(required(formData, "sourceLastCheckedAt")),
        engineVersion: CONTROLLED_RULE_ENGINE_VERSION,
        createdById: context.userId,
        supersedesVersionId: previous.id,
      },
    });
    const citationByUrl = new Map(
      previous.citations.map((citation) => {
        const isPrimary = citation.url === previous.statutoryUrl;
        const url = isPrimary ? version.statutoryUrl : citation.url;
        return [
          url,
          {
            ruleVersionId: version.id,
            title: isPrimary ? version.statutoryBasis : citation.title,
            url,
            authorityLevel: isPrimary ? version.authorityLevel : citation.authorityLevel,
            checkedAt: version.sourceLastCheckedAt,
          },
        ] as const;
      }),
    );
    citationByUrl.set(version.statutoryUrl, {
      ruleVersionId: version.id,
      title: version.statutoryBasis,
      url: version.statutoryUrl,
      authorityLevel: version.authorityLevel,
      checkedAt: version.sourceLastCheckedAt,
    });
    await tx.ruleCitation.createMany({ data: [...citationByUrl.values()] });
    await recordUserAuditEvent(
      context,
      {
        action: "RULE_VERSION_PROPOSED",
        target: { objectType: "TaxRuleVersion", objectId: version.id },
        before: previous,
        after: version,
        reason: version.changeRationale,
      },
      tx,
    );
    return version;
  });
  revalidatePath("/rules-pack");
  void created;
}

export async function approveRuleVersion(versionId: string, formData: FormData) {
  const context = await requirePermission("rules:approve");
  const reviewNote = required(formData, "reviewNote");
  const version = await prisma.taxRuleVersion.findFirst({
    where: { id: versionId, rule: { organisationId: context.orgId }, status: "Draft" },
    include: { rule: true, supersedesVersion: true },
  });
  if (!version) throw new Error("Draft rule version not found.");
  if (version.engineVersion !== CONTROLLED_RULE_ENGINE_VERSION) {
    throw new Error(
      `Draft rule v${version.version} is bound to engine ${version.engineVersion}, but this deployment runs ${CONTROLLED_RULE_ENGINE_VERSION}. Create and review a new version against the current engine.`,
    );
  }
  if (version.createdById === context.userId) {
    throw new Error("Rule editors cannot approve their own controlled-content change.");
  }
  if (!version.supersedesVersion || version.supersedesVersion.status !== "Approved") {
    throw new Error("A new controlled version must supersede the currently approved version.");
  }
  if (version.effectiveFrom.getTime() <= version.supersedesVersion.effectiveFrom.getTime()) {
    throw new Error("The successor effective date must be later than the version it supersedes.");
  }

  const entities = await prisma.entity.findMany({
    where: { organisationId: context.orgId, deletedAt: null, archivedAt: null },
    select: { id: true, legalName: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.taxRuleVersion.update({
      where: { id: version.supersedesVersionId! },
      data: {
        status: "Superseded",
        effectiveTo: new Date(version.effectiveFrom.getTime() - 86_400_000),
      },
    });
    const approved = await tx.taxRuleVersion.update({
      where: { id: version.id },
      data: {
        status: "Approved",
        reviewedById: context.userId,
        reviewedAt: new Date(),
      },
    });
    for (const entity of entities) {
      await tx.ruleImpactReview.upsert({
        where: { ruleVersionId_entityId: { ruleVersionId: version.id, entityId: entity.id } },
        update: {
          status: "Needs review",
          impactSummary: `${version.rule.ruleKey} v${version.version}: ${version.changeRationale}`,
          reviewedById: null,
          reviewedAt: null,
          reviewNote: null,
        },
        create: {
          organisationId: context.orgId,
          ruleVersionId: version.id,
          entityId: entity.id,
          status: "Needs review",
          impactSummary: `${version.rule.ruleKey} v${version.version}: ${version.changeRationale}`,
        },
      });
    }
    await recordUserAuditEvent(
      context,
      {
        action: "RULE_VERSION_APPROVED_WITH_IMPACT_REVIEW",
        target: { objectType: "TaxRuleVersion", objectId: version.id },
        before: version,
        after: approved,
        reason: reviewNote,
        detail: `${entities.length} entity impact review(s) created; no live obligation was changed silently.`,
      },
      tx,
    );
  });
  revalidatePath("/rules-pack");
  revalidatePath("/rule-impact");
}

export async function reviewRuleImpact(impactId: string, formData: FormData) {
  const context = await requirePermission("review:perform");
  const status = required(formData, "status");
  if (!new Set(["Confirmed applicable", "Not applicable", "Remediated"]).has(status)) {
    throw new Error("Invalid impact-review outcome.");
  }
  const note = required(formData, "reviewNote");
  const before = await prisma.ruleImpactReview.findFirst({
    where: { id: impactId, organisationId: context.orgId },
  });
  if (!before) throw new Error("Impact review not found.");

  const updated = await prisma.$transaction(async (tx) => {
    const after = await tx.ruleImpactReview.update({
      where: { id: impactId },
      data: {
        status,
        reviewedById: context.userId,
        reviewedAt: new Date(),
        reviewNote: note,
      },
    });
    await recordUserAuditEvent(
      context,
      {
        action: "RULE_IMPACT_REVIEWED",
        target: { objectType: "RuleImpactReview", objectId: impactId, entityId: after.entityId },
        before,
        after,
        reason: note,
      },
      tx,
    );
    return after;
  });
  revalidatePath("/rule-impact");
  revalidatePath(`/entities/${updated.entityId}`);
}
