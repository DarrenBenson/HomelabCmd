# CR-0010: Agent hub_url hot-reload via heartbeat ack

> **Status:** Proposed
> **Priority:** P2
> **Type:** feature-request
> **Requester:** Darren (operator)
> **Date:** 2026-05-24
> **Affects:** agent (`agent/heartbeat.py`, `agent/config.py`), backend heartbeat handler
> **Depends on:** none
> **GitHub Issue:** (not yet synced)

## Summary

When the hub moves to a new IP or hostname, every existing agent has to be re-installed because the `hub_url` lives in each agent's `config.yaml` and there's no channel for the hub to push updated config to the fleet. Add a `config_update` field to the heartbeat ack so the hub can announce a new `hub_url` (or other safe config fields); agent rewrites its `config.yaml` and continues talking to the new URL on the next heartbeat. Today's hub migration would have been a one-command operator action instead of a 10-host re-installation.

## Problem

Concrete from this morning: the hub moved from `http://10.0.0.63:8080` (workstation) to `http://10.0.0.206:8080` (appserver1). The 7 existing agents kept heartbeating to the old IP, which silently failed (the agent service shows `active` regardless of heartbeat success). Operator had to re-run `install.sh` on every host with a new registration token to update the URL in `config.yaml`.

The agent already supports config updates – the install script writes the YAML and the agent re-reads it on start. The missing piece is a channel through which the hub can announce config changes without requiring the operator to touch every host. The heartbeat ack is the natural place: it's already authenticated, already happens every 60 seconds, and the agent already parses the ack body.

This isn't only for IP changes – the same channel could safely update other things later (alert thresholds, log level, heartbeat interval). For v1 the scope is `hub_url` only.

---

## Proposed Changes

### Item 1: Extend heartbeat ack with `config_update`

**Priority:** P2
**Effort:** S

Heartbeat ack response shape today is roughly `{ "ok": true, "actions": [...] }`. Add a field:

```json
{
  "ok": true,
  "actions": [...],
  "config_update": {
    "version": 1,
    "hub_url": "http://10.0.0.206:8080",
    "issued_at": "2026-05-24T10:30:00Z"
  }
}
```

Backend includes `config_update` only when the hub URL the request originated from doesn't match the configured `HOMELAB_CMD_PUBLIC_HUB_URL`. Once announced, the field is omitted on subsequent acks (idempotent application; backend keeps a per-server "last config version applied" timestamp via the heartbeat payload).

### Item 2: Agent reads + applies `config_update`

**Priority:** P2
**Effort:** M

On each heartbeat ack:

1. If `config_update` absent: continue normally.
2. If present and `version <= current_applied_version`: ignore.
3. If present and newer: validate the new `hub_url` (must be http/https, must respond to `/api/v1/system/health` within 5 s), then atomically rewrite `/etc/homelab-agent/config.yaml` (write to `config.yaml.new`, fsync, rename), update `current_applied_version`, and use the new URL for the next heartbeat.

Validation gate prevents the hub from accidentally bricking the fleet by announcing an unreachable URL.

### Item 3: Backend ergonomics – `PUT /api/v1/admin/hub-url`

**Priority:** P3
**Effort:** S

Admin endpoint that updates the hub's notion of its own public URL. Triggers the ack-side announcement to all online agents on their next heartbeat. CLI counterpart (relies on CR-0004): `homelabcmd-cli admin set-hub-url http://10.0.0.206:8080`.

### Item 4: Operator-visible status

**Priority:** P3
**Effort:** S

UI shows, per server, "hub_url_version_applied". When operator changes the URL, the dashboard shows the propagation progress (X of N agents migrated). Hosts that haven't applied within 5 minutes get flagged.

---

## Impact Assessment

### Existing Functionality

Heartbeat shape is extended additively; agents on older versions ignore unknown fields. Backend continues to serve the same heartbeat endpoint.

### Affected Modules

| Module | Impact | Change Type |
| --- | --- | --- |
| `backend/src/homelab_cmd/api/routes/agents.py` (heartbeat handler) | Add `config_update` to ack response when applicable | Modified |
| `backend/src/homelab_cmd/db/models/server.py` | New field `hub_url_version` | Modified |
| `agent/heartbeat.py` | Read + validate + apply `config_update` | Modified |
| `agent/config.py` | Atomic write helper | Modified |
| `frontend/src/components/ServerCard.tsx` (or similar) | Show propagation status | Modified |

### Breaking Changes

None for agents older than this CR (they just ignore the new ack field). New agent reads the field but only acts when it's present.

---

## Acceptance Criteria

- [ ] Backend includes `config_update` in heartbeat acks when its public hub URL has changed and the agent hasn't yet applied it.
- [ ] Agent on the new code path validates the proposed URL with a 5 s `/system/health` probe before writing config.
- [ ] Validation failure: agent logs WARN + emits an alert + does NOT rewrite config; keeps using the old URL.
- [ ] Successful application: atomic rewrite of `config.yaml`, in-process reconfiguration, next heartbeat goes to new URL with the new applied version reported back.
- [ ] Test drill: bring up a second hub on a different port; `PUT /admin/hub-url` on the first; observe an agent migrate within one heartbeat cycle.
- [ ] UI Dashboard shows propagation status (e.g. "9 of 10 agents on hub_url_version 3").

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Hub announces an unreachable URL and bricks the fleet | Medium | Critical | Agent validates the new URL with a health probe before applying; on validation failure keeps current URL |
| Race condition: two agents apply different versions in different orders | Low | Low | Versions are monotonic; an agent applies only versions strictly greater than `current_applied_version` |
| Config rewrite corrupts `config.yaml` if process dies mid-write | Low | High | Write to `.new` + fsync + atomic rename pattern; YAML parse check before swap |
| Malicious hub (e.g. someone steals admin key) redirects fleet to attacker-controlled URL | Low | Critical | Out of scope for this CR – holding the admin key is already game over by definition; CR-0008 (scoped keys) is the right mitigation |

---

## Dependencies

### CR Dependencies

| CR | Title | Status | Required Before |
| --- | --- | --- | --- |
| [CR-0008](CR0008-scoped-api-keys.md) | Scoped API keys | Proposed | Optional – nicer if `admin set-hub-url` requires admin scope |

### External Dependencies

None.

---

## Linked Epics

> *Populated when CR is actioned via `/sdlc-studio cr action`*

| Epic | Title | Status |
| --- | --- | --- |
| _none yet_ | | |

---

## Out of Scope

- Pushing arbitrary config (alert thresholds, heartbeat interval, log level) via the same channel. Out of scope for v1; the schema is designed to accept it later without further CRs.
- Mutual TLS / agent-side hub fingerprint verification. Mentioned in Risk row #4 but explicitly deferred.

---

## Open Questions

- [ ] Should the agent require a signed `config_update` (e.g. HMAC with the agent's per-server token) to mitigate impersonation if TLS terminates at a proxy? — Owner: project lead

---

## Close Reason

> *Filled when CR is closed*

**Outcome:**
**Rationale:**

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-05-24 | Darren | CR proposed. Concrete trigger: hub migration this morning forced full re-install on 7 existing agents; with this CR, the same migration would have been a one-line operator action. |
