# Test Specification Registry

This document provides an overview of all Test Specifications for the HomelabCmd project.

**Last Updated:** 2026-02-17

## Summary

| Status | Count | Test Cases |
|--------|-------|------------|
| Draft | 0 | 0 |
| In Progress | 0 | 0 |
| Ready | 0 | 0 |
| Complete | 49 | 981 |
| **Total** | **49** | **981** |

> **Note:** ID collisions resolved 2026-02-19. TS0012/TS0180/TS0190/TS0201 collisions resolved via renumbering to TS0204-TS0207.

## Specifications by Epic

### [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)

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
| [TS0020](TS0020-remove-agent-ssh-credentials.md) | Remove Agent API SSH Credentials Tests | US0075 | 9 | Complete |
| [TS0201](TS0201-agent-auto-update.md) | Agent Auto-Update Mechanism Tests | US0184 | 29 | Complete |

### [EP0002: Alerting & Notifications](../epics/EP0002-alerting.md)

| ID | Title | Stories | Test Cases | Status |
|----|-------|---------|------------|--------|
| [TS0007](TS0007-alerting.md) | Alerting & Notifications Tests | US0010-US0016 | 31 | Complete |

### [EP0003: Service Monitoring](../epics/EP0003-service-monitoring.md)

| ID | Title | Stories | Test Cases | Status |
|----|-------|---------|------------|--------|
| [TS0008](TS0008-service-monitoring.md) | Service Monitoring Tests | US0017-US0022 | 34 | Complete |
| [TS0202](TS0202-service-restart-grace-period.md) | Service Restart Grace Period Tests | US0185 | 26 | Complete |

### [EP0004: Remediation Engine](../epics/EP0004-remediation.md)

| ID | Title | Stories | Test Cases | Status |
|----|-------|---------|------------|--------|
| [TS0009](TS0009-remediation-engine.md) | Remediation Engine Tests | US0023-US0032 | 33 | Complete |
| [TS0203](TS0203-command-timeout-configuration.md) | Command Timeout Configuration Tests | US0186 | 26 | Complete |

### [EP0005: Cost Tracking](../epics/EP0005-cost-tracking.md)

| ID | Title | Stories | Test Cases | Status |
|----|-------|---------|------------|--------|
| [TS0012](TS0012-cost-tracking.md) | Cost Tracking Tests | US0034-US0036 | 39 | Complete |
| [TS0204](TS0204-agent-cpu-details.md) | Agent CPU Details Collection Tests | US0053 | 12 | Complete |
| [TS0013](TS0013-machine-category-profiles.md) | Machine Category Power Profiles Tests | US0054 | 21 | Complete |
| [TS0200](TS0200-historical-cost-tracking.md) | Historical Cost Tracking Tests | US0183 | 45 | Complete |

### [EP0006: Ad-hoc Scanning](../epics/EP0006-adhoc-scanning.md)

| ID | Title | Stories | Test Cases | Status |
|----|-------|---------|------------|--------|
| [TS0014](TS0014-scan-initiation.md) | Scan Initiation Tests | US0038 | 23 | Complete |
| [TS0015](TS0015-scan-results-display.md) | Scan Results Display Tests | US0039 | 20 | Complete |
| [TS0016](TS0016-scan-history.md) | Scan History View Tests | US0040 | 30 | Complete |
| [TS0017](TS0017-network-discovery.md) | Network Discovery Tests | US0041 | 38 | Complete |
| [TS0018](TS0018-scan-dashboard-integration.md) | Scan Dashboard Integration Tests | US0042 | 7 | Complete |
| [TS0019](TS0019-ssh-key-manager-ui.md) | SSH Key Manager UI Tests | US0071 | 18 | Complete |

### [EP0007: Analytics & Reporting](../epics/EP0007-analytics-reporting.md)

| ID | Title | Stories | Test Cases | Status |
|----|-------|---------|------------|--------|
| [TS0046](TS0046-tiered-data-retention.md) | Tiered Data Retention and Rollup Tests | US0046 | 14 | Complete |

### [EP0010: Configuration Management](../epics/EP0010-configuration-management.md)

