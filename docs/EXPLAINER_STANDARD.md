# Explainer standard

Every code file created or materially changed ships with a sibling `<filename>.explainer.md`. Purpose: (a) any agent or human can understand the file cold; (b) the author is forced to argue against their own approach once, in writing — catching wrong turns while they're cheap.

Module-level explainers (one per folder) are acceptable where files are trivially related (e.g., a folder of CRUD forms); judgment-bearing files (schema, extraction, rules engine, auth) always get their own.

## Template

```markdown
# <file path> — explainer

## Purpose
One paragraph: what this file does and why it exists at all.

## Architecture
How it fits: upstream callers, downstream dependencies, data in/out,
invariants it must preserve (e.g., "never writes to registers directly").

## Methodology
The approach taken and the reasoning, including key types/functions
worth knowing before editing.

## Counterfactual analysis
The strongest alternative(s) NOT taken, in good faith:
- Alternative A: what it would look like, what it wins, why it lost.
- Alternative B: same.
What evidence or scale-point would make an alternative the right call
(be specific: "if extraction p95 exceeds 30s", not "if it gets slow").
Then re-read the chosen approach against these: does it still hold?
If writing this section changes your mind — change the code, not the prose.

## Known limitations & failure modes
What breaks first, and how you'd notice (logs, Sentry, user symptom).

## Verification
How this was tested; what a reviewer should re-run.
Last verified: <date> against <commit>.
```

## Rules
1. The counterfactual section is the point. If it reads as a strawman, it fails review.
2. Explainers are updated in the same commit as the code they describe; a stale explainer is worse than none — CI may later enforce path-pairing.
3. Keep each under ~120 lines; link to specs/decisions (`DECISIONS.md`) instead of restating them.
4. Existing legacy files: generate explainers opportunistically when touching them (Sonnet-tier task per `MODEL_ROUTING.md`), seeded from `explainers/` module docs.
