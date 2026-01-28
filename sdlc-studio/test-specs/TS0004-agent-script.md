# TS0004: Agent Script Tests

> **Status:** Complete
> **Epic:** [EP0001: Core Monitoring](../../epics/EP0001-core-monitoring.md)
> **Created:** 2026-01-19
> **Last Updated:** 2026-01-19

## Overview

Test specification for the HomelabCmd agent script that runs on monitored servers. Covers metrics collection, configuration loading, heartbeat sending with retry logic, and package update detection.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0004](../../stories/US0004-agent-script.md) | Agent Script and Systemd Service | High |
| [US0044](../../stories/US0044-package-update-display.md) | Package Update Display (agent collection) | Medium |

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Metrics collection functions, config parsing, retry logic |
| Integration | Yes | HTTP client behaviour, file system interactions |
| API | No | Agent is client-side; API tests covered in TS0001 |
| E2E | No | Agent runs standalone; systemd testing is manual |

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Python 3.11+, pytest, pytest-mock, pytest-asyncio |
| External Services | Mock HTTP server for heartbeat endpoint |
| Test Data | Sample config.yaml files, mock psutil responses |

---

## Test Cases

### TC021: Agent loads valid YAML configuration

**Type:** Unit
**Priority:** High
**Story:** US0004 (AC5)
**Automated:** Yes (`tests/test_agent.py::TestLoadConfig`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given a valid config.yaml file exists | File contains hub_url, server_id, api_key |
| 2 | When the agent loads configuration | Config parsed successfully |
| 3 | Then all required fields are accessible | Fields match file content |

#### Test Data

```yaml
input:
  config_file: |
    hub_url: "http://hub.local:8080"
    server_id: "test-server"
    api_key: "test-key-123"
    heartbeat_interval: 60
expected:
  hub_url: "http://hub.local:8080"
  server_id: "test-server"
  api_key: "test-key-123"
```

#### Assertions

- [x] hub_url loaded correctly
- [x] server_id loaded correctly
- [x] api_key loaded correctly
- [x] heartbeat_interval defaults to 60 if not specified

---

### TC022: Agent exits with error on missing config

**Type:** Unit
**Priority:** High
**Story:** US0004 (AC5)
**Automated:** Yes (`tests/test_agent.py::TestLoadConfig::test_load_config_file_not_found`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given config file does not exist | File missing |
| 2 | When the agent starts | Config load attempted |
| 3 | Then agent exits with clear error message | SystemExit with message |

#### Test Data

```yaml
input:
  config_path: "/nonexistent/config.yaml"
expected:
  exit_code: 1
  error_contains: "Config file not found"
```

#### Assertions

- [x] SystemExit raised
- [x] Error message mentions missing file path
- [x] Exit code is non-zero

---

### TC023: Agent exits with error on invalid config

**Type:** Unit
**Priority:** High
**Story:** US0004 (AC5)
**Automated:** Yes (`tests/test_agent.py::TestLoadConfig::test_load_config_empty_file`, `test_load_config_missing_*`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given config file has invalid YAML | Malformed content |
| 2 | When the agent starts | Config parse attempted |
| 3 | Then agent exits with clear error message | Parse error reported |

#### Test Data

```yaml
input:
  config_content: "invalid: yaml: content: ["
expected:
  exit_code: 1
  error_contains: "Invalid config"
```

#### Assertions

- [x] SystemExit raised
- [x] Error message indicates YAML parse error

---

### TC024: Agent collects CPU percentage

**Type:** Unit
**Priority:** High
**Story:** US0004 (AC1)
**Automated:** Yes (`tests/test_agent.py::TestGetMetrics::test_cpu_percent_in_valid_range`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given psutil is available | Module imported |
| 2 | When collect_metrics is called | CPU sampled |
| 3 | Then cpu_percent is a float between 0-100 | Valid percentage |

#### Test Data

```yaml
input:
  mock_cpu_percent: 45.5
expected:
  cpu_percent: 45.5
```

#### Assertions

- [x] cpu_percent is float
- [x] Value >= 0 and <= 100
- [x] psutil.cpu_percent called with interval

---

### TC025: Agent collects memory metrics

**Type:** Unit
**Priority:** High
**Story:** US0004 (AC1)
**Automated:** Yes (`tests/test_agent.py::TestGetMetrics::test_memory_percent_in_valid_range`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given psutil is available | Module imported |
| 2 | When collect_metrics is called | Memory queried |
| 3 | Then memory_percent, memory_total_mb, memory_used_mb returned | Valid values |

#### Test Data

```yaml
input:
  mock_virtual_memory:
    total: 17179869184  # 16 GB
    used: 8589934592    # 8 GB
    percent: 50.0
expected:
  memory_percent: 50.0
  memory_total_mb: 16384
  memory_used_mb: 8192
```

#### Assertions

- [x] memory_percent is float 0-100
- [x] memory_total_mb calculated correctly from bytes
- [x] memory_used_mb calculated correctly from bytes

---

### TC026: Agent collects disk metrics

**Type:** Unit
**Priority:** High
**Story:** US0004 (AC1)
**Automated:** Yes (`tests/test_agent.py`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given psutil is available | Module imported |
| 2 | When collect_metrics is called | Disk usage queried for '/' |
| 3 | Then disk_percent, disk_total_gb, disk_used_gb returned | Valid values |

#### Test Data

```yaml
input:
  mock_disk_usage:
    total: 2000000000000  # ~2 TB
    used: 1640000000000   # ~1.64 TB
    percent: 82.0
expected:
  disk_percent: 82.0
  disk_total_gb: 1862.64  # approximately
  disk_used_gb: 1527.57   # approximately
```

#### Assertions

- [x] disk_percent is float 0-100
- [x] disk_total_gb calculated from bytes
- [x] disk_used_gb calculated from bytes
- [x] Root mount '/' is used

---

### TC027: Agent collects network I/O

**Type:** Unit
**Priority:** Medium
**Story:** US0004 (AC1)
**Automated:** Yes (`tests/test_agent.py`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given psutil is available | Module imported |
| 2 | When collect_metrics is called | Network counters queried |
| 3 | Then network_rx_bytes and network_tx_bytes returned | Valid integers |

#### Test Data

```yaml
input:
  mock_net_io_counters:
    bytes_recv: 1073741824
    bytes_sent: 536870912
expected:
  network_rx_bytes: 1073741824
  network_tx_bytes: 536870912
```

#### Assertions

- [x] network_rx_bytes is integer
- [x] network_tx_bytes is integer
- [x] Values are non-negative

---

### TC028: Agent collects load averages

**Type:** Unit
**Priority:** Medium
**Story:** US0004 (AC1)
**Automated:** Yes (`tests/test_agent.py`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given psutil is available | Module imported |
| 2 | When collect_metrics is called | Load averages queried |
| 3 | Then load_1m, load_5m, load_15m returned | Valid floats |

#### Test Data

```yaml
input:
  mock_getloadavg: [1.5, 1.2, 0.9]
expected:
  load_1m: 1.5
  load_5m: 1.2
  load_15m: 0.9
```

#### Assertions

- [x] load_1m, load_5m, load_15m are floats
- [x] Values are non-negative

---

### TC029: Agent calculates uptime

**Type:** Unit
**Priority:** Medium
**Story:** US0004 (AC1)
**Automated:** Yes (`tests/test_agent.py`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given psutil is available | Module imported |
| 2 | When collect_metrics is called | Boot time queried |
| 3 | Then uptime_seconds calculated from boot time | Valid integer |

#### Test Data

```yaml
input:
  mock_boot_time: 1705555200  # Some past timestamp
  current_time: 1705641600    # 86400 seconds later
expected:
  uptime_seconds: 86400
```

#### Assertions

- [x] uptime_seconds is integer
- [x] Value is positive
- [x] Calculated as current_time - boot_time

---

### TC030: Agent collects OS information

**Type:** Unit
**Priority:** High
**Story:** US0004 (AC2)
**Automated:** Yes (`tests/test_agent.py`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given platform module available | Module imported |
| 2 | When collect_os_info is called | OS details gathered |
| 3 | Then distribution, version, kernel, architecture returned | Valid strings |

#### Test Data

```yaml
input:
  mock_uname:
    system: "Linux"
    release: "6.1.0-18-amd64"
    machine: "x86_64"
  mock_distro: ["Debian GNU/Linux", "12 (bookworm)"]
expected:
  distribution: "Debian GNU/Linux"
  version: "12 (bookworm)"
  kernel: "6.1.0-18-amd64"
  architecture: "x86_64"
```

#### Assertions

- [x] distribution is non-empty string
- [x] version is non-empty string
- [x] kernel contains version number
- [x] architecture is valid (x86_64, aarch64, etc.)

---

### TC031: Agent collects MAC address

**Type:** Unit
**Priority:** Medium
**Story:** US0004 (AC7)
**Automated:** Yes (`tests/test_agent.py`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given network interface available | psutil.net_if_addrs available |
| 2 | When collect_system_info is called | MAC address extracted |
| 3 | Then mac_address is valid format | XX:XX:XX:XX:XX:XX |

#### Test Data

```yaml
input:
  mock_net_if_addrs:
    eth0:
      - family: AF_LINK
        address: "00:11:22:33:44:55"
expected:
  mac_address: "00:11:22:33:44:55"
```

#### Assertions

- [x] mac_address matches MAC format
- [x] Primary interface selected (not loopback)

---

### TC032: Agent handles missing MAC gracefully

**Type:** Unit
**Priority:** Low
**Story:** US0004 (AC7)
**Automated:** Yes (`tests/test_agent.py`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given no valid network interfaces | No AF_LINK addresses |
| 2 | When collect_system_info is called | MAC collection attempted |
| 3 | Then mac_address is null and warning logged | Graceful degradation |

#### Test Data

```yaml
input:
  mock_net_if_addrs: {}
expected:
  mac_address: null
  log_level: "warning"
```

#### Assertions

- [x] mac_address is None
- [x] Warning logged about missing MAC
- [x] No exception raised

---

### TC033: Agent sends heartbeat successfully

**Type:** Integration
**Priority:** High
**Story:** US0004 (AC3)
**Automated:** Yes (`tests/test_agent.py`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given hub URL configured and reachable | Mock server ready |
| 2 | When heartbeat is sent | POST to /api/v1/agents/heartbeat |
| 3 | Then 200 response received and processed | Success logged |

#### Test Data

```yaml
input:
  hub_url: "http://mock-hub:8080"
  server_id: "test-server"
  metrics:
    cpu_percent: 45.5
  mock_response:
    status: 200
    body:
      received: true
expected:
  request_method: "POST"
  request_path: "/api/v1/agents/heartbeat"
  success: true
```

#### Assertions

- [x] POST request made to correct endpoint
- [x] X-API-Key header included
- [x] Request body contains server_id and metrics
- [x] Success response handled

---

### TC034: Agent retries on connection failure

**Type:** Integration
**Priority:** High
**Story:** US0004 (AC6)
**Automated:** Yes (`tests/test_agent.py`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given hub URL unreachable | Connection refused |
| 2 | When heartbeat is attempted | First attempt fails |
| 3 | Then agent retries 3 times with 5s delays | 3 retries before giving up |

#### Test Data

```yaml
input:
  hub_url: "http://unreachable:8080"
  mock_responses: [ConnectionError, ConnectionError, ConnectionError]
expected:
  total_attempts: 3
  delay_between: 5  # seconds
  final_result: "failed"
```

#### Assertions

- [x] 3 retry attempts made
- [x] 5 second delay between attempts
- [x] Warning logged after all retries fail
- [x] Agent continues to next interval (doesn't crash)

---

### TC035: Agent retries on timeout

**Type:** Integration
**Priority:** High
**Story:** US0004 (AC6)
**Automated:** Yes (`tests/test_agent.py`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given hub responds slowly | Timeout on request |
| 2 | When heartbeat is attempted | Timeout exception |
| 3 | Then agent retries 3 times | Retry logic applies |

#### Test Data

```yaml
input:
  hub_url: "http://slow-hub:8080"
  mock_responses: [TimeoutError, TimeoutError, Success]
expected:
  total_attempts: 3
  final_result: "success"
```

#### Assertions

- [x] Timeout triggers retry
- [x] Third attempt succeeds
- [x] No crash on timeout

---

### TC036: Agent logs 401 error but continues

**Type:** Integration
**Priority:** Medium
**Story:** US0004 (edge case)
**Automated:** Yes (`tests/test_agent.py`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given invalid API key configured | 401 response expected |
| 2 | When heartbeat is sent | 401 Unauthorized returned |
| 3 | Then error logged and agent continues | No crash |

#### Test Data

```yaml
input:
  api_key: "invalid-key"
  mock_response:
    status: 401
    body:
      detail: "Invalid API key"
expected:
  log_level: "error"
  continues: true
```

#### Assertions

- [x] 401 response logged as error
- [x] Error message includes "401" or "Unauthorized"
- [x] Agent continues running (waits for next interval)

---

### TC037: Agent collects package updates on Debian

**Type:** Unit
**Priority:** Medium
**Story:** US0044 (AC1)
**Automated:** Yes (`tests/test_agent.py`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given apt is available on system | Debian-based OS |
| 2 | When get_update_counts is called | apt list --upgradable executed |
| 3 | Then updates_available and security_updates returned | Counts parsed |

#### Test Data

```yaml
input:
  mock_apt_output: |
    Listing...
    libc6/stable-security 2.36-9+deb12u4 amd64 [upgradable from: 2.36-9+deb12u3]
    linux-image-amd64/stable-security 6.1.76-1 amd64 [upgradable from: 6.1.69-1]
    vim/stable 9.0.1378-2 amd64 [upgradable from: 9.0.1378-1]
expected:
  updates_available: 3
  security_updates: 2
```

#### Assertions

- [x] Total count is 3
- [x] Security count is 2 (lines containing "security")
- [x] subprocess.run called with correct args

---

### TC038: Agent handles missing apt gracefully

**Type:** Unit
**Priority:** Medium
**Story:** US0044 (edge case)
**Automated:** Yes (`tests/test_agent.py`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given apt is not available | Non-Debian OS |
| 2 | When get_update_counts is called | FileNotFoundError |
| 3 | Then null values returned and warning logged | Graceful degradation |

#### Test Data

```yaml
input:
  mock_error: FileNotFoundError("apt not found")
expected:
  updates_available: null
  security_updates: null
  log_level: "warning"
```

#### Assertions

- [x] updates_available is None
- [x] security_updates is None
- [x] Warning logged
- [x] No exception raised

---

### TC039: Agent handles apt timeout

**Type:** Unit
**Priority:** Low
**Story:** US0044 (edge case)
**Automated:** Yes (`tests/test_agent.py`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given apt update takes too long | Timeout after 60s |
| 2 | When get_update_counts is called | subprocess.TimeoutExpired |
| 3 | Then null values returned and warning logged | Graceful degradation |

#### Test Data

```yaml
input:
  mock_error: subprocess.TimeoutExpired("apt", 60)
expected:
  updates_available: null
  security_updates: null
  log_level: "warning"
```

#### Assertions

- [x] Timeout handled gracefully
- [x] Null values returned
- [x] Warning logged with timeout info

---

### TC040: Agent heartbeat includes all required fields

**Type:** Unit
**Priority:** High
**Story:** US0004 (AC3)
**Automated:** Yes (`tests/test_agent.py`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given metrics and OS info collected | All data available |
| 2 | When heartbeat payload is built | JSON structure created |
| 3 | Then payload contains all required fields | Schema compliance |

#### Test Data

```yaml
input:
  server_id: "test-server"
  metrics:
    cpu_percent: 45.5
    memory_percent: 67.2
    disk_percent: 82.0
  os_info:
    distribution: "Debian"
expected:
  payload_fields:
    - server_id
    - timestamp
    - metrics
    - os_info
    - updates_available
    - security_updates
    - mac_address
```

#### Assertions

- [x] server_id present
- [x] timestamp in ISO format
- [x] metrics object with required fields
- [x] os_info object (if available)
- [x] updates_available (may be null)
- [x] mac_address (may be null)

---

## Fixtures

```yaml
# Shared test data for this spec
config:
  valid_config:
    hub_url: "http://hub.home.lan:8080"
    server_id: "test-server"
    api_key: "test-api-key-12345"
    heartbeat_interval: 60
    monitored_services: []

metrics:
  sample_metrics:
    cpu_percent: 45.5
    memory_percent: 67.2
    memory_total_mb: 16384
    memory_used_mb: 11010
    disk_percent: 82.0
    disk_total_gb: 2000.0
    disk_used_gb: 1640.0
    network_rx_bytes: 1073741824
    network_tx_bytes: 536870912
    load_1m: 1.5
    load_5m: 1.2
    load_15m: 0.9
    uptime_seconds: 86400

os_info:
  debian_bookworm:
    distribution: "Debian GNU/Linux"
    version: "12 (bookworm)"
    kernel: "6.1.0-18-amd64"
    architecture: "x86_64"
```

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC021 | Agent loads valid YAML configuration | Automated | `tests/test_agent.py::TestLoadConfig` |
| TC022 | Agent exits with error on missing config | Automated | `tests/test_agent.py::TestLoadConfig::test_load_config_file_not_found` |
| TC023 | Agent exits with error on invalid config | Automated | `tests/test_agent.py::TestLoadConfig::test_load_config_empty_file`, `test_load_config_missing_*` |
| TC024 | Agent collects CPU percentage | Automated | `tests/test_agent.py::TestGetMetrics::test_cpu_percent_in_valid_range` |
| TC025 | Agent collects memory metrics | Automated | `tests/test_agent.py::TestGetMetrics::test_memory_percent_in_valid_range` |
| TC026 | Agent collects disk metrics | Automated | `tests/test_agent.py::TestGetMetrics::test_disk_percent_in_valid_range` |
| TC027 | Agent collects network I/O | Automated | `tests/test_agent.py::TestGetMetrics::test_returns_dict_with_expected_keys` |
| TC028 | Agent collects load averages | Automated | `tests/test_agent.py::TestGetMetrics::test_returns_dict_with_expected_keys` |
| TC029 | Agent calculates uptime | Automated | `tests/test_agent.py::TestGetMetrics::test_uptime_is_positive` |
| TC030 | Agent collects OS information | Automated | `tests/test_agent.py::TestGetOsInfo` |
| TC031 | Agent collects MAC address | Automated | `tests/test_agent.py::TestGetMacAddress::test_mac_format_if_present` |
| TC032 | Agent handles missing MAC gracefully | Automated | `tests/test_agent.py::TestGetMacAddress::test_handles_collection_failure` |
| TC033 | Agent sends heartbeat successfully | Automated | `tests/test_agent.py::TestSendHeartbeat::test_successful_heartbeat` |
| TC034 | Agent retries on connection failure | Automated | `tests/test_agent.py::TestSendHeartbeat::test_connection_error_retries` |
| TC035 | Agent retries on timeout | Automated | `tests/test_agent.py::TestSendHeartbeat::test_timeout_retries` |
| TC036 | Agent logs 401 error but continues | Automated | `tests/test_agent.py::TestSendHeartbeat::test_auth_failure_no_retry` |
| TC037 | Agent collects package updates on Debian | Automated | `tests/test_agent.py::TestGetPackageUpdates::test_parses_upgrade_count` |
| TC038 | Agent handles missing apt gracefully | Automated | `tests/test_agent.py::TestGetPackageUpdates::test_non_debian_system_returns_none` |
| TC039 | Agent handles apt timeout | Automated | `tests/test_agent.py::TestGetPackageUpdates::test_apt_timeout_returns_none` |
| TC040 | Agent heartbeat includes all required fields | Automated | `tests/test_agent.py::TestSendHeartbeat::test_payload_structure` |

**Summary:**
- **Total Test Cases:** 20
- **Automated:** 20/20 (100%)
- **Pytest Tests:** 48 tests in `tests/test_agent.py`

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../../prd.md) |
| TRD | [sdlc-studio/trd.md](../../trd.md) |
| Epic | [EP0001](../../epics/EP0001-core-monitoring.md) |
| Strategy | [sdlc-studio/tsd.md](../tsd.md) |

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-19 | Claude | Initial spec generation for agent script tests |
| 2026-01-19 | Claude | All 20 test cases automated - 48 pytest tests passing, status changed to Complete |
