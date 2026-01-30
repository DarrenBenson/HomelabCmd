# US0187: Slack Thread Reply for Alert Notifications

> **Status:** Won't Implement
> **Epic:** [EP0002: Alerting & Notifications](../epics/EP0002-alerting.md)
> **Owner:** Darren
> **Created:** 2026-01-29
> **Story Points:** 5

## User Story

**As a** Darren (Homelab Operator)
**I want** resolved alert notifications to appear as replies to the original alert message
**So that** I can see the full alert lifecycle in a single Slack thread

## Context

### Persona Reference

**Darren** - Technical professional managing a homelab. Uses Slack for alert notifications and wants to track alert lifecycle without message clutter.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

US0182 implemented auto-resolve notifications but deferred thread reply functionality. Currently, resolved notifications are sent as new messages, making it difficult to correlate them with the original alert. Threading would group the alert lifecycle (fired → resolved) into a single conversation.

This story was extracted from US0182 AC5 which was deferred due to complexity.

---

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| EP0002 | Integration | Slack webhooks | Use existing Slack service |
| US0182 | Dependency | Auto-resolve notifications | Requires US0182 complete |
| TRD | Tech Stack | SQLite/SQLAlchemy | Database migration for thread_ts storage |

---

## Acceptance Criteria

### AC1: Store Slack thread_ts on alert creation

- **Given** an alert is created and sent to Slack
- **When** the Slack notification is sent successfully
- **Then** the `thread_ts` from the Slack response is stored on the Alert record
- **And** subsequent notifications can use this for threading

### AC2: Thread reply for resolved alerts

- **Given** an alert has a stored `slack_thread_ts`
- **When** the alert auto-resolves
- **Then** the resolution notification is sent as a reply to the original message
- **And** the reply appears in the same thread as the original alert

### AC3: Fallback to new message when no thread_ts

- **Given** an alert has no stored `slack_thread_ts` (original failed or pre-migration)
- **When** the alert auto-resolves
- **Then** a new message is sent (not a reply)
- **And** the alert is still marked as resolved

### AC4: Thread reply for reminder notifications

- **Given** an alert has a stored `slack_thread_ts`
- **When** a reminder notification is sent (cooldown elapsed)
- **Then** the reminder is sent as a reply to the original message
- **And** the thread shows the ongoing alert status

### AC5: Handle deleted original message

- **Given** an alert has a stored `slack_thread_ts`
- **When** the original Slack message was deleted
- **And** a reply is attempted
- **Then** the notification fails gracefully
- **And** a new standalone message is sent instead

---

## Scope

### In Scope

- Database migration to add `slack_thread_ts` column to Alert model
- Update notifier to capture and store `thread_ts` from Slack response
- Update resolved notification to use `thread_ts` when available
- Update reminder notification to use `thread_ts` when available
- Fallback handling when threading fails

### Out of Scope

- Thread replies for action notifications
- Editing original message on resolve (use reply instead)
- Channel-level threading preferences
- Thread summary/digest messages

---

## Technical Notes

### Implementation Approach

1. **Database Migration:**
   ```python
   # Alembic migration
   op.add_column('alerts', sa.Column('slack_thread_ts', sa.String(50), nullable=True))
   ```

2. **Alert Model Update:**
   ```python
   class Alert(Base):
       # Existing fields...
       slack_thread_ts: Mapped[str | None] = mapped_column(String(50), nullable=True)
   ```

3. **Capture thread_ts on send:**
   ```python
   async def send_alert(self, event: AlertEvent, config: NotificationsConfig) -> bool:
       response = await self.client.post(self.webhook_url, json=payload)
       if response.status_code == 200:
           # Slack returns thread_ts in response for new messages
           data = response.json()
           return True, data.get("ts")  # Return thread_ts
       return False, None
   ```

4. **Thread reply payload:**
   ```python
   def _format_resolved_message(self, event: AlertEvent) -> dict:
       payload = {...}  # Existing payload
       if event.slack_thread_ts:
           payload["thread_ts"] = event.slack_thread_ts
       return payload
   ```

### Slack API Considerations

- Slack webhook responses may not include `ts` (message timestamp)
- Alternative: Use Slack Web API `chat.postMessage` which returns `ts`
- Thread replies use `thread_ts` parameter in payload
- If original message deleted, Slack returns `message_not_found` error

### Files to Modify

- `backend/src/homelab_cmd/db/models/alert.py` - Add slack_thread_ts column
- `migrations/versions/xxx_add_slack_thread_ts.py` - Alembic migration
- `backend/src/homelab_cmd/services/notifier.py` - Capture and use thread_ts
- `backend/src/homelab_cmd/services/alerting.py` - Pass thread_ts to notifier, store on alert
- `backend/src/homelab_cmd/api/schemas/alert.py` - Optionally expose thread_ts (internal only)

### Migration Strategy

- Existing alerts will have `slack_thread_ts = None`
- These alerts will continue to send standalone resolved messages
- Only new alerts (post-migration) will have threading capability

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | Original Slack message deleted | Fallback to new message |
| 2 | Slack API returns error on thread reply | Log error, send as new message |
| 3 | Webhook doesn't return thread_ts | Store None, resolved sends as new message |
| 4 | Alert created before migration | No thread_ts, resolved sends as new message |
| 5 | Multiple reminders for same alert | All reply to same thread |
| 6 | Alert resolved very quickly (before thread_ts stored) | Send as new message |
| 7 | Thread_ts format invalid | Validate format, fallback to new message |
| 8 | Slack rate limit on thread reply | Queue for retry (existing logic) |

---

## Test Scenarios

- [ ] New alert stores thread_ts from Slack response
- [ ] Resolved notification uses thread_ts when available
- [ ] Resolved notification sends new message when no thread_ts
- [ ] Reminder notification uses thread_ts when available
- [ ] Deleted original message falls back to new message
- [ ] Pre-migration alerts work without thread_ts
- [ ] Invalid thread_ts format handled gracefully
- [ ] Rate limiting on thread replies handled

---

## Dependencies

### Story Dependencies

| Story | Relationship | Status |
|-------|--------------|--------|
| US0182 | Auto-resolve notifications | Done |
| US0013 | Slack integration | Done |

---

## Estimation

**Story Points:** 5
**Complexity:** Medium - Database migration, Slack API response handling, fallback logic

---

## Open Questions

~~1. **Slack API vs Webhook:** Does the webhook response include `ts`? May need to switch to Web API for threading support.~~
~~2. **Reminder thread depth:** Should reminders create sub-threads or all reply to the original?~~

**Resolved:** Won't implement - see Revision History.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial story creation from US0182 AC5 deferral |
| 2026-01-29 | Claude | **Won't Implement** - Slack Incoming Webhooks don't return message `ts` (timestamp/ID) needed for threading. Would require switching to Slack Web API which needs Slack App setup and bot tokens - significant complexity increase for a "nice to have" feature. Standalone resolved messages (US0182) provide sufficient UX for homelab use case. |
