# BG0021: Broad Exception Handling in Connectivity Service

> **Status:** Fixed
> **Severity:** Critical
> **Priority:** P1
> **Reporter:** Claude (Code Review)
> **Assignee:** Claude
> **Created:** 2026-01-27
> **Updated:** 2026-01-27

## Summary

The `connectivity_service.py` uses bare `except Exception` clauses that catch all exceptions including critical system errors like `MemoryError`, `KeyboardInterrupt`, and `asyncio.CancelledError`. This masks bugs and can cause silent failures.

## Affected Area

- **Epic:** [EP0008: Tailscale Integration](../epics/EP0008-tailscale-integration.md)
- **Story:** [US0080: Connectivity Mode Management](../stories/US0080-connectivity-mode-management.md)
- **Component:** Backend Services / Connectivity

## Environment

- **Version:** Current main
- **Platform:** All
- **Browser:** N/A (Backend service)

## Reproduction Steps

1. Trigger an out-of-memory condition during connectivity check
2. Observe that the error is silently caught and logged as a generic error
3. System continues in undefined state instead of failing properly

## Expected Behaviour

Exception handlers should:
1. Catch specific exception types only
2. Allow critical system exceptions to propagate
3. Never catch `asyncio.CancelledError` (breaks async cancellation)
4. Never catch `KeyboardInterrupt` or `SystemExit`

## Actual Behaviour

All exceptions are caught with `except Exception`, masking:
- Programming errors (AttributeError, TypeError)
- Resource exhaustion (MemoryError)
- Async cancellation (asyncio.CancelledError)
- System interrupts

## Screenshots/Evidence

Code locations in `backend/src/homelab_cmd/services/connectivity_service.py`:
- Line 64: `except Exception as e:`
- Line 93: `except Exception as e:`
- Line 137: `except Exception as e:`
- Line 170: `except Exception as e:`

## Root Cause Analysis

Defensive coding that went too far - catching all exceptions to prevent crashes, but this creates harder-to-debug silent failures.

The TailscaleService already defines specific exception types:
- `TailscaleError` (base class)
- `TailscaleAuthError`
- `TailscaleConnectionError`
- `TailscaleRateLimitError`
- `TailscaleNotConfiguredError`

These should be the only exceptions caught at the connectivity service level.

## Fix Description

Replaced all `except Exception` handlers with `except TailscaleError`:

1. **Line 64**: `detect_connectivity_mode()` - catches TailscaleError during token validation
2. **Line 93**: `_test_tailscale_connection()` - catches TailscaleError during connection test
3. **Line 137**: `_get_tailscale_info()` - catches TailscaleError when getting tailnet info
4. **Line 170**: `_get_tailscale_device_count()` - catches TailscaleError when counting devices

Added import for `TailscaleError` from `tailscale_service` module.

### Files Modified

| File | Change |
|------|--------|
| `backend/src/homelab_cmd/services/connectivity_service.py` | Replaced 4x `except Exception` with `except TailscaleError` |
| `tests/test_connectivity_settings.py` | Added 5 regression tests for exception handling |

### Tests Added

| Test ID | Description | File |
|---------|-------------|------|
| TC-BG0021-01 | TailscaleError caught gracefully | `tests/test_connectivity_settings.py` |
| TC-BG0021-02 | AttributeError propagates (not caught) | `tests/test_connectivity_settings.py` |
| TC-BG0021-03 | CancelledError propagates (not caught) | `tests/test_connectivity_settings.py` |
| TC-BG0021-04 | _get_tailscale_info catches only TailscaleError | `tests/test_connectivity_settings.py` |
| TC-BG0021-05 | _get_device_count catches only TailscaleError | `tests/test_connectivity_settings.py` |

## Verification

- [x] Fix verified in development
- [x] Regression tests pass (1497 tests passing)
- [x] No side effects observed
- [ ] Documentation updated (if applicable)

**Verified by:** -
**Verification date:** -

## Related Items

| Type | ID | Description |
|------|-----|-------------|
| Story | US0080 | Connectivity Mode Management |

## Notes

Python best practice is to catch the narrowest exception type possible. The `except Exception` pattern should be reserved for top-level error handlers only.

The fix ensures:
- `asyncio.CancelledError` propagates correctly (required for proper async cancellation)
- Programming errors (AttributeError, TypeError, etc.) propagate and are visible in logs
- Only expected network/API errors are caught and handled gracefully

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-27 | Claude | Bug reported from code review |
| 2026-01-27 | Claude | Status → In Progress, began investigation |
| 2026-01-27 | Claude | Status → Fixed, replaced except Exception with except TailscaleError |
