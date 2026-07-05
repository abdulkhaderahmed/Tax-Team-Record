"server only";

import { getOpenAIClient } from "./openai-client";
import { ExtractionResponseSchema, type ExtractionResponse } from "./extraction-schema";

const MODEL = "gpt-4o";
const PROMPT_VERSION = "1";
const SCHEMA_VERSION = "1";

const SYSTEM_PROMPT = `You are a specialist UK tax review assistant. Your only job is to extract structured items from tax documents provided to you.

CRITICAL RULES:
- You are a draft extraction tool only. Every item you output is DRAFT and subject to human review.
- Do NOT make tax calculations or compute liability values.
- Do NOT decide whether a claim qualifies.
- Do NOT file or suggest filing anything with HMRC.
- Do NOT convert conditional advice into definite obligations. If a document says "if X applies, then Y may be required", extract this as a CONDITIONAL item with conditionText set.
- Preserve uncertainty: if the source text is unclear, set a lower confidenceScore and note requiresHumanTaxReview: true.
- Watch for conditional language: "subject to", "provided that", "assuming", "based on", "if", "unless", "may", "could", "where applicable". Any of these means isConditional: true.
- Mark isDraft: true if the document appears to be a draft (e.g. contains [TBC], [insert], XX, draft headers).
- Always populate sourceText with the relevant verbatim excerpt from the document.

Worked examples of preserving uncertainty:
- "If the company is very large, QIPs may apply" → a conditional obligation item, conditionText: "Company is very large", NOT a definite QIP obligation.
- "Subject to confirmation of employee residence" → an assumption or caveat item about employee residence, not a fact folded into an obligation.
- "Based on the facts provided, ..." → extract the relied-upon facts as assumption items, each linked back to this qualifier.

Extract the following item types when present:
- obligation: a tax filing, payment, or regulatory obligation
- action: a specific task or step to be taken
- assumption: a fact or premise the document relies upon
- caveat: a condition, qualification, or warning
- tripwire: a future event that would trigger a review or action
- evidence: a document, record, or information required as evidence
- valuation: a valuation exercise referenced
- rd: R&D claim references (do NOT calculate — workflow/review items only)
- capital_allowances: capital allowances references (do NOT calculate — workflow/review items only)
- conflict: a conflict, inconsistency, or uncertainty in the source material

Your response MUST be valid JSON matching the provided schema exactly. Do not add markdown, commentary, or explanation outside the JSON.`;

function buildUserPrompt(text: string, documentType: string, entityContext: string): string {
  return `Document type: ${documentType}
${entityContext ? `Entity context: ${entityContext}` : ""}

Document text:
---
${text.slice(0, 40000)}
---

Extract all relevant items from this document. Return JSON only.`;
}

// OpenAI's strict structured-output mode requires every object in the schema
// tree to set additionalProperties: false and list every key as required
// (optional fields become nullable instead). We hand-author the schema here,
// mirroring extraction-schema.ts's Zod shapes exactly, rather than relying on
// a loose `data: object` — a loose nested object is rejected outright in
// strict mode and was never actually enforceable at the API layer.
const STR = { type: "string" } as const;
const STR_N = { type: ["string", "null"] } as const;
const BOOL = { type: "boolean" } as const;
const BOOL_N = { type: ["boolean", "null"] } as const;
const NUM = { type: "number" } as const;
const STR_ARR_N = { type: ["array", "null"], items: { type: "string" } } as const;

const BASE_PROPS = {
  sourceText: STR,
  sourceChunkPage: STR_N,
  confidenceScore: NUM,
  isConditional: BOOL,
  conditionText: STR_N,
  isDraft: BOOL_N,
  requiresHumanTaxReview: BOOL,
  requiresSourceVerification: BOOL,
};
const BASE_REQUIRED = Object.keys(BASE_PROPS);

function dataSchema(extra: Record<string, unknown>) {
  const properties = { ...BASE_PROPS, ...extra };
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  } as const;
}

