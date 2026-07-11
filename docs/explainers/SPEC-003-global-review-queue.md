# Global review queue and durable extraction — implementation explainer

The original SPEC-003 is implemented beyond its proposed in-process runner. `/review` provides the organisation queue and links each candidate to the full per-run review controls. Dashboard/navigation counts include open review items and pending/running extraction work.

`ExtractionRun` is a durable job record claimed through a lease. The worker records attempt count, lease owner/expiry, heartbeat, retry time and failure state; capped exponential backoff permits safe recovery after process failure. `pnpm worker:extraction` runs the worker separately from web requests.

The extraction pipeline preserves physical PDF pages, conditionally OCRs sparse pages, builds deterministic page-aware blocks, validates structured output and verifies quotes against source pages. Review items remain drafts. A final state requires a durable record link or an allowed no-record disposition with a reason; global one-click Duplicate/N/A finalisation was removed.

The implemented mechanism is locally verified, but production scheduling, concurrency/load behaviour, monitoring, dead-letter operations and model-service SLAs remain unproven. Extraction accuracy is a separate benchmark gate and must not be inferred from queue or worker correctness.
