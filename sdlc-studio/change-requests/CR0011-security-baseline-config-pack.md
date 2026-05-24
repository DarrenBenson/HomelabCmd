# CR-0011: Security-Baseline 2026 configuration pack

> **Status:** Proposed
> **Priority:** P2
> **Type:** feature-request
> **Requester:** Darren (operator)
> **Date:** 2026-05-24
> **Affects:** `data/config-packs/` (new pack YAML), compliance checker rules, docs
> **Depends on:** none (uses existing EP0010 capability)
> **GitHub Issue:** (not yet synced)

## Summary

EP0010 shipped a config-pack mechanism (compliance check, diff view, apply, drift detection) but the only packs in tree today are general-purpose (`base.yaml`, `developer-lite.yaml`, `developer-max.yaml`). Today's manual security audit applied ~7 distinct hardening changes across 10 hosts via ad-hoc bash; those changes are exactly the kind of thing config packs were designed to encode and enforce. Add a built-in `security-baseline-2026` pack that captures the audit's hardening set, plus per-class profiles (Pi-OMV vs x86 vs Debian-bare), so future drift is detected automatically by the existing compliance check.

## Problem

This morning's audit applied the following hardening across the homelab, host-by-host, using a hand-rolled bash loop:

- SSH hardening drop-in / OMV `extraoptions` field (PasswordAuth=no, PermitRoot=no, MaxAuthTries=3, ClientAliveInterval=300, X11Forwarding=no via Match block on OMV templates).
- journald cap drop-in (`/etc/systemd/journald.conf.d/00-cap.conf` with `SystemMaxUse=500M` for Pi class, `=2G` for x86).
- `unattended-upgrades` installed + enabled.
- `fail2ban` installed + active (sshd jail).
- `smartmontools` + `mmc-utils` present.
- `homelab-agent` sudoers tightened to remove `apt-get install *` wildcard (PR-0001 to HomelabCmd upstream).
- LabServerBackup `.env` perms tightened to 0600 (backupserver only).

Today this is "do once, hope it stays". Without an enforcement loop, the next OMV upgrade, Docker recreation, or operator change can re-introduce drift unnoticed. HomelabCmd already has the compliance check + apply mechanism; it just lacks the security-focused pack content.

---

## Proposed Changes

### Item 1: Base pack `security-baseline-2026`

**Priority:** P2
**Effort:** M

Add `data/config-packs/security-baseline-2026.yaml` with the following compliance rules (the pack file schema follows the existing `data/config-packs/base.yaml` pattern; expand to whatever the schema supports for "package installed", "file content matches", "service active", etc.):

| Rule | Type | Detail |
| --- | --- | --- |
| `ssh.password_authentication = no` | sshd config | `sshd -T \| grep ^passwordauthentication` |
| `ssh.permit_root_login = no` | sshd config | `sshd -T \| grep ^permitrootlogin` |
| `ssh.max_auth_tries = 3` | sshd config | |
| `ssh.client_alive_interval = 300` | sshd config | |
| `ssh.x11_forwarding = no` | sshd config (post-Match) | Uses `sshd -T -C user=ops,addr=…` so OMV's `Match User * / X11Forwarding no` is honoured |
| `journald.system_max_use` | drop-in present | Pi: 500M; x86: 2G |
| `package.unattended-upgrades` | dpkg installed + service active | |
| `package.fail2ban` | dpkg installed + service active | |
| `package.smartmontools` | dpkg installed | |
| `package.mmc-utils` | dpkg installed | Pi class only |
| `sudoers.darren_nopasswd` | absent | Must NOT exist on any host (audit DARREN-NOPASS) |
| `homelab_agent.sudoers_wildcards` | absent | `apt-get install *` and `journalctl --vacuum-time=*` must NOT appear in `/etc/sudoers.d/homelab-agent` |

### Item 2: Per-class profiles

**Priority:** P2
**Effort:** S

The fleet has clearly distinct host classes (Pi 4 OMV, Pi 5 OMV, x86 OMV, Ubuntu-AI, Debian-bare). Some rules differ by class (e.g. journald cap value, mmc-utils only on Pi). Three profiles:

- `security-baseline-2026.pi.yaml` (extends `security-baseline-2026.yaml`, sets Pi-specific values)
- `security-baseline-2026.x86.yaml`
- `security-baseline-2026.debian-bare.yaml` (for nvr-class hosts)

Each host gets one assigned via `PUT /api/v1/servers/{server_id}/config/packs`. Existing automation already assigns packs by hostname pattern – extend to assign by class if needed.

### Item 3: Apply hooks

**Priority:** P3
**Effort:** M

The existing `apply_config_pack` endpoint already executes idempotent fixes. Extend the pack-runner so the hardening fixes are first-class (not just bash):

