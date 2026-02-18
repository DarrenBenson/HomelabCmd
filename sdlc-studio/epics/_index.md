# Epic Registry

This document provides an overview of all Epics in the project.

**Last Updated:** 2026-02-17
**PRD Reference:** [Product Requirements Document](../prd.md)

## Summary

| Status | Count |
|--------|-------|
| Draft | 0 |
| Ready | 0 |
| Approved | 0 |
| In Progress | 0 |
| Done | 19 |
| **Total** | **19** |

## Epics

### v1.0 Epics (Complete)

| ID | Title | Status | Owner | Stories | Target |
|----|-------|--------|-------|---------|--------|
| [EP0001](EP0001-core-monitoring.md) | Core Monitoring | Done | Darren | 16 | Phase 1 (MVP) |
| [EP0002](EP0002-alerting.md) | Alerting & Notifications | Done | Darren | 7 | Phase 2 |
| [EP0003](EP0003-service-monitoring.md) | Service Monitoring | Done | Darren | 6 | Phase 3 |
| [EP0004](EP0004-remediation.md) | Remediation Engine | Done | Darren | 9 | Phase 4 |
| [EP0005](EP0005-cost-tracking.md) | Cost Tracking | Done | Darren | 8 | Phase 5 |
| [EP0006](EP0006-adhoc-scanning.md) | Ad-hoc Scanning | Done | Darren | 6 | Phase 6 |
| [EP0007](EP0007-analytics-reporting.md) | Analytics & Reporting | Done | Darren | 3 | Phase 2 |

### v2.0 Epics (New)

| ID | Title | Status | Owner | Stories | Points | Target |
|----|-------|--------|-------|---------|--------|--------|
| [EP0008](EP0008-tailscale-integration.md) | Tailscale Integration | Done | Darren | 7 | 34 | Phase 1 (Alpha) |
| [EP0009](EP0009-workstation-management.md) | Workstation Management | Done | Darren | 7 | 27 | Phase 1 (Alpha) |
| [EP0010](EP0010-configuration-management.md) | Configuration Management | Done | Darren | 8 | 42 | Phase 3 (GA) |
| [EP0011](EP0011-advanced-dashboard-ui.md) | Advanced Dashboard UI | Done | Darren | 7 | 37 | Phase 2 (Beta) |
| [EP0012](EP0012-widget-based-detail-view.md) | Widget-Based Detail View | Done | Darren | 14 | 53 | Phase 2 (Beta) |
| [EP0013](EP0013-synchronous-command-execution.md) | Synchronous Command Execution | Done | Darren | 7 | 31 | Phase 1 (Alpha) |
| [EP0014](EP0014-docker-container-monitoring.md) | Docker Container Monitoring | Done | Darren | 7 | 24 | Phase 2 (Beta) |
| [EP0015](EP0015-per-host-credential-management.md) | Per-Host Credential Management | Done | Darren | 6 | 24 | Phase 1 (Alpha) |
| [EP0016](EP0016-unified-discovery.md) | Unified Discovery Experience | Done | Darren | 9 | 32 | Phase 2 (Beta) |
| [EP0017](EP0017-desktop-ux-improvements.md) | Desktop UX Improvements | Done | Darren | 7 | 23 | Phase 2 (Beta) |
| [EP0018](EP0018-dashboard-ux-simplification.md) | Dashboard UX Simplification | Done | Darren | 4 | 13 | Phase 2 (Beta) |
| [EP0019](EP0019-unified-device-discovery.md) | Unified Device Discovery | Done | Darren | 5 | 22 | Phase 2 (Beta) |

## By Status

### Done (v1.0)

- **EP0001: Core Monitoring** - Server registration, agent deployment, metrics collection, dashboard (16/16 stories)
- **EP0002: Alerting & Notifications** - Threshold alerts, Slack notifications, alert lifecycle (7/7 stories)
- **EP0003: Service Monitoring** - systemd service status, expected services, service-down alerts (6/6 stories)
- **EP0004: Remediation Engine** - Action queue, approval workflow, agent command execution (9/9 stories)
- **EP0005: Cost Tracking** - TDP configuration, electricity rate, cost estimates, machine categories, usage-based power (8/8 stories)
- **EP0006: Ad-hoc Scanning** - SSH-based scanning, network discovery, scan history (6/6 stories)

