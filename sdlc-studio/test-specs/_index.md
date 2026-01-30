# Test Specification Registry

This document provides an overview of all Test Specifications for the HomelabCmd project.

**Last Updated:** 2026-01-29

## Summary

| Status | Count | Test Cases |
|--------|-------|------------|
| Draft | 8 | 135 |
| In Progress | 3 | 62 |
| Complete | 19 | 345 |
| **Total** | **30** | **542** |

## Specifications by Epic

### [EP0001: Core Monitoring](../../epics/EP0001-core-monitoring.md)

| ID | Title | Stories | Test Cases | Status |
|----|-------|---------|------------|--------|
| [TS0001](TS0001-core-monitoring-api.md) | Core Monitoring API Tests | US0001-US0009, US0045 | 20 | Complete |
| [TS0002](TS0002-api-infrastructure.md) | API Infrastructure Tests | US0045 | 19 | Complete |
| [TS0003](TS0003-dashboard-frontend.md) | Dashboard Frontend Tests | US0005 | 14 | Complete |
| [TS0004](TS0004-agent-script.md) | Agent Script Tests | US0004, US0044 | 20 | Complete |
| [TS0005](TS0005-settings-configuration.md) | Settings and Configuration Tests | US0043, US0049 | 22 | Complete |
| [TS0006](TS0006-server-detail-charts.md) | Server Detail View and Charts Tests | US0006, US0007, US0044 | 21 | Complete |
| [TS0010](TS0010-package-update-list.md) | Package Update List View Tests | US0051 | 15 | Complete |
| [TS0011](TS0011-trigger-package-updates.md) | Trigger Package Updates Tests | US0052 | 17 | Complete |
| [TS0020](TS0020-remove-agent-ssh-credentials.md) | Remove Agent API SSH Credentials Tests | US0075 | 9 | Draft |

### [EP0002: Alerting & Notifications](../../epics/EP0002-alerting.md)

| ID | Title | Stories | Test Cases | Status |
|----|-------|---------|------------|--------|
| [TS0007](TS0007-alerting.md) | Alerting & Notifications Tests | US0010-US0016 | 31 | Complete |
| [TS0184](TS0184-alert-sustained-duration.md) | Alert Sustained Duration Tests | US0181 | 18 | Draft |

### [EP0003: Service Monitoring](../../epics/EP0003-service-monitoring.md)

| ID | Title | Stories | Test Cases | Status |
|----|-------|---------|------------|--------|
| [TS0008](TS0008-service-monitoring.md) | Service Monitoring Tests | US0017-US0022 | 34 | Complete |

### [EP0004: Remediation Engine](../../epics/EP0004-remediation.md)

| ID | Title | Stories | Test Cases | Status |
|----|-------|---------|------------|--------|
| [TS0009](TS0009-remediation-engine.md) | Remediation Engine Tests | US0023-US0032 | 33 | Complete |

### [EP0005: Cost Tracking](../../epics/EP0005-cost-tracking.md)

| ID | Title | Stories | Test Cases | Status |
|----|-------|---------|------------|--------|
| [TS0012](TS0012-agent-cpu-details.md) | Agent CPU Details Collection Tests | US0053 | 12 | Complete |
| [TS0013](TS0013-machine-category-profiles.md) | Machine Category Power Profiles Tests | US0054 | 21 | In Progress |

### [EP0006: Ad-hoc Scanning](../../epics/EP0006-adhoc-scanning.md)

| ID | Title | Stories | Test Cases | Status |
|----|-------|---------|------------|--------|
| [TS0014](TS0014-scan-initiation.md) | Scan Initiation Tests | US0038 | 23 | In Progress |
| [TS0015](TS0015-scan-results-display.md) | Scan Results Display Tests | US0039 | 20 | Draft |
| [TS0019](TS0019-ssh-key-manager-ui.md) | SSH Key Manager UI Tests | US0071 | 18 | In Progress |

### [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md)

