# Obligation register + UK rules pack — module explainer

## Purpose
The system-of-record core: live obligations per entity, their deadlines, ownership, evidence and workflow state; plus a seeded UK rules pack that generates draft obligations from an entity's tax profile.

## Architecture
Entities carry a full UK tax profile (CT, VAT, payroll, R&D, capital allowances, governance flags). Rules (`/rules`: CT600, VAT returns, P11D, ERS, QIPs, etc.) evaluate a profile → draft obligations (`/entities/[id]/obligations`, `/obligations/drafts`) → human activates / rejects / marks N-A → live register (`/obligations`) with **seven distinct status dimensions** (data readiness, technical approval, task completion, filing submission, among others), RACI ownership fields, evidence requirements, risk fields → calendar view groups by deadline month. Mutations emit audit events.
Invariant: rules generate *drafts*; activation is human. Statuses are deliberately not collapsed into one field — "data ready" ≠ "technically approved" ≠ "filed" (implementation-adjusted plan §2).

## Methodology
Obligations-as-data: rules are seeded, declarative records (trigger conditions + date arithmetic + statutory basis) rather than code branches — the Phase 3 thesis (versioned, diff-able, testable) in embryonic form.

## Counterfactual analysis
- *Single status field + free tags*: simpler UI, rejected because the buyer's alternative is a spreadsheet — multi-dimensional status is precisely what spreadsheets fail at, and audit defensibility needs the distinctions.
- *Hardcoded rule logic in TypeScript*: easier v1, rejected because a Finance Act change must be a data change (PR-able, reviewable by a tax professional who doesn't read TS).
- *Full workflow engine (Temporal etc.)*: rejected pre-pilot; a scheduler over declarative rules suffices until obligations must trigger multi-step automations. Reverses when tripwires need to fire actions, not just flags.
Re-read: holds; the risk is rule-format drift before Phase 3 formalises it — freeze the format via the Phase 3 spec before mass-authoring rules.

## Known limitations & failure modes
Rules pack breadth is MVP (no Pillar 2 registration, SAO, CbCR, FATCA/CRS yet — Phase 3 #2); no effective-dating/`superseded_by` on rules yet (Phase 3 #3); deadline arithmetic around period-ends/short periods is the classic bug farm — golden tests required (Phase 3 #4); calendar is month-grouped list, not export — CSV/ICS export is the spreadsheet-parallel-run wedge (adoption risk mitigation).

## Verification
As-built confirmed via app interrogation 2026-07-08. Reviewer should re-verify: exact status dimension names, rule schema shape, and whether draft-generation is idempotent per entity (re-running rules must not duplicate drafts).