function itemBranch(itemType: string, extra: Record<string, unknown>) {
  return {
    type: "object",
    properties: {
      itemType: { type: "string", enum: [itemType] },
      data: dataSchema(extra),
    },
    required: ["itemType", "data"],
    additionalProperties: false,
  } as const;
}

const RESPONSE_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "extraction_response",
    strict: true,
    schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            anyOf: [
              itemBranch("obligation", {
                regime: STR, obligationType: STR, description: STR,
                filingDeadline: STR_N, paymentDeadline: STR_N, periodStart: STR_N, periodEnd: STR_N,
                recurrence: STR_N, statutoryBasis: STR_N, evidenceRequired: STR_N, suggestedOwner: STR_N,
              }),
              itemBranch("action", {
                description: STR, responsibleParty: STR_N, accountableParty: STR_N, externalOwner: STR_N,
                deadline: STR_N, relativeDeadlineTrigger: STR_N, relativeDeadlineOffset: STR_N, evidenceRequired: STR_N,
              }),
              itemBranch("assumption", {
                assumptionStatement: STR, factCategory: STR_N,
                relianceImportance: { type: "string", enum: ["Low", "Medium", "High", "Critical"] },
                suggestedReviewCadence: STR_N, linkedCaveat: STR_N,
              }),
              itemBranch("caveat", {
                caveatText: STR, relatedTopic: STR_N, relatedItem: STR_N, impactIfFalseOrUnresolved: STR_N,
              }),
              itemBranch("tripwire", {
                description: STR, triggerEvent: STR, reviewDateOrDeadline: STR_N, reviewCadence: STR_N, disarmCondition: STR_N,
              }),
              itemBranch("evidence", {
                description: STR, evidenceType: STR_N, linkedObligation: STR_N, owner: STR_N, deadline: STR_N,
              }),
              itemBranch("valuation", {
                description: STR, assetOrShareClass: STR_N, valuationDate: STR_N, valuer: STR_N, purpose: STR_N,
              }),
              itemBranch("rd", {
                claimExpected: BOOL, claimNotificationMentioned: BOOL, aifMentioned: BOOL,
                technicalEvidenceRequired: BOOL, adviserReviewRequired: BOOL, ct600LinkageMentioned: BOOL, notes: STR_N,
              }),
              itemBranch("capital_allowances", {
                farReviewRequired: BOOL, capexEvidenceRequired: BOOL, aiaMentioned: BOOL,
                fullExpensingMentioned: BOOL, specialRatePoolMentioned: BOOL, ct600LinkageMentioned: BOOL, notes: STR_N,
              }),
              itemBranch("conflict", {
                description: STR, conflictingValues: STR_ARR_N, severityAssessment: STR_N, resolutionSuggestion: STR_N,
              }),
            ],
          },
        },
        documentAppearsToBeFinished: { type: "boolean" },
        overallNotes: STR_N,
      },
      required: ["items", "documentAppearsToBeFinished", "overallNotes"],
      additionalProperties: false,
    },
  },
} as const;

export interface AIExtractionResult {
  response?: ExtractionResponse;
  rawJson?: string;
  validationError?: string;
  apiError?: string;
}

export async function runAIExtraction(
  text: string,
  documentType: string,
  entityContext: string = ""
): Promise<AIExtractionResult> {
  const client = getOpenAIClient();

  let rawJson: string | undefined;
  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      max_completion_tokens: 8192,
      response_format: RESPONSE_SCHEMA as Parameters<typeof client.chat.completions.create>[0]["response_format"],
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: buildUserPrompt(text, documentType, entityContext) },
      ],
    });

    rawJson = completion.choices[0]?.message?.content ?? "";
    if (!rawJson) return { apiError: "Empty response from AI model." };

    const parsed = JSON.parse(rawJson);
    const validated = ExtractionResponseSchema.safeParse(parsed);
    if (!validated.success) {
      return {
        rawJson,
        validationError: validated.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      };
    }
    return { response: validated.data, rawJson };
  } catch (err) {
    return { rawJson, apiError: String(err) };
  }
}

export { MODEL, PROMPT_VERSION, SCHEMA_VERSION };
