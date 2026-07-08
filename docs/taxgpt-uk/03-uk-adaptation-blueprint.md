# Reproducing TaxGPT for UK Tax Law — Step-by-Step Blueprint

Goal: rebuild the TaxGPT pipeline (doc 01) for UK tax, correcting the dated parts (doc 02), in a
shape that feeds Quarterday (doc 04). Working name: **quarterday-model** — the empty
`abdulkhaderahmed/quarterday` repo is the natural home for this pipeline (see doc 04 §5).

---

## 1. The structural difference you must design around

The US has *one* codified tax title (IRC Title 26) in one XML file. The UK does not have a tax code —
it has **many Acts amended annually by Finance Acts**, plus statutory instruments, plus HMRC's
interpretive manuals. This changes the data model in two ways:

1. **Multi-act corpus.** Your "section" identifier must be `(act, section)` not just `section`:
   s 455 CTA 2010 ≠ s 455 ITA 2007.
2. **Point-in-time versioning is a gift.** Unlike the US pipeline (which had to bolt on TCJA
   amendment notices and inflation JSONs), **legislation.gov.uk serves *revised/consolidated*
   text with point-in-time views**. Build version-awareness in from day one: every extracted
   section carries `valid_from` / `valid_to` and the retrieval layer filters by the tax period
   in question.

## 2. Step 1 — Corpus acquisition (the `parse_irc.py` analog)

**Primary statutes** — legislation.gov.uk publishes CLML (Crown Legislation Markup Language) XML
under the Open Government Licence. Each act is fetchable as XML, e.g.
`https://www.legislation.gov.uk/ukpga/2010/4/data.xml` (CTA 2010); section-level and
point-in-time URLs are also supported. Start with the acts Quarterday's seeded obligation rules
already imply (CT600, CT payment/QIPs, VAT, P11D/P11D(b), ERS):

| Act | Covers | Priority |
|---|---|---|
| CTA 2009, CTA 2010 | Corporation tax (incl. s 455, losses, groups) | 1 |
| TMA 1970 + FA 1998 Sch 18 | Administration, CT self-assessment, filing/penalties | 1 |
| VATA 1994 (+ VAT Regulations SI 1995/2518) | VAT | 1 |
| ITEPA 2003 (+ PAYE Regs SI 2003/2682) | Employment income, benefits (P11D), ERS | 1 |
| FA 2008 Sch 36, FA 2009 Schs 55/56 | Information powers, late-filing/late-payment penalties | 1 |
| ITA 2007, ITTOIA 2005 | Income tax | 2 |
| TCGA 1992 | Capital gains | 2 |
| IHTA 1984 | Inheritance tax | 3 |
| Corporation Tax (Instalment Payments) Regulations SI 1998/3175 | QIPs | 1 |
| Annual Finance Acts | Rates + amendments | rolling |

Write `parse_clml.py` mirroring `parse_irc.py`: extract `{act, section, heading, text,
version_date, uri}` → `data/processed/uk_sections.jsonl`. CLML is more complex than USLM
(amendment annotations, extent notes) — strip commentary nodes the way TaxGPT strips embedded tables.

**Secondary interpretive corpus** — HMRC internal manuals (CTM, EM, VATREG, EIM, ERSM, CA, CIRD…)
are on GOV.UK under OGL and fetchable via the GOV.UK Content API
(`https://www.gov.uk/api/content/hmrc-internal-manuals/<manual>/<page>`). These are the UK analog of
the 26 CFR stage and are *more* practitioner-relevant than the statutes for many Quarterday
workflows. Parse to `{manual, page_id, heading, text, url}`.

**Reference data (the `inflation_adjusted_amounts.json` analog)** — build
`data/reference/uk_rates_thresholds.json` per tax year from GOV.UK "Rates and thresholds for
employers" and the annual Finance Act: CT main/small-profits rates and marginal relief limits,
VAT registration/deregistration thresholds, AIA/full-expensing limits, personal allowance and bands,
NIC classes, official rate of interest, R&D (merged scheme) rates, ATED bands, etc. Keyed by tax
year, with statutory source per figure. **This file is also directly useful to Quarterday's
deterministic calendar engine, independent of any ML.**

**Citation grammar (the `citation_utils.py` analog)** — UK citations are messier than `§`:
`s 455 CTA 2010`, `section 1046 CTA 2009`, `Sch 36 FA 2008 para 1`, `reg 69 SI 2003/2682`,
`VATA 1994 s 4(1)`. Write `uk_citation_utils.py` with one canonical regex + normalizer
(act-name aliases → canonical act IDs), shared by generator, reward, evaluator, and — later —
Quarterday's `statutoryBasis` validator. This single module is the highest-leverage artifact of the
whole build.

## 3. Step 2 — Retrieval layer FIRST (correcting TaxGPT's biggest mistake)

Before any fine-tuning, index the corpus for RAG:

1. Chunk sections/manual pages (~1–2K tokens, keep `(act, section)` metadata + version dates).
2. Embed with an open model (e.g. `bge-m3` or `all-MiniLM` class) into **pgvector in the same
   Postgres Quarterday already runs** — no new infra.
3. Hybrid retrieval: BM25 (Postgres full-text) + dense, fused (RRF), exactly the TaxSphere pattern.
4. Answer template: *retrieve → answer only from provided sections → cite `(act, section)` →
   abstain if not found*.

A frontier or open model with this retriever will already beat weights-only TaxGPT on freshness and
verifiability. **Fine-tuning then becomes an optimization** (citation discipline, UK style, schema
adherence, offline/private serving) rather than the knowledge store.

