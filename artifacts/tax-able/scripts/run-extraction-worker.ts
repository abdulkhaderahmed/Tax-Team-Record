import { processExtractionRun } from "../src/lib/process-extraction-run";
import { workOneExtractionRun } from "../src/lib/extraction-worker";
import { prisma } from "../src/lib/prisma";

async function main() {
  const watch = process.argv.includes("--watch");
  do {
    const worked = await workOneExtractionRun(processExtractionRun);
    if (!worked && watch)
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    if (!worked && !watch) break;
  } while (watch);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
