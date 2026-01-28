# US0112: Dashboard Search and Filter

> **Status:** Ready
> **Epic:** [EP0017: Desktop UX Improvements](../epics/EP0017-desktop-ux-improvements.md)
> **Owner:** Darren
> **Reviewer:** -
> **Created:** 2026-01-28
> **Story Points:** 5

## User Story

**As a** system administrator with many servers
**I want** to search and filter the dashboard
**So that** I can quickly find specific servers

## Context

### Persona Reference
**System Administrator** - Manages homelab infrastructure with 10+ servers, needs efficient navigation
[Full persona details](../personas.md#system-administrator)

### Background

The current dashboard displays all servers in a grid without any search or filtering capability. For users with more than 10-20 servers, finding a specific server requires visual scanning of all cards. Market leaders like Uptime Kuma, Grafana, and Datadog all provide search/filter functionality as standard.

Adding a search box and filter chips will make the dashboard usable at scale and match industry expectations.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| PRD | Performance | Dashboard <3s load | Filtering must be instant (client-side) |
| TRD | Architecture | React + Tailwind | Use existing component patterns |
| Epic | Accessibility | WCAG 2.1 AA | Keyboard-accessible filters |

---

## Acceptance Criteria

### AC1: Search Box in Header
- **Given** the Dashboard page
- **When** I type in the search box
- **Then** the server grid filters to show only servers whose name or hostname contains the search term (case-insensitive)

### AC2: Status Filter Chips
- **Given** the Dashboard page
- **When** I click a status filter chip (Online, Offline, Warning)
- **Then** the server grid filters to show only servers matching that status
- **And** multiple status chips can be selected simultaneously (OR logic)

### AC3: Machine Type Filter
- **Given** the Dashboard page
- **When** I click a machine type filter chip (Server, Workstation)
- **Then** the server grid filters to show only servers of that machine type
- **And** multiple types can be selected simultaneously (OR logic)

### AC4: Combined Filter Display
- **Given** active filters
- **When** viewing the dashboard
- **Then** I see a count "X of Y servers" showing filtered/total count
- **And** active filter chips are visually highlighted

### AC5: URL State Persistence
- **Given** active search and filters
- **When** I copy the URL and open it in a new tab
- **Then** the same search term and filters are applied
- **And** URL format is `?q=search&status=online,warning&type=server`

### AC6: Clear All Button
- **Given** active filters
- **When** I click "Clear All"
- **Then** all filters are removed
- **And** the search box is cleared
- **And** all servers are shown

### AC7: Empty State
- **Given** filters that match no servers
- **When** the result is empty
- **Then** I see a message "No servers match your filters"
- **And** I see a "Clear filters" button

---

## Scope

### In Scope
- Search box filtering by server name and hostname
- Status filter chips (Online, Offline, Warning)
- Machine type filter chips (Server, Workstation)
- Filter count display (X of Y servers)
- URL query parameter persistence
- Clear all button
- Empty state handling

### Out of Scope
- Tag-based filtering (requires tag system)
- Saved filter presets
- Advanced query syntax (operators, boolean logic)
- Server-side filtering (all client-side)

---

## Technical Notes

### Implementation Approach

Create `DashboardFilters` component:

```tsx
interface DashboardFiltersProps {
  servers: Server[];
  onFilter: (filtered: Server[]) => void;
}

export function DashboardFilters({ servers, onFilter }: DashboardFiltersProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse URL state
  const searchQuery = searchParams.get('q') || '';
  const statusFilter = searchParams.get('status')?.split(',') || [];
  const typeFilter = searchParams.get('type')?.split(',') || [];

  // Apply filters
  useEffect(() => {
    let filtered = servers;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.display_name?.toLowerCase().includes(q) ||
        s.hostname.toLowerCase().includes(q)
      );
    }

    if (statusFilter.length > 0) {
      filtered = filtered.filter(s => statusFilter.includes(s.status));
    }

    if (typeFilter.length > 0) {
      filtered = filtered.filter(s => typeFilter.includes(s.machine_type));
    }

    onFilter(filtered);
  }, [servers, searchQuery, statusFilter, typeFilter]);

  // ...render search box and chips
}
```

### URL State Format

```
/dashboard?q=media&status=online,warning&type=server
```

- `q`: Search query (free text)
- `status`: Comma-separated status values (online, offline, warning)
- `type`: Comma-separated machine types (server, workstation)

### Component Structure

```
Dashboard.tsx
├── DashboardFilters
│   ├── SearchBox (with debounce)
│   ├── FilterChips (status)
│   ├── FilterChips (machine type)
│   └── FilterSummary ("5 of 12 servers" + Clear All)
└── ServerGrid (receives filtered servers)
```

### Dependencies

- React Router `useSearchParams` (already available)
- Debounce utility for search (lodash.debounce or custom)

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Search with special characters | Escape regex characters, literal search |
| Search with leading/trailing spaces | Trim spaces before filtering |
| Empty search box | Show all servers (no filter) |
| All filter chips deselected | Show all servers (no filter) |
| Filter matches 0 servers | Show empty state with "Clear filters" |
| 100+ servers | Client-side filter remains fast (<50ms) |
| URL with invalid filter values | Ignore invalid values, use defaults |
| Browser back/forward | Filters update from URL |

---

## Test Scenarios

- [ ] Verify search box filters by display name
- [ ] Verify search box filters by hostname
- [ ] Verify case-insensitive search
- [ ] Verify status filter chips work (single selection)
- [ ] Verify status filter chips work (multiple selection)
- [ ] Verify machine type filter works
- [ ] Verify combined search + status + type filters
- [ ] Verify "X of Y servers" count updates
- [ ] Verify URL contains filter state
- [ ] Verify URL filter state restores on page load
- [ ] Verify Clear All button resets everything
- [ ] Verify empty state message appears
- [ ] Verify keyboard navigation for filter chips
- [ ] Verify browser back/forward updates filters

---

## Dependencies

### Story Dependencies

None - uses existing server data

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| React Router useSearchParams | Library | Available |
| Server list with machine_type | Data | Available |

---

## Estimation

**Story Points:** 5
**Complexity:** Medium (URL state management, multiple filter types)

---

## Open Questions

None

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
