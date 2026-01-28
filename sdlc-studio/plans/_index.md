# Plan Registry

This document provides an overview of all Implementation Plans in the project.

**Last Updated:** 2026-01-28

## Summary

| Status | Count |
|--------|-------|
| Draft | 12 |
| In Progress | 0 |
| Complete | 55 |
| **Total** | **67** |

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
| [PL0050](PL0050-guid-based-server-identity.md) | US0070 | GUID-Based Server Identity | Draft | 2026-01-22 |
| [PL0053](PL0053-remove-agent-ssh-credentials.md) | US0075 | Remove Agent API SSH Credentials and Verification | Draft | 2026-01-24 |

### [EP0002: Alerting & Notifications](../epics/EP0002-alerting.md)

| ID | Story | Title | Status | Created |
|----|-------|-------|--------|---------|
| [PL0014](PL0014-alert-schema.md) | US0010 | Alert Entity and Database Schema | Complete | 2026-01-19 |
| [PL0015](PL0015-threshold-evaluation.md) | US0011 | Threshold Evaluation and Alert Generation | Complete | 2026-01-19 |
| [PL0016](PL0016-alert-deduplication.md) | US0012 | Alert Deduplication and Auto-Resolve | Complete | 2026-01-19 |
| [PL0017](PL0017-alert-api.md) | US0014 | Alert API Endpoints | Complete | 2026-01-19 |
| [PL0018](PL0018-dashboard-alerts.md) | US0015 | Dashboard Alert Display | Complete | 2026-01-19 |
| [PL0020](PL0020-alert-list-view.md) | US0016 | Alert List and Detail Views | Complete | 2026-01-19 |

### [EP0003: Service Monitoring](../epics/EP0003-service-monitoring.md)

| ID | Story | Title | Status | Created |
|----|-------|-------|--------|---------|
| [PL0021](PL0021-service-schema.md) | US0017 | Service Entity and Expected Services Schema | Complete | 2026-01-19 |
| [PL0022](PL0022-agent-service-collection.md) | US0018 | Agent Service Status Collection | Complete | 2026-01-19 |
| [PL0023](PL0023-expected-services-api.md) | US0019 | Expected Services Configuration API | Complete | 2026-01-19 |
| [PL0024](PL0024-service-status-display.md) | US0020 | Service Status Display in Server Detail | Complete | 2026-01-19 |
| [PL0025](PL0025-service-alerts.md) | US0021 | Service-Down Alert Generation | Complete | 2026-01-19 |
| [PL0026](PL0026-service-restart-action.md) | US0022 | Service Restart Action | Complete | 2026-01-19 |
| [PL0051](PL0051-service-discovery-during-install.md) | US0069 | Service Discovery During Install | Draft | 2026-01-22 |

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

### [EP0006: Ad-hoc Scanning](../epics/EP0006-adhoc-scanning.md)

| ID | Story | Title | Status | Created |
|----|-------|-------|--------|---------|
| [PL0044](PL0044-ssh-key-configuration.md) | US0037 | SSH Key Configuration | Complete | 2026-01-21 |
| [PL0045](PL0045-scan-initiation.md) | US0038 | Scan Initiation | Complete | 2026-01-21 |
| [PL0046](PL0046-scan-results-display.md) | US0039 | Scan Results Display | Draft | 2026-01-21 |
| [PL0052](PL0052-ssh-key-manager-ui.md) | US0071 | SSH Key Manager UI | Draft | 2026-01-22 |

### [EP0008: Tailscale Integration](../epics/EP0008-tailscale-integration.md)

| ID | Story | Title | Status | Created |
|----|-------|-------|--------|---------|
| [PL0076](PL0076-credential-encryption-storage.md) | US0081 | Credential Encryption and Storage | Complete | 2026-01-26 |
| [PL0077](PL0077-tailscale-api-client.md) | US0076 | Tailscale API Client Integration | Complete | 2026-01-26 |
| [PL0078](PL0078-tailscale-device-discovery.md) | US0077 | Tailscale Device Discovery | Complete | 2026-01-26 |
| [PL0079](PL0079-tailscale-machine-registration.md) | US0078 | Machine Registration via Tailscale | Draft | 2026-01-26 |
| [PL0080](PL0080-ssh-connection-tailscale.md) | US0079 | SSH Connection via Tailscale | Complete | 2026-01-26 |
| [PL0081](PL0081-connectivity-mode-management.md) | US0080 | Connectivity Mode Management | Draft | 2026-01-26 |
| [PL0093](PL0093-unified-ssh-key-management.md) | US0093 | Unified SSH Key Management | Draft | 2026-01-27 |

### [EP0015: Per-Host Credential Management](../epics/EP0015-per-host-credential-management.md)

