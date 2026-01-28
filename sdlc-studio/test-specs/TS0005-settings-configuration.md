# TS0005: Settings and Configuration Tests

> **Status:** Complete
> **Epic:** [EP0001: Core Monitoring](../../epics/EP0001-core-monitoring.md)
> **Created:** 2026-01-19
> **Last Updated:** 2026-01-19

## Overview

Test specification for the Settings page, configuration management, and related UI features. Covers threshold configuration, notification settings, Slack webhook integration, and the test webhook functionality.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0043](../../stories/US0043-system-settings-configuration.md) | System Settings Configuration | High |
| [US0049](../../stories/US0049-test-webhook-button.md) | Test Webhook Button | Medium |

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | React component rendering, form validation |
| Integration | Yes | API calls, state management |
| API | Yes | Config endpoints, test-webhook endpoint |
| E2E | Yes | Full user flow through settings page |

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Vitest, React Testing Library, MSW (Mock Service Worker) |
| External Services | Mock API server |
| Test Data | Config fixtures, threshold values |

---

## Test Cases

### TC041: Settings page accessible from dashboard

**Type:** E2E
**Priority:** High
**Story:** US0043 (AC1)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given user is on the dashboard | Dashboard loaded |
| 2 | When clicking the Settings button in header | Navigation triggered |
| 3 | Then Settings page is displayed | /settings route loaded |

#### Test Data

```yaml
input:
  start_route: "/"
  click_target: "[data-testid='settings-link']"
expected:
  final_route: "/settings"
  page_title: "Settings"
```

#### Assertions

- [ ] Settings link visible in header
- [ ] Click navigates to /settings
- [ ] Settings page renders

---

### TC042: Settings page loads current config

**Type:** Integration
**Priority:** High
**Story:** US0043 (AC2)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given config exists in database | API returns config |
| 2 | When Settings page loads | GET /api/v1/config called |
| 3 | Then form fields populated with current values | Values match API response |

#### Test Data

```yaml
input:
  api_response:
    thresholds:
      cpu:
        high_percent: 85
        critical_percent: 95
        sustained_heartbeats: 3
      disk:
        high_percent: 80
        critical_percent: 95
expected:
  cpu_high_field: 85
  disk_high_field: 80
```

#### Assertions

- [ ] GET /api/v1/config called on mount
- [ ] CPU threshold fields show correct values
- [ ] Memory threshold fields show correct values
- [ ] Disk threshold fields show correct values
- [ ] Slack webhook URL field populated

---

### TC043: Per-metric threshold sliders work

**Type:** Unit
**Priority:** High
**Story:** US0043 (AC2)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given Settings page is displayed | Form visible |
| 2 | When adjusting CPU high threshold slider to 90% | Slider moved |
| 3 | Then displayed value updates to 90% | Label shows new value |

#### Test Data

```yaml
input:
  slider: "cpu-high-slider"
  new_value: 90
expected:
  displayed_value: "90%"
  state_value: 90
```

#### Assertions

- [ ] Slider responds to interaction
- [ ] Displayed percentage updates
- [ ] Form state updated

---

### TC044: Duration selector changes heartbeat count

**Type:** Unit
**Priority:** Medium
**Story:** US0043 (AC2)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given CPU section is displayed | Duration buttons visible |
| 2 | When selecting "~3 min" duration | Button clicked |
| 3 | Then sustained_heartbeats set to 3 | State updated |

#### Test Data

```yaml
input:
  metric: "cpu"
  duration_option: "~3 min"
expected:
  sustained_heartbeats: 3
```

#### Assertions

- [ ] Duration buttons rendered for CPU/Memory
- [ ] Click updates selected state
- [ ] sustained_heartbeats value correct

---

### TC045: Thresholds saved via API

**Type:** Integration
**Priority:** High
**Story:** US0043 (AC3)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given threshold values changed | Form dirty |
| 2 | When clicking Save Alerts button | Save triggered |
| 3 | Then PUT /api/v1/config/thresholds called | API request made |

#### Test Data

```yaml
input:
  changes:
    disk:
      high_percent: 75
  button: "[data-testid='save-thresholds']"
expected:
  request_method: "PUT"
  request_path: "/api/v1/config/thresholds"
  request_body:
    disk:
      high_percent: 75
```

#### Assertions

- [ ] PUT request made to correct endpoint
- [ ] Request body contains changed values
- [ ] Success toast shown on 200 response

---

### TC046: Validation rejects invalid percentage

