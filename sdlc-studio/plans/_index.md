# Plan Registry

This document provides an overview of all Implementation Plans in the project.

**Last Updated:** 2026-02-17

## Summary

| Status | Count |
|--------|-------|
| Draft | 0 |
| In Progress | 0 |
| Ready | 0 |
| Complete | 113 |
| **Total** | **113** |

> **Note:** ID collisions resolved 2026-02-19. PL0053 archived (duplicate of PL0075); PL0180/PL0184/PL0190/PL0201 collisions resolved via renumbering to PL0208-PL0211.

## Plans by Epic

### [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)

| ID | Story | Title | Status | Created |
|----|-------|-------|--------|---------|
| [PL0001](PL0001-api-infrastructure.md) | US0045 | API Infrastructure and Authentication | Complete | 2026-01-18 |
| [PL0002](PL0002-database-schema.md) | US0001 | Database Schema and Migrations | Complete | 2026-01-18 |
| [PL0003](PL0003-server-registration-api.md) | US0002 | Server Registration API | Complete | 2026-01-18 |
| [PL0004](PL0004-agent-heartbeat-endpoint.md) | US0003 | Agent Heartbeat Endpoint | Complete | 2026-01-18 |
| [PL0005](PL0005-server-status-detection.md) | US0008 | Server Status Detection | Complete | 2026-01-18 |
| [PL0006](PL0006-data-retention-pruning.md) | US0009 | Data Retention and Pruning | Complete | 2026-01-18 |
| [PL0007](PL0007-agent-script.md) | US0004 | Agent Script and Systemd Service | Complete | 2026-01-18 |
| [PL0008](PL0008-dashboard-server-list.md) | US0005 | Dashboard Server List | Complete | 2026-01-18 |
| [PL0009](PL0009-server-detail-view.md) | US0006 | Server Detail View | Complete | 2026-01-18 |
| [PL0010](PL0010-historical-metrics-charts.md) | US0007 | Historical Metrics and Charts | Complete | 2026-01-18 |
| [PL0011](PL0011-system-settings-configuration.md) | US0043 | System Settings Configuration | Complete | 2026-01-19 |
| [PL0012](PL0012-package-update-display.md) | US0044 | Package Update Display | Complete | 2026-01-19 |
| [PL0013](PL0013-test-webhook-button.md) | US0049 | Test Webhook Button | Complete | 2026-01-19 |
| [PL0019](PL0019-openapi-compliance.md) | US0050 | OpenAPI 3.1 Production Compliance | Complete | 2026-01-19 |
| [PL0036](PL0036-package-update-list.md) | US0051 | Package Update List View | Complete | 2026-01-20 |
| [PL0037](PL0037-trigger-package-updates.md) | US0052 | Trigger Package Updates | Complete | 2026-01-20 |
| [PL0050](PL0050-guid-based-server-identity.md) | US0070 | GUID-Based Server Identity | Complete | 2026-01-22 |
| [PL0075](PL0075-remove-agent-ssh-credentials.md) | US0075 | Remove Agent API SSH Credentials and Verification | Complete | 2026-01-24 |
| [PL0201](PL0201-agent-auto-update.md) | US0184 | Agent Auto-Update Mechanism | Complete | 2026-01-31 |

### [EP0002: Alerting & Notifications](../epics/EP0002-alerting.md)

| ID | Story | Title | Status | Created |
|----|-------|-------|--------|---------|
| [PL0014](PL0014-alert-schema.md) | US0010 | Alert Entity and Database Schema | Complete | 2026-01-19 |
| [PL0015](PL0015-threshold-evaluation.md) | US0011 | Threshold Evaluation and Alert Generation | Complete | 2026-01-19 |
| [PL0016](PL0016-alert-deduplication.md) | US0012 | Alert Deduplication and Auto-Resolve | Complete | 2026-01-19 |
| [PL0017](PL0017-alert-api.md) | US0014 | Alert API Endpoints | Complete | 2026-01-19 |
| [PL0018](PL0018-dashboard-alerts.md) | US0015 | Dashboard Alert Display | Complete | 2026-01-19 |
| [PL0020](PL0020-alert-list-view.md) | US0016 | Alert List and Detail Views | Complete | 2026-01-19 |
| [PL0184](PL0184-alert-sustained-duration.md) | US0181 | Alert Sustained Duration Configuration | Complete | 2026-01-31 |
| [PL0209](PL0209-alert-auto-resolve-notifications.md) | US0182 | Alert Auto-Resolve Notifications | Complete | 2026-01-31 |

### [EP0003: Service Monitoring](../epics/EP0003-service-monitoring.md)

