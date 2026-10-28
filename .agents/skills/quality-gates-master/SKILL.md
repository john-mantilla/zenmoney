---
name: quality-gates-master
description: Master orchestrator that executes all 4 Quality Gates (Typecheck, Full Test Suite, UI Smoke, and Anti-Pattern Audit) in sequence. Mandatory before completing any task.
---

# Quality Gates Master: Comprehensive Verification Suite

## Purpose
Execute all verification gates in sequential order to guarantee zero compiler errors, zero test regressions, UI data integrity, and architectural compliance.

## Automated Execution Pipeline
Run the consolidated verification command:
```powershell
cd zenmoney
npm run verify:all
```
*(Executes `tsc --noEmit && vitest run` covering Gates 1, 2, and 3)*

## Verification Flow
1. **Gate 1 (Static Analysis)**: `tsc --noEmit` ensures zero TypeScript errors and no missing variables.
2. **Gate 2 (Domain & Data Tests)**: `vitest run` runs 60+ test suites (318+ tests).
3. **Gate 3 (UI Smoke Tests)**: `src/presentation/__tests__` verifies dashboard data math, balances, and classification.
4. **Gate 4 (Anti-Pattern Audit)**: Verify `git diff` for silent catch blocks, credential leaks, and repository contract consistency.

## Enforcement Rule
If ANY gate fails:
- **Do not mark tasks as completed in OpenSpec.**
- **Do not push commits or deploy to Vercel/EAS.**
- Fix the root cause and rerun `npm run verify:all` until all gates return clean green (code 0).
