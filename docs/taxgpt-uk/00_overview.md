# taxgpt-uk — overview

Purpose of this folder: the reasoned integration analysis for adding a **UK tax knowledge layer** ("TaxGPT" in earlier notes) to Quarterday. Written fresh on 2026-07-08 after verifying that no prior `docs/taxgpt-uk` existed on any branch of this repo.

## The question
Quarterday's registers tell a tax team *what* they must do and *by when*. They don't answer "is this right?" — e.g., an extracted claim that the VAT registration threshold is £85k (stale; it's £90k), or an adviser deadline that contradicts statute. A knowledge layer would let the review queue check extracted items against cited, current UK tax reference material.

## The answer in one paragraph
"TaxGPT" as a brand points at three different things (see `01_candidate_assessment.md`); the only substantive integration target is **openaccountants/openaccountants** — an AGPL-3.0 open knowledge base of 1,000+ legislation-cited guides with ~20 UK skills, an MCP server, and a named-accountant verification program. The recommended integration (see `02_integration_architecture.md`) is a **runtime reference pane** on review items, consuming their hosted MCP read-only — no content copied into our database — plus adopting their *format pattern* (not their text) for our own Phase 3 corporate rules pack. One gate before any of it: a legal read of AGPL-3.0 + their LICENSE-ADDITIONAL.md (ROADMAP next-action #6).

## Why this matters strategically
Bloomberg Tax's positioning (D-003) defines the enterprise trust bar: verified primary-source grounding, citations on every answer, human sign-off, audit trails. Quarterday already has the sign-off and audit halves; a cited knowledge layer supplies the grounding half — and openaccountants' named-reviewer model is the same trust mechanism, open-sourced. Their UK coverage is individual/small-business (SA100 series); our corporate obligations domain (CT600, QIPs, Pillar 2, ERS, SAO) is exactly their gap — which creates a contribution/partnership angle rather than a competitive one.

## Files
1. `01_candidate_assessment.md` — the three "TaxGPT" candidates, evidence, license analysis.
2. `02_integration_architecture.md` — chosen architecture, phased, with counterfactuals.
