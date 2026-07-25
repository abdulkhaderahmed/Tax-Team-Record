# Selection and change log — shareholder/transaction tax positions

**Date:** 25 July 2026
**Trigger:** notes from a sell-side transactions tax webinar on CGT and shareholder planning (share exchanges, s.137 changes, gifts and holdover, BPR/IHT interaction, temporary non-residence, s.169Q elections, anti-forestalling, earn-outs, s.138A loan notes, personal vs corporate disposal).
**Purpose:** decide what from that material becomes product, what does not, and why. This is a change log with reasoning, not a summary of the source.

## Source handling

The source is a firm's internal training note marked commercial-in-confidence. **Nothing firm-specific enters this repository**: no firm or speaker names, no client anecdotes, no internal research question bank, no document links. What is used is (a) the public statutory mechanics any UK practitioner works from and (b) the *shape* of the workflows the material implies. Demo content is written into the existing Northstar fiction with invented figures.

One consequence of the source is itself a product requirement, recorded in change **C-4** below: the note repeatedly flags its own propositions as unverified — the effective date of the amended s.137, the exact s.169Q election and revocation deadlines, the six-month loan-note holding period, and a BPR allowance figure said to apply from 6 April 2026. A record that cannot distinguish *statute* from *stated but unverified* will silently promote a training note into a control.

---

## Selection

Fourteen candidates were extracted. Each scored 1–5 against five tests:

- **Recur** — happens across many clients, not bespoke to one deal
- **Clock** — carries a deadline that can be missed
- **Mech** — deterministic from facts the record can hold
- **Bound** — stays inside D-011 (records and routes; never computes a liability or gives advice)
- **Orphan** — nobody reliably owns it today, so the product fills a real gap

| # | Candidate | Recur | Clock | Mech | Bound | Orphan | Verdict |
|---|---|:--:|:--:|:--:|:--:|:--:|---|
| 1 | s.169Q election window on rollover consideration | 5 | 5 | 5 | 5 | 5 | **Build** |
| 2 | Holdover claim, amendment and revocation windows (s.165/s.260) | 4 | 5 | 5 | 5 | 5 | **Build** |
| 3 | Durational conditions — SSE holding period, s.138A loan-note period, seven-year survivorship, BPR clawback, continuing trading status | 5 | 5 | 4 | 5 | 5 | **Build** |
| 4 | Funding / dry-tax check on crystallising early | 5 | 3 | 4 | 4 | 4 | **Build (as a recorded reconciliation)** |
| 5 | Fiscal-event exposure and anti-forestalling risk | 5 | 3 | 4 | 5 | 5 | **Build (as a tag, not an object)** |
| 6 | Historic sweep of post-5 April 2024 exchanges and rollovers | 5 | 5 | 5 | 5 | 5 | **Build — flagship workflow** |
| 7 | s.137 now engages every participating shareholder, not only 5%+ | 4 | 2 | 5 | 5 | 4 | **Build (one trigger rule)** |
| 8 | Loss-to-donor valuation on partial gifts | 3 | 2 | 4 | 5 | 4 | **Build (one trigger rule)** |
| 9 | Temporary non-residence: days, ties, workdays, split year | 3 | 4 | 2 | 3 | 2 | Reject |
| 10 | Clearance application workflow | 4 | 2 | 3 | 4 | 2 | Defer |
| 11 | Earn-out drafting — ascertainable vs unascertainable, EBITDA bands | 4 | 1 | 2 | 2 | 3 | Reject |
| 12 | Research question bank | 2 | 1 | 1 | 2 | 2 | Reject |
| 13 | Personal vs corporate disposal comparison | 4 | 1 | 1 | 1 | 3 | Reject |
| 14 | Reclassification as an alternative to a holdco | 3 | 1 | 2 | 2 | 3 | Reject |

### Why the rejections

- **9 — non-residence monitoring.** Needs a day-count and travel feed the product will not have, and it is personal-tax compliance for one individual. Different data, different buyer, different liability profile. The residence *assumption* can still be recorded as an assumption with a tripwire; the monitoring cannot.
- **10 — clearance workflow.** Real, but adviser-side drafting work. The in-house buyer receives a clearance; they do not author it. Deferred until the adviser channel is a chosen route rather than a hypothesis.
- **11 — earn-out drafting.** The tax result turns on SPA wording and case law characterisation. That is a judgement to be made by a person and recorded, not a workflow to be run. The product holds the *conclusion* and the conditions attached to it — which the existing condition model already does.
- **12 — research question bank.** Firm intellectual property, and a knowledge base rather than a workflow. Building a UK tax knowledge product is a different company (see D-006).
- **13 — personal vs corporate disposal.** Requires modelling tax on the sale *and* tax on later extraction. That is computation. D-011 holds.
- **14 — reclassification vs holdco.** A structuring choice, not a recurring operation.

