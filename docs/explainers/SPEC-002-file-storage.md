# SPEC-002 file storage explainer

## Driver

Tax-Able now routes document binaries through `src/lib/storage.ts`. The driver interface exposes:

- `putObject`
- `getObjectStream`
- `deleteObject`
- `objectKey`

`STORAGE_DRIVER=replit` uses Replit Object Storage. Any other value uses the filesystem fallback under `uploads/` for local development.

The key scheme is:

```text
orgs/{organisationId}/documents/{documentId}/{sanitizedFilename}
```

This keeps tenant ownership visible in object paths and gives future bulk-delete/migration jobs a stable prefix.

## Upload path

`uploadDocument` in `src/app/actions/documents.ts` now writes the binary to the storage driver before creating the `Document` row. If the database write fails after the object upload, the action deletes the storage object as a compensating action.

Text extraction still runs from the uploaded request buffer, and extracted text remains stored in `DocumentChunk` rows for review/extraction workflows.

## Download path

`src/app/api/documents/[id]/file/route.ts` now calls `requireOrg()`, verifies that the document belongs to the current organisation, and streams the object from the driver. It never redirects to a public object URL.

Cross-organisation access returns `404`.

## Existing local files

`scripts/backfill-local-documents.ts` migrates old flat `uploads/{storageKey}` files into the driver key scheme. Missing files are logged and create a `fileMissing` document health flag.

Run with:

```bash
pnpm --filter @workspace/tax-able storage:backfill
```

## Alternatives considered

Cloudflare R2 would likely be the later production storage choice if egress cost or multi-cloud portability becomes important, but it adds another vendor and credentials before the pilot needs it.

Database blob storage would make transactionality simpler, but it is a poor fit for 15 MB document binaries and would bloat backups.
