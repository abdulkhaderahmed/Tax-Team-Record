# Obligation register and controlled UK rules — module explainer

## Purpose

This is the statutory-calendar control core: one canonical record type for each tracked obligation occurrence, tied to entity facts, the exact approved rule version that produced it, ownership, evidence, exceptions, approvals and audit history. The rules pack is controlled content; it is not a tax calculator and does not file a return.

## Architecture

`Entity` plus confirmed `AccountingPeriod` records → deterministic TypeScript tax-date engine → resolve the single approved/superseded `TaxRuleVersion` effective for each relevant period/date → verify that version's immutable engine binding → create canonical `Obligation` drafts → authenticated reviewer activates, rejects or marks not applicable → activated records enter the register and dashboard.

The canonical Prisma model is `Obligation`. It maps to the existing database table `ManualObligation` solely to preserve data through the retirement of the former parallel `Obligation`/`ObligationRule` path. `/rules` and the old per-entity obligations route are redirects; `/rules-pack`, `/obligations` and `/obligations/drafts` are the maintained paths.

Every generated occurrence stores `ruleVersionId`, rule key/version number, engine version, statutory basis, calculation basis and a human-readable `whyApplies` trace. Re-running generation uses a database-unique rule/period/deadline/title occurrence key, so concurrent requests cannot create the same controlled occurrence twice.

A rule change follows a different workflow: editor proposes a new effective-dated version with rationale and source-check date → a different authorised user approves it → the prior version is superseded → a `RuleImpactReview` is created for every active entity. Existing obligations remain historically linked to their original version and are never silently rewritten.

## Methodology

The database controls content lifecycle and provenance; TypeScript implements date arithmetic and rule evaluation. `triggerConfig` and `calculationKey` are stored for traceability, while each controlled version is bound to the deterministic engine release it was reviewed against. The application is **not** a generic interpreter of arbitrary database-authored tax logic. A content change can be proposed without changing code, but a calculation change still needs a tested engine release and a matching reviewed rule version.

The current controlled catalogue covers CT returns and standard payments, large/very-large QIPs, quarterly VAT, P11D/P11D(b) and transition review, PSA agreement/calculation/payment, ERS, R&D notification/AIF, and Pillar Two scope/registration/return/payment. Not all paths have equal evidence depth.

The obligation workflow preserves nine status dimensions because data completeness, validation, technical review, approval, work progress, evidence, filing, payment and overall readiness are different assertions. Creation cannot pre-assert a passed control state. Generic editing cannot change derived approval, evidence or technical-review outcomes, and preparers cannot remove active requirements or blockers. Readiness is recomputed centrally from blocking exceptions, evidence/waiver state and aggregate approval gates; a free status override cannot bypass those controls.

## Counterfactual analysis

- *One editable deadline spreadsheet*: faster to build, but loses effective-dated provenance, applicability reasons, separation of duties, exception blocking and record relations—the reasons a tax team would adopt a system of record.
- *Make all tax logic editable JSON*: removes some deployments but creates an untyped programming language without a safe authoring, validation or test surface. It becomes credible only when every supported operator has schema validation, preview, golden tests and tax-professional approval.
- *Silently regenerate after a law change*: keeps dates current but destroys historical traceability and can mutate live controls without an owner seeing the impact. The visible entity impact queue is intentionally conservative, even though it will initially be noisy.
- *Replace filing software*: outside the product boundary. Tax-Able should reconcile and govern work alongside a filing engine unless a later pilot proves a narrower replacement case.

The chosen approach still holds. Its main risk is overstating what the profile proves: complex regime status must be supported by evidence, not inferred from a convenient checkbox.

## Implemented and verified

- Versioned/effective-dated rule, citation, editor/reviewer, rationale and supersession records exist.
- Independent approval is enforced: an editor cannot approve their own version.
- Generated obligations display the exact rule version, authority, statutory link and “why this applies”.
- Rule approval creates entity impact reviews without changing live obligations.
- 39 rules/generator tests cover the prioritised CT, QIP, PSA, P11D, R&D and Pillar Two boundary cases, historical effective-version selection, engine mismatch, the transition review/applicability-date distinction and fail-closed period coverage.
- Canonical obligation writes, generation, CSV import/export and list/detail/calendar reads are organisation-scoped.
- A clean PostgreSQL rehearsal applies all 17 migrations, seeds 17 controlled rule versions/31 citations and finishes with no schema drift.

## Known limitations and failure modes

- The application adapter currently trusts confirmed profile flags for large/very-large company and Pillar Two status. The domain engine contains threshold logic, but the product does not yet collect and evidence every profit, liability, associated-company, four-period revenue, merger and special-regime input needed to establish those statuses.
- Pillar Two filing obligations are not safely entity-level when the entity belongs to a group. The generator now fails closed and creates a visible scope impact review in that case; a group assessment and filing-member workflow still need to be built.
- VAT and ERS generation are implemented but lack the same golden-test coverage as the prioritised families. Non-standard VAT schemes and special QIP regimes require human review.
- Seeded statutory content has primary-source links, but production reliance still requires a named UK tax-content editor/reviewer and controlled release evidence.
- A newly approved version creates impact reviews for all active entities rather than a pre-filtered affected set. This fails safe but may create review fatigue.
- Draft activation is a human review boundary but does not itself require a different user from the person who ran generation. Where formal separation is required, the live record must pass its independent approval gate before readiness can become ready.
- Draft activation and the nine status transitions need full browser and tax-user scenario testing; unit tests establish calculation/policy behaviour, not operability.
- No filing-engine, HMRC, calendar or ERP integration exists. CSV is the current parallel-run boundary.

## Verification

Last inspected 2026-07-11 on branch `codex/advice-control-record`. Strict TypeScript, Prisma validation/client generation, the production build, 69 focused tests, migration checksums and a 17-migration clean-schema rehearsal pass. The production-browser smoke test confirms zero-duplicate regeneration, exact rule/engine explanations, payment-only due dates, P11D impact creation and live dashboard/impact rendering. Independent rule approval, blocker enforcement and historical-version retention still need full role-by-role browser scenarios before pilot reliance.
