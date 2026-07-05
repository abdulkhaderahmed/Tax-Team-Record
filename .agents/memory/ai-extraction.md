---
name: AI extraction pattern
description: Quirks building Zod-validated AI extraction with Prisma Json fields and OpenAI structured output.
---

## Rules

- Prisma `Json` field rejects `Record<string, unknown>` directly — cast to `as object` before passing to `createMany`.
- OpenAI structured output: use `response_format: { type: "json_schema", json_schema: { strict: true, schema: ... } }` with `chat.completions.create`. The `schema` must use `additionalProperties: false` at every level.
- Zod `discriminatedUnion` on `itemType` is the right pattern for per-type validation.
- `gpt-4o` is used (not gpt-5.x) since the user supplied their own API key — gpt-4o supports `json_schema` response_format.
- User's OPENAI_API_KEY stored as a Replit Secret.

**Why:** Prisma's InputJsonValue type doesn't include plain Record types — needs explicit cast. OpenAI structured output requires additionalProperties:false throughout for strict mode.

**How to apply:** Any future AI extraction call: cast data payloads to `as object` for Prisma Json fields. Always validate AI output with Zod before saving — on validation failure, mark run as Failed and store error message.
