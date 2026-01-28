# BG0007: Recent Scans Shows Only IP Addresses Without Hostnames

> **Status:** Closed
> **Severity:** Low
> **Priority:** P3
> **Reporter:** User
> **Assignee:** Claude
> **Created:** 2026-01-21
> **Updated:** 2026-01-21

## Summary

Recent scans and scan history display only the IP address used when initiating the scan, making it difficult to identify which host was scanned. Users must remember which IP corresponds to which hostname, reducing usability.

## Affected Area

- **Epic:** [EP0006: Ad-hoc Scanning](../epics/EP0006-adhoc-scanning.md)
- **Story:** [US0040: Scan History View](../stories/US0040-scan-history.md)
- **Story:** [US0042: Scan Dashboard Integration](../stories/US0042-scan-dashboard-integration.md)
- **Component:** Frontend - RecentScans, ScanHistoryPage

## Environment

- **Version:** 1.0.0
- **Platform:** All
- **Browser:** All browsers

## Reproduction Steps

1. Navigate to Scans page
2. Initiate a scan using an IP address (e.g., `192.168.1.100`)
3. Wait for scan to complete
4. View Recent Scans section or Scan History
5. Observe only the IP address is shown

## Expected Behaviour

Scan list should display identifying information that helps users recognise the target host:

**Option A: Show hostname alongside IP**
```
192.168.1.100 (media-server)
```

**Option B: Resolve hostname automatically**
If the scan result contains OS/hostname information, display that instead of/alongside the IP.

**Option C: Show both in separate columns**
| Target | Hostname | Type | Status |
|--------|----------|------|--------|
| 192.168.1.100 | media-server | Full | Completed |

## Actual Behaviour

Only shows the value that was entered when initiating the scan:

| Hostname | Type | Status |
|----------|------|--------|
| 192.168.1.100 | Full | Completed |

No context is provided to help identify the host.

## Screenshots/Evidence

`RecentScans.tsx` (line 126):
```tsx
<p className="text-sm font-medium text-text-primary truncate group-hover:text-status-info">
  {scan.hostname}
</p>
```

`ScanHistoryPage.tsx` (line 325):
```tsx
<td className="px-4 py-3 text-sm text-text-primary font-mono">
  {scan.hostname}
</td>
```

The `hostname` field contains whatever was entered as the scan target (IP or hostname).

## Root Cause Analysis

The scan system stores the user-provided target value in the `hostname` field without:
1. Resolving the IP to a DNS hostname
2. Extracting the hostname from scan results (if available)
3. Storing both the target IP and discovered hostname

## Fix Description

### Solution Chosen

**Option A: Use discovered hostname from scan results** - Frontend-only fix using existing data.

The backend already returns `results.hostname` (discovered from the system) in the scan list response. The fix updates the frontend to display this when available, falling back to the target IP/hostname when not.

### Changes Made

1. **Updated `ScanListItem` type** in `frontend/src/types/scan.ts`
   - Added `results: ScanResults | null` field to access discovered hostname

2. **Updated `RecentScans.tsx`** (lines 125-133)
   - Primary display: `scan.results?.hostname || scan.hostname`
   - Secondary line shows target IP when different from discovered hostname

3. **Updated `ScanHistoryPage.tsx`** (lines 324-333)
   - Primary row: discovered hostname or target
   - Secondary row: target IP (shown only when different)

### Display Logic

```typescript
// Primary: Show discovered hostname, fall back to target
{scan.results?.hostname || scan.hostname}

// Secondary: Show target IP if different from discovered hostname
{scan.results?.hostname && scan.results.hostname !== scan.hostname && (
  <div className="text-xs text-text-tertiary">{scan.hostname}</div>
)}
```

### Files Modified

| File | Change |
|------|--------|
| `frontend/src/types/scan.ts` | Added `results` field to `ScanListItem` |
| `frontend/src/components/RecentScans.tsx` | Display discovered hostname with IP subtitle |
| `frontend/src/pages/ScanHistoryPage.tsx` | Display discovered hostname with IP on second line |

### Tests

No new tests needed - existing tests verify component rendering. The display change uses existing data from the API response.

## Verification

- [x] IP scans show discovered hostname when available
  - Scan 23: Target `10.0.0.115` displays discovered hostname `studypi400`
  - API returns `results.hostname` alongside `hostname` (target)
- [x] Hostname scans continue to work correctly
  - Scans 20-22: All show discovered hostnames from results
- [x] Failed scans show original target
  - Scan 19: Failed auth, displays target `10.0.0.209` (no results.hostname)
- [x] Scan history search still works
  - Search by IP `10.0.0.115` returns scans 23 and 12
- [x] No regression in scan functionality
  - 875 frontend tests passing

**Verified by:** Claude
**Verification date:** 2026-01-21

## Related Items

| Type | ID | Description |
|------|-----|-------------|
| Story | US0040 | Scan History View |
| Story | US0042 | Scan Dashboard Integration |
| Epic | EP0006 | Ad-hoc Scanning |

## Notes

This is a UX improvement. The scan system works correctly - it's a matter of displaying more helpful information to users.

Consider whether this should be:
1. **Frontend-only fix** - Display discovered hostname from scan results if available
2. **Backend enhancement** - Store and return both target and discovered hostname
3. **Combined approach** - Backend extracts and stores, frontend displays appropriately

The scan results already contain system info including `os_info.hostname` which could be used for display purposes.

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-21 | User | Bug reported |
| 2026-01-21 | Claude | Status → In Progress |
| 2026-01-21 | Claude | Fix implemented: display discovered hostname from results |
| 2026-01-21 | Claude | Status → Fixed, 875 tests passing |
| 2026-01-21 | Claude | Status → Verified, all 5 verification criteria passed |
