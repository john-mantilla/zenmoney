---
name: gate-3-ui-smoke
description: Run presentation layer smoke tests verifying dashboard calculation flows, account classifications, and UI state integrity without rendering crashes or $0 balance defaults.
---

# Gate 3: UI & Presentation Smoke Tests

## Purpose
Prevent runtime bugs in frontend components where data fetching, aggregations, or filters fail silently and leave screens displaying `$0`, blank lists, or broken balances.

## Execution Command
```powershell
cd zenmoney
npx vitest run src/presentation
```

## Test Scope Covered
- `DashboardSmoke.test.ts`: Validates account classification (liquid, investment, credit card, loan), excludes inactive accounts from main balance while preserving them for management, and ensures income/expense calculation produces correct totals.
- `CashFlowForecastChart.test.ts`: Validates chart scales and negative balance rendering.
- `accountIcons.test.ts`: Validates bank/card icon resolution and asset fallbacks.

## Pass / Fail Criteria
- **PASS**: All presentation smoke tests exit with code 0.
- **FAIL**: Any presentation smoke test fails. Investigate component state cascades and ensure data transformations handle edge cases safely.
