# PL0007: Agent Script and Systemd Service - Implementation Plan

> **Status:** Complete
> **Story:** [US0004: Agent Script and Systemd Service](../stories/US0004-agent-script.md)
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Created:** 2026-01-18
> **Language:** Python

## Overview

This plan implements the lightweight monitoring agent that runs on each server in the homelab. The agent collects system metrics using psutil, sends heartbeats to the hub API every 60 seconds, and runs as a systemd service for reliability. This is the client-side component that pairs with the already-implemented heartbeat endpoint (US0003).

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Collects system metrics | CPU%, RAM%, Disk%, Network I/O, Load averages, Uptime |
| AC2 | Collects OS information | Distribution, version, kernel, architecture |
| AC3 | Sends heartbeat to hub | POST to `/api/v1/agents/heartbeat` with metrics |
| AC4 | Runs as systemd service | Starts on boot, auto-restarts on failure |
| AC5 | Configuration via YAML | Reads hub_url, server_id, api_key from config file |
| AC6 | Handles hub unavailability | Retries 3x with 5-second delays |
| AC7 | Collects MAC address | Primary network interface MAC included |
| AC8 | Collects package updates | Debian apt update counts (security flagged) |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.11+
- **Libraries:** psutil, httpx, pyyaml
- **Runtime:** Standalone script with systemd service
- **Test Framework:** pytest (for unit tests)

### Relevant Best Practices

From `~/.claude/best-practices/python.md`:
- Use `yaml.safe_load()` for configuration parsing
- HTTP requests must have timeouts
- Specific exception handling (no bare except)
- Type hints on all public functions
- Logging instead of print statements
- API keys from environment or config (not hardcoded)

### Library Documentation (Context7)

| Library | Context7 ID | Key Patterns |
|---------|-------------|--------------|
| psutil | /giampaolo/psutil | `cpu_percent(interval=1)`, `virtual_memory()`, `disk_usage('/')`, `net_io_counters()`, `getloadavg()`, `boot_time()` |
| httpx | /encode/httpx | Synchronous client with timeout, headers dict, `client.post(url, json=payload)`, exception handling for timeouts |
| PyYAML | /yaml/pyyaml | `yaml.safe_load(file)` for untrusted input, never use `yaml.load()` without SafeLoader |

### Existing Patterns

From US0003 HeartbeatRequest schema in `backend/src/homelab_cmd/api/schemas/heartbeat.py`:
- server_id: string (lowercase alphanumeric with hyphens)
- hostname: string
- timestamp: ISO8601 datetime
- os_info: { distribution, version, kernel, architecture }
- metrics: { cpu_percent, memory_percent, memory_total_mb, memory_used_mb, disk_percent, disk_total_gb, disk_used_gb, network_rx_bytes, network_tx_bytes, load_1m, load_5m, load_15m, uptime_seconds }

## Recommended Approach

**Strategy:** Test-After
**Rationale:** The agent is a standalone script that primarily integrates with external systems (OS metrics, HTTP, systemd). Unit testing will mock psutil and httpx to verify logic in isolation. Integration testing requires the hub to be running.

### Test Priority

1. Configuration loading (valid config, missing file, invalid format)
2. Metrics collection (all fields populated correctly)
3. Heartbeat request formatting (matches schema)
4. Retry logic (3 retries with 5s delay)
5. Error handling (partial metrics, hub unavailable)

### Documentation Updates Required

- [ ] Update agent/README.md with installation instructions
- [ ] Create config.yaml.example with comments

## Implementation Steps

### Phase 1: Project Structure

**Goal:** Create the agent directory structure and dependencies

#### Step 1.1: Create agent directory

- [ ] Create `agent/` directory at project root
- [ ] Create `agent/homelab_agent.py` (main script)
- [ ] Create `agent/config.yaml.example` (template)
- [ ] Create `agent/homelab-agent.service` (systemd unit)
- [ ] Create `agent/install.sh` (installation script)
- [ ] Create `agent/requirements.txt` (minimal deps)
- [ ] Create `agent/README.md` (installation docs)

