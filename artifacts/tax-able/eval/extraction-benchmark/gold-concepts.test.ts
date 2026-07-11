import assert from "node:assert/strict";
import test from "node:test";
import { readBenchmarkManifest } from "./verify-manifest";
import { readGoldInventory } from "./evaluate";

test("concept inventory is commit-safe, draft-labelled, and aligned to the five fixtures", async () => {
  const [manifest, inventory] = await Promise.all([
    readBenchmarkManifest(),
    readGoldInventory(),
  ]);

  assert.equal(inventory.confidentiality, "non_confidential_concept_inventory");
  assert.equal(inventory.inventoryStatus, "draft_unverified");
  assert.deepEqual(
    inventory.fixtures.map((fixture) => fixture.fixtureId),
    manifest.fixtures.map((fixture) => fixture.fixtureId),
  );

  const pageCountByFixture = new Map(
    manifest.fixtures.map((fixture) => [
      fixture.fixtureId,
      fixture.physicalPageCount,
    ]),
  );

  for (const fixture of inventory.fixtures) {
    assert.equal(fixture.targetSet.verificationStatus, "draft_unverified");
    for (const concept of fixture.concepts) {
      assert.equal(concept.annotationStatus, "draft_unverified");
      assert.equal(concept.materialityStatus, "draft_unverified");
      assert.equal(concept.condition.verificationStatus, "draft_unverified");
      assert.ok(!concept.nonConfidentialSummary.includes("£"));
      assert.ok(
        concept.citation.acceptedPhysicalPages.every(
          (page) => page <= (pageCountByFixture.get(fixture.fixtureId) ?? 0),
        ),
      );
    }
  }

  assert.deepEqual(
    inventory.fixtures
      .filter((fixture) => fixture.negativeControlFor.length > 0)
      .map((fixture) => fixture.fixtureId),
    ["corpus-04", "corpus-05"],
  );
});

test("known page leads remain explicitly unverified", async () => {
  const inventory = await readGoldInventory();
  const locatedDraftCitations = inventory.fixtures.flatMap((fixture) =>
    fixture.concepts.filter(
      (concept) => concept.citation.verificationStatus === "draft_unverified",
    ),
  );

  assert.ok(locatedDraftCitations.length > 0);
  assert.ok(
    locatedDraftCitations.every(
      (concept) => concept.citation.acceptedPhysicalPages.length > 0,
    ),
  );
  assert.ok(
    locatedDraftCitations.every(
      (concept) => concept.citation.verificationStatus !== "verified",
    ),
  );
});
