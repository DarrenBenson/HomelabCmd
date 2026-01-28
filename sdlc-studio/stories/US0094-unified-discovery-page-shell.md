# US0094: Unified Discovery Page Shell

> **Status:** Done
> **Epic:** [EP0016: Unified Discovery Experience](../epics/EP0016-unified-discovery.md)
> **Owner:** Darren
> **Reviewer:** -
> **Created:** 2026-01-28
> **Story Points:** 3

## User Story

**As a** System Administrator
**I want** a single discovery page with tabs for different discovery methods
**So that** I can find and manage devices from one location

## Context

### Persona Reference
**System Administrator** - Technical professional managing homelab infrastructure. Primary user for device discovery and registration.
[Full persona details](../personas.md#system-administrator)

### Background
Previously, Network Discovery and Tailscale Discovery were separate pages requiring users to navigate between two locations. This story creates the unified page shell with tabbed navigation.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | UX | Single discovery experience | Must consolidate two pages |
| TRD | Architecture | React Router v6 | Use standard routing patterns |
| PRD | Accessibility | Keyboard navigation | Tabs must be accessible |

---

## Acceptance Criteria

### AC1: New route renders DiscoveryPage component
- **Given** the application routes configuration
- **When** I navigate to `/discovery`
- **Then** the `DiscoveryPage` component is rendered
- **And** the page displays with title "Device Discovery"

### AC2: Tailscale tab visibility based on configuration
- **Given** Tailscale is NOT configured (no API token)
- **When** I view the discovery page
- **Then** only the "Network Scan" tab is visible
- **And** the Tailscale tab is hidden

### AC3: Both tabs visible when Tailscale configured
- **Given** Tailscale IS configured (valid API token)
- **When** I view the discovery page
- **Then** both "Network Scan" and "Tailscale" tabs are visible
- **And** tabs are rendered as clickable elements

### AC4: Default tab based on connectivity mode (tailscale)
- **Given** connectivity mode is set to "tailscale"
- **And** Tailscale is configured
- **When** I load the discovery page without URL parameters
- **Then** the "Tailscale" tab is selected by default

### AC5: Default tab based on connectivity mode (direct_ssh)
- **Given** connectivity mode is set to "direct_ssh"
- **When** I load the discovery page without URL parameters
- **Then** the "Network Scan" tab is selected by default

### AC6: URL parameter tab selection
- **Given** I navigate to `/discovery?tab=tailscale`
- **When** Tailscale is configured
- **Then** the "Tailscale" tab is selected

### AC7: Old route redirect
- **Given** the old `/discovery/tailscale` route
- **When** I navigate to this URL
- **Then** I am redirected to `/discovery?tab=tailscale`
- **And** the redirect is a replace (no history entry)

---

## Scope

### In Scope
- New `DiscoveryPage.tsx` component
- Tabbed interface with Network Scan and Tailscale tabs
- URL query param `?tab=` for deep linking
- Route configuration in `App.tsx`
- Redirect from old `/discovery/tailscale` route
- Connectivity status check on mount

### Out of Scope
- Device card rendering (US0095)
- Filter component (US0098)
- Import modal (US0099)
- Tab content implementation (US0100, US0101)

---

## Technical Notes

### Implementation File
`frontend/src/pages/DiscoveryPage.tsx`

### API Contracts

**Check Connectivity Status:**
```typescript
GET /api/v1/settings/connectivity
Response: { mode: 'tailscale' | 'direct_ssh', ... }
```

**Check Tailscale Status:**
```typescript
GET /api/v1/settings/tailscale/status
Response: { configured: boolean, masked_token: string | null }
```

### Data Requirements
- Connectivity mode from settings API
- Tailscale configuration status

### Key Implementation Details
```typescript
type TabId = 'network' | 'tailscale';

// URL param handling
const [searchParams, setSearchParams] = useSearchParams();
const tabParam = searchParams.get('tab') as TabId | null;

// Tab change updates URL
function handleTabChange(tab: TabId) {
  setActiveTab(tab);
  setSearchParams({ tab });
}
```

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Tailscale API check fails | Default to network tab, hide Tailscale tab |
| Connectivity API fails | Default to network tab |
| Invalid tab param `?tab=invalid` | Fallback to network tab |
| Tab param for hidden tab `?tab=tailscale` when not configured | Fallback to network tab |
| Network error during configuration check | Show error state, allow retry |

---

## Test Scenarios

- [ ] Navigate to `/discovery` renders page with title
- [ ] Tailscale tab hidden when not configured
- [ ] Tailscale tab visible when configured
- [ ] Default tab respects connectivity mode
- [ ] URL param `?tab=tailscale` selects correct tab
- [ ] Redirect from `/discovery/tailscale` works
- [ ] Tab change updates URL parameter

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0080](US0080-connectivity-mode-management.md) | API | Connectivity status endpoint | Done |
| [US0076](US0076-tailscale-api-client.md) | API | Tailscale status endpoint | Done |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| React Router v6 | Library | Available |

---

## Estimation

**Story Points:** 3
**Complexity:** Low - Standard React component with routing

---

## Open Questions

None - implementation complete.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Story extracted from implementation (brownfield) |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
