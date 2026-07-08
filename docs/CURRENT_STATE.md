# Current state — as of 2026-07-08

Source: live inspection of the Replit app ("Tax Team Record", repl `b1049bd0`), its git remote (`origin/main` = local `main` @ `9b9cf55 "Tax Register"`), and the Platform Strategy Pack (v1.0, 4 July 2026). Verify against code before relying on details.

## What the product is

**Quarterday** (working name): system of record for in-house UK tax teams. Turns adviser deliverables into reviewed registers → registers into a statutory calendar → everything source-linked and auditable. Buyer: Head of Tax / CFO, UK corporates and UK branches of foreign groups. Core ICP: HMRC Large Business Directorate population (~2,000 groups) plus QIP-payers (~8–10k groups).

## Built and working (deployed on Replit, `.replit.app`)

| Module | Routes | Notes |
|---|---|---|
| Dashboard | `/` | Entity/obligation counts, upcoming deadlines, recent audit events |
| Entity register | `/entities`, `/entities/[id]`, new/edit | Full UK tax profile: CT, VAT, payroll, R&D, capital allowances, governance |
| Obligation register | `/obligations` (+ new/edit/detail), `/obligations/calendar`, `/obligations/drafts` | 7 workflow-status dimensions, evidence + risk fields, draft review/activate/reject/N-A |
| Document vault | `/documents` (+ new/detail/edit), file download API | PDF/DOCX ≤15MB, text extraction (pdf-parse, mammoth), health-check flags (XX, TBC, [insert…], do/do not) |
| AI extraction | `/documents/[id]/extraction/[runId]` | gpt-4o structured output, Zod-validated, 10 item types, per-run review UI, "create live obligation" |
| Source systems | `/sources` (+ new/edit), data categories, priority rules, conflict log | ObligationSourceRef links obligations to sources |
| Rules pack | `/rules`, `/rules-pack` | Seeded UK rules: CT600, VAT, P11D, ERS, QIPs; per-entity draft generation |

## Stack

Next.js 15 (App Router, server actions) · TypeScript strict · plain CSS (`globals.css`, **no Tailwind**) · Postgres (Replit-managed) + Prisma 5 · OpenAI SDK v6 (gpt-4o) + Zod · pdf-parse v2, mammoth v1 · no auth · local-filesystem uploads · deployed to Replit.

## Broken / half-finished (ranked by severity)

1. **No authentication.** Public URL, `ORG_ID = "demo-org"` hardcoded in every action/page. Blocks any real use. → `specs/SPEC-001-authentication.md`
2. **Uploads don't persist in production.** Files write to `process.cwd()/uploads/`; the published container has a different filesystem → 404s. → `specs/SPEC-002-file-storage.md`
3. **No global review queue.** Review only exists per extraction run; no `/review` across documents. → `specs/SPEC-003-global-review-queue.md`
4. AI extraction runs synchronously in a server action — long docs will time out client-side. (Covered as a constraint in SPEC-003.)
5. Confirmed actions/assumptions/tripwires have no live registers to promote into — only ManualObligations exist.
6. No `/sources/[id]` read-only detail view (minor; edit page doubles as view).
7. Single seeded org/user (Acme Tax Ltd); multi-tenancy waits on auth.

## Repo hygiene issues

- `.next/` build cache is committed (hundreds of files; bloats every commit). Add to `.gitignore`.
- `attached_assets/Pasted-*` — 5 raw feature-spec pastes committed at root; superseded by this docs tree.
- Repo layout: app lives under `artifacts/quarterday/`, plus `artifacts/api-server/`, `artifacts/mockup-sandbox/`, `lib/`, `scripts/`. Consider flattening later; not urgent.

## Environment facts that constrain planning

- Replit agent credits: exhausted or near-exhausted (user report, 2026-07-08). No Replit builds until topped up.
- Figma: user seat is **view-only** (starter tier) — designs cannot be written into Figma. Design work ships as code/HTML + spec instead (see `DECISIONS.md` D-007).
- No GitHub connector in the Cowork session; pushes go via user or Devin (see `../PUSH_INSTRUCTIONS.md`).
- Devin (Ultra/max plan) available for autonomous implementation.

## In flight

- docs/ tree **pushed** to GitHub (`origin/main` now at `4ddae03`). Remote had two extra commits from a Devin branch adding `docs/taxgpt-uk/` analysis files; merged cleanly.
- Next: execute `specs/SPEC-001-authentication.md` (auth + org scoping). Requires Clerk secrets (`CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`) to be added to the environment before runtime, but the code scaffolding can proceed.

## Strategy pack (local folder, not in repo)

`Platform Strategy Pack/` 01–08: corpus analysis of 5 Grant Thornton deliverables (evidence base), TAM (~2k core ICP groups), competitive landscape (ONESOURCE, Alphatax/Tax Systems, Materia), MVP spec, systems architecture, pitch deck, implementation-adjusted build plan, Replit execution checklist. The implementation-adjusted plan (doc 07) is the operative product boundary: **system of record first; AI never writes directly to registers.**
