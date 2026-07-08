# Integration architecture — UK knowledge layer

Chosen shape: **reference at review time, never at rest.** The knowledge layer advises the human reviewer; it has no write path to registers. This preserves the product's core invariant (AI drafts, humans confirm) and stays safe under the strictest AGPL reading.

## Phase K0 — spike (Sonnet-tier, ~1 day, branch only)
Connect to the openaccountants hosted MCP from a script (not the app): call `start(jurisdiction="GB")`, `list_skills`, `get_skill("uk-vat-return")`. Record actual response shapes in the branch. Exit: we know latency, payload sizes, and whether GB skill coverage resolves the queries we care about.

## Phase K1 — reference pane on review items
When a reviewer opens a `ReviewItem` (e.g., extracted obligation "VAT registration required — threshold £85,000"):
1. A server-side `knowledge` module maps item type + regime → candidate skills (static map first; no embeddings yet).
2. Fetches the relevant guide section via MCP at request time; renders an **attributed excerpt** (source name, guide version, `last_updated`, `verified_by` status, link) in a side pane.
3. Reviewer sees adviser's claim and reference side by side; their Confirm/Reject stays the only write path. The audit event optionally records "reference consulted: uk-vat-return v2.0".
4. Cache: in-memory/short-TTL only (hours) — a performance cache, not a content store. Nothing persisted to Postgres.

**Counterfactuals:**
- *Ingest guides into our DB + embed for RAG* — better latency/recall, rejected: content-at-rest is exactly the copyleft exposure, and staleness becomes our liability instead of upstream's. Reverses if a partnership grants us a content license.
- *General-purpose LLM answers (ask gpt-4o "is this right?") without grounding* — rejected: uncited model output checking model output fails the D-003 trust bar and invites confident error in the one place users need certainty.
- *Build our own UK knowledge base first* — rejected for sequencing: Phase 3 rules pack covers the corporate core anyway; buying individual/SME coverage via MCP is faster than authoring 20 guides we don't differentiate on.

## Phase K2 — contribution/partnership track (parallel, human-led)
Author `uk-corporation-tax-ct600`, `uk-qips`, `uk-p11d-psa`, `uk-ers-annual-return`, `uk-sao-certification`, `uk-pillar2-registration` guides in their format (our fresh text) and contribute upstream; pursue the UK "Partner" reviewer slot (their UK guides are `verified_by: pending` — the seat is open). Payoff: our corporate domain becomes the verified upstream content we then consume; credibility badge for pilots; relationship established before their hosted tier gets commercial terms.

## Phase K3 — escalation bridge (later)
Map our exception queue's "adviser escalation" to their `request_accountant_review` handoff where the client has no adviser on point. Gated on commercial terms and on pilot demand evidence.

## Explicit non-goals
- No chatbot. The knowledge layer answers "what does the reference say about *this item*", inline, cited — not open-ended tax Q&A (that's taxgpt.com's fight, and generic chat undermines the system-of-record positioning).
- No autonomous correction: the system never edits a register because the reference disagrees; it flags.

## Dependencies
SPEC-003 (review queue is the surface) · ROADMAP #6 legal gate · MODEL_ROUTING (K0/K1 are Sonnet-tier; this doc is the Fable-tier output).
