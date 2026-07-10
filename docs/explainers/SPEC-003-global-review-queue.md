# SPEC-003 global review queue explainer

## Global queue

The `/review` route lists open `ReviewItem` rows across all documents in the current organisation. Open statuses are:

- `Needs review`
- `In review`
- `Needs adviser input`
- `Needs source verification`

The page links each item back to its per-document extraction run and offers lightweight queue actions such as marking an item `In review`, `Duplicate`, or `Not applicable`. Full live-object confirmation still happens on the extraction run page so existing guardrails remain in one path.

## Counts

The app shell queries the current organisation and shows a `Review Queue` navigation badge when open review items exist. The dashboard also surfaces open review item count and pending/running extraction count.

## Background extraction v1

`startExtraction` now creates an `ExtractionRun` with status `Pending`, emits an `extraction_run_queued` audit event, returns the browser to the run page, and starts `processExtractionRun(runId)` without awaiting it.

`processExtractionRun` is the v1 in-process runner. It:

1. Loads the run, document chunks, and entity context.
2. Moves the run to `Running`.
3. Deletes existing review items for the run to keep retries idempotent.
4. Calls the AI extraction pipeline.
5. Creates draft `ReviewItem` rows only on successful schema validation.
6. Marks the run `Completed` or `Failed`.
7. Revalidates the document run page and `/review`.

This keeps AI output in review tables only. No AI output is written directly to live registers.

## Restart limitation

This is intentionally v1 in-process background work. If the process is killed during an extraction, a `Running` run can remain until a later startup sweep/requeue path is added. The queue model now makes that follow-up possible without changing the review UI.
