# SPEC-001 — Authentication and org scoping

Status: ready · Owner: Devin · Blocks: everything user-facing · Decision basis: D-004 (Clerk)

## Problem
The deployed app is public. `ORG_ID = "demo-org"` is hardcoded in every server action and page. No user identity exists, so audit events can't attribute actors — which breaks the product's core audit promise.

## Approach
Clerk (`@clerk/nextjs`) with Clerk **Organizations** mapped 1:1 to our `Organisation` rows. Chosen over Auth0 (pricing/DX at this stage) and over hand-rolled NextAuth credentials (session+org management is undifferentiated heavy lifting; we'd rather own zero password surface). Counterfactual details → explainer required by EXPLAINER_STANDARD.

## Requirements
1. Middleware-protect every route except `/sign-in`, `/sign-up`, and static assets. No public marketing page yet — the app root redirects unauthenticated → sign-in.
2. `Organisation` table: add `clerkOrgId` (unique, nullable during migration). On first sign-in without an org, create Organisation + link; invited users join the existing one.
3. Replace every hardcoded `ORG_ID` with a `requireOrg()` helper (server-side): reads Clerk session → resolves internal org id → throws redirect if absent. Single choke point, greppable.
4. Row scoping: every Prisma query filters by resolved `organisationId`. Audit: grep for `demo-org` must return zero hits in app code when done.
5. `User` linkage: store `clerkUserId` on our user record; audit events record the internal user id (existing seeded user becomes the migration fallback for historic events).
6. Roles v1: `admin` and `member` via Clerk org roles. Only gate: admin manages source-system priority rules and entity deletion. Fine-grained RACI permissions are Phase 2+, out of scope.
7. Seed/demo: keep Acme Tax Ltd reachable via a dedicated demo org bound to a test Clerk org, not via bypass code paths.
8. Secrets (`CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`) → Replit secrets; document in README.

## Exit criteria
- Unauthenticated request to any register route → redirected; API/file routes → 401.
- Two test orgs cannot see each other's rows (write a Prisma-level test proving cross-org isolation on obligations, documents, sources).
- Audit events show real user attribution for new mutations.
- `.next/` gitignored; `attached_assets/Pasted-*` relocated to `docs/history/` (bundled hygiene).
- Explainer files for middleware, `requireOrg`, and schema migration.
