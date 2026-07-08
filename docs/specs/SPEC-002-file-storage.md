# SPEC-002 — Durable file storage for the document vault

Status: ready · Owner: Devin · Depends on: SPEC-001 (for scoped access control)

## Problem
Uploads write to `process.cwd()/uploads/` on whichever container handled the request. The Replit published deployment runs a separate container from the workspace → files 404 in production. Documents are the product's raw material; silent loss is unacceptable.

## Approach
**Replit Object Storage** (GCS-backed, native SDK, zero new vendor) as v1. Counterfactual to record in the explainer: Cloudflare R2 (the WWCU pick, cheaper egress at scale, but adds a vendor + credentials for no pre-pilot benefit) and DB-blob storage (transactionally simple but wrong for 15MB binaries; bloats backups). Migration to R2 later is a driver swap by design.

## Requirements
1. Storage driver interface (`putObject`, `getObjectStream`, `deleteObject`, `objectKey(docId, filename)`) — one file, so the R2 swap is one implementation. No SDK calls outside the driver.
2. Key scheme: `orgs/{organisationId}/documents/{documentId}/{sanitizedFilename}` — org prefix makes cross-tenant leakage auditable and bulk deletes trivial.
3. Upload path (server action) streams to object storage; DB row commits only after storage write succeeds; storage object is deleted if the DB write fails (compensating action).
4. Download route streams from storage with auth + org check (SPEC-001's `requireOrg`), sets correct content-type/disposition. Never redirect to a public bucket URL.
5. Extraction reads via the driver (in-memory or temp file), not from local paths.
6. Migration: existing dev-container files — best-effort backfill script (`scripts/`), log misses, mark unrecoverable documents with a `fileMissing` health flag surfaced in the UI rather than 404ing.
7. Config via env/Replit secrets; local dev may use a filesystem driver implementing the same interface.

## Exit criteria
- Upload → publish/redeploy → download still works (test on the published app, not just workspace).
- Extraction runs against storage-backed files.
- Cross-org download attempt → 403/404 (test).
- Explainers for the driver and the upload/download paths.
