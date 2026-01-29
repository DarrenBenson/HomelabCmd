# Codebase Best Practices Audit Report

## Summary
The codebase generally adheres to modern best practices, particularly in API design and project structure. However, there are specific areas where strict safety rules are violated.

## TypeScript (Frontend)

### ✅ Compliant
- **Strict Mode:** Enabled in `tsconfig.json`.
- **No `any` usage:** Code uses strict typing.
- **Enums:** Correctly uses Union Types (`type Foo = 'a' | 'b'`) instead of TypeScript `enum`, which avoids runtime overhead (verified in `src/types/cost.ts`).
- **Async Safety:** Promises are generally handled correctly.

### ⚠️ Violations
- **Non-Null Assertions (`!`):** Found usage of `!` which bypasses strict null checks and risks runtime crashes.
  - `src/components/NetworkDiscovery.tsx`: `discovery.devices!.map(...)` assumes `devices` is always present.
  - `src/components/AlertDetailPanel.tsx`: `onRestartService!(..., alert.service_name!)` assumes props and optional fields are present.
  - **Recommendation:** Replace with optional chaining (`?.`) or explicit `if` guards.

## Python (Backend & Agent)

### ✅ Compliant
- **HTTP Client:** Uses `httpx` with explicit timeouts (`timeout=10.0`) instead of `requests` (verified in `notifier.py`).
- **Logging:** Uses `logging` module properly; no `print()` statements found in application code.
- **Resource Management:** Database sessions use context managers.

### ⚠️ Violations
- **Broad Exception Handling:** Multiple instances of `except Exception:` which can hide bugs.
  - `agent/collectors.py`: Catches all exceptions during metric collection. While this prevents the agent from crashing, it should ideally catch specific exceptions (like `psutil.Error`) or log the traceback more explicitly.
  - `backend/src/homelab_cmd/db/session.py`: Catches `Exception` to rollback. This is acceptable as it re-raises the exception.
  - **Recommendation:** Refactor `agent/collectors.py` to catch specific exceptions where possible.

## Action Plan
1. **Frontend:** Refactor `NetworkDiscovery.tsx` and `AlertDetailPanel.tsx` to remove `!` operators.
2. **Backend:** Review `agent/collectors.py` to narrow exception handling.
