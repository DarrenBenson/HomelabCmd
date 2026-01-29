# TS0136: Dashboard Preferences Sync

> **Status:** Draft
> **Story:** [US0136: Dashboard Preferences Sync](../stories/US0136-dashboard-preferences-sync.md)
> **Epic:** [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md)
> **Created:** 2026-01-28
> **Last Updated:** 2026-01-28

## Overview

Test specification for the unified dashboard preferences sync feature. Verifies single-endpoint loading, debounced saving, loading states, error handling, and fallback behaviour.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0136](../stories/US0136-dashboard-preferences-sync.md) | Dashboard Preferences Sync | P1 |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0136 | AC1 | Unified preference storage | TC01, TC02 | Pending |
| US0136 | AC2 | Single-call load | TC03, TC04 | Pending |
| US0136 | AC3 | Immediate save | TC05, TC06, TC07 | Pending |
| US0136 | AC4 | Preference structure | TC08 | Pending |
| US0136 | AC5 | Conflict resolution | TC09 | Pending |
| US0136 | AC6 | Loading state | TC10, TC11 | Pending |
| US0136 | AC7 | Fallback to defaults | TC12, TC13, TC14 | Pending |

**Coverage:** 7/7 ACs covered

### Test Types Required

| Type | Required | Rationale |
|------|----------|--------------|
| Unit | Yes | API endpoints, hook logic |
| Integration | Yes | Dashboard + hook interaction |
| E2E | No | Covered via existing dashboard E2E |

---

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Node.js, Vitest, pytest, SQLite |
| External Services | None (uses local DB) |
| Test Data | Mock preferences JSON |

---

## Test Cases

### TC01: GET endpoint returns saved preferences

**Type:** API | **Priority:** P0 | **Story:** US0136 AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Preferences exist in database | Preferences record present |
| When | GET /api/v1/preferences/dashboard | Request succeeds |
| Then | Response contains all preference fields | card_order, collapsed_sections, view_mode, updated_at |

**Assertions:**
- [ ] Response status is 200
- [ ] Response contains `card_order.servers` array
- [ ] Response contains `card_order.workstations` array
- [ ] Response contains `collapsed_sections` array
- [ ] Response contains `view_mode` string
- [ ] Response contains `updated_at` ISO timestamp

---

### TC02: PUT endpoint saves all preferences atomically

**Type:** API | **Priority:** P0 | **Story:** US0136 AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Valid preference payload | JSON with all fields |
| When | PUT /api/v1/preferences/dashboard | Request succeeds |
| Then | Database contains single record | All fields saved |

**Assertions:**
- [ ] Response status is 200
- [ ] Response contains `status: "saved"`
- [ ] Response contains `updated_at` timestamp
- [ ] Subsequent GET returns saved values

---

### TC03: Dashboard loads preferences in single API call

**Type:** Integration | **Priority:** P0 | **Story:** US0136 AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Dashboard page | Page loading |
| When | Network requests captured | Monitoring API calls |
| Then | Only one /preferences/dashboard call made | Single request |

**Assertions:**
- [ ] Only one GET request to /preferences/dashboard
- [ ] No requests to /preferences/section-order
- [ ] No requests to /preferences/collapsed-sections

---

### TC04: Preferences applied within 500ms of data load

**Type:** Integration | **Priority:** P1 | **Story:** US0136 AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Preferences API returns | Response received |
| When | Measuring time to apply | Timer started |
| Then | Card order applied within 500ms | Layout rendered |

**Assertions:**
- [ ] Time from response to card render < 500ms
- [ ] Collapsed sections applied
- [ ] Card order matches saved order

---

### TC05: Changes saved within 500ms (debounced)

**Type:** Unit | **Priority:** P0 | **Story:** US0136 AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | User reorders cards | Change triggered |
| When | 500ms elapses | Debounce complete |
| Then | PUT request sent | Save initiated |

**Assertions:**
- [ ] No request sent before 500ms
- [ ] Request sent after 500ms
- [ ] Only one request for multiple rapid changes

---

### TC06: "Saved" indicator appears on successful save

**Type:** Unit | **Priority:** P1 | **Story:** US0136 AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Save completes successfully | API returns 200 |
| When | Response received | Success state |
| Then | "Saved" indicator visible | Toast or badge shown |

**Assertions:**
- [ ] Saved indicator element present
- [ ] Indicator disappears after timeout (2-3 seconds)

---

### TC07: Debounce groups rapid changes (10+ in 2s)

**Type:** Unit | **Priority:** P1 | **Story:** US0136 AC3, Edge Case 4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | 10 reorders in 2 seconds | Rapid changes |
| When | Debounce period ends | 500ms after last change |
| Then | Only 1 API call made | Final state saved |

**Assertions:**
- [ ] Single PUT request made
- [ ] Request payload contains final order
- [ ] Intermediate orders not persisted

---

### TC08: Response matches expected JSON structure

**Type:** API | **Priority:** P0 | **Story:** US0136 AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | GET /api/v1/preferences/dashboard | Request made |
| When | Response received | JSON returned |
| Then | Structure matches schema | All fields present |

**Assertions:**
- [ ] `card_order` is object with `servers` and `workstations` arrays
- [ ] `collapsed_sections` is array of strings
- [ ] `view_mode` is string (default "grid")
- [ ] `updated_at` is ISO 8601 string or null

**Expected Response:**
```json
{
  "card_order": {
    "servers": ["guid-1", "guid-2"],
    "workstations": ["guid-3"]
  },
  "collapsed_sections": ["workstations"],
  "view_mode": "grid",
  "updated_at": "2026-01-28T10:30:00Z"
}
```

---

### TC09: Last write wins on concurrent saves

