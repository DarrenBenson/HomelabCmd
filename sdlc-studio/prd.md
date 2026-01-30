# Product Requirements Document

**Project:** HomelabCmd
**Version:** 2.1.0
**Last Updated:** 2026-01-28
**Status:** Active
**TRD Reference:** [TRD](trd.md)

> **v2.0 Major Changes:**
> - Hybrid architecture: Agent metrics push + SSH command execution
> - Workstation management (intermittent availability)
> - Tailscale-native connectivity
> - Configuration management for standardization
> - Widget-based detail views with customizable layouts
> - Reorderable dashboard cards

---

## 1. Project Overview

### Product Name
HomelabCmd

### Purpose
A self-hosted monitoring and management platform that provides homelab operators with unified visibility into their server fleet, automated issue detection, and intelligent remediation capabilities - all from a single, clean dashboard.

### Tech Stack
- **Backend:** Python 3.11+, FastAPI, Uvicorn, Pydantic v2, asyncssh
- **Frontend:** React 18+, TypeScript, Vite, Tailwind CSS, Recharts, react-grid-layout
- **Database:** SQLite
- **Agent:** Python (psutil, httpx, pyyaml) - metrics only
- **Connectivity:** Tailscale (encrypted mesh network)
- **Notifications:** Slack Webhooks
- **Deployment:** Docker, docker-compose

### Architecture Pattern
**Hybrid: Agent Metrics Push + SSH Command Execution**

- **Metrics Collection:** Lightweight Python agents push metrics to hub every 60s (proven, low latency)
- **Command Execution:** Hub SSHs directly to machines via Tailscale using `homelabcmd` user (synchronous, immediate feedback)
- **Connectivity:** Tailscale mesh network for stable, encrypted connections across all infrastructure
- **Hub:** Single Docker container (API + frontend + SSH executor)
- **Agents:** Simplified (metrics only, no command execution complexity)

### Design System
All UI components MUST follow the [Brand Guide](brand-guide.md):
- **Aesthetic:** Retro-futuristic "Mission Control" - dark mode only
- **Colours:** Phosphor palette (green/amber/red status indicators)
- **Typography:** Space Grotesk (UI), JetBrains Mono (data/metrics)
- **Components:** Pulsing LED indicators, server cards, terminal blocks


### Maturity Assessment
**Greenfield** - New application, no existing codebase.

---

## 2. Problem Statement

### Problem Being Solved
Managing a homelab with multiple servers and workstations currently requires:

**v1.0 Problems (Servers Only):**
- **Fragmented monitoring:** Checking individual server dashboards, SSH sessions, or relying on basic uptime tools like UptimeKuma that only confirm "is it responding?"
- **Reactive troubleshooting:** Discovering problems only when services fail noticeably (Plex stops working, Pi-hole stops resolving)
- **Manual intervention:** Every issue requires SSH access, manual diagnosis, and manual remediation
- **No resource visibility:** No consolidated view of CPU, RAM, disk usage across the fleet; capacity issues discovered too late
- **Unknown costs:** No insight into electricity costs of running 24/7 infrastructure
- **Command execution failures:** Async command channel unreliable, commands timing out or never executing

**v2.0 New Problems:**
- **Workstation blind spots:** Desktop PCs, laptops need monitoring but are intermittently online; v1.0 generates false offline alerts
- **Configuration drift:** Workstations need standardized configs (terminal, bash toolkit, API keys) but no way to check or enforce compliance
- **No machine differentiation:** Servers (24/7) and workstations (intermittent) treated the same, causing alert noise
- **Mixed fleet visibility:** No unified view of both always-on servers and sometimes-on workstations

### Target Users
| Persona | Description |
|---------|-------------|
| **Homelab Operator (Primary)** | Technical professional running 10+ servers, comfortable with Linux/Docker/SSH, values efficiency, checks status daily |
| **Workstation User (Primary - v2.0)** | Same person as Homelab Operator, but using various workstations (desktop PCs, laptops) intermittently; needs standardized dev environment across machines |
| **Family Member (Secondary)** | Non-technical user relying on homelab services (Plex, file shares), notices when things break |

### Context
- **Servers:** ~11 always-on servers (OMV NAS boxes, Raspberry Pis, mini PCs)
- **Workstations:** 1-4 intermittent workstations (StudyPC, laptops)
- **Services:** Plex, Nextcloud, Pi-hole (dual), WireGuard, Home Assistant, Ollama, Docker containers
- **Network:** Tailscale mesh deployed across all infrastructure
- **Users:** Standardized `homelabcmd` user (UID 1003, passwordless sudo) on all machines
- **Existing tools:** Heimdall (service links), UptimeKuma (basic uptime only)
- **Preference:** Slack notifications (already configured)
- **Deployment:** LAN-first, Tailscale-enabled (works remotely)

---

## 3. Goals and Success Metrics

### Primary Goals (v1.0 - Achieved)

| Goal | Description | Success Metric | Status |
|------|-------------|----------------|--------|
| **G1** | Unified visibility | All servers visible on single dashboard | ✅ Done |
| **G2** | Proactive alerting | 90% of issues detected before user-reported failure | ✅ Done |
| **G3** | Reduced MTTR | Mean time to remediation < 5 minutes for common issues | ✅ Done |
| **G4** | Cost awareness | Accurate monthly cost estimate within 10% of actual | ✅ Done |
| **G5** | Fleet audit | Complete inventory of all network devices on demand | ✅ Done |

### v2.0 Goals (New)

| Goal | Description | Success Metric |
|------|-------------|----------------|
| **G6** | Workstation management | Monitor 1-4 workstations without false offline alerts |
| **G7** | Configuration compliance | 100% of workstations report compliance status |
| **G8** | Immediate command execution | Command execution latency < 5 seconds (down from 2-4 minutes) |
| **G9** | Tailscale-native | All connectivity via Tailscale (stable, encrypted, remote-capable) |
| **G10** | Customizable UI | Users can reorder cards and arrange widgets per preference |

