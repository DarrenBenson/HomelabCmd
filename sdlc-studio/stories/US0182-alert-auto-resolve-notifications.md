# US0182: Alert Auto-Resolve Notifications

> **Status:** Done
> **Epic:** [EP0002: Alerting & Notifications](../epics/EP0002-alerting.md)
> **Owner:** Darren
> **Created:** 2026-01-29
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** to receive Slack notifications when alerts auto-resolve
**So that** I know when issues have cleared without checking the dashboard

## Context

### Persona Reference

**Darren** - Technical professional managing a homelab. Receives Slack notifications for alerts and wants closure when issues resolve.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Currently, alerts send Slack notifications when they fire but not when they auto-resolve. This means users see "CPU Critical on HOMESERVER" but never see "CPU back to normal on HOMESERVER". This leaves uncertainty about whether issues were resolved or are still ongoing.

---

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| EP0002 | Integration | Slack webhooks | Reuse existing Slack service |
| PRD | Performance | Notification latency < 2 min | Auto-resolve notification sent promptly |
| TRD | Tech Stack | Python/FastAPI | Extend existing notifier service |

---

## Acceptance Criteria

### AC1: Slack notification on auto-resolve

- **Given** an alert has been sent to Slack
- **When** the alert auto-resolves (condition clears)
- **Then** a Slack notification is sent indicating resolution
- **And** the message includes server name, alert type, and resolution time

### AC2: Resolution message format

- **Given** an alert auto-resolves
- **When** the Slack notification is sent
- **Then** the message uses green colour (resolved)
- **And** the message includes duration the alert was active
- **And** the message format matches existing alert style

### AC3: Configurable auto-resolve notifications

- **Given** I am configuring notification settings
- **When** I view Slack notification options
- **Then** I can enable/disable auto-resolve notifications
- **And** the default is enabled (notify on resolve)

### AC4: No notification for manually resolved

- **Given** an alert is manually resolved (not auto-resolved)
- **When** I click "Resolve" in the UI
- **Then** no Slack notification is sent for resolution
- **And** the alert is marked as manually resolved

### AC5: Thread reply for resolved alerts

- **Given** the original alert was sent to Slack
- **When** the alert auto-resolves
- **Then** the resolution notification is sent as a reply to the original message (if thread_ts available)
- **And** if thread_ts not available, send as new message

---

## Scope

### In Scope

- Slack notification on auto-resolve
- Green colour styling for resolved messages
- Duration calculation (time alert was active)
- Enable/disable setting for resolve notifications
- Thread reply to original alert message

### Out of Scope

- Email notifications
- Resolve notifications for manually resolved alerts
- Batch resolve notifications (each alert notifies individually)

---

## Technical Notes

### Implementation Approach

1. **Store Slack message thread_ts:**
   ```python
   class Alert(Base):
       # Existing fields...
       slack_thread_ts: str | None = None  # Store for reply threading
   ```

2. **Update alerting service:**
   ```python
   async def auto_resolve_alert(alert: Alert):
       alert.status = AlertStatus.RESOLVED
       alert.resolved_at = datetime.utcnow()

       if settings.notify_on_auto_resolve and alert.slack_thread_ts:
           await send_resolve_notification(alert)
   ```

3. **Resolution message format:**
   ```python
   def format_resolve_message(alert: Alert) -> dict:
       duration = alert.resolved_at - alert.created_at
       return {
           "attachments": [{
               "color": "#36a64f",  # Green
               "title": f"Resolved: {alert.alert_type} on {alert.server.display_name}",
               "text": f"Alert cleared after {humanize_duration(duration)}",
               "footer": f"Auto-resolved at {alert.resolved_at.isoformat()}"
           }],
           "thread_ts": alert.slack_thread_ts
       }
   ```

4. **Config setting:**
   - Add `notify_on_auto_resolve: bool = True` to notification settings

### Files to Modify

- `backend/src/homelab_cmd/db/models/alert.py` - Add slack_thread_ts
- `backend/src/homelab_cmd/services/alerting.py` - Send resolve notification
- `backend/src/homelab_cmd/services/notifier.py` - Add resolve message format
- `backend/src/homelab_cmd/api/schemas/config.py` - Add setting
- `frontend/src/pages/SettingsPage.tsx` - Toggle for resolve notifications
- Alembic migration for slack_thread_ts

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | Original Slack message deleted | Send as new message (no thread) |
| 2 | Slack webhook fails on resolve | Log error, don't block resolution |
| 3 | Alert resolved very quickly (<1 min) | Show "Resolved after less than a minute" |
| 4 | Alert active for days | Show duration in days/hours |
| 5 | Multiple alerts resolve at once | Send individual notifications |
| 6 | Slack webhook URL not configured | Skip notification silently, log warning |
| 7 | Alert was never sent to Slack (no thread_ts) | Skip resolve notification (no original to reply to) |
| 8 | Setting toggled while alerts are active | Apply new setting to subsequent auto-resolves only |

---

## Test Scenarios

- [x] Auto-resolve sends Slack notification
- [x] Message uses green colour
- [x] Duration displayed correctly
- [ ] Thread reply works when thread_ts available (AC5 deferred)
- [x] New message sent when thread_ts unavailable
- [x] Setting disabled prevents notification
- [x] Manual resolve doesn't send notification
- [x] Webhook failure doesn't block resolution

---

## Dependencies

### Story Dependencies

| Story | Relationship | Status |
|-------|--------------|--------|
| US0012 | Auto-resolve logic | Done |
| US0013 | Slack integration | Done |

---

## Estimation

**Story Points:** 3
**Complexity:** Low-Medium - extends existing notification infrastructure

---

## Open Questions

None.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial story creation from resolved EP0002 open question |
| 2026-01-29 | Claude | Implementation complete (AC1-AC4). AC5 (Thread Reply) deferred - requires database migration for slack_thread_ts storage. |