**Files to create:**
- `agent/homelab_agent.py`
- `agent/config.yaml.example`
- `agent/homelab-agent.service`
- `agent/install.sh`
- `agent/requirements.txt`
- `agent/README.md`

**Directory structure:**
```
agent/
├── homelab_agent.py          # Main agent script
├── config.yaml.example       # Configuration template
├── homelab-agent.service     # Systemd unit file
├── install.sh                # Installation script
├── requirements.txt          # Python dependencies
└── README.md                 # Installation documentation
```

### Phase 2: Configuration Module

**Goal:** Implement YAML configuration loading with validation

#### Step 2.1: Configuration dataclass and loader

- [ ] Define AgentConfig dataclass with all settings
- [ ] Implement load_config() function
- [ ] Use yaml.safe_load() for security
- [ ] Validate required fields (hub_url, server_id, api_key)
- [ ] Set defaults for optional fields

**Configuration structure:**
```python
from dataclasses import dataclass
from pathlib import Path
import yaml

@dataclass
class AgentConfig:
    """Agent configuration loaded from YAML file."""
    hub_url: str
    server_id: str
    api_key: str
    heartbeat_interval: int = 60
    monitored_services: list[str] | None = None

def load_config(config_path: Path = Path("/etc/homelab-agent/config.yaml")) -> AgentConfig:
    """Load and validate configuration from YAML file.

    Raises:
        FileNotFoundError: Config file does not exist
        ValueError: Required field missing or invalid format
    """
    if not config_path.exists():
        raise FileNotFoundError(f"Configuration file not found: {config_path}")

    with open(config_path) as f:
        data = yaml.safe_load(f)

    if not data:
        raise ValueError("Configuration file is empty")

    required = ["hub_url", "server_id", "api_key"]
    for field in required:
        if field not in data or not data[field]:
            raise ValueError(f"Required configuration field missing: {field}")

    return AgentConfig(
        hub_url=data["hub_url"].rstrip("/"),
        server_id=data["server_id"],
        api_key=data["api_key"],
        heartbeat_interval=data.get("heartbeat_interval", 60),
        monitored_services=data.get("monitored_services"),
    )
```

### Phase 3: Metrics Collection

**Goal:** Collect system metrics using psutil

#### Step 3.1: OS information collection

- [ ] Implement get_os_info() function
- [ ] Use platform module for distribution, version, kernel
- [ ] Handle missing data gracefully

**OS info collection:**
```python
import platform

def get_os_info() -> dict[str, str | None]:
    """Collect operating system information."""
    uname = platform.uname()
    return {
        "distribution": platform.freedesktop_os_release().get("NAME") if hasattr(platform, "freedesktop_os_release") else None,
        "version": platform.freedesktop_os_release().get("VERSION_ID") if hasattr(platform, "freedesktop_os_release") else None,
        "kernel": uname.release,
        "architecture": uname.machine,
    }
```

#### Step 3.2: System metrics collection

- [ ] Implement get_metrics() function
- [ ] Collect CPU% with 1-second interval
- [ ] Collect memory stats (percent, total MB, used MB)
- [ ] Collect disk stats for root mount (percent, total GB, used GB)
- [ ] Collect network I/O (rx/tx bytes)
- [ ] Collect load averages (1m, 5m, 15m)
- [ ] Calculate uptime from boot_time
- [ ] Handle collection errors with partial results