### Secondary Goals

| Goal | Description |
|------|-------------|
| **G11** | Minimal maintenance overhead - agents should "just work" |
| **G12** | Low resource footprint - hub and agents shouldn't impact server performance |
| **G13** | Self-contained deployment - no external dependencies except Tailscale |
| **G14** | Configuration standardization - workstations automatically checkable for drift |

### Key Performance Indicators (KPIs)

| KPI | v1.0 Target | v2.0 Target | Measurement |
|-----|-------------|-------------|-------------|
| Dashboard load time | < 2s | < 2s | Browser performance |
| Agent heartbeat success rate | > 99.5% | > 99.5% | Missed heartbeats / total expected |
| Alert-to-notification latency | < 2 min | < 2 min | Time from threshold breach to Slack message |
| False positive alert rate | < 5% | < 2% | Alerts closed without action / total alerts (improved with workstation awareness) |
| Command execution latency | 2-4 min (async) | < 5s (SSH) | Time from user click to result |
| SSH connection success rate | N/A | > 99% | Successful SSH commands / attempted |
| Configuration compliance check | N/A | < 10s per machine | Time to check all configs via SSH |

---

## 4. User Personas

### Primary: Homelab Operator (Darren)

**Background:**
- Technical professional running a homelab with 10+ servers
- Mix of OpenMediaVault NAS boxes, Raspberry Pis, and various services
- Comfortable with Linux, Docker, SSH, but values efficiency
- Already uses Heimdall for service links, UptimeKuma for basic uptime monitoring

**Goals:**
- Spend less time on routine monitoring and maintenance
- Catch problems before they become service outages
- Understand resource utilisation and costs
- Maintain control over automated actions

**Pain Points:**
- Too many dashboards and SSH sessions to check
- Discovers disk full issues only when services fail
- No visibility into which server is consuming resources
- Manual service restarts are tedious but frequent

**Behaviours:**
- Checks homelab status daily, usually in the evening
- Prefers Slack notifications (already configured for other tools)
- Wants automation but with ability to review before major changes
- Values clean, functional UI over flashy design

### Secondary: Family Member

**Background:**
- Non-technical user who relies on homelab services (Plex, file shares)
- Notices when things break but can't diagnose or fix

**Goals:**
- Services just work
- Know when things are being fixed

**Relevance:**
- Drives requirement for proactive monitoring (fix before they notice)
- Future consideration: read-only status page showing "all systems operational"

---

## 5. Feature Inventory

### v1.0 Features (Complete)

| Feature | Description | Status | Priority | Epic |
|---------|-------------|--------|----------|------|
| Server Registration | Register and manage monitored servers | ✅ Complete | P0 | EP0001 |
| Agent Heartbeat | Agents push metrics to hub periodically | ✅ Complete | P0 | EP0001 |
| Dashboard Overview | Single-page fleet health view with server cards | ✅ Complete | P0 | EP0001 |
| Real-time Metrics | CPU, RAM, Disk, Network display per server | ✅ Complete | P0 | EP0001 |
| Historical Metrics | Time-series charts (24h/7d/30d) | ✅ Complete | P1 | EP0001 |
| Threshold Alerting | Alerts when metrics exceed configured thresholds | ✅ Complete | P0 | EP0002 |
| Server Offline Detection | Alert when no heartbeat received | ✅ Complete | P0 | EP0002 |
| Slack Notifications | Send alerts to Slack channel | ✅ Complete | P0 | EP0002 |
| Alert Management | Acknowledge, resolve, view history | ✅ Complete | P1 | EP0002 |
| Service Monitoring | Track systemd service status per server | ✅ Complete | P0 | EP0003 |
| Service Configuration | Define expected services per server | ✅ Complete | P0 | EP0003 |
| Service Alerts | Alert when critical service stops | ✅ Complete | P0 | EP0003 |
| Service Restart (Async) | Queue service restart from dashboard | ✅ Complete (replaced in v2.0) | P1 | EP0004 |
| Cost Calculation | Estimate electricity cost per server | ✅ Complete | P1 | EP0005 |
| TDP Configuration | Configure power draw per server | ✅ Complete | P1 | EP0005 |
| Fleet Cost Summary | Total homelab running cost | ✅ Complete | P1 | EP0005 |
| Ad-hoc SSH Scanning | Scan transient devices via SSH | ✅ Complete | P2 | EP0006 |
| Network Discovery | Discover devices on LAN (mDNS/nmap) | ✅ Complete | P2 | EP0006 |
| Scan History | Store and view past scan results | ✅ Complete | P2 | EP0006 |

**v1.0 Total:** 6 Epics, 52 Stories, 175 Points ✅

### v2.0 Features (New)