### Done (v2.0)

- **EP0008: Tailscale Integration** - Tailscale API, device discovery, SSH via Tailscale, credential encryption (7/7 stories)
- **EP0009: Workstation Management** - Machine types, workstation-aware alerting, last seen UI, workstation cost tracking (7/7 stories)
- **EP0010: Configuration Management** - Config packs, compliance checking, diff view, apply packs, drift detection (8/8 stories)
- **EP0013: Synchronous Command Execution** - SSH executor, command API, whitelist enforcement, audit trail, remote agent mode switch (6/6 stories)
- **EP0015: Per-Host Credential Management** - Per-server SSH credentials, credential service, agent upgrade/removal sudo support (6/6 stories)
- **EP0016: Unified Discovery Experience** - Consolidated discovery page, unified device cards, SSH testing, unified import (9/9 stories)
- **EP0017: Desktop UX Improvements** - Maintenance mode indicator, warning state visual, Tailscale/SSH badges, search/filter, sparklines, accessibility, quick actions (7/7 stories)
- **EP0018: Dashboard UX Simplification** - FleetStatus component, header streamlining, type filter removal, cleanup (4/4 stories)
- **EP0019: Unified Device Discovery** - Single pane of glass for Network and Tailscale discovery with device merging (5/5 stories)
- **EP0014: Docker Container Monitoring** - Docker detection, container listing, container widget, start/stop/restart, heartbeat status (7/7 stories)
- **EP0007: Analytics & Reporting** - Tiered data retention, 12-month trends, data export (3/3 stories)
- **EP0011: Advanced Dashboard UI** - Drag-and-drop cards, card order persistence, server/workstation grouping (7/7 stories)
- **EP0012: Widget-Based Detail View** - Widget grid, 8 widget types, layout customisation, layout persistence (14/14 stories)

### Ready (v2.0)

None

### Draft (v2.0)

None - all epics complete

## Dependency Graph

```
v1.0 (Complete):
EP0001 (Core Monitoring)
  ├─► EP0002 (Alerting)
  │     └─► EP0003 (Service Monitoring)
  │           └─► EP0004 (Remediation)
  ├─► EP0005 (Cost Tracking)
  ├─► EP0006 (Ad-hoc Scanning)
  └─► EP0007 (Analytics & Reporting) [deferred]

v2.0 (Planned):
EP0001 (Core Monitoring) ◄── Foundation
  │
  ├─► EP0008 (Tailscale Integration) ◄── Phase 1 Alpha
  │     ├─► EP0015 (Per-Host Credentials) ◄── Phase 1 Alpha [DONE]
  │     │
  │     ├─► EP0013 (Synchronous Command Execution) ◄── Phase 1 Alpha [DONE]
  │     │     ├─► EP0010 (Configuration Management) ◄── Phase 3 GA [DONE]
  │     │     └─► EP0014 (Docker Container Monitoring) ◄── Phase 2 Beta [DONE]
  │     │
  │     ├─► EP0016 (Unified Discovery) ◄── Phase 2 Beta [DONE]
  │     │
  │     └─► EP0017 (Desktop UX Improvements) ◄── Phase 2 Beta [connectivity badges]
  │
  ├─► EP0009 (Workstation Management) ◄── Phase 1 Alpha
  │     └─► EP0011 (Advanced Dashboard UI) ◄── Phase 2 Beta
  │           └─► EP0012 (Widget-Based Detail View)
  │
  └─► EP0005 (Cost Tracking)
        └─► EP0009 (Workstation Management) [cost tracking for workstations]
```

## Story Counts

### v1.0 Stories

