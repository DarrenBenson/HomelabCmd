# US0086: Fix Agent Removal Sudo Support

> **Status:** Done
> **Epic:** [EP0015: Per-Host Credential Management](../epics/EP0015-per-host-credential-management.md)
> **Owner:** Darren
> **Created:** 2026-01-27
> **Story Points:** 3

## User Story

**As a** system administrator
**I want** agent removal to work on servers requiring sudo password
**So that** I can cleanly remove agents from any server

## Context

### Persona Reference

**Darren** - Needs to remove agents from decommissioned servers. Some servers require sudo passwords, and the current removal fails with warnings on these servers.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

The current `remove_agent()` method has `ssh_password` parameter for SSH authentication but no `sudo_password` parameter for elevated operations. The uninstall command uses hard-coded `sudo` commands:

```python
# Current code (agent_deploy.py:581-586)
uninstall_cmd = """
    sudo systemctl stop homelab-agent 2>/dev/null || true && \
    sudo systemctl disable homelab-agent 2>/dev/null || true && \
    sudo rm -rf /opt/homelab-agent /etc/homelab-agent && \
    sudo rm -f /etc/systemd/system/homelab-agent.service && \
    sudo systemctl daemon-reload
"""
```

This fails on servers requiring sudo passwords, leaving the agent partially installed and generating warnings.

## Acceptance Criteria

### AC1: remove_agent accepts sudo_password parameter

- **Given** the AgentDeploymentService
- **When** calling `remove_agent(server_id, sudo_password="mypassword")`
- **Then** the sudo_password parameter is accepted
- **And** the parameter is separate from ssh_password
- **And** the parameter is optional (defaults to None)

### AC2: Removal uses password pipe when sudo_password provided

- **Given** a server requiring sudo password
- **When** removing with sudo_password parameter
- **Then** the command uses `echo '<password>' | sudo -S bash -c '...'`
- **And** all sudo commands are executed within the same sudo session

### AC3: Stored sudo_password retrieved automatically

- **Given** a server with stored sudo_password credential
- **When** removing without providing sudo_password parameter
- **Then** the stored credential is retrieved automatically
- **And** used for the removal operation

### AC4: Backward compatible with passwordless sudo

- **Given** a server with passwordless sudo
- **When** removing without sudo_password
- **Then** the removal works using plain sudo commands
- **And** no password prompt occurs

### AC5: Clear error when sudo password needed but unavailable

- **Given** a server requiring sudo password
- **When** removing without sudo_password and no stored credential
- **Then** warning indicates uninstall may have failed
- **And** server is still marked inactive (database state updated)

## Scope

### In Scope

- Add `sudo_password` parameter to `remove_agent()` method
- Build uninstall command with password pipe when sudo_password provided
- Retrieve stored sudo_password if not provided
- Update verification commands for sudo password
- Unit tests for removal with sudo password

### Out of Scope

- API changes (calling code already passes parameters)
- UI changes (US0088 handles credential input)
- Upgrade agent changes (US0085)

## Technical Notes

### Updated Method Signature

```python
async def remove_agent(
    self,
    server_id: str,
    delete_completely: bool = False,
    ssh_username: str | None = None,
    ssh_password: str | None = None,
    sudo_password: str | None = None,  # NEW
) -> DeploymentResult:
    """Remove agent from a server.

    Args:
        server_id: Server identifier.
        delete_completely: If True, delete server from database.
        ssh_username: Optional SSH username for password authentication.
        ssh_password: Optional SSH password for authentication.
        sudo_password: Password for sudo (if required).
                      If not provided, attempts to retrieve from stored credentials.

    Returns:
        DeploymentResult with success/failure details.
    """
```

### Command Building Logic

```python
# Retrieve sudo password if not provided
if sudo_password is None:
    if self.credential_service:
        sudo_password = await self.credential_service.get_effective_credential(
            "sudo_password", server_id
        )

# Build uninstall command
if sudo_password:
    escaped_pw = sudo_password.replace("'", "'\"'\"'")
    uninstall_cmd = f"""
        echo '{escaped_pw}' | sudo -S bash -c '
            systemctl stop homelab-agent 2>/dev/null || true && \
            systemctl disable homelab-agent 2>/dev/null || true && \
            rm -rf /opt/homelab-agent /etc/homelab-agent && \
            rm -f /etc/systemd/system/homelab-agent.service && \
            systemctl daemon-reload
        '
    """
else:
    uninstall_cmd = """
        sudo systemctl stop homelab-agent 2>/dev/null || true && \
        sudo systemctl disable homelab-agent 2>/dev/null || true && \
        sudo rm -rf /opt/homelab-agent /etc/homelab-agent && \
        sudo rm -f /etc/systemd/system/homelab-agent.service && \
        sudo systemctl daemon-reload
    """
```

### Verification with Sudo Password

The verification helper also needs sudo password support:

```python
async def _verify_agent_removal(
    self,
    hostname: str,
    key_usernames: dict[str, str],
    ssh_username: str | None = None,
    ssh_password: str | None = None,
    sudo_password: str | None = None,  # NEW
) -> list[str]:
```

### Files Modified

| File | Changes |
|------|---------|
| `backend/src/homelab_cmd/services/agent_deploy.py` | Add sudo_password param, update commands |
| `backend/tests/test_agent_deploy.py` | New tests for sudo password support |

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| sudo_password provided | Use password pipe |
| No sudo_password, stored credential exists | Retrieve and use stored |
| No sudo_password, no stored credential | Use passwordless sudo |
| Sudo fails (wrong password) | Warning added, server still marked inactive |
| No SSH access at all | Warning added, server still marked inactive |
| delete_completely=True | Server deleted from DB regardless of uninstall result |
| Password contains special chars | Properly escaped for shell |

## Test Scenarios

- [x] Remove with sudo_password parameter succeeds
- [x] Remove retrieves stored sudo_password
- [x] Remove uses passwordless sudo when no password
- [x] Remove marks server inactive even if uninstall fails
- [x] Remove with delete_completely deletes from DB
- [x] Password with special characters escaped correctly
- [x] Warning message includes sudo failure
- [x] Verification helper uses sudo_password

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0086-01 | Remove with sudo_password param | AC1, AC2 | Unit | Passed |
| TC-US0086-02 | Remove retrieves stored credential | AC3 | Unit | Passed |
| TC-US0086-03 | Remove passwordless sudo | AC4 | Unit | Passed |
| TC-US0086-04 | Remove sudo failure warning | AC5 | Unit | Passed |
| TC-US0086-05 | Password escaping | AC2 | Unit | Passed |
| TC-US0086-06 | Verification with sudo_password | AC2 | Unit | Passed |

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0084: Credential Service Per-Host Support | Story | Ready |

## Estimation

**Story Points:** 3

**Complexity:** Medium - Similar to US0085 but for removal operation

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-27 | Claude | Initial story creation |
| 2026-01-27 | Claude | Implementation completed (TDD) |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