| ID | Title | Stories | Test Cases | Status |
|----|-------|---------|------------|--------|
| [TS0180](TS0180-configuration-pack-definitions.md) | Configuration Pack Definitions Tests | US0116 | 11 | Complete |
| [TS0181](TS0181-pack-compliance-check.md) | Configuration Compliance Checker Tests | US0117 | 17 | Complete |
| [TS0182](TS0182-configuration-diff-view.md) | Configuration Diff View Tests | US0118 | 10 | Complete |
| [TS0183](TS0183-apply-configuration-pack.md) | Apply Configuration Pack Tests | US0119 | 16 | Complete |
| [TS0185](TS0185-compliance-dashboard-widget.md) | Compliance Dashboard Widget Tests | US0120 | 17 | Complete |
| [TS0186](TS0186-configuration-drift-detection.md) | Configuration Drift Detection Tests | US0122 | 12 | Complete |
| [TS0187](TS0187-pack-assignment-per-machine.md) | Pack Assignment per Machine Tests | US0121 | 13 | Complete |
| [TS0190](TS0190-remove-configuration-pack.md) | Remove Configuration Pack Tests | US0123 | 11 | Complete |

### [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md)

| ID | Title | Stories | Test Cases | Status |
|----|-------|---------|------------|--------|
| [TS0130](TS0130-drag-drop-card-reordering.md) | Drag-and-Drop Card Reordering Tests | US0130 | 15 | Complete |
| [TS0131](TS0131-card-order-persistence.md) | Card Order Persistence Tests | US0131 | 16 | Complete |
| [TS0132](TS0132-server-workstation-grouping.md) | Server and Workstation Grouping Tests | US0132 | 20 | Complete |
| [TS0134](TS0134-dashboard-summary-bar.md) | Dashboard Summary Bar Tests | US0134 | 19 | Complete |
| [TS0135](TS0135-card-visual-enhancements.md) | Card Visual Enhancements Tests | US0135 | 10 | Complete |
| [TS0136](TS0136-dashboard-preferences-sync.md) | Dashboard Preferences Sync Tests | US0136 | 17 | Complete |
| [TS0137](TS0137-cross-section-machine-type-change.md) | Cross-Section Machine Type Change Tests | US0137 | 23 | Complete |

### [EP0012: Widget-Based Detail View](../epics/EP0012-widget-based-detail-view.md)

| ID | Title | Stories | Test Cases | Status |
|----|-------|---------|------------|--------|
| [TS0178](TS0178-per-filesystem-metrics-api.md) | Per-Filesystem Metrics API Tests | US0178 | 18 | Complete |
| [TS0179](TS0179-per-interface-network-metrics-api.md) | Per-Interface Network Metrics API Tests | US0179 | 22 | Complete |

### [EP0013: Synchronous Command Execution](../epics/EP0013-synchronous-command-execution.md)

| ID | Title | Stories | Test Cases | Status |
|----|-------|---------|------------|--------|
| [TS0189](TS0189-command-whitelist-enforcement.md) | Command Whitelist Enforcement Tests | US0154 | 12 | Complete |
| [TS0206](TS0206-synchronous-command-execution-api.md) | Synchronous Command Execution API Tests | US0153 | 11 | Complete |
| [TS0191](TS0191-remove-async-command-channel.md) | Remove Async Command Channel Tests | US0152 | 8 | Complete |
| [TS0207](TS0207-command-execution-audit-trail.md) | Command Execution Audit Trail Tests | US0155 | 15 | Complete |

### [EP0017: Desktop UX Improvements](../epics/EP0017-desktop-ux-improvements.md)

| ID | Title | Stories | Test Cases | Status |
|----|-------|---------|------------|--------|
| [TS0205](TS0205-detail-page-connectivity-badge.md) | Detail Page Connectivity Badge Tests | US0180 | 4 | Complete |

### [EP0018: Dashboard UX Simplification](../epics/EP0018-dashboard-ux-simplification.md)

| ID | Title | Stories | Test Cases | Status |
|----|-------|---------|------------|--------|
| [TS0021](TS0021-dashboard-ux-simplification.md) | Dashboard UX Simplification Tests | US0156+ | 51 | Complete |

## Notes

- Test specifications are numbered globally (TS0001, TS0002, etc.)
- Each spec covers one or more related user stories
- Status: Draft -> Ready -> In Progress -> Complete
- Automation status tracks implemented vs specified test cases
- ID collisions resolved 2026-02-19: colliding specs renumbered to TS0204-TS0207
- **Deleted specs:** TS0109 (maintenance mode indicator), TS0133 (responsive layout), TS0177 (responsive widget), TS0184 (alert sustained duration) - removed as low-ROI or speculative
- Index refreshed 2026-02-17: added 17 previously untracked specs, promoted 12 Draft specs to Complete