- SSH config: render drop-in into `/etc/ssh/sshd_config.d/10-hardening.conf` with safety check (`sshd -t` before reload, parallel SSH session preserved).
- For OMV hosts: instead of writing a drop-in, call `omv-rpc -u admin SSH set '{…}'` to keep the change template-safe across regens (the pattern that worked today).
- journald cap: write `/etc/systemd/journald.conf.d/00-cap.conf` + `systemctl restart systemd-journald`.
- Packages: `apt-get install -y unattended-upgrades fail2ban smartmontools mmc-utils`.
- Sudoers tighten: detect `homelab-agent` user; if present, ensure no wildcard grants (overlap with CR-0001 / HomelabCmd upstream PR).

### Item 4: Drift dashboard widget

**Priority:** P3
**Effort:** S

A "Security baseline" widget on the home dashboard showing % of fleet compliant with the pack. Click-through to drift details.

---

## Impact Assessment

### Existing Functionality

Existing packs (base, developer-lite, developer-max) untouched. New pack is opt-in (assigned per server). Compliance checker code path extended only where new rule types are introduced.

### Affected Modules

| Module | Impact | Change Type |
| --- | --- | --- |
| `data/config-packs/security-baseline-2026*.yaml` | New pack files | New |
| `backend/src/homelab_cmd/services/config_compliance.py` (or similar) | New rule types if existing schema doesn't cover all rows above | Modified |
| `backend/src/homelab_cmd/services/config_apply.py` (or similar) | New apply hooks for OMV-RPC SSH config and journald drop-in | Modified |
| `frontend/src/components/widgets/` | New baseline widget | New |
| `README.md` | "Security baseline" section | Modified |

### Breaking Changes

None.

---

## Acceptance Criteria

- [ ] `data/config-packs/security-baseline-2026.yaml` and its three per-class variants exist and pass schema validation.
- [ ] `GET /api/v1/config-packs` lists the new pack with its rules.
- [ ] Assigning the pack to a host that already matches today's hardened state (any of the 10 hosts after this morning's sweep) reports 100% compliance.
- [ ] Removing one hardening item on a host (e.g. flip PasswordAuth=yes) → next compliance check reports drift; `apply_config_pack` restores the setting and reports drift gone.
- [ ] On an OMV host, the SSH hardening path uses `omv-rpc` (not direct file edit) so OMV's auto-regen doesn't undo it.
- [ ] On a non-OMV host (agentbox03, appserver1, nvr), SSH hardening writes a drop-in at `/etc/ssh/sshd_config.d/10-hardening.conf`.
- [ ] Baseline widget visible on dashboard, shows fleet-wide compliance %.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Apply hook misconfigures sshd and locks operator out of host | Low | Critical | `sshd -t` validation before reload; the apply-hook runs over the existing SSH session and keeps it open during reload (same pattern used in this morning's manual sweep) |
| OMV-RPC call clobbers existing `extraoptions` if pack doesn't preserve current values | Medium | Medium | Pack-applier reads the current `extraoptions` first, merges the pack's required lines without removing other operator-added lines |
| Per-class profile mis-assignment (Pi cap applied to x86 or vice versa) | Low | Low | Cosmetic only; cap value differences are non-functional |
| LoginGraceTime 30 is desired by audit baseline but OMV hardcodes 120; this CR can't fix that without modifying OMV templates | Medium | Low | Document as known deviation in the pack file; flag for upstream OMV PR |

---

## Dependencies

### CR Dependencies

None (CR-0001 helps – frontend nginx API-key injection lands separately).

### External Dependencies

| Dependency | Type | Status |
| --- | --- | --- |
| Existing EP0010 config-pack engine | Internal | Already in place |
| `omv-rpc` admin tool on OMV hosts | Tool | Already in place per audit experience |

---

## Linked Epics

> *Populated when CR is actioned via `/sdlc-studio cr action`*

| Epic | Title | Status |
| --- | --- | --- |
| _none yet_ | | |

---

## Out of Scope

- pfSense / FreeBSD hosts (the homelab pfSense is not running the homelab-agent and won't be in this CR's scope).
- HAOS host (limited audit per Security-Baseline.md; not in agent inventory).
- Audit-probe parity – the existing `Technical/Scripts/audit-probe.sh` complements the pack rather than being subsumed. Out of scope.

---

## Open Questions

- [ ] Should the pack be auto-assigned to every newly registered server? Tempting (homelab default = secure) but risks surprising operators on edge cases. — Owner: project lead
- [ ] Pack expressed as a single file with class branching, or three sibling files inheriting from a base? Latter is what I described in Item 2 but the engine's existing patterns should win. — Owner: project lead

---

## Close Reason

> *Filled when CR is closed*

**Outcome:**
**Rationale:**

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-05-24 | Darren | CR proposed. Triggered by realising today's manual hardening sweep across 10 hosts is exactly what config packs were designed to enforce, and there's no security-focused pack in tree. |