| ID | Title | Stories | Test Cases | Status |
|----|-------|---------|------------|--------|
| [TS0130](TS0130-drag-drop-card-reordering.md) | Drag-and-Drop Card Reordering Tests | US0130 | 15 | Complete |
| [TS0131](TS0131-card-order-persistence.md) | Card Order Persistence Tests | US0131 | 16 | Complete |
| [TS0132](TS0132-server-workstation-grouping.md) | Server and Workstation Grouping Tests | US0132 | 20 | Complete |
| [TS0133](TS0133-responsive-dashboard-layout.md) | Responsive Dashboard Layout Tests | US0133 | 14 | Draft |
| [TS0134](TS0134-dashboard-summary-bar.md) | Dashboard Summary Bar Tests | US0134 | 19 | Complete |
| [TS0135](TS0135-card-visual-enhancements.md) | Card Visual Enhancements Tests | US0135 | 10 | Complete |
| [TS0136](TS0136-dashboard-preferences-sync.md) | Dashboard Preferences Sync Tests | US0136 | 17 | Draft |
| [TS0137](TS0137-cross-section-machine-type-change.md) | Cross-Section Machine Type Change Tests | US0137 | 23 | Draft |

### [EP0012: Widget-Based Detail View](../epics/EP0012-widget-based-detail-view.md)

| ID | Title | Stories | Test Cases | Status |
|----|-------|---------|------------|--------|
| [TS0177](TS0177-responsive-widget-layout.md) | Responsive Widget Layout Tests | US0177 | 12 | Draft |

### [EP0010: Configuration Management](../epics/EP0010-configuration-management.md)

| ID | Title | Stories | Test Cases | Status |
|----|-------|---------|------------|--------|
| [TS0180](TS0180-configuration-pack-definitions.md) | Configuration Pack Definitions Tests | US0116 | 11 | Complete |
| [TS0181](TS0181-pack-compliance-check.md) | Configuration Compliance Checker Tests | US0117 | 17 | Complete |
| [TS0182](TS0182-configuration-diff-view.md) | Configuration Diff View Tests | US0118 | 10 | Complete |
| [TS0186](TS0186-configuration-drift-detection.md) | Configuration Drift Detection Tests | US0122 | 12 | Draft |
| [TS0187](TS0187-pack-assignment-per-machine.md) | Pack Assignment per Machine Tests | US0121 | 13 | Draft |

### [EP0017: Desktop UX Improvements](../epics/EP0017-desktop-ux-improvements.md)

| ID | Title | Stories | Test Cases | Status |
|----|-------|---------|------------|--------|
| [TS0109](TS0109-maintenance-mode-indicator.md) | Enhanced Maintenance Mode Indicator Tests | US0109 | 9 | Draft |
| [TS0180](TS0180-detail-page-connectivity-badge.md) | Detail Page Connectivity Badge Tests | US0180 | 4 | Complete |

## All Specifications

| ID | Title | Epic | Test Cases | Automated | Status |
|----|-------|------|------------|-----------|--------|
| [TS0001](TS0001-core-monitoring-api.md) | Core Monitoring API Tests | EP0001 | 20 | 20/20 | Complete |
| [TS0002](TS0002-api-infrastructure.md) | API Infrastructure Tests | EP0001 | 19 | 19/19 | Complete |
| [TS0003](TS0003-dashboard-frontend.md) | Dashboard Frontend Tests | EP0001 | 14 | 14/14 | Complete |
| [TS0004](TS0004-agent-script.md) | Agent Script Tests | EP0001 | 20 | 20/20 | Complete |
| [TS0005](TS0005-settings-configuration.md) | Settings and Configuration Tests | EP0001 | 22 | 22/22 | Complete |
| [TS0006](TS0006-server-detail-charts.md) | Server Detail View and Charts Tests | EP0001 | 21 | 21/21 | Complete |
| [TS0007](TS0007-alerting.md) | Alerting & Notifications Tests | EP0002 | 31 | 31/31 | Complete |
| [TS0008](TS0008-service-monitoring.md) | Service Monitoring Tests | EP0003 | 34 | 34/34 | Complete |
| [TS0009](TS0009-remediation-engine.md) | Remediation Engine Tests | EP0004 | 33 | 33/33 | Complete |
| [TS0010](TS0010-package-update-list.md) | Package Update List View Tests | EP0001 | 15 | 15/15 | Complete |
| [TS0011](TS0011-trigger-package-updates.md) | Trigger Package Updates Tests | EP0001 | 17 | 19/17 | Complete |
| [TS0020](TS0020-remove-agent-ssh-credentials.md) | Remove Agent API SSH Credentials Tests | EP0001 | 9 | 0/9 | Draft |
| [TS0012](TS0012-agent-cpu-details.md) | Agent CPU Details Collection Tests | EP0005 | 12 | 12/12 | Complete |
| [TS0013](TS0013-machine-category-profiles.md) | Machine Category Power Profiles Tests | EP0005 | 21 | 0/21 | In Progress |
| [TS0014](TS0014-scan-initiation.md) | Scan Initiation Tests | EP0006 | 23 | 20/23 | In Progress |
| [TS0015](TS0015-scan-results-display.md) | Scan Results Display Tests | EP0006 | 20 | 0/20 | Draft |
| [TS0019](TS0019-ssh-key-manager-ui.md) | SSH Key Manager UI Tests | EP0006 | 18 | 17/18 | In Progress |

