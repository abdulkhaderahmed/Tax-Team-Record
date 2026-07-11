# SPEC-003 — Global review queue and background extraction

Status: global queue, durable leased jobs, OCR/page-aware extraction and review-to-record controls implemented; production worker operations and accuracy gates remain unproven · Depends on: SPEC-001

## Problem
Review items only exist inside a single extraction run's page (`/documents/[id]/extraction/[runId]`). A user with three uploaded documents has no answer to "what needs my review right now?" — the product's central daily question. Separately, extraction runs synchronously inside a server action; long documents will hit client timeouts.

## Part A — `/review`
1. New top-nav route `/review`: all `ReviewItem`s across the org, default filter `status = pending`, grouped by document; filters: item type (10 existing types), entity, document, status; sort by document date then confidence.
2. Row actions identical to the per-run page (Confirm / Reject / Needs adviser input / Create live obligation) — extract the existing action components into shared ones rather than duplicating; explainer documents the extraction.
3. Queue counts surface on the dashboard ("Awaiting review: N") and as a nav badge.
4. Empty state teaches the loop: upload → extract → review → register (link to `/documents/new`).

## Part B — background extraction
1. Extraction becomes a job: `ExtractionRun.status` gains `queued | running | succeeded | failed` with `startedAt/finishedAt/error`.
2. v1 mechanism: fire-and-forget from the server action into an in-process runner (`after()`/detached promise) with status persisted — **not** a queue infra dependency (counterfactual: BullMQ/Redis and Temporal rejected pre-pilot; revisit when concurrent runs > single-container capacity or when a run must survive a deploy mid-flight).
3. UI: document detail and `/review` poll (or lightly revalidate) run status; "Run AI extraction" returns immediately with the run row in `queued`.
4. Timeout/failure: runner enforces its own ceiling (e.g., 5 min), writes `failed` + error message; UI offers retry. Failed runs never leave orphan review items (transactional insert of items on success only).
5. Idempotency: one active run per document; the button disables while `queued/running`.

## Exit criteria
- A 30-page PDF extracts without the browser waiting on the request.
- `/review` shows pending items from ≥2 documents; actions update both the queue and the per-run page.
- Kill the app mid-run → run row ends `failed` (or is re-queueable), no orphan items, no stuck `running` after restart (startup sweep).
- Explainers for the runner and the shared review components.
