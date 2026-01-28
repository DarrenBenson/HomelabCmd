# US0043: System Settings Configuration

> **Status:** Done
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** to configure alert thresholds and notification preferences through a web UI
**So that** I can tune alerting behaviour without editing config files

## Context

### Persona Reference

**Darren** - Wants to tweak thresholds over time as he learns what's normal for his servers. Prefers UI configuration over SSH/file editing.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

The Settings UI allows configuration of:

1. **Per-metric thresholds:** High and critical percentages for CPU, Memory, Disk
2. **Duration settings:** How long a condition must persist before alerting (for transient metrics)
3. **Notification cooldowns:** How often to remind about ongoing issues
4. **Slack integration:** Webhook URL and notification preferences

Changes are persisted to the database Config table and take effect immediately.

## Acceptance Criteria

### AC1: Settings page accessible from dashboard

- **Given** the user is on the dashboard
- **When** clicking the Settings button in the header
- **Then** the Settings page is displayed

### AC2: Per-metric threshold configuration

- **Given** the Settings page is displayed
- **When** viewing the Resource Alerts section
- **Then** I can see and edit for each metric (CPU, Memory, Disk):
  - High threshold percentage
  - Critical threshold percentage
  - Duration selector (for CPU/Memory)

### AC3: Threshold changes saved via API

- **Given** I change disk high threshold from 80% to 75%
- **When** clicking Save
- **Then** PUT /api/v1/config/thresholds is called and confirmation shown

### AC4: Notification cooldown configuration

- **Given** the Settings page is displayed
- **When** viewing the Notification Frequency section
- **Then** I can configure:
  - Critical reminder interval (default 30 min)
  - High reminder interval (default 4 hours)
  - Whether to notify on resolution

### AC5: Slack webhook URL configurable

- **Given** the Settings page is displayed
- **When** viewing the Slack Integration section
- **Then** I can enter/update the Slack webhook URL

### AC6: Notification toggles (Critical/High/Remediation only)

- **Given** the Settings page is displayed
- **When** viewing the Slack Integration section
- **Then** I see toggles for Critical, High, and Remediation notifications only
- **And** I do NOT see Medium or Low toggles (no triggers defined)

### AC7: Settings persist across restarts

- **Given** I save new threshold values
- **When** the application restarts
- **Then** the saved values are loaded from the database

### AC8: Validation on threshold values

- **Given** I enter an invalid threshold (e.g., 150%)
- **When** clicking Save
- **Then** validation error is displayed, save is prevented

### AC9: Critical must be higher than high

- **Given** I set disk high to 90% and critical to 85%
- **When** attempting to save
- **Then** validation error shown: "Critical threshold must be higher than high threshold"

## Scope

### In Scope

- Settings page UI with grouped metric cards
- Per-metric threshold configuration (high + critical)
- Duration selector for transient metrics (CPU, Memory)
- Notification cooldown settings
- GET /api/v1/config endpoint
- PUT /api/v1/config/thresholds endpoint
- PUT /api/v1/settings/notifications endpoint
- Threshold validation (0-100 for percentages, critical > high)
- Persistence to Config table
- Toast confirmation on save

### Out of Scope

- Per-server threshold overrides
- Email/Discord notification configuration
- User management/authentication settings
- Agent configuration via UI
- Test webhook button

## UI/UX Requirements

### Settings Page Layout

```
+-----------------------------------------------------------+
| Settings                                        [< Back]   |
+-----------------------------------------------------------+
|                                                            |
| RESOURCE ALERTS                                            |
| ---------------------------------------------------------- |
|                                                            |
| [CPU]                                                      |
|   High: [===|=====] 85%     Critical: [=======|=] 95%     |
|   Duration: [Immediately | ~1 min | ~3 min* | ~5 min]     |
|   * Recommended - brief spikes are normal                  |
|                                                            |
| [Memory]                                                   |
|   High: [===|=====] 85%     Critical: [=======|=] 95%     |
|   Duration: [~3 min*]                                      |
|                                                            |
| [Disk]                                                     |
|   High: [==|======] 80%     Critical: [=======|=] 95%     |
|   (Alerts immediately - disk issues don't resolve)         |
|                                                            |
| [Offline]                                                  |
|   After: [180] seconds (3 missed heartbeats)              |
|                                                            |
|                                            [Save Alerts]   |
| ---------------------------------------------------------- |
|                                                            |
| NOTIFICATION FREQUENCY                                     |
| ---------------------------------------------------------- |
|                                                            |
| Remind me about ongoing issues:                            |
|   Critical: every [30] minutes                             |
|   High: every [4] hours                                    |
|                                                            |
| [x] Notify when issues resolve                             |
|                                                            |
|                                       [Save Notifications] |
| ---------------------------------------------------------- |
|                                                            |
| SLACK INTEGRATION                                          |
| ---------------------------------------------------------- |
|                                                            |
| Webhook URL: [https://hooks.slack.com/...]                 |
|                                                            |
| Send notifications for:                                    |
|   [x] Critical alerts    [x] High alerts                   |
|                                                            |
|                                             [Save Slack]   |
+-----------------------------------------------------------+
```

### Duration Options

