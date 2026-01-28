# US0004: Agent Script and Systemd Service

> **Status:** Done
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 5

## User Story

**As a** Darren (Homelab Operator)
**I want** a lightweight Python agent that collects and reports metrics
**So that** each server automatically sends its health data to the hub every 60 seconds

## Context

### Persona Reference

**Darren** - Manages 11 servers, wants easy deployment with minimal ongoing maintenance. Comfortable with SSH and systemd but values automation.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

The agent is a standalone Python script that runs as a systemd service on each monitored server. It collects system metrics using psutil, checks configured services, and POSTs a heartbeat to the hub API. The agent must be lightweight (minimal dependencies) and reliable (auto-restart on failure).

## Acceptance Criteria

### AC1: Agent collects system metrics

- **Given** the agent script is running
- **When** the collection interval (60s) elapses
- **Then** CPU%, RAM%, Disk%, Network I/O, Load averages, and Uptime are collected

### AC2: Agent collects OS information

- **Given** the agent script is running
- **When** the first heartbeat is prepared
- **Then** OS distribution, version, kernel version, and architecture are collected

### AC3: Agent sends heartbeat to hub

- **Given** the agent is configured with hub URL and API key
- **When** metrics are collected
- **Then** a POST request is sent to `/api/v1/agents/heartbeat`

### AC4: Agent runs as systemd service

- **Given** the agent is installed via the install script
- **When** the system boots
- **Then** the agent service starts automatically

### AC5: Agent configuration via YAML

- **Given** a config file at `/etc/homelab-agent/config.yaml`
- **When** the agent starts
- **Then** it reads hub_url, server_id, api_key from the config

### AC6: Agent handles hub unavailability with retry

- **Given** the hub is temporarily unreachable
- **When** a heartbeat POST fails
- **Then** the agent retries 3 times with 5-second delays before waiting for next interval

### AC7: Agent collects MAC address

- **Given** the agent is running
- **When** collecting system information
- **Then** the primary network interface MAC address is included in the heartbeat

### AC8: Agent collects package update counts

- **Given** the agent is running on a Debian-based system
- **When** collecting metrics for heartbeat
- **Then** the number of available updates and security updates is included

## Scope

### In Scope

- Python agent script (`homelab-agent.py`)
- Systemd service unit file (`homelab-agent.service`)
- Installation script (`install-agent.sh`)
- Configuration file format (`config.yaml`)
- Metrics collection: CPU, RAM, Disk (root mount), Network, Load, Uptime
- OS info collection
- MAC address collection
- Package update count collection (Debian-based)
- Retry logic: 3 retries with 5-second delays on heartbeat failure

### Out of Scope

- Service monitoring (EP0003)
- Command execution (EP0004)
- Multi-disk monitoring (open question)
- Agent auto-update mechanism (open question)
- Windows/macOS support

## UI/UX Requirements

N/A - No UI for agent.

## Technical Notes

### Agent Dependencies

Minimal dependencies for easy deployment:
- `psutil` - system metrics
- `httpx` - HTTP client (async capable)
- `pyyaml` - configuration parsing

### Installation Script

```bash
#!/bin/bash
# Install script creates:
# - /opt/homelab-agent/homelab-agent.py
# - /etc/homelab-agent/config.yaml
# - /etc/systemd/system/homelab-agent.service
# Then enables and starts the service
```

**TRD Reference:** [§2 Architecture - Agent Architecture](../trd.md#2-architecture-overview)

### Configuration Format

```yaml
# /etc/homelab-agent/config.yaml
hub_url: "http://homelab-cmd.home.lan:8080"
server_id: "omv-mediaserver"
api_key: "your-api-key-here"
heartbeat_interval: 60  # seconds
monitored_services: []  # EP0003 - empty for MVP
```

### Data Requirements

Agent collects using psutil:
- `psutil.cpu_percent(interval=1)` - CPU usage
- `psutil.virtual_memory()` - RAM usage
- `psutil.disk_usage('/')` - Root disk usage
- `psutil.net_io_counters()` - Network bytes
- `psutil.getloadavg()` - Load averages
- `psutil.boot_time()` - For uptime calculation
- `platform.uname()` - OS information

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Hub unreachable | Retry 3x with 5s delay, log warning, wait for next interval |
| Invalid API key | Log error (401), continue retrying |
| Config file missing | Exit with clear error message |
| Invalid config format | Exit with clear error message |
| psutil collection fails | Log error, send partial metrics |
| Service killed | Systemd restarts automatically (Restart=always) |
| MAC address unavailable | Send null, log warning |
| apt not available (non-Debian) | Send null for update counts |
| apt update times out | Log warning, send null for update counts |

## Test Scenarios

- [ ] Agent starts successfully with valid config
- [ ] Agent collects all expected metrics
- [ ] Agent sends correctly formatted heartbeat
- [ ] Agent handles hub 200 response
- [ ] Agent handles hub 401 response (logs error)
- [ ] Agent handles hub timeout (retries 3x with 5s delay)
- [ ] Agent handles hub connection refused (retries 3x with 5s delay)
- [ ] Agent restarts after crash via systemd
- [ ] Install script creates all required files
- [ ] Install script is idempotent (safe to re-run)
- [ ] Agent collects MAC address
- [ ] Agent collects update counts on Debian
- [ ] Agent handles missing apt gracefully

## Definition of Done


**Story-specific additions:**

- [ ] Agent tested on OMV (Debian-based)
- [ ] Agent tested on Raspberry Pi OS
- [ ] Installation documented in README
- [ ] Config template provided with comments

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0003: Heartbeat Endpoint | Story | Done |

## Estimation

**Story Points:** 5

**Complexity:** Medium - standalone script with resilience requirements

## Open Questions

- [ ] Should agent log to file or just journald? - Owner: Darren

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-18 | Claude | QA enhancement: Added retry logic (3x, 5s), MAC address collection, package update counts |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
