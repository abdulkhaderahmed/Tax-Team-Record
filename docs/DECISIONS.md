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
Its value is the enterprise trust bar: source citations, reviewer sign-offs, audit trails, workflow documentation, verified primary-source grounding. Quarterday's review-queue architecture already embodies this; Phase 2 makes it visible per-item. Its US calc domains (ASC 740, GILTI/NCTI, BEAT, CAMT) are out of scope for a UK obligations product.
**Counterfactual:** treating it as a feature roadmap was rejected — Bloomberg sells calculation engines; Quarterday sells the system of record around judgment. Reverses only if the product pivots into computation (e.g., a QIP calculator), where "verified calculation" framing becomes literal.

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
