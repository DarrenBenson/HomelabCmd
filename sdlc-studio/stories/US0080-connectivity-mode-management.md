# US0080: Connectivity Mode Management

> **Status:** Done
> **Epic:** [EP0008: Tailscale Integration](../epics/EP0008-tailscale-integration.md)
> **Owner:** Darren
> **Created:** 2026-01-26
> **Story Points:** 5

## User Story

**As a** Darren (Homelab Operator)
**I want** to choose between Tailscale and Direct SSH connectivity modes
**So that** I can use HomelabCmd even without Tailscale installed

## Context

### Persona Reference

**Darren** - Technical professional running a homelab. While most infrastructure uses Tailscale, some scenarios may require direct SSH (e.g., testing, fallback, or non-Tailscale networks). Wants flexibility in connectivity while maintaining a consistent experience.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

HomelabCmd v2.0 introduces Tailscale as the primary connectivity method, but users should be able to fall back to Direct SSH mode when needed. This story provides the settings UI and API for managing connectivity modes, allowing users to switch between Tailscale-native discovery and traditional network scanning with direct IP connections.

## Inherited Constraints

Constraints inherited from parent Epic that apply to this Story.

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| UX | Mode displayed on dashboard | Status bar shows current mode |
| UX | Test connection button | Both modes need testable |
| Data | Mode persisted to database | Survives restart |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| UX | Minimal maintenance | Auto-detect mode when possible |
| Security | Credentials encrypted | Token and key via US0081 |
| Self-contained | No external dependencies except Tailscale | Direct SSH mode works offline |

> **Validation:** Each inherited constraint MUST be addressed in either AC, Edge Cases, or Technical Notes.

## Acceptance Criteria

### AC1: Connectivity settings page

- **Given** I navigate to Settings > Connectivity
- **When** the page loads
- **Then** I see two mode options:
  - "Tailscale Mode" - for Tailscale API discovery and mesh connectivity
  - "Direct SSH Mode" - for manual IP configuration and network scanning
- **And** the current mode is highlighted
- **And** each mode shows its requirements and benefits

### AC2: Tailscale Mode configuration

- **Given** I select "Tailscale Mode"
- **When** I configure the mode
- **Then** I can enter a Tailscale API token (handled by US0076)
- **And** the mode is enabled only when a valid token is saved
- **And** success shows: "✓ Connected to tailnet: {name}" and "✓ {count} devices"

### AC3: Direct SSH Mode configuration

- **Given** I select "Direct SSH Mode"
- **When** I configure the mode
- **Then** Tailscale API token is not required
- **And** device discovery falls back to mDNS and network scanning
- **And** machines must be added manually or via network discovery (existing v1.0 flow)

### AC4: Mode auto-detection

- **Given** the application starts
- **When** checking connectivity configuration
- **Then** mode is auto-detected:
  - If `tailscale_token` credential exists and valid → Tailscale Mode
  - Otherwise → Direct SSH Mode
- **And** the detected mode is displayed on the dashboard status bar

### AC5: Dashboard status bar shows mode

- **Given** I am on the dashboard
- **When** viewing the status bar
- **Then** the current connectivity mode is displayed:
  - Tailscale Mode: "🔗 Tailscale ({device_count} devices)"
  - Direct SSH Mode: "🔗 Direct SSH"
- **And** clicking the status opens Settings > Connectivity

### AC6: SSH configuration shared between modes

- **Given** either connectivity mode is selected
- **When** configuring SSH settings
- **Then** both modes share:
  - Default SSH username (default: `homelabcmd`)
  - SSH private key (uploaded, encrypted)
- **And** SSH configuration is independent of connectivity mode

## Scope

### In Scope

- Connectivity settings page with mode selection
- Mode persistence to database
- Mode auto-detection logic
- Dashboard status bar connectivity indicator
- Shared SSH configuration section
- Test connection buttons for both modes

### Out of Scope

- Hybrid mode (using both simultaneously)
- Per-machine mode override
- Automatic mode switching based on network
- VPN detection or integration

## UI/UX Requirements

**Settings > Connectivity Page:**

