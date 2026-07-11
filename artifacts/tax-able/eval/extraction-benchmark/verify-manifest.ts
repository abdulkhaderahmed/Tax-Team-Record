import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PDFParse } from "pdf-parse";

export interface BenchmarkFixture {
  fixtureId: string;
  pathEnv: string;
  sha256: string;
  physicalPageCount: number;
}

export interface BenchmarkManifest {
  schemaVersion: string;
  fixtures: BenchmarkFixture[];
}

export async function readBenchmarkManifest(): Promise<BenchmarkManifest> {
  const manifestUrl = new URL("./manifest.json", import.meta.url);
  return JSON.parse(await readFile(manifestUrl, "utf8")) as BenchmarkManifest;
}

export async function verifyBenchmarkFixture(
  fixture: BenchmarkFixture,
  filePath: string,
) {
  const buffer = await readFile(filePath);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const parser = new PDFParse({ data: buffer });
  try {
    const info = await parser.getInfo();
    return {
      fixtureId: fixture.fixtureId,
      hashMatches: sha256 === fixture.sha256,
      pageCountMatches: info.total === fixture.physicalPageCount,
      actualPageCount: info.total,
    };
  } finally {
    await parser.destroy();
  }
}

async function main() {
  const manifest = await readBenchmarkManifest();
  let failed = false;

  for (const fixture of manifest.fixtures) {
    const filePath = process.env[fixture.pathEnv];
    if (!filePath) {
      console.error(`${fixture.fixtureId}: missing ${fixture.pathEnv}`);
      failed = true;
      continue;
    }

    const result = await verifyBenchmarkFixture(fixture, filePath);
    const passed = result.hashMatches && result.pageCountMatches;
    console.log(
      `${fixture.fixtureId}: ${passed ? "PASS" : "FAIL"} (hash=${result.hashMatches}, pages=${result.actualPageCount})`,
    );
    failed ||= !passed;
  }

  if (failed) process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  void main();
}