## 4. Step 3 — Grounded data generation (the v2 recipe, UK-ified)

Mirror `generate_grounded_data.py` with the same seven safeguards from doc 01 §3:

- Generator reads the *actual* section/manual text; Q&A must cite it.
- **Post-generation validation:** primary citation must match the source `(act, section)` — use
  `uk_citation_utils.py`.
- **Version notices:** where legislation.gov.uk marks prospective/repealed text, inject an
  amendment notice into the generation prompt (the TCJA-notice analog).
- **Rates with caveats:** generate current-figure examples from `uk_rates_thresholds.json`, always
  caveated with tax year.
- **Hard-negative DPO:** subtly wrong versions (wrong deadline, wrong act, right section wrong
  subsection, prior-year threshold), with `metadata.error_introduced`.
- **Importance tiers:** Tier 1 = what Quarterday users touch (CT600 filing s 55 FA 1998 Sch 18,
  QIPs SI 1998/3175, VAT registration VATA 1994 Sch 1, P11D ITEPA 2003 ss 63–96 + reg 85 SI
  2003/2682, ERS annual returns ITEPA 2003 Pt 7 s 421J(3), s 455 CTA 2010, R&D CTA 2009 Pt 13,
  capital allowances CAA 2001). Upsample these.
- **Manifest per dataset version**, fixed seed, zero train/eval overlap.

Cost note: TaxGPT generated ~17K grounded pairs from ~2.1K sections with GPT-4o-mini via the Batch
API. A UK Tier-1 corpus is of similar magnitude; budget accordingly and reuse its batch scripts
(`simple_batch_prep.py` / `wait_and_download.py` port almost unchanged).

## 5. Step 4 — Training (modernized)

- **Base model:** current Qwen3-class 4B–8B instruct (Apache-2.0) — not Qwen 2.5 3B. If you train on
  a Mac, MLX still works; otherwise Unsloth/Axolotl (TRL + PEFT, QLoRA) on a rented GPU
  (TaxGPT's own `runpod-cloud-training-research.md` has the cost table).
- **Context:** ≥8K training context (statutes cross-reference heavily; 2,048 was a real handicap).
- **Stages:** same SFT → DPO → GRPO ordering and conservative hyperparameters (doc 01 §§4–6 are a
  good starting grid). Train the model to answer *from provided context* (RAG-formatted SFT
  examples: context block + question → cited answer), not from memory.
- **GRPO rewards, hardened:**
  - `citation_accuracy` / `citation_format` via `uk_citation_utils.py` (0.45 combined, as in v4);
  - `factual_accuracy` = numbers must match reference *and* the correct tax year (0.30);
  - replace the naive length reward with a **grounding reward**: penalize claims not attributable
    to the provided context;
  - make abstention correct when the context lacks the answer (fixes doc 02 issue 8);
  - optional cheap LLM-judge pass for reward-hacking audits.

## 6. Step 5 — Evaluation (the SteuerEx lesson)

Build a UK benchmark *before* training, and gate every model version on it:

1. **Citation set (~200 Q):** "Which provision governs X?" — auto-scorable with the citation utils.
2. **Figures set (~100 Q):** deadlines, rates, thresholds by tax year — auto-scorable against
   `uk_rates_thresholds.json`.
3. **Scenario set (~50 Q):** Quarterday-shaped cases ("large company, first period over threshold —
   QIP dates?") — scored statement-level with partial credit, LLM-judge + spot human review.
   ⚠️ Do not scrape CIOT/ATT exam papers wholesale — they are copyrighted; write your own items
   *modelled on* their format, or use HMRC manual worked examples (OGL).
4. Keep v1/v2/v3 side-by-side transcripts like `outputs/evaluation/v1_v2_v3_comparison.txt` —
   the most useful debugging artifact in the TaxGPT repo.

## 7. Step 6 — Serving

- **Local/private:** fuse → GGUF Q4_K_M → Ollama (reuse `export_to_ollama.py`; watch the
  chat-template mismatch documented in `ollama-vs-mlx-debug-2026-03-31.md`).
- **In-app (Quarterday):** the extraction path stays on structured-output APIs for now (doc 04),
  with the fine-tuned open model as an optional privacy-tier provider behind the same interface.

## 8. Sequenced plan with exit criteria

| Phase | Work | Exit criterion |
|---|---|---|
| 0 (wk 1) | `parse_clml.py`, `uk_citation_utils.py`, `uk_rates_thresholds.json` (Tier-1 acts) | 95%+ of Tier-1 sections parse clean; citation regex round-trips a hand-built 100-citation test file |
| 1 (wk 2) | pgvector index + hybrid retrieval + RAG answer template | Retrieval hit-rate ≥90% on the citation eval set |
| 2 (wk 3–4) | Grounded SFT/DPO data gen + manifests + eval benchmark v1 | ≥10K validated pairs, 0 citation-leak failures; benchmark frozen |
| 3 (wk 5–6) | SFT → DPO; eval; iterate | Beats base model on citation set by ≥20 pts, no regression on abstention |
| 4 (wk 7+) | GRPO with hardened rewards; on-policy DPO from logged failures | Beats DPO checkpoint on figures set; no reward-hacking found by judge audit |
| 5 | GGUF/Ollama export + Quarterday provider integration (doc 04) | Same extraction eval pass-rate as GPT-4o on the review-queue benchmark |

Phases 0–1 deliver standalone value to Quarterday (validated citations, rates data, retrieval for
reviewers) even if you never train a model. Do them first regardless.
