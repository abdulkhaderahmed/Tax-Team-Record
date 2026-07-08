# TaxGPT → UK Tax → Quarterday: Analysis & Build Plan

Analysis of the `abdulkhaderahmed/TaxGPT` fork (Qwen 2.5 3B fine-tuned on the US Internal Revenue
Code via SFT → DPO → GRPO on Apple Silicon) and a step-by-step plan for reproducing the approach
for UK tax law and integrating it into Tax-Team-Record / Quarterday.

| Doc | Contents |
|---|---|
| [01-taxgpt-build-explainer.md](01-taxgpt-build-explainer.md) | Every design choice in the TaxGPT pipeline, in execution order, with the repo's own rationale: corpus parsing, the v1 template-data failure and v2 grounded fix, SFT/DPO/GRPO configs, verifiable-reward design, eval, frontier-review loops, Ollama export. |
| [02-outdatedness-assessment.md](02-outdatedness-assessment.md) | What is still current (RLVR, hard-negative/on-policy DPO, data manifests) vs dated (knowledge-in-weights instead of RAG, Qwen 2.5 3B + 2K context, MLX lock-in, regex-only rewards, thin eval, unresolved pipeline bugs), with a keep/replace table. |
| [03-uk-adaptation-blueprint.md](03-uk-adaptation-blueprint.md) | Rebuilding the pipeline for UK law: legislation.gov.uk CLML corpus, HMRC manuals, UK citation grammar, rates/thresholds reference, retrieval-first architecture, modernized training recipe, UK benchmark, phased plan with exit criteria. |
| [04-quarterday-integration-and-improvements.md](04-quarterday-integration-and-improvements.md) | Mapping TaxGPT concepts onto Quarterday's extraction → review → live-object flow; ranked improvements (review-queue training-data flywheel, inline validators, extraction benchmark, provider abstraction, reviewer RAG); proposal to house the model pipeline in the empty `quarterday` repo; merged roadmap. |

**One-line thesis:** TaxGPT's durable contribution is its *discipline* — statute-section-grounded
data, programmatic citation validation, verifiable rewards, versioned manifests, adversarial
reviews — not its weights. Port the discipline into Quarterday first (immediate product wins),
then train a UK model on the review-queue data that discipline produces.
