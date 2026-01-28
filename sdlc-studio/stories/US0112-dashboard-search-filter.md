# US0112: Dashboard Search and Filter

> **Status:** Done
> **Epic:** [EP0017: Desktop UX Improvements](../epics/EP0017-desktop-ux-improvements.md)
> **Owner:** Darren
> **Created:** 2026-01-28
> **Completed:** 2026-01-28
> **Story Points:** 5

## User Story

**As a** Darren (Homelab Operator)
**I want** to search and filter servers on the dashboard
**So that** I can quickly find specific servers when I have 20+ machines

## Context

### Persona Reference

**Darren** - Technical professional running a homelab with 11+ servers. As the fleet grows, manually scanning the dashboard becomes inefficient.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

With 11+ servers and growing, the dashboard becomes harder to scan visually. Market leaders like Uptime Kuma and Grafana provide search boxes and filter chips to help users find specific servers instantly. This story adds search and filter functionality to the HomelabCmd dashboard.

---

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | Performance | Find server <2s | Filter must be instant (client-side) |
| PRD | Performance | Dashboard load <3s | Filtering must not re-fetch data |
| TRD | Architecture | React + Tailwind | Use existing input components |

---

## Acceptance Criteria

### AC1: Search box in dashboard header

- **Given** I am on the dashboard page
- **When** the page loads
- **Then** a search box appears in the dashboard header
- **And** the placeholder text shows "Search servers..."
- **And** a search icon (lucide-react Search) appears inside the input

### AC2: Search filters by name and hostname

- **Given** I type "media" in the search box
- **When** the input value changes
- **Then** only servers where `server_id` OR `hostname` contains "media" are shown
- **And** the filter is case-insensitive
- **And** filtering happens immediately (no debounce needed for <100 items)

### AC3: Filter chips for status

- **Given** I am on the dashboard page
- **When** the page loads
- **Then** filter chips appear below the search box: "All", "Online", "Offline", "Warning", "Paused"
- **And** "All" is selected by default
- **And** clicking a chip filters to that status

### AC4: Filter chips for machine type

- **Given** I am on the dashboard page
- **When** the page loads
- **Then** filter chips include: "Servers", "Workstations" (after EP0009)
- **And** clicking a type chip filters to that machine type
- **And** type and status filters can be combined

### AC5: URL state persistence

- **Given** I have search text "plex" and status filter "online"
- **When** I refresh the page
- **Then** the filters are restored from URL query parameters
- **And** the URL shows `?q=plex&status=online`

### AC6: Clear filters

- **Given** I have active search text or filters
- **When** I click the "Clear" button (or X icon)
- **Then** all filters reset to defaults (empty search, "All" status)
- **And** the URL query parameters are cleared

### AC7: Empty state message

- **Given** I have filters that match no servers
- **When** the filtered list is empty
- **Then** a message shows "No servers match your filters"
- **And** a "Clear filters" link is provided

---

## Scope

### In Scope

- Search box filtering by server_id and hostname
- Status filter chips (All, Online, Offline, Warning, Paused)
- Machine type filter chips (Servers, Workstations)
- URL query parameter persistence
- Clear filters functionality
- Empty state message
- Keyboard accessibility (Enter to search, Escape to clear)

### Out of Scope

- Server-side filtering/pagination (not needed for <100 servers)
- Saved filter presets
- Tag-based filtering (future feature)
- Advanced search syntax (field:value)
- Search history

---

## Technical Notes

### Implementation Approach

1. **Create DashboardFilters component:**
   ```tsx
   function DashboardFilters({
     searchQuery,
     onSearchChange,
     statusFilter,
     onStatusChange,
     typeFilter,
     onTypeChange,
     onClear
   }) {
     return (
       <div className="flex flex-col gap-2 mb-4">
         <div className="relative">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
           <input
             type="text"
             placeholder="Search servers..."
             value={searchQuery}
             onChange={(e) => onSearchChange(e.target.value)}
             className="pl-10 pr-4 py-2 w-full rounded-lg border"
           />
         </div>
         <div className="flex gap-2 flex-wrap">
           {statusFilters.map(s => (
             <FilterChip key={s} label={s} active={statusFilter === s} onClick={() => onStatusChange(s)} />
           ))}
         </div>
       </div>
     );
   }
   ```

2. **URL state management:**
   - Use `useSearchParams` from react-router-dom
   - Sync filter state with URL on change
   - Read initial state from URL on mount

3. **Filtering logic in Dashboard:**
   ```tsx
   const filteredServers = useMemo(() => {
     return servers.filter(s => {
       const matchesSearch = !searchQuery ||
         s.server_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
         s.hostname?.toLowerCase().includes(searchQuery.toLowerCase());
       const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
       const matchesType = !typeFilter || s.machine_type === typeFilter;
       return matchesSearch && matchesStatus && matchesType;
     });
   }, [servers, searchQuery, statusFilter, typeFilter]);
   ```

### Files to Modify

- `frontend/src/components/DashboardFilters.tsx` - New component
- `frontend/src/components/FilterChip.tsx` - New component
- `frontend/src/pages/Dashboard.tsx` - Integrate filters
- `frontend/src/hooks/useFilterState.ts` - Optional: custom hook for URL sync

### Data Requirements

- No API changes needed
- Uses existing server list data
- Machine type requires EP0009 Server.machine_type field

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | Search with special regex chars | Escape special characters, treat as literal |
| 2 | URL with invalid status | Ignore invalid param, use default "all" |
| 3 | Very long search query | Truncate display, still filter correctly |
| 4 | Mobile viewport | Chips wrap to multiple rows |
| 5 | Keyboard navigation | Tab through chips, Enter activates |
| 6 | 0 servers total | Show "No servers registered" (different from filter empty) |
| 7 | Filter applied via URL on first load | Apply before first render |
| 8 | Combined filters (status + type + search) | All filters AND together |

---

## Test Scenarios

- [x] Search box appears on dashboard
- [x] Typing in search filters servers by name
- [x] Typing in search filters servers by hostname
- [x] Search is case-insensitive
- [x] Status filter chips appear
- [x] Clicking status chip filters list
- [x] Type filter chips appear (if EP0009 done)
- [x] Filters persist in URL
- [x] Refreshing restores filters from URL
- [x] Clear button resets all filters
- [x] Empty state shows when no matches
- [x] Keyboard accessibility works

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| EP0009 | Feature | machine_type field for type filter | Done |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| react-router-dom useSearchParams | Library | Available |
| lucide-react Search icon | Library | Available |

---

## Estimation

**Story Points:** 5
**Complexity:** Medium - multiple filter types, URL sync, keyboard accessibility

---

## Open Questions

None.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation from EP0017 |
