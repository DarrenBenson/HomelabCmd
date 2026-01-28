# BG0014: Servers Identified by IP/Hostname Instead of GUID - Fails with DHCP

> **Status:** Closed
> **Severity:** Critical
> **Priority:** P0
> **Reporter:** User
> **Assignee:** Claude
> **Created:** 2026-01-21
> **Updated:** 2026-01-22

## Summary

The system identifies servers by IP address and hostname, both of which can change. This is a fundamental design issue that causes problems in home lab environments where:
- Devices may use DHCP and get different IP addresses after reboot
- Hostnames can be changed by users
- Multiple network interfaces may have different IPs
- VMs/containers may migrate between hosts with different IPs

When an IP address or hostname changes, the server appears as a new device or becomes unreachable for SSH operations (agent install, upgrade, removal, scans). Network discovery cannot reliably match discovered devices to registered servers.

## Affected Area

- **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
- **Story:** Multiple - core architecture issue
- **Component:** Backend - Server model, Agent, SSH services

## Environment

- **Version:** 1.0.0
- **Platform:** All
- **Browser:** N/A (backend issue)

## Reproduction Steps

1. Install agent on server at IP 10.0.0.50
2. Server reboots, DHCP assigns new IP 10.0.0.75
3. Agent continues working (connects to hub by hostname)
4. Try to upgrade/remove agent via SSH
5. SSH fails - stored IP is stale
6. Network discovery shows device at new IP as "new" device

## Expected Behaviour

1. Servers should be identified by a **permanent GUID** stored in the agent config
2. IP address and hostname should be treated as volatile attributes updated on each heartbeat
3. During network discovery, query each discovered device to retrieve its agent GUID
4. Match discovered devices to registered servers by GUID (not IP or hostname)
5. SSH operations should use the current IP/hostname from the last heartbeat

## Actual Behaviour

1. `install_agent()` uses `hostname` parameter which is often an IP address
2. Server record stores `hostname` field but it's really the "connection target" (IP or hostname)
3. SSH operations use stored `ip_address` or `hostname` directly without DNS resolution
4. If IP changes, server becomes orphaned or duplicated

## Screenshots/Evidence

**Current Server model:**
```python
class Server(Base):
    id: Mapped[str]  # server_id, e.g., "pihole-primary"
    hostname: Mapped[str]  # Actually stores IP or hostname used for install
    ip_address: Mapped[str | None]  # May be stale
```

**Agent heartbeat doesn't update IP:**
```python
# heartbeat.py - sends server_id but hub doesn't update IP from request source
payload = {
    "server_id": config.server_id,
    "metrics": {...},
    # Missing: current_ip, current_hostname
}
```

## Root Cause Analysis

The architecture was designed with static IP assumptions:

1. **Installation uses IP**: `install_agent(hostname="10.0.0.50")` - the "hostname" parameter is typically an IP from network discovery

2. **Server ID derived from IP**: When no server_id provided, it's generated from hostname:
   ```python
   server_id = hostname.lower().replace(".", "-")
   # "10.0.0.50" -> "10-0-0-50"
   ```

3. **No IP refresh mechanism**: Heartbeat handler doesn't update `ip_address` field

4. **SSH uses stored values**: Upgrade/remove use `server.ip_address or server.hostname` which may be stale

## Fix Description

**Resolved by:** [US0070: GUID-Based Server Identity](../stories/US0070-guid-based-server-identity.md)

The complete GUID-based server identity system was implemented:

1. **Agent GUID generation**: Agent generates UUID v4 on first run, stores in `/etc/homelab-agent/config.yaml`
2. **Agent identity endpoint**: Local HTTP endpoint at `localhost:9100/agent/identity` returns GUID
3. **Heartbeat includes GUID**: Payload sends `server_guid` and current `hostname`
4. **Hub matches by GUID**: Heartbeat handler matches/creates servers by GUID (primary key)
5. **Volatile field updates**: IP address updated from request source, hostname from payload
6. **Discovery GUID matching**: Network discovery queries agent identity to match existing servers
7. **Migration path**: Existing servers matched by server_id, GUID added on upgrade

### Files Modified

| File | Change |
|------|--------|
| `agent/config.py` | Added `server_guid` field, generation on first run |
| `agent/identity.py` | New HTTP server for identity endpoint |
| `agent/heartbeat.py` | Include GUID and hostname in payload |
| `backend/.../models/server.py` | Added `guid` column with unique constraint |
| `backend/.../routes/agents.py` | Match by GUID, update volatile fields |
| `backend/.../services/discovery.py` | Query agent GUID during discovery |
| Database migration | Added GUID column to servers table |

### Original Proposed Architecture (for reference): GUID-Based Server Identity

The solution is to use a **permanent GUID** as the server identifier, independent of IP or hostname.

**1. Agent generates and stores a GUID on first run:**
```python
# Agent config.yaml (generated on install)
server_guid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
server_id: "studypi400"  # User-friendly display name
```

**2. Agent exposes GUID via local endpoint:**
```python
# Agent runs a minimal HTTP server on localhost:9100 (or similar)
# GET /agent/identity returns:
{
    "guid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "server_id": "studypi400",
    "version": "1.0.0"
}
```