**Type:** Unit
**Priority:** High
**Story:** US0043 (AC8)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given threshold input field | Field visible |
| 2 | When entering value > 100 | Invalid input |
| 3 | Then validation error displayed | Error message shown |

#### Test Data

```yaml
input:
  field: "cpu-high-percent"
  value: 150
expected:
  error: "Value must be between 0 and 100"
  save_disabled: true
```

#### Assertions

- [ ] Validation error message visible
- [ ] Save button disabled
- [ ] Field highlighted as invalid

---

### TC047: Validation enforces critical > high

**Type:** Unit
**Priority:** High
**Story:** US0043 (AC9)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given disk high set to 90% | High threshold set |
| 2 | When setting critical to 85% | Critical < high |
| 3 | Then validation error displayed | Cross-field validation |

#### Test Data

```yaml
input:
  disk_high: 90
  disk_critical: 85
expected:
  error: "Critical threshold must be higher than high threshold"
```

#### Assertions

- [ ] Error message about critical > high
- [ ] Save button disabled
- [ ] Both fields indicated as issue

---

### TC048: Notification cooldowns configurable

**Type:** Unit
**Priority:** Medium
**Story:** US0043 (AC4)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given Notification Frequency section displayed | Section visible |
| 2 | When changing critical cooldown to 60 minutes | Input changed |
| 3 | Then state updated with new value | Form state correct |

#### Test Data

```yaml
input:
  field: "critical-cooldown"
  value: 60
expected:
  cooldowns:
    critical_minutes: 60
```

#### Assertions

- [ ] Cooldown input accepts value
- [ ] State updated correctly
- [ ] Value displayed in field

---

### TC049: Slack webhook URL configurable

**Type:** Unit
**Priority:** High
**Story:** US0043 (AC5)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given Slack Integration section displayed | Section visible |
| 2 | When entering webhook URL | URL typed |
| 3 | Then URL field updated | State reflects input |

#### Test Data

```yaml
input:
  field: "[data-testid='slack-webhook-input']"
  value: "https://hooks.slack.com/services/T00/B00/xxx"
expected:
  slack_webhook_url: "https://hooks.slack.com/services/T00/B00/xxx"
```

#### Assertions

- [ ] Webhook URL field editable
- [ ] URL stored in state
- [ ] Placeholder shows example format

---

### TC050: Notification toggles work (Critical/High only)

**Type:** Unit
**Priority:** Medium
**Story:** US0043 (AC6)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given Slack Integration section displayed | Toggles visible |
| 2 | When viewing notification options | Options rendered |
| 3 | Then only Critical, High, and Remediation toggles shown | No Medium/Low |

#### Test Data

```yaml
expected:
  visible_toggles:
    - "notify_on_critical"
    - "notify_on_high"
    - "notify_on_remediation"
  not_visible:
    - "notify_on_medium"
    - "notify_on_low"
```

#### Assertions

- [ ] Critical toggle present
- [ ] High toggle present
- [ ] Remediation toggle present
- [ ] No Medium toggle
- [ ] No Low toggle

---

### TC051: Notifications saved via API

**Type:** Integration
**Priority:** High
**Story:** US0043 (AC4, AC5)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given notification settings changed | Form dirty |
| 2 | When clicking Save Notifications button | Save triggered |
| 3 | Then PUT /api/v1/config/notifications called | API request made |

#### Test Data

```yaml
input:
  changes:
    slack_webhook_url: "https://hooks.slack.com/new"
    notify_on_high: false
expected:
  request_method: "PUT"
  request_path: "/api/v1/config/notifications"
```

#### Assertions

- [ ] PUT request to notifications endpoint
- [ ] Request body contains all notification settings
- [ ] Success toast on 200 response

---

### TC052: Settings persist after page refresh

**Type:** E2E
**Priority:** High
**Story:** US0043 (AC7)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given threshold changed and saved | API returns success |
| 2 | When page is refreshed | Full reload |
| 3 | Then saved values still displayed | Persistence confirmed |

#### Test Data

```yaml
input:
  saved_disk_high: 75
expected:
  after_refresh_disk_high: 75
```

#### Assertions

- [ ] GET /api/v1/config returns saved values
- [ ] Form displays persisted values
- [ ] No reversion to defaults

---

### TC053: Test webhook button visible when URL entered

**Type:** Unit
**Priority:** High
**Story:** US0049 (AC1)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given Slack webhook URL field has value | URL entered |
| 2 | When viewing the field | UI updated |
| 3 | Then Test button is visible | Button rendered |

#### Test Data

