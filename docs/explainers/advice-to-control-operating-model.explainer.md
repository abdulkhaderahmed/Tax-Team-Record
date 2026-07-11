# Advice-to-control operating model — architecture explainer

## Purpose

This explainer defines the system boundary joining adviser documents, controlled tax rules and the tax team's daily controls. The differentiator is the traceable record graph and operating loop, not a prettier deadline calendar or an AI chatbot.

## Architecture

There are two draft-producing inputs:

```text
confirmed entity facts + approved rule version -> generated obligation draft
uploaded source document -> page-grounded AI candidate
```

Both meet at a human control boundary. An authenticated reviewer decides whether a candidate is applicable, preserves or resolves conditions, and either creates or links a live record. Live records then connect to execution controls:

```text
Entity / group / registration / period
  -> Obligation or Action
       -> Evidence expectations and source document
       -> Data requests and stored reminder/escalation dates
       -> Assumptions, caveats and tripwires
       -> Exceptions that can block filing readiness
       -> Independent approval gates
       -> Structured audit events
```

The core invariant is that provenance is retained across the boundary: a rule-generated obligation keeps its exact rule version and applicability trace; a document-generated record keeps the source document, review item and page/quote context. AI output itself is never a live register record.

Direct source and originating-review foreign keys preserve creation provenance. Generalised `DocumentRecordLink` and `ReviewItemRecordLink` rows are also written on review promotion and later source-link actions, so one record can retain several supporting, corroborating or contradicting sources without overwriting its origin. Organisation coherence and exactly-one-target constraints are enforced in application and database controls.

## Methodology

The schema uses explicit first-class records instead of embedding all control state in obligation notes. This allows the Head of Tax to ask operational questions—what is blocked, what evidence is unverified, what Finance owes, and what awaits approval—without interpreting free text.

Organisation scope and permission checks are applied before mutations. Restricted documents add document-specific grants; admin and Head of Tax roles can bypass grants by policy. Ordinary document editing cannot change security, authority or reliance. Positive reliance and verification decisions require a review-capable user independent from the uploader/latest editor. Reviewer/editor/uploader attribution uses internal authenticated `User.id` values. Quick owner fields remain free text for import convenience, with structured `Party`/RACI records available where accountability needs more detail.

Document restriction controls the source, not the existence of the tax control. Derived obligation/action/register content remains visible within the organisation; users without a document grant see a restricted-source marker instead of filename, document ID, page location, excerpt or source audit snapshot. This deliberate policy avoids hiding filing work from its owners, but it is not document-derived row-level confidentiality and should be revisited if customers need ethical walls around the resulting tax analysis itself.

Deletion is a controlled business event: entities are reasoned archives, while obligations, actions and documents are tombstoned with actor, time and reason. The audit helper can retain actor snapshots and before/after JSON so later user renames or deletion do not erase the event's meaning. A document tombstone currently preserves the stored blob; retention and purge policy remain infrastructure work.

## Counterfactual analysis

- *Put everything on the obligation row*: fewer tables and screens, but cannot represent reusable evidence, independent approvals, source-version history or several simultaneous blockers without ambiguous text fields.
- *Let AI create live controls above a confidence threshold*: reduces clicks but makes model calibration a control owner. Human confirmation is retained until a benchmark and filing-cycle evidence justify narrower automation.
- *Build integrations before the operating model*: creates expensive pipes into an unproven record graph. CSV is sufficient for the initial parallel run; the first connector should follow observed pilot friction.

The explicit graph is the right base, but breadth alone does not prove adoption. A pilot must show that the queues reduce work rather than merely ask users to maintain more records.

## Implemented controls

- organisation-scoped roles and permissions, plus restricted-document grants;
- global AI review queue with authenticated reviewer IDs and source-verification guardrails;
- full action, assumption, caveat, tripwire, exception, evidence, data-request and approval registers;
- centrally derived readiness from blocking exceptions, evidence requirements or approved waivers, and aggregate approval gates;
- requester/approver, evidence-owner/verifier and exception-owner/resolver separation, with assigned-decider checks and one active gate per type;
- document versions, reliance status, verification dates and true document-to-record links;
- group/associated-company structures, registrations and confirmed accounting periods;
- structured audit explorer/events, restricted-source redaction and reasoned tombstones on the main controlled records; and
- dashboard counts and CSV coexistence for a spreadsheet-parallel run.

## Still unproven

- Production Clerk configuration, cross-organisation tests and role-administration workflows.
- Whether the number of control registers is usable for a 2–8 person team; browser and tax-user scenario testing is required.
- Delivery of reminders/escalations: dates are stored, but no production scheduler or notification connector is operating.
- Tamper-evident/external audit retention and an event-by-event completeness review of older auxiliary mutation paths.
- Full evidence-based application inputs for complex QIP and Pillar Two scope; grouped Pillar Two filing-member workflow is absent and grouped generation therefore stops at an impact review.
- Whether derived-record visibility with restricted source redaction is sufficient for customers that use ethical walls around the underlying advice.
- The five-document extraction benchmark and two-filing-cycle customer outcome tests.
- ERP, payroll, filing engine, HMRC, calendar and collaboration integrations; infrastructure hardening remains parked.

## Verification

Last inspected 2026-07-11 on branch `codex/advice-control-record`. The 69-test suite covers permissions, document grant/redaction semantics, identity configuration, independent decisions, aggregate approval/evidence/exception control policy, audit shape, rule boundaries, extraction mechanics and benchmark honesty. All 17 migrations pass a clean-schema rehearsal; the production build is green and a browser smoke test confirms dynamic register rendering, controlled generation/idempotence, impact visibility and an error-free console. Before pilot use, execute role-by-role browser tests, cross-org negative tests, every review-to-live path, blocker/approval scenarios, document-version/source checks and CSV reconciliation against the incumbent register.
