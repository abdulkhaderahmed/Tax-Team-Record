# Tax-Able / Tax-Team-Record — docs

Single source of truth for product state, plans, and handoffs. Last reconciled to the `codex/advice-control-record` implementation on 2026-07-11; designed so any agent or human can resume work cold.

## Read in this order

| File | What it answers |
|---|---|
| `CURRENT_STATE.md` | What is implemented and verified, and what remains unproven |
| `ROADMAP.md` | What happens next, in what order, and the halt/resume protocol |
| `MODEL_ROUTING.md` | Which AI model/tool to use for which task, and why |
| `DEVIN_HANDOFF.md` | Devin's entry point — conventions, guardrails, first tasks |
| `DECISIONS.md` | Decision log with counterfactuals (why X over Y, what would change the call) |
| `EXPLAINER_STANDARD.md` | The per-file explainer requirement every code change must satisfy |
| `specs/` | Original implementation specs; status headers identify implemented versus still-unproven exit criteria |
| `taxgpt-uk/` | Assessment of "TaxGPT" integration candidates and the chosen architecture |
| `design/` | Design system, dashboard mockup (HTML), and its explainer |
| `explainers/` | Module-level architecture explainers for existing code |

## Ground rules encoded here

1. **GitHub is the source of truth.** Session tools (Replit, Cowork, Notion, Asana) are ephemeral; anything worth keeping lands in this tree.
2. **Every code file ships with an explainer** (`<name>.explainer.md`) per `EXPLAINER_STANDARD.md`, including a counterfactual analysis of the methodology chosen.
3. **The register is the product.** AI drafts; humans confirm; nothing enters a register unreviewed (see `../artifacts/tax-able` app code).
4. **Anticipate halting.** Every working session ends by updating `CURRENT_STATE.md` and the "Next actions" block in `ROADMAP.md`.
5. **Do not convert implementation into assurance by wording.** Tax-content reliance, extraction accuracy, production security and customer value remain unproven until their explicit evidence gates pass.