**Metrics collection:**
```python
import time
import logging
import psutil

logger = logging.getLogger(__name__)

def get_metrics() -> dict[str, float | int | None]:
    """Collect system metrics using psutil.

    Returns partial metrics if some collections fail.
    """
    metrics: dict[str, float | int | None] = {}

    # CPU (blocking 1-second sample)
    try:
        metrics["cpu_percent"] = psutil.cpu_percent(interval=1)
    except Exception as e:
        logger.warning("Failed to collect CPU metrics: %s", e)
        metrics["cpu_percent"] = None

    # Memory
    try:
        mem = psutil.virtual_memory()
        metrics["memory_percent"] = mem.percent
        metrics["memory_total_mb"] = mem.total // (1024 * 1024)
        metrics["memory_used_mb"] = mem.used // (1024 * 1024)
    except Exception as e:
        logger.warning("Failed to collect memory metrics: %s", e)

    # Disk (root mount)
    try:
        disk = psutil.disk_usage("/")
        metrics["disk_percent"] = disk.percent
        metrics["disk_total_gb"] = disk.total / (1024**3)
        metrics["disk_used_gb"] = disk.used / (1024**3)
    except Exception as e:
        logger.warning("Failed to collect disk metrics: %s", e)

    # Network I/O
    try:
        net = psutil.net_io_counters()
        metrics["network_rx_bytes"] = net.bytes_recv
        metrics["network_tx_bytes"] = net.bytes_sent
    except Exception as e:
        logger.warning("Failed to collect network metrics: %s", e)

    # Load averages
    try:
        load = psutil.getloadavg()
        metrics["load_1m"] = load[0]
        metrics["load_5m"] = load[1]
        metrics["load_15m"] = load[2]
    except Exception as e:
        logger.warning("Failed to collect load averages: %s", e)

    # Uptime
    try:
        boot = psutil.boot_time()
        metrics["uptime_seconds"] = int(time.time() - boot)
    except Exception as e:
        logger.warning("Failed to collect uptime: %s", e)

    return metrics
```

#### Step 3.3: MAC address collection (AC7)

- [ ] Implement get_mac_address() function
- [ ] Find primary network interface (non-loopback)
- [ ] Return MAC address or None if unavailable

**MAC address collection:**
```python
import psutil
import socket

def get_mac_address() -> str | None:
    """Get MAC address of primary network interface.

    Returns the MAC address of the first non-loopback interface with an IPv4 address.
    """
    try:
        addrs = psutil.net_if_addrs()
        stats = psutil.net_if_stats()

        for iface, addr_list in addrs.items():
            # Skip loopback and down interfaces
            if iface == "lo" or not stats.get(iface, {}).isup:
                continue

            # Find interface with IPv4 address
            has_ipv4 = any(a.family == socket.AF_INET for a in addr_list)
            if not has_ipv4:
                continue

            # Find MAC address
            for addr in addr_list:
                if addr.family == psutil.AF_LINK:
                    return addr.address

        return None
    except Exception as e:
        logger.warning("Failed to get MAC address: %s", e)
        return None
```

#### Step 3.4: Package update collection (AC8)

- [ ] Implement get_package_updates() function
- [ ] Run `apt update` and parse available updates
- [ ] Detect security updates separately
- [ ] Handle non-Debian systems gracefully
- [ ] Add timeout for apt command

**Package update collection:**
```python
import subprocess
import re

def get_package_updates() -> dict[str, int | None]:
    """Get count of available package updates (Debian-based systems).

    Returns dict with updates_available and security_updates counts.
    Returns None values on non-Debian systems or errors.
    """
    result = {"updates_available": None, "security_updates": None}

    # Check if apt is available
    try:
        subprocess.run(
            ["which", "apt"],
            capture_output=True,
            check=True,
            timeout=5,
        )
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
        logger.debug("apt not available - skipping update count")
        return result

    # Run apt update (requires sudo or appropriate permissions)
    try:
        # Use apt-get with simulated upgrade to count updates
        proc = subprocess.run(
            ["apt-get", "-s", "upgrade"],
            capture_output=True,
            text=True,
            timeout=60,
        )

        # Parse output for upgrade count
        output = proc.stdout

        # Count total upgrades
        upgrade_match = re.search(r"(\d+) upgraded", output)
        if upgrade_match:
            result["updates_available"] = int(upgrade_match.group(1))
        else:
            result["updates_available"] = 0

        # Count security updates (lines containing -security)
        security_count = 0
        for line in output.split("\n"):
            if "security" in line.lower() and "Inst " in line:
                security_count += 1
        result["security_updates"] = security_count

    except subprocess.TimeoutExpired:
        logger.warning("apt update check timed out")
    except Exception as e:
        logger.warning("Failed to check for updates: %s", e)

    return result
```

### Phase 4: Heartbeat Sender

**Goal:** Implement HTTP client with retry logic

