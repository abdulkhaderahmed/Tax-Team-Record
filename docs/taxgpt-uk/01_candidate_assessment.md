# Candidate assessment — what "TaxGPT" could mean

Assessed 2026-07-08. Methods: cloned and inspected both public repos; read skill files and MCP docs in full for openaccountants.

## Candidate 1 — VerisimilitudeX/TaxGPT · REJECT
GitHub repo, ~"GPT-4-Vision powered AI tax assistant". Inspection: an AP Computer Science Principles student submission (stated in the README's first line). Java/Gradle scaffold + a thin Python OpenAI call, a `training.jsonl`, US/IRS framing, no tests, no maintenance. Nothing to integrate — no engine, no data, no UK content.
**Lesson recorded:** the name matched, the substance didn't. Always clone and read before planning around a repo.

## Candidate 2 — taxgpt.com (commercial) · REFERENCE ONLY
Closed-source AI tax copilot for accountants/firms (primarily North America). Not integratable (no open API surface for our use case), and strategically it validates the "AI research copilot for tax professionals" category rather than helping us build. Track as market context in the competitive landscape doc, nothing more.

## Candidate 3 — openaccountants/openaccountants · ADOPT (gated)
What it is, verified by inspection:
- 1,000+ markdown "Guides" across 190+ jurisdictions; `skills/international/uk/` holds ~20 UK skills (SA100 income tax, VAT100, payroll, NI, dividends, CGT/SA108, rental/SA105, transfer pricing, statutory residence, non-dom, formation, financial statements, bookkeeping, payments on account, student loans, crypto, optimization, references).
- Quality (sampled `uk-vat-return.md` v2.0 in full): YAML frontmatter with `jurisdiction/tax_year/tier/last_updated/verified_by`; current figures (£90k registration / £88k dereg thresholds); primary-legislation citations (VATA 1994, SI 1995/2518, FA 2024/2025); **conservative defaults** for ambiguous classifications; red-flag thresholds for reviewer escalation; explicit year-applicability windows. This is professional-grade reference scaffolding, not scraped content.
- Verification model: named, credentialed accountants review complete guides on the public record (10/193 jurisdictions reviewed so far; UK currently `verified_by: pending`).
- Access surfaces: self-hosted MCP server (PyPI `openaccountants-mcp`, 6 read-only tools reading the open repo) and a **hosted MCP** (`openaccountants.com/api/mcp`) adding `get_rates`, `list_verifiers`, `compare_jurisdictions`, and `request_accountant_review` (routes a working paper to a named professional). Also ships a Claude plugin marketplace manifest.

### Fit against Tax-Able
| Need | Fit |
|---|---|
| Check extracted figures/deadlines against current cited reference | Strong — that is literally the guide format |
| UK corporate obligations depth (CT600, QIPs, Pillar 2, ERS, SAO, CbCR) | **Gap** — their UK set is individual/small-business; our Phase 3 pack covers this ourselves |
| Human escalation for judgment calls | `request_accountant_review` maps onto our exception queue's "adviser escalation" |
| Trust/positioning | Named-reviewer badges are the open-source version of the Bloomberg trust bar (D-003) |

### License analysis — the gate
AGPL-3.0 plus a `LICENSE-ADDITIONAL.md` (terms not yet legally reviewed by us). Working assumptions until counsel says otherwise:
- **Copying guide content into our product/database = copyleft exposure** for a commercial SaaS (AGPL §13 network clause). Do not do this.
- **Runtime consumption of their hosted MCP** (their software serving their content, our product displaying attributed excerpts) is the low-risk surface — comparable to calling any third-party API; attribution + linkback required as good citizenship regardless.
- **Adopting their format pattern** (frontmatter fields, tiering, conservative-defaults idea) with freshly authored text is not a license event — structure and facts aren't the protected expression; write our own words.
- Their hosted MCP is "the product" (their words) — expect commercial terms eventually; a partnership/contribution conversation (we author the UK corporate guides they lack, we get the verified layer) is the strategic play.

**Action (ROADMAP #6):** legal read of both license files before any content flows into the product. The architecture in `02` is designed to be safe under the strictest reading (arm's-length runtime, zero content at rest).
