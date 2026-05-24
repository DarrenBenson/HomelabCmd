# CR-0002: HomelabCmd MCP server (read + whitelisted execute)

> **Status:** Proposed
> **Priority:** P1
> **Type:** feature-request
> **Requester:** Darren (operator)
> **Date:** 2026-05-24
> **Affects:** new `mcp/` package, docker-compose.yml, README, Agent Bridge config (out-of-repo)
> **Depends on:** none (can ship independently; benefits from CR-0008 once available)
> **GitHub Issue:** (not yet synced)

## Summary

Add a Model Context Protocol (MCP) server alongside the existing REST backend so the operator's Agent Bridge agents (Spanners, Queeg, Prof, Eve, etc.) can consume HomelabCmd directly as tool calls instead of curl-ing the API. The MCP server wraps a curated subset of the 97 REST endpoints – all read endpoints plus the three whitelisted execute actions – and runs as a new container in the same compose stack. Token minting, key rotation, and settings mutation are deliberately excluded from v1; those remain admin-REST/UI-only.

## Problem

HomelabCmd's API is HTTP-native but agent-unfriendly. For an agent to "tell me homeserver's package debt and apply updates if any are pending", it currently has to:

1. Know the hub URL.
2. Hold the admin API key in its config.
3. Compose `curl` calls correctly (path, headers, body).
4. Parse JSON responses.
5. Poll `/api/v1/actions/{id}` for completion.

Every agent that wants this capability ends up with its own brittle copy of the curl plumbing. There is no standard contract, no per-agent identity in the audit table (it all looks like "admin key"), and no streaming primitive (the SSE endpoint at `/api/scan/commands/{server_id}/stream` is unused outside the SPA).

MCP is the obvious fit: it's the protocol the rest of the agent fleet already speaks (Home Assistant, Uptime Kuma, archive-search, claude_ai_Gmail, etc.). Wrapping HomelabCmd as MCP gives every agent a single, schema-described, audit-friendly surface.

The agents I expect to consume this:

- **Spanners (engineer, agentbox03)** – fleet status reports, triggering updates / restarts.
- **Queeg (recovery, agentbox03)** – health checks during incidents.
- **Eve (curator, agentbox03)** – cross-referencing fleet state with KB documentation.
- **Cora (personal assistant, agentbox01)** – natural-language fleet queries from Darren.

---

## Proposed Changes

### Item 1: New `mcp/` package + container

**Priority:** P1
**Effort:** M

Add `mcp/` to the repo root:

```
mcp/
├── server.py            # FastMCP entrypoint; tool definitions
├── auth.py              # API key handling (env -> X-API-Key header)
├── client.py            # Thin async httpx wrapper around the backend
├── tools/
│   ├── reads.py         # All read tools
│   ├── execute.py       # execute_command + tail_command_stream
│   └── workflow.py      # approve/reject/cancel
├── Dockerfile
└── pyproject.toml
```

Python 3.12, FastMCP / `mcp` SDK. Talks to the existing backend on the internal Docker network (`http://backend:8080`). Holds its own `HOMELAB_API_KEY` env var (initially the admin key; once CR-0008 lands becomes a dedicated `command-execute`-scoped key).

### Item 2: Tool surface (v1)

**Priority:** P1
**Effort:** S (most tools are 1:1 wrappers)

| Category | Tool | Wraps |
| --- | --- | --- |
| Read | `list_servers` | `GET /api/v1/servers` |
| Read | `get_server(server_id)` | `GET /api/v1/servers/{id}` |
| Read | `list_alerts(filter?)` | `GET /api/v1/alerts` |
| Read | `get_alert(alert_id)` | `GET /api/v1/alerts/{id}` |
| Read | `get_metrics(server_id, range)` | `GET /api/v1/metrics/{server_id}/metrics` |
| Read | `get_sparkline(server_id, metric)` | `GET /api/v1/metrics/{server_id}/metrics/sparkline` |
| Read | `list_actions(filter?)` | `GET /api/v1/actions` |
| Read | `get_action(action_id)` | `GET /api/v1/actions/{id}` |
| Read | `list_command_audit(filter?)` | `GET /api/v1/scan/audit/commands` |
| Read | `get_cost_summary()` | `GET /api/v1/costs/summary` |
| Read | `get_compliance_summary()` | `GET /api/v1/config/config/compliance` |
| Read | `list_containers(server_id)` | `GET /api/v1/containers/{server_id}/containers` |
| Read | `get_package_status(server_id)` | `GET /api/v1/packages/{server_id}/packages/status` |
| Execute | `execute_command(server_id, action_type, params?)` | `POST /api/v1/scan/commands/execute` |
| Execute (stream) | `tail_command_stream(server_id)` | `GET /api/v1/scan/commands/{server_id}/stream` (SSE) |
| Workflow | `approve_action(action_id)` | `POST /api/v1/actions/{id}/approve` |
| Workflow | `reject_action(action_id, reason)` | `POST /api/v1/actions/{id}/reject` |
| Workflow | `cancel_action(action_id)` | `POST /api/v1/actions/{id}/cancel` |

`execute_command` enforces `action_type ∈ {apply_updates, restart_service, clear_logs}` client-side (the backend also enforces it via `command_whitelist.py`; defence in depth). `tail_command_stream` translates SSE chunks into MCP streaming responses so an agent can show live output.

### Item 3: Deployment + docs

