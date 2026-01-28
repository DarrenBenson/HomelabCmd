# US0078: Machine Registration via Tailscale

> **Status:** Done
> **Epic:** [EP0008: Tailscale Integration](../epics/EP0008-tailscale-integration.md)
> **Owner:** Darren
> **Created:** 2026-01-26
> **Story Points:** 5

## User Story

**As a** Darren (Homelab Operator)
**I want** to import Tailscale devices as monitored machines
**So that** I can start monitoring them immediately without manual configuration

## Context

### Persona Reference

**Darren** - Technical professional running a homelab with 11+ servers on Tailscale. Wants a streamlined workflow to import discovered devices into HomelabCmd with minimal data entry.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

After discovering devices via the Tailscale API (US0077), users need a way to import those devices as monitored machines in HomelabCmd. This story provides the import modal and API endpoint that creates a Machine record pre-populated with Tailscale metadata, allowing users to quickly onboard devices for monitoring.

## Inherited Constraints

Constraints inherited from parent Epic that apply to this Story.

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| UX | Import modal pre-fills data | Minimal user input required |
| Data | Store tailscale_hostname and device_id | Link machine to Tailscale device |
| Validation | display_name required, TDP positive | Standard form validation |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Performance | API response < 500ms | Import should be quick |
| UX | Minimal maintenance | Pre-fill reduces typing |
| Data | Machine types: server, workstation | User selects type |

> **Validation:** Each inherited constraint MUST be addressed in either AC, Edge Cases, or Technical Notes.

## Acceptance Criteria

### AC1: Import button opens modal with pre-filled data

- **Given** I am on the Tailscale Device Discovery page
- **When** I click "Import" on a device `homeserver.tail-abc123.ts.net`
- **Then** an import modal opens with pre-filled fields:
  - Tailscale Hostname: `homeserver.tail-abc123.ts.net` (read-only)
  - Display Name: `HOMESERVER` (editable, derived from hostname)
  - Tailscale IP: `100.64.0.1` (read-only)
  - OS: `linux` (read-only)
  - Machine Type: Server (default, radio buttons)
  - TDP (Watts): empty (optional, number input)
  - Machine Category: dropdown (optional)

### AC2: Import creates machine record

- **Given** I have filled in the import modal
- **When** I click "Import Machine"
- **Then** `POST /api/v1/tailscale/import` creates a new Machine record
- **And** the machine includes `tailscale_hostname` and `tailscale_device_id`
- **And** the machine appears on the main dashboard immediately
- **And** success message shows "Imported {display_name} successfully"
- **And** the modal closes

### AC3: Duplicate detection warns user

- **Given** a machine with hostname `homeserver.tail-abc123.ts.net` already exists
- **When** I try to import the same device
- **Then** the modal shows warning: "A machine with this hostname already exists"
- **And** a link to view the existing machine is provided
- **And** the Import button is disabled

### AC4: Form validation enforced

- **Given** the import modal
- **When** I submit with invalid data
- **Then** validation errors are shown:
  - Empty display_name: "Display name is required"
  - TDP negative or zero: "TDP must be a positive number"
  - TDP non-numeric: "TDP must be a number"
- **And** form submission is blocked until errors are fixed

### AC5: Already imported devices indicated

- **Given** a Tailscale device has been imported
- **When** I view the Discovery page
- **Then** the device card shows "Already imported" badge
- **And** the "Import" button changes to "View Machine" linking to dashboard

## Scope

### In Scope

- Import modal with pre-filled Tailscale device data
- `POST /api/v1/tailscale/import` endpoint
- Machine record creation with Tailscale fields
- Duplicate hostname detection
- Form validation (display_name required, TDP positive)
- "Already imported" indicator on discovery page

### Out of Scope

- Bulk import of multiple devices
- Agent deployment to imported machine (separate workflow)
- Machine category management
- Editing existing machine's Tailscale fields

## UI/UX Requirements

**Import Modal:**

```
┌────────────────────────────────────────────────┐
│ Import Tailscale Device                    [X] │
├────────────────────────────────────────────────┤
│                                                │
│ Tailscale Hostname:                            │
│ homeserver.tail-abc123.ts.net        (locked)  │
│                                                │
│ Tailscale IP:                                  │
│ 100.64.0.1                           (locked)  │
│                                                │
│ OS:                                            │
│ linux                                (locked)  │
│                                                │
│ ─────────────────────────────────────────────  │
│                                                │
│ Display Name: *                                │
│ ┌──────────────────────────────────────────┐   │
│ │ HOMESERVER                               │   │
│ └──────────────────────────────────────────┘   │
│                                                │
│ Machine Type: *                                │
│ ● Server   ○ Workstation                       │
│                                                │
│ TDP (Watts):                                   │
│ ┌──────────────────────────────────────────┐   │
│ │ 50                                       │   │
│ └──────────────────────────────────────────┘   │
│ Optional - used for power cost estimates       │
│                                                │
│ Machine Category:                              │
│ ┌──────────────────────────────────────────┐   │
│ │ Select category...                     ▼ │   │
│ └──────────────────────────────────────────┘   │
│                                                │
│              [Cancel]  [Import Machine]        │
│                                                │
└────────────────────────────────────────────────┘
```

**Duplicate Warning:**

```
┌────────────────────────────────────────────────┐
│ ⚠️ A machine with this hostname already exists  │
│                                                │
│ homeserver.tail-abc123.ts.net was imported on  │
│ 2026-01-25 as "HOMESERVER".                    │
│                                                │
│ [View Machine]                                 │
└────────────────────────────────────────────────┘
```