```
┌────────────────────────────────────────────────────────┐
│ Settings > Connectivity                                 │
├────────────────────────────────────────────────────────┤
│                                                        │
│ Connectivity Mode                                      │
│ ─────────────────────────────────────────────────────  │
│                                                        │
│ ┌────────────────────────────────────────────────────┐ │
│ │ ● Tailscale Mode                          (Active) │ │
│ │                                                    │ │
│ │   Use Tailscale mesh network for connectivity.     │ │
│ │   Requires Tailscale API token.                    │ │
│ │                                                    │ │
│ │   Tailscale API Token:                             │ │
│ │   ┌────────────────────────────────┐               │ │
│ │   │ sk-tail-*********************  │ [Test]        │ │
│ │   └────────────────────────────────┘               │ │
│ │   ✓ Connected to tailnet: darren-homelab          │ │
│ │   ✓ 11 devices discovered                          │ │
│ │                                                    │ │
│ │   [Save Token]  [Remove Token]                     │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ ┌────────────────────────────────────────────────────┐ │
│ │ ○ Direct SSH Mode                                  │ │
│ │                                                    │ │
│ │   Connect directly via IP address.                 │ │
│ │   Use network discovery or manual configuration.   │ │
│ │   No Tailscale API token required.                 │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ SSH Configuration (Both Modes)                         │
│ ─────────────────────────────────────────────────────  │
│                                                        │
│ Default Username:                                      │
│ ┌──────────────────────────────────────────────────┐   │
│ │ homelabcmd                                       │   │
│ └──────────────────────────────────────────────────┘   │
│                                                        │
│ Private Key:                                           │
│ ┌──────────────────────────────────────────────────┐   │
│ │ ✓ Key uploaded and encrypted                     │   │
│ │   Uploaded: 2026-01-25                           │   │
│ └──────────────────────────────────────────────────┘   │
│ [Upload New Key]  [Remove Key]                         │
│                                                        │
│                           [Save Settings]              │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**Dashboard Status Bar:**

```
┌────────────────────────────────────────────────────────┐
│ HomelabCmd    🔗 Tailscale (11 devices)    ⚙️ Settings │
└────────────────────────────────────────────────────────┘
```

Or in Direct SSH mode:

```
┌────────────────────────────────────────────────────────┐
│ HomelabCmd    🔗 Direct SSH                ⚙️ Settings │
└────────────────────────────────────────────────────────┘
```

## Technical Notes

### API Contracts

**GET /api/v1/settings/connectivity**

Response 200:
```json
{
  "mode": "tailscale",
  "mode_auto_detected": false,
  "tailscale": {
    "configured": true,
    "connected": true,
    "tailnet": "darren-homelab.github",
    "device_count": 11
  },
  "ssh": {
    "username": "homelabcmd",
    "key_configured": true,
    "key_uploaded_at": "2026-01-25T15:00:00Z"
  }
}
```

**PUT /api/v1/settings/connectivity**

Request:
```json
{
  "mode": "tailscale",
  "ssh_username": "homelabcmd"
}
```

Response 200:
```json
{
  "success": true,
  "mode": "tailscale",
  "message": "Connectivity settings saved"
}
```

Response 400 (invalid mode):
```json
{
  "detail": {
    "code": "INVALID_MODE",
    "message": "Mode must be 'tailscale' or 'direct_ssh'"
  }
}
```

Response 400 (Tailscale mode without token):
```json
{
  "detail": {
    "code": "TAILSCALE_TOKEN_REQUIRED",
    "message": "Tailscale mode requires a valid API token. Configure token first."
  }
}
```

**GET /api/v1/settings/connectivity/status**

Response 200 (for dashboard status bar):
```json
{
  "mode": "tailscale",
  "display": "Tailscale (11 devices)",
  "healthy": true
}
```

### Data Requirements

**Config table entries:**

```sql
INSERT INTO config (key, value) VALUES
  ('connectivity_mode', 'tailscale'),  -- or 'direct_ssh'
  ('ssh_username', 'homelabcmd');
```

Mode auto-detection logic:

```python
async def detect_connectivity_mode() -> str:
    """Auto-detect connectivity mode based on configuration."""
    # Check if Tailscale token exists
    token = await credential_service.get_credential('tailscale_token')
    if token:
        # Validate token is still valid
        try:
            await tailscale_client.test_connection()
            return 'tailscale'
        except TailscaleAuthError:
            # Token invalid, fall back
            pass
    return 'direct_ssh'
