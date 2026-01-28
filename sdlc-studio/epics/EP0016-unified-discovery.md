# EP0016: Unified Discovery Experience

> **Status:** Done
> **Owner:** Darren
> **Reviewer:** -
> **Created:** 2026-01-28
> **Target Release:** Phase 2 (Beta)

## Summary

Consolidate the separate Network Discovery (ScansPage) and Tailscale Discovery (TailscaleDevices) pages into a single, unified `/discovery` page. Provides consistent UX with tabbed discovery methods, unified device cards, and matching action flows across both discovery sources.

## Inherited Constraints

> See PRD and TRD for full constraint details. Key constraints for this epic:

| Source | Type | Constraint | Impact |
|--------|------|------------|--------|
| PRD | UX | Single discovery experience | Must consolidate two existing pages |
| PRD | Performance | SSH testing <10s per device | Parallel SSH testing required |
| TRD | Architecture | Existing API patterns | New endpoints follow established conventions |
| TRD | Tech Stack | React + FastAPI | Frontend components, backend routes |

---

## Business Context

### Problem Statement

Users currently have two separate discovery experiences:
1. Network Discovery on the Scans page - scans local subnet for devices
2. Tailscale Discovery on a separate page - lists Tailscale network devices

This fragmentation creates confusion about where to find devices and inconsistent import workflows between the two methods.

**PRD Reference:** [Device Discovery](../prd.md#device-discovery)

### Value Proposition

A unified discovery page provides:
- Single location for all device discovery
- Consistent device card design showing availability status
- Unified import modal for both discovery methods
- SSH testing for Tailscale devices during discovery
- Clear visual feedback on which devices are available for import

### Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Discovery pages | 2 | 1 | Page count |
| User clicks to import | 4-6 | 2-3 | Click tracking |
| Device availability visibility | None | 100% | SSH status shown |

---

## Scope

### In Scope
- Unified `/discovery` page with tabs for Network Scan and Tailscale
- Unified device card component with availability indicators
- SSH testing endpoint for Tailscale devices
- SSH status in Tailscale device list response
- Shared filter component (Status, OS, SSH Key)
- Unified import modal for both discovery methods
- Redirect from old `/discovery/tailscale` route
- Updated navigation links

### Out of Scope
- Changes to underlying discovery mechanisms
- New discovery methods (e.g., mDNS, SNMP)
- Bulk import functionality
- Discovery scheduling/automation

### Affected Personas
- **System Administrator:** Primary user - discovers and imports devices
- **Home Lab Enthusiast:** Discovers new devices added to network

---

## Acceptance Criteria (Epic Level)

- [x] Single `/discovery` page with tabbed interface
- [x] Tailscale tab only visible when Tailscale configured
- [x] Default tab based on connectivity mode setting
- [x] Consistent device cards across both discovery methods
- [x] Unavailable devices greyed out with tooltip explaining why
- [x] SSH testing for Tailscale devices shows true availability
- [x] Unified import modal works for both Network and Tailscale devices
- [x] Old `/discovery/tailscale` route redirects to new page

---

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner |
|------------|------|--------|-------|
| EP0008 Tailscale Integration | Epic | Done | Darren |
| US0079 SSH Settings | Story | Done | Darren |
| US0080 Connectivity Mode | Story | Done | Darren |

### Blocking

| Item | Type | Impact |
|------|------|--------|
| None | - | - |

---

## Risks & Assumptions

### Assumptions
- Users prefer consolidated discovery over separate pages
- SSH testing latency is acceptable for UX
- Existing import flows can be unified without breaking changes

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| SSH testing slows page load | Medium | Medium | Parallel testing, caching |
| User confusion during transition | Low | Low | Redirect old routes |
| Import modal complexity | Low | Medium | Phased field display |

---

## Technical Considerations

### Architecture Impact

**Frontend:**
- New `DiscoveryPage.tsx` replaces separate pages
- New components: `UnifiedDeviceCard`, `DiscoveryFilters`, `UnifiedImportModal`
- Updated routing in `App.tsx`

**Backend:**
- New endpoint: `POST /api/v1/tailscale/devices/{device_id}/test-ssh`
- New endpoint: `GET /api/v1/tailscale/devices/with-ssh`
- SSH status caching (5-minute TTL)

### Integration Points
- Tailscale API for device list
- SSH Pooled Executor for connection testing
- Existing Network Discovery service
- Existing import endpoints

---

## Sizing

**Story Points:** 32
**Estimated Story Count:** 9

**Complexity Factors:**
- Frontend: New unified page with multiple components
- Backend: SSH testing with parallel execution and caching
- UX: Consistent card design across different data sources

---

## Story Breakdown

- [x] US0094: Unified Discovery Page Shell (3 SP, P1)
- [x] US0095: Unified Device Card Component (5 SP, P1)
- [x] US0096: SSH Test Endpoint for Tailscale Devices (3 SP, P1)
- [x] US0097: Tailscale Device List with SSH Status (5 SP, P1)
- [x] US0098: Discovery Filters Component (3 SP, P2)
- [x] US0099: Unified Import Modal (5 SP, P2)
- [x] US0100: Network Discovery Tab Integration (3 SP, P2)
- [x] US0101: Tailscale Tab Integration (3 SP, P2)
- [x] US0102: Update Routes and Cleanup (2 SP, P3)

---

## Implementation Summary

### Files Created

| File | Purpose |
|------|---------|
| `frontend/src/pages/DiscoveryPage.tsx` | Unified discovery page with tabs |
| `frontend/src/components/UnifiedDeviceCard.tsx` | Consistent device card component |
| `frontend/src/components/DiscoveryFilters.tsx` | Shared filter controls |
| `frontend/src/components/UnifiedImportModal.tsx` | Combined import modal |

### Files Modified

| File | Change |
|------|--------|
| `frontend/src/types/discovery.ts` | Added `UnifiedDevice` interface |
| `frontend/src/types/tailscale.ts` | Added SSH status fields |
| `frontend/src/api/tailscale.ts` | Added SSH testing support |
| `frontend/src/App.tsx` | New route, redirect |
| `frontend/src/pages/Dashboard.tsx` | Updated discovery link |
| `backend/src/homelab_cmd/api/routes/tailscale.py` | SSH test endpoints |
| `backend/src/homelab_cmd/api/schemas/tailscale.py` | SSH schemas |

### API Endpoints Added

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/tailscale/devices/{device_id}/test-ssh` | Test SSH to device |
| GET | `/api/v1/tailscale/devices/with-ssh` | List devices with SSH status |

---

## Test Plan

**Unit Tests:**
- UnifiedDeviceCard states and rendering
- Filter logic
- Device transformation functions

**Integration Tests:**
- SSH testing endpoint
- Device list with SSH status

**E2E Tests:**
- Full discovery flow for both methods
- Import flow from discovery to agent install

---

## Open Questions

None - implementation complete.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Darren | Epic created |
| 2026-01-28 | Claude | Implementation complete, status → Done |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Standardised header format, added Story Points |
