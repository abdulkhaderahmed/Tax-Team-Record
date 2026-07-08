# Document vault + source systems — module explainer

## Purpose
Two halves of "where did this number come from": the vault stores adviser deliverables with classification and quality flags; source systems model which system wins for each data type (the source-of-truth hierarchy from the implementation-adjusted plan §5.1).

## Architecture
**Vault:** upload (PDF/DOCX ≤15MB) → metadata (type, entity, security/sensitivity/privilege, reliance status) → text extraction stored → health-check markers scan for the corpus-derived defect signatures (`XX`, `TBC`, `[insert…]`, unresolved `do/do not`, stray `>`) → detail page surfaces flags + extraction runs → download API streams the original.
**Sources:** source-system CRUD + data categories + per-category priority rules (e.g., Companies House > adviser doc for legal names; payroll > HR export for PAYE) + a conflict log with resolution workflow; `ObligationSourceRef` ties obligations to their sources.
Invariant: reliance/privilege classification happens at ingestion, before anything downstream consumes the document.

## Methodology
The health-check markers are the corpus analysis productised — every one of the five real GT deliverables failed at least one such check (wrong client name ×6 in one proposal; "do/do not" in a DocuSigned final). Cheap string-level checks that catch real, embarrassing defects before a reviewer relies on the document.

## Counterfactual analysis
- *LLM-based document QA instead of marker strings*: richer detection, rejected for v1 — markers are deterministic, explainable ("flagged because the text contains 'TBC'"), and free; LLM QA can layer on later where markers are silent (numeric inconsistency like £2.19m vs £2.17m — genuinely needs it, note as Phase 2+ candidate).
- *Priority rules as code*: rejected — same argument as rules pack; a head of tax must be able to read and override the hierarchy with a reason.
- *Skipping source modelling until integrations exist*: tempting (no APIs yet), rejected because the *declaration* of source hierarchy is what makes manual data defensible today; integrations later inherit a ready model.
Re-read: holds. Storage location is the module's real flaw — local filesystem, fixed by SPEC-002.

## Known limitations & failure modes
Production file loss (SPEC-002, severity 1); no OCR for scanned PDFs; numeric-inconsistency detection absent (markers are string-level); conflict log is manual-entry only — nothing auto-detects a conflict yet.

## Verification
As-built confirmed via app interrogation 2026-07-08. Reviewer should re-verify: marker list completeness against `Platform Strategy Pack/01` defect inventory, and that download route enforces org scoping post SPEC-001.
