import assert from "node:assert/strict";
import test from "node:test";
import { readBenchmarkManifest } from "./verify-manifest";

test("private corpus manifest identifies exactly five unique PDF fixtures", async () => {
  const manifest = await readBenchmarkManifest();
  assert.equal(manifest.schemaVersion, "1");
  assert.equal(manifest.fixtures.length, 5);
  assert.equal(
    new Set(manifest.fixtures.map((fixture) => fixture.fixtureId)).size,
    5,
  );
  assert.equal(
    new Set(manifest.fixtures.map((fixture) => fixture.sha256)).size,
    5,
  );

  for (const fixture of manifest.fixtures) {
    assert.match(fixture.sha256, /^[a-f0-9]{64}$/);
    assert.match(fixture.pathEnv, /^TAXABLE_BENCHMARK_FIXTURE_0[1-5]_PATH$/);
    assert.ok(fixture.physicalPageCount > 0);
  }
});
