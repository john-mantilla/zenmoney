# Mandatory Quality Gates Enforcement Rule

Before completing any task, modifying code, or delivering solutions to the user in this repository, you MUST verify the changes against the 4 Quality Gates.

## The 4 Quality Gates

1. **Gate 1 (Typecheck & Static Analysis):**
   - Command: `cd zenmoney; npm run typecheck`
   - Requirement: `tsc --noEmit` MUST exit with code 0. Zero TypeScript compiler errors permitted. No undeclared variables or broken interfaces.

2. **Gate 2 (Full Test Suite):**
   - Command: `cd zenmoney; npm test`
   - Requirement: 100% of Vitest suites must pass (exit code 0, zero failures).

3. **Gate 3 (UI Smoke Tests):**
   - Command: `cd zenmoney; npx vitest run src/presentation`
   - Requirement: Presentation smoke tests must pass, guaranteeing dashboard balance calculations and data streams do not revert to $0 defaults.

4. **Gate 4 (Anti-Pattern & Security Audit):**
   - Requirement:
     - NO silent `catch (e) { ... }` blocks swallowing core data fetch exceptions in screens. Errors must be displayed to the user with a retry prompt.
     - NO hardcoded secrets, database service role keys, or sensitive AI tokens in client code.
     - NO restrictive filtering (e.g. `WHERE is_active = 1`) inside generic `repository.getAll()` methods that hides data from management screens.

## Quick Unified Verification
You can execute Gates 1, 2, and 3 simultaneously with:
```powershell
cd zenmoney; npm run verify:all
```
Never declare a task done or close an OpenSpec change if `verify:all` fails!
