import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const generatedTypeFiles = ["next-env.d.ts", "tsconfig.json"];
const originalContents = new Map();

for (const path of generatedTypeFiles) {
  originalContents.set(path, await readFile(path, "utf8"));
}

let exitCode = 1;

try {
  exitCode = await new Promise((resolve, reject) => {
    const build = spawn(process.execPath, [nextBin, "build"], {
      env: { ...process.env, NEXT_DIST_DIR: ".next-build" },
      stdio: "inherit",
    });

    build.once("error", reject);
    build.once("exit", (code) => resolve(code ?? 1));
  });
} finally {
  await Promise.all(
    generatedTypeFiles.map((path) =>
      writeFile(path, originalContents.get(path), "utf8"),
    ),
  );
}

process.exitCode = exitCode;
