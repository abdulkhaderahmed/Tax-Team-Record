# Decision log

Format: decision → basis → counterfactual (what was rejected and what evidence would reverse the call). Append-only; supersede, don't edit.

---

## D-001 · 2026-07-08 · GitHub is the source of truth
All durable state lives in this repo's `docs/` tree. Notion/Asana/chat transcripts are ephemeral.
**Counterfactual:** Notion as SoT was rejected — no diff history tied to code, and agents (Devin, Claude Code) natively operate on git. Reverses if a non-technical collaborator joins who won't touch GitHub.

## D-002 · 2026-07-08 · Asana: not now
The one Asana project ("B2B ideas and executions", 5 generic GTM seed tasks, 0 completed) duplicates nothing and drives nothing. Solo-founder build tracking belongs next to the code.
**Counterfactual:** adopting Asana was rejected because a second tracker creates sync debt with zero coordination benefit at n=1 humans. Reverses at Phase 4 (GTM experiments with external collaborators) or first hire.

## D-003 · 2026-07-08 · Bloomberg Tax article: adopt as trust checklist, not as guide
Its value is the enterprise trust bar: source citations, reviewer sign-offs, audit trails, workflow documentation, verified primary-source grounding. Tax-Able's review-queue architecture already embodies this; Phase 2 makes it visible per-item. Its US calc domains (ASC 740, GILTI/NCTI, BEAT, CAMT) are out of scope for a UK obligations product.
**Counterfactual:** treating it as a feature roadmap was rejected — Bloomberg sells calculation engines; Tax-Able sells the system of record around judgment. Reverses only if the product pivots into computation (e.g., a QIP calculator), where "verified calculation" framing becomes literal.

## D-004 · 2026-07-08 · whatwouldclaudeuse.com: adopt specific picks, not the whole stack
Adopted for the gaps the app actually has: **Clerk** (auth, SPEC-001), **Sentry** (errors), **PostHog** (analytics), **Resend** (transactional email, when notifications land), **GitHub Actions** (CI). Not adopted: Vercel/Neon migration (app is committed to Replit hosting + managed Postgres for now — migration cost > benefit pre-users), Tailwind retrofit (plain CSS already shipped; design tokens deliver the benefit without a rewrite, see design/DESIGN_SYSTEM.md).
**Counterfactual:** wholesale stack alignment was rejected as resume-driven churn. Reverses per-item: Vercel/Neon if Replit hosting friction (cold starts, storage) blocks a pilot; Tailwind if a second frontend surface (marketing site) gets built anyway.

## D-005 · 2026-07-08 · fontofweb (Fudge): light-touch inspiration only
Used to sanity-check typography/palette choices against production SaaS sites. Not a workflow dependency.

## D-006 · 2026-07-08 · "TaxGPT" = openaccountants, not the eponymous repos
VerisimilitudeX/TaxGPT is a student project (GPT-4 wrapper, US, unmaintained) — rejected. taxgpt.com is a closed commercial competitor-adjacent product — reference only. **openaccountants/openaccountants** is the substantive target: 1,000+ cited guides, ~20 UK skills, MCP server, named-accountant verification. Full analysis in `taxgpt-uk/`.
**Counterfactual:** building a bespoke UK tax-QA model was rejected (data moat isn't ours to build solo; verification is the differentiator and they've productised it). Reverses if the AGPL/licensing gate fails legal review AND partnership is refused — then Phase 3 rules-pack self-authoring covers the need more slowly.

