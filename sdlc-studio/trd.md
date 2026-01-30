# Technical Requirements Document

**Project:** HomelabCmd
**Version:** 2.1.0
**Status:** Active
**Last Updated:** 2026-01-29
**PRD Reference:** [PRD](prd.md)

---

## v2.0 Implementation Status

> **Note:** This TRD documents the target v2.0 architecture. Not all features are implemented.
> See status markers below: ✅ Complete, 🚧 Partial, 📋 Planned

**Architecture:**
- ✅ Hybrid model: Agent push (metrics) + SSH execution (commands)
- ✅ Tailscale mesh network connectivity with dual-mode support
- 🚧 Synchronous command execution - SSH executor done, API endpoints planned

**v2.0 Feature Status:**

| Feature | Status | Epic | Notes |
|---------|--------|------|-------|
| Tailscale Integration | ✅ Complete | EP0008 | Device discovery, import, connectivity modes |
| Per-Host Credentials | ✅ Complete | EP0015 | Encrypted storage, per-server overrides |
| Unified Discovery | ✅ Complete | EP0016 | Combined network/Tailscale discovery |
| Workstation Management | ✅ Complete | EP0009 | Machine types, intermittent availability |
| SSH Executor Service | ✅ Complete | EP0013 | Connection pooling, TOFU, retry logic |
| Synchronous Command API | 📋 Planned | EP0013 | Endpoints not implemented |
| Command Audit Trail | 📋 Planned | EP0013 | Model and endpoints not implemented |
| Configuration Management | 🚧 In Progress | EP0010 | Config packs ✅, compliance checking ✅, diff view ✅, apply pack ✅, dashboard widget 📋 |
| Widget-Based Detail View | 📋 Planned | EP0012 | react-grid-layout not installed |
| Dashboard Card Reordering | 📋 Planned | EP0011 | Persistence model not implemented |
| Docker Container Monitoring | 📋 Planned | EP0014 | Endpoints not implemented |
| Desktop UX Improvements | 🚧 Partial | EP0017 | Basic indicators done, search/sparklines planned |

**Dependency Note:** react-grid-layout (required for EP0011/EP0012) is not yet installed.

---

## 1. Executive Summary

### Purpose
This Technical Requirements Document describes the architecture, technology stack, data models, and infrastructure for HomelabCmd v2.0 - a self-hosted homelab monitoring and management platform providing real-time server and workstation status, synchronous command execution, configuration management, cost tracking, and Tailscale-native connectivity.

### Scope

**v1.0 (Complete) ✅:**
- Dashboard web application (React SPA)
- API server architecture and endpoints (FastAPI)
- Lightweight monitoring agent for Linux servers
- Data storage and metrics collection
- Notification system (Slack integration)
- Async remediation engine with approval workflow
- Cost estimation calculations
- Ad-hoc device scanning

**v2.0 (New):**
- Tailscale mesh network integration
- Workstation monitoring (intermittent availability)
- Synchronous SSH command execution (<5s latency)
- Configuration compliance checking and management
- Widget-based customisable detail views
- Drag-and-drop dashboard card reordering
- Docker container monitoring
- Credential encryption (Tailscale tokens, SSH keys)
- Dual connectivity mode (Tailscale vs Direct SSH)

**Not Covered:**
- pfSense/FreeBSD monitoring (future consideration)
- Windows/macOS agent support
- External/cloud deployment
- Multi-user authentication
- Mobile native applications

### Key Decisions

**v1.0 Decisions (Retained):**
- **SQLite storage** for simplicity and self-contained deployment
- **React SPA frontend** with FastAPI backend in single container
- **Pre-defined service expectations** per server for targeted alerting
- **Slack webhooks** for notifications

**v2.0 Decisions (New):**
- **Hybrid architecture** - agents push metrics (60s), hub SSH for commands (immediate)
- **Remove async command channel** from agents (reliability issues, 2-4min latency)
- **Tailscale mesh network** for stable, encrypted connectivity
- **Dual connectivity mode** - Tailscale Mode (with API token) vs Direct SSH Mode (fallback)
- **Machine types** - server (expected online) vs workstation (intermittent)
- **Credential encryption** - AES-256-GCM with HOMELABCMD_ENCRYPTION_KEY
- **Default SSH user** - `homelabcmd` (overridable per machine)
- **Configuration packs** - Base, Developer Lite, Developer Max (all optional)
- **Backend preference storage** - dashboard card order, widget layouts synced across devices
- **react-grid-layout** for widget customisation

---

## 2. Project Classification

**Project Type:** web_application

**Classification Rationale:** HomelabCmd is a web-based monitoring dashboard with a FastAPI backend serving a React SPA frontend. It follows the hub-and-spoke model with lightweight Python agents reporting metrics to a central hub server. The system provides real-time server status, alerting, and remediation capabilities through a unified web interface.

**Architecture Implications:**

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Default Pattern | Layered monolith | Per reference-architecture.md for web applications |
| Pattern Used | Layered monolith with agent microservices | Agents are separate processes for metrics collection |
| Deviation Rationale | Agents share the same codebase and deployment model but run independently on monitored servers |
| Frontend | React SPA | Single-page application with client-side routing |
| Backend | FastAPI REST API | Async Python with Pydantic validation |
| Database | SQLite | Self-contained, suitable for homelab scale (5-50 servers) |
| Communication | HTTP REST + SSH | Agents push via HTTP; commands execute via SSH |

---

## 3. Architecture Overview

### System Context

HomelabCmd v2.0 monitors a fleet of Linux servers, workstations, and Raspberry Pi devices connected via Tailscale mesh network:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        Tailscale Mesh Network                                 │
│                     (Encrypted WireGuard connectivity)                        │
│                                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐            │
│  │ OMV HomeServer   │  │ OMV MediaServer  │  │ OMV AIServer1    │            │
│  │ Machine Type:    │  │ Machine Type:    │  │ Machine Type:    │            │
│  │ Server (24/7)    │  │ Server (24/7)    │  │ Server (24/7)    │            │
│  │                  │  │                  │  │                  │            │
│  │ [agent:metrics]  │  │ [agent:metrics]  │  │ [agent:metrics]  │            │
│  │ homelabcmd user  │  │ homelabcmd user  │  │ homelabcmd user  │            │
│  │ .tail-xyz.ts.net │  │ .tail-xyz.ts.net │  │ .tail-xyz.ts.net │            │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘            │
│           │                     │                     │                       │
│           │   Metrics Push      │                     │                       │
│           │   (60s interval)    │                     │                       │
│           │                     │                     │                       │
│           └──────────┬──────────┴──────────┬──────────┘                       │
│                      │                     │                                  │
│                      │                     │   SSH Commands                   │
│                      │                     │   (<5s latency)                  │
│                      │                     │                                  │
│                ┌─────▼─────────────────────▼──────┐                           │
│                │      HOME-LAB-HUB v2.0           │                           │
│                │      Docker Container            │                           │
│                │                                  │──────▶ Slack Notifications│
│                │  - FastAPI + SSH Executor        │                           │
│                │  - React SPA + Widgets           │◀────── Tailscale API      │
│                │  - SQLite + Encrypted Creds      │                           │
│                │  - Tailscale Service             │                           │
│                │  homelabcmd-hub.tail-xyz.ts.net  │                           │
│                └──────────────────────────────────┘                           │
│                           ▲                                                   │
│                           │ Metrics Push (60s)                                │
│                           │ (when online)                                     │
│                           │                                                   │
│  ┌────────────────────────┴──────────┬──────────────────┐                    │
│  │                                   │                  │                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐            │
│  │ StudyPC          │  │ LaptopPro        │  │ Pi-hole Master   │            │
│  │ Machine Type:    │  │ Machine Type:    │  │ Machine Type:    │            │
│  │ Workstation      │  │ Workstation      │  │ Server (24/7)    │            │
│  │ (intermittent)   │  │ (intermittent)   │  │                  │            │
│  │                  │  │                  │  │                  │            │
│  │ [agent:metrics]  │  │ [agent:metrics]  │  │ [agent:metrics]  │            │
│  │ homelabcmd user  │  │ homelabcmd user  │  │ homelabcmd user  │            │
│  │ .tail-xyz.ts.net │  │ .tail-xyz.ts.net │  │ .tail-xyz.ts.net │            │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘            │
│  Last seen: 3h ago      Last seen: 12h ago    Status: Online                 │
│  (No offline alert)     (No offline alert)    (Alerts if offline)            │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘

