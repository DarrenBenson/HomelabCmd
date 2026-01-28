# EP0001: Core Monitoring

> **Status:** Done
> **Owner:** Darren
> **Created:** 2026-01-18
> **Target Release:** Phase 1 (MVP)
> **Story Points:** 75

## Summary

Establish the foundational monitoring infrastructure: server registration, agent deployment, metrics collection, and a dashboard displaying real-time fleet health. This epic delivers the core value proposition - seeing all servers on a single screen.

## Inherited Constraints

Constraints that flow from PRD and TRD to this Epic.

### From PRD

| Type | Constraint | Impact on Epic |
|------|------------|----------------|
| Performance | Dashboard load < 2 seconds | Server list must use efficient queries; consider pagination |
| Performance | Agent heartbeat success > 99.5% | Robust heartbeat endpoint with minimal processing |
| Design | Brand guide compliance (dark mode, phosphor colours) | All UI components follow brand-guide.md |
| Architecture | LAN-only deployment | No external API calls; self-contained |

### From TRD

| Type | Constraint | Impact on Epic |
|------|------------|----------------|
| Architecture | Monolith with Agent Fleet | Single container deployment; lightweight agents |
| Tech Stack | Python 3.11+/FastAPI/React | All backend in FastAPI; frontend in React+TypeScript |
| Data Model | SQLite storage | Design for ~475K rows (30 days × 11 servers) |
| Protocol | Push model - agents POST heartbeats | Hub is passive receiver; agents drive timing |

> **Note:** Inherited constraints MUST propagate to child Stories. Check Story templates include these constraints.

## Business Context

### Problem Statement

Managing a homelab with 11+ servers currently requires checking individual dashboards, SSH sessions, or basic uptime tools. There's no consolidated view of CPU, RAM, disk usage, or overall fleet health.

