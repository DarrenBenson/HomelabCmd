# Product Requirements Document

**Project:** HomelabCmd
**Version:** 1.0.0
**Status:** Draft
**Last Updated:** 2026-01-18
**Author:** Darren / Claude
**TRD Reference:** [HomelabCmd-trd.md](HomelabCmd-trd.md)

---

## 1. Executive Summary

### Vision

HomelabCmd is a self-hosted monitoring and management platform that provides homelab operators with unified visibility into their server fleet, automated issue detection, and intelligent remediation capabilities—all from a single, clean dashboard.

### Problem Statement

Managing a homelab with multiple servers (OMV boxes, Raspberry Pis, various services) currently requires:

- **Fragmented monitoring:** Checking individual server dashboards, SSH sessions, or relying on basic uptime tools like UptimeKuma that only confirm "is it responding?"
- **Reactive troubleshooting:** Discovering problems only when services fail noticeably (Plex stops working, Pi-hole stops resolving)
- **Manual intervention:** Every issue requires SSH access, manual diagnosis, and manual remediation
- **No resource visibility:** No consolidated view of CPU, RAM, disk usage across the fleet; capacity issues discovered too late
- **Unknown costs:** No insight into electricity costs of running 24/7 infrastructure
- **Invisible transient devices:** Laptops and desktops on the network have no audit trail

### Solution

A lightweight, Docker-deployed monitoring hub with:

1. **Agents** on each server pushing metrics and service status
2. **Centralised dashboard** showing fleet health at a glance
3. **Intelligent alerting** based on configurable thresholds
4. **Automated remediation** with approval workflow (or auto-approve when trusted)
5. **Cost tracking** based on power consumption estimates
6. **Ad-hoc scanning** for non-permanent network devices

### Value Proposition

| Current State | With HomelabCmd |
|---------------|-------------------|
| Check 10+ dashboards/SSH sessions | Single unified view |
| Discover issues when services fail | Proactive alerts before failure |
| Manual SSH + systemctl for every fix | One-click remediation from dashboard |
| No idea what's using resources | Real-time and historical metrics |
| Unknown electricity costs | Daily/monthly cost estimates |
| No visibility into laptops/desktops | On-demand device audits |

---

## 2. Goals and Success Metrics

### Primary Goals

| Goal | Description | Success Metric |
|------|-------------|----------------|
| **G1** | Unified visibility | All servers visible on single dashboard |
| **G2** | Proactive alerting | 90% of issues detected before user-reported failure |
| **G3** | Reduced MTTR | Mean time to remediation < 5 minutes for common issues |
| **G4** | Cost awareness | Accurate monthly cost estimate within 10% of actual |
| **G5** | Fleet audit | Complete inventory of all network devices on demand |

### Secondary Goals

| Goal | Description |
|------|-------------|
| **G6** | Minimal maintenance overhead—agents should "just work" |
| **G7** | Low resource footprint—hub and agents shouldn't impact server performance |
| **G8** | Self-contained deployment—no external dependencies or cloud services |

### Key Performance Indicators (KPIs)

| KPI | Target | Measurement |
|-----|--------|-------------|
| Dashboard load time | < 2 seconds | Browser performance |
| Agent heartbeat success rate | > 99.5% | Missed heartbeats / total expected |
| Alert-to-notification latency | < 2 minutes | Time from threshold breach to Slack message |
| False positive alert rate | < 5% | Alerts closed without action / total alerts |
| Remediation success rate | > 95% | Successful auto-remediations / attempted |

---

## 3. User Personas

### Primary Persona: Homelab Operator (Darren)

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

### Secondary Persona: Family Member

**Background:**
- Non-technical user who relies on homelab services (Plex, file shares)
- Notices when things break but can't diagnose or fix

**Goals:**
- Services just work
- Know when things are being fixed

**Relevance to Product:**
- Drives requirement for proactive monitoring (fix before they notice)
- Potential future: read-only status page showing "all systems operational"

---

## 4. User Stories

