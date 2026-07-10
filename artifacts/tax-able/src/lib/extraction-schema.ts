import { z } from "zod";

export const ITEM_TYPES = [
  "obligation",
  "action",
  "assumption",
  "caveat",
  "tripwire",
  "evidence",
  "valuation",
  "rd",
  "capital_allowances",
  "conflict",
] as const;

export type ItemType = (typeof ITEM_TYPES)[number];

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  obligation: "Obligation",
  action: "Action",
  assumption: "Assumption",
  caveat: "Caveat / Condition",
  tripwire: "Tripwire",
  evidence: "Evidence requirement",
  valuation: "Valuation reference",
  rd: "R&D reference",
  capital_allowances: "Capital allowances reference",
  conflict: "Source conflict / uncertainty",
};

export const REVIEW_STATUSES = [
  "Needs review",
  "In review",
  "Confirmed",
  "Edited and confirmed",
  "Rejected",
  "Duplicate",
  "Not applicable",
  "Needs adviser input",
  "Needs source verification",
] as const;

// ── Per-type structured schemas ───────────────────────────────

const baseFields = z.object({
  sourceText: z.string(),
  sourceChunkPage: z.string().nullable().optional(),
  confidenceScore: z.number().min(0).max(1),
  isConditional: z.boolean(),
  conditionText: z.string().nullable().optional(),
  isDraft: z.boolean().nullable().optional(),
  requiresHumanTaxReview: z.boolean(),
  requiresSourceVerification: z.boolean(),
});

export const ObligationSchema = baseFields.extend({
  regime: z.string(),
  obligationType: z.string(),
  description: z.string(),
  filingDeadline: z.string().nullable().optional(),
  paymentDeadline: z.string().nullable().optional(),
  periodStart: z.string().nullable().optional(),
  periodEnd: z.string().nullable().optional(),
  recurrence: z.string().nullable().optional(),
  statutoryBasis: z.string().nullable().optional(),
  evidenceRequired: z.string().nullable().optional(),
  suggestedOwner: z.string().nullable().optional(),
});

export const ActionSchema = baseFields.extend({
  description: z.string(),
  responsibleParty: z.string().nullable().optional(),
  accountableParty: z.string().nullable().optional(),
  externalOwner: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  relativeDeadlineTrigger: z.string().nullable().optional(),
  relativeDeadlineOffset: z.string().nullable().optional(),
  evidenceRequired: z.string().nullable().optional(),
});

export const AssumptionSchema = baseFields.extend({
  assumptionStatement: z.string(),
  factCategory: z.string().nullable().optional(),
  relianceImportance: z.enum(["Low", "Medium", "High", "Critical"]),
  suggestedReviewCadence: z.string().nullable().optional(),
  linkedCaveat: z.string().nullable().optional(),
});

export const CaveatSchema = baseFields.extend({
  caveatText: z.string(),
  relatedTopic: z.string().nullable().optional(),
  relatedItem: z.string().nullable().optional(),
  impactIfFalseOrUnresolved: z.string().nullable().optional(),
});

export const TripwireSchema = baseFields.extend({
  description: z.string(),
  triggerEvent: z.string(),
  reviewDateOrDeadline: z.string().nullable().optional(),
  reviewCadence: z.string().nullable().optional(),
  disarmCondition: z.string().nullable().optional(),
});

export const EvidenceSchema = baseFields.extend({
  description: z.string(),
  evidenceType: z.string().nullable().optional(),
  linkedObligation: z.string().nullable().optional(),
  owner: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
});

export const ValuationSchema = baseFields.extend({
  description: z.string(),
  assetOrShareClass: z.string().nullable().optional(),
  valuationDate: z.string().nullable().optional(),
  valuer: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
});

export const RdSchema = baseFields.extend({
  claimExpected: z.boolean(),
  claimNotificationMentioned: z.boolean(),
  aifMentioned: z.boolean(),
  technicalEvidenceRequired: z.boolean(),
  adviserReviewRequired: z.boolean(),
  ct600LinkageMentioned: z.boolean(),
  notes: z.string().nullable().optional(),
});

export const CapitalAllowancesSchema = baseFields.extend({
  farReviewRequired: z.boolean(),
  capexEvidenceRequired: z.boolean(),
  aiaMentioned: z.boolean(),
  fullExpensingMentioned: z.boolean(),
  specialRatePoolMentioned: z.boolean(),
  ct600LinkageMentioned: z.boolean(),
  notes: z.string().nullable().optional(),
});

export const ConflictSchema = baseFields.extend({
  description: z.string(),
  conflictingValues: z.array(z.string()).nullable().optional(),
  severityAssessment: z.string().nullable().optional(),
  resolutionSuggestion: z.string().nullable().optional(),
});

// Union discriminator
export const ExtractedItemSchema = z.discriminatedUnion("itemType", [
  z.object({ itemType: z.literal("obligation"),         data: ObligationSchema }),
  z.object({ itemType: z.literal("action"),             data: ActionSchema }),
  z.object({ itemType: z.literal("assumption"),         data: AssumptionSchema }),
  z.object({ itemType: z.literal("caveat"),             data: CaveatSchema }),
  z.object({ itemType: z.literal("tripwire"),           data: TripwireSchema }),
  z.object({ itemType: z.literal("evidence"),           data: EvidenceSchema }),
  z.object({ itemType: z.literal("valuation"),          data: ValuationSchema }),
  z.object({ itemType: z.literal("rd"),                 data: RdSchema }),
  z.object({ itemType: z.literal("capital_allowances"), data: CapitalAllowancesSchema }),
  z.object({ itemType: z.literal("conflict"),           data: ConflictSchema }),
]);

export const ExtractionResponseSchema = z.object({
  items: z.array(ExtractedItemSchema),
  documentAppearsToBeFinished: z.boolean(),
  overallNotes: z.string().nullable().optional(),
});

export type ExtractedItem = z.infer<typeof ExtractedItemSchema>;
export type ExtractionResponse = z.infer<typeof ExtractionResponseSchema>;