```

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Switch to Tailscale without token | Return 400: "Tailscale mode requires a valid API token" |
| Tailscale token expires while in Tailscale mode | Auto-detect falls back to Direct SSH, show warning |
| Invalid mode value in request | Return 400: "Mode must be 'tailscale' or 'direct_ssh'" |
| SSH username empty | Return 400: "SSH username cannot be empty" |
| SSH username with invalid characters | Return 400: "SSH username contains invalid characters" |
| Mode changed while connections active | Close existing connection pool |
| Dashboard status when API unreachable | Show "🔗 Tailscale (offline)" with warning colour |
| First startup with no configuration | Default to Direct SSH mode |

## Test Scenarios

- [ ] Connectivity settings page loads with current mode
- [ ] Tailscale mode option shows token configuration
- [ ] Direct SSH mode option shows manual setup info
- [ ] Mode auto-detected from Tailscale token presence
- [ ] Mode auto-detection falls back when token invalid
- [ ] Dashboard status bar shows current mode
- [ ] Status bar shows device count in Tailscale mode
- [ ] Clicking status bar opens Settings > Connectivity
- [ ] Save settings persists mode to database
- [ ] Cannot switch to Tailscale mode without valid token
- [ ] SSH username shared between modes
- [ ] Invalid mode value rejected with 400

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0080-01 | Settings page shows modes | AC1 | E2E | Pending |
| TC-US0080-02 | Tailscale mode requires token | AC2 | Unit | Pending |
| TC-US0080-03 | Direct SSH mode no token | AC3 | Unit | Pending |
| TC-US0080-04 | Mode auto-detected | AC4 | Integration | Pending |
| TC-US0080-05 | Auto-detect fallback | AC4 | Unit | Pending |
| TC-US0080-06 | Dashboard shows mode | AC5 | E2E | Pending |
| TC-US0080-07 | Dashboard link to settings | AC5 | E2E | Pending |
| TC-US0080-08 | SSH config shared | AC6 | Unit | Pending |
| TC-US0080-09 | Invalid mode rejected | AC1 | Unit | Pending |
| TC-US0080-10 | Mode persisted | AC1 | Integration | Pending |

## Dependencies

### Story Dependencies

| Story | Dependency Type | What's Needed | Status |
|-------|-----------------|---------------|--------|
| [US0076](US0076-tailscale-api-client.md) | Service | Tailscale token management | Done |
| [US0079](US0079-ssh-connection-tailscale.md) | Service | SSH key configuration | Done |
| [US0081](US0081-credential-encryption-storage.md) | Service | Credential storage | Done |

### Schema Dependencies

| Schema | Source Story | Fields Needed |
|--------|--------------|---------------|
| credentials | [US0081](US0081-credential-encryption-storage.md) | tailscale_token, ssh_private_key |
| config | Existing | connectivity_mode, ssh_username |

### API Dependencies

| Endpoint | Source Story | How Used |
|----------|--------------|----------|
| POST /api/v1/settings/tailscale/test | [US0076](US0076-tailscale-api-client.md) | Validate Tailscale token |
| Credential service | [US0081](US0081-credential-encryption-storage.md) | Check token existence |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| None | - | - |

> **Note:** All story dependencies are complete:
> - US0076: Tailscale API Client Integration (Done)
> - US0079: SSH Connection via Tailscale (Done)
> - US0081: Credential Encryption and Storage (Done)

## Estimation

**Story Points:** 5

**Complexity:** Medium - Settings UI with mode switching and status display

## Open Questions

None.

## Quality Checklist

### API Stories (minimum requirements)

- [x] Edge cases: 8/8 minimum documented
- [x] Test scenarios: 12/10 minimum listed
- [x] API contracts: Exact request/response JSON shapes documented
- [x] Error codes: All error codes with exact messages specified

### All Stories

- [x] No ambiguous language (avoid: "handles errors", "returns data", "works correctly")
- [x] Open Questions: 0/0 resolved (critical must be resolved)
- [x] Given/When/Then uses concrete values, not placeholders
- [x] Persona referenced with specific context

### Ready Status Gate

This story can be marked **Ready** when:
- [x] All critical Open Questions resolved
- [x] Minimum edge case count met (API stories)
- [x] No "TBD" placeholders in acceptance criteria
- [x] Error scenarios documented (not just happy path)

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-26 | Claude | Initial story creation from EP0008 |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
