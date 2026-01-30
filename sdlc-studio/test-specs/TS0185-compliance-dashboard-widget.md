# TS0185: Compliance Dashboard Widget

> **Status:** Draft
> **Epic:** [EP0010: Configuration Management](../epics/EP0010-configuration-management.md)
> **Created:** 2026-01-29
> **Last Updated:** 2026-01-29

## Overview

Test specification for the compliance dashboard widget that displays fleet-wide configuration compliance status. Covers the backend summary endpoint and frontend widget rendering, interactions, and edge cases.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0120](../stories/US0120-compliance-dashboard-widget.md) | Compliance Dashboard Widget | Medium |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0120 | AC1 | Compliance summary endpoint | TC001, TC002, TC003 | Pending |
| US0120 | AC2 | Dashboard widget display | TC004, TC005 | Pending |
| US0120 | AC3 | Widget colour coding | TC006, TC007, TC008 | Pending |
| US0120 | AC4 | Machine list in widget | TC009, TC010 | Pending |
| US0120 | AC5 | Navigation links | TC011, TC012 | Pending |
| US0120 | AC6 | Refresh button | TC013, TC014 | Pending |

**Coverage:** 6/6 ACs covered

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Validate endpoint aggregation logic and widget rendering |
| Integration | Yes | Validate API-widget data flow |
| E2E | No | Manual verification sufficient for widget visual behaviour |

---

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Test database, servers with/without compliance checks |
| External Services | None (mocked) |
| Test Data | Servers with various compliance states |

---

## Test Cases

### TC001: Summary endpoint returns correct counts

**Type:** Unit | **Priority:** High | **Story:** US0120

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | 3 servers: 2 compliant, 1 non-compliant | Compliance data in DB |
| When | GET /api/v1/config/compliance | Request processed |
| Then | Response contains correct summary | Counts match |

**Assertions:**
- [ ] summary.compliant equals 2
- [ ] summary.non_compliant equals 1
- [ ] summary.never_checked equals 0
- [ ] summary.total equals 3

---

### TC002: Summary endpoint includes machine details

**Type:** Unit | **Priority:** High | **Story:** US0120

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Servers with compliance checks | Data in DB |
| When | GET /api/v1/config/compliance | Request processed |
| Then | Response includes machine array | Machine details present |

**Assertions:**
- [ ] machines array has one entry per server
- [ ] Each machine has id, display_name, status
- [ ] Non-compliant machines have mismatch_count
- [ ] All machines have checked_at or null

---

### TC003: Summary endpoint handles servers without checks

**Type:** Unit | **Priority:** Medium | **Story:** US0120

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server with no compliance checks | No ConfigCheck records |
| When | GET /api/v1/config/compliance | Request processed |
| Then | Server appears with status="never_checked" | Status correct |

**Assertions:**
- [ ] Server included in machines array
- [ ] status is "never_checked"
- [ ] pack is null
- [ ] checked_at is null

---

### TC004: Widget displays summary counts

**Type:** Unit | **Priority:** High | **Story:** US0120

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Compliance data with 8 compliant, 3 non-compliant, 2 never checked | Mock data |
| When | Widget renders | Widget displayed |
| Then | All three counts visible | Counts correct |

**Assertions:**
- [ ] "8" displayed with "Compliant" label
- [ ] "3" displayed with "Non-compliant" label
- [ ] "2" displayed with "Never checked" label

---

### TC005: Widget displays title and buttons

**Type:** Unit | **Priority:** Medium | **Story:** US0120

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Widget renders | Render complete |
| When | Content inspected | Elements visible |
| Then | Title and buttons present | UI correct |

**Assertions:**
- [ ] Title "Configuration Compliance" visible
- [ ] "Check All" button visible
- [ ] "View Details" link visible

---

### TC006: Green border when all compliant

**Type:** Unit | **Priority:** High | **Story:** US0120

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | All servers compliant (non_compliant=0, never_checked=0) | Mock data |
| When | Widget renders | Widget displayed |
| Then | Widget has green border | border-green-500 class |

**Assertions:**
- [ ] Widget container has green border class
- [ ] No "Needs Attention" section displayed

---

### TC007: Amber border when some non-compliant

**Type:** Unit | **Priority:** High | **Story:** US0120

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Some servers non-compliant (non_compliant > 0) | Mock data |
| When | Widget renders | Widget displayed |
| Then | Widget has amber border | border-amber-500 class |

**Assertions:**
- [ ] Widget container has amber border class
- [ ] "Needs Attention" section displayed

---

### TC008: Grey border when all never checked

**Type:** Unit | **Priority:** Medium | **Story:** US0120

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | All servers never checked (compliant=0, non_compliant=0) | Mock data |
| When | Widget renders | Widget displayed |
| Then | Widget has grey border | border-gray-500 class |

**Assertions:**
- [ ] Widget container has grey border class

---

### TC009: Non-compliant machine list renders

**Type:** Unit | **Priority:** High | **Story:** US0120

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | 3 non-compliant servers | Mock data with mismatch counts |
| When | Widget renders | List displayed |
| Then | All non-compliant machines listed | Names and counts visible |

**Assertions:**
- [ ] Machine name displayed for each non-compliant server
- [ ] Mismatch count displayed (e.g., "3 items")
- [ ] List limited to first 5 entries

