# US0193: Unified Device List with Merging

> **Status:** Done
> **Epic:** [EP0019: Unified Device Discovery](../epics/EP0019-unified-device-discovery.md)
> **Owner:** Darren
> **Created:** 2026-01-31
> **Story Points:** 8

## User Story

**As a** Darren (Homelab Operator)
**I want** to see all discoverable devices in a single unified list
**So that** I can quickly understand what's on my network without switching between tabs

## Context

### Persona Reference

**Darren** - Technical professional managing a homelab. Needs efficient workflows for device discovery and management.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

EP0016 created a tabbed discovery interface with Network and Tailscale tabs. While functional, this requires context switching and shows the same physical device twice if discovered via both methods. A unified view with intelligent device merging provides a better user experience.

---

## Acceptance Criteria

### AC1: Unified device list replaces tabs

- **Given** I am on the Discovery page
- **When** the page loads
- **Then** I see a single unified device list (no tabs)
- **And** devices from both Network and Tailscale sources appear together

### AC2: Device matching by hostname

- **Given** a device is discovered via both Network scan and Tailscale
- **When** the hostnames match (normalised, case-insensitive)
- **Then** they are merged into a single entry
- **And** the entry shows a [N+T] badge indicating both sources

### AC3: Source badges indicate discovery source

- **Given** devices in the unified list
- **When** I view device cards
- **Then** each card shows a source badge:
  - [N] for Network only
  - [T] for Tailscale only
  - [N+T] for both sources

### AC4: Parallel discovery fetching

- **Given** I am viewing the Discovery page
- **When** discovery is triggered
- **Then** Network scan and Tailscale fetch run in parallel
- **And** results are merged as they arrive

### AC5: Source filter in filters bar

- **Given** I am viewing the unified device list
- **When** I use the source filter
- **Then** I can filter by: All, Network Only, Tailscale Only, Both
- **And** the device count updates accordingly

---

## Scope

### In Scope

- `MergedDevice` type extending `UnifiedDevice`
- `useUnifiedDiscovery` hook with parallel fetching
- `deviceMatcher.ts` hostname matching utility
- Replace tabbed UI with single unified grid
- `SourceBadge` component for [N], [T], [N+T]
- Source filter in DiscoveryFilters

### Out of Scope

- Discovery source panel (US0194)
- Combined progress bar (US0194)
- Enhanced card dual-IP display (US0195)
- Import path selection (US0196)

---

## Technical Notes

### Implementation Approach

1. **MergedDevice type:**
   ```typescript
   interface MergedDevice extends UnifiedDevice {
     sources: ('network' | 'tailscale')[];
     networkDevice?: NetworkDiscoveredDevice;
     tailscaleDevice?: TailscaleDevice;
     matchConfidence?: 'high' | 'medium' | 'low';
   }
   ```

2. **Device matching algorithm:**
   ```typescript
   // HIGH confidence: Same IP or exact hostname match
   // MEDIUM confidence: Hostname prefix match (server1 matches server1.tail123.ts.net)
   // LOW confidence: Partial hostname overlap (4+ chars)
   ```

3. **Hostname normalisation:**
   - Convert to lowercase
   - Remove domain suffix (.local, .tail*.ts.net)
   - Trim whitespace

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/pages/DiscoveryPage.tsx` | Modify | Replace tabs with unified view |
| `frontend/src/types/discovery.ts` | Modify | Add `MergedDevice` type |
| `frontend/src/hooks/useUnifiedDiscovery.ts` | Create | Parallel discovery + merging |
| `frontend/src/lib/deviceMatcher.ts` | Create | Hostname matching algorithm |
| `frontend/src/components/SourceBadge.tsx` | Create | [N], [T], [N+T] badges |
| `frontend/src/components/DiscoveryFilters.tsx` | Modify | Add source filter |

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | Network scan fails | Show Tailscale results only, display error toast |
| 2 | Tailscale not configured | Show network results only, no error |
| 3 | No devices found | Show "No devices discovered" message |
| 4 | Same hostname, different IPs | Merge with high confidence, show both IPs |
| 5 | Similar hostnames (partial match) | Only merge if 4+ chars match, show low confidence |
| 6 | Very long device list (50+) | Consider virtualised list for performance |

---

## Test Scenarios

- [ ] Unified list shows devices from both sources
- [ ] Devices with matching hostnames are merged
- [ ] Source badge shows correct indicator ([N], [T], [N+T])
- [ ] Source filter works correctly for all options
- [ ] Parallel fetching shows progressive results
- [ ] Error handling for failed network scan
- [ ] Error handling for failed Tailscale fetch
- [ ] Empty state when no devices found
- [ ] Hostname normalisation handles edge cases

---

## Dependencies

### Story Dependencies

| Story | Relationship | Status |
|-------|--------------|--------|
| EP0016 stories | Foundation | Done |
| EP0008 stories | Tailscale API | Done |

### External Dependencies

None - uses existing backend APIs.

---

## Estimation

**Story Points:** 8
**Complexity:** High - device matching algorithm, state management, UI refactor

---

## Open Questions

None.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-31 | Claude | Initial story creation from plan |
