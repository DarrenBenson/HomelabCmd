# v1.0 Stories Archive

> **Status:** Complete (52/55 stories done, 3 deferred to EP0007)
> **Total Points:** 191
> **Completed:** 2026-01-25

This archive contains all v1.0 user stories. For current work, see [Story Registry](_index.md).

---

## EP0001: Core Monitoring (64 pts - Complete)

| Story | Title | Points |
|-------|-------|--------|
| US0001 | Database Schema and Migrations | 3 |
| US0002 | Server Registration API | 5 |
| US0003 | Agent Heartbeat Endpoint | 5 |
| US0004 | Agent Script and Systemd Service | 5 |
| US0005 | Dashboard Server List | 5 |
| US0006 | Server Detail View | 5 |
| US0007 | Historical Metrics and Charts | 5 |
| US0008 | Server Status Detection | 3 |
| US0009 | Data Retention and Pruning | 2 |
| US0043 | System Settings Configuration | 3 |
| US0044 | Package Update Display | 3 |
| US0045 | API Infrastructure and Authentication | 3 |
| US0049 | Test Webhook Button | 2 |
| US0050 | OpenAPI 3.1 Production Compliance | 5 |
| US0051 | Package Update List View | 5 |
| US0052 | Trigger Package Updates from Dashboard | 5 |

---

## EP0002: Alerting & Notifications (28 pts - Complete)

| Story | Title | Points |
|-------|-------|--------|
| US0010 | Alert Entity and Database Schema | 2 |
| US0011 | Threshold Evaluation and Alert Generation | 5 |
| US0012 | Alert Deduplication and Auto-Resolve | 3 |
| US0013 | Slack Webhook Integration | 3 |
| US0014 | Alert API Endpoints | 5 |
| US0015 | Dashboard Alert Display | 5 |
| US0016 | Alert List and Detail Views | 5 |

---

## EP0003: Service Monitoring (19 pts - Complete)

| Story | Title | Points |
|-------|-------|--------|
| US0017 | Service Schema and Database Tables | 2 |
| US0018 | Agent Service Status Collection | 5 |
| US0019 | Expected Services Configuration API | 3 |
| US0020 | Service Status Display in Server Detail | 3 |
| US0021 | Service-Down Alert Generation | 3 |
| US0022 | Service Restart Action | 3 |

---

## EP0004: Remediation Engine (27 pts - Complete)

| Story | Title | Points |
|-------|-------|--------|
| US0023 | Extended Remediation Action Schema | 2 |
| US0024 | Action Queue API | 3 |
| US0025 | Heartbeat Command Channel | 5 |
| US0026 | Maintenance Mode Approval | 2 |
| US0027 | Agent Command Execution | 5 |
| US0029 | Server Maintenance Mode | 2 |
| US0030 | Pending Actions Panel | 3 |
| US0031 | Action History View | 3 |
| US0032 | Action Execution Slack Notifications | 2 |

---

## EP0005: Cost Tracking (21 pts - Complete)

| Story | Title | Points |
|-------|-------|--------|
| US0033 | TDP Configuration per Server | 2 |
| US0034 | Electricity Rate Configuration | 2 |
| US0035 | Dashboard Cost Summary Display | 3 |
| US0036 | Cost Breakdown View | 3 |
| US0053 | Agent CPU Details Collection | 2 |
| US0054 | Machine Category Power Profiles | 3 |
| US0055 | Usage-Based Power Calculation | 3 |
| US0056 | Power Configuration UI | 3 |

---

## EP0006: Ad-hoc Scanning (33 pts - Complete)

| Story | Title | Points |
|-------|-------|--------|
| US0037 | SSH Key Configuration | 3 |
| US0038 | Scan Initiation | 5 |
| US0039 | Scan Results Display | 3 |
| US0040 | Scan History View | 3 |
| US0041 | Network Discovery | 5 |
| US0042 | Scan Dashboard Integration | 3 |
| US0071 | SSH Key Manager UI | 5 |
| US0072 | SSH Key Username Association | 3 |
| US0074 | Robust Package Management Architecture | 5 |
| US0070 | GUID-Based Server Identity | 8 |
| US0075 | Remove Agent API SSH Credentials | 3 |

---

## EP0007: Analytics & Reporting (10 pts - Deferred)

| Story | Title | Points | Status |
|-------|-------|--------|--------|
| US0046 | Tiered Data Retention and Rollup | 5 | Deferred |
| US0047 | 12-Month Trend Report View | 3 | Deferred |
| US0048 | Metrics Data Export | 2 | Deferred |