#### Step 4.1: Heartbeat request with retry (AC3, AC6)

- [ ] Implement send_heartbeat() function
- [ ] Use httpx with timeout configuration
- [ ] Include X-API-Key header
- [ ] Implement retry logic (3 retries, 5s delay)
- [ ] Log success/failure appropriately

**Heartbeat sender:**
```python
from datetime import datetime, UTC
import time
import httpx
import socket

RETRY_COUNT = 3
RETRY_DELAY_SECONDS = 5
REQUEST_TIMEOUT = 30.0

def send_heartbeat(
    config: AgentConfig,
    metrics: dict,
    os_info: dict,
    mac_address: str | None,
    package_updates: dict,
) -> bool:
    """Send heartbeat to hub API with retry logic.

    Returns True if heartbeat was sent successfully, False otherwise.
    """
    url = f"{config.hub_url}/api/v1/agents/heartbeat"

    payload = {
        "server_id": config.server_id,
        "hostname": socket.gethostname(),
        "timestamp": datetime.now(UTC).isoformat(),
        "os_info": os_info,
        "metrics": metrics,
    }

    # Add MAC address and updates if available (future schema extension)
    # For now, these are collected but the hub schema doesn't support them yet
    # They'll be included when the hub schema is updated

    headers = {
        "X-API-Key": config.api_key,
        "Content-Type": "application/json",
    }

    last_error: Exception | None = None

    for attempt in range(1, RETRY_COUNT + 1):
        try:
            with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
                response = client.post(url, json=payload, headers=headers)

                if response.status_code == 200:
                    data = response.json()
                    if data.get("server_registered"):
                        logger.info("Server auto-registered with hub")
                    logger.debug("Heartbeat sent successfully")
                    return True
                elif response.status_code == 401:
                    logger.error("Authentication failed - check API key")
                    return False  # Don't retry auth failures
                else:
                    logger.warning(
                        "Heartbeat failed (attempt %d/%d): HTTP %d",
                        attempt, RETRY_COUNT, response.status_code
                    )
                    last_error = Exception(f"HTTP {response.status_code}")

        except httpx.ConnectError as e:
            logger.warning(
                "Hub connection failed (attempt %d/%d): %s",
                attempt, RETRY_COUNT, e
            )
            last_error = e
        except httpx.TimeoutException as e:
            logger.warning(
                "Hub request timed out (attempt %d/%d): %s",
                attempt, RETRY_COUNT, e
            )
            last_error = e
        except Exception as e:
            logger.warning(
                "Heartbeat error (attempt %d/%d): %s",
                attempt, RETRY_COUNT, e
            )
            last_error = e

        if attempt < RETRY_COUNT:
            logger.debug("Retrying in %d seconds...", RETRY_DELAY_SECONDS)
            time.sleep(RETRY_DELAY_SECONDS)

    logger.error(
        "Failed to send heartbeat after %d attempts: %s",
        RETRY_COUNT, last_error
    )
    return False
```

### Phase 5: Main Loop

**Goal:** Implement the main agent loop

#### Step 5.1: Main entry point

- [ ] Parse command-line arguments (config path)
- [ ] Load configuration
- [ ] Set up logging (journald compatible)
- [ ] Run heartbeat loop with interval sleep

