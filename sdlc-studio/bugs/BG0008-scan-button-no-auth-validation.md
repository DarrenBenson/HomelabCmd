# BG0008: Scan Button Available on Devices Without Valid SSH Credentials

> **Status:** Closed
> **Severity:** Medium
> **Priority:** P2
> **Reporter:** User
> **Assignee:** Claude
> **Created:** 2026-01-21
> **Updated:** 2026-01-21

## Summary

When clicking "Scan" on a discovered device, users receive the error "All keys rejected. Last error: Authentication failed: Authentication failed." if the configured SSH credentials don't work for that device. The scan button should only be enabled for devices where authentication is possible, or the UI should pre-validate credentials before allowing the scan to be initiated.

## Affected Area

- **Epic:** [EP0006: Ad-hoc Scanning](../epics/EP0006-adhoc-scanning.md)
- **Story:** [US0041: Network Discovery](../stories/US0041-network-discovery.md)
- **Story:** [US0038: Scan Initiation](../stories/US0038-scan-initiation.md)
- **Component:** Frontend - NetworkDiscovery, Backend - SSH/Scan services

## Environment

- **Version:** 1.0.0
- **Platform:** All
- **Browser:** All browsers

## Reproduction Steps

1. Navigate to Scans page
2. Run Network Discovery
3. Discover a device that does not have the configured SSH key authorised
4. Click "Scan" button on that device
5. Observe error: "All keys rejected. Last error: Authentication failed: Authentication failed."

## Expected Behaviour

One or more of the following should occur:

**Option A: Pre-flight SSH validation during discovery**
During network discovery, test SSH connectivity and only show "Scan" button for devices that can be authenticated.

**Option B: Visual indicator for auth status**
Show devices with different indicators:
- Authenticated (green) - Scan button enabled
- Unknown/untested (amber) - Scan button with warning
- Authentication failed (red) - Scan button disabled with tooltip

**Option C: Better error handling**
If scan fails due to authentication, show a clear error message suggesting:
- Check SSH key is authorised on target device
- Configure credentials for this device
- Add to SSH config

## Actual Behaviour

All discovered devices with SSH port open show "Scan" button regardless of whether authentication will succeed. Users only find out authentication fails after clicking scan and waiting for the error.

## Screenshots/Evidence

Error message received:
```
All keys rejected. Last error: Authentication failed: Authentication failed.
```

Current code in `NetworkDiscovery.tsx` (lines 305-311):
```tsx
<button
  onClick={() => onSelectDevice(device.ip)}
  className="px-3 py-1 text-sm font-medium text-status-info hover:bg-status-info/10 rounded-md transition-colors"
  data-testid={`scan-button-${device.ip}`}
>
  Scan
</button>
```

The button is shown for any non-monitored device without checking if credentials are valid.

## Root Cause Analysis

The network discovery feature only checks if port 22 (SSH) is open on discovered devices. It does not verify whether the configured SSH credentials (key or password) will successfully authenticate to the device. This results in a confusing user experience where the scan appears to be possible but fails at runtime.

## Fix Description

### Solution Chosen

**Option A: SSH auth test during discovery** - Tests SSH authentication for each discovered non-monitored device during the discovery process.

### Changes Made

**Backend:**

1. **Updated `DiscoveredDevice` dataclass** in `services/discovery.py`
   - Added `ssh_auth_status: str` field ('untested', 'success', 'failed')
   - Added `ssh_auth_error: str | None` field

2. **Updated `DiscoveryDevice` schema** in `api/schemas/discovery.py`
   - Added `ssh_auth_status` and `ssh_auth_error` fields to API response

3. **Implemented SSH auth testing** in `services/discovery.py`
   - Added `test_ssh_auth()` method using existing SSH service
   - Called during `discover_subnet()` for non-monitored devices
   - Monitored devices are assumed to have valid credentials (status='success')
   - Results stored in discovery response

**Frontend:**

4. **Updated `DiscoveryDevice` type** in `types/discovery.ts`
   - Added `SSHAuthStatus` type ('untested' | 'success' | 'failed')
   - Added `ssh_auth_status` and `ssh_auth_error` fields

5. **Updated `NetworkDiscovery.tsx`**
   - Added `ShieldX` icon from lucide-react
   - Conditional rendering based on auth status:
     - `success` or `untested`: Show "Scan" button
     - `failed`: Show "Auth Failed" with tooltip explaining the error

### Display Logic

```tsx
{device.is_monitored ? (
  <span>Monitored</span>
) : device.ssh_auth_status === 'failed' ? (
  <span title={device.ssh_auth_error}>
    <ShieldX /> Auth Failed
  </span>
) : (
  <button onClick={() => onSelectDevice(device.ip)}>Scan</button>
)}
```

