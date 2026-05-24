# CR-0007: Agent self-heals on hostname change

> **Status:** Proposed
> **Priority:** P3
> **Type:** production-feedback
> **Requester:** Darren (operator)
> **Date:** 2026-05-24
> **Affects:** agent (`agent/heartbeat.py`, `agent/config.py`), backend (heartbeat handler)
> **Depends on:** none
> **GitHub Issue:** (not yet synced)

## Summary

The agent's `server_id` is set from `hostname` at install time and never re-verified. If the host is renamed later, the agent keeps reporting under the old name forever. Today's audit caught this on agentbox01 (which was originally installed as `aiserver2`); its agent kept reporting `server_id: aiserver2` despite the actual hostname being `agentbox01` for months. Have the agent detect the mismatch at heartbeat time and either auto-update the hub-side mapping or surface a clear drift signal.

## Problem

Concrete from today: agentbox01 was renamed from its original `aiserver2` identifier at some point post-install. The agent's `/etc/homelab-agent/config.yaml` still carried `server_id: aiserver2`, and the agent dutifully reported under that name. The discrepancy only surfaced when I re-registered all agents this morning (the new install picked up `agentbox01` as the hostname-derived `server_id`).

This is silent drift: the hub's view of the fleet doesn't match reality, and the operator has no way to know without spot-checking each agent's config. It's not a security issue, but it makes audit / inventory queries unreliable.

The agent already collects the live hostname in its heartbeat payload (via `socket.gethostname()`). The backend already has it. Comparing the two on the heartbeat handler is trivial.

---

## Proposed Changes

### Item 1: Hub detects mismatch + emits a drift signal

**Priority:** P3
**Effort:** S

In the heartbeat handler, compare incoming `payload.hostname` against the registered `server.hostname` (or `server.id` if that's the canonical identifier). On mismatch:

1. Record a `hostname_drift` event in audit.
2. Return a `drift_warning` field in the heartbeat ack so the agent can log it locally.
3. Surface as a fleet-level alert in the UI (badge on server card; row in Alerts page).

Critically, do NOT auto-rename. Auto-rename is dangerous (could merge two servers' identities). Surface it; let the operator decide.

### Item 2: Operator action: "Adopt new hostname" admin action

**Priority:** P3
**Effort:** S

When the operator wants to formalise the rename:

- UI: a "Rename to <new>" button on the drift alert.
- Backend: `PUT /api/v1/servers/{old_id}/rename` accepts `{ new_id: "agentbox01" }`. Updates the server's primary key (server_id) atomically and re-points all foreign-key references (audit, alerts, metrics, etc.).
- Agent: receives a `rename_to` directive in the next heartbeat ack; rewrites `config.yaml` server_id field (same atomic rewrite pattern proposed in CR-0010 for `hub_url`).

Once both sides agree on the new ID, the drift alert auto-resolves.

### Item 3: Agent logs the drift

**Priority:** P3
**Effort:** S

Even before the operator acts on it, the agent's log should call out the mismatch loudly:

```
WARNING: hostname drift detected — config.server_id=aiserver2, live hostname=agentbox01
WARNING: hub will display this server as 'aiserver2'; operator should call PUT /servers/aiserver2/rename to fix
```

So if anyone tails the agent log they see the issue immediately.

---

## Impact Assessment

### Existing Functionality

No change to normal heartbeat success path. Mismatches are surfaced as warnings, not failures.

### Affected Modules

| Module | Impact | Change Type |
| --- | --- | --- |
| `backend/src/homelab_cmd/api/routes/agents.py` (heartbeat handler) | Mismatch detection + drift event | Modified |
| `backend/src/homelab_cmd/api/routes/servers.py` | New `rename` endpoint | Modified |
| `backend/src/homelab_cmd/services/server_rename.py` (or similar) | FK re-pointing logic | New |
| `agent/heartbeat.py` | Log drift; handle `rename_to` ack directive | Modified |
| `frontend/src/components/ServerCard.tsx` (or similar) | Drift badge + rename action | Modified |

### Breaking Changes

None.

---

## Acceptance Criteria

- [ ] Renaming a host after agent install produces a `hostname_drift` event within one heartbeat cycle.
- [ ] UI surfaces the drift as a server-card badge and an Alerts entry.
- [ ] `PUT /servers/{old}/rename` with `{ new_id: "<new>" }` updates server record + audit FK + alerts FK + metrics FK; agent receives `rename_to` directive on next heartbeat and rewrites config.
- [ ] After both sides apply, drift alert auto-resolves; subsequent heartbeats are clean.
- [ ] Agent log shows the WARNING line on every heartbeat until the drift is resolved.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Rename collides with an existing server_id (someone else already took the new name) | Low | High | Backend validates uniqueness; returns 409 with clear message |
| FK re-pointing leaves orphan rows | Low | High | Wrap rename in a DB transaction; integration test covers FK count before/after |
| Agent rewrites config and races with a normal heartbeat | Low | Low | Same atomic-rewrite pattern from CR-0010 |

---

## Dependencies

### CR Dependencies

| CR | Title | Status | Required Before |
| --- | --- | --- | --- |
| [CR-0010](CR0010-agent-hub-url-hot-reload.md) | Hub-url hot-reload | Proposed | Shares the atomic-config-rewrite helper; could land together |

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

- Auto-rename without operator action (rejected; too dangerous).
- IP address drift (different problem; agents already report IP and the hub can track changes – this CR is hostname-specific).

---

## Open Questions

- [ ] Should rename preserve historical audit rows under the old name or rewrite them to the new name? (Recommendation: keep old name in audit history with a "renamed to <new>" note; rewrite the FK so the server card still shows the row under the current name.) — Owner: project lead

---

## Close Reason

> *Filled when CR is closed*

**Outcome:**
**Rationale:**

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-05-24 | Darren | CR proposed. Trigger: agentbox01 carrying stale `aiserver2` server_id for an unknown period; only caught because today's re-registration picked up the live hostname. |