**PRD Reference:** [§2 Problem Statement](../prd.md#2-problem-statement)

### Value Proposition

A single dashboard showing entire fleet status at a glance, updated in real-time via lightweight agents. Reduces daily monitoring time from 30+ minutes to under 5 minutes.

### Success Metrics

| Metric | Current State | Target | Measurement Method |
|--------|---------------|--------|-------------------|
| Time to check fleet health | 30+ min (multiple SSH sessions) | < 2 min | User observation |
| Servers visible in one view | 0 | 11 (100%) | Dashboard count |
| Dashboard load time | N/A | < 2 seconds | Browser DevTools |
| Agent heartbeat success rate | N/A | > 99.5% | API metrics |

## Scope

### In Scope

- Server registration (manual via UI, auto via first heartbeat)
- Agent script with systemd service
- Agent configuration (hub URL, server ID, API key, monitored services)
- Metrics collection: CPU%, RAM%, Disk%, Network RX/TX, Load averages, Uptime
- OS info collection: distribution, version, kernel, architecture
- Package update detection (count, security flagged)
- Dashboard with server cards showing status and key metrics
- Server detail view with full metrics
- Historical metrics storage (30 days)
- Time-series charts (24h/7d/30d views)
- Server status tracking: online, offline, unknown
- SQLite database with Alembic migrations
- REST API with OpenAPI documentation
- React SPA with brand guide compliance

### Out of Scope

- Alerting and notifications (EP0002)
- Service-specific monitoring (EP0003)
- Remediation actions (EP0004)
- Cost tracking (EP0005)
- Ad-hoc device scanning (EP0006)
- Multi-disk/mount monitoring (deferred - open question)
- Docker container monitoring (deferred - open question)

### Affected User Personas

- **Darren (Homelab Operator):** Primary beneficiary - gains unified visibility into all servers

## Acceptance Criteria (Epic Level)

- [ ] Can register 11 servers (all initial inventory)
- [ ] Agents successfully send heartbeats every 60 seconds
- [ ] Dashboard loads in < 2 seconds
- [ ] All servers visible on single dashboard page
- [ ] Server cards show: status LED, name, CPU%, RAM%, Disk%, uptime
- [ ] Server detail view shows full metrics and OS info
- [ ] Historical charts display correctly for 24h/7d/30d periods
- [ ] Data persists across container restarts
- [ ] Offline servers marked after 180s (3 missed heartbeats)
- [ ] UI follows brand guide (dark mode, phosphor colours, correct typography)

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner | Notes |
|------------|------|--------|-------|-------|
| None | - | - | - | First epic, no dependencies |

### Blocking

| Item | Type | Impact |
|------|------|--------|
| EP0002: Alerting | Epic | Cannot alert without metrics data |
| EP0003: Service Monitoring | Epic | Builds on agent infrastructure |
| EP0004: Remediation | Epic | Requires agent command channel |
| EP0005: Cost Tracking | Epic | Requires server TDP data |

## Risks & Assumptions

### Assumptions

- All target servers are Debian/Ubuntu-based (agent compatibility)
- Servers have Python 3.11+ available or can install it
- Network connectivity between hub and all agents is reliable
- SQLite performance is adequate for 11 servers at 60s intervals

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Agent installation fails on some servers | Low | Medium | Test on each server type; document requirements |
| SQLite becomes bottleneck | Low | High | Monitor query times; design for PostgreSQL migration |
| Network partitions cause false offline alerts | Medium | Medium | Consider grace period before offline status |
| Dashboard becomes slow with 30 days data | Low | Medium | Implement pagination; consider data aggregation |

## Technical Considerations

### Architecture Impact

- Establishes hub container (FastAPI + React)
- Establishes agent deployment pattern
- Creates SQLite database schema (foundation for all data)
- Defines heartbeat protocol (used by all subsequent features)

### Integration Points

- Agent → Hub: POST /api/v1/agents/heartbeat
- Hub → SQLite: Metrics storage
- React → API: Server list, metrics queries

### Data Considerations

- Metrics table will grow: ~15,840 rows/day (11 servers × 1440 minutes)
- 30-day retention: ~475,000 rows maximum
- Indices needed: server_id, timestamp
- Daily pruning job required

**TRD Reference:** [§5 Data Architecture](../trd.md#5-data-architecture)

## Sizing & Effort

**Actual Story Count:** 16 stories (64 story points)

**Complexity Factors:**

- Full-stack implementation (backend + frontend + agent)
- Database schema design
- Real-time updates consideration
- Brand guide compliance for all UI components
- Agent installation/deployment process

## Stakeholders

| Role | Name | Interest |
|------|------|----------|
| Product Owner | Darren | Primary user, defines requirements |
| Developer | Darren/Claude | Implementation |

## Story Breakdown

| ID | Title | Points | Status |
|----|-------|--------|--------|
| [US0001](../stories/US0001-database-schema.md) | Database Schema and Migrations | 3 | Done |
| [US0002](../stories/US0002-server-registration-api.md) | Server Registration API | 5 | Done |
| [US0003](../stories/US0003-agent-heartbeat-endpoint.md) | Agent Heartbeat Endpoint | 5 | Done |
| [US0004](../stories/US0004-agent-script.md) | Agent Script and Systemd Service | 5 | Done |
| [US0005](../stories/US0005-dashboard-server-list.md) | Dashboard Server List | 5 | Done |
| [US0006](../stories/US0006-server-detail-view.md) | Server Detail View | 5 | Done |
| [US0007](../stories/US0007-historical-metrics-charts.md) | Historical Metrics and Charts | 5 | Done |
| [US0008](../stories/US0008-server-status-detection.md) | Server Status Detection | 3 | Done |
| [US0009](../stories/US0009-data-retention-pruning.md) | Data Retention and Pruning | 2 | Done |
| [US0043](../stories/US0043-system-settings-configuration.md) | System Settings Configuration | 3 | Done |
| [US0044](../stories/US0044-package-update-display.md) | Package Update Display | 3 | Done |
| [US0045](../stories/US0045-api-infrastructure.md) | API Infrastructure and Authentication | 3 | Done |
| [US0049](../stories/US0049-test-webhook-button.md) | Test Webhook Button | 2 | Done |
| [US0050](../stories/US0050-openapi-compliance.md) | OpenAPI 3.1 Production Compliance | 5 | Done |
| [US0051](../stories/US0051-package-update-list.md) | Package Update List View | 5 | Done |
| [US0052](../stories/US0052-trigger-package-updates.md) | Trigger Package Updates from Dashboard | 5 | Done |
| [US0070](../stories/US0070-guid-based-server-identity.md) | GUID-Based Server Identity | 8 | Planned |
| [US0075](../stories/US0075-remove-agent-ssh-credentials.md) | Remove Agent API SSH Credentials and Verification | 3 | Draft |

**Total:** 18 stories, 75 story points (16 Done, 1 Planned, 1 Draft)

## Test Plan

**Test Spec:** [TS0001: Core Monitoring API](../test-specs/TS0001-core-monitoring-api.md)

| Test Spec | Coverage | Status |
|-----------|----------|--------|
| [TS0001](../test-specs/TS0001-core-monitoring-api.md) | Server registration, heartbeat, metrics APIs | Active |
| [TS0002](../test-specs/TS0002-api-infrastructure.md) | API infrastructure and auth | Active |
| [TS0003](../test-specs/TS0003-dashboard-frontend.md) | Dashboard and server list UI | Active |
| [TS0004](../test-specs/TS0004-agent-script.md) | Agent script and systemd service | Active |
| [TS0005](../test-specs/TS0005-settings-configuration.md) | Settings and configuration | Active |
| [TS0006](../test-specs/TS0006-server-detail-charts.md) | Server detail and historical charts | Active |

## Open Questions

- [ ] Multi-disk monitoring approach (root only vs all mounts) - Owner: Darren
- [ ] Agent auto-update mechanism - Owner: Darren

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial epic creation from PRD |
| 2026-01-18 | Claude | Added 9 user stories (US0001-US0009) |
| 2026-01-18 | Claude | Added US0043, US0044, US0045, US0049, US0050 from QA analysis |
| 2026-01-20 | Claude | Added US0051, US0052 for package management features |
| 2026-01-20 | Claude | Added Inherited Constraints and Test Plan sections |
| 2026-01-21 | Claude | Epic review: US0051, US0052 verified implemented and marked Done; all 16/16 stories complete |
| 2026-01-22 | Claude | Added US0070 (GUID-Based Server Identity) from BG0014 |
| 2026-01-24 | Claude | Added US0075 remove-agent SSH credentials story |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Standardised header format, added Story Points |