### Epic 1: Server Monitoring

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| US-1.1 | As a homelab operator, I want to see all my servers on a single dashboard so I can assess fleet health at a glance | P0 | Dashboard displays all registered servers with status indicator (online/offline), last seen time, and key metrics |
| US-1.2 | As a homelab operator, I want to see real-time CPU, RAM, and disk usage for each server so I can identify resource constraints | P0 | Each server card shows current CPU %, RAM %, Disk % with visual indicators |
| US-1.3 | As a homelab operator, I want to see historical metrics over time so I can identify trends and patterns | P1 | Server detail view shows 24h/7d/30d charts for key metrics |
| US-1.4 | As a homelab operator, I want to see server uptime so I know which servers have been rebooted recently | P1 | Uptime displayed on server card (e.g., "↑ 42d") |
| US-1.5 | As a homelab operator, I want to see OS and hardware information so I can maintain an accurate inventory | P2 | Server detail shows OS distribution, version, kernel, architecture |

### Epic 2: Service Monitoring

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| US-2.1 | As a homelab operator, I want to define expected services for each server so I'm alerted when critical services stop | P0 | Can configure list of expected services per server with critical flag |
| US-2.2 | As a homelab operator, I want to see service status (running/stopped/failed) for each server so I can quickly identify service issues | P0 | Server detail view lists all monitored services with current status |
| US-2.3 | As a homelab operator, I want to restart a service from the dashboard so I don't need to SSH into the server | P1 | "Restart" button on stopped services queues restart action |
| US-2.4 | As a homelab operator, I want to see service resource usage (CPU/RAM) so I can identify resource-hungry services | P2 | Service list shows memory and CPU per service where available |

### Epic 3: Alerting

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| US-3.1 | As a homelab operator, I want to be alerted when a server goes offline so I can investigate quickly | P0 | Alert generated when no heartbeat received for configurable period (default 3 min) |
| US-3.2 | As a homelab operator, I want to be alerted when disk usage exceeds a threshold so I can prevent disk-full failures | P0 | Alert generated at warning (80%) and critical (90%) thresholds |
| US-3.3 | As a homelab operator, I want to be alerted when a critical service stops so I can restore service quickly | P0 | Alert generated when service marked as critical changes to stopped/failed |
| US-3.4 | As a homelab operator, I want to receive alerts via Slack so I'm notified on my existing channel | P0 | Slack webhook sends formatted message to configured channel |
| US-3.5 | As a homelab operator, I want to configure alert thresholds so I can tune sensitivity to my environment | P1 | Settings page allows threshold configuration for disk, RAM, CPU |
| US-3.6 | As a homelab operator, I want to acknowledge alerts so I know which issues I'm aware of vs new issues | P1 | Can acknowledge alert from dashboard; acknowledged alerts visually distinct |
| US-3.7 | As a homelab operator, I want to see alert history so I can review past issues and patterns | P2 | Alert history view with filtering by server, severity, status |
| US-3.8 | As a homelab operator, I want to be notified when security updates are available so I can keep servers patched | P2 | Alert generated when server reports security updates available |

### Epic 4: Automated Remediation

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| US-4.1 | As a homelab operator, I want the system to suggest remediation actions for common issues so I don't have to remember the fix | P1 | Alerts for known issues (service down, disk full) include suggested action |
| US-4.2 | As a homelab operator, I want to approve remediation actions before they execute so I maintain control | P0 | Actions queue in "pending" state; dashboard shows approve/reject buttons |
| US-4.3 | As a homelab operator, I want to enable auto-approve for trusted actions so routine fixes happen automatically | P1 | Configuration option to auto-approve specific action types (e.g., service restart) |
| US-4.4 | As a homelab operator, I want to see remediation history so I have an audit trail of automated changes | P1 | Action history view showing all queued/executed actions with results |
| US-4.5 | As a homelab operator, I want to be notified when remediation occurs so I know the system took action | P1 | Slack notification sent on remediation execution with outcome |
| US-4.6 | As a homelab operator, I want remediation to include: restart service, clear logs, apply updates | P1 | These three action types implemented and functional |

### Epic 5: Cost Tracking

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| US-5.1 | As a homelab operator, I want to see estimated electricity cost per server so I understand running costs | P1 | Each server shows daily/monthly cost estimate based on TDP and uptime |
| US-5.2 | As a homelab operator, I want to see total homelab electricity cost so I can budget appropriately | P1 | Dashboard summary shows total daily/monthly cost across all servers |
| US-5.3 | As a homelab operator, I want to configure TDP per server so cost estimates are accurate | P1 | Server settings include TDP (watts) field |
| US-5.4 | As a homelab operator, I want to configure electricity rate so costs reflect my actual tariff | P1 | Global setting for electricity cost per kWh (default £0.24) |

