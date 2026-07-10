# How Outdated Is TaxGPT? — An Honest Assessment (July 2026)

The fork's last substantive work is dated late March 2026 (data manifests 2026-03-27/28, final
review v6 2026-03-29). Three months is not long in calendar time, but the repo also embodies some
choices that were *already* conservative when made. Verdict up front:

> **The training methodology (SFT → DPO → GRPO with verifiable rewards) is still current best
> practice. The *strategy* — baking statutory knowledge into a small model's weights instead of
> retrieving it — is the genuinely dated part, and the repo's own investigation notes concede it.**

## Still modern (keep these)

1. **RL with verifiable rewards (RLVR).** Programmatic rewards for citation accuracy and factual
   numbers, no reward model — this is the DeepSeek-R1-style recipe and remains the standard way to
   post-train for domains with checkable answers. The v4 reward decomposition
   (factual 0.30 / cite-accuracy 0.25 / cite-format 0.20 / length 0.15 / vague-penalty 0.10) is
   sensible engineering.
2. **Hard-negative + on-policy DPO.** Rejected answers that are *subtly wrong*, and pairs built from
   the model's *own* logged hallucinations, are still exactly how practitioners build preference
   data. The on-policy set (86 pairs) is small but the mechanism is right.
3. **Grounded synthetic generation with post-hoc citation validation** and dataset manifests
   (provenance, seeds, zero split-leak checks). This is better data discipline than most 2026 repos.
4. **Frontier-model adversarial review loops** (six GPT-5.4 review rounds catching pipeline-blocking
   bugs). Cheap, effective, transferable.
5. **LoRA + local GGUF/Ollama serving** for a privacy-sensitive domain. Still the default local stack.

## Dated or already-superseded

1. **Knowledge-in-weights instead of RAG/tool-use — the core strategic problem.**
   Statutes change (Finance Acts, Rev. Procs, inflation adjustments). A weights-only model is frozen
   at training date; the repo's own band-aid (`inflation_adjusted_amounts.json` + caveat-laden
   training examples) proves the point, and its own research doc
   (`rag-grounded-training-data-research.md`) already frames RAG as the fix for hallucination.
   The 2026 consensus for legal/tax AI (see SteuerLLM's eval framing, TaxSphere, taxfill-mcp,
   openaccountants) is **retrieval-grounded generation + deterministic calculators**, with
   fine-tuning reserved for *style, citation discipline, and schema adherence* — not for storing law.
   Eval transcripts in `outputs/evaluation/` show the consequence: confidently stale §179 limits,
   §21 mis-described. A 3B dense model cannot memorize ~8,000 sections reliably; no amount of GRPO
   fixes a capacity problem.

2. **Base model generation.** Qwen 2.5 3B Instruct is a late-2024 model. The repo itself evaluated
   **Qwen3.5-27B** (Feb 2026: hybrid Gated-DeltaNet/full-attention, 262K context, multimodal) —
   two full generations ahead. Today you would pick a Qwen3/3.5-class 4–8B (or an MoE) and get
   materially better reasoning per FLOP, plus 32K–262K context instead of the pipeline's
   **2,048-token SFT window**, which forces section truncation and prevents multi-section reasoning.

3. **MLX/Apple-Silicon lock-in.** The training scripts are `mlx_lm`-specific ("does not run on CUDA
   without rewriting to TRL/SFTTrainer" per the README). In 2026 the portable default is
   Axolotl/Unsloth/TRL + PEFT on any GPU, with vLLM/SGLang serving. MLX was a constraint-driven
   choice (one Mac), not a recommendation. Cloud-GPU research exists in the repo
   (`runpod-cloud-training-research.md`) but was never wired in.

4. **Single-turn Q&A format.** No multi-turn, no tool calls, no structured output training. Modern
   tax assistants are agents that call calculators/retrievers; TaxGPT trains a closed-book oracle.

5. **Evaluation depth.** A 50-question self-authored eval with regex metrics. 2026 practice is an
   exam-derived benchmark with partial credit (SteuerEx: 115 expert-validated questions,
   statement-level scoring) plus regression suites in CI. TaxGPT's eval can't detect subtle
   reasoning failures, only citation/number mismatches.

6. **Reward brittleness.** Pure-regex rewards invite reward hacking (length reward → padding;
   vague-phrase penalty → banned-phrase avoidance rather than substantive answers). Current practice
   layers an LLM-judge or checklist-grader on top of programmatic checks for exactly this reason.

7. **Pipeline hygiene issues never closed out.** The v6 GPT-5.4 review (2026-03-29) flagged
   pipeline-blocking issues — v5 dataset paths not wired into `train_dpo.py`/`train_grpo.py`, the
   ineffective LoRA re-apply guard — and its verdict was "NOT production-ready". The final commit
   (`690a0cf`) addresses these, but there is no post-fix review or green end-to-end run recorded.
   Treat the fork as a research artifact, not a runnable product.

8. **No inference-time grounding or abstention.** The model is rewarded for *not* saying "consult a
   professional", with no compensating mechanism (retrieval, confidence calibration, refusal
   training) for questions outside its competence. For a regulated domain this is backwards:
   you want calibrated abstention, with the vague-penalty applied only when the answer *is* in the
   provided context.

## What this means for a UK rebuild

| TaxGPT component | Verdict | UK build action |
|---|---|---|
| Statute-section-as-atomic-unit data model | Keep | Rebuild on legislation.gov.uk CLML XML (doc 03 §2) |
| Grounded synthetic gen + citation validation | Keep | Same recipe, UK citation grammar |
| Hard-negative + on-policy DPO | Keep | Feed from Tax-Able's human review queue (doc 04) |
| GRPO w/ verifiable rewards | Keep, harden | Add LLM-judge layer; abstention-aware rewards |
| Knowledge-in-weights strategy | Replace | RAG over versioned statute DB; fine-tune for citation/schema behavior only |
| Qwen 2.5 3B + 2K context | Replace | Qwen3-class 4–8B, ≥32K context |
| MLX-only training | Replace | Axolotl/Unsloth + TRL (CUDA), MLX optional for local experiments |
| 50-question regex eval | Replace | Exam-derived UK benchmark + CI regression gate (doc 03 §6) |
| Ollama GGUF serving | Keep | Ollama for local; vLLM if a server ever exists |
