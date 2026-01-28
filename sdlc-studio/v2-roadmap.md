# HomelabCmd v2.0 Implementation Roadmap

**Version:** 2.0.0
**Created:** 2026-01-26
**Owner:** Darren

---

## Executive Summary

HomelabCmd v2.0 represents a major architectural evolution from the v1.0 foundation. The upgrade introduces:

- **Hybrid Architecture:** Agent push for metrics + SSH execution for commands
- **Tailscale Integration:** Encrypted mesh networking for all connectivity
- **Workstation Support:** Monitor intermittent machines without false alerts
- **Customisable UI:** Drag-and-drop dashboard, widget-based detail views
- **Configuration Management:** Standardise machine configurations
- **Docker Monitoring:** Basic container visibility and control

**Total Effort:** 226 story points across 7 epics and 54 user stories

---

## v1.0 Status (Complete)

| Metric | Value |
|--------|-------|
| Epics | 6 complete + 1 deferred |
| Stories | 52/55 complete (94.5%) |
| Story Points | 191 delivered |
| Test Coverage | 97% backend, 90% frontend |
| Servers Monitored | 11 |

**v1.0 is production-ready and stable.**

---

## v2.0 Phase Overview

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         v2.0 IMPLEMENTATION ROADMAP                         │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Phase 1 (Alpha)         Phase 2 (Beta)          Phase 3 (GA)             │
│  ─────────────────       ─────────────────       ─────────────────        │
│  80 story points         104 story points        42 story points          │
│                                                                            │
│  EP0008 Tailscale        EP0011 Dashboard UI     EP0010 Config Mgmt       │
│  EP0009 Workstations     EP0012 Widgets          ───────────────────       │
│  EP0013 SSH Commands     EP0014 Docker           Config packs              │
│  ───────────────────     ───────────────────     Compliance checking       │
│  Foundation              UI Revolution           Drift detection           │
│  Connectivity            Customisation                                     │
│  Commands                Monitoring                                        │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Alpha (Foundation)

**Focus:** Connectivity, Command Execution, Workstation Support
**Story Points:** 80
**Prerequisites:** v1.0 Complete

### Epics

| Epic | Title | Points | Stories | Priority |
|------|-------|--------|---------|----------|
| EP0008 | Tailscale Integration | 31 | 6 | P0 |
| EP0013 | Synchronous Command Execution | 23 | 5 | P0 |
| EP0009 | Workstation Management | 26 | 7 | P0 |

### Execution Order

```
Week 1-2: EP0008 (Tailscale Integration)
├── US0076: Tailscale API Client (5 pts)
├── US0077: Device Discovery (5 pts)
├── US0078: Machine Registration via Tailscale (5 pts)
├── US0079: SSH Connection via Tailscale (8 pts)
├── US0080: Connectivity Mode Management (5 pts)
└── US0081: Credential Encryption (3 pts)

Week 3-4: EP0013 (Synchronous Command Execution)
├── US0089: SSH Executor Service (8 pts)
├── US0090: Remove Async Command Channel (3 pts)
├── US0091: Synchronous Command API (5 pts)
├── US0092: Command Whitelist (4 pts)
└── US0093: Command Audit Trail (3 pts)

Week 5-6: EP0009 (Workstation Management)
├── US0082: Machine Type Field (3 pts)
├── US0083: Workstation Registration (4 pts)
├── US0084: Workstation-Aware Alerting (5 pts)
├── US0085: Last Seen UI (4 pts)
├── US0086: Visual Distinction (3 pts)
├── US0087: Workstation Cost Tracking (5 pts)
└── US0088: Workstation Metrics (2 pts)
```

### Phase 1 Exit Criteria

- [ ] All machines connected via Tailscale or Direct SSH
- [ ] Commands execute synchronously (<5s latency)
- [ ] Workstations monitored without false offline alerts
- [ ] Credentials encrypted at rest
- [ ] Command whitelist enforced
- [ ] Agents simplified (metrics only)

