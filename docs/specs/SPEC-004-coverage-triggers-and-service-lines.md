# SPEC-004 — Tax coverage, trigger points, input levels and service lines

Status: specified, not built · Depends on: SPEC-003 · Evidence base: `docs/research/ADVICE_SPECIMEN_MIP_2026-07.md`, `docs/research/INITIAL_BUYER_ANALYSIS_2026-07.md`

## Problem

The product records one thing well: an adviser document's conditions, converted into controls, evidenced and signed off. That is a real wedge but it is one layer of a Head of Tax's job, and it is the layer they are least often asked to justify.

Testing the record against one page of real delivery-structure advice (the MIP specimen) exposes four structural gaps:

1. **No tax-head coverage.** Advice opines across stamp taxes, IHT, employment income, ERS, corporation tax deductions, deferred tax, VAT and information reporting, for the company *and* for founders, trustees and individuals. The record has one entity, one document and a flat list of conditions. It cannot answer "which taxes does this touch, for whom, and what was **not** covered" — which is where the exposure sits.
2. **No trigger-point model.** Obligations are generated from entity profile and confirmed accounting periods. That produces the recurring calendar. It does not produce the fourteen-day election, the thirty-day stamping deadline or the ninety-day trust registration that one transaction created — and those are the deadlines nobody has in a spreadsheet.
3. **No stated levels of input.** The product asks for entities, periods, documents and evidence without telling the user what each layer entitles them to conclude, or what remains unknown. A business setting up in the UK, or improving its view of UK obligations, needs exactly that: *given what you have told us, here is what the UK expects of you, here is what we cannot yet determine, here is what unlocks it.*
4. **No service-line shape.** Corporate tax, capital allowances, R&D, real estate, transaction tax and financial services tax have genuinely different units of work — a computation query, a cost line, a project, a property, a finding, an entity classification. One generic "matter" flattens all of them into a document with conditions.

The offering is therefore narrower than the buyer's problem and thinner than the price point set in the buyer analysis (£25k–£45k initial). This spec closes that without breaching D-011: **nothing here computes a liability or files a return.**

---

## Design principles

Applied to every part below, and to be added to `docs/design/DESIGN_SYSTEM.md`.

**P1 — One spine, many packs.** There is exactly one core model: `event → test → obligation → owner → evidence → decision → where the number lands`. Service lines are *packs* over that spine (event taxonomy, rule set, question set, deliverable template). No service line gets its own application.

**P2 — Record, never compute.** The product holds the query, the decision, the election, the clock and the evidence. Alphatax, ONESOURCE and the filing engine hold the number. Where a number appears, it is a recorded figure with a source, not a calculation the product asserts.

**P3 — The absent cell is the output.** Coverage views must show what was *not* addressed as prominently as what was. A green matrix nobody looks at is worthless; the four grey cells are the meeting.

**P4 — Every level of input declares its yield.** Each input level states, on screen: what has been supplied, what can now be concluded, what remains indeterminate, and what supplying next would unlock. No silent prerequisites.

**P5 — Responsibility is a field, not boilerplate.** Prepare / review / approve / file / responsible party is modelled per obligation and printable. The directors' responsibility for approving returns and meeting deadlines is a data structure, not a footer.

**P6 — Deadlines are shown at their own scale.** A fourteen-day clock and an annual filing must not render identically. Urgency is a function of the clock's length, not only of its date.

---

## Part A — Coverage matrix (`TaxPosition`)

New record: for each matter, a grid of **party × tax head**, each cell carrying a position.

- **Parties**: extend the existing `Party` model with a `taxpayerRole` (`Group entity | Trust | Individual | Counterparty | Not a taxpayer`) and allow a party to be the subject of an obligation without being a group entity. The Company, the EBT, the Founders and the participant population are four parties in the MIP specimen.
- **Tax heads**: a controlled list — Corporation tax, CT deductions, CIR, Transfer pricing, VAT, Stamp taxes (stamp duty / SDRT / SDLT), Employment income & NIC, Employment-related securities, CGT, IHT, Capital allowances, R&D, Information reporting (ERS returns, TRS, FATCA/CRS), Deferred tax & financial reporting.
- **Cell position**: `Opined | Assumed | Expressly excluded | Not addressed | Not applicable`, with source citation (document + page) where opined, the assumption text where assumed, and the scope wording where excluded.
- **Derived output**: a "coverage gaps" list — every cell that is `Not addressed` or `Assumed` on a matter with a live decision. This is the matter's most valuable single screen and the strongest artefact to put in front of a CFO.

Cells are created by the reviewer, proposed by extraction, and never auto-confirmed (consistent with the existing review-queue control).

## Part B — Trigger points (`TaxEvent` → obligation)

New record and a second generator path alongside the existing period-driven one.

- **`TaxEvent`**: type (from a controlled taxonomy), date, parties, instrument/document reference, amounts, and a status of `Planned | Executed | Abandoned`.
- **Event taxonomy v1** (UK, event-driven): incorporation or UK establishment; first UK employee; first UK customer / registration threshold crossed; share issue; share transfer on sale; option grant; option exercise; restricted-securities acquisition; trust creation; group reorganisation; acquisition or disposal of a company; property acquisition, disposal or lease event; capital expenditure incurred; R&D project commenced; loan or funding put in place; entity classification change.
- **Mapping**: each event type maps to an obligation set under the existing controlled-rule mechanism (effective-dated versions, citations, engine binding, fail-closed). The obligation carries **its own clock basis** — days from the event, not a date in a calendar year.
- **Output**: an *event timeline* per matter, showing each event, everything it set running, the clock length and what is left open. This is the "simple and algorithmic steps towards tax obligations" the buyer asks for, made literal: the algorithm is the mapping table, and it is inspectable.

