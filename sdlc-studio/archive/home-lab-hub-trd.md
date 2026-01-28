# Technical Requirements Document

**Project:** HomelabCmd
**Version:** 1.0.0
**Status:** Draft
**Last Updated:** 2026-01-18
**PRD Reference:** TBD

---

## 1. Executive Summary

### Purpose

This Technical Requirements Document describes the architecture, technology stack, data models, and infrastructure for HomelabCmd - a self-hosted homelab monitoring and management platform providing real-time server status, automated remediation, cost tracking, and ad-hoc device scanning.

### Scope

**Covered:**
- Dashboard web application (React SPA)
- API server architecture and endpoints (FastAPI)
- Lightweight monitoring agent for Linux servers
- Data storage and metrics collection
- Notification system (Slack integration)
- Remediation engine with approval workflow
- Cost estimation calculations
- Ad-hoc device scanning

**Not Covered:**
- pfSense/FreeBSD monitoring (future consideration)
- Windows/macOS agent support
- External/cloud deployment
- Multi-user authentication
- Mobile native applications

### Key Decisions

- **SQLite storage** for simplicity and self-contained deployment
- **Hybrid push/pull agent model** - agents push metrics, poll for commands
- **React SPA frontend** with FastAPI backend in single container
- **Pre-defined service expectations** per server for targeted alerting
- **Staged remediation** with optional auto-approve mode
- **Slack webhooks** for notifications (matching existing UptimeKuma setup)

---

## 2. Architecture Overview

### System Context

HomelabCmd monitors a fleet of Linux servers (primarily OpenMediaVault-based) and Raspberry Pi devices on a home network:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Home Network                                   │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │OMV HomeServer│  │OMV MediaServer│  │OMV AIServer1 │  │OMV BackupSrv │ │
│  │   [agent]    │  │    [agent]    │  │   [agent]    │  │   [agent]    │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                 │                 │          │
│  ┌──────┴─────────────────┴─────────────────┴─────────────────┴───────┐ │
│  │                        LAN (home.lan)                               │ │
│  └─────────────────────────────┬───────────────────────────────────────┘ │
│                                │                                         │
│                       ┌────────▼────────┐                                │
│                       │  HOME-LAB-HUB   │                                │
│                       │  Docker Container│                                │
│                       │  - FastAPI      │──────▶ Slack Notifications     │
│                       │  - React SPA    │                                │
│                       │  - SQLite       │                                │
│                       └─────────────────┘                                │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │Pi-hole Master│  │Pi-hole Backup│  │ Transient    │ ◀── Ad-hoc scan   │
│  │   [agent]    │  │   [agent]    │  │ Laptops/PCs  │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Architecture Pattern

**Monolith with Agent Fleet**

**Rationale:**
- Simple deployment (single Docker container for hub)
- Lightweight agents (single Python script + systemd service)
- Self-contained data (SQLite, no external dependencies)
- Suitable for homelab scale (5-20 servers)
- Easy backup (database file + config)

