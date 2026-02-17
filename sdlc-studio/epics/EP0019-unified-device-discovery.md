# EP0019: Unified Device Discovery

> **Status:** Done
> **Owner:** Darren
> **Reviewer:** Claude
> **Created:** 2026-01-31
> **Target Release:** Phase 2 (Beta)

## Summary

Merge SSH Network Scanning and Tailscale Discovery into a single "Single Pane of Glass" experience with intelligent device deduplication and parallel discovery. Devices from both sources appear in one unified list, with matched devices showing combined information from both discovery methods.

## Inherited Constraints

> See PRD and TRD for full constraint details. Key constraints for this epic:

| Source | Type | Constraint | Impact |
|--------|------|------------|--------|
| PRD | Performance | < 200ms UI interactions | Device merging must not block UI |
| PRD | Security | No credential exposure | SSH keys shown as fingerprints only |
| TRD | Architecture | React SPA + FastAPI | Frontend-only changes (this epic) |
| TRD | Tech Stack | TypeScript, Tailwind CSS | All new components follow existing patterns |

---

## Business Context

### Problem Statement

EP0016 created a tabbed DiscoveryPage with shared components, but the experience is still fragmented:
- **Two tabs** (Network / Tailscale) requiring users to switch contexts
- **Different workflows**: Network requires manual "Discover Now", Tailscale auto-loads cached
- **No device merging**: Same device appears separately in each tab
- **Different filtering**: Network has SSH key selector, Tailscale doesn't

**PRD Reference:** [Feature Inventory](../prd.md#feature-inventory)

### Value Proposition

A unified discovery experience allows users to see all discoverable devices in one view, automatically matching devices found via both methods. This reduces cognitive load, eliminates duplicate entries, and enables smarter import decisions by showing all available connection paths.

### Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Tabs required | 2 | 0 | Single unified view |
| Duplicate device entries | Many | 0 | Device matching algorithm |
| Discovery actions | 2 separate | 1 parallel | "Discover All" button |

---

## Scope

### In Scope

- Unified device list merging network and Tailscale sources
- Device matching algorithm (hostname, IP)
- Source badges showing [N], [T], [N+T]
- Discovery source control panel with parallel execution
- Combined progress bar for both sources
- Enhanced device cards with dual IPs
- Smart import flow with connection path selection
- "Hide imported" filter toggle
- Source filter (Network, Tailscale, Both)

### Out of Scope

- Backend API changes (using existing endpoints)
- New discovery methods (mDNS, SNMP)
- Device fingerprinting beyond hostname/IP
- Cross-session device persistence (uses session state)

### Affected Personas

- **Darren (Homelab Operator):** Primary user - needs quick overview of all devices across discovery methods

---

## Acceptance Criteria (Epic Level)

- [x] Single unified view replaces tabbed interface
- [x] Devices from both sources appear in same list
- [x] Matched devices show [N+T] badge with both IPs
- [x] "Discover All" runs both sources in parallel
- [x] Progress bar shows status of both sources
- [x] Import modal shows recommended connection path
- [x] All existing discovery functionality preserved

---

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner |
|------------|------|--------|-------|
| EP0016 | Epic | Done | Darren |
| EP0008 | Epic | Done | Darren |

### Blocking

| Item | Type | Impact |
|------|------|--------|
| None | - | - |

---

## Risks & Assumptions

### Assumptions

- Hostname matching is reliable for device deduplication
- Users prefer seeing matched devices together
- Tailscale API remains responsive during parallel discovery

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Hostname matching too aggressive | Medium | Medium | Use confidence levels, prefer no match over wrong match |
| Performance with many devices | Low | Medium | Virtualised list if > 50 devices |
| Tailscale not configured | Medium | Low | Graceful fallback to network-only mode |
| Network scan takes too long | Medium | Low | Show Tailscale results immediately while network scans |

---

## Technical Considerations

### Architecture Impact

Frontend-only changes. Creates new hooks and utilities for device merging logic. No backend API changes required - uses existing `/api/v1/scan` and `/api/v1/tailscale/devices` endpoints.

### Integration Points

- `useNetworkDiscovery` hook (existing)
- `useTailscaleDiscovery` hook (existing)
- `UnifiedDeviceCard` component (existing, enhanced)
- `DiscoveryFilters` component (existing, enhanced)
- `UnifiedImportModal` component (existing, enhanced)

---

## Sizing

**Story Points:** 22
**Estimated Story Count:** 5

**Complexity Factors:**

- Device matching algorithm requires careful tuning
- Parallel discovery state management
- UI must remain responsive during scanning
- Backwards compatibility with existing discovery flow

---

## Story Breakdown

- [x] [US0193: Unified Device List with Merging](../stories/US0193-unified-device-list-merging.md) (8 pts)
- [x] [US0194: Discovery Source Control Panel](../stories/US0194-discovery-source-panel.md) (5 pts)
- [x] [US0195: Enhanced Device Cards](../stories/US0195-enhanced-device-cards.md) (3 pts)
- [x] [US0196: Smart Import Path Selection](../stories/US0196-smart-import-path.md) (3 pts)
- [x] [US0197: Testing and Cleanup](../stories/US0197-testing-cleanup.md) (3 pts)

---

## Test Plan

**Test Spec:** See individual story test specs

---

## Open Questions

None.

---

## Implementation Summary

**Note:** This epic was discovered to already be implemented during story planning. The codebase contains complete implementations referencing EP0019 in code comments.

### Files Created

| File | Purpose |
|------|---------|
| `frontend/src/hooks/useUnifiedDiscovery.ts` | Parallel discovery + merging hook |
| `frontend/src/lib/deviceMatcher.ts` | Hostname matching algorithm |
| `frontend/src/components/SourceBadge.tsx` | [N], [T], [N+T] source badges |
| `frontend/src/components/discovery/DiscoverySourcePanel.tsx` | Source control panel |
| `frontend/src/components/discovery/DiscoveryProgressBar.tsx` | Combined progress bar |

### Files Modified

| File | Change |
|------|--------|
| `frontend/src/pages/DiscoveryPage.tsx` | Unified single-pane view (no tabs) |
| `frontend/src/types/discovery.ts` | Added `MergedDevice`, `MatchConfidence` types |
| `frontend/src/components/UnifiedDeviceCard.tsx` | Dual IP display, source badges |
| `frontend/src/components/DiscoveryFilters.tsx` | Added source filter |
| `frontend/src/components/UnifiedImportModal.tsx` | Path selection for merged devices |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-31 | Claude | Initial epic creation from plan |
| 2026-01-31 | Claude | Status → Done - implementation already exists in codebase |
