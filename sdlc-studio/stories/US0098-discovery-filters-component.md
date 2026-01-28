# US0098: Discovery Filters Component

> **Status:** Done
> **Epic:** [EP0016: Unified Discovery Experience](../epics/EP0016-unified-discovery.md)
> **Owner:** Darren
> **Reviewer:** -
> **Created:** 2026-01-28
> **Story Points:** 3

## User Story

**As a** System Administrator
**I want** to filter discovered devices
**So that** I can focus on relevant devices

## Context

### Persona Reference
**System Administrator** - Needs to quickly find specific devices in larger discovery results.
[Full persona details](../personas.md#system-administrator)

### Background
When discovering devices, the results may contain many entries. Filtering by status and OS helps focus on actionable devices (available ones that can be imported).

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | UX | Consistent filter experience | Same filters for both tabs |
| PRD | Performance | Client-side filtering | Immediate response, no API calls |

---

## Acceptance Criteria

### AC1: Status filter dropdown
- **Given** the filter component is rendered
- **When** I view the Status filter
- **Then** it shows a dropdown with options:
  - "All" (default)
  - "Available"
  - "Unavailable"

### AC2: OS filter dropdown
- **Given** the filter component is rendered
- **When** I view the OS filter
- **Then** it shows a dropdown with options:
  - "Any OS" (default)
  - "Linux"
  - "Windows"
  - "macOS"
  - "Other"

### AC3: Status filter - Available
- **Given** Status filter set to "Available"
- **When** applied
- **Then** only devices with `availability: 'available'` are shown

### AC4: Status filter - Unavailable
- **Given** Status filter set to "Unavailable"
- **When** applied
- **Then** only devices with `availability: 'unavailable'` are shown

### AC5: OS filter applied
- **Given** OS filter set to "Linux"
- **When** applied
- **Then** only devices with `os: 'linux'` (case-insensitive) are shown

### AC6: Device count display - unfiltered
- **Given** no filters applied (all = default)
- **When** viewing the count
- **Then** it shows "{total} device(s) found ({available} available)"
- **And** the available count is shown in green

### AC7: Device count display - filtered
- **Given** filters are applied
- **When** viewing the count
- **Then** it shows "Showing {filtered} of {total} device(s)"

### AC8: SSH Key selector (Network tab only)
- **Given** the Network Scan tab is active
- **When** the filter component is rendered
- **Then** an SSH Key selector dropdown is shown
- **And** it shows:
  - "Attempt all keys" (default)
  - Each configured key with name and username

### AC9: SSH Key selector hidden
- **Given** the Tailscale tab is active
- **When** the filter component is rendered
- **Then** the SSH Key selector is NOT shown

---

## Scope

### In Scope
- `DiscoveryFilters.tsx` component
- Status filter dropdown (All/Available/Unavailable)
- OS filter dropdown (Any/Linux/Windows/macOS/Other)
- SSH Key selector (conditional)
- Device count with filter context
- Client-side filter application

### Out of Scope
- Filter state management (parent component responsibility)
- API-level filtering
- Persistence of filter preferences

---

## Technical Notes

### Implementation File
`frontend/src/components/DiscoveryFilters.tsx`

### Component Interface
```typescript
interface DiscoveryFiltersProps {
  statusFilter: 'all' | 'available' | 'unavailable';
  onStatusFilterChange: (filter: StatusFilter) => void;
  osFilter: 'all' | 'linux' | 'windows' | 'macos' | 'other';
  onOsFilterChange: (filter: OsFilter) => void;
  selectedKeyId: string;
  onKeyIdChange: (keyId: string) => void;
  sshKeys: SSHKeyMetadata[];
  sshKeysLoading: boolean;
  showKeySelector: boolean;  // false for Tailscale tab
  totalCount: number;
  filteredCount: number;
  availableCount: number;
}
```

### Filter Types
```typescript
type StatusFilter = 'all' | 'available' | 'unavailable';
type OsFilter = 'all' | 'linux' | 'windows' | 'macos' | 'other';
```

### Data Requirements
- SSH keys list (for key selector)
- Count values calculated by parent

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| No SSH keys configured | Key selector shows "No keys configured" text |
| SSH keys loading | Key selector disabled with loading state |
| Zero devices found | Show "0 devices found" |
| All devices filtered out | Show "Showing 0 of {total} devices" |
| Single device | Use singular "device" not "devices" |
| OS filter "Other" | Match ios, android, and any non-standard OS |

---

## Test Scenarios

- [ ] Status dropdown shows correct options
- [ ] OS dropdown shows correct options
- [ ] Selecting Available filter updates parent
- [ ] Selecting OS filter updates parent
- [ ] Device count shows correct format when unfiltered
- [ ] Device count shows correct format when filtered
- [ ] SSH Key selector visible on Network tab
- [ ] SSH Key selector hidden on Tailscale tab
- [ ] Key selector disabled when loading

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0094](US0094-unified-discovery-page-shell.md) | Parent | Filter state management | Done |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| lucide-react | Key icon | Available |

---

## Estimation

**Story Points:** 3
**Complexity:** Low - Stateless UI component

---

## Open Questions

None - implementation complete.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Story extracted from implementation (brownfield) |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