**Type:** API | **Priority:** P1 | **Story:** US0136 AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Two concurrent PUT requests | Different payloads |
| When | Both complete | Responses returned |
| Then | Later timestamp wins | Last write persisted |

**Assertions:**
- [ ] Both requests return 200
- [ ] GET returns the later save's values
- [ ] No error shown to users

---

### TC10: Loading skeleton shows while fetching

**Type:** Unit | **Priority:** P0 | **Story:** US0136 AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Dashboard renders | API call in progress |
| When | Preferences not yet loaded | Loading state |
| Then | Skeleton/loading indicator shown | Visual feedback |

**Assertions:**
- [ ] Loading skeleton visible in card grid area
- [ ] Skeleton disappears when preferences load
- [ ] No layout shift on load completion

---

### TC11: Loading state timeout after 2 seconds

**Type:** Unit | **Priority:** P1 | **Story:** US0136 AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Preferences fetch takes >2s | Slow/hung request |
| When | 2 seconds elapsed | Timeout reached |
| Then | Fallback to defaults | Loading clears |

**Assertions:**
- [ ] Loading state clears after 2s max
- [ ] Default preferences applied
- [ ] No infinite loading spinner

---

### TC12: Defaults used on load failure

**Type:** Unit | **Priority:** P0 | **Story:** US0136 AC7

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | GET /preferences/dashboard fails | Network or server error |
| When | Dashboard renders | Error handled |
| Then | Default preferences used | Functional UI |

**Assertions:**
- [ ] Card order defaults to alphabetical
- [ ] All sections expanded
- [ ] View mode defaults to "grid"

---

### TC13: Toast notification on load failure

**Type:** Unit | **Priority:** P1 | **Story:** US0136 AC7

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Preferences load fails | Error response |
| When | Dashboard renders with defaults | Fallback active |
| Then | Toast shows "Preferences unavailable" | User informed |

**Assertions:**
- [ ] Toast notification visible
- [ ] Text: "Preferences unavailable, using defaults"
- [ ] Toast dismissible

---

### TC14: Save retried on subsequent success

**Type:** Unit | **Priority:** P2 | **Story:** US0136 AC7

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Initial save fails | Network error |
| When | User makes another change | New save triggered |
| Then | Save attempt made again | Retry on user action |

**Assertions:**
- [ ] Failed save does not block future saves
- [ ] Next change triggers new save attempt

---

## Edge Case Tests

### TC15: First-time user (no preferences)

**Type:** API | **Priority:** P1 | **Story:** Edge Case 1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | No preferences in database | Fresh install |
| When | GET /preferences/dashboard | Request made |
| Then | Returns default structure | Empty arrays, null updated_at |

**Assertions:**
- [ ] Status 200 (not 404)
- [ ] `card_order.servers` is empty array
- [ ] `card_order.workstations` is empty array
- [ ] `collapsed_sections` is empty array
- [ ] `updated_at` is null

---

### TC16: Invalid preference data handling

**Type:** Unit | **Priority:** P2 | **Story:** Edge Case 6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server returns malformed JSON | Invalid data |
| When | Frontend parses response | Parse error |
| Then | Defaults used, error logged | Graceful degradation |

**Assertions:**
- [ ] Console error logged
- [ ] Default preferences applied
- [ ] UI remains functional

---

### TC17: Large preference payload rejected

**Type:** API | **Priority:** P2 | **Story:** Edge Case 8

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Preference payload >10KB | Oversized request |
| When | PUT /preferences/dashboard | Request sent |
| Then | 400 Bad Request returned | Request rejected |

**Assertions:**
- [ ] Status 400
- [ ] Error message indicates size limit

---

## Fixtures

```yaml
fixtures:
  default_preferences:
    card_order:
      servers: []
      workstations: []
    collapsed_sections: []
    view_mode: "grid"
    updated_at: null

  saved_preferences:
    card_order:
      servers: ["server-guid-1", "server-guid-2"]
      workstations: ["ws-guid-1"]
    collapsed_sections: ["workstations"]
    view_mode: "grid"
    updated_at: "2026-01-28T10:30:00Z"

  empty_fleet_preferences:
    card_order:
      servers: []
      workstations: []
    collapsed_sections: []
    view_mode: "grid"
    updated_at: "2026-01-28T10:00:00Z"
```

---

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC01 | GET returns saved preferences | Pending | test_api_preferences.py |
| TC02 | PUT saves atomically | Pending | test_api_preferences.py |
| TC03 | Single API call on load | Pending | Dashboard.test.tsx |
| TC04 | Preferences applied <500ms | Pending | Dashboard.test.tsx |
| TC05 | Debounced save timing | Pending | useDashboardPreferences.test.ts |
| TC06 | Saved indicator shows | Pending | useDashboardPreferences.test.ts |
| TC07 | Rapid changes debounced | Pending | useDashboardPreferences.test.ts |
| TC08 | Response JSON structure | Pending | test_api_preferences.py |
| TC09 | Last write wins | Pending | test_api_preferences.py |
| TC10 | Loading skeleton | Pending | Dashboard.test.tsx |
| TC11 | Loading timeout | Pending | useDashboardPreferences.test.ts |
| TC12 | Defaults on failure | Pending | useDashboardPreferences.test.ts |
| TC13 | Toast on load failure | Pending | Dashboard.test.tsx |
| TC14 | Save retry | Pending | useDashboardPreferences.test.ts |
| TC15 | First-time user | Pending | test_api_preferences.py |
| TC16 | Invalid data handling | Pending | useDashboardPreferences.test.ts |
| TC17 | Large payload rejected | Pending | test_api_preferences.py |

---

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |
| Plan | [PL0136](../plans/PL0136-dashboard-preferences-sync.md) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial spec with 17 test cases |