**v2.0 Key Changes:**
- All machines connected via Tailscale mesh (encrypted WireGuard)
- Agents push metrics only (60s interval) - no command execution
- Hub SSH to machines for commands (immediate, <5s latency)
- Workstation support (intermittent availability, no offline alerts)
- MagicDNS hostnames (*.tail-xyz.ts.net) for stable addressing
```

### Architecture Pattern

**v1.0:** Monolith with Agent Fleet (push metrics + async command polling) ✅

**v2.0:** Hybrid - Agent Metrics Push + SSH Command Execution

**Changes from v1.0:**
- Agents simplified: metrics push only (no command execution complexity)
- Commands executed synchronously via SSH from hub (<5s vs 2-4min)
- Tailscale mesh network for stable connectivity
- Dual mode: Tailscale API discovery + SSH OR Direct SSH with mDNS/scan

**Rationale:**
- Simple deployment (single Docker container for hub)
- Lightweight agents (simplified to metrics only)
- Self-contained data (SQLite, no external dependencies)
- Suitable for homelab scale (5-50 servers + 1-4 workstations)
- Easy backup (database file + config)
- Immediate command feedback vs async complexity
- Encrypted connectivity via Tailscale mesh

### Component Overview

| Component | Responsibility | Technology | Version |
|-----------|---------------|------------|---------|
| Dashboard | Server/workstation status visualisation, management UI, widget customisation | React + Vite + react-grid-layout | v1.0 + v2.0 |
| API Server | REST endpoints, business logic, scheduling | FastAPI + Uvicorn | v1.0 + v2.0 |
| Agent | Metrics collection (simplified - no command execution) | Python script + systemd | v1.0 → v2.0 (simplified) |
| Database | Metrics storage, configuration, audit log, credentials | SQLite | v1.0 + v2.0 |
| Notifier | Alert dispatch to Slack | Slack Webhook API | v1.0 |
| Remediation Engine | Action approval and execution | FastAPI background tasks | v1.0 (deprecated in v2.0) |
| Scanner | Ad-hoc device discovery and audit | SSH + Python | v1.0 |
| **SSH Executor** | **Synchronous command execution via SSH** | **asyncssh + connection pooling** | **v2.0 (new)** |
| **Tailscale Service** | **Device discovery, API integration** | **httpx + Tailscale API** | **v2.0 (new)** |
| **Credential Manager** | **Encrypt/decrypt tokens and SSH keys** | **cryptography (Fernet)** | **v2.0 (new)** |
| **Configuration Manager** | **Compliance checking, diff generation, config application** | **SSH + YAML** | **v2.0 (new)** |
| **Widget System** | **Customisable detail view layouts** | **react-grid-layout** | **v2.0 (new)** |

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

## 4. Technology Stack

### Core Technologies

| Category | Technology | Version | Rationale |
|----------|-----------|---------|-----------|
| Language (Backend) | Python | 3.11+ | Type hints, asyncio, ecosystem, familiarity |
| Language (Frontend) | TypeScript | 5.0+ | Type safety, tooling |
| Backend Framework | FastAPI | >=0.109.0 | Async, Pydantic v2, OpenAPI 3.1 |
| Frontend Framework | React | 18+ | Component model, ecosystem |
| Build Tool | Vite | 5.0+ | Fast builds, ESM native |
| UI Components | Tailwind CSS | 3.4+ | Utility-first, rapid styling |
| Charts | Recharts | 2.10+ | React-native charts, simple API |
| **Widget Layout (v2.0)** | **react-grid-layout** | **>=1.4.0** | **Drag-and-drop widget customisation** |
| **Date Formatting (v2.0)** | **date-fns** | **>=3.0.0** | **Relative time for workstation "Last seen"** |
| Validation | Pydantic | >=2.0.0 | Runtime validation, serialisation |
| Settings | Pydantic Settings | >=2.0.0 | Environment variable loading |
| ASGI Server | Uvicorn | >=0.27.0 | High performance, asyncio (with standard extras) |
| ORM | SQLAlchemy | >=2.0.0 | Async support, type hints |
| Async SQLite | aiosqlite | >=0.19.0 | Async SQLite driver |
| Database | SQLite | 3.40+ | Zero config, single file, adequate for scale |
| Migrations | Alembic | >=1.13.0 | Version-controlled schema changes |
| HTTP Client | httpx | >=0.26.0 | Async HTTP for agent and API calls |
| SSH Client (v1.0) | Paramiko | >=3.4.0 | SSH connections for scanning |
| **SSH Client (v2.0)** | **Paramiko** | **>=3.4.0** | **SSH for command execution (async via thread pool), connection pooling** |
| **Encryption (v2.0)** | **cryptography** | **>=41.0.0** | **AES-256-GCM credential encryption (Fernet)** |
| Scheduling | APScheduler | >=4.0.0a1 | Background task scheduling (async-first) |

### Build & Development

| Tool | Purpose |
|------|---------|
| uv / pip | Python package management |
| npm / pnpm | Node package management |
| pytest | Backend testing (>=8.0.0) |
| pytest-asyncio | Async test support (>=0.23.0) |
| pytest-cov | Coverage reporting (>=4.1.0) |
| schemathesis | OpenAPI property-based testing (>=3.28.0) |
| Ruff | Linting and formatting (>=0.1.0) |
| Vitest | Frontend testing |
| Playwright | Frontend E2E testing |
| Docker | Containerisation |
| docker-compose | Local development orchestration |

### AI-Assisted Development Requirements

When using AI assistants (Claude, etc.) for code implementation in this project:

#### Context7 Mandatory

**Before writing any code**, query Context7 for current documentation of external libraries:

```
1. mcp__context7__resolve-library-id({ libraryName: "library-name", query: "what I need to do" })
2. mcp__context7__query-docs({ libraryId: "/org/project", query: "specific feature needed" })
```

**Required libraries to check:**

| Library | Context7 ID | Check Before |
|---------|-------------|--------------|
| FastAPI | `/tiangolo/fastapi` | Any API route, dependency injection, middleware |
| Pydantic | `/pydantic/pydantic` | Schema definitions, validation, Field usage |
| SQLAlchemy | `/sqlalchemy/sqlalchemy` | Model definitions, async queries, relationships |
| React | `/facebook/react` | Hooks, component patterns, state management |
| Tailwind CSS | `/tailwindlabs/tailwindcss` | Utility classes, responsive design |
| Recharts | `/recharts/recharts` | Chart components, data formatting |
| Vitest | `/vitest-dev/vitest` | Test patterns, mocking, assertions |
| Playwright | `/microsoft/playwright` | E2E test patterns, selectors, assertions |

#### Rationale

- Library APIs change frequently; training data may be stale
- Context7 provides current, version-specific documentation
- Reduces formatting errors, deprecated API usage, and lint issues
- Ensures code follows current best practices for each library

#### Enforcement

AI assistants MUST:
1. Query Context7 for each external library used in new code
2. Reference the queried documentation when implementing features
3. Not rely solely on training data for library-specific patterns

### Agent Dependencies (Minimal)

| Package | Purpose |
|---------|---------|
| psutil | System metrics collection |
| httpx | HTTP client for API calls |
| pyyaml | Configuration parsing |

---

## 5. API Contracts

### API Style

**REST** with JSON request/response bodies

- Base path: `/api/v1`
- OpenAPI 3.1.0 specification
- Swagger UI at `/api/docs`
- ReDoc at `/api/redoc`

### 4.1 OpenAPI 3.1 Requirements

#### Specification Compliance

The API MUST generate a valid OpenAPI 3.1.0 specification with:

| Requirement | Implementation |
|-------------|----------------|
| Version | `openapi: "3.1.0"` |
| Info.title | "HomelabCmd API" |
| Info.version | Semantic version (e.g., "1.0.0") |
| Info.description | Multi-line markdown with feature summary |
| Info.contact | Project name and GitHub URL |
| Info.license | MIT with SPDX identifier |
| Servers | At minimum `[{"url": "/", "description": "Current server"}]` |

#### Operation Requirements

Every endpoint MUST have:

| Element | Convention | Example |
|---------|------------|---------|
| operationId | `{verb}_{resource}` | `list_servers`, `create_server`, `acknowledge_alert` |
| tags | Resource group | `["Servers"]`, `["Alerts"]` |
| summary | Brief description | "List all registered servers" |
| responses | All possible status codes | 200, 201, 400, 401, 404, 409, 422 |

**Valid operation verbs:** `list`, `get`, `create`, `update`, `delete`, plus action verbs like `acknowledge`, `resolve`, `test`

#### Security Scheme

```yaml
components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key
      description: API key for authentication