| ID | Story | Title | Status | Created |
|----|-------|-------|--------|---------|
| [PL0021](PL0021-service-schema.md) | US0017 | Service Entity and Expected Services Schema | Complete | 2026-01-19 |
| [PL0022](PL0022-agent-service-collection.md) | US0018 | Agent Service Status Collection | Complete | 2026-01-19 |
| [PL0023](PL0023-expected-services-api.md) | US0019 | Expected Services Configuration API | Complete | 2026-01-19 |
| [PL0024](PL0024-service-status-display.md) | US0020 | Service Status Display in Server Detail | Complete | 2026-01-19 |
| [PL0025](PL0025-service-alerts.md) | US0021 | Service-Down Alert Generation | Complete | 2026-01-19 |
| [PL0026](PL0026-service-restart-action.md) | US0022 | Service Restart Action | Complete | 2026-01-19 |
| [PL0051](PL0051-service-discovery-during-install.md) | US0069 | Service Discovery During Install | Complete | 2026-01-22 |
| [PL0202](PL0202-service-restart-grace-period.md) | US0185 | Service Restart Grace Period | Complete | 2026-01-31 |

### [EP0004: Remediation Engine](../epics/EP0004-remediation.md)

| ID | Story | Title | Status | Created |
|----|-------|-------|--------|---------|
| [PL0027](PL0027-remediation-action-schema.md) | US0023 | Extended Remediation Action Schema | Complete | 2026-01-19 |
| [PL0028](PL0028-action-queue-api.md) | US0024 | Action Queue API | Complete | 2026-01-19 |
| [PL0029](PL0029-heartbeat-command-channel.md) | US0025 | Heartbeat Command Channel | Complete | 2026-01-19 |
| [PL0030](PL0030-maintenance-mode-approval.md) | US0026 | Maintenance Mode Approval | Complete | 2026-01-19 |
| [PL0031](PL0031-agent-command-execution.md) | US0027 | Agent Command Execution | Complete | 2026-01-19 |
| [PL0032](PL0032-maintenance-mode-frontend.md) | US0029 | Maintenance Mode Frontend | Complete | 2026-01-19 |
| [PL0033](PL0033-pending-actions-panel.md) | US0030 | Pending Actions Panel | Complete | 2026-01-19 |
| [PL0034](PL0034-action-history-view.md) | US0031 | Action History View | Complete | 2026-01-19 |
| [PL0035](PL0035-action-slack-notifications.md) | US0032 | Action Execution Slack Notifications | Complete | 2026-01-19 |

### [EP0005: Cost Tracking](../epics/EP0005-cost-tracking.md)

| ID | Story | Title | Status | Created |
|----|-------|-------|--------|---------|
| [PL0038](PL0038-electricity-rate-configuration.md) | US0034 | Electricity Rate Configuration | Complete | 2026-01-20 |
| [PL0039](PL0039-dashboard-cost-display.md) | US0035 | Dashboard Cost Summary Display | Complete | 2026-01-20 |
| [PL0040](PL0040-cost-breakdown-view.md) | US0036 | Cost Breakdown View | Complete | 2026-01-20 |
| [PL0041](PL0041-agent-cpu-details.md) | US0053 | Agent CPU Details Collection | Complete | 2026-01-20 |
| [PL0042](PL0042-machine-category-profiles.md) | US0054 | Machine Category Power Profiles | Complete | 2026-01-20 |
| [PL0043](PL0043-power-configuration-ui.md) | US0056 | Power Configuration UI | Complete | 2026-01-21 |
| [PL0200](PL0200-historical-cost-tracking.md) | US0183 | Historical Cost Tracking | Complete | 2026-01-29 |

### [EP0006: Ad-hoc Scanning](../epics/EP0006-adhoc-scanning.md)

| ID | Story | Title | Status | Created |
|----|-------|-------|--------|---------|
| [PL0044](PL0044-ssh-key-configuration.md) | US0037 | SSH Key Configuration | Complete | 2026-01-21 |
| [PL0045](PL0045-scan-initiation.md) | US0038 | Scan Initiation | Complete | 2026-01-21 |
| [PL0046](PL0046-scan-results-display.md) | US0039 | Scan Results Display | Complete | 2026-01-21 |
| [PL0047](PL0047-scan-history.md) | US0040 | Scan History View | Complete | 2026-01-21 |
| [PL0048](PL0048-network-discovery.md) | US0041 | Network Discovery | Complete | 2026-01-21 |
| [PL0049](PL0049-scan-dashboard-integration.md) | US0042 | Scan Dashboard Integration | Complete | 2026-01-21 |
| [PL0052](PL0052-ssh-key-manager-ui.md) | US0071 | SSH Key Manager UI | Complete | 2026-01-22 |

### [EP0007: Analytics & Reporting](../epics/EP0007-analytics-reporting.md)

| ID | Story | Title | Status | Created |
|----|-------|-------|--------|---------|
| [PL0207](PL0207-tiered-data-retention.md) | US0046 | Tiered Data Retention and Rollup | Complete | 2026-01-20 |

