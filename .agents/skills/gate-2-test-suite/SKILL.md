---
name: gate-2-test-suite
description: Run the complete Vitest test suite across domain, data repositories, infrastructure, and utilities, verifying 100% test pass rate.
---

# Gate 2: Full Test Suite Verification

## Purpose
Ensure that core domain business logic, data mapping, SQLite/Supabase synchronization, and utility functions function correctly with zero regressions.

## Execution Command
```powershell
cd zenmoney
npm test
```
*(Runs `vitest run`)*

## Pass / Fail Criteria
- **PASS**: All test files pass (60+ suites, 318+ tests). Exit code 0.
- **FAIL**: Any test assertion fails or errors out.
  - Inspect the failed test trace.
  - Determine if the business logic broke or if the test specification needs updating due to an intentional behavior change.
  - Fix the underlying code or test before proceeding.
