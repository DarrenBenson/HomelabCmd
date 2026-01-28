# US0074: Robust Package Management Architecture

> **Status:** Done
> **Plan:** [PL0042: Robust Package Management](../plans/PL0042-robust-package-management.md)
> **Test Spec:** [TS0015: Robust Package Management Tests](../test-specs/TS0015-robust-package-management.md)
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-01-24
> **Story Points:** 5

## User Story

**As a** Darren (Homelab Operator)
**I want** package updates to run reliably in the background without interactive prompts or filesystem permission issues
**So that** I can confidently update my servers without worrying about session timeouts or failed "read-only" operations

## Context

### Persona Reference

**Darren** - Wants to maintain 5+ servers with minimal manual intervention. Experienced failures where `apt upgrade` hung on interactive prompts or failed due to systemd hardening.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Current implementation of `apt` actions in US0052 uses `subprocess.run` which is synchronous and can time out if the operation takes too long (e.g., Nginx 504). Additionally, the agent's `readwrite` service uses `ProtectSystem=full`, which prevents `apt` from writing to `/etc` or `/usr` unless explicitly allowed. Finally, `apt` can sometimes prompt for configuration file changes, which hangs the non-interactive agent.

## Inherited Constraints

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Architecture | Agent-based execution | Must run via the Python agent |
| Security | Minimal privileges | Read-write access restricted to necessary paths |
| UX | Non-blocking UI | Long-running tasks must not block the Hub API |

## Acceptance Criteria

### AC1: Non-interactive Apt Execution
- **Given** an `apt upgrade` action is triggered
- **When** executing on the agent
- **Then** it must use `DEBIAN_FRONTEND=noninteractive` and `apt-get` options to automatically keep old configurations (`confold`)

### AC2: Detached/Background Execution
- **Given** a long-running package operation (upgrade)
- **When** the agent receives the command
- **Then** it should start the process in the background (detached) so the Hub doesn't time out waiting for completion

### AC3: Systemd Hardening Updates
- **Given** the `homelab-agent-readwrite.service`
- **When** `apt` or `dpkg` needs to write to the filesystem
- **Then** `ReadWritePaths` must include `/var/lib/apt`, `/var/lib/dpkg`, `/var/cache/apt`, `/etc/apt`, and `/boot` (for kernel updates)

### AC4: Reboot Required Detection
- **Given** a successful package upgrade
- **When** the system requires a reboot (e.g., kernel update)
- **Then** the agent should detect the presence of `/var/run/reboot-required` and report this status to the Hub

### AC5: Polling for Completion
- **Given** a background upgrade task
- **When** the Hub polls for status
- **Then** the agent must provide the current state (running, success, failure) and the captured output

## Scope

### In Scope
- Updates to `agent/executor.py` for background/non-interactive execution
- Updates to `agent/homelab-agent-readwrite.service` systemd configuration
- Updates to backend command string generation for `apt` actions
- Reboot status reporting in heartbeats

### Out of Scope
- Automatic reboots
- Selective package rollbacks
- GUI for real-time log streaming (polling is sufficient)

## Technical Notes

### Apt Policy
Use the following environment and flags:
`DEBIAN_FRONTEND=noninteractive apt-get -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" upgrade`

### Systemd ReadWritePaths
Add to `homelab-agent-readwrite.service`:
```ini
ReadWritePaths=/var/lib/apt /var/lib/dpkg /var/cache/apt /etc/apt /boot /var/run
```

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Dpkg lock held | Background process should fail or retry, reported in status |
| Disk space exhausted | Captured in logs, reported as failure |
| Agent restart during upgrade | Detached process continues; agent re-attaches or reports based on PID file/process check |
| Reboot already pending | Heartbeat continues to show reboot required until performed |
| Kernel update fails | `ReadWritePaths` for `/boot` ensures it has a chance to succeed |

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-24 | Claude | Initial story creation for US0074 |
| 2026-01-26 | Claude | Verified all AC pass, marked Done |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
