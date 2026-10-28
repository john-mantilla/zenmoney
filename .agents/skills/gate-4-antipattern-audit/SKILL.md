---
name: gate-4-antipattern-audit
description: Audit code changes for silent try/catch blocks that swallow data-fetch exceptions, exposed sensitive credentials, and overly restrictive database queries.
---

# Gate 4: Anti-Pattern & Security Audit

## Purpose
Prevent recurring software development anti-patterns that create phantom bugs or security leaks in the application.

## Checklist & Review Rules

### 1. No Silent Swallowing of Core Data Fetch Exceptions
- **Anti-pattern:**
  ```typescript
  try {
    const data = await repo.getAll();
    setState(data);
  } catch (e) {
    console.warn(e); // User sees $0 or blank list, assuming zero balance/loss of funds!
  }
  ```
- **Approved Pattern:**
  Capture error state, display an explicit error banner or retry prompt to the user, or rethrow:
  ```typescript
  try {
    const data = await repo.getAll();
    setState(data);
  } catch (e) {
    console.error('[Screen] Failed loading data', e);
    setFetchError('No fue posible cargar tus movimientos. Toca para reintentar.');
  }
  ```

### 2. No Hardcoded Secrets or Public Credential Leaks
- Verify that `EXPO_PUBLIC_` is only used for non-sensitive public identifiers (like Supabase anonymous key).
- Master keys, AI API secret keys, service role keys, and private credentials MUST NOT be hardcoded in client source files.

### 3. Repository Query Contracts Must Not Filter Inactive Records Silently
- **Anti-pattern:** `SqliteAccountRepository.getAll()` hardcoding `WHERE is_active = 1`.
- **Approved Pattern:** Repository `getAll()` returns all records according to domain contract, allowing higher-level use cases and screens (e.g. Settings / Accounts management) to inspect and reactivate inactive records.

### 4. Verification Check
Review `git diff` against these 3 rules before approving changes.
