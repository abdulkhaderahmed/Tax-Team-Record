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
  sourceChunkPage: z.string().optional(),
  confidenceScore: z.number().min(0).max(1),
  isConditional: z.boolean(),
  conditionText: z.string().optional(),
  isDraft: z.boolean().optional(),
  requiresHumanTaxReview: z.boolean(),
  requiresSourceVerification: z.boolean(),
});

export const ObligationSchema = baseFields.extend({
  regime: z.string(),
  obligationType: z.string(),
  description: z.string(),
  filingDeadline: z.string().optional(),
  paymentDeadline: z.string().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  recurrence: z.string().optional(),
  statutoryBasis: z.string().optional(),
  evidenceRequired: z.string().optional(),
  suggestedOwner: z.string().optional(),
});

export const ActionSchema = baseFields.extend({
  description: z.string(),
  responsibleParty: z.string().optional(),
  accountableParty: z.string().optional(),
  externalOwner: z.string().optional(),
  deadline: z.string().optional(),
  relativeDeadlineTrigger: z.string().optional(),
  relativeDeadlineOffset: z.string().optional(),
  evidenceRequired: z.string().optional(),
});

export const AssumptionSchema = baseFields.extend({
  assumptionStatement: z.string(),
  factCategory: z.string().optional(),
  relianceImportance: z.enum(["Low", "Medium", "High", "Critical"]),
  suggestedReviewCadence: z.string().optional(),
  linkedCaveat: z.string().optional(),
});

export const CaveatSchema = baseFields.extend({
  caveatText: z.string(),
  relatedTopic: z.string().optional(),
  relatedItem: z.string().optional(),
  impactIfFalseOrUnresolved: z.string().optional(),
});

export const TripwireSchema = baseFields.extend({
  description: z.string(),
  triggerEvent: z.string(),
  reviewDateOrDeadline: z.string().optional(),
  reviewCadence: z.string().optional(),
  disarmCondition: z.string().optional(),
});

export const EvidenceSchema = baseFields.extend({
  description: z.string(),
  evidenceType: z.string().optional(),
  linkedObligation: z.string().optional(),
  owner: z.string().optional(),
  deadline: z.string().optional(),
});

export const ValuationSchema = baseFields.extend({
  description: z.string(),
  assetOrShareClass: z.string().optional(),
  valuationDate: z.string().optional(),
  valuer: z.string().optional(),
  purpose: z.string().optional(),
});

export const RdSchema = baseFields.extend({
  claimExpected: z.boolean(),
  claimNotificationMentioned: z.boolean(),
  aifMentioned: z.boolean(),
  technicalEvidenceRequired: z.boolean(),
  adviserReviewRequired: z.boolean(),
  ct600LinkageMentioned: z.boolean(),
  notes: z.string().optional(),
});

export const CapitalAllowancesSchema = baseFields.extend({
  farReviewRequired: z.boolean(),
  capexEvidenceRequired: z.boolean(),
  aiaMentioned: z.boolean(),
  fullExpensingMentioned: z.boolean(),
  specialRatePoolMentioned: z.boolean(),
  ct600LinkageMentioned: z.boolean(),
  notes: z.string().optional(),
});

export const ConflictSchema = baseFields.extend({
  description: z.string(),
  conflictingValues: z.array(z.string()).optional(),
  severityAssessment: z.string().optional(),
  resolutionSuggestion: z.string().optional(),
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
  overallNotes: z.string().optional(),
});

export type ExtractedItem = z.infer<typeof ExtractedItemSchema>;
export type ExtractionResponse = z.infer<typeof ExtractionResponseSchema>;