| ID | Story | Title | Status | Created |
|----|-------|-------|--------|---------|
| [PL0085](PL0085-agent-upgrade-sudo-support.md) | US0085 | Fix Agent Upgrade Sudo Support | Complete | 2026-01-27 |
| [PL0086](PL0086-agent-removal-sudo-support.md) | US0086 | Fix Agent Removal Sudo Support | Complete | 2026-01-27 |
| [PL0087](PL0087-per-server-credential-api.md) | US0087 | Per-Server Credential API Endpoints | Complete | 2026-01-27 |
| [PL0088](PL0088-server-credential-ui.md) | US0088 | Server Credential Management UI | Draft | 2026-01-27 |

## All Plans

| ID | Story | Title | Epic | Status |
|----|-------|-------|------|--------|
| [PL0001](PL0001-api-infrastructure.md) | US0045 | API Infrastructure and Authentication | EP0001 | Complete |
| [PL0002](PL0002-database-schema.md) | US0001 | Database Schema and Migrations | EP0001 | Complete |
| [PL0003](PL0003-server-registration-api.md) | US0002 | Server Registration API | EP0001 | Complete |
| [PL0004](PL0004-agent-heartbeat-endpoint.md) | US0003 | Agent Heartbeat Endpoint | EP0001 | Complete |
| [PL0005](PL0005-server-status-detection.md) | US0008 | Server Status Detection | EP0001 | Complete |
| [PL0006](PL0006-data-retention-pruning.md) | US0009 | Data Retention and Pruning | EP0001 | Complete |
| [PL0007](PL0007-agent-script.md) | US0004 | Agent Script and Systemd Service | EP0001 | Complete |
| [PL0008](PL0008-dashboard-server-list.md) | US0005 | Dashboard Server List | EP0001 | Complete |
| [PL0009](PL0009-server-detail-view.md) | US0006 | Server Detail View | EP0001 | Complete |
| [PL0010](PL0010-historical-metrics-charts.md) | US0007 | Historical Metrics and Charts | EP0001 | Complete |
| [PL0011](PL0011-system-settings-configuration.md) | US0043 | System Settings Configuration | EP0001 | Complete |
| [PL0012](PL0012-package-update-display.md) | US0044 | Package Update Display | EP0001 | Complete |
| [PL0013](PL0013-test-webhook-button.md) | US0049 | Test Webhook Button | EP0001 | Complete |
| [PL0014](PL0014-alert-schema.md) | US0010 | Alert Entity and Database Schema | EP0002 | Complete |
| [PL0015](PL0015-threshold-evaluation.md) | US0011 | Threshold Evaluation and Alert Generation | EP0002 | Complete |
| [PL0016](PL0016-alert-deduplication.md) | US0012 | Alert Deduplication and Auto-Resolve | EP0002 | Complete |
| [PL0017](PL0017-alert-api.md) | US0014 | Alert API Endpoints | EP0002 | Complete |
| [PL0018](PL0018-dashboard-alerts.md) | US0015 | Dashboard Alert Display | EP0002 | Complete |
| [PL0019](PL0019-openapi-compliance.md) | US0050 | OpenAPI 3.1 Production Compliance | EP0001 | Complete |
| [PL0020](PL0020-alert-list-view.md) | US0016 | Alert List and Detail Views | EP0002 | Complete |
| [PL0021](PL0021-service-schema.md) | US0017 | Service Entity and Expected Services Schema | EP0003 | Complete |
| [PL0022](PL0022-agent-service-collection.md) | US0018 | Agent Service Status Collection | EP0003 | Complete |
| [PL0023](PL0023-expected-services-api.md) | US0019 | Expected Services Configuration API | EP0003 | Complete |
| [PL0024](PL0024-service-status-display.md) | US0020 | Service Status Display in Server Detail | EP0003 | Complete |
| [PL0025](PL0025-service-alerts.md) | US0021 | Service-Down Alert Generation | EP0003 | Complete |
| [PL0026](PL0026-service-restart-action.md) | US0022 | Service Restart Action | EP0003 | Complete |
| [PL0027](PL0027-remediation-action-schema.md) | US0023 | Extended Remediation Action Schema | EP0004 | Complete |
| [PL0028](PL0028-action-queue-api.md) | US0024 | Action Queue API | EP0004 | Complete |
| [PL0029](PL0029-heartbeat-command-channel.md) | US0025 | Heartbeat Command Channel | EP0004 | Complete |
| [PL0030](PL0030-maintenance-mode-approval.md) | US0026 | Maintenance Mode Approval | EP0004 | Complete |
| [PL0031](PL0031-agent-command-execution.md) | US0027 | Agent Command Execution | EP0004 | Complete |
| [PL0032](PL0032-maintenance-mode-frontend.md) | US0029 | Maintenance Mode Frontend | EP0004 | Complete |
| [PL0033](PL0033-pending-actions-panel.md) | US0030 | Pending Actions Panel | EP0004 | Complete |
| [PL0034](PL0034-action-history-view.md) | US0031 | Action History View | EP0004 | Complete |
| [PL0035](PL0035-action-slack-notifications.md) | US0032 | Action Execution Slack Notifications | EP0004 | Complete |
| [PL0036](PL0036-package-update-list.md) | US0051 | Package Update List View | EP0001 | Complete |
| [PL0037](PL0037-trigger-package-updates.md) | US0052 | Trigger Package Updates | EP0001 | Complete |
| [PL0038](PL0038-electricity-rate-configuration.md) | US0034 | Electricity Rate Configuration | EP0005 | Complete |
| [PL0041](PL0041-agent-cpu-details.md) | US0053 | Agent CPU Details Collection | EP0005 | Complete |
| [PL0039](PL0039-dashboard-cost-display.md) | US0035 | Dashboard Cost Summary Display | EP0005 | Complete |
| [PL0040](PL0040-cost-breakdown-view.md) | US0036 | Cost Breakdown View | EP0005 | Complete |
| [PL0042](PL0042-machine-category-profiles.md) | US0054 | Machine Category Power Profiles | EP0005 | Complete |
| [PL0043](PL0043-power-configuration-ui.md) | US0056 | Power Configuration UI | EP0005 | Complete |
| [PL0044](PL0044-ssh-key-configuration.md) | US0037 | SSH Key Configuration | EP0006 | Complete |
| [PL0045](PL0045-scan-initiation.md) | US0038 | Scan Initiation | EP0006 | Complete |
| [PL0046](PL0046-scan-results-display.md) | US0039 | Scan Results Display | EP0006 | Draft |
| [PL0050](PL0050-guid-based-server-identity.md) | US0070 | GUID-Based Server Identity | EP0001 | Draft |
| [PL0053](PL0053-remove-agent-ssh-credentials.md) | US0075 | Remove Agent API SSH Credentials and Verification | EP0001 | Draft |
| [PL0051](PL0051-service-discovery-during-install.md) | US0069 | Service Discovery During Install | EP0003 | Draft |
| [PL0052](PL0052-ssh-key-manager-ui.md) | US0071 | SSH Key Manager UI | EP0006 | Draft |
| [PL0076](PL0076-credential-encryption-storage.md) | US0081 | Credential Encryption and Storage | EP0008 | Complete |
| [PL0077](PL0077-tailscale-api-client.md) | US0076 | Tailscale API Client Integration | EP0008 | Complete |
| [PL0078](PL0078-tailscale-device-discovery.md) | US0077 | Tailscale Device Discovery | EP0008 | Complete |
| [PL0079](PL0079-tailscale-machine-registration.md) | US0078 | Machine Registration via Tailscale | EP0008 | Draft |
| [PL0080](PL0080-ssh-connection-tailscale.md) | US0079 | SSH Connection via Tailscale | EP0008 | Complete |
| [PL0081](PL0081-connectivity-mode-management.md) | US0080 | Connectivity Mode Management | EP0008 | Draft |
| [PL0085](PL0085-agent-upgrade-sudo-support.md) | US0085 | Fix Agent Upgrade Sudo Support | EP0015 | Complete |
| [PL0086](PL0086-agent-removal-sudo-support.md) | US0086 | Fix Agent Removal Sudo Support | EP0015 | Complete |
| [PL0087](PL0087-per-server-credential-api.md) | US0087 | Per-Server Credential API Endpoints | EP0015 | Draft |

