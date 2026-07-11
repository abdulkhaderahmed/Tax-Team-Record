import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  GoldInventorySchema,
  PredictionRunSchema,
  TARGET_RECORD_TYPES,
  type GoldConcept,
  type GoldInventory,
  type Prediction,
  type PredictionRun,
  type RecordType,
  type VerificationStatus,
} from "./annotation-schema";

export type EvaluationPolicy = "verified-only" | "include-draft";

interface RatioMetric {
  numerator: number;
  denominator: number;
  value: number | null;
}

export interface BenchmarkReport {
  schemaVersion: "1";
  runId: string;
  modelIdentifier: string;
  promptVersion: string;
  policy: EvaluationPolicy;
  publicationStatus: "not_scorable" | "provisional" | "validated";
  claimAllowed: boolean;
  materialTargetRecall: RatioMetric;
  targetPrecision: RatioMetric & { falsePositiveCount: number };
  conditionPreservation: RatioMetric;
  citationCoverage: RatioMetric;
  pageCitationAccuracy: RatioMetric;
  verifiedCitationAccuracy: RatioMetric;
  precisionEligibleFixtureCount: number;
  unscoredTargetPredictionCount: number;
  qualityGates: {
    noMaterialTargetMisses: boolean | null;
    pageAccurateCitationsAtLeast95Percent: boolean | null;
  };
  warnings: string[];
}

interface MatchedPrediction {
  gold: GoldConcept;
  prediction: Prediction;
}

function ratio(numerator: number, denominator: number): RatioMetric {
  return {
    numerator,
    denominator,
    value: denominator === 0 ? null : numerator / denominator,
  };
}

function isTargetRecordType(recordType: RecordType): boolean {
  return TARGET_RECORD_TYPES.includes(
    recordType as (typeof TARGET_RECORD_TYPES)[number],
  );
}

function isEligibleStatus(
  status: VerificationStatus,
  policy: EvaluationPolicy,
): boolean {
  return status === "verified" || policy === "include-draft";
}

function conceptMatchKey(concept: Pick<GoldConcept, "conceptKey" | "recordType">) {
  return `${concept.recordType}:${concept.conceptKey}`;
}

function goldIsEligible(
  concept: GoldConcept,
  policy: EvaluationPolicy,
): boolean {
  return (
    isTargetRecordType(concept.recordType) &&
    isEligibleStatus(concept.annotationStatus, policy) &&
    isEligibleStatus(concept.materialityStatus, policy)
  );
}

function inventoryReadyForPublication(inventory: GoldInventory): boolean {
  if (inventory.inventoryStatus !== "verified") return false;

  return inventory.fixtures.every((fixture) => {
    if (
      fixture.targetSet.completeness !== "complete" ||
      fixture.targetSet.verificationStatus !== "verified"
    ) {
      return false;
    }

    return fixture.concepts.filter((concept) => isTargetRecordType(concept.recordType)).every(
      (concept) =>
        concept.annotationStatus === "verified" &&
        concept.materialityStatus === "verified" &&
        concept.condition.verificationStatus === "verified" &&
        concept.citation.verificationStatus === "verified",
    );
  });
}

