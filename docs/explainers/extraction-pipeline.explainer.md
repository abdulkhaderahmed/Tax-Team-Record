# Extraction pipeline — module explainer

## Purpose
Turns an uploaded adviser document (PDF/DOCX) into structured, reviewable draft items — the "document intelligence" third of the product thesis. Never writes to live registers.

## Architecture
Upload (document vault) → text extraction (pdf-parse for PDF, mammoth for DOCX) stored with the document → user triggers "Run AI Extraction" → server action calls gpt-4o with structured JSON output → **Zod discriminated union over 10 item types** (obligations, actions, assumptions, caveats, tripwires, evidence, valuations, R&D refs, capital-allowances refs, conflicts) validates the response → valid items land as `ReviewItem` rows under an `ExtractionRun` → per-run review UI offers Confirm / Reject / Needs-adviser-input / Create-live-obligation.
Invariant: the only path from AI output to a register is a human clicking a confirm action.

## Methodology
Schema-first extraction: the Zod union both validates and *defines* what the model may say, converting hallucination into a validation failure instead of a bad row. The 10 types mirror the corpus analysis of real GT deliverables (strategy pack 01) — the taxonomy came from evidence, not intuition.

## Counterfactual analysis
- *Free-text extraction + second-pass structuring*: more tolerant of odd documents, rejected because two lossy hops compound error and the review UI needs typed items anyway.
- *Direct-to-register with confidence thresholds*: faster loop, rejected as a product-identity violation (implementation-adjusted plan §2: "AI output is always draft").
- *Chunked map-reduce over long docs*: not yet needed at ≤15MB advisory docs; becomes right if extraction quality degrades on 100+ page steps papers or context limits bite — measure via review-rejection rates per document length.
- *Model choice*: gpt-4o incumbent; see D-009 — benchmark Claude on the GT corpus before pilot volume.
Re-read: schema-first + human-confirm still holds; the weak point is synchronous execution, addressed by SPEC-003 Part B.

## Known limitations & failure modes
Synchronous run (client timeout on long docs — SPEC-003); no per-item source-page anchors yet (Phase 2 #1); confirmed non-obligation items have no live register to land in (Phase 2 #3); extraction quality on scanned/image PDFs unknown (pdf-parse is text-layer only — no OCR).

## Verification
As-built behaviour confirmed via app interrogation 2026-07-08 (`main` @ 9b9cf55). Reviewer should re-verify: Zod schema location, exact ReviewItem statuses, and whether failed runs can orphan items (SPEC-003 exit criterion).