### [EP0008: Tailscale Integration](../epics/EP0008-tailscale-integration.md)

| ID | Story | Title | Status | Created |
|----|-------|-------|--------|---------|
| [PL0076](PL0076-credential-encryption-storage.md) | US0081 | Credential Encryption and Storage | Complete | 2026-01-26 |
| [PL0077](PL0077-tailscale-api-client.md) | US0076 | Tailscale API Client Integration | Complete | 2026-01-26 |
| [PL0078](PL0078-tailscale-device-discovery.md) | US0077 | Tailscale Device Discovery | Complete | 2026-01-26 |
| [PL0079](PL0079-tailscale-machine-registration.md) | US0078 | Machine Registration via Tailscale | Complete | 2026-01-26 |
| [PL0080](PL0080-ssh-connection-tailscale.md) | US0079 | SSH Connection via Tailscale | Complete | 2026-01-26 |
| [PL0081](PL0081-connectivity-mode-management.md) | US0080 | Connectivity Mode Management | Complete | 2026-01-26 |
| [PL0093](PL0093-unified-ssh-key-management.md) | US0093 | Unified SSH Key Management | Complete | 2026-01-27 |

### [EP0009: Workstation Management](../epics/EP0009-workstation-management.md)

| ID | Story | Title | Status | Created |
|----|-------|-------|--------|---------|
| [PL0089](PL0089-workstation-aware-alerting.md) | US0089 | Workstation-Aware Alerting | Complete | 2026-01-27 |
| [PL0090](PL0090-last-seen-ui-workstations.md) | US0090 | Last Seen UI for Workstations | Complete | 2026-01-27 |
| [PL0091](PL0091-visual-distinction-workstations.md) | US0091 | Visual Distinction (Server vs Workstation) | Complete | 2026-01-27 |
| [PL0092](PL0092-workstation-cost-tracking.md) | US0092 | Workstation Cost Tracking | Complete | 2026-01-27 |

### [EP0010: Configuration Management](../epics/EP0010-configuration-management.md)

| ID | Story | Title | Status | Created |
|----|-------|-------|--------|---------|
| [PL0180](PL0180-configuration-pack-definitions.md) | US0116 | Configuration Pack Definitions | Complete | 2026-01-29 |
| [PL0181](PL0181-pack-compliance-check.md) | US0117 | Configuration Compliance Checker | Complete | 2026-01-29 |
| [PL0182](PL0182-configuration-diff-view.md) | US0118 | Configuration Diff View | Complete | 2026-01-29 |
| [PL0183](PL0183-apply-configuration-pack.md) | US0119 | Apply Configuration Pack | Complete | 2026-01-29 |
| [PL0185](PL0185-compliance-dashboard-widget.md) | US0120 | Compliance Dashboard Widget | Complete | 2026-01-29 |
| [PL0186](PL0186-configuration-drift-detection.md) | US0122 | Configuration Drift Detection | Complete | 2026-01-29 |
| [PL0187](PL0187-pack-assignment-per-machine.md) | US0121 | Pack Assignment per Machine | Complete | 2026-01-29 |
| [PL0190](PL0190-remove-configuration-pack.md) | US0123 | Remove Configuration Pack | Complete | 2026-01-29 |

### [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md)

| ID | Story | Title | Status | Created |
|----|-------|-------|--------|---------|
| [PL0130](PL0130-drag-drop-card-reordering.md) | US0130 | Drag-and-Drop Card Reordering | Complete | 2026-01-28 |
| [PL0131](PL0131-card-order-persistence.md) | US0131 | Card Order Persistence | Complete | 2026-01-28 |
| [PL0132](PL0132-server-workstation-grouping.md) | US0132 | Server and Workstation Grouping | Complete | 2026-01-28 |
| [PL0133](PL0133-responsive-dashboard-layout.md) | US0133 | Responsive Dashboard Layout | Complete | 2026-01-28 |
| [PL0134](PL0134-dashboard-summary-bar.md) | US0134 | Dashboard Summary Bar | Complete | 2026-01-28 |
| [PL0135](PL0135-card-visual-enhancements.md) | US0135 | Card Visual Enhancements | Complete | 2026-01-28 |
| [PL0136](PL0136-dashboard-preferences-sync.md) | US0136 | Dashboard Preferences Sync | Complete | 2026-01-28 |
| [PL0137](PL0137-cross-section-machine-type-change.md) | US0137 | Cross-Section Machine Type Change | Complete | 2026-01-28 |

### [EP0012: Widget-Based Detail View](../epics/EP0012-widget-based-detail-view.md)