## By Status

### Draft

- **TS0015**: Scan Results Display Tests - 20 test cases (0 automated)
- **TS0020**: Remove Agent API SSH Credentials Tests - 9 test cases (0 automated)
- **TS0109**: Enhanced Maintenance Mode Indicator Tests - 9 test cases (0 automated)
- **TS0132**: Server and Workstation Grouping Tests - 20 test cases (0 automated)

### In Progress

- **TS0013**: Machine Category Power Profiles Tests - 21 test cases (0 automated)
- **TS0019**: SSH Key Manager UI Tests - 18 test cases (17 automated)
- **TS0014**: Scan Initiation Tests - 23 test cases (20 automated)

### Complete

- **TS0001**: Core Monitoring API Tests - 20 test cases fully automated (93 pytest tests)
- **TS0002**: API Infrastructure Tests - 19 test cases fully automated (32 pytest tests)
- **TS0003**: Dashboard Frontend Tests - 14 test cases fully automated (319 unit tests + E2E)
- **TS0004**: Agent Script Tests - 20 test cases fully automated (48 pytest tests)
- **TS0005**: Settings and Configuration Tests - 22 test cases fully automated (frontend + backend)
- **TS0006**: Server Detail View and Charts Tests - 21 test cases fully automated (frontend + backend)
- **TS0007**: Alerting & Notifications Tests - 31 test cases fully automated (89 backend + 66 frontend tests)
- **TS0008**: Service Monitoring Tests - 34 test cases fully automated (73 backend + 32 frontend tests)
- **TS0009**: Remediation Engine Tests - 33 test cases fully automated (116 backend + frontend tests)
- **TS0010**: Package Update List View Tests - 15 test cases fully automated (19 pytest tests)
- **TS0011**: Trigger Package Updates Tests - 17 test cases fully automated (19 pytest tests)
- **TS0012**: Agent CPU Details Collection Tests - 12 test cases fully automated (24 pytest tests)

## Test Coverage Summary

### EP0001 Story Coverage

| Story | Title | Spec | Test Cases | Automated |
|-------|-------|------|------------|-----------|
| US0001 | Database Schema | TS0001 | 5 | 5 (100%) |
| US0002 | Server Registration API | TS0001 | 7 | 7 (100%) |
| US0003 | Agent Heartbeat Endpoint | TS0001 | 5 | 5 (100%) |
| US0004 | Agent Script | TS0004 | 20 | 20 (100%) |
| US0005 | Dashboard Server List | TS0003 | 14 | 14 (100%) |
| US0006 | Server Detail View | TS0006 | 10 | 10 (100%) |
| US0007 | Historical Charts | TS0006 | 7 | 7 (100%) |
| US0008 | Server Status Detection | TS0001 | 2 | 2 (100%) |
| US0009 | Data Retention | TS0001 | 1 | 1 (100%) |
| US0043 | System Settings | TS0005 | 12 | 12 (100%) |
| US0044 | Package Updates | TS0004, TS0006 | 8 | 8 (100%) |
| US0045 | API Infrastructure | TS0002 | 19 | 19 (100%) |
| US0049 | Test Webhook Button | TS0005 | 10 | 10 (100%) |
| US0051 | Package Update List View | TS0010 | 15 | 15 (100%) |
| US0052 | Trigger Package Updates | TS0011 | 17 | 17 (100%) |

**Total EP0001:** 148 test cases, 148 automated (100%)

### EP0002 Story Coverage