```yaml
input:
  slack_webhook_url: "https://hooks.slack.com/services/xxx"
expected:
  test_button_visible: true
```

#### Assertions

- [ ] Test button rendered next to URL input
- [ ] Button has correct label "Test"
- [ ] Button is clickable

---

### TC054: Test webhook button hidden when URL empty

**Type:** Unit
**Priority:** High
**Story:** US0049 (AC2)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given Slack webhook URL field is empty | No URL |
| 2 | When viewing the field | UI rendered |
| 3 | Then Test button is not visible | Button hidden |

#### Test Data

```yaml
input:
  slack_webhook_url: ""
expected:
  test_button_visible: false
```

#### Assertions

- [ ] Test button not in DOM (or hidden)
- [ ] URL field still editable

---

### TC055: Test webhook shows loading state

**Type:** Unit
**Priority:** Medium
**Story:** US0049 (AC6)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given Test button is clicked | Request in progress |
| 2 | When waiting for response | Loading state |
| 3 | Then button shows spinner and is disabled | UI feedback |

#### Test Data

```yaml
input:
  click: "[data-testid='test-webhook-button']"
expected:
  button_disabled: true
  spinner_visible: true
  button_text: "Testing..."
```

#### Assertions

- [ ] Button disabled during request
- [ ] Spinner/loading indicator shown
- [ ] Text changes to "Testing..."

---

### TC056: Test webhook success shows feedback

**Type:** Integration
**Priority:** High
**Story:** US0049 (AC4)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given valid webhook URL entered | URL valid |
| 2 | When Test button clicked and API returns success | 200 response |
| 3 | Then success message displayed | Green feedback |

#### Test Data

```yaml
input:
  api_response:
    success: true
    message: "Test message sent successfully"
expected:
  feedback_type: "success"
  feedback_text: "Test message sent!"
```

#### Assertions

- [ ] Success message displayed
- [ ] Green/success styling
- [ ] Message contains success text

---

### TC057: Test webhook failure shows error

**Type:** Integration
**Priority:** High
**Story:** US0049 (AC5)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given invalid webhook URL entered | URL invalid |
| 2 | When Test button clicked and API returns error | Error response |
| 3 | Then error message displayed with reason | Red feedback |

#### Test Data

```yaml
input:
  api_response:
    success: false
    error: "Invalid webhook URL"
expected:
  feedback_type: "error"
  feedback_text: "Invalid webhook URL"
```

#### Assertions

- [ ] Error message displayed
- [ ] Red/error styling
- [ ] Error reason shown

---

### TC058: Test webhook API sends correct payload

**Type:** API
**Priority:** High
**Story:** US0049 (AC3)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given webhook URL configured | URL in request |
| 2 | When POST /api/v1/config/test-webhook called | Request made |
| 3 | Then request body contains webhook_url | Correct payload |

#### Test Data

```yaml
input:
  webhook_url: "https://hooks.slack.com/services/xxx"
expected:
  request_method: "POST"
  request_path: "/api/v1/config/test-webhook"
  request_body:
    webhook_url: "https://hooks.slack.com/services/xxx"
```

#### Assertions

- [ ] POST request to correct endpoint
- [ ] webhook_url in request body
- [ ] X-API-Key header included

---

### TC059: Test webhook API returns 200 on success

**Type:** API
**Priority:** High
**Story:** US0049 (AC3, AC4)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given valid webhook URL in request | Slack accepts message |
| 2 | When backend posts to Slack | 200 from Slack |
| 3 | Then API returns success response | success: true |

#### Test Data

```yaml
input:
  webhook_url: "https://hooks.slack.com/valid"
  mock_slack_response: 200
expected:
  status_code: 200
  body:
    success: true
    message: "Test message sent successfully"
```

#### Assertions

- [ ] Response status is 200
- [ ] success field is true
- [ ] message field present

---

### TC060: Test webhook API handles 404 from Slack

**Type:** API
**Priority:** Medium
**Story:** US0049 (AC5)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given invalid webhook URL | Slack returns 404 |
| 2 | When backend posts to Slack | 404 response |
| 3 | Then API returns error response | "Invalid webhook URL" |

#### Test Data

```yaml
input:
  webhook_url: "https://hooks.slack.com/invalid"
  mock_slack_response: 404
expected:
  status_code: 200  # API returns 200 with error in body
  body:
    success: false
    error: "Invalid webhook URL"
```

#### Assertions

- [ ] success field is false
- [ ] error field contains "Invalid webhook URL"

---

### TC061: Test webhook API handles timeout

