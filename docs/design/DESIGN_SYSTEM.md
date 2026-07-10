# Tax-Able design system v1 — "calm professional"

Decision basis: D-007 (ships as tokens + HTML reference, not Figma), D-008 (calm professional SaaS). Reference implementation: `dashboard-mockup.html` (open in a browser). Consumers: Devin/Replit applying this to `artifacts/tax-able/app/globals.css`.

## Principles
1. **Chrome is monochrome; colour means state.** The interface is warm greys and ink. Saturated colour appears only as semantic status (overdue/due-soon/on-track/in-review) — so colour is information, never decoration. A compliance product must make red mean something.
2. **Numbers are typography's first citizens.** Deadlines, counts and amounts always render with tabular numerals (`font-variant-numeric: tabular-nums`) so columns align and scanning is effortless.
3. **Dense but breathable.** Registers are tables; tables are compact (13px, 10px/12px cell padding) while page chrome stays generous (24–32px gutters). Density lives in the data, not the frame.
4. **Trust details.** Every AI-derived element is visibly labelled (chip: "AI draft"); every register row can show its source. The UI restates the product promise.

## Tokens (CSS custom properties — drop into `globals.css`)
```css
:root {
  /* surfaces */
  --canvas: #FAFAF8;        /* app background — warm off-white */
  --surface: #FFFFFF;       /* cards, tables */
  --surface-sunken: #F4F4F1;/* wells, empty states */
  --border: #E8E6E1;        /* hairlines */
  --border-strong: #D6D3CC;

  /* text */
  --ink: #1B1C1E;           /* primary text */
  --ink-secondary: #55575C; /* labels, secondary */
  --ink-tertiary: #8A8D93;  /* meta, timestamps */

  /* brand */
  --brand: #0F5D5A;         /* Tax-Able teal — links, primary buttons, active nav */
  --brand-hover: #0B4E4B;
  --brand-tint: #E7F1F0;    /* selected states, focus tints */

  /* semantic status (text/bg pairs) */
  --overdue: #B42318;    --overdue-bg: #FEF3F2;
  --due-soon: #B54708;   --due-soon-bg: #FFFAEB;
  --on-track: #067647;   --on-track-bg: #ECFDF3;
  --in-review: #175CD3;  --in-review-bg: #EFF8FF;
  --neutral-chip: #55575C; --neutral-chip-bg: #F2F2EF;

  /* geometry */
  --radius-card: 10px; --radius-control: 7px; --radius-chip: 999px;
  --shadow-card: 0 1px 2px rgba(27,28,30,.05);
  --shadow-pop: 0 4px 16px rgba(27,28,30,.10);

  /* type */
  --font-ui: "Inter", -apple-system, "Segoe UI", system-ui, sans-serif;
}
```

## Type scale
| Role | Size/weight | Notes |
|---|---|---|
| Page title | 20px / 600 | One per page; letter-spacing -0.01em |
| Section/card title | 14px / 600 | Sentence case, never all-caps except tiny labels |
| Body / table cells | 13.5px / 400 | Line-height 1.5 |
| KPI numerals | 26px / 600 | tabular-nums; label 12px/500 `--ink-secondary` |
| Meta / timestamps | 12px / 400 | `--ink-tertiary` |
| Micro-labels (chips, column heads) | 11px / 600 | Uppercase, letter-spacing .04em, `--ink-secondary` |

Load Inter via `next/font` (self-hosted; no CDN flash). Font features: `"cv05","cv08"` optional; tabular-nums mandatory in tables/KPIs.

## Components (canonical forms in the mockup)
- **App shell:** 232px left sidebar (`--surface`, hairline right border): product mark, nav items (13.5px; active = `--brand-tint` bg + `--brand` text + 2px left bar), review count badge. Top bar: page title left; org switcher + user right. No global search until data volume demands it.
- **KPI card:** surface, hairline, radius-card, 16px padding; label above numeral; optional delta/status line.
- **Status pill:** chip radius, 11px/600, semantic pair (e.g., "Overdue · 2d" on `--overdue`/`--overdue-bg`).
- **Regime chip:** neutral pair (CT · VAT · PAYE · ERS · QIP); never coloured — regimes aren't states.
- **AI draft chip:** `--in-review` pair, prefixed with "AI draft" — mandatory wherever unconfirmed AI output renders.
- **Table:** column heads micro-label style on `--canvas` row; body rows on `--surface`, hairline separators, hover `#FBFBF9`; deadline column right-aligned tabular; row height ≈ 40px.
- **Buttons:** primary = `--brand` bg / white text; secondary = surface + border + ink; destructive reserved for true deletion. One primary per view region.
- **Focus:** 2px `--brand` ring at 40% + 1px offset — keyboard visible always.

## Application order (for Devin)
1. Tokens + font into `globals.css`; replace ad-hoc colours by mapping to nearest token (log unmapped originals in the PR).
2. App shell (sidebar + top bar) to match mockup.
3. Dashboard per mockup.
4. Tables/status pills across registers; AI-draft chips in extraction/review UIs.
Exit: no hex literals in component CSS outside the token block; `dashboard-mockup.html` and `/` visually match (within data differences).

## Accessibility floor
Text ≥ 4.5:1 on its background (all pairs above pass); status never conveyed by colour alone (pills always carry words); focus ring on every interactive element; table headers are real `th[scope]`.
