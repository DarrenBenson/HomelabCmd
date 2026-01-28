# BG0005: Scan Detail Back Button Navigates to Home Instead of History

> **Status:** Closed
> **Severity:** Low
> **Priority:** P3
> **Reporter:** User
> **Assignee:** Claude
> **Created:** 2026-01-21
> **Updated:** 2026-01-21

## Summary

The back button on the scan detail page (`/scans/{id}`) navigates to the home page (dashboard) instead of returning to the scan history list. This breaks expected navigation flow when browsing scan history.

## Affected Area

- **Epic:** [EP0006: Ad-hoc Scanning](../epics/EP0006-adhoc-scanning.md)
- **Story:** [US0040: Scan History View](../stories/US0040-scan-history.md)
- **Component:** Frontend - ScanResultsPage

## Environment

- **Version:** 1.0.0
- **Platform:** All
- **Browser:** All browsers

## Reproduction Steps

1. Navigate to Scans page (`/scans`)
2. Click "View History" or navigate to scan history
3. Click on a scan to view details (`/scans/{id}`)
4. Click the back button/link
5. Observe navigation goes to home page, not scan history

## Expected Behaviour

Back button should return user to the previous page (scan history list) or at minimum to the scans page (`/scans`), preserving navigation context.

## Actual Behaviour

Back button navigates to home page (`/`), losing navigation context.

## Screenshots/Evidence

Current code in `ScanResultsPage.tsx`:
```tsx
<Link
  to="/"
  className="mb-4 inline-flex items-center gap-2 text-text-tertiary hover:text-text-primary"
>
  <ArrowLeft className="h-4 w-4" />
  Back to Dashboard
</Link>
```

## Root Cause Analysis

The back link is hardcoded to navigate to `/` (dashboard) rather than using browser history or navigating to `/scans` or `/scans/history`.

## Fix Description

### Solution Chosen

**Option B: Navigate to scans page** - This is the most reliable approach as it ensures consistent navigation regardless of how the user arrived at the scan details page.

### Changes Made

1. **Updated back link destination** in `ScanResultsPage.tsx`
   - Changed `to="/"` to `to="/scans"` in all four locations:
     - Not found state (line 110)
     - Pending/Running state (line 155)
     - Failed state (line 194)
     - Completed state (line 230)
   - Changed link text from "Back to Dashboard" to "Back to Scans"

2. **Note:** The error state already used `navigate(-1)` which is appropriate for error recovery.

### Files Modified

| File | Change |
|------|--------|
| `frontend/src/pages/ScanResultsPage.tsx` | Updated 3 back links from `/` to `/scans`, changed text to "Back to Scans" |
| `frontend/src/__tests__/scan-results.test.tsx` | Added 2 tests for back navigation |

### Tests Added

| Test ID | Description | File |
|---------|-------------|------|
| BG0005-01 | Back link navigates to scans page | scan-results.test.tsx |
| BG0005-02 | Not found page has back link to scans | scan-results.test.tsx |

## Verification

- [x] Back button from scan detail returns to scans page
- [x] Navigation flow feels natural
- [x] No regression in other navigation (87 tests passing)

**Verified by:** Claude
**Verification date:** 2026-01-21

### Verification Evidence

All 4 scan states now navigate to `/scans`:
- Not found state (line 110)
- Pending/Running state (line 155)
- Failed state (line 194)
- Completed state (line 230)

Tests: 31 scan-results tests passing, 56 Dashboard tests passing.

## Related Items

| Type | ID | Description |
|------|-----|-------------|
| Story | US0039 | Scan Results Display |
| Story | US0040 | Scan History View |
| Epic | EP0006 | Ad-hoc Scanning |

## Notes

Consider whether "Back to Dashboard" is intentional UX or an oversight. If intentional, this may be a feature request rather than a bug. However, standard UX patterns suggest back buttons should return to the previous context.

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-21 | User | Bug reported |
| 2026-01-21 | Claude | Status → In Progress |
| 2026-01-21 | Claude | Fix implemented: back links now navigate to /scans |
| 2026-01-21 | Claude | Status → Fixed, 876 tests passing |
| 2026-01-21 | Claude | Fixed missed failed state back link (user verification) |
| 2026-01-21 | Claude | Status → Verified |