**Main function:**
```python
import argparse
import sys

def main() -> int:
    """Main entry point for the agent."""
    parser = argparse.ArgumentParser(description="HomelabCmd monitoring agent")
    parser.add_argument(
        "-c", "--config",
        default="/etc/homelab-agent/config.yaml",
        help="Path to configuration file",
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose logging",
    )
    args = parser.parse_args()

    # Configure logging for systemd journald
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s: %(message)s",
    )

    # Load configuration
    try:
        config = load_config(Path(args.config))
        logger.info("Configuration loaded from %s", args.config)
    except FileNotFoundError as e:
        logger.error("Configuration error: %s", e)
        return 1
    except ValueError as e:
        logger.error("Invalid configuration: %s", e)
        return 1

    logger.info(
        "Starting homelab-agent for server '%s' (hub: %s)",
        config.server_id, config.hub_url
    )

    # Collect OS info once at startup
    os_info = get_os_info()
    logger.info(
        "OS: %s %s (kernel %s, %s)",
        os_info.get("distribution"),
        os_info.get("version"),
        os_info.get("kernel"),
        os_info.get("architecture"),
    )

    # Main loop
    while True:
        try:
            # Collect metrics
            metrics = get_metrics()
            mac_address = get_mac_address()
            package_updates = get_package_updates()

            # Send heartbeat
            send_heartbeat(config, metrics, os_info, mac_address, package_updates)

        except KeyboardInterrupt:
            logger.info("Shutting down...")
            return 0
        except Exception as e:
            logger.exception("Unexpected error in main loop: %s", e)

        # Wait for next interval
        time.sleep(config.heartbeat_interval)

    return 0


if __name__ == "__main__":
    sys.exit(main())
```

### Phase 6: Systemd Service

**Goal:** Create systemd unit file and installation script

#### Step 6.1: Systemd unit file (AC4)

- [ ] Create homelab-agent.service
- [ ] Configure auto-restart on failure
- [ ] Set up proper dependencies (network)
- [ ] Use appropriate service type

**Systemd service file:**
```ini
[Unit]
Description=HomelabCmd Monitoring Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 /opt/homelab-agent/homelab_agent.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Security hardening
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=read-only
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
```

#### Step 6.2: Installation script

- [ ] Create install.sh script
- [ ] Create directories (/opt/homelab-agent, /etc/homelab-agent)
- [ ] Copy agent script
- [ ] Install Python dependencies
- [ ] Copy systemd unit
- [ ] Create config from template if not exists
- [ ] Enable and start service
- [ ] Make idempotent (safe to re-run)

**Installation script:**
```bash
#!/bin/bash
set -e

# Check for root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root"
   exit 1
fi

AGENT_DIR="/opt/homelab-agent"
CONFIG_DIR="/etc/homelab-agent"
SERVICE_FILE="/etc/systemd/system/homelab-agent.service"

echo "Installing homelab-agent..."

# Create directories
mkdir -p "$AGENT_DIR"
mkdir -p "$CONFIG_DIR"

# Copy agent script
cp homelab_agent.py "$AGENT_DIR/"
chmod 755 "$AGENT_DIR/homelab_agent.py"

# Install Python dependencies
pip3 install --quiet psutil httpx pyyaml

# Copy systemd service
cp homelab-agent.service "$SERVICE_FILE"

# Create config from template if it doesn't exist
if [[ ! -f "$CONFIG_DIR/config.yaml" ]]; then
    cp config.yaml.example "$CONFIG_DIR/config.yaml"
    echo "Created configuration template at $CONFIG_DIR/config.yaml"
    echo "Please edit this file with your hub URL and API key before starting the service"
fi

# Reload systemd
systemctl daemon-reload

# Enable service
systemctl enable homelab-agent

echo "Installation complete!"
echo ""
echo "Next steps:"
echo "1. Edit $CONFIG_DIR/config.yaml with your settings"
echo "2. Start the service: systemctl start homelab-agent"
echo "3. Check status: systemctl status homelab-agent"
echo "4. View logs: journalctl -u homelab-agent -f"
```

#### Step 6.3: Configuration template

- [ ] Create config.yaml.example with comments
- [ ] Document all options

**Configuration template:**
```yaml
# HomelabCmd Agent Configuration
# Copy to /etc/homelab-agent/config.yaml and edit values

# Hub URL (required)
# The URL of your HomelabCmd instance
hub_url: "http://homelab-cmd.home.lan:8080"

# Server ID (required)
# Unique identifier for this server (lowercase letters, numbers, hyphens only)
server_id: "omv-mediaserver"

# API Key (required)
# Must match the HOMELAB_CMD_API_KEY environment variable on the hub
api_key: "your-api-key-here"

# Heartbeat interval in seconds (optional, default: 60)
heartbeat_interval: 60

# Services to monitor (optional, for future use)
# monitored_services:
#   - plex
#   - sonarr
#   - radarr
```

### Phase 7: Testing & Validation