### [EP0009: Workstation Management](../epics/EP0009-workstation-management.md)

| ID | Story | Title | Status | Created |
|----|-------|-------|--------|---------|
| [PL0089](PL0089-workstation-aware-alerting.md) | US0089 | Workstation-Aware Alerting | Complete | 2026-01-27 |
| [PL0090](PL0090-last-seen-ui-workstations.md) | US0090 | Last Seen UI for Workstations | Complete | 2026-01-27 |
| [PL0091](PL0091-visual-distinction-workstations.md) | US0091 | Visual Distinction (Server vs Workstation) | Complete | 2026-01-27 |
| [PL0092](PL0092-workstation-cost-tracking.md) | US0092 | Workstation Cost Tracking | Draft | 2026-01-27 |

### [EP0017: Desktop UX Improvements](../epics/EP0017-desktop-ux-improvements.md)

| ID | Story | Title | Status | Created |
|----|-------|-------|--------|---------|
| [PL0109](PL0109-maintenance-mode-indicator.md) | US0109 | Enhanced Maintenance Mode Indicator | Draft | 2026-01-28 |
| [PL0110](PL0110-warning-state-visual.md) | US0110 | Warning State Visual Treatment | Draft | 2026-01-28 |

## By Status

### Draft

- **PL0046**: Scan Results Display (US0039)
- **PL0050**: GUID-Based Server Identity (US0070)
- **PL0051**: Service Discovery During Install (US0069)
- **PL0052**: SSH Key Manager UI (US0071)
- **PL0053**: Remove Agent API SSH Credentials and Verification (US0075)
- **PL0079**: Machine Registration via Tailscale (US0078)
- **PL0081**: Connectivity Mode Management (US0080)
- **PL0087**: Per-Server Credential API Endpoints (US0087)
- **PL0092**: Workstation Cost Tracking (US0092)
- **PL0093**: Unified SSH Key Management (US0093)
- **PL0109**: Enhanced Maintenance Mode Indicator (US0109)
- **PL0110**: Warning State Visual Treatment (US0110)