### Phase 1 Deliverables

1. **Tailscale API integration** with device discovery
2. **SSH executor service** with connection pooling
3. **Machine model** updated with type (server/workstation)
4. **Workstation-aware alerting** (skip offline alerts)
5. **"Last seen" UI** for offline workstations
6. **Command audit trail** for all SSH executions

---

## Phase 2: Beta (UI Revolution)

**Focus:** Dashboard Customisation, Widgets, Docker Monitoring
**Story Points:** 104
**Prerequisites:** Phase 1 Complete

### Epics

| Epic | Title | Points | Stories | Priority |
|------|-------|--------|---------|----------|
| EP0011 | Advanced Dashboard UI | 32 | 7 | P0 |
| EP0012 | Widget-Based Detail View | 48 | 14 | P0 |
| EP0014 | Docker Container Monitoring | 24 | 7 | P1 |

### Execution Order

```
Week 7-8: EP0011 (Advanced Dashboard UI)
├── US0102: Drag-and-Drop Card Reordering (8 pts)
├── US0103: Card Order Persistence (5 pts)
├── US0104: Server/Workstation Grouping (5 pts)
├── US0105: Responsive Layout (5 pts)
├── US0106: Summary Bar (3 pts)
├── US0107: Card Visual Enhancements (3 pts)
└── US0108: Preferences Sync (3 pts)

Week 9-11: EP0012 (Widget-Based Detail View)
├── US0109: Widget Grid System (8 pts)
├── US0110: CPU Widget (3 pts)
├── US0111: Memory Widget (3 pts)
├── US0112: Load Average Widget (2 pts)
├── US0113: Disk Usage Widget (3 pts)
├── US0114: Services Widget (3 pts)
├── US0115: Containers Widget (5 pts)
├── US0116: Network Widget (3 pts)
├── US0117: System Info Widget (2 pts)
├── US0118: Layout Persistence (5 pts)
├── US0119: Default Layout (3 pts)
├── US0120: Edit Layout Mode (3 pts)
├── US0121: Widget Visibility (3 pts)
└── US0122: Responsive Widgets (3 pts)

Week 12: EP0014 (Docker Container Monitoring)
├── US0123: Docker Detection (3 pts)
├── US0124: Container Listing (5 pts)
├── US0125: Container Widget (5 pts)
├── US0126: Container Start (3 pts)
├── US0127: Container Stop (3 pts)
├── US0128: Container Restart (2 pts)
└── US0129: Container Status in Heartbeat (3 pts)
```

### Phase 2 Exit Criteria

- [ ] Dashboard cards draggable and order persists
- [ ] Detail pages show customisable widget grid
- [ ] 8 widget types implemented and functional
- [ ] Widget layouts persist per machine
- [ ] Docker containers visible and controllable
- [ ] Preferences sync across devices

### Phase 2 Deliverables

1. **Drag-and-drop dashboard** with @dnd-kit
2. **react-grid-layout** widget system
3. **8 widget types** (CPU, memory, load, disk, services, containers, network, system info)
4. **Per-machine layouts** stored in database
5. **Container widget** with start/stop/restart actions
6. **Responsive design** for tablet and mobile

---

## Phase 3: GA (Configuration Management)

**Focus:** Standardise Machine Configurations
**Story Points:** 42
**Prerequisites:** Phase 2 Complete

### Epics

| Epic | Title | Points | Stories | Priority |
|------|-------|--------|---------|----------|
| EP0010 | Configuration Management | 42 | 8 | P1 |

### Execution Order

```
Week 13-15: EP0010 (Configuration Management)
├── US0094: Pack Definitions (5 pts)
├── US0095: Compliance Checker (8 pts)
├── US0096: Diff View (5 pts)
├── US0097: Apply Pack (8 pts)
├── US0098: Compliance Widget (5 pts)
├── US0099: Pack Assignment (3 pts)
├── US0100: Drift Detection (5 pts)
└── US0101: Remove Pack (3 pts)
```