**Goal:** Verify all acceptance criteria

#### Step 7.1: Unit tests

- [ ] Create `tests/test_agent.py` for agent unit tests
- [ ] Test configuration loading (valid, missing, invalid)
- [ ] Test metrics collection (mock psutil)
- [ ] Test heartbeat formatting
- [ ] Test retry logic (mock httpx)

**Test file location:** `tests/test_agent.py`

#### Step 7.2: Manual integration testing

- [ ] Test agent on local machine with hub running
- [ ] Verify heartbeat appears in hub
- [ ] Test with hub unavailable (verify retries)
- [ ] Test systemd restart on process kill

#### Step 7.3: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Verify all metrics populated in heartbeat | Pending |
| AC2 | Verify OS info sent in first heartbeat | Pending |
| AC3 | Verify heartbeat reaches hub (200 response) | Pending |
| AC4 | Verify systemd restarts on kill -9 | Pending |
| AC5 | Verify config loaded from YAML | Pending |
| AC6 | Stop hub, verify 3 retries with 5s delay | Pending |
| AC7 | Verify MAC address in collected data | Pending |
| AC8 | Verify update counts on Debian system | Pending |

## Project Structure (After Implementation)

```
HomelabCmd/
├── agent/
│   ├── homelab_agent.py          # Main agent script (800 lines)
│   ├── config.yaml.example       # Configuration template
│   ├── homelab-agent.service     # Systemd unit file
│   ├── install.sh                # Installation script
│   ├── requirements.txt          # Python dependencies
│   └── README.md                 # Installation documentation
├── backend/src/homelab_cmd/              # Existing hub code
└── tests/
    ├── test_agent.py             # Agent unit tests (new)
    └── ...                       # Existing tests
```

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| Hub unreachable | Retry 3x with 5s delay, log warning, continue |
| Invalid API key (401) | Log error, don't retry (auth failure), continue |
| Config file missing | Exit with clear error message (startup only) |
| Invalid config format | Exit with clear error message (startup only) |
| psutil collection fails | Log warning, send partial metrics |
| Service killed | Systemd restarts automatically (Restart=always) |
| MAC address unavailable | Send null, log debug message |
| apt not available | Send null for update counts, log debug |
| apt command times out | Log warning, send null for update counts |
| Network interface down | Skip interface, try next one for MAC |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Agent crashes loop | Service down | Systemd Restart=always with RestartSec=10 |
| CPU spike from metrics | Performance hit | 1-second CPU sample is acceptable |
| apt update slow | Delayed heartbeat | 60s timeout, run async in future |
| Memory leak | Resource exhaustion | Stateless design, no caching |
| Config changes ignored | Stale settings | Requires service restart (documented) |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0003 | Story | Provides heartbeat endpoint (Done) |
| psutil | Package | System metrics collection |
| httpx | Package | HTTP client with timeout |
| pyyaml | Package | Configuration parsing |

## Open Questions

- [ ] Should agent log to file or just journald? - Recommendation: journald only (simpler, standard)

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows Python best practices
- [ ] No linting errors (ruff)
- [ ] yaml.safe_load() used for config
- [ ] HTTP requests have timeouts
- [ ] Logging shows agent activity
- [ ] Installation script is idempotent
- [ ] README documents installation process
- [ ] Config template includes all options with comments
- [ ] Agent tested on OMV (Debian-based)
- [ ] Agent tested on Raspberry Pi OS

## Notes

Key design decisions for this story:
- **Synchronous httpx** over async - simpler for standalone script
- **Journald logging** - integrates with systemd, no file management
- **Partial metrics** - send what we can, don't fail completely
- **No daemon library** - systemd handles process management
- **MAC address and package updates** - collected but hub schema needs extension

The hub's HeartbeatRequest schema currently lacks fields for:
- mac_address
- updates_available
- security_updates

A follow-up story (US0044) or schema update is needed to persist these fields.

## Next Steps After Completion

- **US0005**: Dashboard Overview (server cards with metrics)
- **US0006**: Server Detail View (historical metrics)
- **US0044**: Package Update Display (schema extension)