### Epic 6: Ad-hoc Device Scanning

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| US-6.1 | As a homelab operator, I want to scan a transient device (laptop/desktop) to audit its configuration | P2 | Can initiate scan by hostname/IP; scan collects system info via SSH |
| US-6.2 | As a homelab operator, I want to see scan results including OS, disk usage, installed software | P2 | Scan results displayed with collected information |
| US-6.3 | As a homelab operator, I want to discover devices on my network so I know what's connected | P2 | Network discovery shows devices with hostname, IP, MAC where detectable |
| US-6.4 | As a homelab operator, I want to save scan results so I can compare over time | P2 | Scan history stored and viewable |

### Epic 7: Configuration & Administration

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| US-7.1 | As a homelab operator, I want to register new servers easily so I can expand my monitored fleet | P0 | Add server form or auto-registration on first agent heartbeat |
| US-7.2 | As a homelab operator, I want to remove servers that are decommissioned so the dashboard stays clean | P1 | Delete server option removes server and associated data |
| US-7.3 | As a homelab operator, I want to configure Slack webhook URL so notifications go to my channel | P0 | Settings page for Slack webhook configuration |
| US-7.4 | As a homelab operator, I want the system to be self-contained in Docker so deployment is simple | P0 | Single docker-compose up brings up fully functional system |
| US-7.5 | As a homelab operator, I want data to persist across container restarts so I don't lose history | P0 | Database and config stored in mounted volume |

---

## 5. Functional Requirements

### FR1: Server Registration and Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1.1 | System shall allow manual registration of servers via dashboard | P0 |
| FR1.2 | System shall auto-register servers on first agent heartbeat if not already registered | P1 |
| FR1.3 | System shall store server metadata: ID, display name, hostname, IP, MAC, TDP, location, tags | P0 |
| FR1.4 | System shall track server status: online, offline, unknown | P0 |
| FR1.5 | System shall mark server offline if no heartbeat received within configurable threshold (default 180s) | P0 |
| FR1.6 | System shall allow editing of server configuration | P1 |
| FR1.7 | System shall allow deletion of servers with associated data cleanup | P1 |

### FR2: Metrics Collection

| ID | Requirement | Priority |
|----|-------------|----------|
| FR2.1 | Agent shall collect system metrics every heartbeat interval (default 60s) | P0 |
| FR2.2 | Metrics collected shall include: CPU %, RAM %, RAM used/total, Disk %, Disk used/total, Network RX/TX, Load averages (1/5/15m), Uptime | P0 |
| FR2.3 | Agent shall collect OS information: distribution, version, kernel, architecture | P1 |
| FR2.4 | Agent shall detect available package updates including security updates | P2 |
| FR2.5 | System shall store metrics time-series data with server ID and timestamp | P0 |
| FR2.6 | System shall retain metrics for configurable period (default 30 days) | P1 |
| FR2.7 | System shall prune old metrics automatically | P1 |

### FR3: Service Monitoring

| ID | Requirement | Priority |
|----|-------------|----------|
| FR3.1 | System shall allow configuration of expected services per server | P0 |
| FR3.2 | Each expected service shall have a "critical" flag indicating alert priority | P0 |
| FR3.3 | Agent shall check status of configured services via systemctl | P0 |
| FR3.4 | Agent shall report service status: running, stopped, failed, unknown | P0 |
| FR3.5 | Agent shall report service resource usage (PID, memory, CPU) where available | P2 |
| FR3.6 | System shall store service status snapshots with timestamps | P1 |

### FR4: Alerting Engine

| ID | Requirement | Priority |
|----|-------------|----------|
| FR4.1 | System shall generate alerts when configurable thresholds are breached | P0 |
| FR4.2 | Default thresholds: Disk warning 80%, Disk critical 90%, RAM warning 85%, CPU warning 90% | P0 |
| FR4.3 | System shall generate alert when server goes offline (no heartbeat) | P0 |
| FR4.4 | System shall generate alert when critical service stops | P0 |
| FR4.5 | Alerts shall have severity levels: critical, high, medium, low | P0 |
| FR4.6 | Alerts shall have status: open, acknowledged, resolved | P0 |
| FR4.7 | System shall auto-resolve alerts when condition clears | P1 |
| FR4.8 | System shall avoid duplicate alerts for ongoing conditions | P1 |
| FR4.9 | System shall allow manual acknowledgement and resolution of alerts | P1 |

