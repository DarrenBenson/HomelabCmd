# CR-0003: Hub-served install.sh option parity + DNS resilience

> **Status:** Proposed
> **Priority:** P2
> **Type:** production-feedback
> **Requester:** Darren (operator)
> **Date:** 2026-05-24
> **Affects:** `backend/src/homelab_cmd/api/routes/agent_register.py` (`get_install_script`), agent install flow
> **Depends on:** none
> **GitHub Issue:** (not yet synced)

## Summary

The install script served at `GET /api/v1/agents/register/install.sh` is a stripped-down variant of the repo's `agent/install.sh`: it hardcodes `HUB_URL="http://appserver1.local.lan:8080"` and only accepts `--token`. Two operational failures hit this in real deploy today: (a) passing `--hub-url` to the served script silently errored and aborted with "Unknown option", and (b) two hosts on the homelab fleet (backupserver, agentbox01) couldn't resolve `appserver1.local.lan` because their Tailscale-aware systemd-resolved prefers MagicDNS over LAN DNS for the hostname stem. The fix is to bring the served script closer to the repo script's option set and add a DNS fallback so MagicDNS gaps don't bite.

## Problem

Concrete sequence from the 2026-05-24 fleet re-registration:

1. Hub minted a registration token via `POST /api/v1/agents/register/tokens`.
2. Install command from the response: `curl -sSL http://appserver1.local.lan:8080/api/v1/agents/register/install.sh | sudo bash -s -- --token <hex>`.
3. On homeserver, webserver1, webserver2, mediaserver, cloudserver1, appserver1, agentbox03, nvr: success.
4. On **backupserver** and **agentbox01**: `Error: Failed to claim token` followed by `curl: (6) Could not resolve host: appserver1.local.lan`. Both these hosts run systemd-resolved with Tailscale's MagicDNS injected as the primary upstream; `appserver1` resolves to the Tailscale FQDN `appserver1.taild794c0.ts.net`, but `appserver1.local.lan` returns NXDOMAIN.
5. Operator workaround: `echo '10.0.0.206 appserver1.local.lan appserver1' | sudo tee -a /etc/hosts` on both hosts, then re-run.

The served script's argument parser rejects unknown options outright, so passing `--hub-url http://10.0.0.206:8080` to bypass the DNS issue didn't work either. The repo's `agent/install.sh` does accept `--hub-url`, but the served version is a different (older / stripped) template stored in `backend/src/homelab_cmd/api/routes/agent_register.py` (the `get_install_script` endpoint).

This bites at the worst time – mid fleet deploy – because the only error feedback is a one-line curl resolution failure and the operator has to dig into resolv.conf to figure out why.

---

## Proposed Changes

### Item 1: Bring the served install.sh option set to parity with the repo version

**Priority:** P2
**Effort:** S

The served script should accept (and pass through) at least:

- `--token` (already supported)
- `--hub-url` – override the default templated URL
- `--mode` (`readonly` | `readwrite`)
- `--server-id` – explicit override, default = `hostname`

Unknown options should produce a clear error mentioning the supported set, not just "Unknown option: X".

### Item 2: DNS fallback to numeric IP

**Priority:** P2
**Effort:** S

When the served script's templated `HUB_URL` uses a hostname (e.g. `appserver1.local.lan`), include the hub's resolved IP as a fallback so the script can self-recover:

- Hub server injects two variables at template render time: `HUB_URL` (preferred, hostname-based) and `HUB_URL_FALLBACK_IP` (numeric, e.g. `http://10.0.0.206:8080`).
- Script first tries `HUB_URL`; if `curl --connect-timeout 3 "${HUB_URL}/api/v1/system/health"` fails on DNS, retries with `HUB_URL_FALLBACK_IP` and warns the operator.
- `--hub-url` (Item 1) overrides both.

Hub-side: derive the fallback IP from one of (in order of preference): config setting `HOMELAB_CMD_PUBLIC_IP`, the request's `X-Forwarded-For` header (so the agent uses an IP routable from its perspective), or the hub container's outbound IP via `socket.gethostbyname(socket.gethostname())`.

### Item 3: Optional `/etc/hosts` patch

**Priority:** P3
**Effort:** S

When the DNS fallback path is used (hostname failed, IP worked), optionally append a `/etc/hosts` entry mapping the hostname to the resolved IP. Gated behind `--patch-hosts` so it's opt-in. Idempotent (grep before append).

---

## Impact Assessment

### Existing Functionality

The current successful install path is unchanged: agents that can resolve the hub hostname use exactly the same flow they do today. Only the failure modes shift from "abort" to "self-recover".

### Affected Modules

| Module | Impact | Change Type |
| --- | --- | --- |
| `backend/src/homelab_cmd/api/routes/agent_register.py` (`get_install_script`) | Expanded argument parser, fallback IP in template | Modified |
| Backend templating helper (wherever the install.sh string is built) | Add `HUB_URL_FALLBACK_IP` substitution | Modified |
| Config: `HOMELAB_CMD_PUBLIC_IP` | New optional setting | New |

### Breaking Changes

None – additive only.

---

## Acceptance Criteria

- [ ] Hub-served install.sh accepts `--hub-url`, `--mode`, `--server-id` and applies them correctly (verified by passing each and inspecting the generated `config.yaml`).
- [ ] On a host that cannot resolve the hub's hostname, the script auto-falls back to `HUB_URL_FALLBACK_IP` and prints a clear warning (verified by deliberately breaking DNS and re-running).
- [ ] `--patch-hosts` flag adds an idempotent `/etc/hosts` entry on first run; second run with the same flag is a no-op.
- [ ] Passing an unknown option produces an error that includes the full list of supported flags.
- [ ] Existing successful installs (host can resolve hub hostname) follow the same code path as before; no regression for the 8 hosts that worked first time today.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Wrong fallback IP injected (e.g. behind NAT) and agents register against an unroutable address | Medium | High | Default to no fallback IP unless `HOMELAB_CMD_PUBLIC_IP` is set explicitly; document the request-header inference path as opt-in |
| `--patch-hosts` writes to a host where it's inappropriate (e.g. immutable distro) | Low | Low | Idempotent, easy to revert; gated behind explicit flag |
| Operator confusion about which URL the agent ended up using | Medium | Low | Script prints `Hub URL: <final>` line; agent's `config.yaml` is the source of truth |

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

- Solving the broader Tailscale-MagicDNS-hides-`.local.lan` issue (that's a homelab DNS config concern, not a HomelabCmd one).
- Discovering the hub dynamically (e.g. mDNS, SRV records) – an interesting but separate design.

---

## Open Questions

- [ ] Should `--hub-url` override take precedence over `HUB_URL_FALLBACK_IP` even when the fallback would have worked? (Recommendation: yes, explicit user intent wins.) — Owner: project lead

---

## Close Reason

> *Filled when CR is closed*

**Outcome:**
**Rationale:**

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-05-24 | Darren | CR proposed. Concrete trigger: backupserver + agentbox01 install bailed at token-claim because Tailscale MagicDNS shadows `.local.lan`. Recovery required `/etc/hosts` workaround. Both hosts later succeeded once the entry was added. |
