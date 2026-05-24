# CR-0008: Scoped / role-based API keys

> **Status:** Proposed
> **Priority:** P2
> **Type:** design-change
> **Requester:** Darren (operator)
> **Date:** 2026-05-24
> **Affects:** backend auth layer, settings UI, MCP server (CR-0002), all consumers
> **Depends on:** none
> **GitHub Issue:** (not yet synced)

## Summary

HomelabCmd currently authenticates every API caller with a single admin key (`HOMELAB_CMD_API_KEY`). Anyone holding that key can read everything, execute every whitelisted action, mint registration tokens, and change settings. As the surface expands (MCP server in CR-0002, fleet install CLI in CR-0004), the blast radius of a single leaked key grows. Introduce a small set of named scopes – `admin`, `read-only`, `command-execute`, and `agent` – with the existing single-key behaviour preserved as the `admin` scope. New consumers (MCP, CLI, monitoring integrations) can use narrower keys.

## Problem

The current auth model is binary: either you have the admin key and can do anything, or you don't and can do nothing (the `/api/v1/system/health` endpoint excepted). Three concrete problems:

1. **MCP server keys are over-privileged.** CR-0002 introduces an MCP server that Agent Bridge agents call. The MCP server needs `read + whitelisted execute` access; today it must hold the admin key, which also grants token mint, settings mutation, and credential rotation – none of which agents should be able to do.
2. **Monitoring integrations are blocked.** A read-only Uptime Kuma probe or a dashboard that polls `/api/v1/servers` for status display has no safe key option; it must use the admin key.
3. **Per-agent identity is opaque in audit.** Today every audit row says "admin key did X". Distinguishing "Spanners did X via MCP" from "Cora did X via MCP" is impossible at the auth layer.

The fix is well-understood: scoped API keys with a label.

---

## Proposed Changes

### Item 1: Define the scope model

**Priority:** P2
**Effort:** S

Four scopes initially:

| Scope | Includes | Use cases |
| --- | --- | --- |
| `admin` | Everything (current single-key behaviour) | Operator's primary key, settings UI, hub migration |
| `read-only` | All `GET` endpoints, no mutations | Monitoring probes, dashboards, audit consumers |
| `command-execute` | `read-only` + whitelisted `POST /scan/commands/execute` + `actions/{id}/approve|reject|cancel` | MCP server, automation scripts |
| `agent` | Heartbeat write only (`POST /agents/heartbeat`) – per-host auto-issued by registration flow | Existing agent tokens, no change |

`admin` is a superset of `command-execute` which is a superset of `read-only`. `agent` is independent (write-only on a narrow path).

### Item 2: Storage + creation flow

**Priority:** P2
**Effort:** M

- New `api_keys` table (or extend existing if there's one): `id`, `label`, `scope`, `key_hash`, `created_at`, `last_used_at`, `expires_at?`, `revoked_at?`.
- New endpoints under `/api/v1/admin/api-keys`:
  - `POST /` – create a key with a chosen scope, returns plaintext once.
  - `GET /` – list keys (no plaintext).
  - `DELETE /{id}` – revoke.
- Backwards compat: the existing `HOMELAB_CMD_API_KEY` env-var path keeps working and maps to scope `admin` (so nothing breaks on upgrade).

### Item 3: Settings UI

**Priority:** P3
**Effort:** S

New "API Keys" panel in Settings: list active keys (label, scope, last-used), create, revoke. Plaintext shown only once at creation with a copy-to-clipboard.

### Item 4: MCP server consumes a `command-execute` key

**Priority:** P2
**Effort:** S

Once this CR ships, CR-0002's MCP server reads a key with scope `command-execute` from env instead of the admin key. If the key has any other scope, MCP startup logs a warning. Same applies to CR-0004's CLI default config.

---

## Impact Assessment

### Existing Functionality

The existing `HOMELAB_CMD_API_KEY` env var remains valid and maps to `admin` scope, so upgrading to this CR does not break existing deployments or the SPA.

### Affected Modules

| Module | Impact | Change Type |
| --- | --- | --- |
| `backend/src/homelab_cmd/api/dependencies.py` (or wherever `verify_api_key` lives) | Becomes `verify_api_key_with_scope(required_scope)`; per-route scopes annotated | Modified |
| `backend/src/homelab_cmd/db/models/api_key.py` | New model | New |
| `backend/src/homelab_cmd/api/routes/admin.py` | New `/api-keys` endpoints | Modified |
| `frontend/src/pages/Settings.tsx` (or similar) | New "API Keys" panel | Modified |
| MCP server (CR-0002) | Adopt `command-execute` key | Modified |
| CLI (CR-0004) | Adopt scope-appropriate key | Modified |

### Breaking Changes

None on the upgrade path (env-var-key continues working). Downstream: once consumers move to scoped keys, rotating the admin key has narrower blast radius.

---

## Acceptance Criteria

- [ ] `POST /api/v1/admin/api-keys` with `{scope: "read-only", label: "monitoring"}` returns a plaintext key once.
- [ ] Using that key to call `GET /api/v1/servers` returns 200.
- [ ] Using that key to call `POST /api/v1/scan/commands/execute` returns 403 with a clear "scope insufficient" message.
- [ ] Using that key to call `POST /api/v1/agents/register/tokens` returns 403.
- [ ] Existing `HOMELAB_CMD_API_KEY` env var continues to grant admin access without DB changes.
- [ ] Settings UI lists active keys; revocation takes effect within one request cycle.
- [ ] Audit rows record the key label (not the plaintext) so "MCP-Spanners did X" is visible in the audit table.
- [ ] CR-0002's MCP server documented as needing `command-execute` going forward; CR-0004's CLI documented similarly.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Per-route scope annotations drift over time (new endpoint forgets to declare its required scope) | Medium | Medium | Default-deny: routes without an annotation reject all non-admin keys; add a CI lint that flags unannotated routes |
| Scope hierarchy bugs (e.g. `command-execute` accidentally lets through a settings mutation) | Low | High | Unit tests per scope × per endpoint matrix in CI |
| `agent` scope mistakenly granted broader privileges via misconfiguration | Low | High | `agent` scope hardcoded to a single endpoint regex; not selectable from the UI key-creator |

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

- Multi-tenant / multi-operator user management (separate concept – this CR is just scoping the API key, not adding users).
- OAuth / JWT / OIDC (use `gh`-style PAT model; that's enough for homelab).
- Fine-grained per-server scopes (e.g. "this key can act on homeserver only"). Useful but speculative; revisit if a real need surfaces.

---

## Open Questions

- [ ] Should expired keys be auto-deleted from the DB or just marked revoked? — Owner: project lead
- [ ] CLI / MCP server: read key from env var only, or also support a config file like `~/.homelabcmd/credentials`? — Owner: project lead

---

## Close Reason

> *Filled when CR is closed*

**Outcome:**
**Rationale:**

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-05-24 | Darren | CR proposed. Triggered by CR-0002 (MCP) and CR-0004 (CLI) both wanting non-admin keys but having no option; recognised as a foundational gap during the same audit window. |
