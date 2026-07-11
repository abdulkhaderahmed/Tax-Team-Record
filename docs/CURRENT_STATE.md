# Current state — advice-to-control branch, 2026-07-11

Source: direct inspection of the current branch's Prisma schema, routes, server actions, migration, rules engine and focused tests. This describes the repository implementation, not a production certification or a completed customer pilot.

## Status language

- **Implemented** means a route, data model and guarded mutation path exist in this branch.
- **Verified locally** means a focused automated check has passed against the branch.
- **Unproven** means the design or code exists but has not met the stated operational, tax-content or customer-evidence gate.
- **Parked** means deliberately outside this repair sprint, not accidentally omitted.

## Product boundary

Tax-Able is an **advice-to-control system of record** for an in-house UK tax team. It records why a tax requirement or adviser recommendation matters, who owns the resulting work, what evidence and approvals are required, and what remains blocking. It does not calculate a tax liability, submit a return or replace the filing engine.

Two controlled intake paths feed the record:

1. an entity profile and confirmed accounting periods are evaluated by approved, versioned UK rules to create human-reviewable obligation drafts; and
2. an uploaded adviser document is extracted into candidates that remain in a review queue until an authenticated reviewer confirms or links them.

Neither rules nor AI silently turn a change into a completed live control.

## Implemented in this branch

| Area | Routes / objects | Current implementation |
|---|---|---|
| Identity and authorisation | Clerk middleware; internal `Organisation` and `User`; role/permission policy | Organisation-scoped reads and writes; roles from admin through viewer; destructive, review, approval and rule permissions; authenticated internal user IDs for reviewers, rule editors/reviewers, document uploaders and core record mutations. A demo fallback is used only when both Clerk keys are absent; partial configuration fails closed. |
| Entity and structural facts | `/entities`, `/groups`, `/registrations`, `/periods`; `EntityGroup`, `EntityRelation`, `TaxRegistration`, `AccountingPeriod` | One entity profile, group/associated-company facts, registrations, reviewer-confirmed source dates and confirmed CT periods available to the generator. Confirmed periods cannot overlap and generation fails closed when a period-of-account is incomplete or discontinuous. A `RegimeAssessment` schema exists, but has no operating route/action yet. |
| Controlled rules | `/rules-pack`, `/rule-impact`; `TaxRule`, `TaxRuleVersion`, `RuleCitation`, `RuleImpactReview` | Effective-dated versions with statutory links, authority/legal status, source-check date, editor, independent reviewer, rationale, supersession and an immutable deterministic-engine binding. Generation resolves the version effective for the relevant period/date and fails closed on gaps, overlaps or engine mismatch. Approval creates visible entity impact reviews and does not rewrite existing obligations. `/rules` is a legacy redirect only. |
| Canonical obligation record | `/obligations`, drafts, calendar, detail, CSV import/export | One Prisma `Obligation` model and one generator path. Generated records retain the exact `TaxRuleVersion`, engine version and a stored “why this applies” trace; review activates, rejects or marks them not applicable. A database occurrence key prevents concurrent duplicate generation. The model maps to the existing physical `ManualObligation` table to preserve data during migration. |
| Operating registers | `/actions-register`, `/assumptions`, `/caveats`, `/tripwires`, `/exceptions`, `/evidence`, `/data-requests`, `/approvals` | Organisation-scoped registers with real links between entity, obligation/action, source document and originating review item where applicable. Filing readiness is recomputed from unresolved blocking exceptions, evidence requirements or an approved evidence waiver, and the aggregate state of active approval gates. Requester/approver, evidence-owner/verifier and exception-owner/resolver separation is enforced. |
| Daily view | `/` plus register queues | Dashboard counts filing blockers, overdue data requests, pending approvals, pending/running extraction and review work, alongside the 90-day obligation horizon. Data requests can store reminder and escalation records. |
| Document control | `/documents`, document detail/version upload, protected file route | Storage abstraction, content hashes, explicit document versions/supersession, reliance and sensitivity metadata, independent source-verification timestamp/user, restricted-document grants, archive and reasoned tombstone controls. Ordinary editors cannot alter access, reliance or authority fields. Derived control records remain organisation-visible by policy, while restricted source identity, location, page context and audit snapshots are redacted without a document grant. |
| AI-assisted intake | `/review`, per-run extraction view; `ExtractionRun`, `ReviewItem` | Physical-page PDF chunks, conditional OCR through Tesseract, deterministic 8–12k page-aware model blocks, quote/page grounding checks, persisted jobs with leases/retries/heartbeat, and a global review queue. Confirmed obligation, action, assumption, caveat, tripwire and evidence candidates create durable records and lineage links transactionally. A final no-record outcome requires an allowed disposition and reason. |
| Audit and deletion | `/audit`; `AuditEvent`; record-level history | The organisation audit explorer stores authenticated user IDs, actor snapshots, target, reason and before/after JSON, and redacts restricted source context. Entity removal is a reasoned archive; obligation, action and document removal uses a reasoned tombstone rather than hard-deleting the business record. |
| Spreadsheet coexistence | `/obligations/import`, `/api/exports/obligations` | Bounded CSV import with dry-run validation and organisation checks; export includes rule version, applicability rationale and source-document ID. CSV output protects against spreadsheet-formula injection. |

