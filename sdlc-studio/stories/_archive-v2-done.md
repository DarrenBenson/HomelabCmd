# v2.0 Completed Stories Archive

> **Status:** In Progress (36/77 stories done)
> **Total Points Done:** 250
> **Last Updated:** 2026-01-29

This archive contains completed v2.0 user stories. For current work, see [Story Registry](_index.md).

---

## EP0008: Tailscale Integration (34 pts - Complete)

| Story | Title | Points |
|-------|-------|--------|
| [US0076](US0076-tailscale-api-client.md) | Tailscale API Client Integration | 5 |
| [US0077](US0077-tailscale-device-discovery.md) | Tailscale Device Discovery | 5 |
| [US0078](US0078-tailscale-machine-registration.md) | Machine Registration via Tailscale | 5 |
| [US0079](US0079-ssh-connection-tailscale.md) | SSH Connection via Tailscale | 8 |
| [US0080](US0080-connectivity-mode-management.md) | Connectivity Mode Management | 5 |
| [US0081](US0081-credential-encryption-storage.md) | Credential Encryption and Storage | 3 |
| [US0082](US0082-tailscale-import-with-agent-install.md) | Tailscale Import with Agent Install | 3 |

### Dependency Graph

```
US0081 (Credential Encryption) ── foundation
  │
  ├─► US0076 (Tailscale API Client)
  │     └─► US0077 (Device Discovery)
  │           └─► US0078 (Machine Registration)
  │                 └─► US0079 (SSH Connection)
  │                       └─► US0080 (Connectivity Mode)
  │
  └─► US0079 (SSH Connection) - also needs credential storage
```

---

## EP0009: Workstation Management (27 pts - Complete)

| Story | Title | Points |
|-------|-------|--------|
| US0082 | Machine Type Field and Migration | 3 |
| US0083 | Workstation Registration Workflow | 4 |
| US0088 | Workstation Metrics Collection | 2 |
| [US0089](US0089-workstation-aware-alerting.md) | Workstation-Aware Alerting | 5 |
| [US0090](US0090-last-seen-ui-workstations.md) | Last Seen UI for Workstations | 3 |
| [US0091](US0091-visual-distinction-workstations.md) | Visual Distinction for Workstations | 5 |
| [US0092](US0092-workstation-cost-tracking.md) | Workstation Cost Tracking | 5 |

---

## EP0015: Per-Host Credential Management (24 pts - Complete)

| Story | Title | Points |
|-------|-------|--------|
| [US0083](US0083-per-server-credential-schema.md) | Per-Server Credential Schema | 3 |
| [US0084](US0084-credential-service-per-host.md) | Credential Service Per-Host Support | 5 |
| [US0085](US0085-agent-upgrade-sudo-support.md) | Fix Agent Upgrade Sudo Support | 3 |
| [US0086](US0086-agent-removal-sudo-support.md) | Fix Agent Removal Sudo Support | 3 |
| [US0087](US0087-per-server-credential-api.md) | Per-Server Credential API Endpoints | 5 |
| [US0088](US0088-server-credential-ui.md) | Server Credential Management UI | 5 |

---

## EP0016: Unified Discovery Experience (32 pts - Complete)

| Story | Title | Points |
|-------|-------|--------|
| [US0094](US0094-unified-discovery-page-shell.md) | Unified Discovery Page Shell | 3 |
| [US0095](US0095-unified-device-card-component.md) | Unified Device Card Component | 5 |
| [US0096](US0096-ssh-test-endpoint-tailscale.md) | SSH Test Endpoint for Tailscale Devices | 3 |
| [US0097](US0097-tailscale-devices-with-ssh-status.md) | Tailscale Device List with SSH Status | 5 |
| [US0098](US0098-discovery-filters-component.md) | Discovery Filters Component | 3 |
| [US0099](US0099-unified-import-modal.md) | Unified Import Modal | 5 |
| [US0100](US0100-network-discovery-tab-integration.md) | Network Discovery Tab Integration | 3 |
| [US0101](US0101-tailscale-tab-integration.md) | Tailscale Tab Integration | 3 |
| [US0102](US0102-update-routes-cleanup.md) | Update Routes and Cleanup | 2 |

### Dependency Graph

```
US0094 (Page Shell) ── foundation
  │
  ├─► US0095 (Device Card)
  │     └─► US0099 (Import Modal)
  │
  ├─► US0098 (Filters)
  │
  └─► US0100 (Network Tab) ◄── US0095, US0098
        │
        └─► US0102 (Routes/Cleanup)
              ▲
US0096 (SSH Test Endpoint)
  └─► US0097 (Devices with SSH)
        └─► US0101 (Tailscale Tab) ◄── US0094, US0095, US0098
              └─► US0102 (Routes/Cleanup)
```

---

## EP0017: Desktop UX Improvements (24 pts - Complete)