| ID | Story | Title | Status | Created |
|----|-------|-------|--------|---------|
| [PL0164](PL0164-widget-grid-system.md) | US0164 | Widget Grid System | Complete | 2026-01-28 |
| [PL0165](PL0165-cpu-usage-widget.md) | US0165 | CPU Usage Widget | Complete | 2026-01-28 |
| [PL0177](PL0177-responsive-widget-layout.md) | US0177 | Responsive Widget Layout | Complete | 2026-01-29 |
| [PL0178](PL0178-per-filesystem-metrics-api.md) | US0178 | Per-Filesystem Metrics API | Complete | 2026-01-29 |
| [PL0179](PL0179-per-interface-network-metrics-api.md) | US0179 | Per-Interface Network Metrics API | Complete | 2026-01-29 |

### [EP0014: Docker Container Monitoring](../epics/EP0014-docker-container-monitoring.md)

| ID | Story | Title | Status | Created |
|----|-------|-------|--------|---------|
| [PL0205](PL0205-docker-detection.md) | US0157 | Docker Detection | Complete | 2026-02-01 |
| [PL0206](PL0206-container-listing.md) | US0158 | Container Listing via SSH | Complete | 2026-02-01 |

### [EP0015: Per-Host Credential Management](../epics/EP0015-per-host-credential-management.md)

| ID | Story | Title | Status | Created |
|----|-------|-------|--------|---------|
| [PL0085](PL0085-agent-upgrade-sudo-support.md) | US0085 | Fix Agent Upgrade Sudo Support | Complete | 2026-01-27 |
| [PL0086](PL0086-agent-removal-sudo-support.md) | US0086 | Fix Agent Removal Sudo Support | Complete | 2026-01-27 |
| [PL0087](PL0087-per-server-credential-api.md) | US0087 | Per-Server Credential API Endpoints | Complete | 2026-01-27 |
| [PL0088](PL0088-server-credential-ui.md) | US0088 | Server Credential Management UI | Complete | 2026-01-27 |

### [EP0017: Desktop UX Improvements](../epics/EP0017-desktop-ux-improvements.md)

| ID | Story | Title | Status | Created |
|----|-------|-------|--------|---------|
| [PL0109](PL0109-maintenance-mode-indicator.md) | US0109 | Enhanced Maintenance Mode Indicator | Complete | 2026-01-28 |
| [PL0110](PL0110-warning-state-visual.md) | US0110 | Warning State Visual Treatment | Complete | 2026-01-28 |
| [PL0111](PL0111-connectivity-badge.md) | US0111 | Connectivity Badge (Tailscale/SSH) | Complete | 2026-01-28 |
| [PL0112](PL0112-dashboard-search-filter.md) | US0112 | Dashboard Search and Filter | Complete | 2026-01-28 |
| [PL0113](PL0113-inline-metric-sparklines.md) | US0113 | Inline Metric Sparklines | Complete | 2026-01-28 |
| [PL0114](PL0114-accessible-status-indicators.md) | US0114 | Accessible Status Indicators | Complete | 2026-01-28 |
| [PL0115](PL0115-server-card-quick-actions.md) | US0115 | Server Card Quick Actions | Complete | 2026-01-28 |
| [PL0208](PL0208-detail-page-connectivity-badge.md) | US0180 | Detail Page Connectivity Badge | Complete | 2026-01-29 |

### [EP0013: Synchronous Command Execution](../epics/EP0013-synchronous-command-execution.md)

| ID | Story | Title | Status | Created |
|----|-------|-------|--------|---------|
| [PL0188](PL0188-ssh-executor-service.md) | US0151 | SSH Executor Service | Complete | 2026-01-29 |
| [PL0189](PL0189-command-whitelist-enforcement.md) | US0154 | Command Whitelist Enforcement | Complete | 2026-01-29 |
| [PL0210](PL0210-synchronous-command-execution-api.md) | US0153 | Synchronous Command Execution API | Complete | 2026-01-29 |
| [PL0191](PL0191-remove-async-command-channel.md) | US0152 | Remove Async Command Channel | Complete | 2026-01-29 |
| [PL0211](PL0211-command-execution-audit-trail.md) | US0155 | Command Execution Audit Trail | Complete | 2026-01-31 |
| [PL0203](PL0203-command-timeout-configuration.md) | US0186 | Command Timeout Configuration | Complete | 2026-01-31 |
| [PL0204](PL0204-remote-agent-mode-switch.md) | US0188 | Remote Agent Mode Switch | Complete | 2026-01-31 |

## Notes

- Plans are numbered globally (PL0001, PL0002, etc.)
- Each plan links to a specific User Story
- Plan status: Draft -> In Progress -> Complete
- ID collisions resolved 2026-02-19: PL0053 archived, colliding plans renumbered to PL0208-PL0211
- Index refreshed 2026-02-17: added 25 previously untracked plans, promoted all Draft/In Progress plans to Complete
