# Tax-Able

Tax obligations register for in-house tax teams — tracks entities, generates obligations calendars, and maintains a full audit log.

## Run & Operate

- `pnpm --filter @workspace/tax-able run dev` — start the Next.js app (port 25975, proxied to `/`)
- `pnpm --filter @workspace/tax-able run db:generate` — regenerate Prisma client after schema changes
- `pnpm --filter @workspace/tax-able run db:seed` — re-seed obligation rules + demo org/user (idempotent)
- `pnpm --filter @workspace/tax-able run typecheck` — typecheck the app
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- Next.js 15 (App Router, Server Actions, server components)
- PostgreSQL + Prisma ORM (migrations in `prisma/migrations/`)
- TypeScript, plain CSS (no Tailwind)

## Where things live

- `artifacts/tax-able/prisma/schema.prisma` — canonical DB schema (source of truth)
- `artifacts/tax-able/prisma/migrations/` — migration history; run `prisma migrate dev --name <name>` to add a migration
- `artifacts/tax-able/prisma/seed.ts` — seeds obligation rules + demo org/user
- `artifacts/tax-able/src/lib/obligations.ts` — obligation date-calculation engine
- `artifacts/tax-able/src/lib/prisma.ts` — singleton Prisma client
- `artifacts/tax-able/src/app/actions/entities.ts` — Server Actions (createEntity, saveObligations, deleteEntity)

## Database models

| Model | Purpose |
|---|---|
| Organisation | Top-level tenant |
| User | Member of an organisation (role: admin / member) |
| Entity | UK company/entity being tracked |
| ObligationRule | Seeded rule definitions (CT600, VAT, P11D, ERS, QIPs…) |
| Obligation | Generated due-date instance tied to an entity + rule |
| AuditEvent | Append-only log of actions (entityId, userId, action, detail) |

## Migrations

Schema changes must go through `prisma migrate dev`:
```bash
# After editing schema.prisma:
pnpm --filter @workspace/tax-able run db:generate
# Creates and applies a new migration:
cd artifacts/tax-able && pnpm exec prisma migrate dev --name <descriptive_name>
```

Never use `db push` on this project — migrations are the source of truth.

## Seed data

- **Org:** Acme Tax Ltd (id: `demo-org`)
- **User:** Alex Smith — alex@acmetax.co.uk — role: admin
- **Rules:** 10 obligation rules (CT600, CT payment, QIP 1–4, VAT quarterly, P11D, P11D(b), ERS)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `prisma migrate dev` needs shadow-database access; works on Replit's PostgreSQL (CREATE DATABASE privileges are available).
- Always run `db:generate` after schema changes before typechecking.
- The app runs on port 25975 (set by `PORT` env var from `artifact.toml`).