security:
  - ApiKeyAuth: []
```

Exception: `/api/v1/system/health` requires no authentication.

#### Tag Descriptions

Every tag MUST have a description:

| Tag | Description |
|-----|-------------|
| System | System health and status. No authentication required. |
| Servers | Server registration, configuration, and lifecycle management. |
| Agents | Agent heartbeat and metrics ingestion. |
| Metrics | Historical metrics and time-series data. |
| Configuration | System settings, thresholds, and notifications. |
| Alerts | Alert viewing, acknowledgement, and resolution. |

#### Schema Requirements

All Pydantic schemas MUST include:

- **Field descriptions** for every field
- **Examples** for request schemas (via `json_schema_extra` or `Field(examples=[...])`)
- **Constraints** documented (min/max values, patterns)

#### Error Response Schema

All error responses MUST use consistent format:

```json
{
  "detail": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

Standard error codes:
- `UNAUTHORIZED` (401)
- `NOT_FOUND` (404)
- `CONFLICT` (409)
- `INVALID_STATE` (400)
- `VALIDATION_ERROR` (422)

#### Testing Requirements

OpenAPI compliance MUST be validated by automated tests:

- Version is 3.1.x
- All operations have operationId
- All authenticated endpoints document 401
- All endpoints with path params document 404
- Tags have descriptions
- Security scheme is defined

### Authentication

**API Key** via `X-API-Key` header

- All API operations require authentication
- Key source: `HOMELAB_CMD_API_KEY` environment variable
- Default (dev): `dev-key-change-me`
- Agents use same key (single-user system)

### Endpoints Overview

#### Server Management

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/servers` | List all servers with current status | Yes |
| GET | `/api/v1/servers/{server_id}` | Get server details | Yes |
| POST | `/api/v1/servers` | Register new server | Yes |
| PUT | `/api/v1/servers/{server_id}` | Update server config | Yes |
| DELETE | `/api/v1/servers/{server_id}` | Remove server | Yes |
| PUT | `/api/v1/servers/{server_id}/pause` | Enable maintenance mode | Yes |
| PUT | `/api/v1/servers/{server_id}/unpause` | Disable maintenance mode | Yes |

#### Agent Communication

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/v1/agents/heartbeat` | Agent posts metrics, receives commands | Yes |
| POST | `/api/v1/agents/command-result` | Agent reports command execution result | Yes |

#### Metrics & History

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/servers/{server_id}/metrics` | Get metrics history (query params for range) | Yes |

*Note: Latest metrics included in server response. Summary endpoint deferred.*

#### Alerts & Notifications

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/alerts` | List alerts (filterable by status, severity) | Yes |
| GET | `/api/v1/alerts/{alert_id}` | Get alert details | Yes |
| POST | `/api/v1/alerts/{alert_id}/acknowledge` | Acknowledge alert | Yes |
| POST | `/api/v1/alerts/{alert_id}/resolve` | Mark alert resolved | Yes |

#### Remediation Actions

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/actions` | List actions (filterable by status) | Yes |
| GET | `/api/v1/actions/{action_id}` | Get action details | Yes |
| POST | `/api/v1/actions` | Queue manual action | Yes |
| POST | `/api/v1/actions/{action_id}/approve` | Approve pending action | Yes |
| POST | `/api/v1/actions/{action_id}/reject` | Reject pending action | Yes |

#### Services

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/servers/{server_id}/services` | List expected services for server | Yes |
| POST | `/api/v1/servers/{server_id}/services` | Add expected service | Yes |
| PUT | `/api/v1/servers/{server_id}/services/{service_name}` | Update expected service | Yes |
| DELETE | `/api/v1/servers/{server_id}/services/{service_name}` | Remove expected service | Yes |
| POST | `/api/v1/servers/{server_id}/services/{service_name}/restart` | Queue service restart action | Yes |

#### Server Extensions

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/servers/{server_id}/actions` | List actions for server | Yes |
| GET | `/api/v1/servers/{server_id}/packages` | Get pending package updates | Yes |

#### Ad-hoc Scanning

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/scans` | List recent scans | Yes |
| POST | `/api/v1/scans` | Initiate scan on remote host | Yes |
| GET | `/api/v1/scans/{scan_id}` | Get scan status and results | Yes |
| DELETE | `/api/v1/scans/{scan_id}` | Delete a scan | Yes |
| POST | `/api/v1/scan/test` | Test SSH connection | Yes |
| GET | `/api/v1/settings/ssh` | Get SSH configuration | Yes |
| PUT | `/api/v1/settings/ssh` | Update SSH configuration | Yes |

#### Network Discovery

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/v1/discovery` | Start network discovery | Yes |
| GET | `/api/v1/discovery/{discovery_id}` | Get discovery status and results | Yes |
| GET | `/api/v1/settings/discovery` | Get discovery settings | Yes |
| PUT | `/api/v1/settings/discovery` | Update discovery settings | Yes |

#### Configuration & System

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/config` | Get all system configuration | Yes |
| PUT | `/api/v1/config/thresholds` | Update alert thresholds | Yes |
| PUT | `/api/v1/config/notifications` | Update notification settings | Yes |
| POST | `/api/v1/config/test-webhook` | Test Slack webhook URL | Yes |
| GET | `/api/v1/config/cost` | Get cost configuration | Yes |
| PUT | `/api/v1/config/cost` | Update cost configuration | Yes |
| GET | `/api/v1/system/health` | Health check | No |

#### Cost Tracking

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/costs/summary` | Get estimated electricity cost summary | Yes |
| GET | `/api/v1/costs/breakdown` | Get per-server cost breakdown | Yes |

---

## v2.0 New API Endpoints

> **Implementation Status Legend:** ✅ Implemented | 📋 Planned

#### Tailscale Integration (v2.0) - ✅ Implemented

| Method | Path | Description | Auth | Status |
|--------|------|-------------|------|--------|
| GET | `/api/v1/tailscale/devices` | List discovered Tailscale devices | Yes | ✅ |
| POST | `/api/v1/tailscale/import` | Import Tailscale device as machine | Yes | ✅ |
| GET | `/api/v1/tailscale/status` | Get Tailscale connection status | Yes | ✅ |
| POST | `/api/v1/tailscale/test-connection` | Test Tailscale API token | Yes | ✅ |

#### Connectivity Mode Management (v2.0) - ✅ Implemented

| Method | Path | Description | Auth | Status |
|--------|------|-------------|------|--------|
| GET | `/api/v1/settings/connectivity` | Get connectivity mode and settings | Yes | ✅ |
| PUT | `/api/v1/settings/connectivity` | Update connectivity mode, tokens, SSH keys | Yes | ✅ |
| POST | `/api/v1/settings/test-ssh` | Test SSH connection to machine | Yes | ✅ |

#### Synchronous Command Execution (v2.0) - 📋 Planned (EP0013)

| Method | Path | Description | Auth | Status |
|--------|------|-------------|------|--------|
| POST | `/api/v1/machines/{machine_id}/commands/execute` | Execute command via SSH (synchronous, <5s) | Yes | 📋 |
| GET | `/api/v1/machines/{machine_id}/commands/history` | Get command execution audit log | Yes | 📋 |
| POST | `/api/v1/machines/{machine_id}/commands/validate` | Validate command against whitelist (dry-run) | Yes | 📋 |

**Note:** SSH executor service is complete; API endpoints are planned. Agent command polling endpoints (`/agents/command-result`) deprecated in v2.0.

#### Configuration Management (v2.0) - 🚧 In Progress (EP0010)

| Method | Path | Description | Auth | Status |
|--------|------|-------------|------|--------|
| GET | `/api/v1/config/packs` | List available configuration packs | Yes | ✅ |
| GET | `/api/v1/config/packs/{pack_name}` | Get configuration pack details | Yes | ✅ |
| POST | `/api/v1/servers/{server_id}/config/check` | Check configuration compliance | Yes | ✅ |
| GET | `/api/v1/servers/{server_id}/config/diff` | Get configuration diff (expected vs actual) | Yes | ✅ |
| POST | `/api/v1/servers/{server_id}/config/apply` | Apply configuration pack (with dry-run) | Yes | ✅ |
| GET | `/api/v1/servers/{server_id}/config/apply/{apply_id}` | Get apply operation status | Yes | ✅ |
| GET | `/api/v1/config/compliance` | Get compliance summary for all machines | Yes | 📋 |

**Implementation Notes:**
- Config packs stored in `data/config-packs/*.yaml` (US0116)
- Compliance checking via SSH with SSHPooledExecutor (US0117)
- Diff view returns structured mismatch data (US0118)
- Apply pack supports dry-run preview, background execution, progress tracking (US0119)
- Dashboard compliance widget pending (US0120)

#### Dashboard Preferences (v2.0) - 📋 Planned (EP0011)

| Method | Path | Description | Auth | Status |
|--------|------|-------------|------|--------|
| GET | `/api/v1/preferences/card-order` | Get dashboard card order | Yes | 📋 |
| PUT | `/api/v1/preferences/card-order` | Update dashboard card order | Yes | 📋 |

#### Widget Layouts (v2.0) - 📋 Planned (EP0012)

| Method | Path | Description | Auth | Status |
|--------|------|-------------|------|--------|
| GET | `/api/v1/machines/{machine_id}/layout` | Get widget layout for machine detail view | Yes | 📋 |
| PUT | `/api/v1/machines/{machine_id}/layout` | Update widget layout | Yes | 📋 |
| DELETE | `/api/v1/machines/{machine_id}/layout` | Reset to default layout | Yes | 📋 |

**Dependency:** Requires react-grid-layout (not yet installed).

#### Docker Monitoring (v2.0) - 📋 Planned (EP0014)

| Method | Path | Description | Auth | Status |
|--------|------|-------------|------|--------|
| GET | `/api/v1/machines/{machine_id}/containers` | List Docker containers | Yes | 📋 |
| POST | `/api/v1/machines/{machine_id}/containers/{container_id}/start` | Start container | Yes | 📋 |
| POST | `/api/v1/machines/{machine_id}/containers/{container_id}/stop` | Stop container | Yes | 📋 |
| POST | `/api/v1/machines/{machine_id}/containers/{container_id}/restart` | Restart container | Yes | 📋 |

**Note:** Current implementation uses `/api/v1/servers/*` paths. Migration to `/machines/*` planned.

---

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
  "security_updates": "integer",
  "command_results": [
    {
      "action_id": "integer",
      "exit_code": "integer",
      "stdout": "string",
      "stderr": "string",
      "executed_at": "ISO8601 datetime",
      "completed_at": "ISO8601 datetime"
    }
  ]
}
```

**Response (200):**
```json
{
  "received": true,
  "server_time": "ISO8601 datetime",
  "server_registered": true,
  "pending_commands": [
    {
      "action_id": "integer",
      "action_type": "restart_service | clear_logs | custom",
      "command": "string (full command to execute)",
      "parameters": {},
      "timeout_seconds": "integer"
    }
  ],
  "results_acknowledged": ["integer - action_ids confirmed"]
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
  "id": "integer",
  "server_id": "string",
  "alert_id": "integer or null",
  "action_type": "restart_service | clear_logs | custom",
  "service_name": "string or null",
  "command": "string",
  "status": "pending | approved | executing | completed | failed | rejected",
  "created_at": "ISO8601 datetime",
  "created_by": "string (dashboard, system, etc.)",
  "approved_at": "ISO8601 datetime or null",
  "approved_by": "string or null (auto for normal servers, dashboard for manual)",
  "rejected_at": "ISO8601 datetime or null",
  "rejected_by": "string or null",
  "rejection_reason": "string or null",
  "executed_at": "ISO8601 datetime or null",
  "completed_at": "ISO8601 datetime or null",
  "exit_code": "integer or null",
  "stdout": "string or null",
  "stderr": "string or null"
}
```

**Action creation logic:**
- Normal servers (`is_paused=false`): Action created with `status=approved`, `approved_by="auto"`
- Paused servers (`is_paused=true`): Action created with `status=pending`

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

## 6. Data Architecture

### Data Models

#### Machine (Primary Entity) (renamed from Server in v2.0)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | string | PK, unique | Unique identifier (slug format) |
| display_name | string | Nullable | Human-friendly name |
| hostname | string | Required | Network hostname (or Tailscale hostname) |
| **tailscale_hostname** | **string** | **Nullable** | **Tailscale MagicDNS hostname (*.tail-xyz.ts.net)** |
| **tailscale_device_id** | **string** | **Nullable** | **Tailscale device ID** |
| **machine_type** | **enum** | **server/workstation** | **v2.0: Machine type (default: server)** |
| **expected_online** | **boolean** | **Default: true** | **v2.0: Whether offline alerts should be generated** |
| **ssh_username** | **string** | **Nullable** | **v2.0/EP0015: Per-server SSH username override** |
| **sudo_mode** | **string** | **Default: passwordless** | **EP0015: 'passwordless' or 'password'** |
| ip_address | string | Nullable | Current IP address |
| status | enum | online/offline/unknown | Current state |
| os_distribution | string | Nullable | Detected OS |
| os_version | string | Nullable | OS version |
| kernel_version | string | Nullable | Kernel version |
| architecture | string | Nullable | CPU architecture |
| tdp_watts | integer | Nullable | Typical power consumption |
| cpu_model | string | Nullable | CPU model name |
| cpu_cores | integer | Nullable | Number of CPU cores |
| machine_category | string | Nullable | Machine type for power estimation |
| idle_watts | integer | Nullable | Estimated idle power draw |
| updates_available | integer | Default: 0 | Pending package updates |
| security_updates | integer | Default: 0 | Pending security updates |
| is_paused | boolean | Default: false | Maintenance mode flag |
| paused_at | datetime | Nullable | When maintenance mode enabled |
| **last_boot_time** | **datetime** | **Nullable** | **v2.0: For workstation uptime tracking** |
| last_seen | datetime | Nullable | Last heartbeat |
| created_at | datetime | Auto | First seen |
| updated_at | datetime | Auto | Last modified |

**v2.0 Changes:**
- Table renamed from `server` to `machine`
- Added `machine_type` ENUM (server, workstation)
- Added `expected_online` boolean (workstation-aware alerting)
- Added `tailscale_hostname` and `tailscale_device_id`
- Added `ssh_username` for command execution (nullable, per-server override)
- Added `last_boot_time` for workstation uptime tracking

**EP0015 Changes:**
- Added `sudo_mode` field ('passwordless' or 'password')
- `ssh_username` is per-server override (NULL = use global default)
- Added relationship to `credentials` table (per-server credentials)

#### ExpectedService

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | Internal ID |
| server_id | string | FK → Server | Parent server |
| service_name | string | Required | systemd service name |
| display_name | string | Nullable | Human-friendly name |
| is_critical | boolean | Default: true | Alert when down |
| enabled | boolean | Default: true | Whether monitoring is active |
| created_at | datetime | Auto | When added |

**Unique Constraint:** `(server_id, service_name)`

#### Metric (Time-series)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | Internal ID |
| server_id | string | FK → Server, indexed | Server reference |
| timestamp | datetime | Indexed | Collection time |
| cpu_percent | float | | CPU usage (0-100%) |
| memory_percent | float | | RAM usage (0-100%) |
| memory_total_mb | integer | | Total RAM in MB |
| memory_used_mb | integer | | Used RAM in MB |
| disk_percent | float | | Disk usage (0-100%) |
| disk_total_gb | float | | Total disk in GB |
| disk_used_gb | float | | Used disk in GB |
| network_rx_bytes | bigint | | Network received |
| network_tx_bytes | bigint | | Network sent |
| load_1m | float | | 1-min load average |
| load_5m | float | | 5-min load average |
| load_15m | float | | 15-min load average |
| uptime_seconds | integer | | System uptime |

**Indices:** Composite index on `(server_id, timestamp)` for time-range queries

#### ServiceStatus

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | Internal ID |
| server_id | string | FK → Server | Server reference |
| service_name | string | Required | Service name |
| timestamp | datetime | Indexed | Check time |
| status | enum | running/stopped/failed/unknown | State |
| status_reason | string | Nullable | Status details |
| pid | integer | Nullable | Process ID |
| memory_mb | float | Nullable | Memory usage |
| cpu_percent | float | Nullable | CPU usage |

**Indices:** `(server_id, timestamp)`, `(server_id, service_name, timestamp)`

#### Alert

Persistent alert history tracking full lifecycle (open → acknowledged → resolved).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | Unique identifier |
| server_id | string | FK → Server | Source server |
| alert_type | string | Required | Alert classification (disk, memory, cpu, offline, service_down) |
| severity | enum | critical/high/medium/low | Priority |
| status | enum | open/acknowledged/resolved | Current state (default: open) |
| title | string | Required | Short description |
| message | text | Required | Full details |
| threshold_value | float | Nullable | Threshold crossed |
| actual_value | float | Nullable | Triggering value |
| acknowledged_at | datetime | Nullable | When acknowledged |
| resolved_at | datetime | Nullable | When resolved |
| auto_resolved | boolean | Default: false | Whether system resolved |
| created_at | datetime | Auto | When raised |
| updated_at | datetime | Auto | Last modified |

**Indices:** `(server_id, status)`, `(severity, status)`, `created_at`

#### AlertState

Internal deduplication and cooldown state tracking per server per metric type. Used to prevent alert storms and manage notification frequency.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | Internal ID |
| server_id | string | FK → Server | Server reference |
| metric_type | string | Required | cpu, memory, disk, offline |
| current_severity | string | Nullable | null = no active alert |
| consecutive_breaches | integer | Default: 0 | Count of threshold breaches |
| current_value | float | Nullable | Most recent metric value |
| first_breach_at | datetime | Nullable | When breach sequence started |
| last_notified_at | datetime | Nullable | Last notification timestamp |
| resolved_at | datetime | Nullable | When resolved |
| created_at | datetime | Auto | Created timestamp |
| updated_at | datetime | Auto | Last modified |

**Unique Constraint:** `(server_id, metric_type)`

#### RemediationAction

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | Unique identifier |
| server_id | string | FK → Server | Target server |
| alert_id | integer | FK → Alert, nullable | Triggering alert |
| action_type | string | Required | Action category (restart_service, clear_logs, custom) |
| service_name | string | Nullable | For restart_service actions |
| command | string | Required | Full command to execute |
| parameters | json | | Additional params |
| status | enum | pending/approved/rejected/executing/completed/failed | State |
| created_at | datetime | Auto | When queued |
| created_by | string | Default: dashboard | Who created |
| approved_at | datetime | Nullable | When approved |
| approved_by | string | Nullable | Who approved (auto for normal servers) |
| rejected_at | datetime | Nullable | When rejected |
| rejected_by | string | Nullable | Who rejected |
| rejection_reason | text | Nullable | Why rejected |
| executed_at | datetime | Nullable | When sent to agent |
| completed_at | datetime | Nullable | When finished |
| exit_code | integer | Nullable | Command exit code |
| stdout | text | Nullable | Command stdout |
| stderr | text | Nullable | Command stderr |

#### Scan

Ad-hoc device scans via SSH for transient devices.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | Unique identifier |
| hostname | string | Required | Target hostname/IP |
| port | integer | Default: 22 | SSH port |
| username | string | Required | SSH username |
| scan_type | enum | quick/full | Scan depth |
| status | enum | pending/running/completed/failed | State |
| progress | integer | Default: 0 | Progress 0-100% |
| current_step | string | Nullable | Current operation |
| started_at | datetime | Nullable | When scan started |
| completed_at | datetime | Nullable | When scan finished |
| results | json | Nullable | Collected data |
| error | text | Nullable | Error message if failed |
| created_at | datetime | Auto | Created timestamp |
| updated_at | datetime | Auto | Last modified |

#### PendingPackage

Tracking server package updates available.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | string | PK | UUID |
| server_id | string | FK → Server | Server reference |
| name | string | Required | Package name |
| current_version | string | Required | Installed version |
| new_version | string | Required | Available version |
| repository | string | Required | Package source |
| is_security | boolean | Default: false | Security update flag |
| detected_at | datetime | Auto | When discovered |
| updated_at | datetime | Auto | Last modified |

**Unique Constraint:** `(server_id, name)`

#### Discovery

Network device discovery sessions for subnet scans.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | Unique identifier |
| subnet | string | Required | CIDR notation (e.g., "192.168.1.0/24") |
| status | enum | pending/running/completed/failed | State |
| progress_scanned | integer | Default: 0 | Hosts scanned |
| progress_total | integer | Default: 0 | Total hosts to scan |
| devices_found | integer | Default: 0 | Devices discovered |
| devices | json | Nullable | Array of discovered devices |
| started_at | datetime | Nullable | When discovery started |
| completed_at | datetime | Nullable | When discovery finished |
| error | text | Nullable | Error message if failed |
| created_at | datetime | Auto | Created timestamp |
| updated_at | datetime | Auto | Last modified |

#### Config

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| key | string | PK | Config key |
| value | json | | Config value |
| updated_at | datetime | Auto | Last modified |

---

## v2.0 New Data Models

#### Credentials (v2.0, updated EP0015)

Encrypted storage for Tailscale API tokens, SSH private keys, and per-server credentials.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| credential_type | enum | tailscale_token/ssh_private_key/sudo_password/ssh_password | Type of credential |
| server_id | string | FK → Server, nullable | Server ID for per-server credentials (NULL = global) |
| encrypted_value | text | Required | Base64 encrypted blob (AES-256-GCM via Fernet) |
| created_at | datetime | Auto | When created |
| updated_at | datetime | Auto | Last modified |

**Encryption:** Uses Python `cryptography.fernet` with `HOMELABCMD_ENCRYPTION_KEY` from environment.

**Unique Constraint:** Compound on `(credential_type, COALESCE(server_id, '__global__'))` - allows same type for different servers or one global.

**Credential Types:**
| Type | Scope | Description |
|------|-------|-------------|
| `tailscale_token` | Global only | Tailscale API token |
| `ssh_private_key` | Global or per-server | SSH private key (per-server overrides global) |
| `sudo_password` | Global or per-server | Sudo password (per-server overrides global) |
| `ssh_password` | Per-server only | SSH password authentication |

**Credential Retrieval Logic (EP0015):**
```python
async def get_effective_credential(type: str, server_id: str) -> str | None:
    """
    Retrieval order:
    1. Per-server credential (if server_id provided and exists)
    2. Global credential (if exists)
    3. None (credential not configured)
    """
```

#### CommandAuditLog (v2.0)

Complete audit trail for all SSH command executions.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | Unique identifier |
| machine_id | string | FK → Machine | Target machine |
| command | text | Required | Full command executed |
| exit_code | integer | Nullable | Command exit code |
| stdout | text | Nullable | Command stdout |
| stderr | text | Nullable | Command stderr |
| duration_ms | integer | Nullable | Execution duration in milliseconds |
| executed_by | string | Default: dashboard | Who initiated (dashboard/api/automation) |
| executed_at | datetime | Auto | When executed |
| success | boolean | Nullable | Whether command succeeded |
| error | text | Nullable | Error message if failed |

**Indices:** `(machine_id, executed_at)`, `executed_at`

#### ConfigCheck (v2.0)

Configuration compliance check results per machine.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | Unique identifier |
| machine_id | string | FK → Machine | Target machine |
| pack_name | enum | base/developer_lite/developer_max | Configuration pack checked |
| is_compliant | boolean | Required | Whether machine is compliant |
| mismatches | json | Nullable | Array of configuration mismatches |
| checked_at | datetime | Auto | When check performed |
| check_duration_ms | integer | Nullable | Check duration |

**Indices:** `(machine_id, checked_at)`, `is_compliant`

**Mismatch JSON Schema:**
```json
[
  {
    "type": "missing_file",
    "path": "~/.bashrc.d/aliases.sh",
    "expected": "file should exist",
    "actual": "file not found"
  },
  {
    "type": "version_mismatch",
    "package": "curl",
    "expected": "8.5.0",
    "actual": "8.2.0"
  }
]
```

#### ConfigApply (v2.0) ✅ Implemented

Configuration pack application operations with progress tracking (US0119).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | Unique identifier |
| server_id | string | FK → Server | Target server |
| pack_name | string | Required | Configuration pack to apply |
| status | enum | pending/running/completed/failed | Operation state |
| progress | integer | Default: 0 | Progress percentage (0-100) |
| current_item | string | Nullable | Item currently being processed |
| items_total | integer | Default: 0 | Total items to process |
| items_completed | integer | Default: 0 | Successfully completed items |
| items_failed | integer | Default: 0 | Failed items |
| results | json | Nullable | Per-item results array |
| triggered_by | string | Default: user | Who initiated (user/scheduler) |
| error | text | Nullable | Overall error message if failed |
| started_at | datetime | Nullable | When apply started |
| completed_at | datetime | Nullable | When apply completed |
| created_at | datetime | Auto | When created |
| updated_at | datetime | Auto | Last modified |

**Indices:** `(server_id, status)`, `(server_id, created_at)`

**Results JSON Schema:**
```json
[
  {
    "item": "~/.bashrc.d/aliases.sh",
    "action": "created",
    "success": true,
    "error": null
  },
  {
    "item": "curl",
    "action": "installed",
    "success": false,
    "error": "E: Package 'curl' not found"
  }
]
```

#### DashboardPreference (v2.0)

User dashboard preferences (card order, settings).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | Unique identifier |
| preference_key | string | Unique | Preference identifier (e.g., "card_order") |
| preference_value | json | Required | Preference data |
| updated_at | datetime | Auto | Last modified |

**Unique Constraint:** `preference_key`

**Example:** Card order preference:
```json
{
  "preference_key": "card_order",
  "preference_value": ["homeserver", "mediaserver", "studypc", "aiserver1", ...]
}
```

#### WidgetLayout (v2.0)

Per-machine widget layouts for detail view customisation.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | Unique identifier |
| machine_id | string | FK → Machine | Machine reference |
| layout_data | json | Required | react-grid-layout format |
| updated_at | datetime | Auto | Last modified |

**Unique Constraint:** `machine_id` (one layout per machine)

**Layout Data Schema (react-grid-layout format):**
```json
{
  "lg": [
    {"i": "cpu_chart", "x": 0, "y": 0, "w": 12, "h": 3},
    {"i": "memory_gauge", "x": 0, "y": 3, "w": 6, "h": 2},
    {"i": "containers", "x": 6, "y": 3, "w": 6, "h": 4},
    {"i": "services", "x": 0, "y": 5, "w": 6, "h": 3}
  ]
}
```

**Widget types:** cpu_chart, memory_gauge, load_average, disk_usage, services, containers, network, system_info

---

### Relationships

```
Machine ──< ExpectedService      (one-to-many)
Machine ──< Metric               (one-to-many)
Machine ──< ServiceStatus        (one-to-many)
Machine ──< Alert                (one-to-many)
Machine ──< AlertState           (one-to-many)
Machine ──< RemediationAction    (one-to-many)
Machine ──< PendingPackage       (one-to-many)
Machine ──< CommandAuditLog      (one-to-many) [v2.0]
Machine ──< ConfigCheck          (one-to-many) [v2.0]
Machine ──< ConfigApply          (one-to-many) [v2.0] ✅
Machine ─── WidgetLayout         (one-to-one) [v2.0]
Alert   ──< RemediationAction    (one-to-many, optional)
```

**v2.0 Note:** Table renamed from `Server` to `Machine` to reflect server + workstation support.

### Storage Strategy

| Data Type | Storage | Rationale |
|-----------|---------|-----------|
| Relational data | SQLite | Self-contained, adequate for 5-50 servers |
| Time-series metrics | SQLite with indices | Simple, 30-day retention makes scale manageable |
| Configuration | SQLite + YAML | Database for runtime, YAML for bootstrap |
| Scan results | SQLite JSON field | Flexible schema for varying scan outputs |

### Migrations

- **Tool:** Alembic
- **Strategy:** Version-controlled migrations in `migrations/versions/`
- **Execution:** Auto-run on container startup
- **Rollback:** Alembic downgrade support

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
  command_whitelist:
    restart_service: "systemctl restart {service_name}"
    clear_logs: "journalctl --vacuum-time=7d"
  command_timeout_seconds: 30

agent:
  heartbeat_interval_seconds: 60
  command_timeout_seconds: 300
```

---

## 7. Integration Patterns

### External Services

| Service | Purpose | Protocol | Auth |
|---------|---------|----------|------|
| Slack | Alert notifications | HTTPS POST | Webhook URL |
| Target servers (SSH) | Ad-hoc device scanning | SSH | Key-based |

### Event Architecture

**Internal events (via APScheduler):**
- `check_stale_servers` - Every 60s, mark servers offline if no heartbeat
- `check_thresholds` - On each heartbeat, evaluate alert conditions
- `prune_old_data` - Daily, remove metrics older than retention period
- `calculate_costs` - Hourly, update cost rollups

### Auth/Authz Model

```
┌─────────────────────────────────────────────────────────────┐
│                    Single API Key Model                      │
│                                                              │
│  Dashboard ──┐                                               │
│              │                                               │
│  Agent 1  ───┼──▶ X-API-Key: <shared_key> ──▶ All endpoints │
│              │                                               │
│  Agent N  ───┘                                               │
│                                                              │
│  Exception: /api/v1/system/health (no auth for healthcheck) │
└─────────────────────────────────────────────────────────────┘
```

**Future consideration:** Per-agent keys for better audit trail.

### Slack Message Examples

**Critical Alert:**
```
🚨 CRITICAL: Server Offline
━━━━━━━━━━━━━━━━━━━━
Server: OMV BackupServer
Status: No heartbeat for 3 minutes
Last seen: 2026-01-18 14:32:00

Possible causes:
• Server powered off or crashed
• Network connectivity issue
• Agent service stopped
```

**Service Down (with remediation):**
```
🔴 HIGH: Service Stopped
━━━━━━━━━━━━━━━━━━━━
Server: OMV MediaServer
Service: plex
Status: stopped (was running)
Time: 2026-01-18 15:45:00

🔧 Remediation queued: Restart service
Status: Pending approval
→ Approve in dashboard
```

**Remediation Success:**
```
✅ Remediation Completed
━━━━━━━━━━━━━━━━━━━━
Server: OMV MediaServer
Action: Restart plex service
Result: Success
Time: 2026-01-18 15:46:30

Service now running (PID: 12345)
```

**Disk Warning:**
```
⚠️ WARNING: Disk Usage High
━━━━━━━━━━━━━━━━━━━━
Server: OMV MediaServer
Disk usage: 82% (1.64TB / 2TB)
Threshold: 80%
Time: 2026-01-18 16:00:00

Consider:
• Clearing old media
• Expanding storage
```

---

## 8. Infrastructure Approach

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

echo "Agent installed. Configure monitored services in /etc/homelab-agent/config.yaml"
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

**Future:** PostgreSQL backend would enable clustering if needed.

### Disaster Recovery

| Aspect | Implementation |
|--------|----------------|
| Backup strategy | SQLite database file + config.yaml |
| Backup frequency | Daily (cron on host) |
| RTO | Deploy new container, restore data (~10 min) |
| RPO | Last backup |
| Agent recovery | Re-run install script |

---

## 9. Security Considerations

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

### Data Classification

| Category | Examples | Handling |
|----------|----------|----------|
| Public | Server names, uptime | Displayed in dashboard |
| Internal | Metrics, service status | API-protected, no external access |
| Confidential | API keys, SSH keys | Environment variables, file permissions |
| Restricted (PII) | None | N/A |

---

## 10. Performance Requirements

### Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Dashboard load time | < 2s | Browser DevTools |
| API response (p50) | < 100ms | API logs |
| API response (p95) | < 500ms | API logs |
| Agent heartbeat processing | < 50ms | API logs |
| Availability | 99% | Uptime monitoring |

### Capacity Planning

| Metric | Current | Projected (1 year) |
|--------|---------|-----------|
| Monitored servers | ~11 | ~25 |
| Metrics per day | ~15,840 (11 × 1440) | ~36,000 |
| Database size | ~50MB/month | ~150MB/month |
| API requests/day | ~16,000 | ~40,000 |

**Scaling triggers:**
- Database > 1GB → Consider archiving/compression
- Servers > 50 → Consider PostgreSQL migration
- Query latency > 500ms → Add indices, optimise queries

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
- Neutral: Additional channels can be added later via webhook abstraction

---

### ADR-006: Database Migrations via Alembic

**Status:** Accepted

**Context:** Need to manage schema changes as the application evolves.

**Decision:** Use Alembic for SQLite migrations from Phase 1.

**Consequences:**
- Positive: Version-controlled schema changes
- Positive: Supports upgrades and rollbacks
- Positive: Industry-standard SQLAlchemy integration
- Negative: Adds dependency and complexity
- Neutral: Essential for maintainability

---

## 12. Open Technical Questions

- [ ] **Q1:** Should metrics be aggregated for long-term storage (hourly/daily rollups)?
  **Context:** Raw per-minute metrics grow quickly (~50MB/month)
  **Options:** Keep raw 30 days + aggregated forever, or just prune

- [ ] **Q2:** Agent auto-update mechanism?
  **Context:** Updating agents across fleet manually is tedious
  **Options:** Self-update via hub API, Ansible, manual

- [ ] **Q3:** Multi-disk monitoring approach?
  **Context:** OMV servers have MergerFS pools with multiple drives
  **Options:** Monitor root only, monitor all mounts, configurable list

- [ ] **Q4:** Docker container monitoring on agents?
  **Context:** Many services run in Docker, not systemd
  **Options:** Include docker stats in agent, separate integration, defer

- [ ] **Q5:** Agent version compatibility?
  **Context:** Hub and agent may evolve at different rates
  **Options:** Version in heartbeat with compatibility check, warn on mismatch

---

## 13. Implementation Constraints

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
- Database migrations via Alembic

### Won't Have (This Version)
- Multi-user authentication
- External/cloud deployment
- Windows/macOS agents
- pfSense monitoring
- Mobile native app
- Real-time WebSocket updates
- Historical trend analysis/ML

---

## 14. UI/UX Design

> **Design System:** All UI implementation MUST follow the [Brand Guide](brand-guide.md).
> This includes colours, typography, spacing, components, and interaction patterns.

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

### Colour System

| Colour | Usage | Hex |
|--------|-------|-----|
| Green | Online, running, healthy | #22c55e |
| Yellow | Warning threshold | #eab308 |
| Orange | High severity | #f97316 |
| Red | Critical, offline, failed | #ef4444 |
| Blue | Informational, links | #3b82f6 |
| Grey | Disabled, unknown | #6b7280 |

---

## 15. Server Inventory (Initial)

| Server ID | Display Name | Type | TDP | Expected Services |
|-----------|--------------|------|-----|-------------------|
| omv-homeserver | OMV HomeServer | OMV/Pi4 | 50W | smbd, docker |
| omv-backupserver | OMV BackupServer | OMV/Pi4 | 40W | smbd, rsync |
| omv-documentserver | OMV DocumentServer | OMV | 40W | smbd |
| omv-mediaserver | OMV MediaServer | OMV/Mini PC | 65W | plex, sonarr, radarr, transmission, jackett |
| omv-cloudserver1 | OMV CloudServer1 | OMV | 50W | smbd, nextcloud (docker) |
| omv-webserver1 | OMV WebServer1 | OMV | 45W | nginx, n8n (docker) |
| omv-webserver2 | OMV Webserver 2 | OMV | 45W | nginx |
| omv-homeautoserver | OMV HomeAutoServer | OMV | 50W | homeassistant (docker) |
| omv-aiserver1 | OMV AIServer1 | OMV | 100W | ollama, docker |
| pihole-master | Pi-hole Master | RPi | 5W | pihole-FTL |
| pihole-backup | Pi-hole Backup | RPi | 5W | pihole-FTL |

**Total TDP:** 495W | **Est. Daily:** £2.85 | **Est. Monthly:** £85.54

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-18 | 1.0.0 | Initial TRD created from existing draft + legacy audit insights |
| 2026-01-18 | 1.0.1 | QA fix: Changed discovery endpoint from GET `/api/v1/network/discover` to POST `/api/v1/discovery` |
| 2026-01-21 | 1.1.0 | **TRD Review:** Synced with implementation. Updated API endpoints (metrics path, services CRUD, SSH/discovery settings, webhook testing). Added AlertState, PendingPackage, Discovery models. Updated Server model with CPU/power fields. Updated technology versions (SQLAlchemy 2.0 async, APScheduler 4.0, Paramiko for SSH). |
| 2026-01-21 | 1.1.1 | Added AI-Assisted Development Requirements section mandating Context7 usage for all code implementation. |
| 2026-01-25 | 2.0.0 | **Major v2.0 Update:** Architecture changed to Hybrid (agent metrics + SSH commands). Added Tailscale mesh network integration (device discovery, encrypted connectivity, dual mode support). Table renamed: Server → Machine with machine_type (server/workstation), expected_online, tailscale fields, ssh_username, last_boot_time. New data models: Credentials (encrypted), CommandAuditLog, ConfigCheck, DashboardPreference, WidgetLayout. Technology updates: asyncssh (replaces Paramiko for commands), cryptography (Fernet encryption), react-grid-layout, date-fns. New API endpoints: Tailscale integration (/tailscale/*), synchronous command execution (/machines/{id}/commands/execute), configuration management (/config/packs, /machines/{id}/config/*), dashboard preferences (/preferences/*), widget layouts (/machines/{id}/layout), Docker monitoring (/machines/{id}/containers/*). Deprecated: async agent command channel. Workstation support: intermittent availability, no offline alerts, "Last seen" UI, cost tracking based on actual uptime. Configuration compliance checking with pack system (Base, Developer Lite, Developer Max). Widget-based customisable detail views. Drag-and-drop dashboard card reordering. |
| 2026-01-27 | 2.0.1 | **EP0015: Per-Host Credential Management:** Extended credentials table with `server_id` FK for per-server credentials. Added compound unique constraint allowing same credential type for different servers. New credential types: `sudo_password`, `ssh_password`. Updated Machine model with `sudo_mode` field. Credential retrieval implements fallback chain (per-server → global → none). Fixes agent upgrade/removal operations on servers requiring sudo password. |
| 2026-01-27 | 2.0.2 | **TRD Review:** All v2.0 features verified implemented. Tailscale integration complete (device discovery, import, API token storage). SSH executor with connection pooling (Paramiko via asyncio.to_thread). Per-host credential management with Fernet encryption. Connectivity mode switching. SSH host key TOFU verification. CLI utility for key generation. Status updated from Draft to Active. Note: Implementation uses Paramiko (sync via thread pool) rather than asyncssh - functionally equivalent. |
| 2026-01-28 | 2.0.3 | **TRD Review:** Added v2.0 Implementation Status section showing feature completion. Updated v2.0 API endpoints with status markers (✅ Implemented / 📋 Planned). Clarified: Tailscale/Connectivity endpoints complete; Command execution, Config management, Dashboard preferences, Widget layouts, Docker monitoring endpoints are PLANNED (not implemented). Added dependency note: react-grid-layout not installed. 17 planned v2.0 endpoints documented. 4 planned data models (CommandAuditLog, ConfigCheck, DashboardPreference, WidgetLayout) not yet created. |
| 2026-01-28 | 2.1.0 | **SDLC-Studio v2 Upgrade:** Added §2 Project Classification section (project type, rationale, architecture implications). Re-numbered all subsequent sections (3-15). Schema upgraded to v2 modular format. Created .version file for version tracking. |
| 2026-01-29 | 2.1.1 | **TRD Review (EP0010):** Configuration Management now 62% complete. Updated status from 📋 Planned to 🚧 In Progress. Implemented: Config packs API (US0116), compliance checking API (US0117), diff view API (US0118), apply pack API with dry-run and progress tracking (US0119). Added ConfigApply data model with status/progress/results tracking. Updated API endpoint status markers. Remaining: dashboard compliance widget (US0120-US0123). |
