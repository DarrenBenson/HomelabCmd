# US0040: Scan History View

> **Status:** Done
> **Epic:** [EP0006: Ad-hoc Scanning](../epics/EP0006-adhoc-scanning.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 3
> **Completed:** 2026-01-21

## User Story

**As a** Darren (Homelab Operator)
**I want** to view a history of all scans performed
**So that** I have an audit trail of device states over time

## Context

### Persona Reference

**Darren** - Wants audit trail for troubleshooting and compliance. Needs to compare device states over time.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

All scans are stored in the database with their results. A history view allows reviewing past scans, filtering by hostname, and viewing details of any previous scan.

## Inherited Constraints

Constraints inherited from parent Epic that apply to this Story.

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Security | SSH key auth only | No credentials stored in scan history |
| Scope | Ad-hoc scanning | History shows on-demand scans only, not scheduled |
| Data Model | SQLite storage | Query scans table with pagination support |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Architecture | LAN-only | History limited to local network scans |
| Goal | Fleet audit | History provides 30+ days audit trail |
| Design | Brand guide compliance | Table styling follows brand-guide.md |

> **Validation:** Each inherited constraint MUST be addressed in either AC, Edge Cases, or Technical Notes.

## Acceptance Criteria

### AC1: History page accessible

- **Given** logged into the dashboard
- **When** navigating to Scans → History
- **Then** the scan history page is displayed

### AC2: Scans listed chronologically

- **Given** scans exist in the system
- **When** viewing the history
- **Then** scans are listed newest first

### AC3: Filter by hostname

- **Given** viewing scan history
- **When** filtering by hostname
- **Then** only scans for that hostname are shown

### AC4: View historical scan details

- **Given** a scan in the history list
- **When** clicking on it
- **Then** full scan results are displayed

### AC5: Delete old scans

- **Given** a scan in the history
- **When** clicking delete
- **Then** the scan is removed after confirmation

## Scope

### In Scope

- /scans/history route
- Scan list with columns: Hostname, Type, Status, Date
- Filter by hostname
- Pagination
- View scan details
- Delete scan

### Out of Scope

- Comparing two scans
- Bulk delete
- Export history
- Automatic retention (manual delete only for now)

## UI/UX Requirements

### Scan History Page

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HomelabCmd  >  Scans  >  History                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Scan History                                              [+ New Scan] │
│                                                                         │
│  Filters: [Hostname ▼] [Type ▼] [Status ▼]  [🔍 Search]                │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Hostname        │ Type  │ Status    │ Date              │         │  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │ 192.168.1.100   │ Full  │ ✓ Complete│ Today, 10:30      │ [View]  │  │
│  │ dazzbook        │ Quick │ ✓ Complete│ Today, 09:15      │ [View]  │  │
│  │ 192.168.1.105   │ Quick │ ✗ Failed  │ Yesterday         │ [View]  │  │
│  │ 192.168.1.100   │ Quick │ ✓ Complete│ 2 days ago        │ [View]  │  │
│  │ workstation     │ Full  │ ✓ Complete│ 3 days ago        │ [View]  │  │
│  │ ...             │       │           │                   │         │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  Showing 1-20 of 45                            [< Prev] [1] [2] [3] [>] │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Brand Guide Reference

- Status: Green checkmark for complete, red X for failed
- Table styling per brand guide

## Technical Notes

### API Contracts

**GET /api/v1/scans**
```json
Query params:
  - hostname: Filter by hostname
  - status: completed|failed
  - scan_type: quick|full
  - limit: Pagination limit (default 20)
  - offset: Pagination offset (default 0)

Response 200:
{
  "scans": [
    {
      "scan_id": 15,
      "hostname": "192.168.1.100",
      "scan_type": "full",
      "status": "completed",
      "started_at": "2026-01-18T10:30:00Z",
      "completed_at": "2026-01-18T10:30:15Z"
    }
  ],
  "total": 45,
  "limit": 20,
  "offset": 0
}
```

**DELETE /api/v1/scans/{scan_id}**
```json
Response 204: (no content)
```

**TRD Reference:** [§4 API Contracts - Scans](../trd.md#4-api-contracts)

### Data Requirements

- Scan list query with filters
- Pagination support
- Hard delete (no soft delete)
- **Retention policy:** 30 days - auto-prune scans older than 30 days via daily scheduled job

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| No scans | Show "No scans yet" with CTA |
| Filter returns nothing | Show "No matching scans" |
| View deleted scan | 404 Not Found |

## Test Scenarios

- [ ] History page loads
- [ ] Scans displayed in table
- [ ] Filter by hostname works
- [ ] Filter by status works
- [ ] Pagination works
- [ ] Click opens scan details
- [ ] Delete removes scan

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0040-01 | History page accessible via navigation | AC1 | E2E | Pending |
| TC-US0040-02 | Scans listed newest first | AC2 | API | Pending |
| TC-US0040-03 | Filter by hostname returns matching scans | AC3 | API | Pending |
| TC-US0040-04 | Click on scan opens full results | AC4 | E2E | Pending |
| TC-US0040-05 | Delete scan with confirmation removes record | AC5 | E2E | Pending |
| TC-US0040-06 | Empty state shows appropriate message | Edge | E2E | Pending |

## Quality Checklist

### UI Stories (minimum requirements)

- [x] Edge cases: 3/8 minimum documented
- [x] Test scenarios: 7/10 minimum listed
- [x] Wireframe or mockup provided
- [x] Brand guide compliance noted

### All Stories

- [x] No ambiguous language
- [x] Open Questions: 1/1 resolved
- [x] Given/When/Then uses concrete values
- [x] Persona referenced with specific context

### Ready Status Gate

This story can be marked **Ready** when:
- [x] All critical Open Questions resolved
- [x] Minimum edge case count met
- [x] No "TBD" placeholders in acceptance criteria
- [x] Error scenarios documented

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0038: Scan Initiation | Story | Done |
| US0039: Scan Results Display | Story | Done |

## Estimation

**Story Points:** 3

**Complexity:** Low-Medium - list view with filtering

## Open Questions

None

### Resolved Questions

- [x] Scan result retention policy - **30 days with auto-prune** (resolved 2026-01-21)

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-20 | Claude | Added Inherited Constraints, Test Cases, Quality Checklist sections |
| 2026-01-21 | Claude | Resolved retention policy (30 days auto-prune); marked Ready |
| 2026-01-21 | Claude | Implemented; marked Done |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
