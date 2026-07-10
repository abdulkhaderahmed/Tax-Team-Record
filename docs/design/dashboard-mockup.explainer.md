# design/dashboard-mockup.html — explainer

## Purpose
Single-file, dependency-free reference implementation of the v1 design system applied to the app's most important screen. It is the visual contract for Devin/Replit when restyling `artifacts/tax-able` — open it in any browser next to the live app.

## Architecture
Pure HTML+CSS (no JS, no CDN fonts — system fallback stands in for Inter here; the app itself loads Inter via `next/font`). Tokens are copied verbatim from `DESIGN_SYSTEM.md` so drift between spec and reference is impossible at creation time. Layout: CSS grid shell (232px sidebar + main), KPI grid, 2-column content (deadlines table + review/audit stack). Demo data is deliberately *real-shaped*: P11D/ERS due 6 July 2026 render as genuinely overdue relative to the authoring date (8 July 2026), QIP instalment on the 14th echoes the product name, and the review items reprise real corpus defects (£85k vs £90k threshold, EMI disqualifying-event tripwire).

## Methodology
Design-as-code: the deliverable an AI implementer consumes best is working markup with tokens, not a picture. Every component named in DESIGN_SYSTEM.md §Components appears at least once, so the file doubles as a component inventory.

## Counterfactual analysis
- *Figma frames*: richer for human designers; rejected — user's seat is view-only (D-007) and the consumer is an agent that reads code. Reverses when a human designer joins.
- *React components in-repo*: closer to production; rejected for a mockup — it would need the app running to view, and would tempt premature refactors. The application step (Devin) does that translation deliberately.
- *Screenshot + prose spec*: cheapest; rejected because spacing/colour precision would be re-invented on implementation, defeating the token contract.
Re-read: holds. Risk is the mockup ossifying — treat DESIGN_SYSTEM.md as canonical and this file as regenerate-able.

## Known limitations & failure modes
No responsive/mobile pass (buyer uses desktop; revisit pre-pilot); no dark mode (out of scope v1); Inter not embedded so metrics differ slightly from production; interactive states (hover on rows/buttons) present but focus/keyboard flows only sketched via `:focus-visible`.

## Verification
Static file; verified by browser render + HTML parse on 2026-07-08. Reviewer: open in browser, compare against DESIGN_SYSTEM tokens; check contrast pairs (all ≥4.5:1 per spec).
