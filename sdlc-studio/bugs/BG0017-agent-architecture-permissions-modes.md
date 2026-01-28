# BG0017: Agent Architecture - Permissions and Execution Modes

> **Status:** Closed
> **Severity:** Critical
> **Priority:** P0
> **Reporter:** User
> **Assignee:** Claude
> **Created:** 2026-01-22
> **Updated:** 2026-01-22
> **Fixed:** 2026-01-22

## Summary

The agent architecture has fundamental design issues around permissions and command execution. The current systemd service configuration prevents the agent from executing privileged commands (like `apt-get install`), making the remediation features non-functional.

The agent needs two distinct operating modes:
1. **Read-only mode** - Metrics collection and reporting only (secure, minimal privileges)
2. **Read/write mode** - Can execute commands for remediation (requires elevated privileges)

## Affected Area

- **Epic:** [EP0007: Agent Management](../epics/EP0007-agent-management.md)
- **Story:** Multiple - core architecture issue
- **Component:** Agent, systemd service, command execution

## Environment

- **Version:** 1.0.0
- **Platform:** Linux (Debian/Ubuntu/Raspberry Pi OS)
- **Browser:** N/A (agent issue)

## Current Problems

### 1. Conflicting systemd Security Settings

The current `homelab-agent.service` has:

```ini
NoNewPrivileges=yes      # Prevents sudo from working
ProtectSystem=strict     # Makes system directories read-only
ReadOnlyPaths=/          # Everything is read-only
```

These settings prevent ANY system modification, even with `use_sudo=true`.

### 2. No Clear Permission Model

- Agent runs as root (no `User=` directive) but with restricted capabilities
- `use_sudo=true` config option exists but doesn't work with current systemd settings
- No documentation on what privileges are actually needed

### 3. Security vs Functionality Trade-off Not Addressed

- Read-only monitoring is safe but limited
- Command execution requires elevated privileges but increases attack surface
- No way for user to choose their risk tolerance

## Expected Behaviour

### Two Operating Modes

**Mode 1: Read-Only (Monitor Only)**
- Collects metrics (CPU, memory, disk, network)
- Reports to hub via heartbeat
- Monitors systemd service status
- Detects pending package updates
- **Cannot** execute any commands
- Runs with minimal privileges (dedicated user, restricted systemd settings)

**Mode 2: Read/Write (Full Management)**
- Everything in read-only mode, plus:
- Execute whitelisted commands (apt-get, systemctl restart, etc.)
- Perform remediation actions approved by hub
- Requires elevated privileges (root or sudo-capable user)
- Relaxed systemd restrictions to allow system modifications

### User Choice at Install Time

```bash
# Install read-only agent (safe, monitoring only)
sudo ./install.sh --mode readonly

# Install read/write agent (full management capabilities)
sudo ./install.sh --mode readwrite
```

### Mode Visible in Hub

- Hub should display agent mode for each server
- "Approve" remediation actions should be disabled/hidden for read-only agents
- Clear indication why actions can't be performed on read-only agents

## Actual Behaviour

- Single mode that claims to support commands but doesn't work
- `use_sudo=true` setting is ineffective due to systemd restrictions
- Commands silently fail or produce permission errors
- No visibility into why commands fail

## Root Cause Analysis

### Current systemd Service (Problematic)

```ini
[Service]
Type=simple
ExecStart=/usr/bin/python3 /opt/homelab-agent/__main__.py
Restart=always

# These settings BLOCK command execution:
NoNewPrivileges=yes       # sudo won't work
ProtectSystem=strict      # /usr, /boot, /etc are read-only
ProtectHome=read-only     # /home is read-only
ReadOnlyPaths=/           # Everything is read-only
```

### What's Needed for Read/Write Mode

```ini
[Service]
Type=simple
User=root                  # Or: User=homelab-agent with sudo rights
ExecStart=/usr/bin/python3 /opt/homelab-agent/__main__.py
Restart=always

# Relaxed for command execution:
# NoNewPrivileges=no       # Allow privilege escalation
# ProtectSystem=false      # Allow system modifications
# No ReadOnlyPaths

# Still apply reasonable restrictions:
PrivateTmp=yes
ProtectKernelTunables=yes
ProtectControlGroups=yes
```

## Proposed Architecture

### Mode Configuration

```yaml
# /etc/homelab-agent/config.yaml

# Operating mode: "readonly" or "readwrite"
mode: readonly

hub_url: http://homelab-cmd:8080
server_id: my-server

# Only applies in readwrite mode:
command_execution:
  enabled: true
  timeout_seconds: 300
  # Whitelist of allowed command patterns (defence in depth)
  allowed_commands:
    - "apt-get update"
    - "apt-get upgrade -y"
    - "apt-get install -y *"
    - "systemctl restart *"
```

### Two systemd Service Files

**Read-only service** (`homelab-agent-readonly.service`):
```ini
[Unit]
Description=HomelabCmd Monitoring Agent (Read-Only)
After=network-online.target

[Service]
Type=simple
User=homelab-agent
Group=homelab-agent
ExecStart=/usr/bin/python3 /opt/homelab-agent/__main__.py

# Maximum security hardening
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=read-only
PrivateTmp=yes
ReadOnlyPaths=/
CapabilityBoundingSet=
AmbientCapabilities=

# Only needs to read system info and make outbound HTTP
RestrictAddressFamilies=AF_INET AF_INET6
RestrictNamespaces=yes

[Install]
WantedBy=multi-user.target
```