**3. Agent reports GUID in heartbeat:**
```python
payload = {
    "server_guid": config.server_guid,  # Primary identifier
    "server_id": config.server_id,       # Display name
    "hostname": socket.gethostname(),
    "ip_addresses": [list of current IPs],
    "metrics": {...},
}
```

**4. Hub stores GUID as primary key:**
```python
class Server(Base):
    guid: Mapped[str]  # Primary key - permanent GUID
    server_id: Mapped[str]  # Display name (user-friendly)
    hostname: Mapped[str | None]  # Current hostname (volatile)
    ip_address: Mapped[str | None]  # Current IP (volatile, updated on heartbeat)
```

**5. Discovery queries agent for GUID:**
```python
# During network discovery, for each device with SSH:
async def get_agent_guid(ip: str) -> str | None:
    """Query the agent's identity endpoint via SSH tunnel or direct HTTP."""
    # Option A: SSH command to query local agent
    result = await ssh.execute(ip, "curl -s http://localhost:9100/agent/identity")
    # Option B: Direct HTTP if agent port is exposed
    # result = await http.get(f"http://{ip}:9100/agent/identity")
    return result.get("guid")

# Match to registered server by GUID
server = await session.execute(
    select(Server).where(Server.guid == discovered_guid)
)
```

**6. Hub updates volatile fields on heartbeat:**
```python
# In heartbeat handler
server.hostname = payload.get("hostname") or server.hostname
server.ip_address = request.client.host  # Source IP of heartbeat
```

### Benefits

- **Permanent identity**: GUID never changes, even if IP/hostname change
- **DHCP-safe**: Works regardless of IP assignment
- **Migration-safe**: Server can move to different network
- **Discovery matching**: Reliable matching of discovered devices to registered servers
- **No DNS dependency**: Works without local DNS or mDNS

### Files to Modify

| File | Change |
|------|--------|
| `agent/config.py` | Add `server_guid` field, generate on first run |
| `agent/identity.py` | New - minimal HTTP server for identity endpoint |
| `agent/heartbeat.py` | Report GUID and current IP/hostname |
| `backend/src/homelab_cmd/db/models/server.py` | Add `guid` as primary identifier |
| `backend/src/homelab_cmd/api/routes/agents.py` | Match by GUID, update volatile fields |
| `backend/src/homelab_cmd/services/discovery.py` | Query agent GUID during discovery |
| `backend/src/homelab_cmd/services/agent_deploy.py` | Generate GUID on install |

### Tests to Add

| Test ID | Description | File |
|---------|-------------|------|
| - | Test GUID generation on agent install | - |
| - | Test heartbeat updates IP/hostname | - |
| - | Test discovery matches by GUID | - |
| - | Test server identity persists after IP change | - |

## Verification

- [x] Fix verified in development
- [x] Regression tests pass (1283 tests pass)
- [x] No side effects observed
- [ ] Documentation updated (if applicable)

**Verified by:** Claude
**Verification date:** 2026-01-22

### Verification Summary

The GUID-based server identity system is fully implemented:

1. **Agent GUID handling**: `agent/config.py` and `agent/heartbeat.py` include `server_guid`
2. **Per-agent credentials**: New `AgentCredential` model with `server_guid` as primary key
3. **Heartbeat matching by GUID**: `routes/agents.py:175-261` implements GUID-first matching
4. **Volatile field updates**: `routes/agents.py:267-271` updates hostname from payload and IP from request source on every heartbeat
5. **Server model**: `Server.guid` column added with unique constraint
6. **Integration with registration flow**: Token claim creates server with GUID, returns credentials

## Related Items

| Type | ID | Description |
|------|-----|-------------|
| Epic | EP0001 | Core Monitoring |
| Epic | EP0006 | Ad-hoc Scanning |
| Epic | EP0007 | Agent Management |

## Notes

This is a **critical architectural issue** affecting multiple epics. Home labs commonly use:
- DHCP for most devices
- mDNS/Bonjour for discovery (`.local` hostnames)
- Dynamic IP assignment

**Why GUID-based identity is the correct solution:**
- Neither IP nor hostname is reliable - both can change
- GUID is generated once, stored permanently in agent config
- Discovery can query agent directly to get GUID, enabling reliable matching
- Heartbeat updates volatile fields (IP, hostname) while GUID stays constant

**Current Workarounds (until fixed):**
1. Configure static IPs for all monitored servers (not always possible)
2. Manually update server records when IPs change (poor UX)
3. Use DNS hostnames when installing agent (requires local DNS)

**Impact if not fixed:**
- Agent upgrade/removal fails after IP change
- Network discovery creates duplicate server entries
- Scans fail on devices with changed IPs
- Poor reliability in typical home lab environments

**Implementation priority:** This is a significant architectural change. Plan for a dedicated sprint to implement properly with migration path for existing servers.

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-21 | User | Bug reported |
| 2026-01-22 | User | Redesigned solution: GUID-based identity instead of IP/hostname |
| 2026-01-22 | Claude | Fixed: Resolved by US0070 implementation |
