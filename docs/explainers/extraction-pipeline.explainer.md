# Extraction pipeline — module explainer

## Purpose

Turn an uploaded adviser PDF/DOCX into page-grounded candidates that a human can convert into durable control records. The model is an intake assistant, never the control owner: AI output remains in `ReviewItem` until an authenticated reviewer creates/links a record or records an allowed, reasoned no-record disposition.

## Architecture

```text
versioned document
  -> physical-page text extraction
  -> conditional OCR for sparse PDF pages
  -> deterministic page-aware blocks
  -> leased ExtractionRun job with retry/backoff/heartbeat
  -> structured model response + schema validation
  -> quote/page verification
  -> ReviewItem queue
  -> human create/link or reasoned no-record disposition
  -> DocumentRecordLink + ReviewItemRecordLink + audit event
```

PDF extraction preserves every physical page, including blanks, so a model citation can be checked against the original page number. Sparse pages can be OCR'd with Tesseract; native text wins unless OCR adds useful content. Model blocks are deterministic 8–12k units assembled on page boundaries, avoiding the former fixed-character truncation that could discard a document tail.

Jobs are persisted with claim leases, heartbeat, capped retry count and exponential backoff. The worker can be run separately with `pnpm worker:extraction`; an application request is not required to remain open for the model call.

## Review boundary

The global `/review` queue and per-run page share the durable status model. Direct writes to final states are rejected. Confirming obligation, action, assumption, caveat, tripwire or evidence candidates creates the target, document link, review link and audit state in a transaction. Conditional advice must either preserve its condition or record how it was resolved. A fabricated/ambiguous quote cannot be treated as verified without an explicit source override reason.

Duplicate, rejected and not-applicable outcomes do not use one-click global shortcuts. They require the reviewed/no-record disposition path, a reason and assurance that no durable record link already exists.

## Benchmark boundary

`eval/extraction-benchmark` contains:

- a private-corpus manifest of exactly five PDF hashes/page counts;
- a commit-safe draft concept inventory with no confidential source text;
- metrics for material obligation/action recall, precision/false positives, condition preservation and strict citation accuracy; and
- tests preventing duplicate predictions or incomplete targets from inflating results.

All annotations remain `draft_unverified`. The AI-assurance page therefore disables accuracy claims and reports the release gates as not yet scorable.

## Counterfactual analysis

- *Confidence-threshold auto-promotion*: rejected because self-reported confidence cannot own a tax control and no verified calibration set exists.
- *Character chunks without page identity*: rejected because citation accuracy is a product gate and tail content can be lost.
- *Synchronous extraction action*: rejected because timeouts and process restarts must not erase job state.
- *Fine-tune before measuring*: rejected because the missing asset is a reviewed target set, not another unmeasured model.

## Verified and unproven

Seven extraction-mechanics tests cover physical pages, OCR selection, tail processing, stable blocks, citation correction/rejection and retry backoff. Six benchmark tests cover manifest/inventory integrity and metric honesty. The production build and review-queue smoke test pass.

No model prediction has yet been scored against an independently reviewed gold set. Production worker scheduling, dead-letter operations, model/service reliability and customer-document consent for any training use remain unproven or parked.
