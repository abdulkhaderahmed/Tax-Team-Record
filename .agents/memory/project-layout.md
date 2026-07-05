---
name: Quarterday project file layout
description: Which src/ files are active Next.js code vs. deleted Vite scaffold
---

The project started with both a Next.js app router setup and a leftover Vite/shadcn scaffold in `src/`. The Vite scaffold (App.tsx, main.tsx, index.css, components/ui/*, hooks/, pages/, lib/utils.ts) was deleted in an early session because it caused TypeScript errors for packages that were never installed.

**Active Next.js files** (do not delete):
- `src/app/` — all Next.js App Router pages, layouts, and actions
- `src/lib/prisma.ts` — singleton Prisma client
- `src/lib/obligations.ts` — obligation date-calculation engine
- `src/components/nav.tsx` — AppShell layout component (header + sidebar + main)

**Why:** The tsconfig `include: ["**/*.ts", "**/*.tsx"]` picks up everything; any leftover scaffold with missing packages causes typecheck failures that block the dev server.

**How to apply:** If you see TS errors in `src/components/ui/` or `src/App.tsx`, those files should not exist — delete them rather than trying to fix them.
