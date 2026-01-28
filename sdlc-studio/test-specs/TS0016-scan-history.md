# TS0016: Scan History View Test Specification

> **Story:** [US0040: Scan History View](../stories/US0040-scan-history.md)
> **Plan:** [PL0047: Scan History Implementation](../plans/PL0047-scan-history.md)
> **Status:** Ready
> **Created:** 2026-01-21

## Overview

Test specification for the scan history feature, covering backend API extensions and frontend history page functionality.

## Test Categories

| Category | Count | Priority |
|----------|-------|----------|
| Backend API | 8 | High |
| Frontend UI | 12 | High |
| Integration | 4 | Medium |
| Edge Cases | 6 | Medium |
| **Total** | **30** | |

## Backend API Tests

### TC-TS0016-01: DELETE /scans/{id} returns 204 on success

**AC Coverage:** AC5
**Type:** API
**Priority:** High

**Setup:**
- Create a completed scan in database

**Steps:**
1. Call DELETE /api/v1/scans/{scan_id}

**Expected:**
- Response status: 204 No Content
- Scan removed from database
- Subsequent GET /api/v1/scans/{scan_id} returns 404

---

### TC-TS0016-02: DELETE /scans/{id} returns 404 for non-existent scan

**AC Coverage:** AC5
**Type:** API
**Priority:** High

**Steps:**
1. Call DELETE /api/v1/scans/99999

**Expected:**
- Response status: 404 Not Found
- Error detail: "Scan 99999 not found"

---

### TC-TS0016-03: GET /scans with status filter returns matching scans

**AC Coverage:** AC3
**Type:** API
**Priority:** High

**Setup:**
- Create 3 scans: 2 completed, 1 failed

**Steps:**
1. Call GET /api/v1/scans?status=completed

**Expected:**
- Response contains only 2 completed scans
- Failed scan not in response

---

### TC-TS0016-04: GET /scans with scan_type filter returns matching scans

**AC Coverage:** AC3
**Type:** API
**Priority:** High

**Setup:**
- Create 3 scans: 2 quick, 1 full

**Steps:**
1. Call GET /api/v1/scans?scan_type=full

**Expected:**
- Response contains only 1 full scan
- Quick scans not in response

---

### TC-TS0016-05: GET /scans orders by created_at descending

**AC Coverage:** AC2
**Type:** API
**Priority:** High

**Setup:**
- Create 3 scans with different timestamps

**Steps:**
1. Call GET /api/v1/scans

**Expected:**
- Scans ordered newest first
- First scan in response has latest created_at

---

### TC-TS0016-06: GET /scans pagination works correctly

**AC Coverage:** AC2
**Type:** API
**Priority:** High

**Setup:**
- Create 25 scans

**Steps:**
1. Call GET /api/v1/scans?limit=10&offset=0
2. Call GET /api/v1/scans?limit=10&offset=10

**Expected:**
- First call returns 10 scans
- Second call returns 10 different scans
- total field is 25

---

### TC-TS0016-07: GET /scans combines multiple filters

**AC Coverage:** AC3
**Type:** API
**Priority:** Medium

**Setup:**
- Create scans with various hostnames, statuses, types

**Steps:**
1. Call GET /api/v1/scans?hostname=server1&status=completed

**Expected:**
- Only scans matching BOTH hostname AND status returned

---

### TC-TS0016-08: DELETE /scans requires authentication

**AC Coverage:** AC5
**Type:** API
**Priority:** High

**Steps:**
1. Call DELETE /api/v1/scans/1 without API key

**Expected:**
- Response status: 401 Unauthorized

---

## Frontend UI Tests

### TC-TS0016-09: History page renders scan table

**AC Coverage:** AC1, AC2
**Type:** Component
**Priority:** High

**Setup:**
- Mock API to return 3 scans

**Steps:**
1. Render ScanHistoryPage

**Expected:**
- Table visible with headers: Hostname, Type, Status, Date, Actions
- 3 rows displayed
- Each row shows correct data

---

### TC-TS0016-10: Hostname filter updates results

**AC Coverage:** AC3
**Type:** Component
**Priority:** High

**Setup:**
- Mock API with scans for different hostnames

**Steps:**
1. Render ScanHistoryPage
2. Enter "server1" in hostname filter
3. Wait for debounce

