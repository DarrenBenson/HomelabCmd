# US0196: Smart Import Path Selection

> **Status:** Done
> **Epic:** [EP0019: Unified Device Discovery](../epics/EP0019-unified-device-discovery.md)
> **Owner:** Darren
> **Created:** 2026-01-31
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** the import modal to show both connection paths for merged devices
**So that** I can choose the best way to connect to the server

## Context

### Persona Reference

**Darren** - Technical professional managing a homelab. Needs control over how servers are connected while benefiting from smart defaults.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

When importing a device discovered via both methods, the user should see both connection options. The system recommends the best path based on availability and network topology, but allows the user to override.

---

## Acceptance Criteria

### AC1: Import modal shows both connection paths

- **Given** I click Import on a device with [N+T] badge
- **When** the import modal opens
- **Then** I see both connection options:
  - Direct SSH (192.168.1.10)
  - Tailscale (100.64.0.15)
- **And** one is marked as "Recommended"

### AC2: Auto-select recommended path

- **Given** the import modal opens for a merged device
- **When** the modal renders
- **Then** the recommended path is pre-selected
- **And** I see a brief explanation (e.g., "Tailscale recommended - accessible remotely")

### AC3: User can override path selection

- **Given** I am in the import modal with a path selected
- **When** I click the other path option
- **Then** my selection is used for import
- **And** the "Recommended" label stays on the original option

### AC4: Single-source devices use that path

- **Given** I click Import on a device with only [N] or [T] badge
- **When** the import modal opens
- **Then** only one path is shown (no selection needed)
- **And** import proceeds with available path

### AC5: Connection test before import

- **Given** I have selected a connection path
- **When** I click "Test Connection"
- **Then** the system tests SSH connectivity via selected path
- **And** shows success/failure result

---

## Scope

### In Scope

- Path selection UI in UnifiedImportModal
- Recommendation logic and explanation text
- User override capability
- Connection test for selected path
- Single-path fallback for non-merged devices

### Out of Scope

- Automatic failover between paths
- Latency comparison
- Path preference persistence across imports

---

## Technical Notes

### Path Recommendation Logic

```typescript
interface PathOption {
  type: 'network' | 'tailscale';
  address: string;
  recommended: boolean;
  reason: string;
}

function getPathOptions(device: MergedDevice): PathOption[] {
  const options: PathOption[] = [];

  if (device.networkDevice?.ip) {
    options.push({
      type: 'network',
      address: device.networkDevice.ip,
      recommended: false,
      reason: 'Direct connection - local network only',
    });
  }

  if (device.tailscaleDevice?.addresses?.[0]) {
    options.push({
      type: 'tailscale',
      address: device.tailscaleDevice.addresses[0],
      recommended: true,
      reason: 'Tailscale - accessible remotely',
    });
  }

  // Adjust recommendation based on context
  if (options.length === 2) {
    // Prefer Tailscale for remote access
    options[1].recommended = true;
    options[0].recommended = false;
  }

  return options;
}
```

### Modal UI Structure

```
+------------------------------------------+
|  Import Device: proxmox-server           |
+------------------------------------------+
|                                          |
|  Connection Path:                        |
|                                          |
|  ( ) Direct SSH: 192.168.1.10            |
|      Local network only                  |
|                                          |
|  (•) Tailscale: 100.64.0.15  [Recommended]|
|      Accessible remotely                 |
|                                          |
|  [Test Connection]                       |
|                                          |
|  Server Name: [proxmox-server    ]       |
|  SSH Username: [darren           ]       |
|  SSH Key: [homelab-key v]                |
|                                          |
|         [Cancel]     [Import]            |
+------------------------------------------+
```

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/components/UnifiedImportModal.tsx` | Modify | Path selection UI |

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | Connection test fails | Show error, allow retry or switch path |
| 2 | Both paths fail | Show error, suggest checking SSH config |
| 3 | Tailscale offline during import | Warn but allow selection |
| 4 | Network path unreachable | Warn, auto-suggest Tailscale |
| 5 | User selects then closes modal | Selection not persisted |

---

## Test Scenarios

- [ ] Modal shows both paths for merged devices
- [ ] Recommended path is pre-selected
- [ ] Reason text explains recommendation
- [ ] User can select alternate path
- [ ] "Recommended" label stays on original
- [ ] Single-source devices show one path
- [ ] Connection test success displays correctly
- [ ] Connection test failure displays correctly
- [ ] Import uses selected path

---

## Dependencies

### Story Dependencies

| Story | Relationship | Status |
|-------|--------------|--------|
| US0193 | Provides MergedDevice type | Planned |

---

## Estimation

**Story Points:** 3
**Complexity:** Low-Medium - modal enhancement, selection logic

---

## Open Questions

None.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-31 | Claude | Initial story creation from plan |
