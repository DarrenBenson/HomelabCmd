# US0095: Unified Device Card Component

> **Status:** Done
> **Epic:** [EP0016: Unified Discovery Experience](../epics/EP0016-unified-discovery.md)
> **Owner:** Darren
> **Reviewer:** -
> **Created:** 2026-01-28
> **Story Points:** 5

## User Story

**As a** System Administrator
**I want** consistent device cards across discovery methods
**So that** I can quickly understand device status regardless of discovery source

## Context

### Persona Reference
**System Administrator** - Technical professional managing homelab infrastructure. Needs at-a-glance visibility of device availability and status.
[Full persona details](../personas.md#system-administrator)

### Background
Network and Tailscale discovery previously used different card designs with inconsistent information display. This component provides a unified visual representation with clear availability indicators.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | UX | Consistent card design | Same visual treatment for both sources |
| PRD | Accessibility | Tooltips for unavailable devices | Title attribute for unavailability reason |
| Epic | UX | Greyed-out unavailable devices | Visual distinction via opacity |

---

## Acceptance Criteria

### AC1: Available device rendering
- **Given** a device with `availability: 'available'`
- **When** the card is displayed
- **Then** the card has normal colours and opacity
- **And** a green status indicator (3px circle) is shown
- **And** action buttons are enabled

### AC2: Unavailable device rendering
- **Given** a device with `availability: 'unavailable'`
- **When** the card is displayed
- **Then** the card has `opacity-50` and `cursor-not-allowed`
- **And** a grey status indicator is shown
- **And** no action buttons are displayed

### AC3: Unavailability tooltip
- **Given** an unavailable device with `unavailableReason`
- **When** I hover over the card
- **Then** a tooltip shows the reason (e.g., "SSH failed: Permission denied" or "Offline - last seen 2h ago")
- **And** the reason is also shown in text at the bottom of the card

### AC4: Available not-monitored device actions
- **Given** an available device that is NOT already monitored
- **When** the card is displayed
- **Then** an "Import" button is shown with Download icon
- **And** clicking Import triggers the `onImport` callback

### AC5: Monitored device actions
- **Given** a device that is already monitored (`isMonitored: true`)
- **When** the card is displayed
- **Then** a "View" link is shown instead of Import
- **And** a shield/check icon indicates monitored status
- **And** the link navigates to `/servers/{serverId}`

### AC6: Card displays required information
- **Given** any device
- **When** the card is rendered
- **Then** it displays:
  - Hostname (truncated if too long)
  - IP address (monospace font)
  - OS icon (Server for linux, Monitor for windows/macos, Smartphone for ios/android)
  - OS name (capitalised)
  - Source icon (Wifi for network, Globe for Tailscale)
  - Response time in ms (network devices only)
  - Last seen time (Tailscale devices only)
  - SSH key used (if available and connection succeeded)

### AC7: SSH key success indicator
- **Given** a device with `sshKeyUsed` set and `availability: 'available'`
- **When** the card is displayed
- **Then** a Key icon with the key name is shown in green
- **And** tooltip shows "Authenticated with: {keyName}"

---

## Scope

### In Scope
- `UnifiedDeviceCard.tsx` component
- Status indicator (green/grey circle)
- Availability-based styling (opacity, cursor)
- Device information display
- Action buttons (Import, View)
- Tooltip for unavailability reason
- OS and source icons

### Out of Scope
- Import modal (US0099)
- Filtering logic (US0098)
- Device data fetching

---

## Technical Notes

### Implementation File
`frontend/src/components/UnifiedDeviceCard.tsx`

### Component Interface
```typescript
interface UnifiedDeviceCardProps {
  device: UnifiedDevice;
  onImport: (device: UnifiedDevice) => void;
}
```

### UnifiedDevice Interface
```typescript
interface UnifiedDevice {
  id: string;
  hostname: string;
  ip: string;
  os: string;
  source: 'network' | 'tailscale';
  availability: 'available' | 'unavailable' | 'untested';
  unavailableReason: string | null;
  isMonitored: boolean;
  serverId?: string;
  responseTimeMs: number | null;
  lastSeen: string | null;
  sshKeyUsed: string | null;
  tailscaleDeviceId?: string;
  tailscaleHostname?: string;
  tailscaleOnline?: boolean;
}
```

### Data Requirements
- Device data from parent component
- Callback for import action

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Very long hostname | Truncate with ellipsis (`truncate` class) |
| Missing unavailableReason | Show "Device unavailable" as default |
| Untested availability | Grey indicator, no actions shown |
| Missing serverId for monitored device | Don't show View link |
| Network device (no lastSeen) | Show responseTimeMs instead |
| Tailscale device (no responseTimeMs) | Show lastSeen instead |
| Both responseTimeMs and lastSeen null | Show neither |

---

## Test Scenarios

- [ ] Available device shows green indicator and Import button
- [ ] Unavailable device is greyed out with no actions
- [ ] Tooltip shows unavailability reason on hover
- [ ] Monitored device shows View link and shield icon
- [ ] OS icon matches device.os value
- [ ] Source icon matches device.source value
- [ ] SSH key shown when sshKeyUsed is set
- [ ] Long hostnames truncate properly

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| None | - | Standalone component | - |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| lucide-react | Icons | Available |
| React Router | Link component | Available |

---

## Estimation

**Story Points:** 5
**Complexity:** Medium - Multiple states, conditional rendering

---

## Open Questions

None - implementation complete.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Story extracted from implementation (brownfield) |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
