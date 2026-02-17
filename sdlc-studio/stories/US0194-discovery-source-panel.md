# US0194: Discovery Source Control Panel

> **Status:** Done
> **Epic:** [EP0019: Unified Device Discovery](../epics/EP0019-unified-device-discovery.md)
> **Owner:** Darren
> **Created:** 2026-01-31
> **Story Points:** 5

## User Story

**As a** Darren (Homelab Operator)
**I want** a control panel to manage discovery sources
**So that** I can trigger discovery, see progress, and control which sources are active

## Context

### Persona Reference

**Darren** - Technical professional managing a homelab. Needs clear visibility into discovery progress and control over which methods are used.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

With unified discovery, users need a single place to control both discovery sources. The panel shows connection status, allows enabling/disabling sources, and provides a combined progress indicator when scanning.

---

## Acceptance Criteria

### AC1: Discovery source panel displays status

- **Given** I am on the Discovery page
- **When** I view the discovery source panel
- **Then** I see status for both sources:
  - Network: Subnet (e.g., 192.168.1.0/24), SSH key selection
  - Tailscale: Connection status (Connected/Not configured)

### AC2: Source enable/disable toggles

- **Given** I am viewing the discovery source panel
- **When** I toggle a source off
- **Then** that source is not included in discovery
- **And** the toggle state persists during the session

### AC3: Combined progress bar

- **Given** I have triggered "Discover All"
- **When** discovery is in progress
- **Then** I see a combined progress bar showing:
  - Network progress (e.g., 192/254 IPs)
  - Tailscale status (Loading/Complete)
- **And** completed sources show a checkmark

### AC4: Discover All button

- **Given** I am viewing the discovery source panel
- **When** I click "Discover All"
- **Then** all enabled sources run in parallel
- **And** results appear progressively as each source completes

### AC5: Tailscale graceful degradation

- **Given** Tailscale is not configured
- **When** I view the discovery source panel
- **Then** the Tailscale toggle is disabled
- **And** "Not configured" status is shown
- **And** "Discover All" runs network-only

---

## Scope

### In Scope

- `DiscoverySourcePanel` component
- Source enable/disable toggles
- Tailscale connection status display
- Subnet configuration display
- Combined progress bar with segments
- "Discover All" button triggering parallel discovery

### Out of Scope

- Subnet configuration editing (use existing settings)
- SSH key upload (use existing settings)
- Per-source "Discover" buttons (use Discover All only)

---

## Technical Notes

### Component Structure

```typescript
interface DiscoverySourcePanelProps {
  networkEnabled: boolean;
  tailscaleEnabled: boolean;
  onNetworkToggle: (enabled: boolean) => void;
  onTailscaleToggle: (enabled: boolean) => void;
  onDiscoverAll: () => void;
  networkProgress: { current: number; total: number } | null;
  tailscaleStatus: 'idle' | 'loading' | 'complete' | 'error';
  tailscaleConfigured: boolean;
  subnet: string;
}
```

### Progress Bar Design

- Two segments: Network (left), Tailscale (right)
- Segment width proportional to expected time (Network larger)
- Completed segments show checkmark icon
- Smooth animation for progress updates

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/components/discovery/DiscoverySourcePanel.tsx` | Create | Main panel component |
| `frontend/src/components/discovery/DiscoveryProgressBar.tsx` | Create | Combined progress bar |
| `frontend/src/pages/DiscoveryPage.tsx` | Modify | Integrate panel |

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | Both sources disabled | "Discover All" button disabled |
| 2 | Network scan error | Show error in network segment, continue showing Tailscale |
| 3 | Discovery already running | "Discover All" button disabled with "Scanning..." text |
| 4 | Tailscale token expired | Show "Reconnect" link in Tailscale status |
| 5 | No subnet configured | Show "Configure subnet" link |

---

## Test Scenarios

- [ ] Panel shows correct status for both sources
- [ ] Network toggle enables/disables network discovery
- [ ] Tailscale toggle enables/disables Tailscale discovery
- [ ] Tailscale toggle disabled when not configured
- [ ] "Discover All" triggers both sources in parallel
- [ ] Progress bar shows network progress
- [ ] Progress bar shows Tailscale completion status
- [ ] Checkmarks appear when sources complete
- [ ] Error states display correctly
- [ ] Button disabled while scanning

---

## Dependencies

### Story Dependencies

| Story | Relationship | Status |
|-------|--------------|--------|
| US0193 | Provides `useUnifiedDiscovery` hook | Planned |

---

## Estimation

**Story Points:** 5
**Complexity:** Medium - component composition, progress state management

---

## Open Questions

None.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-31 | Claude | Initial story creation from plan |