export function evaluateBenchmark(
  rawInventory: unknown,
  rawRun: unknown,
  policy: EvaluationPolicy = "verified-only",
): BenchmarkReport {
  const inventory = GoldInventorySchema.parse(rawInventory);
  const run = PredictionRunSchema.parse(rawRun);
  const goldFixtureIds = new Set(inventory.fixtures.map((fixture) => fixture.fixtureId));
  const unknownFixtures = run.fixtures.filter(
    (fixture) => !goldFixtureIds.has(fixture.fixtureId),
  );
  if (unknownFixtures.length > 0) {
    throw new Error(
      `Prediction run contains unknown fixtures: ${unknownFixtures.map((item) => item.fixtureId).join(", ")}`,
    );
  }

  const runByFixture = new Map(
    run.fixtures.map((fixture) => [fixture.fixtureId, fixture.predictions]),
  );
  let recallNumerator = 0;
  let recallDenominator = 0;
  let precisionNumerator = 0;
  let precisionDenominator = 0;
  let falsePositiveCount = 0;
  let conditionNumerator = 0;
  let conditionDenominator = 0;
  let citationCoverageNumerator = 0;
  let citationDenominator = 0;
  let pageNumerator = 0;
  let verifiedCitationNumerator = 0;
  let precisionEligibleFixtureCount = 0;
  let unscoredTargetPredictionCount = 0;

  for (const fixture of inventory.fixtures) {
    const targetPredictions = (runByFixture.get(fixture.fixtureId) ?? []).filter(
      (prediction) => isTargetRecordType(prediction.recordType),
    );
    const eligibleGold = fixture.concepts.filter((concept) =>
      goldIsEligible(concept, policy),
    );
    const goldByKey = new Map(
      eligibleGold.map((concept) => [conceptMatchKey(concept), concept]),
    );
    const matchedConceptIds = new Set<string>();
    const matches: MatchedPrediction[] = [];
    const unmatchedPredictions: Prediction[] = [];

    for (const prediction of targetPredictions) {
      const gold = goldByKey.get(conceptMatchKey(prediction));
      if (!gold || matchedConceptIds.has(gold.conceptId)) {
        unmatchedPredictions.push(prediction);
        continue;
      }
      matchedConceptIds.add(gold.conceptId);
      matches.push({ gold, prediction });
    }

    const materialGold = eligibleGold.filter(
      (concept) => concept.materiality === "material",
    );
    recallNumerator += materialGold.filter((concept) =>
      matchedConceptIds.has(concept.conceptId),
    ).length;
    recallDenominator += materialGold.length;

    const precisionEligible =
      fixture.targetSet.completeness === "complete" &&
      isEligibleStatus(fixture.targetSet.verificationStatus, policy);
    if (precisionEligible) {
      precisionEligibleFixtureCount += 1;
      precisionNumerator += matches.length;
      precisionDenominator += targetPredictions.length;
      falsePositiveCount += unmatchedPredictions.length;
    } else {
      unscoredTargetPredictionCount += targetPredictions.length;
    }

    for (const match of matches) {
      if (match.gold.materiality !== "material") continue;

      if (
        match.gold.condition.applicability === "conditional" &&
        isEligibleStatus(match.gold.condition.verificationStatus, policy)
      ) {
        conditionDenominator += 1;
        if (
          match.prediction.condition.applicability === "conditional" &&
          match.prediction.condition.conditionKey ===
            match.gold.condition.conditionKey
        ) {
          conditionNumerator += 1;
        }
      }

      const citationStatus = match.gold.citation.verificationStatus;
      const citationEligible =
        citationStatus === "verified" ||
        (policy === "include-draft" && citationStatus === "draft_unverified");
      if (!citationEligible) continue;

      citationDenominator += 1;
      if (match.prediction.citations.length > 0) {
        citationCoverageNumerator += 1;
      }

      const acceptedPages = new Set(
        match.gold.citation.acceptedPhysicalPages,
      );
      const pageAccurate =
        match.prediction.citations.length > 0 &&
        match.prediction.citations.every((citation) =>
          acceptedPages.has(citation.physicalPage),
        );
      if (pageAccurate) pageNumerator += 1;
      if (
        pageAccurate &&
        match.prediction.citations.every((citation) => citation.quoteVerified)
      ) {
        verifiedCitationNumerator += 1;
      }
    }
  }

  const materialTargetRecall = ratio(recallNumerator, recallDenominator);
  const targetPrecision = {
    ...ratio(precisionNumerator, precisionDenominator),
    falsePositiveCount,
  };
  const conditionPreservation = ratio(
    conditionNumerator,
    conditionDenominator,
  );
  const citationCoverage = ratio(
    citationCoverageNumerator,
    citationDenominator,
  );
  const pageCitationAccuracy = ratio(pageNumerator, citationDenominator);
  const verifiedCitationAccuracy = ratio(
    verifiedCitationNumerator,
    citationDenominator,
  );
  const hasScorableMetric = [
    materialTargetRecall,
    targetPrecision,
    conditionPreservation,
    pageCitationAccuracy,
  ].some((metric) => metric.denominator > 0);
  const allFixturesPresent = inventory.fixtures.every((fixture) =>
    runByFixture.has(fixture.fixtureId),
  );
  const allPredictionsAdjudicated = run.fixtures.every((fixture) =>
    fixture.predictions.every(
      (prediction) => prediction.adjudicationStatus === "human_adjudicated",
    ),
  );
  const claimAllowed =
    hasScorableMetric &&
    policy === "verified-only" &&
    allFixturesPresent &&
    allPredictionsAdjudicated &&
    inventoryReadyForPublication(inventory);
  const publicationStatus = !hasScorableMetric
    ? "not_scorable"
    : claimAllowed
      ? "validated"
      : "provisional";
  const warnings: string[] = [];
  if (policy === "include-draft") {
    warnings.push(
      "Draft annotations are included; metrics are provisional and must not be marketed as accuracy claims.",
    );
  }
  if (unscoredTargetPredictionCount > 0) {
    warnings.push(
      `${unscoredTargetPredictionCount} obligation/action predictions were excluded from precision because their fixture target sets are incomplete or unverified.`,
    );
  }
  if (!allFixturesPresent) {
    warnings.push("The prediction run does not contain all five fixtures.");
  }
  if (!allPredictionsAdjudicated) {
    warnings.push("The prediction run contains output that has not been human-adjudicated.");
  }
  if (!inventoryReadyForPublication(inventory)) {
    warnings.push("The gold inventory is not complete and independently verified.");
  }

  return {
    schemaVersion: "1",
    runId: run.runId,
    modelIdentifier: run.modelIdentifier,
    promptVersion: run.promptVersion,
    policy,
    publicationStatus,
    claimAllowed,
    materialTargetRecall,
    targetPrecision,
    conditionPreservation,
    citationCoverage,
    pageCitationAccuracy,
    verifiedCitationAccuracy,
    precisionEligibleFixtureCount,
    unscoredTargetPredictionCount,
    qualityGates: {
      noMaterialTargetMisses:
        materialTargetRecall.value === null
          ? null
          : materialTargetRecall.value === 1,
      pageAccurateCitationsAtLeast95Percent:
        pageCitationAccuracy.value === null
          ? null
          : pageCitationAccuracy.value >= 0.95,
    },
    warnings,
  };
}

export async function readGoldInventory(): Promise<GoldInventory> {
  const raw = JSON.parse(
    await readFile(new URL("./gold-concepts.json", import.meta.url), "utf8"),
  );
  return GoldInventorySchema.parse(raw);
}

export async function readPredictionRun(filePath: string): Promise<PredictionRun> {
  return PredictionRunSchema.parse(
    JSON.parse(await readFile(resolve(filePath), "utf8")),
  );
}

async function main() {
  const predictionFlag = process.argv.indexOf("--predictions");
  const predictionPath = process.argv[predictionFlag + 1];
  if (predictionFlag < 0 || !predictionPath) {
    throw new Error(
      "Usage: tsx evaluate.ts --predictions <run.json> [--include-draft]",
    );
  }
  const policy: EvaluationPolicy = process.argv.includes("--include-draft")
    ? "include-draft"
    : "verified-only";
  const report = evaluateBenchmark(
    await readGoldInventory(),
    await readPredictionRun(predictionPath),
    policy,
  );
  console.log(JSON.stringify(report, null, 2));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  void main();
}