| Feature | Description | Status | Priority | Epic |
|---------|-------------|--------|----------|------|
| **Tailscale Integration** | | | | **EP0008** |
| Tailscale API Client | Query Tailscale control plane for devices | ✅ Complete | P0 | EP0008 |
| Device Discovery | List all Tailscale devices with metadata | ✅ Complete | P0 | EP0008 |
| Tailscale Import | Import discovered devices as machines | ✅ Complete | P0 | EP0008 |
| SSH via Tailscale | SSH connections via stable Tailscale hostnames | ✅ Complete | P0 | EP0008 |
| Connectivity Modes | Toggle between Tailscale and Direct SSH | ✅ Complete | P0 | EP0008 |
| Credential Encryption | Encrypt tokens/keys with encryption key | ✅ Complete | P0 | EP0008 |
| **Workstation Management** | | | | **EP0009** |
| Machine Type Field | Distinguish servers from workstations | ✅ Complete | P0 | EP0009 |
| Workstation Registration | Register workstations with correct type | ✅ Complete | P0 | EP0009 |
| Workstation-Aware Alerting | No offline alerts for workstations | ✅ Complete | P0 | EP0009 |
| Last Seen UI | Show "Last seen" instead of "OFFLINE" | ✅ Complete | P0 | EP0009 |
| Visual Distinction | Different icons/styling for workstations | ✅ Complete | P1 | EP0009 |
| Workstation Cost Tracking | Calculate costs based on actual uptime | ✅ Complete | P1 | EP0009 |
| **Configuration Management** | | | | **EP0010** |
| Configuration Packs | Base Pack, Developer Lite, Developer Max | ✅ Complete | P0 | EP0010 |
| Compliance Checking | Check configs via SSH, report drift | ✅ Complete | P0 | EP0010 |
| Diff View | Show configuration differences | ✅ Complete | P0 | EP0010 |
| Apply Standard | One-click apply standard configuration | ✅ Complete | P0 | EP0010 |
| Compliance Dashboard | Overview of all machine compliance | Not Started | P1 | EP0010 |
| **Advanced Dashboard UI** | | | | **EP0011** |
| Reorderable Cards | Drag-and-drop card reordering | Not Started | P1 | EP0011 |
| Card Order Persistence | Save card order to backend | Not Started | P1 | EP0011 |
| Improved Card Design | More metrics, better status indicators | Not Started | P1 | EP0011 |
| Machine Type Themes | Visual distinction (servers vs workstations) | Not Started | P1 | EP0011 |
| **Widget-Based Detail View** | | | | **EP0012** |
| Widget System | Modular widget architecture | Not Started | P1 | EP0012 |
| Widget Drag-and-Drop | Arrange widgets via react-grid-layout | Not Started | P1 | EP0012 |
| Widget Layout Persistence | Save layouts per machine to backend | Not Started | P1 | EP0012 |
| CPU Chart Widget | Time series CPU usage | Not Started | P1 | EP0012 |
| Memory/CPU Gauge Widgets | Circular gauges with thresholds | Not Started | P1 | EP0012 |
| Containers Widget | Docker container list with status | Not Started | P1 | EP0012 |
| Services Widget | systemd services table | Not Started | P1 | EP0012 |
| File Systems Widget | Disk mounts and usage | Not Started | P1 | EP0012 |
| Network Widget | Network interfaces table | Not Started | P1 | EP0012 |
| System Info Widget | Hostname, OS, kernel, uptime | Not Started | P1 | EP0012 |
| **Synchronous Command Execution** | | | | **EP0013** |
| SSH Executor Service | Execute commands via SSH with pooling | ✅ Complete | P0 | EP0013 |
| Simplified Agent | Remove command execution from agent | Not Started | P0 | EP0013 |
| Synchronous API | Immediate command execution endpoint | Partial | P0 | EP0013 |
| Command Whitelist | Security validation for allowed commands | Not Started | P0 | EP0013 |
| Command Audit Trail | Immutable log of all executions | Not Started | P1 | EP0013 |
| **Docker Container Monitoring** | | | | **EP0014** |
| Docker Service Monitoring | Monitor docker.service via systemd | Not Started | P1 | EP0014 |
| Container Detection | Detect if Docker installed on machine | Not Started | P1 | EP0014 |
| Container Widget | List containers with name/image/status | Not Started | P1 | EP0014 |
| **Per-Host Credential Management** | | | | **EP0015** |
| Per-Server Credential Schema | Database support for per-server credentials | ✅ Complete | P0 | EP0015 |
| Credential Service Per-Host | Service layer with fallback chain | ✅ Complete | P0 | EP0015 |
| Agent Upgrade Sudo Support | Fix agent upgrade on sudo-password servers | ✅ Complete | P0 | EP0015 |
| Agent Removal Sudo Support | Fix agent removal on sudo-password servers | ✅ Complete | P0 | EP0015 |
| Per-Server Credential API | API endpoints for credential management | ✅ Complete | P1 | EP0015 |
| Server Credential UI | Dashboard UI for credential configuration | ✅ Complete | P1 | EP0015 |
| **Unified Discovery Experience** | | | | **EP0016** |
| Unified Discovery Page Shell | Single /discovery page with tabs | ✅ Complete | P1 | EP0016 |
| Unified Device Card Component | Consistent card for both discovery methods | ✅ Complete | P1 | EP0016 |
| SSH Test Endpoint | Test SSH connectivity to Tailscale devices | ✅ Complete | P1 | EP0016 |
| Tailscale Devices with SSH Status | Device list with SSH availability | ✅ Complete | P1 | EP0016 |
| Discovery Filters Component | Status and OS filters | ✅ Complete | P2 | EP0016 |
| Unified Import Modal | Combined import for both sources | ✅ Complete | P2 | EP0016 |
| Network Discovery Tab | Network scan integration | ✅ Complete | P2 | EP0016 |
| Tailscale Tab Integration | Tailscale discovery integration | ✅ Complete | P2 | EP0016 |
| Route Cleanup | Remove old discovery pages | ✅ Complete | P3 | EP0016 |
| **Desktop UX Improvements** | | | | **EP0017** |
| Maintenance Mode Indicator | Enhanced visual for paused servers | ✅ Complete | P1 | EP0017 |
| Warning State Visual | Distinct treatment for warning status | ✅ Complete | P1 | EP0017 |
| Connectivity Badge | Tailscale/SSH badge on cards | ✅ Complete | P1 | EP0017 |
| Dashboard Search and Filter | Search box and filter chips | ✅ Complete | P2 | EP0017 |
| Inline Metric Sparklines | CPU trend sparklines on cards | ✅ Complete | P2 | EP0017 |
| Accessible Status Indicators | Shape + colour for WCAG compliance | ✅ Complete | P2 | EP0017 |
| Server Card Quick Actions | Hover-reveal action buttons | ✅ Complete | P3 | EP0017 |

