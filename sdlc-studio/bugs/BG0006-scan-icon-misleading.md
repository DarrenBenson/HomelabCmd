# BG0006: System Scan Icon Uses Misleading Search Magnifying Glass

> **Status:** Closed
> **Severity:** Low
> **Priority:** P3
> **Reporter:** User
> **Assignee:** Claude
> **Created:** 2026-01-21
> **Updated:** 2026-01-21

## Summary

The system scan link on the home page (Dashboard) uses a magnifying glass icon (`Search` from lucide-react), which is conventionally associated with text/content search functionality. This creates confusion as users may expect a search dialog rather than navigation to the Scans page.

## Affected Area

- **Epic:** [EP0006: Ad-hoc Scanning](../epics/EP0006-adhoc-scanning.md)
- **Story:** N/A (Dashboard navigation)
- **Component:** Frontend - Dashboard header

## Environment

- **Version:** 1.0.0
- **Platform:** All
- **Browser:** All browsers

## Reproduction Steps

1. Navigate to the home page (Dashboard)
2. Observe the icon in the header next to the Settings cog
3. Note the magnifying glass icon
4. Click it - navigates to Scans page (not a search dialog)

## Expected Behaviour

The Scans link should use an icon that represents system scanning/discovery rather than search. Suitable alternatives:
- `Scan` or `ScanLine` - explicitly represents scanning
- `Radar` - represents network discovery
- `Monitor` or `Server` - represents system inspection
- `Activity` - represents system monitoring

## Actual Behaviour

Uses `Search` icon (magnifying glass) which conventionally means "search for content" in UI design, not "system scanning".

## Screenshots/Evidence

Current code in `Dashboard.tsx` (lines 17 and 295-302):

```tsx
import { ..., Search } from 'lucide-react';

<Link
  to="/scans"
  className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-secondary rounded-md transition-colors"
  aria-label="Scans"
  data-testid="scans-link"
>
  <Search className="w-5 h-5" />
</Link>
```

## Root Cause Analysis

Icon selection during initial implementation didn't consider the semantic meaning of the magnifying glass icon in standard UI conventions.

## Fix Description

### Solution Chosen

**Option B: Radar** - This icon conveys "scanning the network to find things" which matches the ad-hoc scanning/discovery feature well.

### Changes Made

1. **Updated import** in `Dashboard.tsx` (line 17)
   - Changed `Search` to `Radar` in lucide-react import

2. **Updated icon usage** in `Dashboard.tsx` (line 301)
   - Changed `<Search className="w-5 h-5" />` to `<Radar className="w-5 h-5" />`

### Files Modified

| File | Change |
|------|--------|
| `frontend/src/pages/Dashboard.tsx` | Replaced Search icon with Radar |

### Tests

No new tests needed - existing tests verify the scans-link element exists. Icon appearance is a visual change that doesn't affect functionality.

## Verification

- [x] Icon visually represents "scanning" not "searching" (Radar icon)
- [x] Aria-label remains appropriate (`aria-label="Scans"`)
- [x] No regression in navigation functionality
- [x] Tests pass (56 Dashboard tests, 875 total)

**Verified by:** Claude
**Verification date:** 2026-01-21

### Verification Evidence

- Dashboard.tsx line 17: `import { ..., Radar } from 'lucide-react'`
- Dashboard.tsx line 302: `<Radar className="w-5 h-5" />`
- Tooltip added: `title="Scans"` for hover text

## Related Items

| Type | ID | Description |
|------|-----|-------------|
| Epic | EP0006 | Ad-hoc Scanning |

## Notes

This is a UX polish issue. The current functionality works correctly - only the visual affordance is misleading. Consider reviewing other icons across the application for similar semantic mismatches.

Lucide-react icon options: https://lucide.dev/icons/

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-21 | User | Bug reported |
| 2026-01-21 | Claude | Status → In Progress |
| 2026-01-21 | Claude | Fix implemented: replaced Search icon with ScanLine |
| 2026-01-21 | Claude | Status → Fixed, 876 tests passing |
| 2026-01-21 | Claude | Changed icon to Radar per user preference |
| 2026-01-21 | Claude | Status → Verified |
