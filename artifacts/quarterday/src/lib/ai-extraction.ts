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
            type: "object",
            properties: {
              itemType: {
                type: "string",
                enum: ["obligation","action","assumption","caveat","tripwire","evidence","valuation","rd","capital_allowances","conflict"],
              },
              data: { type: "object", additionalProperties: true },
            },
            required: ["itemType","data"],
            additionalProperties: false,
          },
        },
        documentAppearsToBeFinished: { type: "boolean" },
        overallNotes: { type: "string" },
      },
      required: ["items","documentAppearsToBeFinished"],
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