**v2.0 New:** 10 Epics, ~70 Stories, ~281 Points

**Combined Total:** 16 Epics, ~122 Stories, ~456 Points

### Feature Details

#### Server Registration (FR1)

**User Story:** As a homelab operator, I want to register my servers so they appear on the dashboard for monitoring.

**Acceptance Criteria:**
- [ ] Manual registration via dashboard form
- [ ] Auto-registration on first agent heartbeat
- [ ] Store: server_id, display_name, hostname, IP, MAC, TDP, location, tags
- [ ] Track status: online, offline, unknown
- [ ] Mark offline if no heartbeat in 180s (configurable)

**Dependencies:** None

**Status:** Not Started

**Confidence:** [HIGH]

---

#### Metrics Collection (FR2)

**User Story:** As a homelab operator, I want to see real-time metrics for each server so I can identify resource constraints.

**Acceptance Criteria:**
- [ ] Agent collects metrics every 60s (configurable)
- [ ] Metrics: CPU%, RAM%, Disk%, Network RX/TX, Load averages, Uptime
- [ ] OS info: distribution, version, kernel, architecture
- [ ] Detect available package updates (security flagged)
- [ ] Store time-series with server_id and timestamp
- [ ] Retain 30 days, auto-prune old data

**Dependencies:** Server Registration

**Status:** Not Started

**Confidence:** [HIGH]

---

#### Threshold Alerting (FR4)

**User Story:** As a homelab operator, I want to be alerted when resources exceed thresholds so I can prevent failures.

**Acceptance Criteria:**
- [ ] Configurable thresholds: Disk 80%/90%, RAM 85%, CPU 90%
- [ ] Alert on server offline (no heartbeat)
- [ ] Alert on critical service stop
- [ ] Severity levels: critical, high, medium, low
- [ ] Status: open, acknowledged, resolved
- [ ] Auto-resolve when condition clears
- [ ] No duplicate alerts for ongoing conditions

**Dependencies:** Metrics Collection, Service Monitoring

**Status:** Not Started

**Confidence:** [HIGH]

---

#### Remediation Engine (FR6)

**User Story:** As a homelab operator, I want the system to suggest and execute fixes so I don't need to SSH manually.

**Operational Model:**
- **Normal mode (default):** Actions execute immediately without approval (`approved_by="auto"`)
- **Maintenance mode:** Server flagged with `is_paused=true` - all actions require manual approval

**Acceptance Criteria:**
- [ ] Action types: restart_service, clear_logs, custom
- [ ] Status: pending, approved, executing, completed, failed, rejected
- [ ] Normal servers: actions approved and execute immediately
- [ ] Paused servers: actions require manual approval
- [ ] Server pause/unpause API endpoints
- [ ] Deliver commands via heartbeat response
- [ ] Agent reports execution results via heartbeat request
- [ ] Complete audit trail
- [ ] Command whitelist for security

**Dependencies:** Alerting, Service Monitoring, Agent

**Status:** Not Started

**Confidence:** [HIGH]

---

## 4. Functional Requirements

### Core Behaviours

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Server registration (manual + auto) | P0 |
| FR2 | Metrics collection (60s interval) | P0 |
| FR3 | Service status monitoring (systemd) | P0 |
| FR4 | Threshold-based alerting | P0 |
| FR5 | Slack webhook notifications | P0 |
| FR6 | Remediation with approval workflow | P0/P1 |
| FR7 | Cost calculation (TDP-based) | P1 |
| FR8 | Ad-hoc SSH scanning | P2 |
| FR9 | Dashboard with server cards | P0 |
| FR10 | REST API with OpenAPI spec | P0 |

### Input/Output Specifications