---

### TC010: More link when >5 non-compliant

**Type:** Unit | **Priority:** Medium | **Story:** US0120

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | 7 non-compliant servers | Mock data |
| When | Widget renders | List displayed |
| Then | Shows 5 machines plus "+2 more" link | Truncation correct |

**Assertions:**
- [ ] Exactly 5 machine entries displayed
- [ ] "+2 more" or "View all" link visible

---

### TC011: Machine click navigates to diff view

**Type:** Unit | **Priority:** High | **Story:** US0120

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Widget rendered with non-compliant machine "studypc" | Widget visible |
| When | Machine name clicked | Navigation triggered |
| Then | Navigates to /servers/studypc/config | Route change |

**Assertions:**
- [ ] navigate() called with correct path
- [ ] Path includes server ID and /config suffix

---

### TC012: View Details navigates to config page

**Type:** Unit | **Priority:** Medium | **Story:** US0120

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Widget rendered | Widget visible |
| When | "View Details" clicked | Navigation triggered |
| Then | Navigates to /config | Route change |

**Assertions:**
- [ ] navigate() called with "/config"

---

### TC013: Check All button triggers compliance checks

**Type:** Integration | **Priority:** High | **Story:** US0120

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Widget rendered with 3 servers | Widget visible |
| When | "Check All" clicked | Checks triggered |
| Then | Compliance check API called for each server | API calls made |

**Assertions:**
- [ ] Loading state shown during checks
- [ ] Progress indicator updates
- [ ] Widget refreshes after completion

---

### TC014: Check All handles partial failures

**Type:** Integration | **Priority:** Medium | **Story:** US0120

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | 3 servers, 1 offline (will fail check) | Mixed state |
| When | "Check All" clicked | Partial completion |
| Then | Shows results with error for failed server | Error displayed |

**Assertions:**
- [ ] Successful checks update counts
- [ ] Failed check shows error indication
- [ ] Widget still usable after partial failure

---

### TC015: Widget shows loading state

**Type:** Unit | **Priority:** Medium | **Story:** US0120

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | API request in progress | Loading state |
| When | Widget renders | Loading displayed |
| Then | Loading spinner or skeleton shown | Visual feedback |

**Assertions:**
- [ ] Loading indicator visible
- [ ] No stale data shown during load

---

### TC016: Widget shows error state

**Type:** Unit | **Priority:** Medium | **Story:** US0120

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | API request fails | Error state |
| When | Widget renders | Error displayed |
| Then | Error message with retry button | Error feedback |

**Assertions:**
- [ ] Error message visible
- [ ] Retry button visible
- [ ] Retry button triggers refetch

---

### TC017: Empty state when no packs configured

**Type:** Unit | **Priority:** Medium | **Story:** US0120

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | All servers have no packs assigned | No pack data |
| When | Widget renders | Empty state |
| Then | Shows "No packs configured" message | Guidance displayed |

**Assertions:**
- [ ] Message explains no packs configured
- [ ] Suggests action to configure packs

---

## Fixtures

```yaml
servers:
  - id: homeserver
    hostname: homeserver.local
    display_name: HomeServer
  - id: studypc
    hostname: studypc.local
    display_name: StudyPC
  - id: laptoppro
    hostname: laptoppro.local
    display_name: LaptopPro

compliance_states:
  all_compliant:
    - server_id: homeserver
      status: compliant
      pack: base
      checked_at: "2026-01-29T06:00:00Z"
    - server_id: studypc
      status: compliant
      pack: developer_max
      checked_at: "2026-01-29T06:00:00Z"

  mixed:
    - server_id: homeserver
      status: compliant
      pack: base
      checked_at: "2026-01-29T06:00:00Z"
    - server_id: studypc
      status: non_compliant
      pack: developer_max
      mismatch_count: 3
      checked_at: "2026-01-29T06:00:00Z"
    - server_id: laptoppro
      status: never_checked
      pack: null
      checked_at: null

  all_never_checked:
    - server_id: homeserver
      status: never_checked
    - server_id: studypc
      status: never_checked
```

---

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC001 | Summary endpoint returns correct counts | Pending | - |
| TC002 | Summary endpoint includes machine details | Pending | - |
| TC003 | Summary handles servers without checks | Pending | - |
| TC004 | Widget displays summary counts | Pending | - |
| TC005 | Widget displays title and buttons | Pending | - |
| TC006 | Green border when all compliant | Pending | - |
| TC007 | Amber border when some non-compliant | Pending | - |
| TC008 | Grey border when all never checked | Pending | - |
| TC009 | Non-compliant machine list renders | Pending | - |
| TC010 | More link when >5 non-compliant | Pending | - |
| TC011 | Machine click navigates to diff view | Pending | - |
| TC012 | View Details navigates to config page | Pending | - |
| TC013 | Check All triggers compliance checks | Pending | - |
| TC014 | Check All handles partial failures | Pending | - |
| TC015 | Widget shows loading state | Pending | - |
| TC016 | Widget shows error state | Pending | - |
| TC017 | Empty state when no packs configured | Pending | - |

---

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0010](../epics/EP0010-configuration-management.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |
| Plan | [PL0185](../plans/PL0185-compliance-dashboard-widget.md) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial spec from US0120 story plan |
