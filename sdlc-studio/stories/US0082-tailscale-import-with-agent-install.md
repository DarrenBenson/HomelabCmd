# US0082: Tailscale Import with Agent Installation

> **Status:** Done
> **Epic:** [EP0008: Tailscale Integration](../epics/EP0008-tailscale-integration.md)
> **Owner:** Darren
> **Created:** 2026-01-27
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** to automatically install the monitoring agent when importing a Tailscale device
**So that** the server starts reporting metrics immediately without a separate installation step

## Context

### Persona Reference

**Darren** - Technical professional running a homelab with 11+ servers on Tailscale. Expects a streamlined one-click workflow to import devices and have them fully monitored.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Currently, importing a Tailscale device (US0078) only creates a Server record. The user must then separately navigate to the server detail page and click "Install Agent" to deploy the monitoring agent. This two-step process is unintuitive - users expect an imported server to be fully functional immediately.

This story enhances the import flow to optionally install the agent automatically after creating the server record, using the Tailscale hostname for SSH connectivity.

### Dependencies

- US0078: Machine Registration via Tailscale (provides import modal)
- US0079: SSH Connection via Tailscale (provides SSH connectivity)
- US0080: Connectivity Mode Management (SSH key configuration)

## Inherited Constraints

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Connectivity | Tailscale hostname for SSH | Use tailscale_hostname as SSH target |
| Security | SSH key required | Only enable option when SSH configured |
| UX | Minimal user input | Single checkbox to opt-in |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Performance | Agent install < 60s typical | Show progress indicator |
| Reliability | Handle SSH failures gracefully | Clear error messages, allow retry |
| UX | Minimal maintenance | Default to install if SSH ready |

## Acceptance Criteria

### AC1: Install Agent checkbox in import modal

- **Given** I am on the Tailscale Device Discovery page
- **When** I click "Import" on a device
- **Then** the import modal shows a checkbox: "Install monitoring agent after import"
- **And** the checkbox is enabled only if SSH key is configured
- **And** if SSH is not configured, tooltip shows "Configure SSH key in Settings to enable"

### AC2: Checkbox defaults based on SSH configuration

- **Given** the import modal is open
- **When** SSH key is configured in Settings > Connectivity
- **Then** the "Install agent" checkbox is checked by default
- **When** SSH key is NOT configured
- **Then** the checkbox is unchecked and disabled

### AC3: Import with agent installation

- **Given** I have checked "Install monitoring agent after import"
- **When** I click "Import Machine"
- **Then** the server record is created first
- **And** a progress indicator shows "Installing agent..."
- **And** the agent is deployed via SSH to the Tailscale hostname
- **And** on success, message shows "Imported and installed agent on {display_name}"
- **And** the server appears on dashboard with status updating to "online" after first heartbeat

### AC4: Import without agent installation

- **Given** I have unchecked "Install monitoring agent after import"
- **When** I click "Import Machine"
- **Then** only the server record is created (existing behaviour)
- **And** message shows "Imported {display_name} successfully"
- **And** server detail page shows "Install Agent" button

### AC5: Handle agent installation failure

- **Given** agent installation fails (SSH timeout, connection refused, etc.)
- **When** the error occurs
- **Then** the server record is still created (import succeeded)
- **And** error message shows "Imported {display_name} but agent installation failed: {reason}"
- **And** a "Retry Install" button is shown
- **And** user can manually install later from server detail page

### AC6: Progress feedback during installation

- **Given** agent installation is in progress
- **When** the modal is open
- **Then** the modal shows:
  - Spinner with "Installing agent on {hostname}..."
  - Cancel button is disabled during installation
  - Close button (X) shows confirmation if clicked

## Edge Cases

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | SSH key deleted during import | Fail gracefully, server still created |
| 2 | Device goes offline during install | Timeout after 60s, show retry option |
| 3 | Agent already installed on device | Agent install is idempotent, succeeds |
| 4 | Network partition during install | Timeout, clear error message |
| 5 | Import cancelled during agent install | Server created, agent install cancelled |

## Scope

### In Scope

- Checkbox UI in import modal
- SSH configuration status check
- Sequential flow: create server -> install agent
- Progress indicator during installation
- Error handling with retry option
- Default checkbox state based on SSH readiness

### Out of Scope

- Parallel import of multiple devices (future enhancement)
- Automatic retry on transient failures
- Service discovery during import (use default services)
- Custom SSH username per import (use global setting)

## Technical Notes

### Implementation Approach

1. **Frontend (ImportDeviceModal.tsx)**:
   - Add checkbox with SSH status check via `/api/v1/settings/ssh/status`
   - After successful import, if checkbox checked, call agent install API
   - Show progress state during installation

2. **Backend**:
   - No new endpoints needed
   - Use existing `POST /api/v1/tailscale/import` for server creation
   - Use existing `POST /api/v1/agents/install` for agent deployment
   - Agent install API already accepts hostname (use tailscale_hostname)

3. **Flow**:
   ```
   User clicks Import
         |
         v
   Create Server Record (POST /api/v1/tailscale/import)
         |
         v
   [If checkbox checked]
         |
         v
   Install Agent (POST /api/v1/agents/install)
         |
         v
   Show combined result
   ```

### API Contracts

Uses existing endpoints:
- `GET /api/v1/settings/ssh/status` - Check if SSH key configured
- `POST /api/v1/tailscale/import` - Create server record
- `POST /api/v1/agents/install` - Deploy agent via SSH

### Testing Strategy

| Test Type | Coverage |
|-----------|----------|
| Unit | Checkbox enable/disable based on SSH status |
| Unit | Default checkbox state logic |
| Integration | Full import + install flow |
| E2E | Import device with agent install enabled |
| E2E | Import device with agent install disabled |
| E2E | Handle install failure gracefully |

## Definition of Done

- [x] Checkbox appears in import modal
- [x] Checkbox disabled when SSH not configured
- [x] Checkbox defaults to checked when SSH ready
- [x] Agent installs successfully after import
- [x] Errors handled gracefully with retry option
- [x] Progress indicator during installation
- [x] Unit tests for checkbox logic
- [x] E2E test for full flow
- [x] Documentation updated

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-27 | Claude | Initial story creation |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
