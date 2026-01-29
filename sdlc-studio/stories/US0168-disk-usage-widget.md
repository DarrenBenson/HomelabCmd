# US0168: Disk Usage Widget

> **Status:** Done
> **Epic:** [EP0012: Widget-Based Detail View](../epics/EP0012-widget-based-detail-view.md)
> **Owner:** Darren
> **Created:** 2026-01-28
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** a disk usage widget
**So that** I can monitor storage capacity across filesystems

## Context

### Persona Reference
**Darren** - Technical professional managing a homelab. Needs storage visibility for capacity planning.
[Full persona details](../personas.md#darren-homelab-operator)

---

## Acceptance Criteria

### AC1: Filesystem list
- **Given** the Disk Usage widget is visible
- **When** I view the widget
- **Then** it lists all mounted filesystems

### AC2: Usage display
- **Given** filesystems are listed
- **When** I view each entry
- **Then** it shows used/total and percentage for each
- **And** a progress bar visualises usage

### AC3: Colour-coded thresholds
- **Given** disk usage is displayed
- **When** usage exceeds thresholds
- **Then** progress bars change colour (green < 70%, amber 70-90%, red > 90%)

### AC4: Sorting
- **Given** multiple filesystems are shown
- **When** I click column headers
- **Then** the list sorts by usage or mount point

### AC5: Expandable details
- **Given** a filesystem is shown
- **When** I click to expand
- **Then** additional details appear (filesystem type, mount options)

---

## Scope

### In Scope
- Widget ID: `disk_usage`
- All mounted filesystems
- Progress bar per filesystem
- Colour-coded thresholds
- Sortable list
- Expandable details
- Minimum size: 4x3

### Out of Scope
- SMART data (future enhancement)
- Disk I/O metrics

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | No disk data | Show "No data" |
| 2 | Many filesystems (>10) | Scrollable list |
| 3 | 100% full disk | Critical red, prominent warning |
| 4 | Unmounted filesystem | Not shown |
| 5 | Network mount offline | Show with warning indicator |

---

## Test Scenarios

- [x] Widget lists all filesystems
- [x] Progress bars show correct percentages
- [x] Colour thresholds apply correctly
- [x] Sorting works on columns
- [x] Expand/collapse shows details

All test scenarios covered by 22 unit tests in `DiskWidget.test.tsx`.

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0164](US0164-widget-grid-system.md) | Requires | Grid system | Done |
| [US0178](US0178-per-filesystem-metrics-api.md) | Requires | Per-filesystem API for AC1, AC4, AC5 | Done |

---

## Estimation

**Story Points:** 3
**Complexity:** Medium - List with sorting and expansion

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation (renumbered from US0141) |
| 2026-01-28 | Claude | Partial implementation: aggregate disk widget with progress bar, chart. Per-filesystem requires API enhancement. |
| 2026-01-29 | Claude | Full implementation: per-filesystem display with sorting, expandable details, colour thresholds. All 5 ACs complete. |