**Priority:** P1
**Effort:** S

- Add `homelab-cmd-mcp` service to `docker-compose.yml` with `depends_on: backend (healthy)`. Internal-only port (no NPM exposure); choose HTTP transport on port `8082` initially, with stdio mode as an alternative for STDIO-style MCP clients.
- Pass `HOMELAB_API_KEY` from root `.env` (reuse `HOMELAB_CMD_API_KEY` until CR-0008 lands).
- README: new "## MCP Integration" section covering tool inventory, transport options, and a copy-pasteable Agent Bridge `mcp_servers` config snippet.

### Item 4: Agent identity in the audit table

**Priority:** P2
**Effort:** S

Agent Bridge passes per-agent bearer context. The MCP server should extract that and forward it to the backend as a new header (e.g. `X-Caller-Identity: spanners@deskpoint`) so `/api/v1/scan/audit/commands` rows are attributable. Backend stores it in the existing audit `actor` field (or adds one if absent).

---

## Impact Assessment

### Existing Functionality

No change to REST API, SPA, agent code path, or DB schema. Pure additive new container. Backend gets one optional extra header on incoming requests; absence = no change.

### Affected Modules

| Module | Impact | Change Type |
| --- | --- | --- |
| `mcp/` | New package | New |
| `docker-compose.yml` | Add `homelab-cmd-mcp` service | Modified |
| `backend/src/homelab_cmd/api/dependencies.py` (or wherever audit `actor` is set) | Optional `X-Caller-Identity` header support | Modified (small) |
| `README.md` | New MCP section | Modified |

### Breaking Changes

None.

---

## Acceptance Criteria

- [ ] `mcp/` directory exists with the structure above; `mcp/server.py` defines all 18 tools listed in Item 2.
- [ ] `docker-compose.yml` includes the `homelab-cmd-mcp` service; `docker compose up -d` brings it up healthy.
- [ ] An Agent Bridge agent (Spanners on agentbox03) registers the MCP endpoint and can call `list_servers` → returns the 10 known hosts.
- [ ] Same agent calls `execute_command(homeserver, apply_updates)` → a new row appears in `/api/v1/scan/audit/commands`; subsequent `get_action(id)` reports the lifecycle.
- [ ] Agent calls `tail_command_stream` against an active execution → MCP streaming chunks arrive in order, matching SSE output.
- [ ] Calling `execute_command` with `action_type="rm_rf_root"` (or any non-whitelisted type) returns a clear MCP error without hitting the backend.
- [ ] README MCP section includes a working Agent Bridge config snippet.
- [ ] `X-Caller-Identity` header (when present) populates the audit `actor` field.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| MCP server leaks the admin API key via misconfigured logging | Low | High | Auth header never logged; secret-redaction filter in `client.py`; tests assert no secrets in stdout |
| Whitelist drift – backend adds a new action_type, MCP layer doesn't expose it | Medium | Low | `execute_command` reads the whitelist via `GET /api/v1/scan/commands/whitelist` (new endpoint or imported from `command_whitelist.py`) instead of hardcoding |
| Streaming tool hangs an agent because SSE never closes | Low | Medium | MCP wrapper enforces a 5-min timeout matching the backend's max command runtime |
| Token minting via MCP would be tempting to add later but expands blast radius | Medium | High | Document explicitly in Out of Scope; require a separate CR if we change the position |

---

## Dependencies

### CR Dependencies

| CR | Title | Status | Required Before |
| --- | --- | --- | --- |
| [CR-0008](CR0008-scoped-api-keys.md) | Scoped / role-based API keys | Proposed | Not required for v1; benefit only — MCP can adopt `command-execute` once available |

### External Dependencies

| Dependency | Type | Status |
| --- | --- | --- |
| FastMCP / `mcp` Python SDK | Library | Available on PyPI |
| Agent Bridge v3 MCP support | External system | Already in place on agentbox01 (mounts existing MCP servers per `~/.claude/projects/*/CLAUDE.md`) |

---

## Linked Epics

> *Populated when CR is actioned via `/sdlc-studio cr action`*

| Epic | Title | Status |
| --- | --- | --- |
| _none yet_ | | |

---

## Out of Scope

- Token minting, key rotation, settings mutation (admin REST/UI only).
- Agent install / upgrade / removal via MCP (use `/api/v1/agent-deploy/*` REST).
- Per-host agent-side MCP – rejected by design (see plan); the hub already holds state and executes with audit.
- Multi-tenant MCP (single-operator homelab posture).
- Exposing the MCP server externally via NPM (internal Docker network only).

---

## Open Questions

- [ ] HTTP transport on port 8082, or stdio-only via local file socket mounted into Agent Bridge? — Owner: project lead
- [ ] Should `tail_command_stream` buffer all output and return on completion, or true streaming? MCP spec supports both; agents may prefer one over the other. — Owner: project lead
- [ ] Where should agent identity come from – Agent Bridge bearer subject, or an explicit MCP tool argument? — Owner: project lead

---

## Close Reason

> *Filled when CR is closed*

**Outcome:**
**Rationale:**

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-05-24 | Darren | CR proposed. Triggered by operator wanting Agent Bridge agents (Spanners, Queeg, Eve, Cora) to reach HomelabCmd as MCP tool calls rather than ad-hoc curl. Scope confirmed: read + whitelisted execute, no per-host MCP. |
