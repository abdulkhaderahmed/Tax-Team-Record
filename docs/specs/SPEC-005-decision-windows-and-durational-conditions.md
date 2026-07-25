# SPEC-005 — Decision windows, durational conditions and the election sweep

Status: specified; demo surface built at `/demo/positions`; data model not built · Depends on: SPEC-004 · Basis: `docs/research/TRANSACTION_POSITIONS_SELECTION_2026-07.md`

## Problem

SPEC-004 models an obligation: a thing you must do by a date. Transaction and shareholder tax work is not mostly made of those. It is made of **positions that stay open**, and the record cannot hold them:

- an election that can be made, amended or **revoked**, where doing nothing produces a specific default outcome;
- a fact that must **remain true for a period** — a holding period, a survivorship period, a minimum term before redemption — which a foreseeable commercial event will break;
- a deliberate crystallisation that is beneficial **only if there is cash to pay for it**;
- a clock whose length is asserted by a training note rather than by statute, and which the record currently promotes to a control without saying so.

The consequence is a class of failure the product cannot currently see: **a window closes and the default applies, and nothing anywhere recorded that a decision was being made by inaction.**

## Part A — `DecisionWindow`

Distinct from `Obligation`. Attaches to a position (a treatment claimed or applied).

```
DecisionWindow
  positionId
  kind            Make | Amend | Claim | Revoke
  opensOn, closesOn
  clockBasis      the deadline in words, e.g. "second 31 January following the tax year of the exchange"
  basis           Statute | HMRC guidance | Practice assumption | Stated in source, unverified   (Part D)
  defaultOutcome  what happens if nobody acts — REQUIRED, non-empty
  blockedBy[]     facts still needed before the choice can be made
  decisionMaker   often an individual or trustee, not the group entity
  consequences[]  effects of acting, acting late, or reversing (e.g. interest from the original due date)
  status          Open | Decided | Closed by default | Not applicable
```

Rules:
- `defaultOutcome` is mandatory. A window without a stated consequence of inaction is not a control and must fail validation.
- Windows are surfaced by **days remaining against the length of the window**, not by absolute date, so a window that has been open two years and closes in six months ranks appropriately against one that opened yesterday.
- Closing a window as `Closed by default` is an explicit, reasoned, audited event — never a silent state change on a date passing.

## Part B — `DurationalCondition`

```
DurationalCondition
  subject         what must remain true
  startsOn, duration
  breakingEvents[]  events that end the condition early
  onBreach        consequence if broken
  monitoredFacts[]  what has to be watched, and by whom
  basis           as Part D
  status          Running | Satisfied | Broken | At risk
```

The operative feature is **testability against a proposed date**: given a candidate transaction date, the register answers which conditions that date would break. That is the difference between recording a risk and being able to answer "can we sign in March".

## Part C — Funding check

Two recorded, source-attributed figures on any deliberate crystallisation — tax estimate and cash expected available at the relevant date — plus `asAt` and a status of `covered | short | not established`. **No calculation.** The figures come from whoever modelled them; the product reconciles and flags, exactly as it already reconciles signed consideration against a supported valuation.

## Part D — Basis grading

Every window, condition and figure carries `basis`. Anything graded `Practice assumption` or `Stated in source, unverified`:

- renders visually distinct from statutory clocks;
- cannot gate a control or block a sign-off until verified;
- carries a named verifier and a verification date once cleared;
- appears in a "needs verification" queue.

This composes with the existing controlled-rules model: a graded item is a candidate that has not yet earned a `TaxRuleVersion`. It is what allows fast-moving material — a briefing note, a webinar summary, an AI-extracted condition — to enter the record without being laundered into apparent certainty.

## Part E — Fiscal-event exposure

A tag, not an object: `exposedTo` (a named future fiscal event) and `antiForestallingRisk` (boolean, for planning that depends on the shape of legislation not yet drafted). Produces one list on the day of a fiscal event: every position whose rate or treatment assumption has just moved. Reuses the existing `/rule-impact` review mechanism, pointed at pending rather than approved change.

## Part F — The election sweep

A defined-population review over transactions since a cut-off date where shareholders received replacement shares or securities. Per row: transaction and tax-year dates, base cost, consideration and market value, cash received, replacement equity received, whether tax-neutral treatment applied, relief availability and remaining lifetime allowance, window close date, expected treatment of the replacement equity, cash available, and current value of the replacement equity.

Ranked by **days remaining**, then by whether the funding check passes. Every row resolves to one of: decision taken, decision not worth taking (recorded with a reason), or blocked pending a named fact.

## Two additions to the SPEC-004 event taxonomy

| Event | Added consequence |
|---|---|
| Share exchange | Anti-avoidance analysis required for **every participating shareholder**, not only material holdings — a population change, fired when the exchange is recorded |
| Partial gift of shares | Valuation request on a **loss-to-donor** basis (donor's holding valued immediately before and after), not a standalone valuation of the shares transferred |

## Exit criteria

| # | Criterion |
|---|---|
| 1 | A window cannot be saved without a stated default outcome |
| 2 | A window passing its close date becomes `Closed by default` only through a reasoned, audited action — never silently |
| 3 | Given a proposed transaction date, the conditions register returns exactly the conditions that date would break |
| 4 | An item graded `Stated in source, unverified` cannot block a sign-off until a named verifier clears it |
| 5 | The sweep ranks by days remaining and every row terminates in decision, reasoned no-decision, or a named blocking fact |
| 6 | No screen in this spec displays a figure the product computed |

## Counterfactuals

- **Modelling windows as obligations with a type flag** — rejected; obligation status vocabulary cannot express "closed by default", and default-outcome and reversibility have no meaning on an obligation.
- **Reusing the tripwire register for durational conditions** — rejected; a tripwire has no duration and no breaking-event set, so it cannot be tested against a date.
- **Building a gain/rate/relief model to drive the funding check** — rejected under D-011; the figures arrive from the adviser's model, and re-deriving them creates reliance risk for no gain.
- **A free-text confidence note instead of basis grading** — rejected; unenforceable and gates nothing.