---

## Dependency Graphs

### EP0001: Core Monitoring

```
US0045 (API Infrastructure) ── foundation for all API endpoints
  │
US0001 (Database)
  └─► US0002 (Server API)
        └─► US0005 (Dashboard)
              └─► US0006 (Detail View)
                    └─► US0007 (Charts)
              └─► US0043 (Settings)
                    └─► US0049 (Test Webhook)
  └─► US0003 (Heartbeat)
        └─► US0004 (Agent)
              └─► US0044 (Package Updates)
                    └─► US0051 (Package List View)
                          └─► US0052 (Trigger Updates)
        └─► US0008 (Status Detection)
              └─► US0009 (Pruning)
```

### EP0002: Alerting & Notifications

```
US0010 (Alert Schema)
  └─► US0011 (Threshold Evaluation)
        └─► US0012 (Deduplication)
        └─► US0013 (Slack)
  └─► US0014 (Alert API)
        └─► US0015 (Dashboard Alerts)
        └─► US0016 (Alert List View)
```

### EP0003: Service Monitoring

```
US0017 (Service Schema)
  └─► US0018 (Agent Collection)
        └─► US0021 (Service Alerts)
  └─► US0019 (Expected Services API)
        └─► US0020 (Status Display)
              └─► US0022 (Restart Action)
```

### EP0004: Remediation Engine

```
US0023 (Action Schema)
  └─► US0029 (Server Maintenance Mode)
        └─► US0024 (Action Queue API)
              ├─► US0025 (Heartbeat Command Channel)
              │     └─► US0027 (Agent Execution)
              │           └─► US0032 (Slack Notifications)
              ├─► US0026 (Maintenance Mode Approval)
              │     └─► US0030 (Pending Actions Panel)
              └─► US0031 (Action History View)
```

### EP0005: Cost Tracking

```
US0033 (TDP Config)
  └─► US0035 (Dashboard Cost)
        └─► US0036 (Cost Breakdown)
US0034 (Electricity Rate)
  └─► US0035 (Dashboard Cost)
```

### EP0006: Ad-hoc Scanning

```
US0037 (SSH Key Config)
  └─► US0038 (Scan Initiation)
        └─► US0039 (Results Display)
              └─► US0040 (Scan History)
        └─► US0041 (Network Discovery)
  └─► US0042 (Dashboard Integration)
        └─► US0038 (Scan Initiation)
        └─► US0040 (Scan History)
        └─► US0041 (Network Discovery)
```

---

## Implementation Order (Historical)

### Phase 1: EP0001 Core Monitoring
1. US0045 - API Infrastructure (foundation)
2. US0001 - Database Schema
3. US0002 - Server Registration API
4. US0003 - Agent Heartbeat Endpoint
5. US0008 - Server Status Detection
6. US0004 - Agent Script
7. US0044 - Package Update Display
8. US0005 - Dashboard Server List
9. US0006 - Server Detail View
10. US0007 - Historical Charts
11. US0043 - System Settings
12. US0049 - Test Webhook Button
13. US0009 - Data Retention

### Phase 2: EP0002 Alerting
1. US0010 - Alert Schema
2. US0011 - Threshold Evaluation
3. US0012 - Deduplication
4. US0013 - Slack Integration
5. US0014 - Alert API
6. US0015 - Dashboard Alerts
7. US0016 - Alert List View

### Phase 3: EP0003 Service Monitoring
1. US0017 - Service Schema
2. US0018 - Agent Service Collection
3. US0019 - Expected Services API
4. US0020 - Service Status Display
5. US0021 - Service-Down Alerts
6. US0022 - Restart Action

### Phase 4: EP0004 Remediation Engine
1. US0023 - Action Schema
2. US0029 - Server Maintenance Mode
3. US0024 - Action Queue API
4. US0025 - Heartbeat Command Channel
5. US0027 - Agent Command Execution
6. US0026 - Maintenance Mode Approval
7. US0030 - Pending Actions Panel
8. US0031 - Action History View
9. US0032 - Action Slack Notifications

### Phase 5: EP0005 Cost Tracking
1. US0033 - TDP Configuration
2. US0034 - Electricity Rate
3. US0035 - Dashboard Cost Display
4. US0036 - Cost Breakdown View

### Phase 6: EP0006 Ad-hoc Scanning
1. US0037 - SSH Key Configuration
2. US0038 - Scan Initiation
3. US0039 - Scan Results Display
4. US0040 - Scan History View
5. US0041 - Network Discovery
6. US0042 - Scan Dashboard Integration
