# Roadmap

Owner: Abdul. Maintained by whichever agent worked last. Last update: 2026-07-08 (Claude/Cowork).
Rule: every session ends by updating **Next actions** below and `CURRENT_STATE.md`. That is the halt/resume protocol — assume any session can be cut off mid-task.

## Phase map

### Phase 1 — Make it real (now → first external user)
Goal: a stranger can safely use the deployed app.

1. Authentication + org scoping — `specs/SPEC-001-authentication.md` — **Devin**
2. Production file storage — `specs/SPEC-002-file-storage.md` — **Devin**
3. Global review queue `/review` + background extraction — `specs/SPEC-003-global-review-queue.md` — **Devin**
4. Repo hygiene: `.gitignore` `.next/`, relocate `attached_assets` pastes — **Devin (same PR as #1)**
5. Design system applied to app shell + dashboard per `design/DESIGN_SYSTEM.md` — **Devin or Replit**

Exit criteria: login works, uploads survive deploys, one place to see all pending review items, UI matches design tokens.

### Phase 2 — Trust layer (differentiator)
Goal: every AI output is verifiable — the Bloomberg Tax "verified intelligence" standard (citations, reviewer sign-off, audit trail) applied to a UK obligations product.

1. Source citations on every extracted item (page/paragraph anchor into the stored document).
2. Reviewer sign-off records surfaced on obligation detail (who confirmed, when, from which source page).
3. Live registers for actions/assumptions/tripwires (promotion targets beyond ManualObligation).
4. `taxgpt-uk` knowledge layer v0: reference pane on review items backed by openaccountants UK guides via MCP — architecture in `taxgpt-uk/02_integration_architecture.md`. License gate: resolve AGPL question first (`taxgpt-uk/01_candidate_assessment.md` §License).
5. Sentry error monitoring; PostHog product analytics (per D-004).

### Phase 3 — Rules pack as product
Goal: obligations-as-code, versioned and diff-able.

1. Rules pack format: YAML frontmatter + citation fields, borrowing the openaccountants *pattern* (structure only, freshly authored text — no AGPL content).
2. Corporate UK pack expansion: CT600 + QIPs + Pillar 2 registration, P11D/PSA, ERS annual returns, SAO certification, tax strategy publication, CbCR, FATCA/CRS.
3. Effective-dating + `superseded_by` so a Finance Act change is a pull request.
4. Golden tests per rule (trigger conditions → expected obligations for fixture entities).

### Phase 4 — Distribution and proof
1. Pilot with 1–3 friendly in-house teams (run in parallel with their spreadsheets; CSV export is the wedge).
2. Pitch deck refresh from `Platform Strategy Pack/06` with live product screenshots.
3. Pricing hypothesis vs Alphatax/ONESOURCE anchors (see strategy pack 03).
4. GTM experiments — only here does Asana become useful (D-006).

## Next actions (update every session)

| # | Action | Owner | Blocked by |
|---|---|---|---|
| 1 | ~~Push this docs tree to GitHub main~~ | Abdul / Devin | **Done** — `origin/main` @ `4ddae03` |
| 2 | Execute SPEC-001 (auth + org scoping) | Devin | Clerk secrets not yet in env |
| 3 | Execute SPEC-002 (storage) | Devin | #2 |
| 4 | Execute SPEC-003 (review queue) | Devin | #2 |
| 5 | Apply design system to app shell (`design/DESIGN_SYSTEM.md` + `dashboard-mockup.html` as reference) | Devin | #2 |
| 6 | Legal read on AGPL-3.0 + LICENSE-ADDITIONAL.md of openaccountants before any content integration | Abdul | — |
| 7 | Decide working name (Quarterday vs Tax Team Record) before design lands in-app | Abdul | — |

## Halt/resume protocol

If you are an agent picking this up cold: read `CURRENT_STATE.md`, then the table above, then the spec for your task. Before finishing: update both files, keep explainers in sync (`EXPLAINER_STANDARD.md`), commit with message prefix `docs:` for doc-only changes. If you were cut off mid-task, write what you know into `CURRENT_STATE.md` under a `## In flight` heading rather than leaving it in your head.
