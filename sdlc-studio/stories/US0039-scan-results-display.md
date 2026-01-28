# US0039: Scan Results Display

> **Status:** Done
> **Epic:** [EP0006: Ad-hoc Scanning](../epics/EP0006-adhoc-scanning.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** to view scan results in a clear format
**So that** I can quickly understand the state of a scanned device

## Context

### Persona Reference

**Darren** - Wants to see scan results immediately after scanning. Needs key info visible at a glance.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

After a scan completes, results are displayed in the dashboard. Quick scan results show basic system info. Full scan results show additional details in expandable sections.

## Inherited Constraints

Constraints inherited from parent Epic that apply to this Story.

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Security | SSH key auth only | No credential display in results UI |
| Scope | Ad-hoc scanning | Results display single device at a time |
| Data Model | JSON results | Parse flexible JSON structure from scan response |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Architecture | LAN-only | Display local network IPs only |
| UX | On-demand visibility | Results visible immediately after scan completes |
| Design | Brand guide compliance | Progress bars use phosphor colour palette |

> **Validation:** Each inherited constraint MUST be addressed in either AC, Edge Cases, or Technical Notes.

## Acceptance Criteria

### AC1: Quick scan results displayed

- **Given** a quick scan completes
- **When** viewing the results
- **Then** OS, hostname, uptime, disk, and memory are displayed

### AC2: Full scan results displayed

- **Given** a full scan completes
- **When** viewing the results
- **Then** quick scan data plus packages, processes, and network are shown

### AC3: Disk usage visualised

- **Given** disk usage data
- **When** viewing results
- **Then** progress bars show usage percentage per mount

### AC4: Process list sortable

- **Given** running processes in results
- **When** viewing the process list
- **Then** processes can be sorted by memory or CPU

### AC5: Results persist after navigation

- **Given** scan results are displayed
- **When** navigating away and returning
- **Then** results are still available via scan ID

## Scope

### In Scope

- Scan results page/modal
- Quick scan results layout
- Full scan results layout
- Disk usage visualisation
- Process list with sorting
- Network interfaces display

### Out of Scope

- Scan history list (US0040)
- Comparing scans
- Exporting results

## UI/UX Requirements

### Scan Results Page

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Scan Results: 192.168.1.100                        2026-01-18 10:30:05 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  System Information                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Hostname: dazzbook                                               │   │
│  │ OS: Ubuntu 22.04 (Linux 5.15.0-91-generic)                      │   │
│  │ Uptime: 4 days, 2 hours                                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Disk Usage                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ /       ████████░░░░░░░░░░░░░░░░░░░░░░  120 / 500 GB (24%)     │   │
│  │ /home   █████████████░░░░░░░░░░░░░░░░░  180 / 500 GB (36%)     │   │
│  │ /boot   ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░  0.2 / 1 GB (20%)       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Memory                                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ RAM: █████████████████░░░░░░░░░░░░░░░  8 / 16 GB (50%)         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ▼ Running Processes (20)                                [Sort: Memory] │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ PID    │ Name           │ Memory  │ CPU   │                     │   │
│  ├────────────────────────────────────────────────────────────────┤   │
│  │ 12345  │ chrome         │ 2.5 GB  │ 5.2%  │                     │   │
│  │ 23456  │ code           │ 1.8 GB  │ 3.1%  │                     │   │
│  │ 34567  │ slack          │ 800 MB  │ 1.2%  │                     │   │
│  │ ...    │                │         │       │                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ▼ Network Interfaces (3)                                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ eth0: 192.168.1.100/24                                          │   │
│  │ wlan0: Not connected                                            │   │
│  │ lo: 127.0.0.1                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ▼ Installed Packages (1,234 packages)                                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ [Search: ____________________]                                   │   │
│  │ • python3.10 (3.10.12-1)                                        │   │
│  │ • nodejs (18.17.0-1)                                            │   │
│  │ • docker-ce (24.0.6-1)                                          │   │
│  │ ...                                                             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│                                           [Scan Again]  [View History]  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Brand Guide Reference

- Progress bars: Phosphor Green for < 80%, Warning Amber for 80-90%, Red Alert for > 90%
- Values: JetBrains Mono, monospace
- Expandable sections: Collapsed by default for full scan

## Technical Notes

### API Contracts

Uses GET /api/v1/scans/{scan_id} from US0038.

### Data Requirements

- Results parsed from JSON in database
- Uptime converted to human-readable format
- Disk sizes in appropriate units (GB/TB)

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Scan failed | Show error message, no results |
| Partial results | Show available data with note |
| Very long process list | Paginate or limit to top 50 |
| No packages found | Show "Package list not available" |

## Test Scenarios

- [ ] Quick scan results display all fields
- [ ] Full scan results display all sections
- [ ] Disk usage progress bars correct
- [ ] Memory usage progress bar correct
- [ ] Process sorting works
- [ ] Sections expandable/collapsible
- [ ] Failed scan shows error

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0039-01 | Quick scan results display all required fields | AC1 | E2E | Pending |
| TC-US0039-02 | Full scan results display expanded sections | AC2 | E2E | Pending |
| TC-US0039-03 | Disk usage progress bars render correctly | AC3 | E2E | Pending |
| TC-US0039-04 | Process list sorts by memory and CPU | AC4 | E2E | Pending |
| TC-US0039-05 | Results persist after navigation and return | AC5 | E2E | Pending |
| TC-US0039-06 | Failed scan displays error message | Edge | E2E | Pending |

## Quality Checklist

### UI Stories (minimum requirements)

- [x] Edge cases: 4/8 minimum documented
- [x] Test scenarios: 7/10 minimum listed
- [x] Wireframe or mockup provided
- [x] Brand guide compliance noted

### All Stories

- [x] No ambiguous language
- [x] Open Questions: 0/0 resolved
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
| US0038: Scan Initiation | Story | Draft |

## Estimation

**Story Points:** 3

**Complexity:** Medium - UI display with multiple sections

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-20 | Claude | Added Inherited Constraints, Test Cases, Quality Checklist sections |
| 2026-01-21 | Claude | Story review: marked Ready |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
