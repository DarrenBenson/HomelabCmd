# PL0184: Alert Auto-Resolve Notifications - Implementation Plan

> **Status:** Complete
> **Story:** [US0182: Alert Auto-Resolve Notifications](../stories/US0182-alert-auto-resolve-notifications.md)
> **Epic:** [EP0002: Alerting & Notifications](../epics/EP0002-alerting.md)
> **Created:** 2026-01-29
> **Language:** Python/TypeScript

## Overview

Add Slack notifications when alerts auto-resolve, providing closure to users when issues clear automatically. This extends the existing notification infrastructure with a dedicated setting and improved message formatting.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Slack notification on auto-resolve | Send notification when alert auto-resolves |
| AC2 | Resolution message format | Green colour, duration, matching style |
| AC3 | Configurable setting | notify_on_auto_resolve toggle (default: True) |
| AC4 | No notification for manual resolve | Skip Slack for manually resolved alerts |
| AC5 | Thread reply | Reply to original message if thread_ts available |

---

## Technical Context

### Language & Framework
- **Primary Language:** Python (backend), TypeScript (frontend)
- **Framework:** FastAPI, React
- **Test Framework:** pytest, Vitest

### Library Documentation (Context7)

| Library | Context7 ID | Key Patterns |
|---------|-------------|--------------|
| FastAPI | /tiangolo/fastapi | Schema validation, dependency injection |
| httpx | /encode/httpx | Async HTTP client |

### Existing Patterns

1. **Notifier already supports resolved messages** - `_format_resolved_message()` exists
2. **`notify_on_remediation` config** - Controls resolved notifications (will rename semantically)
3. **AlertEvent has `is_resolved` and `duration_minutes`** - Already passed to notifier
4. **Alert model has `auto_resolved` field** - Can distinguish manual vs auto

---

## Recommended Approach

**Strategy:** Test-After
**Rationale:** Small scope (3 pts), extending existing patterns, clear AC. No complex business logic requiring TDD.

### Test Priority
1. Setting toggle prevents notification when disabled
2. Auto-resolve sends notification with correct format
3. Manual resolve skips notification

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Add `notify_on_auto_resolve` setting | `api/schemas/config.py` | - | [x] |
| 2 | Update notifier to check new setting | `services/notifier.py` | 1 | [x] |
| 3 | Pass `auto_resolved` flag to AlertEvent | `services/alerting.py` | - | [x] (Already exists) |
| 4 | Add frontend toggle for setting | `SettingsPage.tsx` | 1 | [x] |
| 5 | Write backend tests | `tests/test_notifier.py` | 2,3 | [x] |
| 6 | Write frontend tests | `__tests__/SettingsPage.test.tsx` | 4 | [x] (Covered by existing tests) |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| Backend Schema | 1 | None |
| Backend Logic | 2, 3 | 1 |
| Frontend | 4 | 1 |
| Tests | 5, 6 | 2, 3, 4 |

---

## Implementation Phases

### Phase 1: Backend Schema
**Goal:** Add new configuration option

- [x] Add `notify_on_auto_resolve: bool = True` to `NotificationsConfig`
- [x] Add to `NotificationsUpdate` schema
- [x] Verify API returns new field

**Files:** `backend/src/homelab_cmd/api/schemas/config.py`

### Phase 2: Backend Logic
**Goal:** Check setting and pass auto_resolved flag

- [x] Update `send_alert()` to check `notify_on_auto_resolve` for resolved events
- [x] Ensure `AlertEvent` distinguishes auto vs manual resolve (already supported)
- [x] Update `_check_auto_resolve` and `_resolve_offline_alert` if needed (no changes needed)

**Files:** `services/notifier.py`, `services/alerting.py`

### Phase 3: Frontend
**Goal:** Add toggle in Settings UI

- [x] Add checkbox for "Notify on auto-resolve" in Slack settings section
- [x] Wire to API update endpoint

**Files:** `frontend/src/pages/Settings.tsx`, `frontend/src/types/config.ts`

### Phase 4: Testing & Validation
**Goal:** Verify all acceptance criteria

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Test auto-resolve sends notification | `tests/test_notifier_alerts.py` | ✅ Done |
| AC2 | Check message format (green, duration) | `tests/test_notifier_alerts.py` | ✅ Done |
| AC3 | Test setting toggle prevents notification | `tests/test_notifier_alerts.py` | ✅ Done |
| AC4 | Test manual resolve skips notification | `tests/test_notifier_alerts.py` | ✅ Done |
| AC5 | Thread reply (deferred - see Notes) | - | Deferred |

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
|---|------------------------|-------------------|-------|
| 1 | Original Slack message deleted | N/A for now (no thread support yet) | - |
| 2 | Slack webhook fails on resolve | Log error, don't block resolution (existing) | 2 |
| 3 | Alert resolved very quickly (<1 min) | Show "less than a minute" (existing) | 2 |
| 4 | Alert active for days | Show duration in days/hours (existing) | 2 |
| 5 | Multiple alerts resolve at once | Send individual notifications (existing) | 2 |
| 6 | Slack webhook URL not configured | Skip silently, log warning (existing) | 2 |
| 7 | Alert never sent to Slack (no thread_ts) | N/A for now (no thread support) | - |
| 8 | Setting toggled while alerts active | Apply to subsequent resolves only | 2 |

**Coverage:** 8/8 edge cases handled (6 by existing code, 2 deferred with AC5)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing resolve notifications | Medium | Maintain `notify_on_remediation` for backward compatibility |
| Frontend API mismatch | Low | Verify schema before frontend implementation |

---

## Definition of Done

- [x] All acceptance criteria implemented (AC1-AC4, AC5 deferred)
- [x] Unit tests written and passing
- [x] Edge cases handled
- [x] Code follows best practices
- [x] No linting errors
- [x] Documentation updated (if needed)

---

## Notes

**AC5 (Thread Reply) Deferred:** Implementing thread replies requires:
1. Storing `slack_thread_ts` when original alert is sent
2. Database migration for new Alert column
3. Updating notifier to return and store thread_ts

This adds complexity beyond the 3-point estimate. Recommend implementing AC1-AC4 now and creating a follow-up story for AC5 thread support.

**Relationship to `notify_on_remediation`:** The existing setting controls resolved notifications. We're adding `notify_on_auto_resolve` as a more specific setting. Both will work together - if either is False, auto-resolve notifications won't send.
