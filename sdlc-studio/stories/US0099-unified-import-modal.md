# US0099: Unified Import Modal

> **Status:** Done
> **Epic:** [EP0016: Unified Discovery Experience](../epics/EP0016-unified-discovery.md)
> **Owner:** Darren
> **Reviewer:** -
> **Created:** 2026-01-28
> **Story Points:** 5

## User Story

**As a** System Administrator
**I want** a consistent import experience for all discovered devices
**So that** both Network and Tailscale devices are imported the same way

## Context

### Persona Reference
**System Administrator** - Imports discovered devices to begin monitoring.
[Full persona details](../personas.md#system-administrator)

### Background
Previously, Network and Tailscale imports had separate modals with different fields. This unified modal provides a consistent experience with Display Name, TDP, Machine Type, and optional agent installation.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | UX | Consistent import flow | Same fields for both sources |
| PRD | Validation | Display name required, TDP positive | Form validation |
| TRD | API | Existing import endpoints | Use Tailscale and server APIs |

---

## Acceptance Criteria

### AC1: Modal fields
- **Given** Import is clicked on any device
- **When** the modal opens
- **Then** it shows:
  - Display Name (editable text input, pre-filled from hostname)
  - Machine Type (dropdown: Server/Workstation)
  - TDP watts (optional number input)
  - Hostname (read-only, shows device source info)

### AC2: Pre-filled hostname
- **Given** the modal opens for a device
- **When** the form loads
- **Then** the Display Name is pre-filled with capitalised hostname
- **And** the hostname is shown read-only with source info

### AC3: Source info display
- **Given** a Network device
- **When** modal displays source info
- **Then** it shows IP address with Wifi icon

- **Given** a Tailscale device
- **When** modal displays source info
- **Then** it shows Tailscale IP with Globe icon

### AC4: Install Agent checkbox (SSH configured)
- **Given** SSH keys are configured
- **And** device is available
- **When** the modal opens
- **Then** "Install Agent" checkbox is shown and checked by default
- **And** SSH Key selector dropdown is visible

### AC5: Install Agent checkbox (no SSH)
- **Given** no SSH keys are configured
- **When** the modal opens
- **Then** "Install Agent" checkbox is hidden or shows message about configuring SSH

### AC6: Import with agent installation
- **Given** "Install Agent" checkbox is checked
- **When** Import is clicked
- **Then** device is imported first
- **And** then agent installation is triggered
- **And** progress shows "Importing..." then "Installing agent..."

### AC7: Import without agent installation
- **Given** "Install Agent" checkbox is unchecked
- **When** Import is clicked
- **Then** device is imported only
- **And** modal shows success message

### AC8: Network device import
- **Given** a Network device
- **When** imported
- **Then** uses existing server creation endpoint
- **And** sets connection info from IP

### AC9: Tailscale device import
- **Given** a Tailscale device
- **When** imported
- **Then** uses Tailscale import endpoint
- **And** passes `tailscale_hostname` and `tailscale_device_id`

### AC10: Duplicate device warning
- **Given** a device that is already imported
- **When** Import modal opens (Tailscale)
- **Then** a warning is shown
- **And** link to existing server is provided

### AC11: Validation
- **Given** form fields
- **When** validation runs
- **Then** Display Name is required (non-empty)
- **And** Display Name max 100 characters
- **And** TDP must be positive if provided
- **And** TDP must be a valid number if provided

### AC12: Partial success handling
- **Given** import succeeds but agent installation fails
- **When** the result is shown
- **Then** status is "partial_success"
- **And** message shows "Imported {name} but agent installation failed"
- **And** Retry button is available for agent install

---

## Scope

### In Scope
- `UnifiedImportModal.tsx` component
- Form fields: Display Name, Machine Type, TDP
- Install Agent option with key selector
- Tailscale duplicate check
- Progress phases: importing -> installing -> success
- Partial success handling with retry

### Out of Scope
- Server creation API changes
- Agent installation API changes

---

## Technical Notes

### Implementation File
`frontend/src/components/UnifiedImportModal.tsx`

### Component Interface
```typescript
interface UnifiedImportModalProps {
  isOpen: boolean;
  device: UnifiedDevice;
  sshKeys: SSHKeyMetadata[];
  onClose: () => void;
  onSuccess: () => void;
}
```

### Import Phases
```typescript
type ImportPhase = 'idle' | 'importing' | 'installing' | 'success' | 'partial_success';
```

### Form State
```typescript
const [displayName, setDisplayName] = useState(device.hostname);
const [machineType, setMachineType] = useState<'server' | 'workstation'>('server');
const [tdp, setTdp] = useState<string>('');
const [installAgentChecked, setInstallAgentChecked] = useState(false);
const [selectedKeyId, setSelectedKeyId] = useState<string>('');
```

### API Calls
```typescript
// Tailscale import
await importTailscaleDevice({
  tailscale_device_id: device.tailscaleDeviceId!,
  tailscale_hostname: device.tailscaleHostname!,
  tailscale_ip: device.ip,
  os: device.os,
  display_name: displayName,
  machine_type: machineType,
  tdp: tdp ? Number(tdp) : null,
});

// Agent installation
await installAgent({
  hostname: isTailscale ? device.tailscaleHostname : device.ip,
  server_id: machine.server_id,
  display_name: machine.display_name,
});
```

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Empty display name | Validation error: "Display name is required" |
| Display name > 100 chars | Validation error: "Display name must be 100 characters or less" |
| TDP = 0 | Validation error: "TDP must be a positive number" |
| TDP negative | Validation error: "TDP must be a positive number" |
| TDP non-numeric | Validation error: "TDP must be a number" |
| Import API error | Show error message, allow retry |
| Agent install fails | Partial success, offer retry |
| Network error during import | Show error, keep modal open |
| Device already imported (Tailscale) | Show warning with link to server |
| Modal closed during import | Cancel any pending requests |

---

## Test Scenarios

- [ ] Modal shows all required fields
- [ ] Display name pre-filled from hostname
- [ ] Machine type defaults to Server
- [ ] TDP is optional
- [ ] Install Agent checkbox visible when SSH configured
- [ ] Install Agent triggers agent installation
- [ ] Tailscale import uses correct endpoint
- [ ] Network import uses correct endpoint
- [ ] Validation prevents empty display name
- [ ] Validation prevents invalid TDP
- [ ] Duplicate warning shows for imported devices
- [ ] Partial success shows retry option

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0095](US0095-unified-device-card-component.md) | Type | UnifiedDevice interface | Done |
| [US0078](US0078-tailscale-machine-registration.md) | API | Tailscale import endpoint | Done |
| [US0082](US0082-tailscale-import-with-agent-install.md) | API | Agent installation endpoint | Done |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| React state management | React hooks | Available |

---

## Estimation

**Story Points:** 5
**Complexity:** Medium - Multi-phase workflow, validation

---

## Open Questions

None - implementation complete.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Story extracted from implementation (brownfield) |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
