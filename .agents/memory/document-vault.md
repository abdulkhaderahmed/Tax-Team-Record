---
name: Document Vault build notes
description: Key decisions and quirks from building the Document Vault feature on Quarterday.
---

## Key decisions
- File storage: local filesystem at `process.cwd()/uploads/` (created at runtime via `mkdir({ recursive: true })`). `process.cwd()` in Next.js dev is the artifact directory (`artifacts/quarterday/`).
- Storage key: `randomUUID().ext` (built-in Node.js crypto, no extra dep).
- Text extraction: one chunk per file (not per page); full text stored in `DocumentChunk`.
- Health flags: regex scan with 6 patterns (XX, TBC, [insert …], <<…>>, do/do not, wrong); each occurrence stored separately with 80-char context snippet.
- File upload limit: 15 MB via `experimental.serverActions.bodySizeLimit` in next.config.ts.
- `@types/mammoth` does NOT exist on npm — mammoth 1.x ships its own types.

**Why:** Keeping extraction simple (one chunk) avoids page-splitting complexity while still capturing the full text for health checks. The 15 MB limit covers most adviser memos and R&D reports.
