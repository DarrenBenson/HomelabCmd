# US0100: Network Discovery Tab Integration

> **Status:** Done
> **Epic:** [EP0016: Unified Discovery Experience](../epics/EP0016-unified-discovery.md)
> **Owner:** Darren
> **Reviewer:** -
> **Created:** 2026-01-28
> **Story Points:** 3

## User Story

**As a** System Administrator
**I want** Network discovery working in the unified page
**So that** I can scan my local network for devices

## Context

### Persona Reference
**System Administrator** - Performs network scans to discover devices on local subnet.
[Full persona details](../personas.md#system-administrator)

### Background
The Network Scan tab integrates existing network discovery functionality into the unified page. It includes subnet display, discovery initiation, progress tracking, and result display using UnifiedDeviceCards.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | UX | Consistent device cards | Use UnifiedDeviceCard |
| TRD | Architecture | Existing discovery API | No API changes |
| Epic | State | LocalStorage persistence | Preserve activeDiscoveryId |

---

## Acceptance Criteria

### AC1: Subnet and settings display
- **Given** Network Scan tab is selected
- **When** the tab content loads
- **Then** the configured subnet is displayed
- **And** a Settings button is shown to modify discovery settings

### AC2: Discover Now button
- **Given** no discovery is running
- **When** I view the Network Scan tab
- **Then** a "Discover Now" button is shown
- **And** clicking it starts a new discovery

### AC3: Discovery progress
- **Given** "Discover Now" is clicked
- **When** discovery is running
- **Then** a progress indicator shows scan status
- **And** the scanned IP count is shown
- **And** the button is disabled during scan

### AC4: Results as UnifiedDeviceCards
- **Given** discovery completes
- **When** results are shown
- **Then** devices are displayed as a grid of UnifiedDeviceCards
- **And** each card shows hostname, IP, availability status

### AC5: SSH success determines availability
- **Given** a device with `ssh_auth_status: 'success'`
- **When** displayed
- **Then** availability is `'available'`
- **And** the device can be imported

### AC6: SSH failure determines unavailability
- **Given** a device with `ssh_auth_status: 'failed'`
- **When** displayed
- **Then** availability is `'unavailable'`
- **And** unavailableReason shows the SSH error
- **And** the card is greyed out

### AC7: LocalStorage persistence
- **Given** an active discovery ID exists
- **When** the page is refreshed
- **Then** the discovery ID is restored from localStorage
- **And** the discovery results are loaded

### AC8: Last scan timestamp
- **Given** a previous discovery exists
- **When** viewing the Network Scan tab
- **Then** "Last scan: {relative_time}" is shown

### AC9: Polling during discovery
- **Given** discovery status is "running" or "pending"
- **When** the tab is active
- **Then** the discovery is polled every 2 seconds
- **And** polling stops when status changes to "completed" or "failed"

### AC10: Settings modal
- **Given** Settings button is clicked
- **When** the modal opens
- **Then** the existing DiscoverySettingsModal is shown
- **And** changes are saved via existing API

---

## Scope

### In Scope
- Network Scan tab content in DiscoveryPage
- Discover Now button and handler
- Progress display during scan
- Device transformation to UnifiedDevice format
- LocalStorage persistence of activeDiscoveryId
- Polling logic for discovery status
- Settings modal integration

### Out of Scope
- Changes to discovery API
- Changes to DiscoverySettingsModal
- Filter component (US0098)

---

## Technical Notes

### Implementation Location
`frontend/src/pages/DiscoveryPage.tsx` (Network tab section)

### Device Transformation
```typescript
function networkDeviceToUnified(device: DiscoveryDevice): UnifiedDevice {
  let availability: AvailabilityStatus = 'untested';
  let unavailableReason: string | null = null;

  if (device.ssh_auth_status === 'success') {
    availability = 'available';
  } else if (device.ssh_auth_status === 'failed') {
    availability = 'unavailable';
    unavailableReason = device.ssh_auth_error || 'SSH authentication failed';
  }

  return {
    id: device.ip,
    hostname: device.hostname || device.ip,
    ip: device.ip,
    os: 'linux',  // Network discovery doesn't detect OS
    source: 'network',
    availability,
    unavailableReason,
    isMonitored: device.is_monitored,
    serverId: device.is_monitored ? device.ip.replace(/\./g, '-') : undefined,
    responseTimeMs: device.response_time_ms,
    lastSeen: null,
    sshKeyUsed: device.ssh_key_used,
  };
}
```

### State Management
```typescript
const [networkSettings, setNetworkSettings] = useState<DiscoverySettings | null>(null);
const [networkDiscovery, setNetworkDiscovery] = useState<DiscoveryResponse | null>(null);
const [networkDevices, setNetworkDevices] = useState<UnifiedDevice[]>([]);
const [isNetworkScanning, setIsNetworkScanning] = useState(false);
const [activeDiscoveryId, setActiveDiscoveryId] = useState<number | undefined>(() => {
  const storedId = localStorage.getItem('activeDiscoveryId');
  return storedId ? parseInt(storedId, 10) : undefined;
});
```

### Polling Configuration
```typescript
const POLL_INTERVAL_MS = 2000;

useEffect(() => {
  if (!activeDiscoveryId) return;

  const shouldPoll = networkDiscovery?.status === 'running' ||
                     networkDiscovery?.status === 'pending';
  if (!shouldPoll && networkDiscovery) return;

  const interval = setInterval(() => {
    fetchNetworkDiscovery(activeDiscoveryId);
  }, POLL_INTERVAL_MS);

  return () => clearInterval(interval);
}, [activeDiscoveryId, networkDiscovery?.status]);
```

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| No network settings configured | Show message to configure subnet |
| Discovery API error | Show error message, enable retry |
| Device with no hostname | Use IP as hostname |
| Device SSH untested | Show as untested availability |
| LocalStorage corrupted | Ignore stored ID, start fresh |
| Discovery times out | Show timeout message |
| Empty discovery results | Show "No devices found" message |
| Settings save fails | Show error, keep modal open |

---

## Test Scenarios

- [ ] Subnet displayed from settings
- [ ] Settings button opens modal
- [ ] Discover Now starts discovery
- [ ] Progress shown during scan
- [ ] Results rendered as UnifiedDeviceCards
- [ ] SSH success = available
- [ ] SSH failure = unavailable with reason
- [ ] ActiveDiscoveryId persisted to localStorage
- [ ] Polling occurs during running discovery
- [ ] Polling stops when complete

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0094](US0094-unified-discovery-page-shell.md) | Parent | Tab container | Done |
| [US0095](US0095-unified-device-card-component.md) | Component | UnifiedDeviceCard | Done |
| [US0098](US0098-discovery-filters-component.md) | Component | DiscoveryFilters | Done |
| [US0041](US0041-network-discovery.md) | API | Discovery endpoints | Done |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| localStorage | Browser API | Available |

---

## Estimation

**Story Points:** 3
**Complexity:** Low - Integration of existing functionality

---

## Open Questions

None - implementation complete.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Story extracted from implementation (brownfield) |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