Selection discipline: six candidates survive, and they collapse into **two new objects, one flag, one reconciliation and one workflow**. Nothing else is added.

---

## Changes

### C-1 · `DecisionWindow` — a reversible position with an open window

**What.** A new object distinct from an obligation. An obligation is a thing you must do by a date. A decision window is a period during which a **choice about a tax position remains open**, and which closes with a **default outcome if nobody acts**.

Fields: the position it attaches to, kind (`Make | Amend | Claim | Revoke`), open and close dates, the clock basis in words, the **default outcome on inaction**, the facts still blocking a decision, the decision-maker (frequently an individual, not the company), and the consequence of acting late or reversing.

**Basis.** The source material is built almost entirely from windows rather than filings: an election to disapply tax-neutral exchange treatment where the original shares qualified for relief, with a deadline expressed as the second 31 January following the tax year of the exchange; a holdover claim generally available within four years of the end of the tax year of the gift; the possibility of revoking a claim through an amended return, with interest running from the original due date. None of these is a filing obligation. All of them expire.

**Why this is effective.** The existing obligation model would render every one of these as "a task with a date", which loses the two things that actually drive behaviour: that **doing nothing is itself a decision with a known outcome**, and that some of these choices can be **unwound**. A window that states "if nobody acts by 31 January 2029, rollover treatment stands and relief on the original shares is lost permanently" is a control. "s.169Q election — due 31 Jan 2029" is a to-do item nobody will action three years early.

**Rejected alternative.** Modelling these as obligations with a `type = election` flag. Rejected because the default-outcome and reversibility fields have no meaning on an obligation, and because obligation status vocabulary (`filed / late / not applicable`) cannot express "window closed, default applied".

### C-2 · `DurationalCondition` — a fact that must hold for a period

**What.** A second new object: something that must remain true from a start date for a stated duration, with an explicit list of **breaking events** and the consequence if one occurs.

**Basis.** The material is full of these and they are structurally identical: a holding period before an exemption is available on a later sale; a loan-note period before redemption; seven-year survivorship on a lifetime gift; and relief on a lifetime gift being lost where the business property is sold before the donor's death within that period. Also, from the earlier incentives work, a three-year option holding condition.

**Why this is effective.** These are the failures that are invisible until they have already happened, and the last one is the sharpest: **the liquidity event the client wants is the event that destroys the relief.** A register of tripwires (which exists) records that a risk was noted. A durational condition with a clock and a breaking-event list can be *checked against the deal timetable* — which turns a note in a report into an operational answer to "can we sell in March without losing this".

**Rejected alternative.** Reusing the existing tripwire register. Rejected because a tripwire has no duration and no breaking-event set, so it cannot be tested against a proposed transaction date.

### C-3 · Funding check — a recorded reconciliation, not a model

**What.** On any position where a gain is crystallised deliberately, two recorded figures with sources — the tax estimate and the cash expected to be available on the relevant date — and a status of `covered / short / not established`.

**Basis.** The material returns to this repeatedly: crystallising a gain before a sale can create a liability with no cash to pay it, particularly where consideration is earn-out, deferred cash, rollover equity or loan notes; the rate saving has to be weighed against funding cost, deal failure and the risk that the replacement equity falls in value.

**Why this is effective, and how it stays in boundary.** The product does not calculate the gain, apply a rate or model scenarios — it holds two figures that someone else produced, each attributed to a source, and flags the shortfall. That is the same class of control as the existing "signed consideration against the supported valuation" check that already works in the matter demo. It is the single most useful thing that can be said about early crystallisation without doing any tax arithmetic.

**Rejected alternative.** A gain/rate/relief calculator. Rejected under D-011, and separately because the numbers arrive from the adviser's model anyway; re-deriving them creates reliance risk and adds nothing.

### C-4 · Basis grading on every clock and figure

**What.** Every window, condition and figure carries a `basis` of `Statute | HMRC guidance | Practice assumption | Stated in source, unverified`, and anything not in the first two categories renders differently and **cannot become a live control until a named person verifies it**.

**Basis.** The source note flags at least four of its own propositions as needing checking before use, including a relief allowance figure said to apply from April 2026 and the origin of a six-month loan-note holding period which the note itself lists as possibly statutory, possibly a clearance condition, possibly market practice.

