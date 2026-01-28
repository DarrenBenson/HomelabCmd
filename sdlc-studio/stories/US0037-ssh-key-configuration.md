# US0037: SSH Key Configuration

> **Status:** Done
> **Epic:** [EP0006: Ad-hoc Scanning](../epics/EP0006-adhoc-scanning.md)
> **Plan:** [PL0044: SSH Key Configuration](../plans/PL0044-ssh-key-configuration.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** to configure SSH keys for ad-hoc scanning
**So that** the hub can connect to transient devices securely

## Context

### Persona Reference

**Darren** - Has SSH keys set up across homelab. Wants to use existing keys for scanning without password prompts.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Ad-hoc scanning uses SSH to connect to target devices. SSH keys must be available to the hub service. Keys are mounted via Docker volume. This story covers key configuration and connection testing.

## Inherited Constraints

Constraints inherited from parent Epic that apply to this Story.

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Security | SSH key auth only | No password-based auth |
| Data | Keys via Docker volume | No in-app key management |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Security | Secure key handling | 600 permissions required |
| Architecture | LAN-only | Keys for local network devices |
| UX | Easy setup | Clear documentation required |

> **Validation:** Each inherited constraint MUST be addressed in either AC, Edge Cases, or Technical Notes.

## Acceptance Criteria

### AC1: SSH key path configurable

- **Given** the hub configuration
- **When** setting the SSH key path
- **Then** the scanner uses the specified key

### AC2: Default key location

- **Given** no custom key path configured
- **When** initiating a scan
- **Then** the default key location (/app/ssh/id_rsa) is used

### AC3: Test connection

- **Given** an SSH key is configured
- **When** POST `/api/v1/scan/test` with a hostname
- **Then** connection success or failure is returned

### AC4: Key permissions validated

- **Given** an SSH key file exists
- **When** the scanner starts
- **Then** key permissions are validated (must be 600)

### AC5: Multiple keys supported

- **Given** multiple SSH keys in the keys directory
- **When** connecting to a device
- **Then** keys are tried in order until one succeeds

## Scope

### In Scope

- SSH key path configuration
- Docker volume mount for keys
- Connection test endpoint
- Key permission validation
- Multiple key support

### Out of Scope

- Key generation
- Password-based SSH authentication
- Key management UI (files only)
- Agent-based key distribution

## Technical Notes

### Docker Configuration

```yaml
# docker-compose.yml
services:
  hub:
    volumes:
      - ./ssh-keys:/app/ssh:ro
```

### API Contracts

**POST /api/v1/scan/test**
```json
Request:
{
  "hostname": "192.168.1.100",
  "port": 22,
  "username": "darren"
}

Response 200 (success):
{
  "status": "success",
  "hostname": "192.168.1.100",
  "remote_hostname": "dazzbook",
  "response_time_ms": 245
}

Response 200 (failure):
{
  "status": "failed",
  "hostname": "192.168.1.100",
  "error": "Connection refused"
}
```

**GET /api/v1/settings/ssh**
```json
Response 200:
{
  "key_path": "/app/ssh",
  "keys_found": ["id_rsa", "id_ed25519"],
  "default_username": "darren",
  "default_port": 22
}
```

**PUT /api/v1/settings/ssh**
```json
Request:
{
  "default_username": "admin",
  "default_port": 22
}
```

**TRD Reference:** [§4 API Contracts - Scans](../trd.md#4-api-contracts)

### Data Requirements

- Settings stored in config table
- Keys read from filesystem (not database)

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| No keys found | Clear error message, scan disabled |
| Key permissions wrong | Warning on startup, suggest fix |
| Connection timeout | Return timeout error after 10s |
| Unknown host | Accept (no strict host checking) |
| Key rejected | Try next key, then fail |

## Test Scenarios

- [ ] Default key path used when not configured
- [ ] Custom key path works
- [ ] Connection test succeeds with valid key
- [ ] Connection test fails with invalid key
- [ ] Key permission validation works
- [ ] Multiple keys tried in order
- [ ] Timeout handled gracefully

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0037-01 | Default key path used | AC2 | Integration | Pending |
| TC-US0037-02 | Custom key path works | AC1 | Integration | Pending |
| TC-US0037-03 | Test connection succeeds | AC3 | API | Pending |
| TC-US0037-04 | Key permissions validated | AC4 | Unit | Pending |
| TC-US0037-05 | Multiple keys tried | AC5 | Integration | Pending |

## Quality Checklist

### API Stories (minimum requirements)

- [x] Edge cases: 5/8 minimum documented
- [x] Test scenarios: 7/10 minimum listed
- [x] API contracts: Exact request/response JSON shapes documented
- [x] Error codes: All error codes with exact messages specified

### All Stories

- [x] No ambiguous language
- [x] Open Questions: 0/0 resolved
- [x] Given/When/Then uses concrete values
- [x] Persona referenced with specific context

### Ready Status Gate

This story can be marked **Ready** when:
- [x] All critical Open Questions resolved
- [x] Minimum edge case count met
- [x] No "TBD" placeholders in acceptance criteria
- [x] Error scenarios documented

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0001: Database Schema | Story | Done |

## Estimation

**Story Points:** 3

**Complexity:** Medium - SSH client integration and security considerations

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-20 | Claude | Added Inherited Constraints, Test Cases, Quality Checklist sections |
| 2026-01-21 | Claude | Story review: marked Ready |
| 2026-01-21 | Claude | Implementation plan PL0044 created; status changed to Planned |
| 2026-01-21 | Claude | Implementation complete; 26 tests passing; status changed to Done |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