### In Progress

None

### Complete

- **PL0034**: Action History View (US0031)
- **PL0033**: Pending Actions Panel (US0030)
- **PL0032**: Maintenance Mode Frontend (US0029)
- **PL0031**: Agent Command Execution (US0027)
- **PL0030**: Maintenance Mode Approval (US0026)
- **PL0029**: Heartbeat Command Channel (US0025)
- **PL0028**: Action Queue API (US0024)
- **PL0027**: Extended Remediation Action Schema (US0023)

- **PL0001**: API Infrastructure and Authentication (US0045)
- **PL0002**: Database Schema and Migrations (US0001)
- **PL0003**: Server Registration API (US0002)
- **PL0004**: Agent Heartbeat Endpoint (US0003)
- **PL0005**: Server Status Detection (US0008)
- **PL0006**: Data Retention and Pruning (US0009)
- **PL0007**: Agent Script and Systemd Service (US0004)
- **PL0008**: Dashboard Server List (US0005)
- **PL0009**: Server Detail View (US0006)
- **PL0010**: Historical Metrics and Charts (US0007)
- **PL0011**: System Settings Configuration (US0043)
- **PL0012**: Package Update Display (US0044)
- **PL0013**: Test Webhook Button (US0049)
- **PL0014**: Alert Entity and Database Schema (US0010)
- **PL0015**: Threshold Evaluation and Alert Generation (US0011)
- **PL0016**: Alert Deduplication and Auto-Resolve (US0012)
- **PL0017**: Alert API Endpoints (US0014)
- **PL0018**: Dashboard Alert Display (US0015)
- **PL0019**: OpenAPI 3.1 Production Compliance (US0050)
- **PL0020**: Alert List and Detail Views (US0016)
- **PL0021**: Service Entity and Expected Services Schema (US0017)
- **PL0022**: Agent Service Status Collection (US0018)
- **PL0023**: Expected Services Configuration API (US0019)
- **PL0024**: Service Status Display in Server Detail (US0020)
- **PL0025**: Service-Down Alert Generation (US0021)
- **PL0026**: Service Restart Action (US0022)
- **PL0038**: Electricity Rate Configuration (US0034)
- **PL0039**: Dashboard Cost Summary Display (US0035)
- **PL0044**: SSH Key Configuration (US0037)
- **PL0045**: Scan Initiation (US0038)
- **PL0076**: Credential Encryption and Storage (US0081)
- **PL0077**: Tailscale API Client Integration (US0076)
- **PL0078**: Tailscale Device Discovery (US0077)
- **PL0080**: SSH Connection via Tailscale (US0079)
- **PL0085**: Fix Agent Upgrade Sudo Support (US0085)
- **PL0086**: Fix Agent Removal Sudo Support (US0086)
- **PL0089**: Workstation-Aware Alerting (US0089)
- **PL0090**: Last Seen UI for Workstations (US0090)
- **PL0091**: Visual Distinction (Server vs Workstation) (US0091)

## Notes

- Plans are numbered globally (PL0001, PL0002, etc.)
- Each plan links to a specific User Story
- Plan status: Draft -> In Progress -> Complete
- PL0001 completed on 2026-01-18
- PL0002 completed on 2026-01-18
- PL0003 completed on 2026-01-18
- PL0004 completed on 2026-01-18
- PL0005 completed on 2026-01-18
- PL0006 completed on 2026-01-18
- PL0007 completed on 2026-01-18
- PL0008 completed on 2026-01-18
- PL0009 completed on 2026-01-18
- PL0015 completed on 2026-01-19
- PL0019 completed on 2026-01-19
