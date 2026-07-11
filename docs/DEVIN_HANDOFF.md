# Devin handoff

> Historical handoff from 2026-07-09. Its task queue and “no auth yet” description are superseded by `CURRENT_STATE.md` and `ROADMAP.md` as of 2026-07-11. Retained only to preserve implementation history; do not execute it as the current plan.

You (Devin) are the implementation tier for this repo. A strategy-tier agent maintains the docs; you turn specs into merged code. Read `CURRENT_STATE.md` first, then this.

## Repo orientation
- App: `artifacts/tax-able/` — Next.js 15 App Router, TS strict, Prisma 5 + Postgres, plain CSS in `globals.css`, OpenAI SDK for extraction, no auth yet.
- Other roots (`artifacts/api-server/`, `artifacts/mockup-sandbox/`, `lib/`, `scripts/`) are secondary; don't refactor them opportunistically.
- Deployment: Replit. The published container has an ephemeral, separate filesystem — this is why SPEC-002 exists.

## Task queue (strict order)
1. `specs/SPEC-001-authentication.md` — auth + org scoping. Include repo hygiene in the same PR: gitignore `.next/`, move `attached_assets/Pasted-*` → `docs/history/`.
2. `specs/SPEC-002-file-storage.md` — durable object storage for uploads.
3. `specs/SPEC-003-global-review-queue.md` — `/review` + background extraction.
4. `design/DESIGN_SYSTEM.md` — apply tokens to app shell, dashboard, and tables; `design/dashboard-mockup.html` is the visual reference.

## Non-negotiable conventions
1. **Explainer files.** Every code file you create or materially change gets `<name>.explainer.md` beside it, per `EXPLAINER_STANDARD.md` — architecture, methodology, and a counterfactual analysis. PRs without explainers are incomplete.
2. **Human-in-the-loop invariant.** No code path may write AI output directly into a register (Obligation, Entity, etc.). AI writes to review/draft tables only; humans confirm. This is the product's core promise — treat violations as security bugs.
3. **Audit events.** Every mutation to a register emits an audit event (pattern exists in the codebase). New features follow it.
4. **Migrations:** Prisma migrations, never `db push`, and never destructive on seeded demo data without a written note in the PR.
5. **State updates.** End every work session by updating `docs/CURRENT_STATE.md` (what changed, what's in flight) and the Next-actions table in `docs/ROADMAP.md`.
6. **Commit style:** conventional-ish prefixes — `feat:`, `fix:`, `docs:`, `chore:`. Keep app changes and docs-tree changes in separate commits where practical.

## Guardrails
- Don't rotate the working name (Tax-Able vs Tax Team Record) in code/UI until D-open item in ROADMAP (#7) is decided; use "Tax-Able" in new UI copy.
- Don't add Tailwind or a component library — design tokens + plain CSS (D-004, D-008).
- Don't integrate openaccountants content until the AGPL gate clears (ROADMAP next-action #6). The MCP *protocol* prototype may proceed against their hosted server in a spike branch.
- Secrets: `OPENAI_API_KEY` and DB URL live in Replit secrets. New secrets (Clerk keys, storage credentials) go there too; never commit them.

## When blocked
Write the blocker into `CURRENT_STATE.md` under `## In flight`, open a GitHub issue describing it, and move to the next unblocked queue item.
