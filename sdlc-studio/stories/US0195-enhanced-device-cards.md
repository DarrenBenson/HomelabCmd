# US0195: Enhanced Device Cards

> **Status:** Done
> **Epic:** [EP0019: Unified Device Discovery](../epics/EP0019-unified-device-discovery.md)
> **Owner:** Darren
> **Created:** 2026-01-31
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** device cards to show enhanced information for merged devices
**So that** I can see all connection paths and make informed import decisions

## Context

### Persona Reference

**Darren** - Technical professional managing a homelab. Needs complete information about devices discovered via multiple methods.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

When a device is discovered via both Network and Tailscale, the unified card should show information from both sources. This includes dual IPs, a recommended connection path indicator, and optional match confidence for transparency.

---

## Acceptance Criteria

### AC1: Dual IP display for merged devices

- **Given** a device is discovered via both Network and Tailscale
- **When** I view the device card
- **Then** I see both IP addresses:
  - Direct IP (e.g., 192.168.1.10)
  - Tailscale IP (e.g., 100.64.0.15) with "(TS)" suffix

### AC2: Recommended connection path indicator

- **Given** a device card with dual connectivity
- **When** I view the card
- **Then** I see which connection path is recommended:
  - Tailscale preferred if direct IP is non-routable or same subnet
  - Direct preferred if lower latency

### AC3: Match confidence tooltip (optional)

- **Given** a merged device with [N+T] badge
- **When** I hover over the badge
- **Then** I see match confidence: High (exact match), Medium (prefix), Low (partial)

### AC4: Card enter animations

- **Given** devices are loading into the list
- **When** cards appear
- **Then** they fade in with scale animation (200ms)
- **And** cards are staggered 50ms apart

### AC5: "Hide imported" toggle

- **Given** I am viewing the device list
- **When** I enable "Hide imported" toggle
- **Then** devices already imported as servers are hidden
- **And** the device count updates accordingly

---

## Scope

### In Scope

- Dual IP display in UnifiedDeviceCard
- Connection path recommendation indicator
- Match confidence tooltip on [N+T] badge
- Card enter/hover animations
- "Hide imported" toggle in filters

### Out of Scope

- Card click to expand details (future enhancement)
- Device comparison view
- Latency measurement (use static rules)

---

## Technical Notes

### Dual IP Display

```typescript
// In UnifiedDeviceCard
{device.networkDevice?.ip && (
  <span>{device.networkDevice.ip}</span>
)}
{device.tailscaleDevice?.addresses?.[0] && (
  <span className="text-muted-foreground">
    {device.tailscaleDevice.addresses[0]} (TS)
  </span>
)}
```

### Connection Path Recommendation Logic

```typescript
function getRecommendedPath(device: MergedDevice): 'network' | 'tailscale' {
  // Prefer Tailscale if:
  // - No direct IP
  // - Direct IP is non-routable (10.x, 172.16-31.x, 192.168.x)
  // - Tailscale shows as online
  if (!device.networkDevice?.ip) return 'tailscale';
  if (device.tailscaleDevice?.online) return 'tailscale';
  return 'network';
}
```

### Animation CSS

```css
@keyframes cardEnter {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.device-card {
  animation: cardEnter 200ms ease-out;
  animation-fill-mode: both;
}

.device-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
```

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/components/UnifiedDeviceCard.tsx` | Modify | Dual IP, animations |
| `frontend/src/components/discovery/ConnectivityIndicator.tsx` | Create | Recommended path badge |
| `frontend/src/components/DiscoveryFilters.tsx` | Modify | Add "Hide imported" toggle |

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | Only one IP available | Show single IP without path recommendation |
| 2 | Both IPs same | Show once, no duplication |
| 3 | Already imported device | Show "Already Monitored" badge, hide with toggle |
| 4 | Rapid list updates | Debounce animations to prevent jank |
| 5 | Tailscale offline | Show Tailscale IP but indicate offline status |

---

## Test Scenarios

- [ ] Dual IPs display correctly for merged devices
- [ ] Single IP displays for non-merged devices
- [ ] Recommended path indicator shows correct suggestion
- [ ] Match confidence tooltip appears on hover
- [ ] Card enter animation plays smoothly
- [ ] Card hover state shows elevation
- [ ] "Hide imported" toggle filters correctly
- [ ] Device count updates when toggle changes
- [ ] Animation stagger works for multiple cards

---

## Dependencies

### Story Dependencies

| Story | Relationship | Status |
|-------|--------------|--------|
| US0193 | Provides MergedDevice type | Planned |

---

## Estimation

**Story Points:** 3
**Complexity:** Low-Medium - UI enhancement, CSS animations

---

## Open Questions

None.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-31 | Claude | Initial story creation from plan |
