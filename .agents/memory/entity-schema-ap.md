---
name: Entity schema — accounting period representation
description: Why accounting period uses DateTime fields, and how obligations engine consumes them
---

The Entity model stores the accounting period as two `DateTime?` fields:
- `accountingPeriodStart DateTime?`
- `accountingPeriodEnd DateTime?`

Earlier versions used `accountingYearEndMonth Int` and `accountingYearEndDay Int`. Those were removed when the user requested full date fields.

**Why:** Full date fields allow exact period tracking (e.g. short periods, off-calendar years) and are what the user's register needs. Integer month/day was an approximation.

**How to apply:** The obligations engine (`src/lib/obligations.ts`) extracts month and day from `accountingPeriodEnd` at runtime:
```ts
const apMonth = entity.accountingPeriodEnd.getMonth() + 1;
const apDay = entity.accountingPeriodEnd.getDate();
```
Never add back the integer fields. If CT obligations aren't generating, check that `accountingPeriodEnd` is set on the entity AND `ctReturnRequired` is true.