The first pack to load must include the short-clock items that a calendar cannot contain: restricted-securities elections, stamp duty notification, trust registration, plan notification and annual ERS returns, land transaction returns, option-to-tax notification, R&D pre-notification and the additional information form, and the fixed-asset election window on property acquisitions.

## Part C — Input levels (L0–L4)

Make the layers explicit, in the product and in the sale.

| Level | Input | What it yields | What stays indeterminate without the next level |
|---|---|---|---|
| **L0 — Footprint** | jurisdiction, activity, people, customers, property, group | registration obligations, the recurring calendar shape, threshold tests (VAT registration, PAYE, CIR de minimis, senior accounting officer, published tax strategy, transfer pricing exemption, Pillar Two) | nothing is dated |
| **L1 — Periods & positions** | accounting periods, reporting framework, elections in force, brought-forward positions | dated obligation instances, instalment status, the computation shell | no event-driven work |
| **L2 — Events** | transactions, awards, hires, property, projects | event-triggered obligations and short-clock elections | no reliance position; no conditions |
| **L3 — Advice & instruments** | adviser reports, agreements, trust deeds, valuations | conditions, assumptions, caveats, tripwires, the coverage matrix, reliance boundaries | no numbers; nothing lands |
| **L4 — Numbers & evidence** | trial balance, fixed asset register, payroll data, draft computations | the query register, filing readiness, the period pack, the handoff to the computation and return | — |

Every entity and every matter carries a level indicator and a single line of what the next level unlocks. **This is the "structured workflow understanding at each level of input" gap**, and it is also the onboarding path for an inbound business: L0 alone is a saleable deliverable ("what the UK expects of you and when").

## Part D — Where the number lands

Every decision, election and event gains a **destination**: `Computation adjustment | Return box | Financial-statement disclosure | Payment | No financial effect`, with the period it affects.

Derived from it: the **period pack** — for period ending X, every decision, election, event and unresolved query that must be reflected in the computation, the tax note and the return, with status and owner. This is what makes the record useful to the person who actually files, and it is the join between the associate's line-item work and the Head of Tax's decision work.

## Part E — Query register (corporate tax compliance pack)

The unit of associate-level corporate tax work is a query against a line item. Model it:

- `ComputationQuery`: period, computation reference, account or line reference, amount, question, raised by, owner, response, evidence, treatment decision, effect (`increases / decreases / no effect on taxable profit`, recorded not calculated), status, and a `recurring` flag that carries the query into the next period with last year's answer attached.
- Aggregates into: open queries by owner, queries blocking sign-off, and the recurring query list — the single most reusable asset a compliance team has and the one that is always rebuilt from scratch each year.
- The register sits beside the filing engine. It never re-states the computation.

## Part F — Service-line packs

A pack supplies four things and nothing else: an **event taxonomy**, a **rule/obligation set**, a **question set** (the standard queries and evidence expectations), and a **deliverable template**.

| Pack | Unit of work | Deliverable |
|---|---|---|
| Corporate tax compliance | computation query | period pack: return, CIR return, current and deferred tax entries, iXBRL handoff status, director approval record |
| Transaction tax & due diligence | finding | issue log with quantum, protection ask and the post-completion action list — which then becomes ordinary conditions on the spine |
| Capital allowances | asset / cost line and its pool | claim schedule with elections and their windows, reconciled to the fixed asset register |
| R&D | project and cost category | claim record with the notification and information-form clocks, competent-professional sign-off and evidence per project |
| Real estate | property and each transaction over it | property register with land-transaction, option-to-tax, capital-goods-scheme and annual-charge obligations |
| Financial services | entity classification and account population | classification register, self-certification status, reporting readiness |
| Incentives & reward | award and participant population | delivery-route record, valuation shelf life, election clocks, annual returns |

Sequencing: **incentives & reward** and **transaction tax** first — they are the archetypes the wedge already half-serves, and the specimen document is one of each. **Corporate tax compliance** second, because it is the recurring revenue line and the query register is the entry point. Capital allowances, R&D, real estate and financial services follow as packs once the spine holds three archetypes without special-casing.

---

## Build order and exit criteria

| # | Ships | Exit criterion |
|---|---|---|
| 1 | Coverage matrix (Part A) | One real adviser document produces a party × tax-head grid whose `Not addressed` cells a tax reviewer agrees are the right ones to raise |
| 2 | Trigger points (Part B) | Nine events from the MIP specimen generate their obligation sets with correct clock bases, and no obligation appears without a controlled rule version behind it |
| 3 | Input levels (Part C) | Each entity and matter states its level and its next unlock; an L0-only entity produces a usable UK footprint deliverable |
| 4 | Destinations and period pack (Part D) | Every approved decision in the demo carries a destination; the period pack lists them for one period end |
| 5 | Query register (Part E) | A recurring query carries forward with last year's answer; open queries block filing readiness through the existing exception mechanism |
| 6 | Packs (Part F) | A second and third pack load without changing the spine |

## Counterfactuals

- **Building calculation** was rejected again (D-011 holds). Coverage, triggers, queries and destinations all increase the record's value without asserting a number.
- **A separate module per service line** was rejected: it multiplies the surface, splits the audit trail and rebuilds the same review controls six times.
- **Auto-confirming extracted coverage cells** was rejected: the coverage matrix is the artefact most likely to be relied on, so it must clear the same human review gate as every other extracted candidate.
- Reverses if pilot users treat the coverage matrix as adviser-scope policing rather than as their own risk register — in which case the framing moves from "what the advice did not cover" to "what we have not yet established".
