# Applying TaxGPT to Tax-Team-Record / Quarterday — Integration & Improvement Plan

Context: this monorepo's `artifacts/quarterday` is a multi-tenant UK tax obligations register:
GPT-4o strict-structured extraction (`src/lib/ai-extraction.ts`) → `ExtractionRun` → `ReviewItem`
human review queue → promotion to live objects (Obligation/Action/Assumption/Tripwire…), with
RACI, 9-dimension status, source reconciliation, and audit events. The standalone
`abdulkhaderahmed/quarterday` repo is currently **empty**.

Key realization: **Quarterday already has the one thing TaxGPT lacked — a human-in-the-loop review
queue generating labeled corrections in production.** TaxGPT had to synthesize its preference data;
Quarterday mints it every time a reviewer edits or rejects a draft. The plan below is mostly about
harvesting that asset, plus porting TaxGPT's validation/eval discipline into the app.

---

## 1. What maps to what

| TaxGPT concept | Quarterday counterpart today | Gap |
|---|---|---|
| Grounded generation w/ citation validation | Extraction prompt demands verbatim `sourceText` | `sourceText` is never verified against the document |
| `citation_utils.py` canonical regex | `statutoryBasis` free-text field on obligations | No validation, no canonical act/section form |
| `inflation_adjusted_amounts.json` | Hard-coded seeded `ObligationRule`s | No versioned UK rates/thresholds reference |
| On-policy DPO (model's own failures → training pairs) | ReviewItem accept/reject/edit decisions | Decisions stored but never exported as data |
| 50-question eval + v1/v2/v3 comparisons | None — prompt/schema versions recorded on `ExtractionRun` but nothing measures quality across versions | No extraction benchmark |
| GRPO reward components | `confidenceScore` + `LOW_CONFIDENCE_THRESHOLD = 0.5` guardrail | Confidence is self-reported by the model, uncalibrated |
| Frontier-review loop (`gpt54-training-review*.md`) | — | Adopt as practice for schema/prompt changes |
| Ollama local serving | Hard dependency on OpenAI (`openai-client.ts`) | No provider abstraction, no privacy tier |

## 2. Improvements to Quarterday (ranked, concrete)

### 2.1 Harvest the review queue as training data — the flywheel (highest value)
Add an exporter (script or admin endpoint) that emits, per reviewed `ReviewItem`:

```jsonc
// SFT record (accepted items, possibly edited)
{"messages": [{"role":"system","content":SYSTEM_PROMPT@promptVersion},
              {"role":"user","content":chunkText+docType+entityContext},
              {"role":"assistant","content":finalAcceptedJson}],
 "metadata": {"runId":…, "promptVersion":"1", "schemaVersion":"1", "grounded":true}}

// DPO record (edited or rejected items) — exactly TaxGPT's on-policy recipe
{"prompt":…, "chosen": humanCorrectedJson, "rejected": modelDraftJson,
 "metadata": {"error_observed": reviewerNoteOrDiff}}
```

Requires storing the original model draft alongside the human-edited outcome on `ReviewItem`
(if edits currently overwrite, add a `draftPayload` column). This is TaxGPT's
`generate_onpolicy_dpo.py` for free, at production quality — and it is the asset that later makes a
fine-tuned private model feasible.

### 2.2 Deterministic verification of extraction outputs (port the v2 validation stage)
TaxGPT's biggest lesson: never trust generated text without programmatic checks. After
`runAIExtraction` and before creating `ReviewItem`s:

- **`sourceText` grounding check:** fuzzy-find the quoted excerpt in the document chunk; if absent,
  force `requiresSourceVerification: true` and cap confidence (kills fabricated quotes).
- **`statutoryBasis` citation check:** parse with `uk_citation_utils.py` (doc 03 §2); normalize to
  canonical `(act, section)`; flag unknown acts/sections. Later: link to the statute DB so
  reviewers see the actual provision text next to the draft.
- **Date sanity:** `filingDeadline`/`paymentDeadline` parseable, within period bounds, consistent
  with `recurrence`.
- **Numeric sanity vs `uk_rates_thresholds.json`:** e.g. a VAT-registration obligation citing a
  stale threshold gets flagged automatically.

These are the GRPO reward components repurposed as inline validators — same code, different seat.

### 2.3 Extraction benchmark + regression gate (the missing eval)
Build `eval/extraction-benchmark/`: ~30 curated document fixtures (engagement letters, tax advice
memos, HMRC correspondence — synthetic or anonymized) with golden expected-item lists. Score
precision/recall per `itemType`, plus conditional-language handling (the "if very large, QIPs may
apply" cases in the system prompt) and citation validity. Run on every `PROMPT_VERSION` /
`SCHEMA_VERSION` / model bump — the app already stamps these on `ExtractionRun`, so wire the same
versions into the benchmark report exactly like TaxGPT's `v1_v2_v3_comparison.txt`. Without this,
prompt changes are flying blind.

### 2.4 Calibrate the confidence guardrail
`LOW_CONFIDENCE_THRESHOLD = 0.5` acts on a self-reported number. Use benchmark + review-queue
outcomes to measure real precision-vs-confidence curves per item type, then either recalibrate the
threshold per type or replace the scalar with validator-driven confidence (2.2 failures ⇒ low).

### 2.5 Provider abstraction + optional private/local tier
Refactor `openai-client.ts` into a provider interface (`extract(text, docType, ctx) →
ExtractionResponse`) with OpenAI as default and an OpenAI-compatible local endpoint (Ollama/vLLM)
as an alternative. Client tax documents are sensitive; a fine-tuned open model (doc 03) served
locally becomes a sellable privacy tier — and the review-queue flywheel (2.1) is what will make it
accurate enough. Structured outputs: enforce the JSON schema client-side with retries when the
local backend lacks strict mode (the Zod validation in `ai-extraction.ts` already half-does this).

### 2.6 RAG over statutes + HMRC manuals for reviewers (doc 03 phase 0–1, no training needed)
Index Tier-1 acts + relevant HMRC manuals in pgvector inside the existing Postgres. Two uses:
(a) reviewer side-panel — show the cited provision next to each draft item;
(b) enrich extraction prompts with retrieved provisions for the document's regime, so drafts cite
real sections instead of from memory.

### 2.7 Versioned `uk_rates_thresholds.json` in-repo
Even ignoring ML: the obligation date engine (`src/lib/obligations.ts`) and seeded rules embed
figures that change every Finance Act. A single reviewed, tax-year-keyed reference file (doc 03 §2)
with provenance per figure, consumed by both the seeder and the validators, mirrors TaxGPT's
inflation dataset and prevents silent staleness.

### 2.8 Adopt the frontier-review practice
TaxGPT's six adversarial review rounds caught pipeline-blocking bugs. Do the same here for every
extraction-schema/prompt change: have a strong model audit the diff against the benchmark fixtures
before shipping. Cheap insurance; fits the existing `promptVersion` discipline.

## 3. Improvements to Tax-Team-Record (repo level)

- **Commit a docs index** (this folder) and keep `replit.md`'s operational truths in sync with it.
- **Add CI:** typecheck + the extraction benchmark (2.3) as a regression gate; today nothing guards
  prompt/schema changes.
- **Auth/tenancy:** `extraction.ts` hard-codes `ORG_ID = "demo-org"` and `REVIEWER = "Alex Smith"` —
  fine for demo, but the review-queue-as-training-data plan (2.1) needs real reviewer attribution
  to weight label quality.
- **Store chunk offsets** on `DocumentChunk` so the `sourceText` grounding check (2.2) can highlight
  the exact span in the review UI.

## 4. What NOT to do

- **Don't fine-tune first.** TaxGPT's arc proves the order: grounding, validation, and evals gave
  the gains; training amplified them. Quarterday phases 2.2/2.3/2.6/2.7 come before any GPU spend.
- **Don't let a model compute liabilities.** The system prompt's "no calculations" rule is right and
  matches 2026 practice (deterministic engines + LLM intake). Keep tax math in typed TypeScript.
- **Don't train on client documents without consent handling** — the flywheel (2.1) needs a data
  governance note per organisation before it ships.

## 5. Proposed home for the model pipeline: the empty `quarterday` repo

Keep the app monorepo clean; put the doc-03 pipeline in `abdulkhaderahmed/quarterday`:

```
quarterday/
├── data/{raw,processed,reference,train,eval}/   # CLML XML → sections → grounded splits (+ MANIFEST.md per version)
├── scripts/parse_clml.py, uk_citation_utils.py, generate_grounded_data.py,
│           export_review_queue.py               # ← consumes Quarterday DB export (2.1)
├── configs/{sft,dpo,grpo}_config.yaml           # start from TaxGPT's, adjusted per doc 03 §5
├── eval/uk_benchmark/                           # doc 03 §6
└── docs/                                        # investigations, review rounds
```

## 6. Sequenced roadmap (merges docs 03 + 04)

| Order | Item | Depends on | Effort |
|---|---|---|---|
| 1 | `uk_citation_utils.py` + `uk_rates_thresholds.json` (2.7, doc 03 phase 0) | — | days |
| 2 | Inline validators on extraction (2.2) | 1 | days |
| 3 | Extraction benchmark + CI gate (2.3) | — | ~1 wk |
| 4 | Review-queue exporter + `draftPayload` (2.1) | — | days |
| 5 | pgvector RAG for reviewers + prompt enrichment (2.6) | 1 | ~1 wk |
| 6 | Provider abstraction (2.5) | — | days |
| 7 | Grounded data gen + SFT/DPO in `quarterday` repo (doc 03 phases 2–3) | 1,3,4 | wks |
| 8 | GRPO + local privacy tier (doc 03 phases 4–5) | 7 | wks |

Items 1–6 improve the product immediately with zero ML risk; 7–8 are the TaxGPT-style build,
started only once the flywheel and benchmark exist to make it measurable.