### Files Modified

| File | Change |
|------|--------|
| `backend/src/homelab_cmd/services/discovery.py` | Added SSH auth testing, new dataclass fields |
| `backend/src/homelab_cmd/api/schemas/discovery.py` | Added auth status fields to schema |
| `frontend/src/types/discovery.ts` | Added SSHAuthStatus type and fields |
| `frontend/src/components/NetworkDiscovery.tsx` | Conditional Scan button rendering |

### Tests

- Frontend: 875 tests passing
- No backend unit tests existed for discovery service

---

### Proposed Options (Original)

**Option A: SSH auth test during discovery (Recommended)**

Add an `auth_status` field to discovered devices:

```python
# Backend - during discovery
class DiscoveryDevice:
    ip: str
    hostname: str | None
    is_monitored: bool
    ssh_auth_status: Literal['untested', 'success', 'failed']
    ssh_auth_error: str | None  # e.g., "Key rejected"
```

```tsx
// Frontend - conditional rendering
{device.ssh_auth_status === 'success' ? (
  <button onClick={() => onSelectDevice(device.ip)}>Scan</button>
) : device.ssh_auth_status === 'failed' ? (
  <span className="text-status-error" title={device.ssh_auth_error}>
    Auth Failed
  </span>
) : (
  <button onClick={() => onSelectDevice(device.ip)}>Scan (Untested)</button>
)}
```

**Option B: Quick auth check on scan click**

Before initiating scan, perform a quick SSH auth test:

```tsx
async function handleScanClick(ip: string) {
  const authResult = await testSshAuth(ip);
  if (!authResult.success) {
    showError(`Cannot scan ${ip}: ${authResult.error}`);
    return;
  }
  onSelectDevice(ip);
}
```

**Option C: Discovery settings for auth testing**

Add a toggle in discovery settings: "Test SSH authentication during discovery" (slower but more accurate).

### Files to Modify

| File | Change |
|------|--------|
| `backend/src/homelab_cmd/services/discovery.py` | Add SSH auth testing during discovery |
| `backend/src/homelab_cmd/api/schemas/discovery.py` | Add auth_status field to response |
| `frontend/src/types/discovery.ts` | Add auth_status to DiscoveryDevice type |
| `frontend/src/components/NetworkDiscovery.tsx` | Conditional Scan button based on auth status |

### Tests Added

| Test ID | Description | File |
|---------|-------------|------|
| - | Discovery returns auth status for devices | test_discovery_service.py |
| - | Scan button disabled when auth fails | NetworkDiscovery.test.tsx |
| - | Auth failed shows error tooltip | NetworkDiscovery.test.tsx |

## Verification

- [x] Discovery tests SSH auth for each device
  - Discovery 6: 19 devices found, 8 success, 11 failed
  - Uses database SSH config (username/port) instead of hardcoded defaults
- [x] Devices with failed auth show appropriate indicator
  - `ShieldX` icon with "Auth Failed" text in red
  - Tooltip shows error message on hover
- [x] Scan button behaviour matches auth status
  - `success` or `untested`: Shows "Scan" button
  - `failed`: Shows "Auth Failed" indicator (no button)
- [x] Users cannot initiate scans that will definitely fail
  - Failed auth devices have no clickable scan button
- [x] Performance acceptable (discovery may be slower)
  - 25.5 seconds for 19 devices (1.34s per device)
  - SSH auth testing runs concurrently with discovery
- [x] No regression in existing functionality
  - 875 frontend tests passing

**Verified by:** Claude
**Verification date:** 2026-01-21

## Related Items

| Type | ID | Description |
|------|-----|-------------|
| Story | US0041 | Network Discovery |
| Story | US0038 | Scan Initiation |
| Epic | EP0006 | Ad-hoc Scanning |

## Notes

### UX Considerations

- Testing SSH auth adds time to discovery - consider making it optional
- Could cache auth results to avoid retesting on each discovery
- Failed auth could suggest: "Add this device's public key to authorise scanning"

### Security Note

Auth testing should use the same credentials as scanning - don't expose different auth vectors.

### Performance Impact

Testing SSH auth on each discovered device will slow down discovery. Consider:
1. Parallel auth testing (with rate limiting)
2. Optional setting to enable/disable auth testing
3. Background auth testing after discovery completes

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-21 | User | Bug reported |
| 2026-01-21 | Claude | Status → In Progress |
| 2026-01-21 | Claude | Fix implemented: SSH auth testing during discovery |
| 2026-01-21 | Claude | Status → Fixed, 875 frontend tests passing |
| 2026-01-21 | Claude | Fixed SSH username bug: discovery now uses DB config instead of hardcoded default |
| 2026-01-21 | Claude | Status → Verified, all 6 verification criteria passed |
