# BG0003: Scan Type Not Clearly Displayed on Results Page

> **Status:** Closed
> **Severity:** Low
> **Priority:** P3
> **Reporter:** User
> **Assignee:** Claude
> **Created:** 2026-01-21
> **Updated:** 2026-01-21

## Summary

The scan results page does not clearly indicate whether a quick scan or full scan was performed. Users expect to see more data (processes, network interfaces, packages) but these are only included in full scans. The scan type should be prominently displayed so users understand why certain sections are or aren't present.

## Affected Area

- **Epic:** [EP0006: Ad-hoc Scanning](../epics/EP0006-adhoc-scanning.md)
- **Story:** [US0039: Scan Results Display](../stories/US0039-scan-results-display.md)
- **Component:** Frontend - ScanResultsPage

## Environment

- **Version:** 1.0.0
- **Platform:** All
- **Browser:** All browsers

## Reproduction Steps

1. Run a quick scan on a device
2. View the scan results
3. Notice the results show OS, hostname, disk, memory
4. Wonder why processes/network/packages aren't shown
5. No clear indication that this was a "Quick Scan" vs "Full Scan"

## Expected Behaviour

Scan results page should clearly display the scan type:

**Option A: Prominent header badge**
```
Scan Results: media-server
[Quick Scan] Completed 2 hours ago
```

**Option B: Info banner explaining scope**
```
┌─────────────────────────────────────────────────────┐
│ ℹ️ Quick Scan - Shows system overview only.         │
│    Run a Full Scan for processes, network, packages │
└─────────────────────────────────────────────────────┘
```

**Option C: Section headers indicating availability**
```
## System Info ✓
## Disk Usage ✓
## Memory Usage ✓
## Processes (Full Scan Only)
## Network Interfaces (Full Scan Only)
## Installed Packages (Full Scan Only)
```

## Actual Behaviour

The scan type is shown in a small label but it's not prominent enough to explain why certain data sections are missing. Users viewing results don't immediately understand the relationship between scan type and available data.

## Screenshots/Evidence

Current display shows scan type in the header but doesn't explain that quick scans have limited data:

```tsx
// ScanResultsPage.tsx shows scan_type but without context
<p className="text-xs text-text-tertiary">
  {scan.scan_type === 'full' ? 'Full Scan' : 'Quick Scan'}
</p>
```

## Root Cause Analysis

The scan type label is present but:
1. Not visually prominent enough
2. Doesn't explain the data scope difference
3. Missing sections aren't shown with "requires full scan" messaging

This is a UX clarity issue, not a data bug - the output is correct for the scan type performed.

## Fix Description

### Changes Made

1. **Added prominent scan type badge** in header next to hostname
   - Quick Scan: Amber badge with Zap icon
   - Full Scan: Blue badge with ScanLine icon

2. **Added info banner for quick scans** explaining the limited scope
   - Clearly states what quick scans include
   - Mentions Full Scan shows additional data

3. **Added placeholder sections** for full-scan-only data when viewing quick scan results
   - Greyed-out cards for Processes, Network Interfaces, Packages
   - Each shows "Full Scan Only" badge
   - Explains what each section would contain

### Files Modified

| File | Change |
|------|--------|
| `frontend/src/pages/ScanResultsPage.tsx` | Added scan type badge, info banner, placeholder sections for quick scans |
| `frontend/src/__tests__/scan-results.test.tsx` | Updated tests to verify new badge, info banner, and placeholder behaviour |

### Tests Updated

| Test ID | Description | File |
|---------|-------------|------|
| TC301-TC303 | Quick scan shows type badge, info banner, and placeholders | scan-results.test.tsx |
| TC304-TC306 | Full scan shows type badge, actual sections (no placeholders) | scan-results.test.tsx |

## Verification

### Verification Results

- [x] Scan type clearly visible on results page
  - Prominent badge next to hostname (amber for Quick, blue for Full)
  - Uses Zap icon for Quick, ScanLine icon for Full
- [x] Quick scan results explain limited scope
  - Info banner explains what quick scans include
  - Mentions Full Scan for processes, network, packages
- [x] Full-scan-only sections show helpful placeholder on quick scans
  - Three greyed-out placeholder cards for Processes, Network, Packages
  - Each shows "Full Scan Only" badge
  - Each explains what the section would contain
- [x] Full scans display all sections normally
  - Full scan shows actual ScanProcessList, ScanNetworkInterfaces, ScanPackageList
- [x] No regression in existing functionality
  - All 29 scan results tests passing

**Verified by:** Claude
**Verification date:** 2026-01-21

## Related Items

| Type | ID | Description |
|------|-----|-------------|
| Story | US0039 | Scan Results Display |
| Story | US0038 | Scan Initiation |
| Epic | EP0006 | Ad-hoc Scanning |

## Notes

This is a UX clarity issue, not a functional bug. The system is working correctly - quick scans return quick scan data, full scans return full scan data. The issue is that users don't immediately understand this relationship when viewing results.

Consider also improving the scan initiation UI to make the quick/full choice more prominent with clear explanation of what each includes.

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-21 | User | Bug reported |
| 2026-01-21 | User | Clarified: UX issue, not missing data. Downgraded to P3/Low |
| 2026-01-21 | Claude | Status → In Progress |
| 2026-01-21 | Claude | Fix implemented: scan type badge, info banner, placeholders |
| 2026-01-21 | Claude | Status → Fixed, tests updated and passing |
| 2026-01-21 | Claude | Status → Verified, all checklist items confirmed |