## D-007 · 2026-07-08 · Claude Design over Figma (for now)
User's Figma seat is view-only (starter tier) — MCP writes will fail; upgrading costs money that buys nothing over the alternative. Design flow: `design/DESIGN_SYSTEM.md` (tokens, canonical) → `design/dashboard-mockup.html` (reference implementation) → Claude Design on claude.ai for visual iteration → Replit `import-claude-design-from-url` or Devin implements from the mockup.
**Counterfactual:** Figma-first was rejected on seat economics and because the consumer of the design is an AI agent, which reads HTML/tokens better than Figma frames. Reverses if a human designer joins (Figma's collaboration is then worth the seat) — the tokens file ports cleanly.

## D-008 · 2026-07-08 · Design direction: calm professional SaaS
Stripe/Mercury register: restrained near-monochrome chrome, semantic colour reserved for deadline/status states, Inter with tabular numerals, generous whitespace. Chosen to signal institutional trust to Heads of Tax/CFOs (buyer psychology per strategy pack 02) and to survive dense registers without visual noise.
**Counterfactual:** dense ops-tool aesthetic (Linear-like) rejected for v1 — the buyer evaluates trustworthiness before daily-driver ergonomics; density can be added per-view (tables already compact). Reverses if pilot users are hands-on-keyboard tax managers rather than approving executives.

## D-009 · 2026-07-08 · gpt-4o stays for extraction, pending benchmark
Already wired and Zod-validated. Swapping now is churn without measurement.
**Counterfactual:** immediate swap to Claude was rejected absent data. Reverses when the Haiku/Sonnet benchmark on the 5-document GT corpus (MODEL_ROUTING rule 4) shows ≥ parity accuracy at lower cost — likely, and worth running before pilot volume.

## D-010 · 2026-07-09 · Working name is Tax-Able (resolves ROADMAP #7)
The product/app working name is **Tax-Able**. Applied across the codebase: app package renamed `@workspace/quarterday` → `@workspace/tax-able`, directory `artifacts/quarterday` → `artifacts/tax-able`, infra config (`.replit`, `.replit-artifact/artifact.toml`, `.claude/launch.json`), UI copy, and docs. Verbatim historical prompt transcripts under `docs/history/` are left unchanged as records of what was actually written.
**Counterfactual:** keeping "Quarterday" was rejected now that the name decision is made and design work is about to land in-app (renaming later would churn more surface). Reverses only if a trademark/availability check forces a different name — at which point the same swap runs again.

## D-011 · 2026-07-11 · Advice-to-control record, not filing-engine replacement
Tax-Able governs how entity facts, controlled rules and adviser documents become owned, evidenced and approved tax work. It does not calculate liabilities or submit returns. The maintained wedge is a system of record alongside Alphatax/ONESOURCE and the incumbent spreadsheet/file engine.
**Counterfactual:** replacing filing software was rejected because calculation, e-filing and deep ERP integration would dilute the differentiator and raise reliance risk before customer proof. Reverses only after repeated pilots show a narrow filing capability is both demanded and safer to own.

## D-012 · 2026-07-11 · Controlled content is executable only through a reviewed engine binding
Rules are versioned, effective-dated content with primary links, editor/reviewer, rationale and supersession. Each approved version is immutably bound to the deterministic engine release it was reviewed against; generation fails closed on gaps, overlaps or mismatch and creates visible impact reviews rather than rewriting live records.
**Counterfactual:** arbitrary editable JSON logic was rejected because it would be an untyped tax programming language without a safe authoring/test surface. Pure hard-coded rules were also rejected because they hide content governance inside deployments. Reverses when a typed rule DSL has schema validation, previews, golden tests and tax-professional approval for every operator.

## D-013 · 2026-07-11 · Readiness is derived, not a freely editable status
Approval, evidence, technical-review and filing-blocker outcomes are controlled through their own records and separation-of-duties checks. Generic record editing cannot assert or clear those outcomes; overall readiness is recomputed from the active gates.
**Counterfactual:** free status dropdowns were rejected because they let a preparer bypass the very controls the register is meant to evidence. Reverses only for a narrowly defined override with explicit authority, rationale, audit event and no unresolved mandatory blocker.

## D-014 · 2026-07-11 · Restricted sources are redacted; derived controls remain organisation-visible
A restricted document requires a grant to expose its identity, file, page location, excerpt or source audit snapshot. The resulting obligation/action/register record remains visible to authorised organisation members so filing work is not hidden from its owners.
**Counterfactual:** inheriting document ACLs onto every derived record was rejected for the initial operating model because it can make statutory work disappear from team queues. Reverses when a target customer demonstrates an ethical-wall use case requiring row-level restriction of the resulting tax analysis as well as the source.

## D-015 · 2026-07-11 · Accuracy claims remain disabled until the five-document benchmark is gold
The private corpus is represented by hashes/page counts and a commit-safe draft concept inventory. OCR, physical-page chunks, quote verification and the evaluator are implemented, but every annotation remains `draft_unverified`; no extraction-accuracy percentage may be marketed.
**Counterfactual:** treating pipeline tests or model confidence as accuracy evidence was rejected because neither measures missed material advice, false positives, preserved conditions or page-citation correctness. Reverses only after independent annotation review and scored predictions meet the published gates.

## D-016 · 2026-07-25 · One spine, service lines are packs
Corporate tax compliance, transaction tax and due diligence, capital allowances, R&D, real estate and financial services tax get **packs** over a single core model (`event → test → obligation → owner → evidence → decision → destination`), not separate modules. A pack supplies four things: an event taxonomy, a rule/obligation set, a question set and a deliverable template.
**Counterfactual:** a module per service line was rejected — it multiplies the surface, splits the audit trail and rebuilds the same review and separation-of-duties controls six times. Reverses if two packs cannot be expressed without special-casing the spine, which is the explicit exit criterion in SPEC-004.

## D-017 · 2026-07-25 · Coverage, triggers, queries and destinations extend the record without breaching D-011
Analysis of a real MIP delivery-structure specimen (`docs/research/ADVICE_SPECIMEN_MIP_2026-07.md`) showed the record cannot answer "which taxes does this touch, for whom, and what was not covered", cannot hold event-driven short clocks (14-day elections, 30-day stamping, 90-day trust registration), and dies at "decision approved" instead of reaching a computation line, a return box, a disclosure or a payment. SPEC-004 adds a coverage matrix, a trigger-point model, a computation query register and a decision destination. **None of them computes a liability or files anything** — they record, route and evidence.
**Counterfactual:** moving into calculation to close the same gaps was rejected again (D-011 holds). Reverses only on repeated pilot evidence that a narrow calculation is both demanded and safer to own than to reference.

## D-018 · 2026-07-25 · Screen copy states facts once; state is shown by state
Decision surfaces carry no sentence that a control's own state already conveys, no kicker that repeats its heading, and no count in prose that a counter already shows. Explanation of method lives behind one affordance per object, not ambient on the page. Applied first to the matter demo (chrome copy cut roughly two-thirds; the first response card now lands above the fold).
**Counterfactual:** explanatory paragraphs on every panel were rejected — the buyer is a Head of Tax reading a record, not a visitor being onboarded, and ambient explanation pushes the actual work below the fold. Reverses for genuinely first-run surfaces, where the explanation is the content.

## D-019 · 2026-07-25 · A decision window is not an obligation
Elections, claims and revocations are modelled as `DecisionWindow` — a period during which a choice about a tax position stays open, closing with a **mandatory stated default outcome if nobody acts**. A window passing its close date becomes `Closed by default` only through a reasoned, audited action, never silently on a date.
**Counterfactual:** modelling these as obligations with `type = election` was rejected — obligation status vocabulary (`filed / late / not applicable`) cannot express "the window closed and the default applied", and reversibility and default-outcome have no meaning on an obligation. Reverses only if pilot users treat windows and filings as one queue in practice, which would be evidence the distinction is ours rather than theirs.

## D-020 · 2026-07-25 · Every clock and figure carries a graded basis
`Statute | HMRC guidance | Practice assumption | Stated in source, unverified`. Anything below the first two renders distinctly, sits in a verification queue, and **cannot gate a sign-off until a named person verifies it**. Adopted after a transactions-tax briefing note was found to self-flag at least four of its own propositions as needing checking — an effective date, two election deadlines and a relief allowance figure.
**Counterfactual:** a free-text confidence note was rejected as unenforceable and non-gating. The deeper alternative — refusing to ingest unverified material at all — was rejected because it makes the product useless in the weeks after a fiscal event, which is exactly when it is worth most. Grading is what lets fast-moving material enter the record without being laundered into apparent certainty; it composes with the controlled-rules model, where a graded item is a candidate that has not yet earned a `TaxRuleVersion`.

## D-021 · 2026-07-25 · The election sweep is demonstrated in-house, with the adviser channel named not taken
Shareholder election work is *personal* tax, while the chosen buyer is a corporate Head of Tax. The primitives (windows, durational conditions, funding checks, basis grading) are identical for both, so they are built once and demonstrated through the in-house reading: a group whose managers rolled over on a transaction, where the company carries the operational risk when individuals do not act.
**Counterfactual:** repositioning around the adviser firm — which owns the client *population* and so gets more from a portfolio-wide sweep — was rejected for now because the buyer analysis parked advisers as a later channel and the sales motion is untested. Reversing costs a demo and a data-import path, not an architecture. Reverses on evidence that in-house teams will not act on obligations belonging to individuals.

## D-022 · 2026-07-25 · A date the source does not contain is never invented
A steps paper expresses most deadlines relative to completion and frequently omits the completion date itself. Obligations therefore carry a `dateStatus` of `KNOWN | DERIVED | CONDITIONAL | UNDEFINED`. One root input resolves every `DERIVED` item at once; `CONDITIONAL` items wait for their event; **`UNDEFINED` items never acquire a date**, because "ASAP post completion" is not a deadline and rendering one would be a fabrication.
**Counterfactual:** defaulting undated items to the document date, or to "30 days", was rejected — a plausible-looking wrong date is worse than a visible gap, and the gap is the finding worth surfacing. Reverses only if a customer supplies a house convention for undated adviser actions, which would then be recorded as their convention rather than as the source's.

## D-023 · 2026-07-25 · Evidence grade gates a control; it does not merely annotate it
Controls carry an A–E evidence grade (A authoritative · B professional advice · C corroborated client information · D unverified · E inference). **A control may operate on A, B or C only.** D and E require a named verifier first and render as blocked with the reason. Applied to a real steps report, 7 of 17 proposed controls cannot go live — 5 for having no owner at all, 5 of which survive completion indefinitely.
**Counterfactual:** showing the grade as a badge without gating anything was rejected — that is decoration, and the whole failure mode is an unverified assertion quietly becoming an operating control. Note this scale measures **evidence quality** and is deliberately *not* merged with the positions register's clock-authority scale (`Statute | HMRC guidance | Practice assumption | Stated in source, unverified`), which measures something different; merging them would lose one axis.

## D-024 · 2026-07-25 · Document exceptions are raised, never resolved
Contradictions, unresolved placeholders, stale dates and missing promised content are recorded against the document with a severity and a stated effect, and put in front of the author. The product does not pick the more likely of two contradictory statements.
**Counterfactual:** auto-resolving or suppressing low-severity exceptions was rejected. On the specimen analysed, the exceptions include an unresolved "we do/do not consider" placeholder in a final document and a VAT deadline given three different ways — precisely the items a tidy-up would have hidden.