## Verified locally

The focused suite contains 69 passing tests:

- 39 rules and generator tests covering historical and incomplete CT periods, short/long CT periods, standard and QIP payment dates, controlled-version interval selection, engine mismatch, occurrence behaviour, PSA, the P11D 2027 transition's distinct review/applicability dates, R&D notification/AIF boundaries, and Pillar Two thresholds, deadlines and grouped-entity fail-closed handling;
- 7 extraction-pipeline tests covering physical page preservation, OCR selection, tail-page processing beyond the former 40k-character boundary, stable blocks, citation correction/rejection and retry backoff;
- 17 policy/audit tests covering role permissions, restricted-document grants and redaction, independent document decisions, complete-or-demo Clerk configuration, approval aggregation and separation of duties, structured audit validation, and protection of derived control states; and
- 6 benchmark-framework tests covering the private fixture manifest, draft-inventory safety/labels, metric calculations, duplicate false positives and the prohibition on claims from unverified annotations.

Strict TypeScript checking, Prisma validation/client generation, the optimized Next.js production build and `git diff --check` pass. The build marks every organisation-scoped route as request-rendered, preventing demo-mode registers from freezing at build-time state. All 17 migrations were applied to a clean temporary PostgreSQL schema, the seed completed with 17 controlled rule versions and 31 citations, and the resulting schema had no drift from `schema.prisma`. The live development schema also has no drift and all applied migration checksums match the checked-in SQL.

A production-server browser smoke test confirmed keyless demo startup, pending-draft exclusion from dashboard/calendar live counts, payment-only due-date display, exact controlled-rule/engine explanations, authenticated actor IDs in audit history, zero-duplicate regeneration, and creation of the P11D transition impact with distinct 5 April review due date and 6 April applicability date. No browser console errors were recorded. These checks do not prove deployed secrets, storage, queues or model calls in production.

## Still unproven

1. **Real authentication deployment.** Clerk integration and fail-closed permissions exist, but production Clerk secrets, organisation claims, invitations, role administration, session behaviour and cross-organisation tests have not been exercised in the target deployment. The keyless demo fallback must never be mistaken for a production security mode.
2. **Tax-content operating governance.** The controlled-content model, effective-date resolver, engine binding and independent rule approval exist. The initial rule content and code calculations still require named tax-professional ownership, a release cadence, retained review evidence and formal approval before reliance. VAT and ERS generation do not yet have the same golden-test depth as the prioritised rule families.
3. **Application facts feeding complex rules.** The domain engine tests detailed QIP and Pillar Two logic, but the application generator still relies on confirmed profile flags for large/very-large and Pillar Two status. It does not yet collect the complete profit, liability, associated-company, four-period revenue, merger and special-regime evidence needed to determine those statuses itself. Where a Pillar Two entity belongs to a group, entity-level filing generation is withheld into an impact review because a group filing-member model and workflow do not yet exist.
4. **Extraction accuracy.** The five real PDFs are identified by private hashes/page counts. A commit-safe, non-confidential draft concept inventory and evaluator now define material obligation/action recall, precision/false positives, condition preservation and citation metrics. Every corpus annotation remains `draft_unverified`; no prediction run has been scored against an independently reviewed gold set. The framework and pipeline tests are explicitly **not** an accuracy claim.
5. **Operational automation.** Reminder/escalation rows, derived readiness and durable extraction worker code exist; no production scheduler, notification delivery channel, dead-letter operations, monitoring or service-level evidence has been proven. There is no automatic email/Teams/Slack chase loop.
6. **Audit assurance.** The organisation audit explorer and restricted-source redaction exist, but no immutable external audit store, tamper-evident export or exhaustive production audit test has been proven. Older auxiliary mutation paths still need an event-by-event completeness review before formal control reliance.
7. **External integrations and filing.** CSV is the only implemented exchange surface. ERP, payroll, Companies House/HMRC, adviser portals, calendar feeds and filing-engine integrations are parked. The product does not submit returns or payments.
8. **Infrastructure and production assurance.** The object-storage adapter and migration exist, but production storage, backup/restore, retention, blob-purge policy, malware scanning, encryption/key management, observability, performance, disaster recovery and security testing are parked. A document tombstone does not currently purge its stored file. Applying a migration locally is not production deployment proof.
9. **Customer value and operability.** No external pilot or two-cycle parallel run has yet demonstrated no missed material obligations, 95%+ page-accurate citations, lower calendar-maintenance effort or faster adviser-document triage. The expanded registers also need scenario testing with a 2–8 person team to show that the operating loop reduces work instead of creating duplicate administration.

## Immediate proof sequence when pilot preparation resumes

1. Have a UK tax-content owner and independent reviewer approve the seeded rules and the entity facts required by each rule.
2. Complete the private five-document gold set and report material obligation/action recall, false positives, condition preservation and page-accurate citation rates by document archetype.
3. Run the product beside one friendly group's incumbent spreadsheet for two filing cycles; do not make the product the sole control until reconciliation is complete.
4. Only then harden and verify production Clerk, storage, worker scheduling, monitoring and the first targeted integration chosen from the pilot's actual workflow.