**Type:** API
**Priority:** Medium
**Story:** US0049 (AC5)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given webhook URL times out | 10 second timeout |
| 2 | When backend posts to Slack | TimeoutException |
| 3 | Then API returns timeout error | "Connection timed out" |

#### Test Data

```yaml
input:
  webhook_url: "https://hooks.slack.com/slow"
  mock_error: "TimeoutException"
expected:
  body:
    success: false
    error: "Connection timed out"
```

#### Assertions

- [ ] success field is false
- [ ] error mentions timeout

---

### TC062: Test webhook API handles rate limit

**Type:** API
**Priority:** Low
**Story:** US0049 (AC5)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given Slack returns 429 | Rate limited |
| 2 | When backend posts to Slack | 429 response |
| 3 | Then API returns rate limit error | "Too many requests" |

#### Test Data

```yaml
input:
  mock_slack_response: 429
expected:
  body:
    success: false
    error: "Too many requests, try again later"
```

#### Assertions

- [ ] success field is false
- [ ] error mentions rate limit

---

## Fixtures

```yaml
# Shared test data for this spec
config:
  default_thresholds:
    cpu:
      high_percent: 85
      critical_percent: 95
      sustained_heartbeats: 3
    memory:
      high_percent: 85
      critical_percent: 95
      sustained_heartbeats: 3
    disk:
      high_percent: 80
      critical_percent: 95
      sustained_heartbeats: 0
    server_offline_seconds: 180

  default_notifications:
    slack_webhook_url: ""
    cooldowns:
      critical_minutes: 30
      high_minutes: 240
    notify_on_critical: true
    notify_on_high: true
    notify_on_remediation: true

slack:
  valid_webhook: "https://hooks.slack.example/services/TXXXXXX/BXXXXXX/placeholder"

api_key: "test-api-key-12345"
```

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC041 | Settings page accessible from dashboard | Automated | `frontend/src/pages/Settings.test.tsx` |
| TC042 | Settings page loads current config | Automated | `frontend/src/pages/Settings.test.tsx` |
| TC043 | Per-metric threshold sliders work | Automated | `frontend/src/pages/Settings.test.tsx` |
| TC044 | Duration selector changes heartbeat count | Automated | `frontend/src/pages/Settings.test.tsx` |
| TC045 | Thresholds saved via API | Automated | `frontend/src/pages/Settings.test.tsx`, `tests/test_config.py` |
| TC046 | Validation rejects invalid percentage | Automated | `tests/test_config.py` |
| TC047 | Validation enforces critical > high | Automated | `tests/test_config.py` |
| TC048 | Notification cooldowns configurable | Automated | `frontend/src/pages/Settings.test.tsx` |
| TC049 | Slack webhook URL configurable | Automated | `frontend/src/pages/Settings.test.tsx` |
| TC050 | Notification toggles work (Critical/High only) | Automated | `frontend/src/pages/Settings.test.tsx` |
| TC051 | Notifications saved via API | Automated | `frontend/src/pages/Settings.test.tsx`, `tests/test_config.py` |
| TC052 | Settings persist after page refresh | Automated | `tests/test_config.py` |
| TC053 | Test webhook button visible when URL entered | Automated | `frontend/src/pages/Settings.test.tsx` |
| TC054 | Test webhook button hidden when URL empty | Automated | `frontend/src/pages/Settings.test.tsx` |
| TC055 | Test webhook shows loading state | Automated | `frontend/src/pages/Settings.test.tsx` |
| TC056 | Test webhook success shows feedback | Automated | `frontend/src/pages/Settings.test.tsx` |
| TC057 | Test webhook failure shows error | Automated | `frontend/src/pages/Settings.test.tsx` |
| TC058 | Test webhook API sends correct payload | Automated | `tests/test_webhook.py` |
| TC059 | Test webhook API returns 200 on success | Automated | `tests/test_webhook.py` |
| TC060 | Test webhook API handles 404 from Slack | Automated | `tests/test_webhook.py` |
| TC061 | Test webhook API handles timeout | Automated | `tests/test_webhook.py` |
| TC062 | Test webhook API handles rate limit | Automated | `tests/test_webhook.py` |

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../../prd.md) |
| TRD | [sdlc-studio/trd.md](../../trd.md) |
| Epic | [EP0001](../../epics/EP0001-core-monitoring.md) |
| Strategy | [sdlc-studio/tsd.md](../tsd.md) |

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-19 | Claude | Initial spec generation for settings and configuration tests |
| 2026-01-19 | Claude | All 22 test cases automated - status changed to Complete |
