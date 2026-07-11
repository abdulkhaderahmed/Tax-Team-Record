import assert from "node:assert/strict";
import test from "node:test";
import type { GoldConcept, GoldInventory, PredictionRun } from "./annotation-schema";
import { evaluateBenchmark, readGoldInventory } from "./evaluate";

function concept(
  conceptKey: string,
  recordType: "obligation" | "action",
  options: {
    page?: number;
    conditionKey?: string;
  } = {},
): GoldConcept {
  return {
    conceptId: `corpus-01--${conceptKey}`,
    conceptKey,
    recordType,
    nonConfidentialSummary: `Synthetic ${conceptKey} benchmark concept.`,
    materiality: "material",
    annotationStatus: "verified",
    materialityStatus: "verified",
    condition: options.conditionKey
      ? {
          applicability: "conditional",
          conditionKey: options.conditionKey,
          verificationStatus: "verified",
        }
      : {
          applicability: "unconditional",
          conditionKey: null,
          verificationStatus: "verified",
        },
    citation: options.page
      ? {
          acceptedPhysicalPages: [options.page],
          verificationStatus: "verified",
        }
      : {
          acceptedPhysicalPages: [],
          verificationStatus: "not_annotated",
        },
  };
}

function verifiedInventory(): GoldInventory {
  return {
    schemaVersion: "1",
    confidentiality: "non_confidential_concept_inventory",
    inventoryStatus: "draft_unverified",
    pageNumbering: "one_based_physical_pdf_page",
    fixtures: [1, 2, 3, 4, 5].map((number) => ({
      fixtureId: `corpus-0${number}` as GoldInventory["fixtures"][number]["fixtureId"],
      documentArchetype: "Synthetic test fixture",
      targetSet: {
        completeness: "complete" as const,
        verificationStatus: "verified" as const,
      },
      negativeControlFor: [],
      concepts:
        number === 1
          ? [
              concept("corporation-tax-return", "obligation"),
              concept("quarterly-instalment-payments", "obligation", {
                page: 5,
                conditionKey: "qips-threshold-met",
              }),
              concept("section-431-election-action", "action", {
                page: 7,
                conditionKey: "election-window-open",
              }),
            ]
          : [],
    })),
  };
}

function predictionRun(): PredictionRun {
  return {
    schemaVersion: "1",
    runId: "synthetic-run",
    modelIdentifier: "test-model",
    promptVersion: "test-prompt-v1",
    fixtures: [
      {
        fixtureId: "corpus-01",
        predictions: [
          {
            predictionId: "ct",
            conceptKey: "corporation-tax-return",
            recordType: "obligation",
            adjudicationStatus: "human_adjudicated",
            condition: { applicability: "unconditional", conditionKey: null },
            citations: [],
          },
          {
            predictionId: "qips",
            conceptKey: "quarterly-instalment-payments",
            recordType: "obligation",
            adjudicationStatus: "human_adjudicated",
            condition: {
              applicability: "conditional",
              conditionKey: "qips-threshold-met",
            },
            citations: [{ physicalPage: 5, quoteVerified: true }],
          },
          {
            predictionId: "section-431",
            conceptKey: "section-431-election-action",
            recordType: "action",
            adjudicationStatus: "human_adjudicated",
            condition: { applicability: "unconditional", conditionKey: null },
            citations: [{ physicalPage: 8, quoteVerified: false }],
          },
          {
            predictionId: "invented",
            conceptKey: "invented-obligation",
            recordType: "obligation",
            adjudicationStatus: "human_adjudicated",
            condition: { applicability: "unconditional", conditionKey: null },
            citations: [{ physicalPage: 9, quoteVerified: false }],
          },
        ],
      },
      ...[2, 3, 4, 5].map((number) => ({
        fixtureId: `corpus-0${number}` as PredictionRun["fixtures"][number]["fixtureId"],
        predictions: [],
      })),
    ],
  };
}

test("evaluator measures recall, false positives, conditions, and strict citations", () => {
  const report = evaluateBenchmark(verifiedInventory(), predictionRun());

  assert.deepEqual(report.materialTargetRecall, {
    numerator: 3,
    denominator: 3,
    value: 1,
  });
  assert.deepEqual(report.targetPrecision, {
    numerator: 3,
    denominator: 4,
    value: 0.75,
    falsePositiveCount: 1,
  });
  assert.deepEqual(report.conditionPreservation, {
    numerator: 1,
    denominator: 2,
    value: 0.5,
  });
  assert.deepEqual(report.citationCoverage, {
    numerator: 2,
    denominator: 2,
    value: 1,
  });
  assert.deepEqual(report.pageCitationAccuracy, {
    numerator: 1,
    denominator: 2,
    value: 0.5,
  });
  assert.deepEqual(report.verifiedCitationAccuracy, {
    numerator: 1,
    denominator: 2,
    value: 0.5,
  });
  assert.deepEqual(report.qualityGates, {
    noMaterialTargetMisses: true,
    pageAccurateCitationsAtLeast95Percent: false,
  });
  assert.equal(report.publicationStatus, "provisional");
  assert.equal(report.claimAllowed, false);
});

test("duplicate predictions count as false positives and do not inflate recall", () => {
  const run = predictionRun();
  const qips = run.fixtures[0].predictions[1];
  run.fixtures[0].predictions = [
    qips,
    { ...qips, predictionId: "qips-duplicate" },
  ];

  const report = evaluateBenchmark(verifiedInventory(), run);
  assert.deepEqual(report.materialTargetRecall, {
    numerator: 1,
    denominator: 3,
    value: 1 / 3,
  });
  assert.deepEqual(report.targetPrecision, {
    numerator: 1,
    denominator: 2,
    value: 0.5,
    falsePositiveCount: 1,
  });
});

test("draft inventory is excluded by default and available only as provisional scoring", async () => {
  const inventory = await readGoldInventory();
  const emptyRun: PredictionRun = {
    schemaVersion: "1",
    runId: "empty-run",
    modelIdentifier: "test-model",
    promptVersion: "test-prompt-v1",
    fixtures: inventory.fixtures.map((fixture) => ({
      fixtureId: fixture.fixtureId,
      predictions: [],
    })),
  };

  const validatedPolicyReport = evaluateBenchmark(inventory, emptyRun);
  assert.equal(validatedPolicyReport.materialTargetRecall.denominator, 0);
  assert.equal(validatedPolicyReport.targetPrecision.denominator, 0);
  assert.equal(validatedPolicyReport.publicationStatus, "not_scorable");

  const provisionalReport = evaluateBenchmark(
    inventory,
    emptyRun,
    "include-draft",
  );
  assert.ok(provisionalReport.materialTargetRecall.denominator > 0);
  assert.equal(provisionalReport.precisionEligibleFixtureCount, 2);
  assert.equal(provisionalReport.publicationStatus, "provisional");
  assert.equal(provisionalReport.claimAllowed, false);
  assert.match(provisionalReport.warnings[0], /must not be marketed/i);
});
