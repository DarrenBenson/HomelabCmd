# US0069: Service Discovery During Agent Installation

> **Status:** Done
> **Epic:** [EP0003: Service Monitoring](../epics/EP0003-service-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-01-21
> **Story Points:** 3

## User Story

**As a** home lab administrator
**I want** to discover and select running services during agent installation
**So that** I can easily configure which services to monitor without manually typing service names

## Context

### Persona Reference

**Darren** - Home lab enthusiast who wants quick setup with minimal manual configuration.

[Full persona details](../personas.md#darren)

### Background

Currently, the Agent Install modal requires users to manually type service names as a comma-separated list. This is error-prone and requires users to know exact systemd service names. By discovering running services on the target system via SSH before installation, users can see what's actually running and select from a list.

Services should be categorisable as:
- **Core services**: Critical services that generate high-priority alerts when down
- **Standard services**: Normal services with regular alerting priority

## Inherited Constraints

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Dependency | Requires SSH access | Must have successful SSH auth before discovery |
| Performance | Discovery should be fast | Use efficient systemd commands |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Security | SSH credentials already validated | Reuse existing SSH connection context |
| UX | Minimal friction | Show loading state, handle errors gracefully |

## Acceptance Criteria

### AC1: Service Discovery Endpoint

- **Given** a valid SSH connection to a target device
- **When** I request service discovery for that hostname
- **Then** the API returns a list of running systemd services with their current status

### AC2: Service List in Install Modal

- **Given** I open the Agent Install modal for a device with SSH success
- **When** the modal loads
- **Then** I see a "Discover Services" button that fetches available services

### AC3: Service Selection UI

- **Given** services have been discovered
- **When** I view the service list
- **Then** I can select/deselect individual services using checkboxes

### AC4: Service Classification

- **Given** I have selected services to monitor
- **When** I configure each service
- **Then** I can mark it as either "Core" (critical) or "Standard" (normal priority)

### AC5: Selected Services in Install Request

- **Given** I have selected and classified services
- **When** I submit the installation
- **Then** the agent config includes the selected services with their classification

## Scope

### In Scope

- Backend API endpoint for service discovery via SSH
- Frontend UI for service discovery in AgentInstallModal
- Service selection with checkboxes
- Core vs Standard classification toggle
- Integration with existing agent installation flow

### Out of Scope

- Auto-detecting service importance (manual classification only)
- Service dependency mapping
- Non-systemd service discovery
- Editing service configuration post-installation (separate story)

## UI/UX Requirements

1. **Discover Services button**: Appears in Agent Install modal after hostname is shown
2. **Loading state**: Spinner while discovering services
3. **Service list**: Scrollable checkbox list with service names
4. **Classification toggle**: Each selected service has a Core/Standard toggle
5. **Selected count**: Shows "X services selected (Y core, Z standard)"
6. **Manual entry fallback**: Keep existing text input for services not in list

## Technical Notes

### API Contract

**POST `/api/v1/discovery/services`**

Request:
```json
{
  "hostname": "10.0.0.5",
  "port": 22,
  "username": "root"
}
```

Response:
```json
{
  "services": [
    { "name": "nginx", "status": "active", "description": "A high performance web server" },
    { "name": "plex", "status": "active", "description": "Plex Media Server" },
    { "name": "docker", "status": "active", "description": "Docker Application Container Engine" }
  ],
  "total": 3
}
```

### Agent Config Changes

Current `monitored_services` is a string list. Extend to support classification:

```yaml
monitored_services:
  - name: plex
    core: true
  - name: nginx
    core: false
```

Or simpler flat structure:
```yaml
monitored_services:
  - plex
  - nginx
core_services:
  - plex
```

### SSH Command

```bash
systemctl list-units --type=service --state=running --no-legend --no-pager | awk '{print $1, $4}'
```

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| SSH connection fails during discovery | Show error message, allow manual entry |
| No services running | Show "No running services found" message |
| Too many services (>50) | Show scrollable list, consider filtering |
| Service name contains special characters | Escape properly in display and config |
| Discovery timeout | Show timeout message after 30s, allow retry |
| User selects no services | Allow installation without service monitoring |

## Test Scenarios

- [ ] Discover services on device with 5 running services
- [ ] Discover services returns empty list gracefully
- [ ] Select 3 services, mark 1 as core
- [ ] SSH failure during discovery shows error
- [ ] Selected services appear in agent config after installation
- [ ] Manual entry still works alongside discovered services
- [ ] Core service classification persists through installation
- [ ] Cancel discovery mid-request handles cleanly

## Dependencies

### Story Dependencies

| Story | Dependency Type | What's Needed | Status |
|-------|-----------------|---------------|--------|
| US0037 | Uses | SSH key configuration | Done |
| US0018 | Extends | Agent service collection | Done |
| US0019 | Extends | Expected services configuration | Done |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| SSH access to target | Runtime | Required |
| systemd on target | Runtime | Required |

## Estimation

**Story Points:** 5

**Complexity:** Medium - requires backend endpoint, frontend UI changes, and agent config extension

## Open Questions

- [x] Should we filter out system services (like dbus, systemd-*) by default? - **Yes, filter by default.** Hide low-level system services, show user-installed services. User can toggle to see all.
- [x] Should core/standard affect alert severity or just be metadata? - **Affects severity.** Core service down = Critical alert. Standard service down = Warning alert.
- [x] Should we cache discovered services for the session? - **Yes, cache for session.** Cache clears on modal close.

## Quality Checklist

### API Stories (minimum requirements)

- [x] Edge cases: 6/8 minimum documented
- [x] Test scenarios: 8/10 minimum listed
- [x] API contracts: Exact request/response JSON shapes documented
- [ ] Error codes: All error codes with exact messages specified

### All Stories

- [x] No ambiguous language
- [x] Open Questions: 3/3 resolved
- [x] Given/When/Then uses concrete values
- [x] Persona referenced with specific context

### Ready Status Gate

This story can be marked **Ready** when:
- [x] All critical Open Questions resolved
- [x] Minimum edge case count met
- [x] No "TBD" placeholders in acceptance criteria
- [x] Error scenarios documented

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-21 | User | Story created |
| 2026-01-22 | Claude | Resolved open questions, marked Ready |
| 2026-01-22 | Claude | Implementation plan PL0051 created, status changed to Planned |
| 2026-01-22 | Claude | Implementation complete, all tests passing, status changed to Done |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
