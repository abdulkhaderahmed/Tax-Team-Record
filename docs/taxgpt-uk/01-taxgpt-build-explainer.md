# TaxGPT Build Explainer — Every Choice, Step by Step

Source analyzed: `abdulkhaderahmed/TaxGPT` (fork of `dennisonbertram/TaxGPT`), as of commit `f5387c3`
("docs: rewrite README with layperson intro + watercolor header"). The repo fine-tunes
**Qwen 2.5 3B Instruct** on the US Internal Revenue Code (IRC Title 26 + 26 CFR Treasury
Regulations) via **SFT → DPO → GRPO**, entirely on Apple Silicon (MLX), exporting to GGUF/Ollama.

This document walks the pipeline in execution order and explains *why* each choice was made
(citing the repo's own `docs/investigations/` notes where the author documented reasoning).

---

## 0. Project intent and constraints

From `docs/context/current-intent.md`:

- **What:** fine-tune a small local LLM on the IRC using SFT then RL (DPO/GRPO), deploy via Ollama.
- **Why:** a test/demonstration of *local post-training and RL* on domain legal text — not a product.
- **Hard constraints:** 41 GB free disk, Apple M4 Max / 128 GB unified memory, must run entirely
  locally, final artifact must be usable through Ollama.

Almost every downstream choice (model size, MLX, LoRA, quantized export) follows from those four
constraints. Keep that in mind when judging it: it optimizes for "runs on one Mac", not for accuracy.

## 1. Choice: base model = Qwen 2.5 3B Instruct

- **Why:** small enough to train and serve on a laptop; Apache-2.0 licensed; strong
  instruction-following for its size; excellent MLX support. The repo later explored scaling
  (`docs/investigations/scaling-to-larger-models.md` shows a memory model concluding 32B bf16 LoRA
  is "tight" at ~85 GB and 14B is comfortable; `outputs/32b/` shows a 32B SFT/DPO run was actually
  attempted) and evaluated **Qwen3.5-27B** as a successor
  (`docs/investigations/qwen3.5-27b-evaluation.md`).
- **Trade-off accepted:** a 3B dense model cannot *reliably memorize* a statute corpus of this size.
  The README is honest about this: it is trained for **citation accuracy on specific provisions**,
  not open-ended planning.

## 2. Choice: corpus = the primary law itself, parsed from government XML

Scripts: `scripts/download_data.sh`, `scripts/parse_irc.py`, `scripts/parse_cfr.py`.

- **IRC Title 26** is downloaded as USLM-schema XML (`data/raw/irc/usc26.xml`) and parsed with
  `lxml`, extracting only **top-level sections** (`/us/usc/t26/sNNN` identifiers), skipping embedded
  HTML tables, collapsing whitespace → `data/processed/irc_sections.jsonl` (~2,113 sections).
- **26 CFR** (Treasury Regulations) parsed similarly → ~6,149 regulation sections.
- **Why:** training on statutes rather than commentary gives verifiable ground truth and a public
  domain license. Section-level granularity gives each training example a citable anchor —
  the foundation of the whole "reward citations" strategy.

## 3. Training data: the v1 mistake and the v2 fix (the most instructive part of the repo)

### v1 — template generation (deprecated)
`scripts/generate_training_data.py` wrapped raw section text in boilerplate questions
("What does IRC Section X say about Y?") and used truncated source text as answers, producing
27,600 SFT examples, 10,181 DPO pairs, 26,899 GRPO prompts.
`docs/investigations/rag-grounded-training-data-research.md` diagnoses the failure precisely:

> "the training data doesn't teach the model to reason about tax law — it teaches it to
> regurgitate truncated text… When the fine-tuned model encounters questions that don't match
> these templates, it hallucinates." (estimated **15–30% hallucination rate**)

### v2 — grounded, citation-validated generation
`scripts/generate_grounded_data.py` (851 lines) regenerates data with **GPT-4o-mini reading the
actual section text** and producing genuine Q&A, then applies post-generation validation:

1. **Cross-section leak check** — discard any pair whose primary citation ≠ source section.
2. **TCJA amendment notices** injected into prompts for modified sections.
3. **Inflation-adjusted amounts** handled at prompt level, plus a dedicated reference dataset
   (`data/reference/inflation_adjusted_amounts.json`, built from Rev. Proc. 2023-34 / 2024-40 —
   standard deduction, §179 limits, brackets, 401(k)/IRA/HSA limits, estate/gift exclusions, AMT, EIC)
   and a generator (`scripts/generate_inflation_training_data.py`) that teaches current-year figures
   *with caveats*.
4. **Hard-negative DPO pairs** — rejected answers are *subtly wrong* versions of the correct text,
   with the introduced error documented in `metadata.error_introduced` (vs v1's lazy "consult a
   professional" rejections).
5. **On-policy DPO** (`scripts/generate_onpolicy_dpo.py`) — chosen = grounded correct answer,
   rejected = **the model's own hallucinated output**. Only 86 pairs, but the highest-signal data
   in the repo: it corrects observed failure modes rather than hypothetical ones.
6. **Section importance weighting** (`scripts/apply_importance_weighting.py`,
   `data/reference/section_tiers.json`) — Tier 1 high-traffic sections (§1, 61, 162, 179, 199A,
   401, 1031…) are upsampled; obscure sections downsampled.
7. **Manifest discipline** — `data/train_v2/MANIFEST.md` documents provenance of every split,
   seed 42, 90/10 split, zero train/eval overlap, `metadata.grounded=true` on 100% of records.

Every one of these seven mechanisms transfers directly to a UK build (see doc 03).

### Generation infrastructure
Bulk generation uses the **OpenAI Batch API** (`simple_batch_prep.py`, `submit_inflation_batch.py`,
`wait_and_download.py`, `check_batch.sh`) for 50% cost reduction, plus a **Tavily web-search
harvester** (`tavily_harvester.py`, 1,217 lines; `tavily_complete_generation.py`) to enrich data with
real-world context. `docs/investigations/rag-grounded-training-data-research.md` also comparison-shops
generator models (Kimi K2.5 at $0.60/M input vs GPT-4o at $2.50/M), concluding: generate cheap,
validate with a stronger model.

## 4. Stage 1 — SFT (`scripts/train_sft.py`, `configs/sft_config.yaml`)

| Choice | Value | Why |
|---|---|---|
| Framework | `mlx_lm.lora` | Native Apple Silicon; no CUDA available |
| Method | LoRA, rank 32, alpha 32, dropout 0.05, 16 layers | ~0.1–2% trainable params → optimizer state fits in unified memory |
| Precision | bf16, **no quantization** during training | Quality; quantize only at export |
| Schedule | 1,000 iters, batch 4, lr 1e-5 cosine decay, 50 warmup | Conservative; validated every 100 steps, checkpoint every 200 |
| Context | **2,048 tokens** | Memory ceiling on-device — a significant limitation (see doc 02) |
| Memory | gradient checkpointing on | Trades speed for memory |

## 5. Stage 2 — DPO (`scripts/train_dpo.py`, `configs/dpo_config.yaml`)

- Initializes **from the SFT adapter** (correct ordering: preference-tune the domain model, not the base).
- Smaller LoRA rank (16) and lower LR (5e-6): DPO is a *refinement* stage; large updates destroy the SFT knowledge.
- `beta = 0.1` (standard KL penalty), batch 2 (chosen+rejected doubles memory), 500 iters, 1,024 ctx.
- Data: the grounded hard-negative pairs + on-policy pairs described above.
- **What DPO buys here:** preference for precise, citation-grounded phrasing over vague hedging.

## 6. Stage 3 — GRPO (`scripts/train_grpo.py`, `scripts/grpo_reward.py`, `configs/grpo_config.yaml`)

GRPO = sample K completions per prompt, score each with a *programmatic* reward, reinforce
above-group-average completions. **No reward model, no human labels** — the reward is pure code:

```
reward (v4 weights):
  factual_accuracy  0.30   # numbers in response match reference answer numbers
  citation_accuracy 0.25   # cites the *correct* IRC/CFR section for the question
  citation_format   0.20   # cites at all, in canonical §-format
  length            0.15   # sufficiently detailed
  vague_penalty     0.10   # deduction for "consult a tax professional…" boilerplate
```

- A canonical citation regex lives in one shared module (`scripts/citation_utils.py`) used by the
  reward, the evaluator, and the on-policy DPO generator — a fix from the active plan
  (`docs/plans/active-plan.md`, TASK-003) after regex drift caused reward failures.
- Hyperparameters: group size K=4, temperature 0.8, PPO clip ε=0.2, KL coeff 0.01, lr 1e-6 constant,
  300 iters, batch 1 prompt/step. Adapter init picks best available: grpo > dpo > sft.
- **Why GRPO:** citation correctness is *mechanically verifiable*, which is exactly the situation
  where RL with verifiable rewards (RLVR) shines. This is the same recipe DeepSeek-R1 popularized.

## 7. Evaluation (`scripts/evaluate.py`, `evaluate_models.py`, `outputs/evaluation/`)

- A formal **50-question eval** (`formal_50q_eval.txt`) plus v1/v2/v3 side-by-side comparisons
  (`v1_v2_v3_comparison.txt`) with per-question transcripts.
- Metrics mirror the reward: citation presence/accuracy and factual numbers.
- Notable: the eval transcripts still show classic small-model failures (e.g. describing §21 as the
  "qualified child" provision; stale §179 limits) — evidence for the freshness critique in doc 02.

## 8. Review loops — the repo's secret weapon

The repo institutionalized **adversarial review by a stronger model**: six iterations of
`docs/investigations/gpt54-training-review*.md` (driven by `scripts/gpt54_review.py` and
`send_review_v2.py`), each producing CRITICAL/HIGH findings that were then fixed in commits
(e.g. `690a0cf "fix: v6 pipeline review — GRPO init order, LoRA guard, dataset paths"`).
The v6 review found pipeline-blocking bugs (hard-coded dataset paths bypassing the v5 splits;
an ineffective "LoRA already applied" guard risking double-wrapping on resume).
`CLAUDE.md` makes this policy explicit: consult a frontier model for architecture/hyperparameter/
data decisions. This "cheap local trainee + expensive frontier reviewer" pattern is worth copying.

## 9. Export & serving (`scripts/export_to_ollama.py`)

- Fuse LoRA adapters into base weights → convert to **GGUF Q4_K_M** → register an Ollama Modelfile →
  `ollama run irs-tax-qwen`. Adapters and GGUFs are also pushed to HuggingFace
  (`upload_v2_to_hf.py`, `upload_v3_to_hf.py`, `upload_v5_adapters.py` — v1/v2/v3 model cards exist).
- `docs/investigations/ollama-vs-mlx-debug-2026-03-31.md` records a real debugging session on
  MLX-vs-Ollama output divergence (chat-template/quantization mismatches) — a known pain point of
  this export path.

## 10. The pipeline as a whole

```
gov XML (IRC + CFR)
  → parse to sections.jsonl                       (deterministic)
  → GPT-4o-mini grounded Q&A gen + validation     (synthetic but citation-verified)
  → + inflation reference JSON + tier weighting   (curated reference data)
  → SFT (LoRA r32) → DPO (hard negatives + on-policy) → GRPO (verifiable rewards)
  → eval (50q citation/factual)                   (regression gate)
  → fuse → GGUF Q4_K_M → Ollama                   (local, offline serving)
```

**The durable insight:** treat the *statute section* as the atomic unit — parse it, generate from it,
validate citations against it, reward citations to it, and evaluate citations of it. Everything else
(model choice, MLX, quantization) is swappable plumbing. Doc 02 assesses which parts have aged;
doc 03 rebuilds this for UK law; doc 04 wires it into Tax-Able.
