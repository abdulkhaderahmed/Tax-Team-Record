# Model routing — which brain for which job

Principle: **route by task shape, not by habit.** Fable 5 is the scarcest resource; spend it only where judgment density is highest. Cost/usage efficiency comes from pushing work down-tier, not from doing less work.

## The tiers

| Tier | Use for | Never use for |
|---|---|---|
| **Claude Fable 5** (this) | Architecture decisions, product strategy, cross-tool orchestration, spec authoring, counterfactual/design reviews, anything where a wrong call compounds | Bulk code generation, mechanical edits, summarising files, long test runs |
| **Devin (Ultra plan)** | Autonomous multi-file implementation against a written spec: SPEC-001/002/003, design-system application, rules-pack build-out, test suites, repo hygiene | Deciding *what* to build; ambiguous or unspecced work — always hand it a spec + explainer standard |
| **Claude Opus 4.8 / Sonnet** (Claude Code or claude.ai) | Single-feature coding sessions, code review of Devin's PRs, explainer-md generation for existing files, doc drafting from outlines | — |
| **Claude Haiku 4.5** | Extraction QA sampling, commit-message and changelog generation, formatting, CSV wrangling, cheap classification | Anything with legal/tax judgment |
| **gpt-4o (in-product)** | Already wired for document extraction. Fine for MVP. Revisit: structured-output extraction is a commodity — benchmark Haiku 4.5 / Sonnet on the same Zod schema for cost per document before scale | Product code |
| **Replit agent** (when credits return) | UI slices where seeing the running app immediately matters; one slice per prompt (per strategy pack doc 08) | Multi-slice builds; anything Devin can do from a spec (Devin is already paid for) |
| **Claude Design (claude.ai) → Replit import** | Visual iterations on screens — replaces Figma while seat is view-only (D-007) | — |

## Routing rules

1. **Spec upstream, execute downstream.** Fable 5 (or Opus) writes the spec; Devin executes; Sonnet reviews the diff; Haiku writes the changelog. A task should only move up-tier when it fails down-tier.
2. **One-touch rule for Fable 5 sessions:** batch strategic questions so high-tier sessions produce specs/decisions, not keystrokes.
3. **Every Devin task = spec + `EXPLAINER_STANDARD.md` + exit criteria.** Devin's definition of done includes the explainer md and updating `CURRENT_STATE.md`.
4. **In-product AI is a product decision, not a session decision:** model swaps for extraction go through a benchmark (accuracy on the 5-document GT corpus, cost per page, latency) recorded in `DECISIONS.md`.
5. **When usage halts** (credits/limits): the state files make any tier resumable. Nothing may live only in a chat transcript.

## Current assignment snapshot (2026-07-08)

| Workstream | Assigned |
|---|---|
| SPEC-001/002/003 implementation | Devin |
| Design-system application to app | Devin (Replit fallback) |
| Rules pack corporate expansion (Phase 3) | Opus/Sonnet authoring rules + Devin wiring + accountant review |
| taxgpt-uk MCP prototype | Sonnet in Claude Code (small surface, well-specced) |
| Per-file explainers for existing code | Sonnet (mechanical against the standard), spot-checked by Opus |
| Extraction model benchmark | Haiku harness, Fable 5 reads results |