| Epic | Stories | Done | Story Points |
|------|---------|------|--------------|
| EP0001 | 18 | 18 | 75 |
| EP0002 | 7 | 7 | 28 |
| EP0003 | 7 | 7 | 22 |
| EP0004 | 10 | 10 | 30 |
| EP0005 | 8 | 8 | 21 |
| EP0006 | 6 | 6 | 22 |
| EP0007 | 3 | 3 | 10 |
| **v1.0 Total** | **59** | **59** | **208** |

### v2.0 Stories

| Epic | Stories | Done | Story Points |
|------|---------|------|--------------|
| EP0008 | 7 | 7 | 34 |
| EP0009 | 7 | 7 | 26 |
| EP0010 | 8 | 8 | 42 |
| EP0011 | 7 | 7 | 37 |
| EP0012 | 14 | 14 | 53 |
| EP0013 | 7 | 7 | 31 |
| EP0014 | 7 | 7 | 24 |
| EP0015 | 6 | 6 | 24 |
| EP0016 | 9 | 9 | 32 |
| EP0017 | 7 | 7 | 23 |
| EP0018 | 4 | 4 | 13 |
| EP0019 | 5 | 5 | 22 |
| **v2.0 Total** | **88** | **88** | **361** |

### Combined Totals

| Version | Stories | Done | Story Points |
|---------|---------|------|--------------|
| v1.0 | 59 | 59 | 208 |
| v2.0 | 88 | 88 | 361 |
| **Grand Total** | **147** | **147** | **569** |

## v2.0 Phase Breakdown

| Phase | Epics | Story Points | Status | Focus |
|-------|-------|--------------|--------|-------|
| Phase 1 (Alpha) | EP0008, EP0009, EP0013, EP0015 | 115 | ✅ Complete | Foundation, Connectivity, Commands, Credentials |
| Phase 2 (Beta) | EP0011, EP0012, EP0014, EP0016, EP0017, EP0018, EP0019 | 204 | ✅ Complete | UI Revolution, Widgets, Docker, Discovery, UX |
| Phase 3 (GA) | EP0010 | 42 | ✅ Complete | Configuration Management |
| **v2.0 Total** | **12 epics** | **361** | | |

## Notes

- Epics are numbered globally (EP0001, EP0002, etc.)
- Stories are tracked separately in [Story Registry](../stories/_index.md)
- For PRD traceability, see the PRD Reference link in each Epic
- v1.0 epics created from PRD Feature Inventory on 2026-01-18
- v2.0 epics created for major architecture update on 2026-01-26
- EP0007 (Analytics & Reporting) deferred from v1.0, not included in v2.0 scope
- EP0015 (Per-Host Credential Management) completed 2026-01-28, added to index on 2026-01-28
- EP0016 (Unified Discovery) completed 2026-01-28, first v2.0 epic done
- EP0010 (Configuration Management) story files (US0116-US0123) generated on 2026-01-28
- 2026-01-28: Story ID conflict remediation:
  - EP0011: Renumbered US0102-US0108 to US0130-US0136
  - EP0012: Renumbered US0109-US0122 to US0137-US0150
  - EP0013: Renumbered US0089-US0094 to US0151-US0156
  - EP0014: Renumbered US0123-US0129 to US0157-US0163
- 2026-01-29: EP0013 status corrected from Done to Draft - SSH executor exists (EP0008) but synchronous command execution, whitelist, and audit trail not implemented
- 2026-01-30: EP0018 (Dashboard UX Simplification) added - FleetStatus component replaces AlertBanner+SummaryBar, type filters removed
- 2026-01-30: EP0010 (Configuration Management) completed - all 8 stories done
- 2026-01-30: EP0013 (Synchronous Command Execution) completed - all 5 stories done, Phase 1 Alpha complete
- 2026-01-31: EP0019 (Unified Device Discovery) added and completed - Single pane of glass for Network+Tailscale discovery (retrofitted from existing implementation)
- 2026-01-31: Additional stories completed: US0184 (EP0001), US0185 (EP0003), US0186 (EP0004), US0188 (EP0013)
- 2026-02-01: EP0014 (Docker Container Monitoring) completed - all 7 stories done, Phase 2 Beta complete
