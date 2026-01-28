# US0102: Update Routes and Cleanup

> **Status:** Done
> **Epic:** [EP0016: Unified Discovery Experience](../epics/EP0016-unified-discovery.md)
> **Owner:** Darren
> **Reviewer:** -
> **Created:** 2026-01-28
> **Story Points:** 2

## User Story

**As a** developer
**I want** old discovery code updated and routes consolidated
**So that** the codebase is clean and maintainable

## Context

### Persona Reference
**Developer** - Maintains the HomelabCmd codebase.

### Background
After implementing the unified discovery page, navigation links throughout the app need updating to point to the new `/discovery` route, and the old Tailscale discovery route needs to redirect.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| TRD | Architecture | React Router v6 | Use Navigate component for redirect |
| Epic | UX | Seamless transition | Old URLs must still work |

---

## Acceptance Criteria

### AC1: New discovery route
- **Given** the App.tsx routes configuration
- **When** routes are defined
- **Then** `/discovery` route renders `DiscoveryPage` component

### AC2: Old route redirect
- **Given** the old `/discovery/tailscale` route
- **When** navigated to
- **Then** redirects to `/discovery?tab=tailscale`
- **And** uses `replace` to avoid browser history pollution

### AC3: Dashboard navigation updated
- **Given** the Dashboard component
- **When** looking at the Tailscale discovery link
- **Then** it points to `/discovery` (not `/discovery/tailscale`)

### AC4: No dead imports
- **Given** the updated files
- **When** checking imports
- **Then** no unused imports remain
- **And** all necessary imports are present

### AC5: Build succeeds
- **Given** all route and navigation changes
- **When** running `npm run build`
- **Then** the build completes successfully
- **And** no TypeScript errors

---

## Scope

### In Scope
- New route in App.tsx for `/discovery`
- Redirect route for `/discovery/tailscale`
- Update Dashboard link to `/discovery`
- Remove unused imports
- Verify build passes

### Out of Scope
- Deleting old TailscaleDevices.tsx (can be done later if not imported)
- Modifying NetworkDiscovery component
- Updating tests (separate effort)

---

## Technical Notes

### Implementation Files

**App.tsx changes:**
```typescript
import { DiscoveryPage } from './pages/DiscoveryPage';

// In Routes
<Route path="/discovery" element={<DiscoveryPage />} />
<Route path="/discovery/tailscale" element={<Navigate to="/discovery?tab=tailscale" replace />} />
```

**Dashboard.tsx changes:**
```typescript
// Update link from
to="/discovery/tailscale"
// to
to="/discovery"
```

### Verification Commands
```bash
# Check TypeScript compilation
npm run build

# Verify no compilation errors
tsc --noEmit
```

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| User bookmarked old URL | Redirect preserves functionality |
| External link to old URL | Redirect works transparently |
| Browser back button after redirect | Returns to previous page (not old route) |

---

## Test Scenarios

- [ ] `/discovery` route renders DiscoveryPage
- [ ] `/discovery/tailscale` redirects to `/discovery?tab=tailscale`
- [ ] Dashboard link goes to `/discovery`
- [ ] No TypeScript errors in build
- [ ] No unused imports warnings

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0094](US0094-unified-discovery-page-shell.md) | Component | DiscoveryPage | Done |
| [US0100](US0100-network-discovery-tab-integration.md) | Feature | Network tab complete | Done |
| [US0101](US0101-tailscale-tab-integration.md) | Feature | Tailscale tab complete | Done |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| React Router v6 | Library | Available |

---

## Estimation

**Story Points:** 2
**Complexity:** Low - Simple route and link updates

---

## Open Questions

None - implementation complete.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Story extracted from implementation (brownfield) |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