### Component Overview

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| Dashboard | Server status visualisation, management UI | React + Vite |
| API Server | REST endpoints, business logic, scheduling | FastAPI + Uvicorn |
| Agent | Metrics collection, command execution | Python script + systemd |
| Database | Metrics storage, configuration, audit log | SQLite |
| Notifier | Alert dispatch to Slack | Slack Webhook API |
| Remediation Engine | Action approval and execution | FastAPI background tasks |
| Scanner | Ad-hoc device discovery and audit | SSH + Python |

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Docker Container                                  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                         Uvicorn                                    │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │                      FastAPI App                             │  │  │
│  │  │                                                              │  │  │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │  │  │
│  │  │  │ API Routes  │  │ Background  │  │ Static File Server  │  │  │  │
│  │  │  │             │  │ Scheduler   │  │ (React build)       │  │  │  │
│  │  │  │ /api/v1/*   │  │             │  │                     │  │  │  │
│  │  │  │ - servers   │  │ - Stale     │  │ /* → index.html     │  │  │  │
│  │  │  │ - metrics   │  │   detection │  │                     │  │  │  │
│  │  │  │ - alerts    │  │ - Alert     │  │                     │  │  │  │
│  │  │  │ - actions   │  │   checks    │  │                     │  │  │  │
│  │  │  │ - scans     │  │ - Cost      │  │                     │  │  │  │
│  │  │  │ - config    │  │   rollup    │  │                     │  │  │  │
│  │  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │  │  │
│  │  │                           │                                  │  │  │
│  │  │                    ┌──────▼──────┐                           │  │  │
│  │  │                    │  Services   │                           │  │  │
│  │  │                    │             │                           │  │  │
│  │  │                    │ - Notifier  │───────▶ Slack Webhook     │  │  │
│  │  │                    │ - Scanner   │───────▶ SSH to targets    │  │  │
│  │  │                    │ - Remediate │───────▶ Agent commands    │  │  │
│  │  │                    └─────────────┘                           │  │  │
│  │  └──────────────────────────┬───────────────────────────────────┘  │  │
│  └─────────────────────────────┼──────────────────────────────────────┘  │
│                                │                                         │
│  ┌─────────────────────────────▼──────────────────────────────────────┐  │
│  │                       Volume Mount                                  │  │
│  │  /app/data ──▶ Host: ./data                                         │  │
│  │    ├── homelab.db      (SQLite database)                            │  │
│  │    ├── config.yaml     (Server definitions, thresholds)             │  │
│  │    └── ssh/            (SSH keys for ad-hoc scanning)               │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Agent Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Monitored Server                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              homelab-agent.service (systemd)           │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │              homelab-agent.py                    │  │  │
│  │  │                                                  │  │  │
│  │  │  Every 60 seconds:                               │  │  │
│  │  │  1. Collect metrics (psutil)                     │  │  │
│  │  │  2. Check service states (systemctl)             │  │  │
│  │  │  3. POST to hub API /api/v1/agents/heartbeat     │  │  │
│  │  │  4. Receive pending commands in response         │  │  │
│  │  │  5. Execute commands, report results             │  │  │
│  │  │                                                  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  Config: /etc/homelab-agent/config.yaml                      │
│    - hub_url: http://homelab-cmd.home.lan:8080               │
│    - server_id: omv-mediaserver                              │
│    - api_key: xxxxxx                                         │
│    - monitored_services: [plex, sonarr, radarr, ...]         │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

### Core Technologies

| Category | Technology | Version | Rationale |
|----------|-----------|---------|-----------|
| Language (Backend) | Python | 3.11+ | Type hints, asyncio, ecosystem, familiarity |
| Language (Frontend) | TypeScript | 5.0+ | Type safety, tooling |
| Backend Framework | FastAPI | 0.109+ | Async, Pydantic v2, OpenAPI 3.1 |
| Frontend Framework | React | 18+ | Component model, ecosystem |
| Build Tool | Vite | 5.0+ | Fast builds, ESM native |
| UI Components | Tailwind CSS | 3.4+ | Utility-first, rapid styling |
| Charts | Recharts | 2.10+ | React-native charts, simple API |
| Validation | Pydantic | 2.0+ | Runtime validation, serialisation |
| ASGI Server | Uvicorn | 0.27+ | High performance, asyncio |
| Database | SQLite | 3.40+ | Zero config, single file, adequate for scale |
| Agent Metrics | psutil | 5.9+ | Cross-platform system metrics |
| HTTP Client | httpx | 0.26+ | Async HTTP for agent |
| Configuration | PyYAML | 6.0+ | Human-readable config |
| Scheduling | APScheduler | 3.10+ | Background task scheduling |

### Build & Development

| Tool | Purpose |
|------|---------|
| uv / pip | Python package management |
| npm / pnpm | Node package management |
| pytest | Backend testing |
| pytest-asyncio | Async test support |
| Vitest | Frontend testing |
| Docker | Containerisation |
| docker-compose | Local development orchestration |

### Agent Dependencies (Minimal)

| Package | Purpose |
|---------|---------|
| psutil | System metrics collection |
| httpx | HTTP client for API calls |
| pyyaml | Configuration parsing |

---

## 4. API Contracts

### API Style

**REST** with JSON request/response bodies

- Base path: `/api/v1`
- OpenAPI 3.1.0 specification
- Swagger UI at `/api/docs`
- ReDoc at `/api/redoc`

### Authentication

**API Key** via `X-API-Key` header

- All API operations require authentication
- Key source: `HOMELAB_CMD_API_KEY` environment variable
- Default (dev): `dev-key-change-me`
- Agents use same key (single-user system)

### Endpoints Overview

#### Server Management

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/servers` | List all servers with current status |
| GET | `/api/v1/servers/{server_id}` | Get server details |
| POST | `/api/v1/servers` | Register new server |
| PUT | `/api/v1/servers/{server_id}` | Update server config |
| DELETE | `/api/v1/servers/{server_id}` | Remove server |

#### Agent Communication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/agents/heartbeat` | Agent posts metrics, receives commands |
| POST | `/api/v1/agents/command-result` | Agent reports command execution result |

#### Metrics & History

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/metrics/{server_id}` | Get metrics history (query params for range) |
| GET | `/api/v1/metrics/{server_id}/latest` | Get most recent metrics |
| GET | `/api/v1/metrics/summary` | Aggregate stats across all servers |

#### Alerts & Notifications

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/alerts` | List alerts (filterable by status, severity) |
| GET | `/api/v1/alerts/{alert_id}` | Get alert details |
| POST | `/api/v1/alerts/{alert_id}/acknowledge` | Acknowledge alert |
| POST | `/api/v1/alerts/{alert_id}/resolve` | Mark alert resolved |

#### Remediation Actions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/actions` | List pending/completed actions |
| POST | `/api/v1/actions` | Queue manual action |
| POST | `/api/v1/actions/{action_id}/approve` | Approve pending action |
| POST | `/api/v1/actions/{action_id}/reject` | Reject pending action |
| GET | `/api/v1/actions/history` | Action audit log |

#### Services

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/servers/{server_id}/services` | List services for server |
| PUT | `/api/v1/servers/{server_id}/services` | Update expected services |
| POST | `/api/v1/servers/{server_id}/services/{service}/restart` | Queue service restart |

#### Ad-hoc Scanning

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/scans` | List scan history |
| POST | `/api/v1/scans` | Initiate ad-hoc scan |
| GET | `/api/v1/scans/{scan_id}` | Get scan results |
| GET | `/api/v1/network/discover` | Discover devices on network |

#### Configuration & System

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/config` | Get system configuration |
| PUT | `/api/v1/config` | Update configuration |
| GET | `/api/v1/config/thresholds` | Get alert thresholds |
| PUT | `/api/v1/config/thresholds` | Update thresholds |
| GET | `/api/v1/system/health` | Health check |
| GET | `/api/v1/system/stats` | System statistics |

#### Cost Tracking

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/costs` | Get cost summary |
| GET | `/api/v1/costs/{server_id}` | Get server cost breakdown |
| PUT | `/api/v1/costs/config` | Update TDP values, electricity rate |

### Request/Response Schemas

#### Agent Heartbeat

**Request:**
```json
{
  "server_id": "string - unique server identifier",
  "timestamp": "ISO8601 datetime",
  "metrics": {
    "cpu_percent": "float (0-100)",
    "memory_percent": "float (0-100)",
    "memory_used_gb": "float",
    "memory_total_gb": "float",
    "disk_percent": "float (0-100)",
    "disk_used_gb": "float",
    "disk_total_gb": "float",
    "network_rx_bytes": "integer",
    "network_tx_bytes": "integer",
    "load_1m": "float",
    "load_5m": "float",
    "load_15m": "float",
    "uptime_seconds": "integer",
    "boot_time": "ISO8601 datetime"
  },
  "services": [
    {
      "name": "string",
      "status": "running | stopped | failed | unknown",
      "pid": "integer or null",
      "memory_mb": "float or null",
      "cpu_percent": "float or null"
    }
  ],
  "os_info": {
    "distribution": "string",
    "version": "string",
    "kernel": "string",
    "architecture": "string"
  },
  "updates_available": "integer",
  "security_updates": "integer"
}
```

**Response (200):**
```json
{
  "received": true,
  "server_time": "ISO8601 datetime",
  "pending_commands": [
    {
      "command_id": "uuid",
      "action": "restart_service | clear_logs | apply_updates | custom",
      "target": "string (service name or path)",
      "parameters": {},
      "queued_at": "ISO8601 datetime"
    }
  ]
}
```

#### Server Registration

**Request:**
```json
{
  "server_id": "string - unique identifier (e.g., omv-mediaserver)",
  "display_name": "string - friendly name",
  "hostname": "string",
  "ip_address": "string",
  "mac_address": "string or null",
  "tdp_watts": "integer - typical power draw",
  "location": "string or null - physical location",
  "expected_services": [
    {
      "name": "string",
      "critical": "boolean - alert if down"
    }
  ],
  "tags": ["string"]
}
```

#### Alert

**Response:**
```json
{
  "alert_id": "uuid",
  "server_id": "string",
  "severity": "critical | high | medium | low",
  "type": "service_down | disk_warning | disk_critical | memory_warning | cpu_warning | server_offline | update_available",
  "title": "string",
  "message": "string",
  "metric_value": "float or null",
  "threshold_value": "float or null",
  "status": "open | acknowledged | resolved",
  "created_at": "ISO8601 datetime",
  "acknowledged_at": "ISO8601 datetime or null",
  "resolved_at": "ISO8601 datetime or null",
  "auto_remediation": {
    "available": "boolean",
    "action_id": "uuid or null",
    "status": "pending | approved | executing | completed | failed | rejected"
  }
}
```

#### Remediation Action

**Response:**
```json
{
  "action_id": "uuid",
  "server_id": "string",
  "alert_id": "uuid or null",
  "action_type": "restart_service | clear_logs | apply_updates | custom",
  "target": "string",
  "parameters": {},
  "status": "pending | approved | executing | completed | failed | rejected",
  "auto_approve": "boolean",
  "created_at": "ISO8601 datetime",
  "approved_at": "ISO8601 datetime or null",
  "executed_at": "ISO8601 datetime or null",
  "completed_at": "ISO8601 datetime or null",
  "result": {
    "success": "boolean",
    "output": "string",
    "error": "string or null"
  }
}
```

### Error Response Format

```json
{
  "detail": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "field": "optional field name"
  }
}
```

**HTTP Status Codes:**
- `400` Bad Request - Invalid parameters
- `401` Unauthorised - Missing/invalid API key
- `404` Not Found - Resource doesn't exist
- `409` Conflict - Duplicate server_id
- `422` Validation Error - Schema validation failed
- `500` Internal Server Error

---

## 5. Data Architecture

### Data Models

#### Server (Primary Entity)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| server_id | string | PK, unique | Unique identifier (slug format) |
| display_name | string | Required | Human-friendly name |
| hostname | string | Required | Network hostname |
| ip_address | string | Required | Current IP address |
| mac_address | string | Nullable | For device identification |
| tdp_watts | integer | Default: 50 | Typical power consumption |
| location | string | Nullable | Physical location note |
| os_distribution | string | Nullable | Detected OS |
| os_version | string | Nullable | OS version |
| kernel | string | Nullable | Kernel version |
| architecture | string | Nullable | CPU architecture |
| registered_at | datetime | Auto | First seen |
| last_seen | datetime | Auto | Last heartbeat |
| status | enum | online/offline/unknown | Current state |
| tags | json | Array | Categorisation tags |

#### ExpectedService

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | Internal ID |
| server_id | string | FK → Server | Parent server |
| service_name | string | Required | systemd service name |
| critical | boolean | Default: true | Alert when down |
| created_at | datetime | Auto | When added |

#### Metric (Time-series)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | Internal ID |
| server_id | string | FK → Server, indexed | Server reference |
| timestamp | datetime | Indexed | Collection time |
| cpu_percent | float | | CPU usage |
| memory_percent | float | | RAM usage |
| memory_used_gb | float | | RAM used |
| disk_percent | float | | Disk usage |
| disk_used_gb | float | | Disk used |
| network_rx_bytes | bigint | | Network received |
| network_tx_bytes | bigint | | Network sent |
| load_1m | float | | 1-min load average |
| load_5m | float | | 5-min load average |
| load_15m | float | | 15-min load average |
| uptime_seconds | integer | | System uptime |

#### ServiceStatus

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | Internal ID |
| server_id | string | FK → Server | Server reference |
| service_name | string | Required | Service name |
| timestamp | datetime | Indexed | Check time |
| status | enum | running/stopped/failed/unknown | State |
| pid | integer | Nullable | Process ID |
| memory_mb | float | Nullable | Memory usage |
| cpu_percent | float | Nullable | CPU usage |

#### Alert

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| alert_id | uuid | PK | Unique identifier |
| server_id | string | FK → Server | Source server |
| severity | enum | critical/high/medium/low | Priority |
| type | string | Required | Alert classification |
| title | string | Required | Short description |
| message | text | Required | Full details |
| metric_value | float | Nullable | Triggering value |
| threshold_value | float | Nullable | Threshold crossed |
| status | enum | open/acknowledged/resolved | Current state |
| created_at | datetime | Auto | When raised |
| acknowledged_at | datetime | Nullable | When ack'd |
| resolved_at | datetime | Nullable | When resolved |
| notified | boolean | Default: false | Slack sent |

#### RemediationAction

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| action_id | uuid | PK | Unique identifier |
| server_id | string | FK → Server | Target server |
| alert_id | uuid | FK → Alert, nullable | Triggering alert |
| action_type | string | Required | Action category |
| target | string | Required | Service/path target |
| parameters | json | | Additional params |
| status | enum | pending/approved/executing/completed/failed/rejected | State |
| auto_approved | boolean | Default: false | Auto-approve used |
| created_at | datetime | Auto | When queued |
| approved_at | datetime | Nullable | When approved |
| executed_at | datetime | Nullable | When started |
| completed_at | datetime | Nullable | When finished |
| result_success | boolean | Nullable | Outcome |
| result_output | text | Nullable | Command output |
| result_error | text | Nullable | Error message |

#### Scan

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| scan_id | uuid | PK | Unique identifier |
| target_hostname | string | Required | Target machine |
| target_ip | string | Required | Target IP |
| scan_type | enum | full/quick | Depth |
| status | enum | pending/running/completed/failed | State |
| initiated_at | datetime | Auto | Start time |
| completed_at | datetime | Nullable | End time |
| results | json | | Collected data |

#### Config

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| key | string | PK | Config key |
| value | json | | Config value |
| updated_at | datetime | Auto | Last modified |

### Default Configuration Values

```yaml
thresholds:
  disk_warning_percent: 80
  disk_critical_percent: 90
  memory_warning_percent: 85
  cpu_warning_percent: 90
  server_offline_seconds: 180

costs:
  electricity_rate_kwh: 0.24  # GBP
  currency: GBP

notifications:
  slack_webhook_url: ""
  notify_on_critical: true
  notify_on_high: true
  notify_on_medium: false
  notify_on_low: false
  notify_on_remediation: true

remediation:
  auto_approve_enabled: false
  auto_approve_actions:
    - restart_service
    - clear_logs
  require_approval_actions:
    - apply_updates
    - custom

agent:
  heartbeat_interval_seconds: 60
  command_timeout_seconds: 300
```

### Database Schema

```sql
-- Servers
CREATE TABLE servers (
    server_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    hostname TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    mac_address TEXT,
    tdp_watts INTEGER DEFAULT 50,
    location TEXT,
    os_distribution TEXT,
    os_version TEXT,
    kernel TEXT,
    architecture TEXT,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP,
    status TEXT DEFAULT 'unknown',
    tags TEXT DEFAULT '[]'  -- JSON array
);

-- Expected services per server
CREATE TABLE expected_services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id TEXT NOT NULL REFERENCES servers(server_id) ON DELETE CASCADE,
    service_name TEXT NOT NULL,
    critical BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(server_id, service_name)
);

-- Metrics time-series
CREATE TABLE metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id TEXT NOT NULL REFERENCES servers(server_id) ON DELETE CASCADE,
    timestamp TIMESTAMP NOT NULL,
    cpu_percent REAL,
    memory_percent REAL,
    memory_used_gb REAL,
    disk_percent REAL,
    disk_used_gb REAL,
    network_rx_bytes INTEGER,
    network_tx_bytes INTEGER,
    load_1m REAL,
    load_5m REAL,
    load_15m REAL,
    uptime_seconds INTEGER
);
CREATE INDEX idx_metrics_server_time ON metrics(server_id, timestamp DESC);

-- Service status snapshots
CREATE TABLE service_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id TEXT NOT NULL REFERENCES servers(server_id) ON DELETE CASCADE,
    service_name TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    status TEXT NOT NULL,
    pid INTEGER,
    memory_mb REAL,
    cpu_percent REAL
);
CREATE INDEX idx_service_status_server_time ON service_status(server_id, timestamp DESC);

-- Alerts
CREATE TABLE alerts (
    alert_id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL REFERENCES servers(server_id) ON DELETE CASCADE,
    severity TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    metric_value REAL,
    threshold_value REAL,
    status TEXT DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    notified BOOLEAN DEFAULT 0
);
CREATE INDEX idx_alerts_status ON alerts(status, created_at DESC);

-- Remediation actions
CREATE TABLE remediation_actions (
    action_id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL REFERENCES servers(server_id) ON DELETE CASCADE,
    alert_id TEXT REFERENCES alerts(alert_id),
    action_type TEXT NOT NULL,
    target TEXT NOT NULL,
    parameters TEXT DEFAULT '{}',  -- JSON
    status TEXT DEFAULT 'pending',
    auto_approved BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    executed_at TIMESTAMP,
    completed_at TIMESTAMP,
    result_success BOOLEAN,
    result_output TEXT,
    result_error TEXT
);
CREATE INDEX idx_actions_status ON remediation_actions(status, created_at DESC);

-- Ad-hoc scans
CREATE TABLE scans (
    scan_id TEXT PRIMARY KEY,
    target_hostname TEXT NOT NULL,
    target_ip TEXT NOT NULL,
    scan_type TEXT DEFAULT 'full',
    status TEXT DEFAULT 'pending',
    initiated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    results TEXT DEFAULT '{}'  -- JSON
);

-- Configuration key-value store
CREATE TABLE config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,  -- JSON
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Data retention: metrics older than 30 days can be pruned
-- Implement via scheduled task
```

### Data Retention

| Data Type | Retention | Cleanup Strategy |
|-----------|-----------|------------------|
| Metrics | 30 days | Scheduled daily prune |
| Service status | 7 days | Scheduled daily prune |
| Alerts (resolved) | 90 days | Scheduled weekly prune |
| Actions (completed) | 90 days | Scheduled weekly prune |
| Scans | 30 days | Scheduled weekly prune |

---

## 6. Integration Patterns

### Slack Notifications

**Webhook Integration**

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│ Alert       │────────▶│ Notifier     │────────▶│ Slack       │
│ Created     │         │ Service      │  POST   │ Webhook     │
└─────────────┘         └──────────────┘         └─────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │ Format       │
                        │ Message      │
                        │ (blocks/     │
                        │  attachments)│
                        └──────────────┘
```

**Message Format:**

```json
{
  "channel": "#homelab-notifications",
  "username": "HomelabCmd",
  "icon_emoji": ":server:",
  "attachments": [
    {
      "color": "#ff0000",
      "title": "🚨 Critical: Service Down",
      "text": "Plex service has stopped on omv-mediaserver",
      "fields": [
        {"title": "Server", "value": "OMV MediaServer", "short": true},
        {"title": "Service", "value": "plex", "short": true},
        {"title": "Time", "value": "2026-01-18 14:32:00", "short": true}
      ],
      "footer": "HomelabCmd",
      "ts": 1737213120
    }
  ]
}
```

### Agent Communication Protocol

**Heartbeat Flow:**

```
┌──────────┐                              ┌──────────────┐
│  Agent   │                              │  Hub API     │
└────┬─────┘                              └──────┬───────┘
     │                                           │
     │  POST /api/v1/agents/heartbeat            │
     │  X-API-Key: xxxxx                         │
     │  {metrics, services, os_info}             │
     │──────────────────────────────────────────▶│
     │                                           │
     │                                           │ Store metrics
     │                                           │ Check thresholds
     │                                           │ Generate alerts
     │                                           │
     │  200 OK                                   │
     │  {received: true, pending_commands: [...]}│
     │◀──────────────────────────────────────────│
     │                                           │
     │  [If commands present]                    │
     │  Execute command locally                  │
     │                                           │
     │  POST /api/v1/agents/command-result       │
     │  {command_id, success, output, error}     │
     │──────────────────────────────────────────▶│
     │                                           │
     │                                           │ Update action status
     │                                           │ Notify if needed
     │                                           │
     │  200 OK                                   │
     │◀──────────────────────────────────────────│
```

### Ad-hoc Scanning

**SSH-based Collection:**

For transient machines not running the agent, the hub can perform ad-hoc scans via SSH:

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│ Dashboard    │         │ Hub API      │         │ Target       │
│ User clicks  │────────▶│ Scanner      │────────▶│ Machine      │
│ "Scan"       │         │ Service      │   SSH   │ (laptop/PC)  │
└──────────────┘         └──────────────┘         └──────────────┘
                                │
                         Runs collection
                         script remotely:
                         - System info
                         - Disk usage
                         - Installed packages
                         - Network config
                         - Docker containers
```

**Prerequisites:**
- SSH key in `/app/data/ssh/id_rsa`
- Target machine in known_hosts or host key verification disabled for LAN
- User with sudo access on target (optional, for full audit)

---

## 7. Infrastructure Approach

### Deployment Topology

**Single Docker container** serving both API and frontend:

```
┌─────────────────────────────────────────────────────────────┐
│                    Host Server (any OMV box)                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Docker Engine                             │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │       HomelabCmd container                    │  │  │
│  │  │                                                 │  │  │
│  │  │  Uvicorn:8080 ◀───── LAN traffic               │  │  │
│  │  │     │                                          │  │  │
│  │  │     ├── /api/* → FastAPI routes                │  │  │
│  │  │     └── /* → React static files                │  │  │
│  │  │                                                 │  │  │
│  │  └──────────────────┬──────────────────────────────┘  │  │
│  │                     │                                 │  │
│  │  ┌──────────────────▼──────────────────────────────┐  │  │
│  │  │            Volume Mount                         │  │  │
│  │  │  ./data  ◀─▶  /app/data                         │  │  │
│  │  │    ├── homelab.db                               │  │  │
│  │  │    ├── config.yaml                              │  │  │
│  │  │    └── ssh/                                     │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Docker Compose (Development)

```yaml
version: "3.8"

services:
  HomelabCmd:
    build: .
    container_name: HomelabCmd
    ports:
      - "8080:8080"
    environment:
      - HOMELAB_CMD_API_KEY=${HOMELAB_CMD_API_KEY:-dev-key-change-me}
      - SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL:-}
      - DATABASE_URL=sqlite:///app/data/homelab.db
    volumes:
      - ./data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/api/v1/system/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Agent Installation

**Install script** (`install-agent.sh`):

```bash
#!/bin/bash
# Run on target server:
# curl -sSL http://homelab-cmd.home.lan:8080/agent/install.sh | bash -s -- <server_id> <api_key>

SERVER_ID=$1
API_KEY=$2
HUB_URL=${3:-http://homelab-cmd.home.lan:8080}

# Install dependencies
apt-get update && apt-get install -y python3 python3-pip
pip3 install psutil httpx pyyaml --break-system-packages

# Create directories
mkdir -p /opt/homelab-agent /etc/homelab-agent

# Download agent script
curl -sSL ${HUB_URL}/agent/homelab-agent.py -o /opt/homelab-agent/homelab-agent.py
chmod +x /opt/homelab-agent/homelab-agent.py

# Create config
cat > /etc/homelab-agent/config.yaml << EOF
hub_url: ${HUB_URL}
server_id: ${SERVER_ID}
api_key: ${API_KEY}
heartbeat_interval: 60
monitored_services: []
EOF

# Create systemd service
cat > /etc/systemd/system/homelab-agent.service << EOF
[Unit]
Description=HomelabCmd Monitoring Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 /opt/homelab-agent/homelab-agent.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
systemctl daemon-reload
systemctl enable homelab-agent
systemctl start homelab-agent

echo "Agent installed and running. Configure monitored services in /etc/homelab-agent/config.yaml"
```

### Environment Strategy

| Environment | Purpose | Characteristics |
|-------------|---------|-----------------|
| Development | Local development | docker-compose, hot reload, dev API key |
| Production | Live homelab | Single container, env-configured secrets |

### Scaling Strategy

**Vertical scaling only** - Increase container resources

Not designed for horizontal scaling due to:
- SQLite (single-writer)
- In-memory scheduler state
- Suitable for homelab scale (5-50 servers)

**Future:** PostgreSQL backend would enable clustering if needed

### Disaster Recovery

| Aspect | Implementation |
|--------|----------------|
| Backup strategy | SQLite database file + config.yaml |
| Backup frequency | Daily (cron on host) |
| RTO | Deploy new container, restore data (~10 min) |
| RPO | Last backup |
| Agent recovery | Re-run install script |

---

## 8. Security Considerations

### Threat Model

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| Unauthorised API access | Medium | High | API key authentication |
| Agent impersonation | Low | Medium | API key per agent (future: mTLS) |
| Command injection via agent | Low | Critical | Whitelist allowed commands |
| SQL injection | Low | High | Parameterised queries (SQLAlchemy) |
| Data exfiltration | Low | Low | LAN-only deployment |
| DoS on hub | Low | Medium | No rate limiting (acceptable for LAN) |

### Security Controls

| Control | Implementation |
|---------|----------------|
| Authentication | API key via X-API-Key header |
| Authorisation | Single-user, all-or-nothing |
| Encryption in transit | Optional (recommend Nginx Proxy Manager for HTTPS) |
| Command whitelist | Agent only executes predefined action types |
| Input validation | Pydantic models for all inputs |
| Secrets management | Environment variables |

### Agent Command Whitelist

Agents will only execute these predefined commands:

| Action Type | Allowed Commands |
|-------------|------------------|
| restart_service | `systemctl restart {service}` |
| clear_logs | `journalctl --vacuum-time=7d` or `rm /var/log/{target}` |
| apply_updates | `apt-get update && apt-get upgrade -y` |
| custom | Explicitly configured per-server scripts only |

---

## 9. Performance Requirements

### Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Dashboard load time | < 2s | Browser DevTools |
| API response (p50) | < 100ms | API logs |
| API response (p95) | < 500ms | API logs |
| Agent heartbeat processing | < 50ms | API logs |
| Availability | 99% | Uptime monitoring |

### Capacity Planning

| Metric | Current | Projected |
|--------|---------|-----------|
| Monitored servers | ~10 | ~25 (1 year) |
| Metrics per day | ~14,400 (10 servers × 1440 min) | ~36,000 |
| Database size | ~50MB/month | ~150MB/month |
| Requests/day | ~15,000 | ~40,000 |

**Scaling triggers:**
- Database > 1GB → Consider archiving/compression
- Servers > 50 → Consider PostgreSQL migration
- Query latency > 500ms → Add indices, optimise queries

---

## 10. UI/UX Design

### Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🏠 HomelabCmd                              [Settings] [⚡ 3 Alerts]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Summary Bar                                                          ││
│  │ [🟢 8 Online] [🔴 1 Offline] [⚠️ 3 Warnings] [💰 £12.45/day est.]   ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────────┤
│  │ Servers                                           [+ Add] [🔍 Scan]  │
│  ├──────────────────────────────────────────────────────────────────────┤
│  │                                                                      │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │  │🟢 HomeServer │ │🟢 MediaSrv  │ │🟢 AIServer1 │ │🔴 BackupSrv │   │
│  │  │ CPU: 12%    │ │ CPU: 45%    │ │ CPU: 78%    │ │ OFFLINE     │   │
│  │  │ RAM: 45%    │ │ RAM: 62%    │ │ RAM: 89%    │ │ Last: 5m ago│   │
│  │  │ Disk: 67%   │ │ Disk: 82% ⚠️│ │ Disk: 34%   │ │             │   │
│  │  │ ↑ 42d       │ │ ↑ 12d       │ │ ↑ 3d        │ │             │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│  │                                                                      │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │  │🟢 CloudSrv1 │ │🟢 WebSrv1   │ │🟢 Pi-hole   │ │🟢 Pi-hole2  │   │
│  │  │ ...         │ │ ...         │ │ ...         │ │ ...         │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│  │                                                                      │
│  └──────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────────┤
│  │ Recent Alerts                                        [View All →]    │
│  ├──────────────────────────────────────────────────────────────────────┤
│  │ 🔴 CRITICAL  BackupServer offline                    2 min ago  [!]  │
│  │ 🟠 HIGH      MediaServer disk at 82%                 15 min ago [✓]  │
│  │ 🟡 MEDIUM    AIServer1 memory at 89%                 1 hr ago   [✓]  │
│  └──────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────────┤
│  │ Pending Actions                                      [View All →]    │
│  ├──────────────────────────────────────────────────────────────────────┤
│  │ 🔧 Restart plex on MediaServer          [Approve] [Reject] [Auto]   │
│  │ 📦 Apply 12 updates on HomeServer       [Approve] [Reject]          │
│  └──────────────────────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────────────────────┘
```

### Server Detail View

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back    OMV MediaServer                     [Edit] [Services] [Logs]│
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Status: 🟢 Online    Uptime: 12d 4h 32m    Last seen: 30s ago          │
│  IP: 192.168.1.42     OS: Debian 12         Kernel: 6.1.0-17-amd64      │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Resource Usage (24h)                                                │ │
│  │ ┌──────────────────────────────────────────────────────────────┐   │ │
│  │ │     CPU %        RAM %         Disk %        Network         │   │ │
│  │ │   ▂▃▄▃▂▁▂▃    ▅▅▆▆▅▅▆▆     ▇▇▇▇▇▇▇▇      ▁▂▃▂▁▂▃▄▃▂       │   │ │
│  │ │   45%          62%           82% ⚠️        ↓1.2GB ↑340MB    │   │ │
│  │ └──────────────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌─────────────────────────────────┐ ┌────────────────────────────────┐ │
│  │ Services                        │ │ Cost Estimate                  │ │
│  │                                 │ │                                │ │
│  │ 🟢 plex          running        │ │ TDP: 65W                       │ │
│  │ 🟢 sonarr        running        │ │ Daily: £0.37                   │ │
│  │ 🟢 radarr        running        │ │ Monthly: £11.23                │ │
│  │ 🟢 transmission  running        │ │ Yearly: £134.78                │ │
│  │ 🔴 jackett       stopped   [▶]  │ │                                │ │
│  └─────────────────────────────────┘ └────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Recent Alerts for this server                                       │ │
│  │ 🟠 Disk usage at 82% - 15 min ago - Acknowledged                    │ │
│  │ 🔴 jackett service stopped - 2 hr ago - Auto-remediated ✓           │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Architecture Decision Records

### ADR-001: SQLite Storage

**Status:** Accepted

**Context:** Need to store metrics, alerts, and configuration. Options: PostgreSQL, SQLite, file-based (JSON/CSV).

**Decision:** Use SQLite for all persistent storage.

**Consequences:**
- Positive: Zero configuration, single file backup, adequate performance for scale
- Positive: No external database container needed
- Negative: Single-writer limitation (acceptable for single hub)
- Negative: No horizontal scaling without migration
- Neutral: Suitable for 5-50 servers

---

### ADR-002: Hybrid Agent Communication

**Status:** Accepted

**Context:** Need agents to report metrics and receive commands. Options: push-only, pull-only, hybrid, WebSocket.

**Decision:** Hybrid approach - agents push metrics via HTTP POST, receive pending commands in response.

**Consequences:**
- Positive: Simple HTTP, no persistent connections
- Positive: Works through NAT, firewalls
- Positive: Commands delivered with minimal latency (within heartbeat interval)
- Negative: Command latency up to heartbeat interval (60s default)
- Neutral: Single endpoint handles both directions

---

### ADR-003: React SPA Frontend

**Status:** Accepted

**Context:** Need dashboard UI. Options: server-rendered (Jinja2), HTMX, React SPA, Vue SPA.

**Decision:** React SPA with Vite build, served as static files from FastAPI.

**Consequences:**
- Positive: Rich interactivity, component ecosystem
- Positive: Familiar to user (stated preference)
- Positive: Clear API contract (frontend consumes REST API)
- Negative: Additional build step
- Neutral: Slightly larger initial bundle than server-rendered

---

### ADR-004: Staged Remediation with Auto-Approve Option

**Status:** Accepted

**Context:** Need to balance automation with control for remediation actions.

**Decision:** Default to requiring approval, with configurable auto-approve mode per action type.

**Consequences:**
- Positive: Safe default (human in loop)
- Positive: Can enable full automation when confident
- Positive: Granular control (auto-approve restarts but not updates)
- Negative: More complex state machine
- Neutral: Matches user's request for "auto approve mode when ready"

---

### ADR-005: Slack for Notifications

**Status:** Accepted

**Context:** Need to notify user of alerts and remediations. Options: Email, Slack, Discord, Pushover, Home Assistant.

**Decision:** Slack webhook integration to existing HomeLab Notifications channel.

**Consequences:**
- Positive: Matches existing UptimeKuma setup
- Positive: Simple webhook, no OAuth
- Positive: Rich message formatting with attachments
- Negative: Slack-only initially
- Neutral: Additional channels can be added later

---

## 12. Implementation Phases

### Phase 1: Core Infrastructure (MVP)

**Duration:** 2-3 weeks

**Deliverables:**
- FastAPI backend with SQLite
- Basic React dashboard (server list, status cards)
- Agent script with heartbeat
- Metric collection and storage
- Server registration API

**Exit Criteria:**
- Can register servers
- Agents send heartbeats
- Dashboard shows server status
- Metrics stored and displayed

---

### Phase 2: Alerting & Notifications

**Duration:** 1-2 weeks

**Deliverables:**
- Threshold configuration
- Alert generation on threshold breach
- Alert management (acknowledge, resolve)
- Slack notification integration
- Alert history view

**Exit Criteria:**
- Alerts generated automatically
- Slack notifications working
- Can manage alerts from dashboard

---

### Phase 3: Service Monitoring

**Duration:** 1-2 weeks

**Deliverables:**
- Expected service configuration per server
- Service status collection in agent
- Service status display
- Service-down alerts
- Manual service restart from dashboard

**Exit Criteria:**
- Can define expected services
- Service status visible
- Alerts on service failure

---

### Phase 4: Remediation Engine

**Duration:** 2 weeks

**Deliverables:**
- Remediation action queue
- Approval workflow
- Agent command execution
- Command result reporting
- Auto-approve configuration
- Remediation history/audit log

**Exit Criteria:**
- Can queue remediation actions
- Approval workflow functional
- Auto-approve mode works
- Full audit trail

---

### Phase 5: Cost Tracking & Polish

**Duration:** 1 week

**Deliverables:**
- TDP configuration per server
- Electricity rate configuration
- Cost calculations (daily/monthly/yearly)
- Cost dashboard widget
- UI polish and refinements

**Exit Criteria:**
- Cost estimates displayed
- Configurable electricity rate

---

### Phase 6: Ad-hoc Scanning

**Duration:** 1-2 weeks

**Deliverables:**
- Network device discovery
- SSH-based scanner
- Scan initiation from dashboard
- Scan results storage and display
- Transient device inventory

**Exit Criteria:**
- Can discover devices on network
- Can scan non-agent machines
- Scan results visible

---

## 13. Open Technical Questions

- [ ] **Q:** Should metrics be aggregated for long-term storage (hourly/daily rollups)?
  **Context:** Raw per-minute metrics grow quickly
  **Options:** Keep raw 30 days + aggregated forever, or just prune

- [ ] **Q:** Agent auto-update mechanism?
  **Context:** Updating agents across fleet manually is tedious
  **Options:** Self-update via hub API, Ansible, manual

- [ ] **Q:** Multi-disk monitoring?
  **Context:** OMV servers have multiple drives
  **Options:** Monitor root only, monitor all mounts, configurable

- [ ] **Q:** Docker container monitoring on agents?
  **Context:** Many services run in Docker
  **Options:** Include docker stats in agent, separate integration

---

## 14. Implementation Constraints

### Must Have

- Python 3.11+ compatibility
- Single Docker container deployment
- SQLite database (self-contained)
- Works on LAN without internet
- OpenAPI documentation
- Agent works on Debian/Ubuntu/Raspberry Pi OS

### Should Have

- Responsive dashboard (mobile-friendly)
- Dark mode support
- Data export capability
- Health check endpoint

### Won't Have (This Version)

- Multi-user authentication
- External/cloud deployment
- Windows/macOS agents
- pfSense monitoring
- Mobile native app
- Real-time WebSocket updates
- Historical trend analysis/ML

---

## 15. Server Inventory (Initial)

| Server ID | Display Name | Type | TDP (est.) | Expected Services |
|-----------|--------------|------|------------|-------------------|
| omv-homeserver | OMV HomeServer | OMV | 50W | smbd, docker |
| omv-backupserver | OMV BackupServer | OMV | 40W | smbd, rsync |
| omv-documentserver | OMV DocumentServer | OMV | 40W | smbd |
| omv-mediaserver | OMV MediaServer | OMV | 65W | plex, sonarr, radarr, transmission, jackett |
| omv-cloudserver1 | OMV CloudServer1 | OMV | 50W | smbd, nextcloud (docker) |
| omv-webserver1 | OMV WebServer1 | OMV | 45W | nginx, n8n (docker) |
| omv-webserver2 | OMV Webserver 2 | OMV | 45W | nginx |
| omv-homeautoserver | OMV HomeAutoServer | OMV | 50W | homeassistant (docker) |
| omv-aiserver1 | OMV AIServer1 | OMV | 100W | ollama, docker |
| pihole-master | Pi-hole Master | RPi | 5W | pihole-FTL |
| pihole-backup | Pi-hole Backup | RPi | 5W | pihole-FTL |

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-18 | 1.0.0 | Initial TRD draft |