| Label | Heartbeats | Minutes |
|-------|------------|---------|
| Immediately | 0 | 0 |
| ~1 min | 1 | ~1 |
| ~3 min | 3 | ~3 |
| ~5 min | 5 | ~5 |

Note: Duration expressed in minutes for user clarity, stored as heartbeat count.

## Technical Notes

### API Contracts

**GET /api/v1/config**
```json
Response 200:
{
  "thresholds": {
    "cpu": {
      "high_percent": 85,
      "critical_percent": 95,
      "sustained_heartbeats": 3
    },
    "memory": {
      "high_percent": 85,
      "critical_percent": 95,
      "sustained_heartbeats": 3
    },
    "disk": {
      "high_percent": 80,
      "critical_percent": 95,
      "sustained_heartbeats": 0
    },
    "server_offline_seconds": 180
  },
  "notifications": {
    "slack_webhook_url": "https://hooks.slack.com/...",
    "cooldowns": {
      "critical_minutes": 30,
      "high_minutes": 240
    },
    "notify_on_critical": true,
    "notify_on_high": true,
    "notify_on_remediation": true
  }
}
```

**PUT /api/v1/config/thresholds**
```json
Request:
{
  "cpu": {
    "high_percent": 85,
    "critical_percent": 95,
    "sustained_heartbeats": 3
  },
  "disk": {
    "high_percent": 75,
    "critical_percent": 90
  }
}

Response 200:
{
  "updated": ["cpu", "disk"],
  "thresholds": { ... }
}
```

**PUT /api/v1/settings/notifications**
```json
Request:
{
  "slack_webhook_url": "https://hooks.slack.com/new-webhook",
  "cooldowns": {
    "critical_minutes": 30,
    "high_minutes": 240
  },
  "notify_on_critical": true,
  "notify_on_high": true,
  "notify_on_remediation": true
}

Response 200:
{
  "updated": ["slack_webhook_url", "cooldowns"],
  "notifications": { ... }
}
```

**TRD Reference:** [§4 API Contracts - Configuration & System](../trd.md#4-api-contracts)

### Data Requirements

- Config table stores key-value pairs (already defined in TRD)
- Threshold values loaded into memory at startup
- Changes trigger immediate effect (no restart needed)

### Configuration Schema

```python
class MetricThreshold(BaseModel):
    """Per-metric threshold configuration."""
    high_percent: int = Field(ge=0, le=100)
    critical_percent: int = Field(ge=0, le=100)
    sustained_heartbeats: int = Field(default=0, ge=0, le=10)

    @model_validator(mode='after')
    def critical_higher_than_high(self) -> Self:
        if self.critical_percent <= self.high_percent:
            raise ValueError('critical_percent must be greater than high_percent')
        return self


class CooldownConfig(BaseModel):
    """Notification cooldown settings."""
    critical_minutes: int = Field(default=30, ge=5, le=1440)
    high_minutes: int = Field(default=240, ge=15, le=1440)


class ThresholdsConfig(BaseModel):
    """Full thresholds configuration."""
    cpu: MetricThreshold = MetricThreshold(high_percent=85, critical_percent=95, sustained_heartbeats=3)
    memory: MetricThreshold = MetricThreshold(high_percent=85, critical_percent=95, sustained_heartbeats=3)
    disk: MetricThreshold = MetricThreshold(high_percent=80, critical_percent=95, sustained_heartbeats=0)
    server_offline_seconds: int = Field(default=180, ge=30)


class NotificationsConfig(BaseModel):
    """Notification configuration."""
    slack_webhook_url: str = ""
    cooldowns: CooldownConfig = CooldownConfig()
    notify_on_critical: bool = True
    notify_on_high: bool = True
    notify_on_remediation: bool = True
```

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Invalid percentage (> 100 or < 0) | 422 Validation Error with field name |
| Critical <= high threshold | 422 Validation Error |
| Invalid webhook URL format | 422 Validation Error |
| Database write failure | 500 with retry suggestion |
| Concurrent updates | Last write wins (acceptable for single-user) |

## Test Scenarios

- [ ] Settings page loads with current values
- [ ] Per-metric threshold sliders work correctly
- [ ] Duration selector changes sustained_heartbeats value
- [ ] Critical > high validation enforced
- [ ] Cooldown settings save correctly
- [ ] Webhook URL changes save successfully
- [ ] Invalid threshold rejected
- [ ] Settings persist after restart
- [ ] Cancel discards unsaved changes
- [ ] Success toast shown after save
- [ ] Medium/Low notification toggles NOT present

## Definition of Done


**Story-specific additions:**

- [ ] Default values documented
- [ ] Settings page responsive on mobile
- [ ] All metric cards render correctly

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0001: Database Schema | Story | Done |
| US0005: Dashboard Server List | Story | Done |
| US0011: Threshold Evaluation | Story | Draft |
| US0012: Alert Deduplication | Story | Draft |

## Estimation

**Story Points:** 5

**Complexity:** Medium - CRUD UI with validation, new schema structure

## Open Questions

None - UI design resolved in alerting model redesign.

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation (QA gap analysis) |
| 2026-01-19 | Claude | Major revision: Per-metric thresholds with duration, cooldown settings, removed Medium/Low toggles |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