| Story | Title | Spec | Test Cases | Automated |
|-------|-------|------|------------|-----------|
| US0010 | Alert Entity and Database Schema | TS0007 | 5 | 5 (100%) |
| US0011 | Threshold Evaluation and Alert Generation | TS0007 | 8 | 8 (100%) |
| US0012 | Alert Deduplication and Auto-Resolve | TS0007 | 5 | 5 (100%) |
| US0013 | Slack Webhook Integration | TS0007 | 0 | - |
| US0014 | Alert API Endpoints | TS0007 | 8 | 8 (100%) |
| US0015 | Dashboard Alert Display | TS0007 | 2 | 2 (100%) |
| US0016 | Alert List and Detail Views | TS0007 | 3 | 3 (100%) |

**Total EP0002:** 31 test cases, 31 automated (100%)

### EP0003 Story Coverage

| Story | Title | Spec | Test Cases | Automated |
|-------|-------|------|------------|-----------|
| US0017 | Service Schema and Database Tables | TS0008 | 6 | 6 (100%) |
| US0018 | Agent Service Status Collection | TS0008 | 4 | 4 (100%) |
| US0019 | Expected Services Configuration API | TS0008 | 9 | 9 (100%) |
| US0020 | Service Status Display | TS0008 | 3 | 3 (100%) |
| US0021 | Service-Down Alert Generation | TS0008 | 7 | 7 (100%) |
| US0022 | Service Restart Action | TS0008 | 5 | 5 (100%) |

**Total EP0003:** 34 test cases, 34 automated (100%)

### EP0004 Story Coverage

| Story | Title | Spec | Test Cases | Automated |
|-------|-------|------|------------|-----------|
| US0023 | Extended Remediation Action Schema | TS0009 | 3 | 3 (100%) |
| US0024 | Action Queue API | TS0009 | 6 | 6 (100%) |
| US0025 | Heartbeat Command Channel | TS0009 | 2 | 2 (100%) |
| US0026 | Maintenance Mode Approval | TS0009 | 3 | 3 (100%) |
| US0027 | Agent Command Execution | TS0009 | 3 | 3 (100%) |
| US0029 | Server Maintenance Mode | TS0009 | 3 | 3 (100%) |
| US0030 | Pending Actions Panel | TS0009 | 3 | 3 (100%) |
| US0031 | Action History View | TS0009 | 8 | 8 (100%) |
| US0032 | Action Execution Slack Notifications | TS0009 | 2 | 2 (100%) |

**Total EP0004:** 33 test cases, 33 automated (100%)

## Test Type Distribution

| Test Type | Count | Percentage |
|-----------|-------|------------|
| Unit | 64 | 40% |
| Integration | 36 | 22% |
| API | 32 | 20% |
| E2E | 26 | 18% |
| **Total** | **158** | **100%** |

## Notes

- Test specifications are numbered globally (TS0001, TS0002, etc.)
- Each spec covers one or more related user stories
- Status: Draft -> Ready -> In Progress -> Complete
- Automation status tracks implemented vs specified test cases
- TS0002 was generated from existing implemented tests
- TS0004, TS0005, TS0006 created 2026-01-19 for remaining EP0001 stories
- TS0005 fully automated on 2026-01-19 (22 test cases)
- TS0006 completed on 2026-01-19 (21/21 test cases, TC077 metrics history API implemented)
- TS0004 completed on 2026-01-19 (20/20 test cases, 48 pytest tests)
- TS0007 created on 2026-01-19 for EP0002 Alerting (31 test cases, 89 backend + 66 frontend tests)
- TS0008 created on 2026-01-19 for EP0003 Service Monitoring (34 test cases, 73 backend + 32 frontend tests)
- TS0009 created on 2026-01-19 for EP0004 Remediation Engine (33 test cases, 27 automated)
- TS0009 automation discovery on 2026-01-19: Found 116 existing pytest tests covering TC152-TC167
- TS0009 completed on 2026-01-19: TC173, TC174 automated in tests/test_action_notifications.py (33/33)
- TS0010 created on 2026-01-20 for US0051 Package Update List View (15 test cases, 19 pytest tests)
- TS0011 created on 2026-01-20 for US0052 Trigger Package Updates (17 test cases, 19 pytest tests)

## Related Documents

- [Test Strategy](../tsd.md)