### FR5: Notifications

| ID | Requirement | Priority |
|----|-------------|----------|
| FR5.1 | System shall send Slack notifications via webhook | P0 |
| FR5.2 | Notifications shall include: severity, server name, alert title, message, timestamp | P0 |
| FR5.3 | Slack messages shall use colour-coded attachments (red=critical, orange=high, yellow=medium) | P1 |
| FR5.4 | System shall allow configuration of which severity levels trigger notifications | P1 |
| FR5.5 | System shall notify on remediation execution and outcome | P1 |
| FR5.6 | System shall not send duplicate notifications for the same alert | P1 |

### FR6: Remediation Engine

| ID | Requirement | Priority |
|----|-------------|----------|
| FR6.1 | System shall support remediation action types: restart_service, clear_logs, apply_updates, custom | P1 |
| FR6.2 | Remediation actions shall have status: pending, approved, executing, completed, failed, rejected | P1 |
| FR6.3 | System shall queue remediation actions in pending state by default | P0 |
| FR6.4 | System shall allow manual approval or rejection of pending actions | P0 |
| FR6.5 | System shall support auto-approve configuration per action type | P1 |
| FR6.6 | When auto-approve enabled, matching actions shall skip pending state | P1 |
| FR6.7 | Approved actions shall be delivered to agent via heartbeat response | P1 |
| FR6.8 | Agent shall execute approved actions and report results | P1 |
| FR6.9 | System shall store complete audit trail of all actions | P1 |
| FR6.10 | Agent shall only execute whitelisted command patterns for security | P0 |

### FR7: Cost Tracking

| ID | Requirement | Priority |
|----|-------------|----------|
| FR7.1 | System shall calculate estimated power cost per server: (TDP_watts / 1000) × hours × rate_per_kwh | P1 |
| FR7.2 | System shall allow configuration of TDP (watts) per server | P1 |
| FR7.3 | System shall allow configuration of electricity rate (default £0.24/kWh) | P1 |
| FR7.4 | System shall display daily, monthly, and yearly cost estimates | P1 |
| FR7.5 | System shall calculate total fleet cost | P1 |

### FR8: Ad-hoc Scanning

| ID | Requirement | Priority |
|----|-------------|----------|
| FR8.1 | System shall support SSH-based scanning of devices without agents | P2 |
| FR8.2 | Scan shall collect: OS info, disk usage, memory, CPU, network config, running processes | P2 |
| FR8.3 | System shall store SSH credentials (key-based) securely | P2 |
| FR8.4 | Scan results shall be stored with timestamp | P2 |
| FR8.5 | System shall support network device discovery via ARP/ping scan | P2 |

### FR9: Dashboard & UI

| ID | Requirement | Priority |
|----|-------------|----------|
| FR9.1 | Dashboard shall display summary bar: online count, offline count, warning count, total cost | P0 |
| FR9.2 | Dashboard shall display server cards in grid layout | P0 |
| FR9.3 | Server cards shall show: status indicator, name, CPU %, RAM %, Disk %, uptime | P0 |
| FR9.4 | Server cards shall visually indicate warnings (e.g., disk > 80%) | P1 |
| FR9.5 | Dashboard shall display recent alerts section | P0 |
| FR9.6 | Dashboard shall display pending actions section | P1 |
| FR9.7 | Clicking server card shall navigate to server detail view | P0 |
| FR9.8 | Server detail view shall show metrics charts, services list, alerts, cost estimate | P1 |
| FR9.9 | UI shall be responsive (functional on tablet/mobile) | P2 |
| FR9.10 | UI shall support dark mode | P2 |

### FR10: API

| ID | Requirement | Priority |
|----|-------------|----------|
| FR10.1 | System shall expose REST API for all functionality | P0 |
| FR10.2 | API shall require authentication via X-API-Key header | P0 |
| FR10.3 | API shall provide OpenAPI 3.1 specification | P1 |
| FR10.4 | API shall provide Swagger UI for interactive documentation | P1 |

---

## 6. Non-Functional Requirements

