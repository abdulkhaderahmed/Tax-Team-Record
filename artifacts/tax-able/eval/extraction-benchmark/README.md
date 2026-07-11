# Five-document extraction benchmark

This folder provides a commit-safe benchmark framework for the private five-document corpus. It
contains hashes, page counts, normalized tax concepts, scoring code and tests. It contains no source
PDFs, extracted text, client names, monetary values, verbatim annotations or model transcripts.

The committed concept inventory is deliberately marked `draft_unverified`. It is a structured
starting point based on an initial corpus review, not a completed gold standard and not evidence of
AI accuracy.

## Files

- `manifest.json` identifies each private PDF by SHA-256 and physical page count.
- `gold-concepts.json` is the non-confidential concept inventory for the five fixture IDs.
- `annotation-schema.ts` validates gold annotations and normalized prediction runs.
- `verify-manifest.ts` verifies local PDFs without printing their contents.
- `evaluate.ts` calculates benchmark metrics without returning source text.

## Annotation rules

Page numbers are one-based physical PDF pages, not printed footer numbers. Every concept has
separate verification states for the concept, its materiality, its applicability condition and its
page citation. `not_annotated` means no page claim has been made. `draft_unverified` page leads are
excluded by the default scoring policy.

The inventory distinguishes:

- obligations and actions, which are the target types for recall and precision;
- tripwires, assumptions, caveats and evidence, which test whether the extractor preserves the
  advice-to-control meaning instead of inventing a deadline; and
- two valuation-report negative controls whose draft target sets contain no obligations or actions.

Before treating the inventory as gold, two tax reviewers should independently inspect the private
documents, reconcile disagreements, mark the target set for every fixture `complete`, and change
each accepted field to `verified`. Do not add quotes or confidential facts to this repository.

## Verifying private fixtures

Set `TAXABLE_BENCHMARK_FIXTURE_01_PATH` through `TAXABLE_BENCHMARK_FIXTURE_05_PATH` to the exact
local PDFs, then run:

```sh
pnpm --filter @workspace/tax-able eval:extraction-manifest
```

The verifier checks the hash and physical page count only.

## Prediction-run format

The evaluator accepts a JSON file shaped like this:

```json
{
  "schemaVersion": "1",
  "runId": "2026-07-11-prompt-v3",
  "modelIdentifier": "internal-model-version",
  "promptVersion": "extraction-v3",
  "fixtures": [
    {
      "fixtureId": "corpus-01",
      "predictions": [
        {
          "predictionId": "generated-record-id",
          "conceptKey": "quarterly-instalment-payments",
          "recordType": "obligation",
          "adjudicationStatus": "human_adjudicated",
          "condition": {
            "applicability": "conditional",
            "conditionKey": "qips-size-and-associated-company-tests-met"
          },
          "citations": [
            { "physicalPage": 12, "quoteVerified": true }
          ]
        }
      ]
    }
  ]
}
```

`conceptKey` and `conditionKey` are normalized adjudication fields. The evaluator does not pretend
that string similarity proves semantic equivalence: a reviewer or a separately tested normalization
step must map raw model output to these keys. Duplicate predictions do not inflate recall; the first
match is counted and later duplicates are false positives.

Run verified-only scoring (the default) with:

```sh
pnpm --filter @workspace/tax-able exec tsx \
  eval/extraction-benchmark/evaluate.ts --predictions /private/path/run.json
```

For development only, draft annotations can be included:

```sh
pnpm --filter @workspace/tax-able exec tsx \
  eval/extraction-benchmark/evaluate.ts --predictions /private/path/run.json --include-draft
```

Draft-inclusive reports are always labelled `provisional` and `claimAllowed: false`.

## Metric definitions

- `materialTargetRecall`: unique material obligation/action concepts found divided by eligible gold
  concepts. A missed concept is a false negative.
- `targetPrecision`: unique correct obligation/action predictions divided by all obligation/action
  predictions. This is calculated only for fixtures whose target set is complete; otherwise the
  framework cannot honestly decide that an unmatched prediction is false.
- `conditionPreservation`: matched conditional concepts whose normalized applicability and condition
  key are both preserved. It is conditional on the item having been found, so recall remains a
  separate measure.
- `citationCoverage`: matched, page-annotated concepts with at least one citation.
- `pageCitationAccuracy`: matched, page-annotated concepts where every predicted citation is on an
  accepted physical page. Missing citations fail this measure.
- `verifiedCitationAccuracy`: page-accurate concepts where every supplied quote passed source-text
  verification. This does not store the quote in the benchmark.
- `falsePositiveCount`: unmatched or duplicate obligation/action predictions on precision-eligible
  fixtures.

The product proof threshold remains stricter than merely producing a number: no material target may
be missed, and at least 95% of confirmed extracted items should have page-accurate citations. A
report receives `claimAllowed: true` only under verified-only scoring when all five target sets,
concepts, conditions and target citations are complete and verified, all fixtures are present, and
predictions have been human-adjudicated. `qualityGates` reports the two proposed pilot thresholds
directly: 100% material-target recall and at least 95% page-citation accuracy.