**Expected:**
- API called with hostname=server1
- Only matching scans displayed

---

### TC-TS0016-11: Status filter dropdown works

**AC Coverage:** AC3
**Type:** Component
**Priority:** High

**Setup:**
- Mock API with scans

**Steps:**
1. Render ScanHistoryPage
2. Select "Completed" from status dropdown

**Expected:**
- URL updated with status=completed
- API called with status filter
- Results filtered

---

### TC-TS0016-12: Type filter dropdown works

**AC Coverage:** AC3
**Type:** Component
**Priority:** High

**Setup:**
- Mock API with quick and full scans

**Steps:**
1. Render ScanHistoryPage
2. Select "Full" from type dropdown

**Expected:**
- URL updated with scan_type=full
- API called with scan_type filter

---

### TC-TS0016-13: Clicking row navigates to scan detail

**AC Coverage:** AC4
**Type:** Component
**Priority:** High

**Setup:**
- Mock API with scan ID 5

**Steps:**
1. Render ScanHistoryPage
2. Click on scan row

**Expected:**
- Navigation to /scans/5

---

### TC-TS0016-14: Delete button shows confirmation modal

**AC Coverage:** AC5
**Type:** Component
**Priority:** High

**Setup:**
- Mock API with scan

**Steps:**
1. Render ScanHistoryPage
2. Click delete button on row

**Expected:**
- Confirmation modal appears
- Modal shows scan hostname
- Cancel and Confirm buttons visible

---

### TC-TS0016-15: Confirming delete removes scan

**AC Coverage:** AC5
**Type:** Component
**Priority:** High

**Setup:**
- Mock API with scan and delete endpoint

**Steps:**
1. Render ScanHistoryPage
2. Click delete button
3. Click confirm in modal

**Expected:**
- DELETE API called
- Scan removed from list
- Modal closes

---

### TC-TS0016-16: Cancel delete closes modal

**AC Coverage:** AC5
**Type:** Component
**Priority:** Medium

**Setup:**
- Mock API with scan

**Steps:**
1. Render ScanHistoryPage
2. Click delete button
3. Click cancel in modal

**Expected:**
- Modal closes
- Scan still in list
- DELETE not called

---

### TC-TS0016-17: Pagination displays correctly

**AC Coverage:** AC2
**Type:** Component
**Priority:** High

**Setup:**
- Mock API with 45 scans total, 20 per page

**Steps:**
1. Render ScanHistoryPage

**Expected:**
- Pagination shows "Showing 1-20 of 45 scans"
- Page buttons visible
- Next button enabled

---

### TC-TS0016-18: Page change fetches new data

**AC Coverage:** AC2
**Type:** Component
**Priority:** High

**Setup:**
- Mock API with multiple pages

**Steps:**
1. Render ScanHistoryPage
2. Click page 2 button

**Expected:**
- URL updated with page=2
- API called with offset=20
- New scans displayed

---

### TC-TS0016-19: Loading state displays spinner

**AC Coverage:** AC1
**Type:** Component
**Priority:** Medium

**Steps:**
1. Render ScanHistoryPage while API loading

**Expected:**
- Loading spinner visible
- Table not visible

---

### TC-TS0016-20: Error state displays retry button

**AC Coverage:** AC1
**Type:** Component
**Priority:** Medium

**Setup:**
- Mock API to return error

**Steps:**
1. Render ScanHistoryPage

**Expected:**
- Error message displayed
- Retry button visible
- Clicking retry re-fetches

---

## Edge Case Tests

### TC-TS0016-21: Empty state when no scans

**AC Coverage:** Edge
**Type:** Component
**Priority:** Medium

**Setup:**
- Mock API to return empty array

**Steps:**
1. Render ScanHistoryPage

**Expected:**
- "No scans yet" message displayed
- Table not visible

---

### TC-TS0016-22: Filter returns no results

**AC Coverage:** Edge
**Type:** Component
**Priority:** Medium

**Setup:**
- Mock API with scans
- Filter mock to return empty for specific filter

**Steps:**
1. Render ScanHistoryPage
2. Apply hostname filter "nonexistent"

**Expected:**
- "No matching scans" message
- Clear filters button visible

---

### TC-TS0016-23: Delete in-progress scan