### NFR1: Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR1.1 | Dashboard initial load time | < 2 seconds |
| NFR1.2 | API response time (p50) | < 100ms |
| NFR1.3 | API response time (p95) | < 500ms |
| NFR1.4 | Agent heartbeat processing time | < 50ms |
| NFR1.5 | Agent memory footprint | < 50MB |
| NFR1.6 | Agent CPU usage (idle) | < 1% |

### NFR2: Reliability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR2.1 | Hub availability | 99% uptime |
| NFR2.2 | Agent heartbeat success rate | > 99.5% |
| NFR2.3 | Data durability | No data loss on container restart |
| NFR2.4 | Graceful degradation | Dashboard functional if some agents offline |

### NFR3: Scalability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR3.1 | Supported server count | 5-50 servers |
| NFR3.2 | Metrics retention | 30 days at 1-minute granularity |
| NFR3.3 | Database size growth | < 200MB/month |
| NFR3.4 | Concurrent dashboard users | 1-5 (single-user optimised) |

### NFR4: Security

| ID | Requirement |
|----|-------------|
| NFR4.1 | API authentication required for all endpoints |
| NFR4.2 | Agent commands restricted to whitelist |
| NFR4.3 | No external network dependencies (LAN-only operation) |
| NFR4.4 | Secrets stored in environment variables, not config files |
| NFR4.5 | SQL injection prevented via parameterised queries |

### NFR5: Usability

| ID | Requirement |
|----|-------------|
| NFR5.1 | Agent installation via single command (curl pipe bash) |
| NFR5.2 | Hub deployment via single docker-compose command |
| NFR5.3 | Zero-configuration agent (auto-registers with hub) |
| NFR5.4 | Clear visual hierarchy in dashboard |
| NFR5.5 | Colour-coded status indicators (green/yellow/red) |

### NFR6: Maintainability

| ID | Requirement |
|----|-------------|
| NFR6.1 | Codebase follows Python/TypeScript best practices |
| NFR6.2 | API documented via OpenAPI |
| NFR6.3 | Database schema versioned |
| NFR6.4 | Logs available for debugging |
| NFR6.5 | Health check endpoint for container orchestration |

---

## 7. User Experience

### Information Architecture

```
HomelabCmd
├── Dashboard (home)
│   ├── Summary bar
│   ├── Server grid
│   ├── Recent alerts
│   └── Pending actions
├── Servers
│   ├── Server list (table view)
│   ├── Server detail
│   │   ├── Overview tab
│   │   ├── Metrics tab (charts)
│   │   ├── Services tab
│   │   ├── Alerts tab
│   │   └── Actions tab
│   └── Add server
├── Alerts
│   ├── Active alerts
│   ├── Alert history
│   └── Alert detail
├── Actions
│   ├── Pending actions
│   ├── Action history
│   └── Action detail
├── Scans
│   ├── Initiate scan
│   ├── Scan history
│   ├── Network discovery
│   └── Scan results
├── Costs
│   ├── Cost summary
│   └── Cost by server
└── Settings
    ├── General
    ├── Thresholds
    ├── Notifications (Slack)
    ├── Remediation
    └── Costs (electricity rate)
```

### Key Interaction Flows

#### Flow 1: Daily Health Check

```
User opens dashboard
    │
    ▼
Sees summary bar: "9 Online, 1 Offline, 2 Warnings"
    │
    ▼
Notices BackupServer card shows offline
    │
    ▼
Clicks card → Server detail
    │
    ▼
Sees "Last seen: 15 minutes ago"
    │
    ▼
Investigates (SSH, physical check)
```

#### Flow 2: Respond to Alert

```
Slack notification: "🚨 Critical: plex service stopped on MediaServer"
    │
    ▼
User opens dashboard
    │
    ▼
Sees alert in "Recent Alerts" with suggested action
    │
    ▼
Clicks "Approve" on pending "Restart plex" action
    │
    ▼
Action executes, notification confirms success
    │
    ▼
Alert auto-resolves when service running
```

#### Flow 3: Enable Auto-Remediation

```
User navigates to Settings → Remediation
    │
    ▼
Enables "Auto-approve" toggle
    │
    ▼
Selects action types: ✓ restart_service, ✓ clear_logs, ✗ apply_updates
    │
    ▼
Saves settings
    │
    ▼
Future service failures auto-remediated with notification only
```

#### Flow 4: Audit a Laptop