**Why this is effective.** This is the highest-leverage change in the set and the cheapest. Training notes, webinar summaries and AI-extracted conditions all arrive with mixed reliability, and the current record has no way to say so — everything looks equally load-bearing once it is a row in a register. Grading the basis is what allows the product to ingest fast-moving material *at all* without laundering it into apparent certainty. It also composes with the existing controlled-rules model: a graded item is exactly a candidate that has not yet earned a rule version.

**Rejected alternative.** A free-text "confidence" note. Rejected — unenforceable, and it does not gate anything.

### C-5 · Fiscal-event exposure tag

**What.** A position may be tagged as depending on a rule that could change at a named future fiscal event, with an anti-forestalling risk flag where the planning depends on the *shape* of legislation not yet written.

**Basis.** The commercial thesis of the entire source is that a window exists because current rules are known and future ones are not; and the material describes how anti-forestalling legislation introduced alongside a rate change can reset the effective disposal date to the date of an election, defeating a strategy that relied on electing later.

**Why this is effective.** One list, produced instantly on the day of a fiscal event, of every position whose treatment or rate assumption has just moved. The repo already has the mechanism for this against *approved* rule versions (`/rule-impact`); this points the same idea at *pending* change. It is a tag, not an object, because it carries no clock of its own.

### C-6 · Two trigger rules added to the event taxonomy

Cheap additions to the SPEC-004 event mapping, both straight from the material:

- **Share exchange → analysis required for every participating shareholder.** The material states the previous exclusion for holdings below 5% has been removed. Operationally this is a *population* change, not a technical one: the list of people who need looking at grows to everyone in the exchange. The event mapping should say so at the moment the exchange is recorded.
- **Partial gift of shares → valuation on a loss-to-donor basis.** Transfer of value is measured by the reduction in the donor's estate, which can exceed the standalone value of the shares given away where control or class rights change. The trigger fires a valuation request rather than a conclusion.

### C-7 · Flagship workflow — the historic election sweep

**What.** A defined-population review: every shareholder who, since 5 April 2024, exchanged shares, received rollover equity, had a holding company inserted, participated in a reorganisation, or received buyer loan notes or securities. For each, the record holds transaction and tax-year dates, base cost, market value and consideration, cash received, replacement equity received, whether tax-neutral exchange treatment applied, relief availability and remaining lifetime allowance, the election window and its close date, the expected treatment of the replacement equity, cash available to fund tax, and the current value of the replacement shares.

**Basis.** The material identifies this as the immediate practical action and effectively specifies the data structure for it. Because the deadline runs to the second 31 January after the tax year of the exchange, **transactions that completed up to two and a half years ago still have open windows.**

**Why this is effective.** It is the rarest thing in a workflow product: a backlog with a hard expiry that nobody currently holds. It needs no new integration, it uses facts the group already has in its transaction files, and it produces a ranked list where every row is a decision that is either worth taking or is about to close by default. It is also the honest demonstration of C-1 through C-4 working together — windows, durational conditions, the funding check and basis grading all appear on the same screen because the work genuinely requires all four.

---

## Commercial framing — and the buyer tension

This must be said plainly rather than assumed away.

The source is **sell-side adviser** material, and shareholder CGT planning is *personal* tax for founders and management. The buyer chosen in `INITIAL_BUYER_ANALYSIS_2026-07.md` is the **in-house Head of Tax** of a £200m–£750m UK group, whose own taxes are corporate.

Two defensible readings:

1. **In-house, transaction-adjacent (consistent with the current product).** The Head of Tax owns this the moment their group is bought, sold or reorganised with management rollover: dozens of individuals acquire securities, elections fall due, the company's own reporting depends on those individuals acting, and the company carries the operational risk when they do not. This is the same shape as the incentives work already built, and it needs no repositioning.
2. **Adviser-side, as a client-portfolio sweep.** The historic election review is most valuable to whoever holds the *population* — a transactions tax team with a client list. That is a different buyer with a different sales motion, and the buyer analysis explicitly parked advisers as a later channel rather than the initial product.

**Recommendation: build the primitives, demonstrate them through reading (1), and treat (2) as a named channel option rather than a pivot.** The four objects are identical either way; only the population source differs. Reversing into (2) costs a demo and a data-import path, not an architecture.

## Boundary

Nothing here concludes on any tax treatment, verifies any figure or constitutes advice. Every statutory proposition drawn from the source retains the source's own uncertainty, which is the point of C-4. Responsibility for elections, claims, returns and deadlines remains with the taxpayer and their advisers.
