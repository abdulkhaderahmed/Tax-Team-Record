# Roadmap

Owner: Abdul. Maintained by whichever agent worked last. Last update: 2026-07-11.

Rule: `CURRENT_STATE.md` records evidence-backed implementation state; this file records the next proof sequence. Infrastructure remains parked until product/control proof makes it necessary.

## Completed repair-and-proof foundation

The `codex/advice-control-record` branch now contains the focused product repair requested before any external pilot:

1. one canonical entity profile, controlled generator and `Obligation` record; the former parallel obligation/rule path is retired;
2. organisation-scoped RBAC, authenticated internal user IDs, document grants, independent document decisions, reasoned tombstones and an audit explorer;
3. effective-dated controlled rules with citations, editor/reviewer, rationale, supersession, engine binding, visible entity impact review and golden boundary tests;
4. first-class action, assumption, caveat, tripwire, exception, evidence, data-request and approval registers, with centrally derived readiness and separation of duties;
5. group/associated-company structure, tax registrations, confirmed accounting periods, document versions, source verification and durable document/review lineage;
6. page-aware extraction, conditional OCR, leased/retryable jobs, quote/page verification, durable review dispositions and a five-document benchmark harness whose annotations remain explicitly unverified; and
7. bounded CSV import/export for spreadsheet coexistence.

Local evidence is recorded in `CURRENT_STATE.md`: 69 tests, strict TypeScript, production build, 17-migration clean-schema rehearsal, checksum/drift checks and a production-browser smoke test.

## Current phase — prove the control system before pilot infrastructure

### 1. Tax-content release evidence

- Assign a named UK tax-content editor and independent reviewer to every seeded rule family.
- Review the source, interpretation, trigger facts, effective interval and golden tests for CT, QIPs, PSA, P11D transition, R&D and Pillar Two.
- Add equivalent golden depth for VAT and ERS.
- Decide how tax-content source checks expire and how a change review is evidenced.

Exit gate: the seeded catalogue has signed review evidence and no rule is represented as production-reliable merely because its code test passes.

### 2. Five-document extraction benchmark

- Independently annotate the five private adviser documents, with two-reviewer resolution of material obligations/actions, conditions and page citations.
- Freeze the target set before scoring a model run.
- Report material-obligation/action recall, false positives/precision, condition preservation and strict page-citation accuracy by document archetype.
- Keep product accuracy claims disabled until the published gates pass.

Exit gate: no material target missed in the benchmark and at least 95% page-accurate citations for confirmed extracted items, with limitations reported rather than averaged away.

### 3. Role and operating-loop scenarios

- Exercise admin, Head of Tax, reviewer, preparer and viewer paths, including cross-organisation negatives.
- Walk an obligation from draft through data request, evidence, exception, independent approval and filing readiness.
- Walk every extraction type through durable record creation/linking or a reasoned no-record disposition.
- Reconcile CSV round-trips against an incumbent register and test restricted-document source redaction.

Exit gate: no generic edit or same-user decision can bypass a mandatory control, and a 2–8 person tax team judges the queue/register burden usable.

### 4. Customer proof design

Prepare—but do not yet broaden infrastructure for—a friendly UK group with roughly 10–75 entities, a 2–8 person tax/finance team, adviser-document volume and an existing filing engine or spreadsheet calendar. The later two-cycle parallel run should measure:

- no material obligation missed versus the incumbent process;
- every active item has an owner, source and evidence expectation;
- 95%+ page-accurate citations for confirmed extracted items; and
- reduced calendar-maintenance and adviser-document triage time.

## Explicitly parked

- Production Clerk tenant setup, invitations and procurement-grade security evidence.
- Production object storage/retention/purge, malware scanning, backup/restore and disaster recovery.
- Worker scheduling, notification delivery, dead-letter operations, observability and SLAs.
- ERP, payroll, HMRC/Companies House, filing-engine, calendar and collaboration integrations beyond CSV.
- Group-level Pillar Two filing-member workflow and full evidenced QIP/Pillar Two fact collection.
- Any tax calculation or return-submission capability.

These items become active only when one is required to pass a proof gate or remove measured pilot friction.

## Next actions

| # | Action | Owner | Evidence of completion |
|---|---|---|---|
| 1 | UK tax-professional review of the 17 seeded controlled rules | Abdul + named tax editor/reviewer | Signed version reviews, source-check dates and resolved findings |
| 2 | Convert the five-document draft inventory into an independently reviewed gold set | Abdul + two reviewers | Frozen annotations and benchmark report |
| 3 | Run role-by-role and cross-org operating-loop scenarios | Product/engineering | Scenario record with failures fixed or explicitly accepted |
| 4 | Test CSV reconciliation and register usability with a representative spreadsheet | Product + tax user | Reconciliation report and measured maintenance effort |
| 5 | Define the later two-cycle parallel-run protocol and candidate profile | Abdul | Pilot protocol; no external launch required yet |

## Halt/resume protocol

Read `CURRENT_STATE.md`, this roadmap and the three architecture explainers before load-bearing work. Before finishing a session, update the evidence statements rather than merely moving checklist labels. Never turn an untested implementation, draft tax interpretation or unverified benchmark annotation into a product claim.
