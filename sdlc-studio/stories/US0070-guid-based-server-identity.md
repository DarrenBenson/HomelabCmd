# US0070: GUID-Based Server Identity

> **Status:** Done
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-01-22
> **Story Points:** 8

## User Story

**As a** home lab administrator
**I want** servers to be identified by a permanent GUID rather than IP address or hostname
**So that** my servers remain correctly identified even when DHCP assigns new IP addresses or hostnames change

## Context

### Persona Reference

**Darren** - Home lab enthusiast running servers on a typical home network with DHCP.

[Full persona details](../personas.md#darren)

### Background

The current architecture identifies servers by IP address and hostname, both of which can change. This causes problems in home lab environments where:

- Devices use DHCP and get different IP addresses after reboot
- Hostnames can be changed by users
- Multiple network interfaces may have different IPs
- VMs/containers may migrate between hosts

When an IP address changes, the server appears as a new device or becomes unreachable for SSH operations (agent install, upgrade, removal, scans). Network discovery cannot reliably match discovered devices to registered servers.

**Bug Reference:** [BG0014](../bugs/BG0014-servers-tracked-by-ip-not-hostname.md)

## Inherited Constraints

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Performance | Agent heartbeat success > 99.5% | GUID lookup must not add latency |
| Architecture | LAN-only deployment | GUID generation must work offline |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Architecture | Push model - agents POST heartbeats | Agent sends GUID in heartbeat payload |
| Data Model | SQLite storage | Add GUID column with unique constraint |

## Acceptance Criteria

### AC1: Agent GUID Generation

- **Given** a fresh agent installation on a new server
- **When** the agent starts for the first time
- **Then** it generates a UUID v4 GUID and stores it permanently in `/etc/homelab-agent/config.yaml`

### AC2: Agent GUID Persistence

- **Given** an agent with an existing GUID in config
- **When** the agent restarts or the server reboots
- **Then** the same GUID is used (never regenerated)

### AC3: Heartbeat Includes GUID and Current Network Info

- **Given** an agent sending a heartbeat
- **When** the heartbeat payload is constructed
- **Then** it includes `server_guid`, `hostname` (current), and source IP is captured by hub

### AC4: Hub Stores GUID as Primary Identifier

- **Given** a heartbeat received from an agent
- **When** the hub processes the heartbeat
- **Then** it matches/creates the server record by GUID (not by server_id or hostname)

### AC5: Hub Updates Volatile Fields on Heartbeat

- **Given** a registered server receiving a heartbeat
- **When** the heartbeat is processed
- **Then** `ip_address` is updated to the request source IP, and `hostname` is updated from the payload

### AC6: SSH Operations Use Current IP

- **Given** a server with GUID `abc-123` whose IP changed from `10.0.0.50` to `10.0.0.75`
- **When** I trigger an SSH operation (upgrade, removal, scan)
- **Then** it uses the current IP from the last heartbeat (`10.0.0.75`)

### AC7: Discovery Matches by GUID

- **Given** a network discovery scan finds a device at `10.0.0.75`
- **When** the device has an agent installed with GUID `abc-123`
- **Then** discovery matches it to the existing server record (not creating a duplicate)

### AC8: Migration for Existing Servers

- **Given** existing servers without GUIDs in the database
- **When** an upgraded agent sends its first heartbeat with a GUID
- **Then** the hub matches by `server_id` and adds the GUID to the existing record

## Scope

### In Scope

- Agent GUID generation and persistence
- Heartbeat payload changes (add GUID, current hostname)
- Hub server model changes (add GUID column)
- Hub heartbeat handler changes (match by GUID, update IP/hostname)
- SSH service changes (use current IP from server record)
- Discovery service changes (query agent GUID for matching)
- Database migration for existing servers
- Agent identity endpoint for discovery queries

### Out of Scope

- Changing the user-visible `server_id` (display name) - remains user-controlled
- Agent-to-agent communication
- Multi-hub federation
- GUID rotation or regeneration

## UI/UX Requirements

1. **No UI changes required** - GUID is internal identifier
2. **Server display name** remains `server_id` (user-friendly name)
3. **Server detail page** may optionally show GUID in technical info section

## Technical Notes

### Agent Config Changes

```yaml
# /etc/homelab-agent/config.yaml
server_guid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"  # Generated once, never changes
server_id: "studypi400"  # User-friendly display name
hub_url: "http://homelab-cmd:8080"
```

### Agent Identity Endpoint

Agent exposes identity via local HTTP for discovery queries:

```python
# GET http://localhost:9100/agent/identity (or via SSH tunnel)
{
    "guid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "server_id": "studypi400",
    "version": "1.0.0"
}
```

### Heartbeat Payload Changes

```json
{
    "server_guid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "server_id": "studypi400",
    "hostname": "studypi400.local",
    "metrics": { ... }
}
```

### Database Schema Changes

```python
class Server(Base):
    __tablename__ = "servers"

    id: Mapped[int] = mapped_column(primary_key=True)
    guid: Mapped[str] = mapped_column(String(36), unique=True, index=True)  # NEW
    server_id: Mapped[str] = mapped_column(String(255), unique=True)  # Display name
    hostname: Mapped[str | None]  # Current hostname (volatile)
    ip_address: Mapped[str | None]  # Current IP (volatile, updated on heartbeat)
```

### Heartbeat Handler Changes

```python
async def handle_heartbeat(payload: HeartbeatPayload, request: Request):
    # Match by GUID (primary) or server_id (migration fallback)
    server = await get_server_by_guid(payload.server_guid)
    if not server:
        server = await get_server_by_server_id(payload.server_id)
        if server and not server.guid:
            # Migration: add GUID to existing server
            server.guid = payload.server_guid

    if not server:
        # Auto-register new server
        server = Server(guid=payload.server_guid, server_id=payload.server_id)

    # Update volatile fields
    server.hostname = payload.hostname
    server.ip_address = request.client.host
```

### Discovery Service Changes

```python
async def match_discovered_device(ip: str) -> Server | None:
    """Query agent on discovered device to get GUID, match to server."""
    try:
        # SSH to device and query agent identity
        result = await ssh.execute(ip, "curl -s http://localhost:9100/agent/identity")
        identity = json.loads(result)
        return await get_server_by_guid(identity["guid"])
    except Exception:
        return None  # No agent or agent doesn't support identity endpoint
```

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Agent config file corrupted/deleted | Regenerate GUID, server appears as new device |
| Two agents with same GUID (copy/paste error) | Reject second heartbeat with 409 Conflict |
| Heartbeat without GUID (old agent) | Fall back to server_id matching, log upgrade warning |
| Discovery can't reach agent identity endpoint | Mark as "agent version unknown", don't match |
| Server has GUID but IP changed between heartbeats | Update IP, all operations use new IP |
| Migration: existing server, new GUID | Match by server_id, add GUID to record |
| GUID format invalid | Reject heartbeat with 400 Bad Request |
| Agent identity endpoint timeout | Discovery continues without GUID matching |

## Test Scenarios

- [ ] Fresh agent install generates GUID and stores in config
- [ ] Agent restart uses existing GUID (never regenerates)
- [ ] Heartbeat includes GUID and current hostname
- [ ] Hub matches server by GUID on heartbeat
- [ ] Hub updates IP address from request source
- [ ] Hub updates hostname from payload
- [ ] SSH upgrade uses current IP from last heartbeat
- [ ] Discovery queries agent identity and matches by GUID
- [ ] Old agent without GUID falls back to server_id matching
- [ ] Duplicate GUID rejected with 409 Conflict
- [ ] Migration path: existing server gets GUID on first new heartbeat
- [ ] Server with changed IP still matches correctly

## Dependencies

### Story Dependencies

| Story | Dependency Type | What's Needed | Status |
|-------|-----------------|---------------|--------|
| [US0001](US0001-database-schema.md) | Modifies | Server table schema | Done |
| [US0003](US0003-agent-heartbeat-endpoint.md) | Modifies | Heartbeat payload and handler | Done |
| [US0004](US0004-agent-script.md) | Modifies | Agent config and startup | Done |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| None | - | - |

## Estimation

**Story Points:** 8

**Complexity:** High - modifies core identity system across agent, hub API, database, and discovery

## Open Questions

None - design fully specified in BG0014.

## Quality Checklist

### API Stories (minimum requirements)

- [x] Edge cases: 8/8 minimum documented
- [x] Test scenarios: 12/10 minimum listed
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

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-22 | Claude | Story created from BG0014 |
| 2026-01-22 | Claude | Implementation plan PL0050 created, status changed to Planned |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