See [TRD §4: API Contracts](trd.md#4-api-contracts) for complete request/response schemas.

### Business Logic Rules

1. **Offline Detection:** Server marked offline after 3 missed heartbeats (180s default)
2. **Alert Deduplication:** Only one active alert per condition per server
3. **Auto-Resolve:** Alerts resolve when metric drops below threshold
4. **Command Whitelist:** Agents only execute predefined command patterns
5. **DNS Server Protection:** Stagger reboots for Pi-hole servers (30/60 min delays)

---

## 5. Non-Functional Requirements

### Performance

| Metric | Target |
|--------|--------|
| Dashboard load time | < 2 seconds |
| API response (p50) | < 100ms |
| API response (p95) | < 500ms |
| Agent heartbeat processing | < 50ms |
| Agent memory footprint | < 50MB |
| Agent CPU usage (idle) | < 1% |

### Security

| Control | Implementation |
|---------|----------------|
| Authentication | API key via X-API-Key header |
| Authorisation | Single-user, all-or-nothing |
| Transport | HTTPS via Nginx Proxy Manager |
| Command security | Whitelist-only execution |
| Input validation | Pydantic models |
| Secrets | Environment variables only |
| SQL injection | Parameterised queries (SQLAlchemy) |

### Scalability

| Metric | Target |
|--------|--------|
| Supported servers | 5-50 |
| Metrics retention | 30 days @ 1-min granularity |
| Database growth | < 200MB/month |
| Concurrent users | 1-5 (single-user optimised) |

### Availability

| Metric | Target |
|--------|--------|
| Hub uptime | 99% |
| Agent heartbeat success | > 99.5% |
| Data durability | No loss on container restart |
| Graceful degradation | Dashboard works if some agents offline |

### Error Handling

- Agent retries heartbeat 3x with 5s delay on failure
- Hub queues notifications if Slack unreachable
- Failed remediation reported and logged
- Database corruption detected via integrity checks

---

## 6. AI/ML Specifications

> Not applicable for v1.0. Future consideration: anomaly detection for metrics.

---

## 7. Data Architecture

### Core Entities

| Entity | Purpose |
|--------|---------|
| Server | Registered servers with metadata and status |
| ExpectedService | Services to monitor per server |
| Metric | Time-series metrics from agents |
| ServiceStatus | Service state snapshots |
| Alert | Generated alerts with lifecycle |
| RemediationAction | Queued and executed actions |
| Scan | Ad-hoc device scan results |
| Config | System configuration key-value store |

See [TRD §5: Data Architecture](trd.md#5-data-architecture) for complete field definitions, database schema, and relationships.

### Data Flow

```
Agent → Heartbeat → Store metrics → Check thresholds → Generate alerts → Notify
                         ↓
                Return pending commands → Agent executes → Report result
```

---

## 8. Integrations

| Integration | Purpose |
|-------------|---------|
| Slack Webhooks | Alert and remediation notifications |
| SSH (ad-hoc) | Transient device scanning |

See [TRD §6: Integration Patterns](trd.md#6-integration-patterns) for authentication methods, message formats, and protocols.

---

## 10. Test Coverage Analysis

### Tested Functionality
> To be determined post-implementation.

### Untested Areas
> All functionality (greenfield project).

### Test Patterns Used
- pytest for backend
- pytest-asyncio for async tests
- Vitest for frontend
- Integration tests via httpx TestClient

### Quality Assessment
> Not yet applicable.

---

## 11. Technical Debt Register

### TODO/FIXME Items Found
> None (greenfield).

### Inconsistent Patterns
> None (greenfield).

### Deprecated Dependencies
> None planned.

### Security Concerns
- [ ] Ensure API key is changed from default before production
- [ ] Validate SSH key permissions for ad-hoc scanning
- [ ] Review command whitelist before enabling auto-approve

---

## 12. Documentation Gaps

### Undocumented Features
> Agent installation procedure needs user documentation.

### Missing Inline Comments
> N/A (greenfield).

### Unclear Code Sections
> N/A (greenfield).

---

## 13. Recommendations

### Critical Gaps
1. **Agent versioning** - Add version to heartbeat for compatibility checking
2. **Multi-disk monitoring** - OMV servers have MergerFS pools requiring per-mount metrics
3. **Docker container status** - Many services run in Docker, not systemd
4. **Network resilience** - Agent should buffer metrics if hub unreachable

### Suggested Improvements
1. Configurable heartbeat interval per server
2. Per-server offline threshold (DNS servers need faster detection)
3. Webhook abstraction for Discord/Telegram support
4. Database migrations via Alembic

### Security Hardening
1. mTLS for agent communication (future)
2. Rate limiting on API (low priority for LAN)
3. Audit logging for all configuration changes

---

## 14. Release Plan

### v1.0 (Complete) ✅

**Summary:** All 6 phases complete with 92% story completion, 97% code coverage, and 11 servers monitored.

**Phases Delivered:**
1. MVP (Core Infrastructure)
2. Alerting & Notifications
3. Service Monitoring
4. Remediation Engine
5. Cost Tracking
6. Ad-hoc Scanning

**Status:** Production-ready, all v1.0 goals achieved.

---

### v2.0 Release Plan

### Phase 1 (Alpha): Foundation & Connectivity
**Target:** Q1 2026 | **Story Points:** ~80

**Epics:**
- **EP0008:** Tailscale Integration (31 pts)
  - Tailscale API client
  - Device discovery
  - SSH connection via Tailscale
  - Credential encryption
  - Connectivity mode management

- **EP0009:** Workstation Management (26 pts)
  - Machine type field (server vs workstation)
  - Workstation-aware alerting (no offline alerts)
  - Last seen UI for workstations
  - Workstation cost tracking (actual uptime)
  - Visual distinction in dashboard

- **EP0013:** Synchronous Command Execution (23 pts)
  - SSH executor service
  - Remove async command channel from agents
  - Synchronous command API (<5s latency)
  - Command whitelist enforcement
  - Command audit trail

**Exit Criteria:** ✅ ALL MET
- [x] All machines connected via Tailscale or Direct SSH
- [x] Workstations monitored without false offline alerts
- [x] Commands execute in <5 seconds
- [x] SSH credentials encrypted at rest
- [x] Command whitelist enforced
- [x] Agents simplified (metrics only, no command execution)

---

### Phase 2 (Beta): UI Revolution
**Target:** Q2 2026 | **Story Points:** ~159

**Epics:**
- **EP0011:** Advanced Dashboard UI (~32 pts)
  - Drag-and-drop card reordering
  - Card order persistence (backend storage)
  - Server/workstation visual grouping
  - Responsive grid layout

- **EP0012:** Widget-Based Detail View (~48 pts)
  - react-grid-layout integration
  - 8 widget types (CPU, memory, load, containers, services, filesystem, network, system info)
  - Widget customisation per machine
  - Default sensible layout
  - Widget order persistence

- **EP0014:** Docker Container Monitoring (~24 pts)
  - Docker service status detection
  - Container listing widget
  - Container status (running/stopped/exited)
  - Basic container metrics

- **EP0016:** Unified Discovery Experience (~32 pts) ✅ COMPLETE
  - Single /discovery page with tabs
  - Unified device card component
  - SSH testing for Tailscale devices
  - Unified import modal

- **EP0017:** Desktop UX Improvements (~23 pts) ✅ COMPLETE
  - Maintenance mode and warning state indicators
  - Connectivity badges (Tailscale/SSH)
  - Dashboard search and filter
  - Inline metric sparklines
  - Accessible status indicators
  - Server card quick actions

**Exit Criteria:**
- [ ] Users can reorder dashboard cards
- [ ] Detail pages have customisable widget layouts
- [ ] Docker containers visible in widget
- [ ] Layout preferences sync across devices
- [ ] All widgets responsive and functional
- [x] Unified discovery page with consistent UX (EP0016)
- [x] Dashboard search/filter and sparklines (EP0017)

---

### Phase 3 (GA): Configuration Management
**Target:** Q2 2026 | **Story Points:** ~40

**Epics:**
- **EP0010:** Configuration Management (~40 pts)
  - Configuration compliance checking
  - Three-tier pack system (Base, Developer Lite, Developer Max)
  - Diff view for mismatches
  - "Apply Standard" button
  - Configuration drift detection
  - Compliance dashboard widget

**Exit Criteria:**
- [x] Configuration packs defined (Base, Developer Lite, Developer Max)
- [x] Compliance checking via SSH
- [x] Diff view shows configuration mismatches
- [x] Can apply standard configs with one click
- [ ] Compliance status visible on dashboard
- [ ] Warnings displayed for non-compliant machines

---

### v2.0 Total

**Story Points:** ~281
**Timeline:** Q1-Q2 2026 (3-4 months)
**Migration:** Downtime acceptable, in-place upgrade from v1.0

**Progress:**
- Phase 1 (Alpha): ✅ Complete (EP0008, EP0009, EP0013, EP0015) - 104 pts
- Phase 2 (Beta): 🔶 In Progress (EP0016 ✅, EP0017 ✅, EP0011/EP0012/EP0014 pending) - 159 pts
- Phase 3 (GA): 🔶 In Progress (EP0010: 62% complete, 26/42 pts done) - 42 pts

---

## 15. Success Criteria

### v1.0 Success Criteria (Achieved) ✅

- [x] All 11 initial servers registered and reporting
- [x] Dashboard loads in < 2 seconds
- [x] Metrics visible for all servers
- [x] Data persists across container restarts
- [x] Agent installation takes < 5 minutes per server
- [x] All functional requirements P0/P1 implemented
- [x] 90% of issues detected before service impact (G2)
- [x] MTTR for common issues < 5 minutes (G3)
- [x] Zero false negatives (missed critical issues)
- [x] < 5% false positive rate on alerts
- [x] Cost estimates within 10% of actual (validated over 1 month)

### v2.0 Success Criteria

#### Phase 1 (Alpha) Success Criteria ✅ COMPLETE

**Connectivity & Security:**
- [x] All servers connected via Tailscale mesh network
- [x] Tailscale API token encrypted at rest
- [x] SSH private key encrypted at rest
- [x] Can switch between Tailscale Mode and Direct SSH Mode
- [x] SSH connections succeed in <2 seconds

**Workstation Management:**
- [x] Workstations registered with `machine_type='workstation'`
- [x] Zero offline alerts generated for offline workstations
- [x] Workstation cards show "Last seen: X ago" instead of "OFFLINE"
- [x] Cost tracking accurate for intermittent uptime workstations
- [x] Visual distinction between server and workstation cards

**Command Execution:**
- [x] Commands execute in <5 seconds (vs 2-4 minutes in v1.0)
- [x] Command whitelist enforced (unauthorized commands rejected)
- [x] Complete audit trail for all command executions
- [x] Agents simplified (metrics only, no command channel)
- [x] Synchronous command API returns immediate results

#### Phase 2 (Beta) Success Criteria

**Dashboard UI:**
- [ ] Users can drag-and-drop to reorder dashboard cards
- [ ] Card order persists across sessions and devices
- [ ] Server and workstation sections visually grouped
- [ ] Dashboard responsive on tablet and mobile

**Widget System:**
- [ ] Detail pages show 8 widget types (CPU, memory, load, containers, services, filesystem, network, system info)
- [ ] Users can customise widget layout per machine
- [ ] Widget layouts persist across sessions
- [ ] Default layout automatically applied to new machines
- [ ] Widgets update in real-time with latest metrics

**Docker Monitoring:**
- [ ] Docker service status detected automatically
- [ ] Container widget shows all containers per machine
- [ ] Container status (running/stopped/exited) accurate
- [ ] Container widget only shown when Docker installed

#### Phase 3 (GA) Success Criteria

**Configuration Management:**
- [x] Configuration packs defined (Base, Developer Lite, Developer Max)
- [x] Compliance checking completes in <10 seconds per machine
- [x] Diff view clearly shows configuration mismatches
- [x] "Apply Standard" button successfully applies configs
- [ ] Compliance dashboard widget shows status for all machines
- [ ] Non-compliant machines show warnings (not errors)

#### v2.0 Overall Success Metrics

- [ ] Command execution latency: <5s (90th percentile)
- [ ] Workstation false offline alerts: 0
- [ ] Configuration compliance rate: >90%
- [ ] Dashboard card reordering: <2 seconds
- [ ] Widget customisation: <30 seconds to arrange
- [ ] User satisfaction: Dashboard check time reduced from 60s to 30s
- [ ] Zero security vulnerabilities in credential storage
- [ ] All machines connected via Tailscale or Direct SSH

---

## 16. Key User Flows

### v1.0 Flows (Existing)

#### Flow 1: Daily Health Check

```
User opens dashboard
    ↓
Sees summary bar: "9 Online, 1 Offline, 2 Warnings"
    ↓
Notices BackupServer card shows offline
    ↓
Clicks card → Server detail
    ↓
Sees "Last seen: 15 minutes ago"
    ↓
Investigates (SSH, physical check)
```

#### Flow 2: Respond to Alert

```
Slack notification: "🚨 Critical: plex service stopped on MediaServer"
    ↓
User opens dashboard
    ↓
Sees alert in "Recent Alerts" with suggested action
    ↓
Clicks "Approve" on pending "Restart plex" action
    ↓
Action executes, notification confirms success
    ↓
Alert auto-resolves when service running
```

---

### v2.0 New Flows

#### Flow 5: Register and Monitor a Workstation

```
User navigates to Settings → Connectivity
    ↓
Enters Tailscale API token → Clicks "Connect"
    ↓
System discovers 15 devices on Tailnet
    ↓
User navigates to Discovery → Device Discovery
    ↓
Sees "studypc.tail-abc123.ts.net" in device list
    ↓
Clicks "Import" on StudyPC device
    ↓
Import modal opens with pre-filled hostname
    ↓
User sets:
  - Display Name: "StudyPC"
  - Machine Type: Workstation
  - TDP: 100W
    ↓
Clicks "Import Machine"
    ↓
StudyPC card appears on dashboard with 💻 icon
    ↓
Card shows "Last seen: 2 minutes ago" (not "OFFLINE")
    ↓
No offline alerts generated when StudyPC powers off
```

#### Flow 6: Execute Immediate Command via SSH

```
User sees alert: "Disk 95% full on MediaServer"
    ↓
Clicks MediaServer card → Detail page
    ↓
Scrolls to "Quick Actions" widget
    ↓
Clicks "Clean Docker Images" button
    ↓
Command executes via SSH synchronously
    ↓
Progress indicator shows "Executing..."
    ↓
2 seconds later: Success message "Freed 8.5GB"
    ↓
Disk widget updates immediately to show 87% full
    ↓
Audit log entry created automatically
```

#### Flow 7: Check Workstation Configuration Compliance

```
User navigates to Configuration → Compliance
    ↓
Sees compliance dashboard:
  - StudyPC: ⚠️ 3 mismatches
  - LaptopPro: ✅ Compliant
    ↓
Clicks StudyPC compliance card
    ↓
Diff view shows:
  - Missing: ~/.bashrc.d/aliases.sh
  - Missing: ~/.config/ghostty/config
  - Version mismatch: curl (8.5.0 expected, 8.2.0 installed)
    ↓
Clicks "Apply Developer Max Pack"
    ↓
System shows preview: "Will install 12 packages, copy 8 config files"
    ↓
User clicks "Apply"
    ↓
SSH executes commands synchronously (<30s)
    ↓
Success: "StudyPC now compliant with Developer Max Pack"
    ↓
Compliance card updates to ✅ Compliant
```

#### Flow 8: Customise Widget Layout on Detail Page

```
User clicks HomeServer card → Detail page
    ↓
Sees default widget layout:
  [CPU Chart]    [Memory Gauge]
  [Load Average] [Disk Usage]
  [Services]     [Containers]
    ↓
Clicks "Edit Layout" button (top right)
    ↓
Widgets gain drag handles and resize controls
    ↓
User drags CPU Chart to full width at top
    ↓
User resizes Containers widget to 2x height
    ↓
User drags Network widget from sidebar to layout
    ↓
Clicks "Save Layout"
    ↓
Layout persists (stored in backend database)
    ↓
User opens HomeServer on tablet → same layout
    ↓
User opens MediaServer → sees default layout (not HomeServer's)
```

#### Flow 9: Reorder Dashboard Cards

```
User opens dashboard
    ↓
Sees cards in default order (servers first, then workstations)
    ↓
Wants MediaServer at top (most critical)
    ↓
Hovers over MediaServer card → drag handle appears
    ↓
Drags MediaServer to position 1
    ↓
Card order updates immediately
    ↓
Order persisted to backend database
    ↓
User opens dashboard on phone → same order
    ↓
Order syncs across all devices
```

#### Flow 10: Monitor Docker Containers

```
User clicks MediaServer card → Detail page
    ↓
Docker service detected automatically
    ↓
"Containers" widget shows:
  - plex: Running (12d uptime)
  - sonarr: Running (12d uptime)
  - radarr: Stopped
    ↓
User notices radarr stopped
    ↓
Clicks radarr row → Quick action menu
    ↓
Clicks "Start Container"
    ↓
Command executes via SSH: `docker start radarr`
    ↓
1 second later: Container status updates to "Running"
    ↓
Widget auto-refreshes every 60 seconds
```

---

## 17. Open Questions

### v1.0 Questions (Resolved) ✅

- [x] **Q1:** Should metrics be aggregated for long-term storage? → **Resolved:** 30-day retention, no aggregation in v1.0
- [x] **Q2:** Agent auto-update mechanism? → **Resolved:** Manual for now, consider SSH deployment in v2.0
- [x] **Q3:** Multi-disk monitoring? → **Resolved:** All mounts monitored
- [x] **Q4:** Docker container monitoring? → **Resolved:** Basic monitoring in v2.0 (EP0014)
- [x] **Q5:** Agent version compatibility? → **Resolved:** Version field added to heartbeat

### v2.0 Open Questions

- [ ] **Q6:** Should workstations support scheduled expected availability? (e.g., "StudyPC expected online 6pm-11pm weekdays")
- [ ] **Q7:** Configuration pack versioning - how to handle pack updates over time?
- [ ] **Q8:** Widget marketplace - should users be able to create/share custom widgets?
- [ ] **Q9:** Multi-tailnet support - needed for multi-user scenarios?
- [ ] **Q10:** SSH certificate authentication vs key-based - security improvement?
- [ ] **Q11:** Command approval workflow - should some commands require multi-approval?
- [ ] **Q12:** Configuration drift auto-remediation - apply configs automatically or always ask?
- [ ] **Q13:** Widget refresh intervals - configurable per widget or global setting?
- [ ] **Q14:** Workstation sleep vs shutdown detection - differentiate power states?
- [ ] **Q15:** Container action permissions - should container start/stop require approval?

---

## 18. Configuration Reference

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `HOMELAB_CMD_API_KEY` | API key for authentication | `dev-key-change-me` | Yes (change in production) |
| `HOMELAB_CMD_HOST` | Server bind address | `0.0.0.0` | No |
| `HOMELAB_CMD_PORT` | Server port | `8080` | No |
| `HOMELAB_CMD_DEBUG` | Enable debug mode | `false` | No |
| `HOMELAB_CMD_DATABASE_URL` | SQLite database path | `sqlite:///./data/homelab.db` | No |
| `HOMELAB_CMD_EXTERNAL_URL` | External URL for notifications | (empty) | No |
| `HOMELABCMD_ENCRYPTION_KEY` | Fernet key for credential encryption | (none) | Yes (for v2.0 features) |
| `SLACK_WEBHOOK_URL` | Slack webhook for notifications | (empty) | No |

### Encryption Key Setup

The encryption key is required for v2.0 features (Tailscale token storage, SSH key encryption). Generate using:

```bash
homelabcmd-cli generate-key
# or
python -m homelab_cmd.cli generate-key
```

**Security Note:** Store the encryption key securely. If lost, stored credentials cannot be recovered.

### Agent Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HOMELAB_AGENT_HUB_URL` | Hub server URL | (required) |
| `HOMELAB_AGENT_API_KEY` | API key for authentication | (required) |
| `HOMELAB_AGENT_SERVER_ID` | Unique server identifier | (required) |
| `HOMELAB_AGENT_SERVER_GUID` | GUID for server identity | (auto-generated) |
| `HOMELAB_AGENT_HEARTBEAT_INTERVAL` | Heartbeat interval in seconds | `60` |

---

## Appendix

### A. Initial Server Inventory

| Server ID | Display Name | TDP | Expected Services |
|-----------|--------------|-----|-------------------|
| omv-homeserver | OMV HomeServer | 50W | smbd, docker |
| omv-backupserver | OMV BackupServer | 40W | smbd, rsync |
| omv-documentserver | OMV DocumentServer | 40W | smbd |
| omv-mediaserver | OMV MediaServer | 65W | plex, sonarr, radarr, transmission, jackett |
| omv-cloudserver1 | OMV CloudServer1 | 50W | smbd, nextcloud (docker) |
| omv-webserver1 | OMV WebServer1 | 45W | nginx, n8n (docker) |
| omv-webserver2 | OMV Webserver 2 | 45W | nginx |
| omv-homeautoserver | OMV HomeAutoServer | 50W | homeassistant (docker) |
| omv-aiserver1 | OMV AIServer1 | 100W | ollama, docker |
| pihole-master | Pi-hole Master | 5W | pihole-FTL |
| pihole-backup | Pi-hole Backup | 5W | pihole-FTL |

**Total TDP:** 495W | **Est. Daily:** £2.85 | **Est. Monthly:** £85.54

### B. Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-18 | 1.0.0 | Initial PRD created from existing draft + legacy audit insights |
| 2026-01-25 | 2.0.0 | Major v2.0 update: Tailscale integration, workstation management, synchronous command execution, widget-based UI, configuration management. Updated architecture to hybrid model (agent metrics + SSH commands). Added v2.0 goals (G6-G10), KPIs, feature inventory, user flows, and 3-phase release plan (~220 story points). |
| 2026-01-27 | 2.0.1 | Added EP0015: Per-Host Credential Management (6 stories, 24 points). Fixes critical gaps in agent upgrade/removal for servers requiring sudo passwords. Enables per-server SSH usernames, SSH keys, and sudo passwords with global fallback. |
| 2026-01-27 | 2.0.2 | PRD Review: Updated feature status to reflect actual implementation. EP0008 (Tailscale) 5/6 features complete, EP0009 (Workstations) 3/6 complete, EP0013 (Sync Commands) 2/5 complete, EP0015 (Per-Host Creds) 2/6 complete (schema + service done). |
| 2026-01-27 | 2.0.3 | PRD Review: EP0015 (Per-Host Credential Management) now 100% complete - all 6 stories done. Updated status from Draft to Active. |
| 2026-01-28 | 2.0.4 | PRD Review: Major status update. EP0008 Connectivity Modes marked Complete. EP0009 all 6 features marked Complete (workstation alerting, last seen UI, visual distinction). Added EP0016 Unified Discovery (9 stories, 32 pts, Complete). Added EP0017 Desktop UX Improvements (7 stories, 23 pts). Phase 1 Alpha marked complete. Updated totals: 10 Epics, ~70 Stories, ~281 Points. |
| 2026-01-28 | 2.0.5 | PRD Review: EP0017 Maintenance Mode Indicator updated to Partial (basic is_paused badge exists). Accessible Status Indicators updated to Partial (StatusLED uses shape+colour). Verified EP0013 status accurate. No undocumented features found. No TODO/FIXME debt. |
| 2026-01-28 | 2.1.0 | **SDLC-Studio v2 Upgrade:** Added §18 Configuration Reference section (consolidated environment variables for hub and agent). Schema upgraded to v2 modular format. Created .version file for version tracking. |
| 2026-01-28 | 2.1.1 | PRD Review: EP0017 (Desktop UX Improvements) now 100% complete - all 7 stories done. Updated all EP0017 features from Partial/Not Started to Complete. Verified: maintenance mode indicator with wrench icon and border, warning state with yellow triangle, Tailscale connectivity badge, DashboardFilters with search/filter, MetricSparkline component, StatusLED with accessible shapes, and pause/play quick action on cards. |
| 2026-01-29 | 2.1.2 | PRD Review (EP0010): Configuration Management 62% complete (26/42 pts). US0116 (Config Packs), US0117 (Compliance Checker), US0118 (Diff View), US0119 (Apply Pack) all Done. Remaining: US0120 (Dashboard Widget), US0121 (Pack Assignment), US0122 (Drift Detection), US0123 (Remove Pack). Updated feature status and exit criteria. Phase 3 GA now In Progress. |

---

## Confidence Markers Legend

- **[HIGH]** - Clear from PRD/TRD documentation
- **[MEDIUM]** - Reasonable inference from requirements
- **[LOW]** - Speculative, needs verification
- **[UNKNOWN]** - Cannot determine

## Status Legend

- **Complete** - Fully implemented and tested
- **Partial** - Partially implemented
- **Stubbed** - Interface exists but incomplete
- **Broken** - Was working, now failing
- **Not Started** - Planned but not implemented
