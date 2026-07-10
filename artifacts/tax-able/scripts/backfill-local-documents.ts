import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "../src/lib/prisma";
import { documentContentType, getStorageDriver } from "../src/lib/storage";

async function main() {
  const storage = getStorageDriver();
  const docs = await prisma.document.findMany({ orderBy: { uploadedAt: "asc" } });

  for (const doc of docs) {
    if (doc.storageKey.startsWith("orgs/")) continue;

    const oldPath = path.join(process.cwd(), "uploads", doc.storageKey);
    let buffer: Buffer;
    try {
      buffer = await readFile(oldPath);
    } catch {
      await prisma.documentHealthFlag.create({
        data: {
          documentId: doc.id,
          marker: "fileMissing",
          context: `Local upload file missing during storage backfill: ${doc.storageKey}`,
          chunkIndex: 0,
          pageNumber: null,
        },
      });
      console.warn(`MISS ${doc.id} ${doc.storageKey}`);
      continue;
    }

    const newKey = storage.objectKey(doc.organisationId, doc.id, doc.filename);
    await storage.putObject({
      key: newKey,
      body: buffer,
      contentType: documentContentType(doc.fileType),
    });
    await prisma.document.update({ where: { id: doc.id }, data: { storageKey: newKey } });
    console.log(`OK ${doc.id} ${newKey}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
