# PL0112: Dashboard Search and Filter - Implementation Plan

> **Status:** Draft
> **Story:** [US0112: Dashboard Search and Filter](../stories/US0112-dashboard-search-filter.md)
> **Epic:** [EP0017: Desktop UX Improvements](../epics/EP0017-desktop-ux-improvements.md)
> **Created:** 2026-01-28
> **Language:** TypeScript (frontend only)

## Overview

Add search and filter functionality to the dashboard so users can quickly find specific servers. Implementation is client-side only (no API changes needed).

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Search box in dashboard header | Search input with icon and placeholder |
| AC2 | Search filters by name/hostname | Case-insensitive search on server_id, hostname, display_name |
| AC3 | Filter chips for status | All, Online, Offline, Warning, Paused |
| AC4 | Filter chips for machine type | Servers, Workstations |
| AC5 | URL state persistence | Filters sync to/from URL query params |
| AC6 | Clear filters | Button to reset all filters |
| AC7 | Empty state message | Show message when no servers match |

---

## Implementation Tasks

| # | Task | File | Status |
|---|------|------|--------|
| 1 | Create FilterChip component | `frontend/src/components/FilterChip.tsx` | [ ] |
| 2 | Create DashboardFilters component | `frontend/src/components/DashboardFilters.tsx` | [ ] |
| 3 | Add useSearchParams to Dashboard | `frontend/src/pages/Dashboard.tsx` | [ ] |
| 4 | Add filter state management | `frontend/src/pages/Dashboard.tsx` | [ ] |
| 5 | Add filter logic with useMemo | `frontend/src/pages/Dashboard.tsx` | [ ] |
| 6 | Add empty state for no matches | `frontend/src/pages/Dashboard.tsx` | [ ] |
| 7 | Add keyboard accessibility | `frontend/src/components/DashboardFilters.tsx` | [ ] |
| 8 | Add tests for components | `frontend/src/components/*.test.tsx` | [ ] |

---

## Implementation Details

### Filter State Management

URL query parameters:
- `q` - search query string
- `status` - status filter (all, online, offline, warning, paused)
- `type` - machine type filter (server, workstation)

### Filter Logic

```tsx
const filteredServers = useMemo(() => {
  return servers.filter(s => {
    // Search filter
    const matchesSearch = !searchQuery ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.hostname.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    // Status filter
    let matchesStatus = true;
    if (statusFilter !== 'all') {
      if (statusFilter === 'warning') {
        matchesStatus = s.status === 'online' && s.active_alert_count > 0 && !s.is_paused;
      } else if (statusFilter === 'paused') {
        matchesStatus = s.is_paused;
      } else {
        matchesStatus = s.status === statusFilter;
      }
    }

    // Type filter
    const matchesType = !typeFilter ||
      typeFilter === 'all' ||
      s.machine_type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });
}, [servers, searchQuery, statusFilter, typeFilter]);
```

### Status Filter Values

| Chip Label | Filter Logic |
|------------|-------------|
| All | No filter |
| Online | status === 'online' && !is_paused && active_alert_count === 0 |
| Offline | status === 'offline' |
| Warning | status === 'online' && active_alert_count > 0 && !is_paused |
| Paused | is_paused === true |

---

## Edge Cases

| # | Scenario | Handling |
|---|----------|----------|
| 1 | Special regex chars in search | Escape with regex-escape or use includes() |
| 2 | Invalid status in URL | Default to 'all' |
| 3 | Keyboard navigation | Tab through chips, Enter/Space activates |
| 4 | 0 servers total | Show "No servers registered" (different message) |
| 5 | Combined filters empty | Show "No servers match your filters" |

---

## Definition of Done

- [ ] Search box filters by id, hostname, display_name
- [ ] Status filter chips work
- [ ] Type filter chips work
- [ ] URL persists filter state
- [ ] Clear button resets all filters
- [ ] Empty state shows appropriate message
- [ ] Keyboard accessible
- [ ] All tests passing
