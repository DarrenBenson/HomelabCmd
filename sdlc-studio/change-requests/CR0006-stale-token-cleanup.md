# CR-0006: Stale-token bulk cleanup primitive

> **Status:** Proposed
> **Priority:** P3
> **Type:** production-feedback
> **Requester:** Darren (operator)
> **Date:** 2026-05-24
> **Affects:** `backend/src/homelab_cmd/api/routes/agent_register.py`, settings UI
> **Depends on:** none
> **GitHub Issue:** (not yet synced)

## Summary

Registration tokens auto-expire after their configured TTL, but there's no admin "cancel all pending" or "cancel pending older than X" knob. A failed batch deploy this morning left 13 unclaimed tokens hanging in the pending list. Add a bulk-delete filter on the existing `DELETE /api/v1/agents/register/tokens` endpoint and a one-click admin UI button.

## Problem

The current cancel endpoint is single-token: `DELETE /api/v1/agents/register/tokens/{token_id}`. After this morning's failed batch (10 tokens minted, all 10 install attempts rejected at the `--hub-url` parse step before claiming), the operator was left with 10 pending tokens and no way to clear them without 10 individual DELETE calls. A second retry minted another 10 tokens (8 claimed, 2 hit the DNS issue and retried; net 3 extra), bringing the pending list to 13 unclaimed entries.

They auto-expire in 30 min and don't actually cause harm, but the pending list becomes noisy and the operator can't tell at a glance which tokens are stale vs intended.

---

## Proposed Changes

### Item 1: Bulk-cancel via query filter

**Priority:** P3
**Effort:** S

Extend `DELETE /api/v1/agents/register/tokens` to accept query filters:

- `?older_than=15m` – cancel tokens older than the given duration.
- `?display_name=homeserver` – cancel by display name (deletes all pending tokens with that label).
- `?status=expired` – purge already-expired entries (cleanup).

Response: `{ "cancelled": N }` or per-token detail if requested.

### Item 2: Settings UI bulk action

**Priority:** P3
**Effort:** S

In Settings → Agents, add:

- "Cancel all pending" button (with a confirm dialog).
- Bulk-select checkboxes on the pending tokens table.
- Filter chips: "Older than 1 hour", "Older than 1 day".

### Item 3: Auto-purge expired tokens from DB

**Priority:** P3
**Effort:** S

A small scheduled task (APScheduler, ~daily) purges tokens whose `expires_at` is in the past. Today's behaviour appears to be "soft-expire" – tokens stay in the DB and just become unusable. Auto-purge keeps the table clean over time.

---

## Impact Assessment

### Existing Functionality

The existing single-token delete by ID continues to work. Bulk filters and auto-purge are additive.

### Affected Modules

| Module | Impact | Change Type |
| --- | --- | --- |
| `backend/src/homelab_cmd/api/routes/agent_register.py` | Query-filter on DELETE; new bulk handler | Modified |
| `backend/src/homelab_cmd/services/token_service.py` (or similar) | Filter methods + auto-purge schedule | Modified |
| `frontend/src/pages/Settings.tsx` (Agents tab) | Bulk select + buttons | Modified |

### Breaking Changes

None.

---

## Acceptance Criteria

- [ ] `DELETE /api/v1/agents/register/tokens?older_than=15m` cancels matching tokens and returns the count.
- [ ] `DELETE /api/v1/agents/register/tokens?display_name=homeserver` cancels by label.
- [ ] Settings UI "Cancel all pending" button works (with confirm); pending list goes to zero.
- [ ] Auto-purge task removes tokens past their TTL on its scheduled run; verified by inserting an expired row and re-checking after the task fires.
- [ ] Audit log records bulk operations as a single row (not N rows), with the filter parameters captured.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Operator clicks "Cancel all pending" while a legitimate install is in mid-claim | Low | Medium | Confirm dialog shows count + previews token labels; in-flight installs (mid-claim) shouldn't be in `pending` state anyway |
| Auto-purge deletes audit history operators wanted | Low | Low | Purge only `pending`+expired tokens, NOT claimed ones – claimed tokens stay as audit evidence |

---

## Dependencies

### CR Dependencies

None.

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

- Configurable TTL per token (out of scope; the existing `expiry_minutes` is sufficient).
- Token rotation (already covered by separate existing endpoint `POST /agent-register/credentials/{guid}/rotate`).

---

## Open Questions

None.

---

## Close Reason

> *Filled when CR is closed*

**Outcome:**
**Rationale:**

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-05-24 | Darren | CR proposed. Trigger: 13 stale unclaimed tokens left after a failed first attempt this morning; auto-expire works but cleanup is per-token. |