```
User navigates to Scans → Initiate Scan
    │
    ▼
Enters hostname: "darren-laptop" or IP: "192.168.1.150"
    │
    ▼
Selects scan type: "Full"
    │
    ▼
Clicks "Start Scan"
    │
    ▼
Scan runs (30-60 seconds)
    │
    ▼
Results displayed: OS, disk usage, installed packages, running processes
    │
    ▼
Results saved to scan history
```

### Visual Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Glanceability** | Status visible in < 2 seconds; colour-coded indicators |
| **Information density** | Show key metrics on cards; detail on drill-down |
| **Consistency** | Same card layout for all servers; consistent icons |
| **Actionability** | Actions clearly labelled; approve/reject buttons prominent |
| **Minimalism** | No decorative elements; functional UI |

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

## 8. Release Plan

### Phase 1: MVP (Minimum Viable Product)

**Target:** 2-3 weeks

**Scope:**
- FastAPI backend with SQLite
- Agent with metrics collection
- Basic React dashboard
- Server registration and status
- Metrics collection and display
- Server cards with status indicators

**Exit Criteria:**
- Can register 10 servers
- Agents send heartbeats successfully
- Dashboard shows all servers with current metrics
- Data persists across restarts

**Not Included:**
- Alerting
- Service monitoring
- Remediation
- Notifications

---

### Phase 2: Alerting & Notifications

**Target:** 1-2 weeks after Phase 1

**Scope:**
- Threshold configuration
- Alert generation engine
- Alert management (acknowledge, resolve)
- Slack webhook integration
- Recent alerts on dashboard

**Exit Criteria:**
- Alerts generated on threshold breach
- Slack notifications delivered
- Can acknowledge/resolve alerts
- Alert history viewable

---

### Phase 3: Service Monitoring

**Target:** 1-2 weeks after Phase 2

**Scope:**
- Expected services configuration
- Agent service status collection
- Service display in server detail
- Service-down alerts
- Manual service restart queueing

**Exit Criteria:**
- Can configure expected services per server
- Service status visible on dashboard
- Alerts on critical service failure
- Restart action can be queued

---

### Phase 4: Remediation Engine

**Target:** 2 weeks after Phase 3

**Scope:**
- Remediation action queue
- Approval workflow (pending → approved → executing → completed)
- Agent command execution
- Auto-approve configuration
- Action audit log
- Remediation notifications

**Exit Criteria:**
- Can approve/reject pending actions
- Actions execute on target servers
- Auto-approve mode functional
- Complete audit trail

---

### Phase 5: Cost Tracking

**Target:** 1 week after Phase 4

**Scope:**
- TDP configuration per server
- Electricity rate configuration
- Cost calculation engine
- Cost display (per server, total)
- Cost dashboard widget

**Exit Criteria:**
- Cost estimates displayed accurately
- Can configure TDP and rate

---

### Phase 6: Ad-hoc Scanning

**Target:** 1-2 weeks after Phase 5

**Scope:**
- SSH-based scanner
- Scan initiation UI
- Scan results display
- Network discovery
- Scan history

**Exit Criteria:**
- Can scan devices without agents
- Results stored and viewable
- Network discovery functional

---

### Future Considerations (Post v1.0)

| Feature | Description | Priority |
|---------|-------------|----------|
| pfSense monitoring | API-based monitoring for pfSense firewall | Medium |
| Docker container monitoring | Container status and resource usage | Medium |
| Multi-disk monitoring | Track all mounted volumes | Medium |
| Agent auto-update | Hub pushes agent updates | Low |
| Read-only status page | Family-friendly "all systems go" view | Low |
| Mobile app | Native iOS/Android app | Low |
| Grafana export | Export metrics to Grafana | Low |

---

## 9. Dependencies and Risks

### Dependencies

| Dependency | Type | Impact | Mitigation |
|------------|------|--------|------------|
| Python 3.11+ on target servers | Technical | Agents won't run on older Python | Document requirement; most modern distros included |
| Network connectivity (LAN) | Infrastructure | Agents can't reach hub | Hub should be highly available; timeout handling |
| systemd on target servers | Technical | Service monitoring won't work | All target servers (OMV, Debian, RPi OS) use systemd |
| SSH access for ad-hoc scans | Configuration | Scans will fail | Document SSH key setup; handle errors gracefully |
| Slack webhook | External | Notifications won't work | Slack free tier sufficient; webhook is stable API |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Agent causes performance issues on target | Low | High | Lightweight design; configurable interval; monitoring of agent itself |
| False positive alerts create noise | Medium | Medium | Tunable thresholds; alert deduplication; acknowledgement workflow |
| Remediation causes unintended damage | Low | High | Approval workflow by default; command whitelist; audit logging |
| Database grows too large | Low | Medium | Automatic data pruning; configurable retention |
| SSH key management for scans is complex | Medium | Low | Clear documentation; optional feature |

