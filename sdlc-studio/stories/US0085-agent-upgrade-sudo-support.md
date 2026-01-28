# US0085: Fix Agent Upgrade Sudo Support

> **Status:** Done
> **Epic:** [EP0015: Per-Host Credential Management](../epics/EP0015-per-host-credential-management.md)
> **Owner:** Darren
> **Created:** 2026-01-27
> **Story Points:** 3

## User Story

**As a** system administrator
**I want** agent upgrade to work on servers requiring sudo password
**So that** I can upgrade agents across my entire fleet

## Context

### Persona Reference

**Darren** - Has a mix of servers with different sudo configurations. Needs to upgrade agents on all servers, including those that require sudo passwords for privileged operations.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

The current `upgrade_agent()` method in AgentDeploymentService has no support for sudo passwords. The upgrade command uses hard-coded `sudo` commands without password input:

```python
# Current code (agent_deploy.py:506-513)
upgrade_cmd = f"""
    sudo systemctl stop homelab-agent 2>/dev/null || true && \
    echo "{tarball_b64}" | base64 -d > /tmp/homelab-agent.tar.gz && \
    sudo tar -xzf /tmp/homelab-agent.tar.gz -C / --exclude='*/config.yaml' && \
    sudo systemctl daemon-reload && \
    sudo systemctl start homelab-agent && \
    rm -f /tmp/homelab-agent.tar.gz
"""
```

This fails silently on servers requiring sudo passwords.

## Acceptance Criteria

### AC1: upgrade_agent accepts sudo_password parameter

- **Given** the AgentDeploymentService
- **When** calling `upgrade_agent(server_id, sudo_password="mypassword")`
- **Then** the sudo_password parameter is accepted
- **And** the parameter is optional (defaults to None)

### AC2: Upgrade uses password pipe when sudo_password provided

- **Given** a server requiring sudo password
- **When** upgrading with sudo_password parameter
- **Then** the command uses `echo '<password>' | sudo -S bash -c '...'`
- **And** all sudo commands are executed within the same sudo session

### AC3: Stored sudo_password retrieved automatically

- **Given** a server with stored sudo_password credential
- **When** upgrading without providing sudo_password parameter
- **Then** the stored credential is retrieved automatically
- **And** used for the upgrade operation

### AC4: Backward compatible with passwordless sudo

- **Given** a server with passwordless sudo
- **When** upgrading without sudo_password
- **Then** the upgrade works using plain sudo commands
- **And** no password prompt occurs

### AC5: Clear error when sudo password needed but unavailable

- **Given** a server requiring sudo password
- **When** upgrading without sudo_password and no stored credential
- **Then** the error message clearly indicates sudo password is required
- **And** suggests configuring credentials

## Scope

### In Scope

- Add `sudo_password` parameter to `upgrade_agent()` method
- Build command with password pipe when sudo_password provided
- Retrieve stored sudo_password if not provided
- Clear error message when sudo fails
- Unit tests for upgrade with sudo password

### Out of Scope

- API changes (calling code already passes parameters)
- UI changes (US0088 handles credential input)
- Remove agent changes (US0086)

## Technical Notes

### Updated Method Signature

```python
async def upgrade_agent(
    self,
    server_id: str,
    sudo_password: str | None = None,
) -> DeploymentResult:
    """Upgrade agent on an existing server.

    Args:
        server_id: Server identifier.
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
    # Try to get stored credential
    if self.credential_service:
        sudo_password = await self.credential_service.get_effective_credential(
            "sudo_password", server_id
        )

# Build upgrade command
if sudo_password:
    # Escape single quotes in password for shell safety
    escaped_pw = sudo_password.replace("'", "'\"'\"'")
    upgrade_cmd = f"""
        echo '{escaped_pw}' | sudo -S bash -c '
            systemctl stop homelab-agent 2>/dev/null || true && \
            tar -xzf /tmp/homelab-agent.tar.gz -C / --exclude="*/config.yaml" && \
            systemctl daemon-reload && \
            systemctl start homelab-agent
        ' && \
        echo "{tarball_b64}" | base64 -d > /tmp/homelab-agent.tar.gz && \
        rm -f /tmp/homelab-agent.tar.gz
    """
else:
    # Passwordless sudo
    upgrade_cmd = f"""
        sudo systemctl stop homelab-agent 2>/dev/null || true && \
        echo "{tarball_b64}" | base64 -d > /tmp/homelab-agent.tar.gz && \
        sudo tar -xzf /tmp/homelab-agent.tar.gz -C / --exclude='*/config.yaml' && \
        sudo systemctl daemon-reload && \
        sudo systemctl start homelab-agent && \
        rm -f /tmp/homelab-agent.tar.gz
    """
```

### Files Modified

| File | Changes |
|------|---------|
| `backend/src/homelab_cmd/services/agent_deploy.py` | Add sudo_password param, update command building |
| `backend/tests/test_agent_deploy.py` | New tests for sudo password support |

### Credential Service Dependency

The AgentDeploymentService needs access to CredentialService to retrieve stored sudo passwords:

```python
class AgentDeploymentService:
    def __init__(
        self,
        session: AsyncSession,
        credential_service: CredentialService | None = None,
    ) -> None:
        self.session = session
        self.ssh = SSHConnectionService()
        self.settings = get_settings()
        self.credential_service = credential_service
```

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| sudo_password provided | Use password pipe |
| No sudo_password, stored credential exists | Retrieve and use stored |
| No sudo_password, no stored credential | Use passwordless sudo |
| Sudo fails (wrong password) | Return error with "sudo authentication failed" |
| Sudo fails (passwordless on password-required server) | Return error suggesting credential setup |
| Password contains special chars | Properly escaped for shell |
| Password contains single quotes | Escaped using shell quoting |

## Test Scenarios

- [x] Upgrade with sudo_password parameter succeeds
- [x] Upgrade retrieves stored sudo_password
- [x] Upgrade uses passwordless sudo when no password
- [x] Upgrade fails gracefully on wrong sudo password
- [x] Password with special characters escaped correctly
- [x] Credential service dependency injection works
- [x] Backward compatible with existing callers

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0085-01 | Upgrade with sudo_password param | AC1, AC2 | Unit | Passed |
| TC-US0085-02 | Upgrade retrieves stored credential | AC3 | Unit | Passed |
| TC-US0085-03 | Upgrade passwordless sudo | AC4 | Unit | Passed |
| TC-US0085-04 | Upgrade sudo failure error message | AC5 | Unit | Passed |
| TC-US0085-05 | Password escaping | AC2 | Unit | Passed |

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0084: Credential Service Per-Host Support | Story | Done |

## Estimation

**Story Points:** 3

**Complexity:** Medium - Updates existing method with new parameter and command building logic

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-27 | Claude | Initial story creation |
| 2026-01-27 | Claude | Implementation completed (TDD) |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