### Phase 3 Exit Criteria

- [ ] Configuration packs defined (Base, Developer Lite, Developer Max)
- [ ] Compliance checking via SSH functional
- [ ] Diff view shows configuration mismatches
- [ ] Apply pack executes configurations
- [ ] Drift detection alerts on changes
- [ ] Compliance visible on dashboard

### Phase 3 Deliverables

1. **Configuration pack YAML format** with files, packages, settings
2. **Compliance checker** via SSH
3. **Diff view** with unified diff for files
4. **One-click apply** for packs
5. **Scheduled drift detection** with alerts
6. **Compliance dashboard widget**

---

## Technology Additions

### Backend

| Library | Purpose | Phase |
|---------|---------|-------|
| asyncssh | SSH command execution | 1 |
| cryptography | Credential encryption (Fernet) | 1 |

### Frontend

| Library | Purpose | Phase |
|---------|---------|-------|
| @dnd-kit/core | Drag-and-drop cards | 2 |
| @dnd-kit/sortable | Sortable lists | 2 |
| react-grid-layout | Widget grid system | 2 |
| date-fns | Relative time ("Last seen 3h ago") | 1 |

### Database

| Table | Purpose | Phase |
|-------|---------|-------|
| credentials | Encrypted Tailscale tokens, SSH keys | 1 |
| command_audit_log | SSH command history | 1 |
| config_check | Compliance check results | 3 |
| dashboard_preference | Card order, settings | 2 |
| widget_layout | Per-machine widget layouts | 2 |

---

## Migration Strategy

### Pre-Migration Checklist

- [ ] Backup SQLite database
- [ ] Document current server inventory
- [ ] Verify Tailscale installed on all machines
- [ ] Create homelabcmd user on all machines
- [ ] Generate and distribute SSH keys
- [ ] Set HOMELABCMD_ENCRYPTION_KEY in docker-compose

### Migration Steps

1. **Update docker-compose.yml** with encryption key
2. **Deploy v2.0 hub** (replaces v1.0)
3. **Deploy simplified agents** (metrics only)
4. **Configure Tailscale API token** in settings
5. **Re-import machines** via Tailscale discovery
6. **Verify connectivity** to all machines
7. **Test SSH command execution**
8. **Mark workstations** as workstation type

### Rollback Plan

- Keep v1.0 database backup
- v1.0 agents continue to work with v2.0 hub
- Command execution can revert to async if needed (feature flag)

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tailscale API changes | High | Version-lock API client, monitor Tailscale changelog |
| SSH connection failures | High | Connection pooling, retry logic, timeout handling |
| Credential key loss | Critical | Document backup procedure, test key rotation |
| Large widget layouts | Medium | Validate layout size, compress if needed |
| Docker version differences | Low | Test on Docker CE and docker.io |

---

## Success Metrics

### Phase 1 Targets

| Metric | Target |
|--------|--------|
| Command execution latency | <5s (p95) |
| Workstation false alerts | 0 |
| SSH connection success rate | >99% |
| Credential encryption | 100% |

### Phase 2 Targets

| Metric | Target |
|--------|--------|
| Card reorder time | <2s including save |
| Widget render time | <500ms |
| Layout persistence | 100% success |
| Container action latency | <5s |

### Phase 3 Targets

| Metric | Target |
|--------|--------|
| Compliance check time | <10s per machine |
| Apply pack success rate | >95% |
| Drift detection | Daily checks |
| Pack coverage | 3 packs minimum |

---

## Timeline Summary

| Phase | Duration | Story Points | Focus |
|-------|----------|--------------|-------|
| Phase 1 | 6 weeks | 80 | Foundation |
| Phase 2 | 6 weeks | 104 | UI Revolution |
| Phase 3 | 3 weeks | 42 | Configuration |
| **Total** | **15 weeks** | **226** | |

---

**Document Status:** Complete
**Next Step:** Begin Phase 1 with EP0008 (Tailscale Integration)