| Story | Title | Points |
|-------|-------|--------|
| [US0109](US0109-maintenance-mode-indicator.md) | Enhanced Maintenance Mode Indicator | 3 |
| [US0110](US0110-warning-state-visual.md) | Warning State Visual Treatment | 3 |
| [US0111](US0111-connectivity-badge.md) | Connectivity Badge (Tailscale/SSH) | 2 |
| [US0112](US0112-dashboard-search-filter.md) | Dashboard Search and Filter | 5 |
| [US0113](US0113-inline-metric-sparklines.md) | Inline Metric Sparklines | 5 |
| [US0114](US0114-accessible-status-indicators.md) | Accessible Status Indicators | 2 |
| [US0115](US0115-server-card-quick-actions.md) | Server Card Quick Actions | 3 |
| [US0180](US0180-detail-page-connectivity-badge.md) | Detail Page Connectivity Badge | 1 |

### Dependency Graph

```
P1: Visual Indicators
US0109 (Maintenance Indicator) ── no dependencies
US0111 (Connectivity Badge) ── no dependencies
US0110 (Warning State) ── needs active_alert_count

P2: Usability
US0112 (Search/Filter) ── no dependencies
US0113 (Sparklines) ── needs backend endpoint
US0114 (Accessibility) ── updates StatusLED

P3: Efficiency
US0115 (Quick Actions) ── depends on card layout
```

---

## EP0011: Advanced Dashboard UI (37 pts - Complete)

| Story | Title | Points |
|-------|-------|--------|
| [US0130](US0130-drag-drop-card-reordering.md) | Drag-and-Drop Card Reordering | 8 |
| [US0131](US0131-card-order-persistence.md) | Card Order Persistence | 5 |
| [US0132](US0132-server-workstation-grouping.md) | Server and Workstation Grouping | 5 |
| [US0133](US0133-responsive-dashboard-layout.md) | Responsive Dashboard Layout | 5 |
| [US0134](US0134-dashboard-summary-bar.md) | Dashboard Summary Bar | 3 |
| [US0135](US0135-card-visual-enhancements.md) | Card Visual Enhancements | 3 |
| [US0136](US0136-dashboard-preferences-sync.md) | Dashboard Preferences Sync | 3 |
| [US0137](US0137-cross-section-machine-type-change.md) | Cross-Section Machine Type Change | 5 |

### Dependency Graph

```
US0130 (Drag-and-Drop) ── foundation (@dnd-kit)
  │
  ├─► US0131 (Order Persistence) ── backend API
  │     └─► US0136 (Preferences Sync)
  │           ▲
  ├─► US0132 (Grouping) ◄── EP0009 (machine_type)
  │     ├─► US0133 (Responsive Layout)
  │     └─► US0136 (Preferences Sync)
  │
  └─► US0133 (Responsive Layout)

EP0009 (Workstation Management) ◄── dependency
  ├─► US0132 (Grouping)
  ├─► US0134 (Summary Bar)
  └─► US0135 (Visual Enhancements)
```

---

## EP0012: Widget-Based Detail View (53 pts - Complete)

| Story | Title | Points |
|-------|-------|--------|
| [US0164](US0164-widget-grid-system.md) | Widget Grid System | 8 |
| [US0165](US0165-cpu-usage-widget.md) | CPU Usage Widget | 3 |
| [US0166](US0166-memory-usage-widget.md) | Memory Usage Widget | 3 |
| [US0167](US0167-load-average-widget.md) | Load Average Widget | 2 |
| [US0168](US0168-disk-usage-widget.md) | Disk Usage Widget | 3 |
| [US0169](US0169-services-widget.md) | Services Widget | 3 |
| [US0171](US0171-network-widget.md) | Network Widget | 3 |
| [US0172](US0172-system-info-widget.md) | System Info Widget | 2 |
| [US0173](US0173-widget-layout-persistence.md) | Widget Layout Persistence | 5 |
| [US0174](US0174-default-widget-layout.md) | Default Widget Layout | 3 |
| [US0175](US0175-edit-layout-mode.md) | Edit Layout Mode | 3 |
| [US0176](US0176-widget-visibility-toggle.md) | Widget Visibility Toggle | 3 |
| [US0177](US0177-responsive-widget-layout.md) | Responsive Widget Layout | 3 |
| [US0178](US0178-per-filesystem-metrics-api.md) | Per-Filesystem Metrics API | 5 |
| [US0179](US0179-per-interface-network-metrics-api.md) | Per-Interface Network Metrics API | 5 |

---

## EP0010: Configuration Management (18 pts done / 42 total)

| Story | Title | Points | Status |
|-------|-------|--------|--------|
| [US0116](US0116-configuration-pack-definitions.md) | Configuration Pack Definitions | 5 | Done |
| [US0117](US0117-pack-compliance-check.md) | Configuration Compliance Checker | 8 | Done |
| [US0118](US0118-configuration-diff-view.md) | Configuration Diff View | 5 | Done |

*Remaining stories in main index.*

---

## EP0002: Alerting Enhancements (8 pts - Complete)

| Story | Title | Points |
|-------|-------|--------|
| [US0181](US0181-alert-sustained-duration.md) | Alert Sustained Duration Configuration | 5 |
| [US0182](US0182-alert-auto-resolve-notifications.md) | Alert Auto-Resolve Notifications | 3 |