## Technical Notes

### API Contracts

**POST /api/v1/tailscale/import**

Request:
```json
{
  "tailscale_device_id": "device-abc123",
  "tailscale_hostname": "homeserver.tail-abc123.ts.net",
  "tailscale_ip": "100.64.0.1",
  "os": "linux",
  "display_name": "HOMESERVER",
  "machine_type": "server",
  "tdp": 50,
  "category_id": null
}
```

Response 201:
```json
{
  "success": true,
  "machine": {
    "id": "machine-uuid-123",
    "server_id": "homeserver",
    "display_name": "HOMESERVER",
    "tailscale_hostname": "homeserver.tail-abc123.ts.net",
    "tailscale_device_id": "device-abc123",
    "machine_type": "server",
    "status": "unknown",
    "created_at": "2026-01-26T10:30:00Z"
  },
  "message": "Imported HOMESERVER successfully"
}
```

Response 400 (validation error):
```json
{
  "detail": {
    "code": "VALIDATION_ERROR",
    "message": "Display name is required",
    "field": "display_name"
  }
}
```

Response 409 (duplicate):
```json
{
  "detail": {
    "code": "DUPLICATE_MACHINE",
    "message": "A machine with hostname homeserver.tail-abc123.ts.net already exists",
    "existing_machine_id": "machine-uuid-456"
  }
}
```

**GET /api/v1/tailscale/import/check?hostname={hostname}**

Response 200 (not imported):
```json
{
  "imported": false
}
```

Response 200 (already imported):
```json
{
  "imported": true,
  "machine_id": "machine-uuid-456",
  "display_name": "HOMESERVER",
  "imported_at": "2026-01-25T15:00:00Z"
}
```

### Data Requirements

**Server table additions:**

```sql
ALTER TABLE servers ADD COLUMN tailscale_hostname TEXT;
ALTER TABLE servers ADD COLUMN tailscale_device_id TEXT;
ALTER TABLE servers ADD COLUMN machine_type TEXT DEFAULT 'server';

CREATE UNIQUE INDEX idx_servers_tailscale_hostname ON servers(tailscale_hostname);
```

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Hostname already exists | Return 409 with existing machine ID |
| Display name empty | Return 400: "Display name is required" |
| Display name too long (>100 chars) | Return 400: "Display name must be 100 characters or less" |
| TDP is zero | Return 400: "TDP must be a positive number" |
| TDP is negative | Return 400: "TDP must be a positive number" |
| TDP is non-numeric | Return 400: "TDP must be a number" |
| Invalid machine_type | Return 400: "Machine type must be 'server' or 'workstation'" |
| Tailscale device no longer exists | Import succeeds (device ID stored for reference) |
| Import while offline | Standard network error handling |
| Concurrent imports of same device | First wins, second gets 409 |

## Test Scenarios

- [x] Import modal opens with pre-filled device data
- [x] Display name derived from hostname (uppercase)
- [x] Read-only fields cannot be edited
- [x] Import creates machine record in database
- [x] Machine appears on dashboard after import
- [x] Duplicate hostname returns 409 with existing ID
- [x] Empty display name rejected with validation error
- [x] Negative TDP rejected with validation error
- [x] Invalid machine type rejected
- [x] Already imported devices show badge on discovery
- [x] View Machine link navigates to dashboard
- [x] Success message displayed after import

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0078-01 | Modal pre-fills device data | AC1 | E2E | Passed |
| TC-US0078-02 | Import creates machine | AC2 | Integration | Passed |
| TC-US0078-03 | Duplicate returns 409 | AC3 | Unit | Passed |
| TC-US0078-04 | Empty display name rejected | AC4 | Unit | Passed |
| TC-US0078-05 | Negative TDP rejected | AC4 | Unit | Passed |
| TC-US0078-06 | Invalid machine type rejected | AC4 | Unit | Passed |
| TC-US0078-07 | Already imported shows badge | AC5 | E2E | Passed |
| TC-US0078-08 | View Machine link works | AC5 | E2E | Passed |
| TC-US0078-09 | Tailscale fields stored | AC2 | Integration | Passed |
| TC-US0078-10 | Success message displayed | AC2 | E2E | Passed |

## Dependencies

### Story Dependencies

| Story | Dependency Type | What's Needed | Status |
|-------|-----------------|---------------|--------|
| [US0077](US0077-tailscale-device-discovery.md) | Data | Device list to import from | Done |
| [US0081](US0081-credential-encryption-storage.md) | Service | Credential access | Done |

### Schema Dependencies

| Schema | Source Story | Fields Needed |
|--------|--------------|---------------|
| Server | [US0002](US0002-server-registration-api.md) | Base machine fields |

### API Dependencies

| Endpoint | Source Story | How Used |
|----------|--------------|----------|
| GET /api/v1/tailscale/devices | [US0077](US0077-tailscale-device-discovery.md) | Device data source |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| None | - | - |

> **Note:** All story dependencies are Done (US0077, US0081).

## Implementation Notes

- [x] Create Alembic migration for `servers` table additions (tailscale_hostname, tailscale_device_id, machine_type columns)

## Estimation

**Story Points:** 5

**Complexity:** Medium - Form with validation and database integration

## Open Questions

None.

## Quality Checklist

### API Stories (minimum requirements)

- [x] Edge cases: 10/8 minimum documented
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
| 2026-01-26 | Claude | Added Implementation Notes with Alembic migration requirement |
| 2026-01-26 | Claude | Implementation plan created (PL0079), status → Planned |
| 2026-01-26 | Claude | Implementation complete, verified, status → Done |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
