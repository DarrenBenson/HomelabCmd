# CR-0004: Fleet install / bulk-deploy endpoint + CLI

> **Status:** Proposed
> **Priority:** P2
> **Type:** feature-request
> **Requester:** Darren (operator)
> **Date:** 2026-05-24
> **Affects:** new `cli/` package, backend (new endpoint), README
> **Depends on:** none (works against current single-install flow)
> **GitHub Issue:** (not yet synced)

## Summary

Today there is no first-class way to deploy the agent to several hosts in one operation. Re-registering 10 hosts after the hub migrated from the workstation to appserver1 required a hand-rolled bash loop that minted a token per host then ran `curl … install.sh | sudo bash -s -- --token …` on each. Add a `POST /api/v1/agent-deploy/install-fleet` endpoint that the hub itself drives over SSH, plus a small `homelabcmd-cli` binary that wraps it.

## Problem

The existing install flow is single-host:

1. Operator runs `POST /api/v1/agents/register/tokens` (one call per host).
2. Operator SSHes (or pipes via curl) into the target and runs install.sh.
3. Repeat × N hosts.

Concrete repeat-this-morning evidence: this is the operator-side bash loop I used today.

```bash
for h in homeserver backupserver webserver1 webserver2 mediaserver \
         cloudserver1 agentbox01 appserver1 agentbox03 nvr; do
  TOKEN=$(curl -sS -X POST "$HUB/api/v1/agents/register/tokens" \
    -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
    -d "{\"mode\":\"readwrite\",\"display_name\":\"$h\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
  ssh ops@$h "curl -sSL $HUB/api/v1/agents/register/install.sh \
    | sudo bash -s -- --token $TOKEN"
done
```

That works but is brittle: the operator's machine becomes the orchestrator, one host failure mid-loop is hard to recover from, output interleaves, there's no concurrency control, and an unprivileged operator can't even run it (needs SSH access to every target).

The hub already has everything needed: it knows about all the hosts (via Tailscale device discovery), it has SSH credentials (per `EP0015`), and it has an executor service (used for `apply_updates` etc.). Inverting the flow so the hub installs onto targets cleans this up.

---

## Proposed Changes

### Item 1: `POST /api/v1/agent-deploy/install-fleet` API

**Priority:** P2
**Effort:** M

Accepts:

```json
{
  "targets": [
    { "host": "homeserver",   "ssh_user": "ops", "mode": "readwrite" },
    { "host": "backupserver", "ssh_user": "ops", "mode": "readwrite" }
  ],
  "concurrency": 4,
  "auto_token": true
}
```

For each target the hub:

1. Mints a registration token (if `auto_token: true`) or uses one supplied per target.
2. Opens an SSH connection using existing credential resolution (per-server credential → global key).
3. Runs `curl -sSL $HUB/api/v1/agents/register/install.sh | sudo bash -s -- --token <token>` on the target.
4. Returns a deployment ID; status streamed via SSE at `GET /api/v1/agent-deploy/install-fleet/{deployment_id}/stream`.

Concurrency is bounded server-side (default 4). Failed targets are surfaced individually; the deployment as a whole is `partial` rather than `failed` when at least one succeeds.

### Item 2: `homelabcmd-cli` Python CLI

**Priority:** P2
**Effort:** M

New `cli/` package in the repo. `pip install -e cli/` or shipped as a small wheel. Authenticates via env var `HOMELAB_CMD_API_KEY`.

```text
homelabcmd-cli fleet install --inventory inventory.yaml
homelabcmd-cli fleet install --host h1 --host h2 ... --mode readwrite
homelabcmd-cli servers list
homelabcmd-cli action exec --server homeserver --type apply_updates
```

Where `inventory.yaml`:

```yaml
hosts:
  - host: homeserver
    ssh_user: ops
    mode: readwrite
  - host: backupserver
    ssh_user: ops
    mode: readwrite
```

The CLI subscribes to the SSE stream and renders a live per-host progress table.

### Item 3: README + runbook

**Priority:** P3
**Effort:** S

New README section "Fleet deployment" with a one-liner for both the bash + JSON API style and the CLI style. Move the hand-rolled bash loop out of operator memory and into docs.

---

## Impact Assessment

### Existing Functionality

The single-host install flow (UI's "Install agent" action, manual curl-pipe) is unchanged. Bulk deploy is purely additive.

### Affected Modules

| Module | Impact | Change Type |
| --- | --- | --- |
| `backend/src/homelab_cmd/api/routes/agent_deploy.py` | New endpoint + SSE handler | Modified |
| `backend/src/homelab_cmd/services/agent_deploy.py` | New `deploy_fleet` orchestration | Modified |
| `cli/` | New package | New |
| `README.md` | New "Fleet deployment" section | Modified |

### Breaking Changes

None.

---

## Acceptance Criteria

- [ ] `POST /api/v1/agent-deploy/install-fleet` accepts a list of 1–50 targets and returns a `deployment_id`.
- [ ] SSE stream at `/api/v1/agent-deploy/install-fleet/{id}/stream` emits per-target lifecycle events: `ssh_connected`, `installing`, `claimed`, `online`, `failed`.
- [ ] Concurrency cap honoured (no more than `concurrency` parallel SSH sessions at any time).
- [ ] A single CLI invocation `homelabcmd-cli fleet install --inventory inventory.yaml` lays 5 fresh agents and they all reach `online` within 90 s on a typical homelab network.
- [ ] Partial failures don't abort the deployment; per-host status is reported individually.
- [ ] Audit trail in `/api/v1/scan/audit/commands` records the fleet install (one row per target).

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Concurrent installs exhaust hub's outbound SSH connection pool | Low | Medium | Default concurrency = 4; pool size configurable |
| Token leaks via SSE if stream isn't auth-protected | Medium | High | SSE endpoint requires same X-API-Key as the rest of the API |
| CLI authentication via env var leaks key into shell history | Medium | Medium | Document `~/.homelabcmd/credentials` file alternative; same pattern as `gh`/`aws` |

---

## Dependencies

### CR Dependencies

| CR | Title | Status | Required Before |
| --- | --- | --- | --- |
| [CR-0003](CR0003-install-sh-option-parity-dns-resilience.md) | install.sh option parity + DNS resilience | Proposed | Should land first so bulk-deploy doesn't multiply today's DNS issue across N hosts |

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

- Cluster-aware deployment (e.g. "deploy only to non-Galera webserver hosts this Sunday window"). Operator can compose inventories manually.
- Inventory discovery via Ansible / Tailscale auto-list (separate CR).
- Per-host pre/post hooks beyond the install.

---

## Open Questions

- [ ] CLI distribution: PyPI, GitHub release wheel, or in-repo `pip install -e .` only? — Owner: project lead

---

## Close Reason

> *Filled when CR is closed*

**Outcome:**
**Rationale:**

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-05-24 | Darren | CR proposed. Concrete trigger: 10-host re-registration this morning required a hand-rolled bash loop; took ~10 min of fiddling with one false start (`--hub-url` rejected) before all agents were back. |
