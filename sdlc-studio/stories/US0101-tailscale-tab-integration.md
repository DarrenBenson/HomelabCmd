# US0101: Tailscale Tab Integration

> **Status:** Done
> **Epic:** [EP0016: Unified Discovery Experience](../epics/EP0016-unified-discovery.md)
> **Owner:** Darren
> **Reviewer:** -
> **Created:** 2026-01-28
> **Story Points:** 3

## User Story

**As a** System Administrator
**I want** Tailscale discovery working in the unified page
**So that** I can see all my Tailscale devices

## Context

### Persona Reference
**System Administrator** - Discovers devices via Tailscale network for monitoring.
[Full persona details](../personas.md#system-administrator)

### Background
The Tailscale tab shows devices from the Tailscale network with SSH availability testing. It uses the new `/devices/with-ssh` endpoint to show true availability status.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | UX | Consistent device cards | Use UnifiedDeviceCard |
| Epic | Performance | Parallel SSH testing | Use with-ssh endpoint |
| TRD | Architecture | Cache indicator | Show cache status |

---

## Acceptance Criteria

### AC1: Device loading on tab activation
- **Given** the Tailscale tab is selected
- **When** it becomes active
- **Then** devices are fetched with `test_ssh=true`
- **And** loading state is shown during fetch

### AC2: SSH testing loading state
- **Given** devices are being loaded with SSH testing
- **When** the loading is in progress
- **Then** a spinner is shown
- **And** text shows "Testing SSH connectivity..."

### AC3: Results as UnifiedDeviceCards
- **Given** devices are loaded
- **When** displayed
- **Then** devices are shown as a grid of UnifiedDeviceCards
- **And** each card shows hostname, Tailscale IP, OS, availability

### AC4: Online device with SSH success
- **Given** a Tailscale device is online
- **And** SSH test succeeded
- **When** displayed
- **Then** availability is `'available'`
- **And** the device can be imported

### AC5: Offline device handling
- **Given** a Tailscale device is offline
- **When** displayed
- **Then** availability is `'unavailable'`
- **And** unavailableReason shows "Offline - last seen {relative_time}"

### AC6: Online device with SSH failure
- **Given** a Tailscale device is online
- **And** SSH test failed
- **When** displayed
- **Then** availability is `'unavailable'`
- **And** unavailableReason shows the SSH error

### AC7: Refresh button
- **Given** the Refresh button is clicked
- **When** fetching devices
- **Then** devices are fetched with `refresh=true`
- **And** both device and SSH caches are bypassed

### AC8: Cache info display
- **Given** devices are loaded
- **When** cache info is available
- **Then** either "Fresh data" or "Cached {time} ago" is shown
- **And** the time is shown in relative format

### AC9: Error handling
- **Given** the Tailscale API fails
- **When** displaying the tab
- **Then** an error message is shown
- **And** a retry option is available

### AC10: Device transformation
- **Given** a TailscaleDevice from API
- **When** transformed to UnifiedDevice
- **Then** short hostname extracted from FQDN
- **And** Tailscale-specific fields preserved

---

## Scope

### In Scope
- Tailscale tab content in DiscoveryPage
- Device fetching with SSH testing
- Loading states for SSH testing
- Device transformation to UnifiedDevice format
- Cache indicator display
- Refresh functionality
- Error handling

### Out of Scope
- Changes to Tailscale API
- SSH testing endpoint (US0096, US0097)
- Filter component (US0098)

---

## Technical Notes

### Implementation Location
`frontend/src/pages/DiscoveryPage.tsx` (Tailscale tab section)

### Device Transformation
```typescript
function tailscaleDeviceToUnified(
  device: TailscaleDevice & {
    ssh_status?: 'available' | 'unavailable' | 'untested';
    ssh_error?: string | null;
    ssh_key_used?: string | null;
  }
): UnifiedDevice {
  let availability: AvailabilityStatus = 'untested';
  let unavailableReason: string | null = null;

  if (!device.online) {
    availability = 'unavailable';
    unavailableReason = `Offline - last seen ${formatRelativeTime(device.last_seen)}`;
  } else if (device.ssh_status === 'available') {
    availability = 'available';
  } else if (device.ssh_status === 'unavailable') {
    availability = 'unavailable';
    unavailableReason = device.ssh_error || 'SSH connection failed';
  }

  // Derive short hostname from full Tailscale hostname
  const shortHostname = device.hostname.split('.')[0];

  return {
    id: device.id,
    hostname: shortHostname,
    ip: device.tailscale_ip,
    os: device.os.toLowerCase(),
    source: 'tailscale',
    availability,
    unavailableReason,
    isMonitored: device.already_imported,
    serverId: device.already_imported ? shortHostname.toLowerCase() : undefined,
    responseTimeMs: null,
    lastSeen: device.last_seen,
    sshKeyUsed: device.ssh_key_used || null,
    tailscaleDeviceId: device.id,
    tailscaleHostname: device.hostname,
    tailscaleOnline: device.online,
  };
}
```

### API Fetch Function
```typescript
const fetchTailscaleDevices = useCallback(
  async (refresh = false, testSSH = true) => {
    if (!tailscaleConfigured) return;

    setTailscaleLoading(true);
    setTailscaleError(null);

    try {
      const params: { refresh?: boolean; test_ssh?: boolean } = {};
      if (refresh) params.refresh = true;
      if (testSSH) params.test_ssh = true;

      const response = await getTailscaleDevices(params);
      setTailscaleDevices(response.devices.map(tailscaleDeviceToUnified));
      setTailscaleCacheInfo({
        cache_hit: response.cache_hit,
        cached_at: response.cached_at,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch devices';
      setTailscaleError(message);
      setTailscaleDevices([]);
    } finally {
      setTailscaleLoading(false);
    }
  },
  [tailscaleConfigured]
);
```

### Load on Tab Activation
```typescript
useEffect(() => {
  if (activeTab === 'tailscale' && tailscaleConfigured && initialLoadComplete) {
    fetchTailscaleDevices(false, true);
  }
}, [activeTab, tailscaleConfigured, initialLoadComplete, fetchTailscaleDevices]);
```

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Tailscale not configured | Tab hidden, never activated |
| API token invalid | Show 401 error, suggest reconfiguring |
| Network error | Show error message with retry |
| All devices offline | All shown as unavailable |
| Empty device list | Show "No Tailscale devices found" |
| Very long hostname FQDN | Extract first segment only |
| Device with no last_seen | Show "Unknown" for offline time |
| SSH testing takes long | Show loading indicator throughout |

---

## Test Scenarios

- [ ] Devices fetched when tab activated
- [ ] Loading spinner shown during fetch
- [ ] "Testing SSH connectivity..." shown during SSH tests
- [ ] Results rendered as UnifiedDeviceCards
- [ ] Online + SSH success = available
- [ ] Offline = unavailable with last seen
- [ ] Online + SSH fail = unavailable with error
- [ ] Refresh button bypasses cache
- [ ] Cache info displayed correctly
- [ ] Error message shown on API failure

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0094](US0094-unified-discovery-page-shell.md) | Parent | Tab container | Done |
| [US0095](US0095-unified-device-card-component.md) | Component | UnifiedDeviceCard | Done |
| [US0097](US0097-tailscale-devices-with-ssh-status.md) | API | /devices/with-ssh endpoint | Done |
| [US0098](US0098-discovery-filters-component.md) | Component | DiscoveryFilters | Done |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| Tailscale API | External service | Available |

---

## Estimation

**Story Points:** 3
**Complexity:** Low - Integration with existing API

---

## Open Questions

None - implementation complete.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Story extracted from implementation (brownfield) |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
