# BG0001: Critical badge styling implies error state

> **Status:** Closed
> **Severity:** Low
> **Priority:** Low
> **Reporter:** Darren
> **Assignee:** Unassigned
> **Created:** 2026-01-19
> **Updated:** 2026-01-19

## Summary

The red "CRITICAL" badge on service cards is misleading. Users interpret it as an error/alert state rather than its intended meaning of "this service is important to monitor."

## Affected Area

- **Epic:** [EP0003: Service Monitoring](../epics/EP0003-service-monitoring.md)
- **Story:** [US0020: Service Status Display](../stories/US0020-service-status-display.md)
- **Component:** Frontend - ServiceCard

## Environment

- **Version:** Current
- **Platform:** Web
- **Browser:** All

## Reproduction Steps

1. Navigate to server detail page
2. View a service marked as critical (is_critical: true)
3. Observe the red "CRITICAL" badge

## Expected Behaviour

User understands that "critical" means the service is important/high-priority for monitoring, not that it's in an error state.

## Actual Behaviour

Red badge with "CRITICAL" text looks like an error or alert, causing confusion about service state.

## Screenshots/Evidence

Current implementation in `ServiceCard.tsx:34-41`:
```tsx
{service.is_critical && (
  <span
    className="rounded bg-status-error px-2 py-0.5 font-mono text-xs text-bg-primary"
    data-testid="critical-badge"
  >
    CRITICAL
  </span>
)}
```

## Root Cause Analysis

Design choice used red (`bg-status-error`) for the critical badge, which conflicts with the visual language where red indicates errors/problems.

## Fix Description

Applied approaches 1 and 2 from the suggested solutions:

1. **Changed text from "CRITICAL" to "Core Service"** - Clear, non-alarming terminology that communicates the service is important without implying an error state.
2. **Changed badge colour from red (`bg-status-error`) to cyan (`bg-status-info`)** - Neutral colour that indicates importance without alarm.

### Files Modified

| File | Change |
|------|--------|
| `frontend/src/components/ServiceCard.tsx` | Changed badge text to "Core Service", colour to `bg-status-info` |
| `frontend/src/components/ServiceCard.test.tsx` | Updated test to check for "Core Service" text |

### Tests Added

| Test ID | Description | File |
|---------|-------------|------|
| - | No new tests needed - existing tests updated | - |

## Verification

- [x] Fix verified in development
- [x] Regression tests pass (19/19 ServiceCard tests)
- [x] No side effects observed
- [x] Documentation updated (if applicable)

**Verified by:** Darren
**Verification date:** 2026-01-19

## Related Items

| Type | ID | Description |
|------|-----|-------------|
| Story | US0020 | Service Status Display in Server Detail |

## Notes

User feedback: "I thought it meant they were in a critical state"

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-19 | Darren | Bug reported |
| 2026-01-19 | Claude | Fixed: Changed badge to "Core Service" with cyan styling |
| 2026-01-19 | Darren | Verified: Fix confirmed in UI and tests |
| 2026-01-19 | Darren | Closed |