**Read/write service** (`homelab-agent-readwrite.service`):
```ini
[Unit]
Description=HomelabCmd Monitoring Agent (Read/Write)
After=network-online.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/python3 /opt/homelab-agent/__main__.py

# Minimal restrictions to allow command execution
PrivateTmp=yes
ProtectKernelTunables=yes
ProtectControlGroups=yes

# Command execution requires:
# - Write access to system directories (apt)
# - Ability to restart services (systemctl)
# - Root or sudo privileges

[Install]
WantedBy=multi-user.target
```

### Agent Reports Mode to Hub

```python
# In heartbeat payload
payload = {
    "server_guid": config.server_guid,
    "server_id": config.server_id,
    "agent_mode": config.mode,  # "readonly" or "readwrite"
    "metrics": {...},
}
```

### Hub Respects Agent Mode

- Don't send commands to read-only agents
- Display mode in server detail page
- Disable "Approve" buttons for read-only agents
- Show helpful message: "This server has a read-only agent. Reinstall with --mode readwrite to enable management."

## Benefits

1. **Security choice**: Users can choose their risk level
2. **Clear expectations**: Mode is visible, no silent failures
3. **Defence in depth**: Even read/write mode has command whitelist
4. **Principle of least privilege**: Read-only mode is genuinely restricted
5. **Auditability**: Mode recorded in heartbeat and server record

## Files to Modify

| File | Change |
|------|--------|
| `agent/config.py` | Add `mode` field (readonly/readwrite) |
| `agent/config.yaml.example` | Document mode options |
| `agent/install.sh` | Add `--mode` flag, select appropriate service file |
| `agent/homelab-agent.service` | Split into two service files |
| `agent/executor.py` | Check mode before executing commands |
| `agent/heartbeat.py` | Include mode in heartbeat payload |
| `backend/.../schemas/heartbeat.py` | Add `agent_mode` field |
| `backend/.../routes/agents.py` | Store mode, respect in command dispatch |
| `backend/.../models/server.py` | Add `agent_mode` column |
| `frontend/.../ServerDetail.tsx` | Display mode, disable actions for readonly |

## Tests to Add

| Test ID | Description |
|---------|-------------|
| - | Read-only agent rejects command execution |
| - | Read/write agent executes whitelisted commands |
| - | Hub doesn't send commands to read-only agents |
| - | Mode displayed correctly in UI |
| - | Install script creates correct service file per mode |

## Verification

- [x] Fix verified in development
- [x] Regression tests pass (1283 backend tests pass, including 8 new tests in `tests/test_bg0017_agent_mode_actions.py`)
- [x] No side effects observed
- [ ] Documentation updated

**Verified by:** Claude
**Verification date:** 2026-01-22

### Implementation Summary

**Agent changes:**
- `agent/config.py`: Added `mode` field with constants `AGENT_MODE_READONLY` and `AGENT_MODE_READWRITE`, `can_execute_commands()` method
- `agent/homelab-agent-readonly.service` (new): Maximum security hardening with dedicated user
- `agent/homelab-agent-readwrite.service` (new): Relaxed restrictions for sudo-based command execution
- `agent/install.sh`: Added `--mode` flag, interactive selection, creates `homelab-agent` user and sudoers rules for readwrite mode
- `agent/heartbeat.py`: Reports `agent_mode` in heartbeat payload

**Backend changes:**
- `backend/.../db/models/server.py`: Added `agent_mode` column
- `backend/.../api/schemas/heartbeat.py`: Added `agent_mode` field with regex validation
- `backend/.../api/routes/agents.py`: Stores `agent_mode` from heartbeat
- `backend/.../api/schemas/server.py`: Added `agent_mode` to `ServerResponse`
- `backend/.../api/routes/actions.py`: Rejects actions for readonly agents with 409 Conflict

**Frontend changes:**
- `frontend/src/types/server.ts`: Added `AgentMode` type and field to `Server`/`ServerDetail`
- `frontend/src/pages/ServerDetail.tsx`: Displays agent mode badge and readonly notice
- `frontend/src/components/ServicesPanel.tsx`: Passes `agentMode` to ServiceCard
- `frontend/src/components/ServiceCard.tsx`: Hides restart button for readonly agents
- `frontend/src/components/PackageList.tsx`: Hides action buttons for readonly agents, shows notice

## Related Items

| Type | ID | Description |
|------|-----|-------------|
| Bug | BG0012 | Agent Removal Does Not Uninstall (permissions issue) |
| Bug | BG0014 | Server Identity (GUID architecture) |
| Bug | BG0016 | Agent Removal Silent Skip |
| Epic | EP0007 | Agent Management |

## Notes

**This is a critical architectural issue** that affects the core value proposition of the hub:

- Without working command execution, the hub is just a monitoring dashboard
- Users expect "Update All" to actually update packages
- Current implementation gives false confidence (button exists but doesn't work)

**Migration path for existing agents:**
1. New installs choose mode at install time
2. Existing agents default to current behaviour (broken read/write)
3. Provide upgrade path: `sudo ./upgrade.sh --mode readwrite`
4. Document clearly that reinstall is needed for mode change

**Security considerations:**
- Read/write mode running as root is a significant attack surface
- Command whitelist provides defence in depth
- Consider future: dedicated user with specific sudo rules instead of root

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-22 | User | Bug reported - agent permissions and modes design |
