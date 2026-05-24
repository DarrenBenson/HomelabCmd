# CR-0012: Telegram + Home Assistant notification channels

> **Status:** Proposed
> **Priority:** P3
> **Type:** feature-request
> **Requester:** Darren (operator)
> **Date:** 2026-05-24
> **Affects:** notification service, settings UI, README
> **Depends on:** none
> **GitHub Issue:** (not yet synced)

## Summary

The notification engine currently supports Slack webhooks. The operator's homelab actually runs an Agent Bridge with Telegram bots (every agent has a Telegram presence) and a Home Assistant instance on 10.0.0.209. Extend the notification system to support those two channels so fleet alerts and action results land where the operator already pays attention.

## Problem

When a P0 fires today, the notification goes to Slack only. The operator's Slack workspace isn't the primary attention surface for homelab events – Telegram (via Agent Bridge bots) and Home Assistant (which already drives visual / audio alerts via room speakers and Hue colour-flash) are. Net effect: P0 events take longer to be acknowledged than they should.

Both Telegram and HA are well-suited:

- **Telegram** is what Cora and Darren use for personal-assistant interactions; pushing a fleet alert through the same channel surfaces it immediately on phone + watch.
- **Home Assistant** can react in physically meaningful ways (flash a desk light, play a TTS notice on the office speaker, snooze Hue scenes). Wiring HomelabCmd → HA webhook unlocks "alerts you can't miss".

---

## Proposed Changes

### Item 1: Telegram notification channel

**Priority:** P3
**Effort:** S

Add a `telegram` channel type in the notification config:

```yaml
notifications:
  channels:
    - type: telegram
      name: spanners-bot
      bot_token: <env or secret>
      chat_id: <chat id>
      events: [alert.p0, alert.p1, action.failed]
    - type: telegram
      name: cora-bot
      bot_token: ...
      chat_id: ...
      events: [agent.offline]
```

The notification service builds a Telegram message (markdown-formatted) and POSTs to `https://api.telegram.org/bot<token>/sendMessage`. Existing event taxonomy (alerts, actions, agent status) is reused.

### Item 2: Home Assistant webhook channel

**Priority:** P3
**Effort:** S

Add an `ha-webhook` channel type:

```yaml
notifications:
  channels:
    - type: ha-webhook
      name: ha-fleet-alert
      url: http://10.0.0.209:8123/api/webhook/homelab_alert
      events: [alert.p0]
```

POSTs the event payload to the configured HA webhook URL (no auth header by default – HA webhooks are URL-keyed). Payload structure documented so the user can author HA automations against it:

```json
{
  "event_type": "alert.p0",
  "server_id": "homeserver",
  "severity": "p0",
  "title": "Disk usage 95%",
  "details": "...",
  "url": "https://homelabcmd.home.lan/servers/homeserver"
}
```

### Item 3: Settings UI – channel manager

**Priority:** P3
**Effort:** S

In Settings → Notifications, add channel CRUD: list, add (with type dropdown: Slack / Telegram / HA-Webhook), test (sends a hello message), delete. Per-channel event filter chips.

### Item 4: Test-webhook button per channel

**Priority:** P3
**Effort:** S

Existing Slack flow has a "Test webhook" button. Extend to Telegram + HA so the operator can verify connectivity at configure-time, not at first alert.

---

## Impact Assessment

### Existing Functionality

Slack channel unchanged. Notification dispatch loop becomes channel-type-aware (already is, presumably; just add two more types).

### Affected Modules

| Module | Impact | Change Type |
| --- | --- | --- |
| `backend/src/homelab_cmd/services/notifications.py` | Two new channel adapters | Modified |
| `backend/src/homelab_cmd/api/routes/config.py` (notification config endpoints) | Accept new channel types in schema | Modified |
| `frontend/src/pages/Settings.tsx` (Notifications tab) | Two new channel forms | Modified |
| `README.md` | Notification channels reference | Modified |

### Breaking Changes

None.

---

## Acceptance Criteria

- [ ] Telegram channel can be added via UI; "Test" sends a message that appears in the configured chat.
- [ ] HA webhook channel can be added; "Test" posts a `event_type: test` payload that fires a sample HA automation.
- [ ] Inducing a P0 alert on a test server triggers messages on all subscribed channels (Slack, Telegram, HA) per the event filter.
- [ ] Channel-level event filter (e.g. "telegram receives alert.p0 only") respected by dispatcher.
- [ ] README has copy-pasteable HA automation YAML that consumes the webhook.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Telegram bot token logged accidentally | Low | High | Reuse the existing secret-redaction filter from the notification service |
| HA webhook flooded by an alert storm | Medium | Low | Rate-limit per-channel (e.g. max 1 message / 5 s); aggregate runs of identical events |
| Telegram rate limits (30 msg/sec global, 1 msg/sec per chat) cause delayed P0 delivery | Low | Medium | Same rate-limit + queue; HA channel acts as belt-and-braces |

---

## Dependencies

### CR Dependencies

None.

### External Dependencies

| Dependency | Type | Status |
| --- | --- | --- |
| Telegram Bot API | Service | Available; operator already runs bots via Agent Bridge |
| Home Assistant webhook | Service | Operator's HA on 10.0.0.209; needs a `homelab_alert` automation authored to consume |

---

## Linked Epics

> *Populated when CR is actioned via `/sdlc-studio cr action`*

| Epic | Title | Status |
| --- | --- | --- |
| _none yet_ | | |

---

## Out of Scope

- Two-way Telegram (commands from Telegram into HomelabCmd). Belongs in the MCP-via-Agent-Bridge path from CR-0002.
- Generic webhook channel (one URL fits all). HA-webhook is a specialisation; a generic channel could be a later CR if needed.
- Email channel. SMTP infra exists in the homelab (cloudserver1) but no current operator demand.

---

## Open Questions

- [ ] Should the HA payload include a presigned link back to the alert in the UI, or just the relative URL? — Owner: project lead

---

## Close Reason

> *Filled when CR is closed*

**Outcome:**
**Rationale:**

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-05-24 | Darren | CR proposed. Trigger: realising the operator's actual attention surfaces are Telegram and HA, not Slack; HomelabCmd's alerts land where the operator isn't looking. |