**AC Coverage:** AC5, Edge
**Type:** API
**Priority:** Medium

**Setup:**
- Create scan with status "running"

**Steps:**
1. Call DELETE /api/v1/scans/{id}

**Expected:**
- Deletion succeeds (204)
- Running scan removed

---

### TC-TS0016-24: Status badge shows correct icon

**AC Coverage:** AC2
**Type:** Component
**Priority:** Medium

**Setup:**
- Mock API with completed and failed scans

**Steps:**
1. Render ScanHistoryPage

**Expected:**
- Completed scans show green checkmark
- Failed scans show red X

---

### TC-TS0016-25: Date formatting shows relative time

**AC Coverage:** AC2
**Type:** Component
**Priority:** Low

**Setup:**
- Mock API with scan from "today" and "yesterday"

**Steps:**
1. Render ScanHistoryPage

**Expected:**
- Recent scan shows "Today, HH:mm" or relative time
- Older scan shows date

---

### TC-TS0016-26: Clear filters resets all filters

**AC Coverage:** AC3
**Type:** Component
**Priority:** Medium

**Setup:**
- Render page with filters applied

**Steps:**
1. Apply hostname, status, and type filters
2. Click clear filters

**Expected:**
- All filters reset to "All"
- URL params cleared
- Full list displayed

---

## Integration Tests

### TC-TS0016-27: Full flow - view then delete

**AC Coverage:** AC4, AC5
**Type:** Integration
**Priority:** High

**Steps:**
1. Navigate to /scans/history
2. Click on a scan row
3. Verify scan details load
4. Navigate back to history
5. Delete the same scan
6. Verify removed from list

**Expected:**
- All steps complete successfully
- Scan no longer appears in history

---

### TC-TS0016-28: URL state persistence

**AC Coverage:** AC3
**Type:** Integration
**Priority:** Medium

**Steps:**
1. Navigate to /scans/history?hostname=server1&status=completed
2. Verify filters pre-populated
3. Verify filtered results displayed

**Expected:**
- Filters match URL params
- Results filtered accordingly

---

### TC-TS0016-29: Refresh maintains filter state

**AC Coverage:** AC3
**Type:** Integration
**Priority:** Medium

**Steps:**
1. Apply filters
2. Click refresh button
3. Verify filters maintained

**Expected:**
- Same filters applied after refresh
- New data fetched with same filters

---

### TC-TS0016-30: Back navigation from scan detail

**AC Coverage:** AC1, AC4
**Type:** Integration
**Priority:** Medium

**Steps:**
1. Navigate to /scans/history
2. Click on scan row
3. Click back button on detail page

**Expected:**
- Returns to /scans/history
- Previous filter state preserved (if using browser history)

---

## Test Data Requirements

### Mock Scans

```typescript
const mockScans = [
  {
    scan_id: 1,
    hostname: "server1",
    scan_type: "full",
    status: "completed",
    started_at: "2026-01-21T10:00:00Z",
    completed_at: "2026-01-21T10:01:00Z",
    error: null,
  },
  {
    scan_id: 2,
    hostname: "server2",
    scan_type: "quick",
    status: "completed",
    started_at: "2026-01-21T09:00:00Z",
    completed_at: "2026-01-21T09:00:30Z",
    error: null,
  },
  {
    scan_id: 3,
    hostname: "server1",
    scan_type: "quick",
    status: "failed",
    started_at: "2026-01-20T15:00:00Z",
    completed_at: "2026-01-20T15:00:10Z",
    error: "Connection refused",
  },
];
```

## Coverage Matrix

| AC | Test Cases | Coverage |
|----|------------|----------|
| AC1: History page accessible | TC-09, TC-19, TC-20, TC-30 | Full |
| AC2: Scans listed chronologically | TC-05, TC-06, TC-09, TC-17, TC-18, TC-24, TC-25 | Full |
| AC3: Filter by hostname | TC-03, TC-04, TC-07, TC-10, TC-11, TC-12, TC-22, TC-26, TC-28, TC-29 | Full |
| AC4: View historical scan details | TC-13, TC-27, TC-30 | Full |
| AC5: Delete old scans | TC-01, TC-02, TC-08, TC-14, TC-15, TC-16, TC-23, TC-27 | Full |

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-21 | Claude | Initial test specification |