---

## 10. Out of Scope

The following items are explicitly **not** included in v1.0:

| Item | Reason |
|------|--------|
| Multi-user authentication | Single-user homelab; unnecessary complexity |
| Cloud/external deployment | Designed for LAN-only use |
| Windows/macOS agents | All target servers are Linux |
| pfSense monitoring | FreeBSD-based; requires different approach |
| Real-time WebSocket updates | Polling is sufficient for 60s refresh |
| Machine learning anomaly detection | Overkill for homelab scale |
| Mobile native app | Responsive web sufficient initially |
| Integration with Home Assistant | Keep separate per user preference |
| Historical trend analysis | Basic charts sufficient for v1.0 |
| Backup verification | Complex; out of scope |
| Log aggregation | Separate concern; tools like Loki exist |

---

## 11. Success Criteria

### Launch Criteria (MVP)

- [ ] All 10 initial servers registered and reporting
- [ ] Dashboard loads in < 2 seconds
- [ ] Metrics visible for all servers
- [ ] Data persists across container restarts
- [ ] Agent installation takes < 5 minutes per server

### Success Criteria (v1.0)

- [ ] All functional requirements P0/P1 implemented
- [ ] 90% of issues detected before service impact
- [ ] MTTR for common issues < 5 minutes
- [ ] Zero false negatives (missed critical issues)
- [ ] < 5% false positive rate on alerts
- [ ] Cost estimates within 10% of actual (validated over 1 month)

### Long-term Success

- [ ] System runs unattended for weeks without intervention
- [ ] User checks dashboard daily in < 30 seconds
- [ ] Auto-remediation handles 80% of routine issues
- [ ] Family members don't notice service disruptions

---

## 12. Appendices

### Appendix A: Initial Server Inventory

| Server | Hostname | IP (example) | TDP | Critical Services |
|--------|----------|--------------|-----|-------------------|
| OMV HomeServer | omv-homeserver.home.lan | 192.168.1.10 | 50W | smbd, docker |
| OMV BackupServer | omv-backupserver.home.lan | 192.168.1.11 | 40W | smbd, rsync |
| OMV DocumentServer | omv-documentserver.home.lan | 192.168.1.12 | 40W | smbd |
| OMV MediaServer | omv-mediaserver.home.lan | 192.168.1.13 | 65W | plex, sonarr, radarr, transmission, jackett |
| OMV CloudServer1 | omv-cloudserver1.home.lan | 192.168.1.14 | 50W | smbd, docker |
| OMV WebServer1 | omv-webserver1.home.lan | 192.168.1.15 | 45W | nginx, docker |
| OMV Webserver 2 | omv-webserver2.home.lan | 192.168.1.16 | 45W | nginx |
| OMV HomeAutoServer | omv-homeautoserver.home.lan | 192.168.1.17 | 50W | docker |
| OMV AIServer1 | omv-aiserver1.home.lan | 192.168.1.18 | 100W | ollama, docker |
| Pi-hole Master | pihole-master.home.lan | 192.168.1.2 | 5W | pihole-FTL |
| Pi-hole Backup | pihole-backup.home.lan | 192.168.1.3 | 5W | pihole-FTL |

### Appendix B: Slack Message Examples

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

### Appendix C: Glossary

| Term | Definition |
|------|------------|
| Agent | Lightweight script running on monitored servers that collects and reports metrics |
| Hub | Central HomelabCmd server running the API and dashboard |
| Heartbeat | Periodic message from agent to hub containing metrics and status |
| TDP | Thermal Design Power - wattage rating used for cost estimation |
| Remediation | Automated action to fix a detected issue |
| OMV | OpenMediaVault - NAS operating system used on most servers |
| Critical service | Service flagged as essential; generates high-priority alert when stopped |

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-18 | 1.0.0 | Initial PRD draft |
