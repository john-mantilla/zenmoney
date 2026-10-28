---
name: gate-1-typecheck
description: Run TypeScript compiler static verification (tsc --noEmit) on the ZenMoney codebase to ensure zero compiler errors, no missing imports, and no undeclared variables.
---

# Gate 1: TypeScript Static Analysis & Type Checking

## Purpose
Enforce strict compiler checking to catch syntax errors, undeclared variables (such as orphan refactor leftovers), broken contracts, and invalid imports before any code is reviewed or merged.

## Execution Command
```powershell
cd zenmoney
npm run typecheck
```
*(Runs `tsc --noEmit`)*

## Pass / Fail Criteria
- **PASS**: Output exits with code 0. No `error TSxxxx` reported.
- **FAIL**: Any TypeScript error is detected. 
  - Stop immediately.
  - Review the line number and type mismatch reported by `tsc`.
  - Fix the root cause in the affected file. Never cast blindly to `any` unless third-party untyped library requires it.
