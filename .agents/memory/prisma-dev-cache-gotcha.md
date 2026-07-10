---
name: Prisma dev-mode singleton cache gotcha
description: After schema changes + migrate dev, a running Next.js dev server caches the old Prisma client — must restart workflow
---

After running `prisma migrate dev` (or `prisma generate`), the Next.js dev server may still hold the **old Prisma client** cached in `globalThis.prisma`. This causes runtime errors like:

- `Cannot read properties of undefined (reading 'findMany')` — new model accessor doesn't exist on the old client
- Followed by a secondary "Invalid hook call" error from React trying to recover

**Why:** `src/lib/prisma.ts` uses the standard Next.js singleton pattern (`globalThis.prisma ?? new PrismaClient()`). The guard prevents reconnection churn but also locks in the client instance for the lifetime of the process.

**How to apply:** After any `prisma migrate dev` or `prisma generate` that adds new models or relations, always restart the workflow (`artifacts/tax-able: web`) immediately. Do not expect hot-reload to pick up new Prisma model accessors — it won't.

Fix sequence:
1. `pnpm --filter @workspace/tax-able run db:generate` (or it runs automatically via `migrate dev`)
2. Restart workflow: `artifacts/tax-able: web`
