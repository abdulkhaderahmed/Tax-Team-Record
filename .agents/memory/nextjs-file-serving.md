---
name: Next.js file serving quirks
description: Gotchas when serving binary files from Next.js API routes and using Node.js packages in server actions.
---

## Rule
- `new NextResponse(buffer, ...)` fails type-check — `Buffer` is not assignable to `BodyInit`. Wrap with `new Uint8Array(buffer)`.
- `pdf-parse` cannot be imported with ESM `import`. Use `require('pdf-parse')` with a cast inside an async function.

**Why:** Next.js 15 TypeScript types for `NextResponse` accept `BodyInit | null | undefined`, and `Buffer` (despite being a Uint8Array subclass at runtime) doesn't satisfy the strict union. ESM import of pdf-parse fails due to its CommonJS structure.

**How to apply:** In any API route returning binary data, use `new Uint8Array(buffer)` as the body. In any server action using pdf-parse or other CJS packages, use `require()` inside the function body.
