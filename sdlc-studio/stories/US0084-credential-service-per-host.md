# US0084: Credential Service Per-Host Support

> **Status:** Done
> **Epic:** [EP0015: Per-Host Credential Management](../epics/EP0015-per-host-credential-management.md)
> **Owner:** Darren
> **Created:** 2026-01-27
> **Story Points:** 5

## User Story

**As a** system administrator
**I want** the credential service to support per-server credentials
**So that** operations use the correct credentials for each server

## Context

### Persona Reference

**Darren** - Manages servers with varying credential requirements. Production servers need individual sudo passwords, while homelab servers use passwordless sudo.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

The current CredentialService only supports global credentials (no server_id). This story extends the service to support:

1. Storing credentials scoped to specific servers
2. Retrieving credentials with a fallback chain (per-server → global → none)
3. New credential types: `sudo_password`, `ssh_password`

This enables the agent deployment service to use the correct credentials for each server.

## Acceptance Criteria

### AC1: store_credential supports server_id parameter

- **Given** the credential service
- **When** calling `store_credential(type, value, server_id="my-server")`
- **Then** the credential is stored with server_id="my-server"
- **And** the credential can be retrieved with that server_id

### AC2: get_credential supports server_id parameter

- **Given** a stored per-server credential
- **When** calling `get_credential(type, server_id="my-server")`
- **Then** the per-server credential is returned
- **And** global credential is NOT returned

### AC3: get_effective_credential implements fallback chain

- **Given** both global and per-server credentials
- **When** calling `get_effective_credential(type, server_id)`
- **Then** per-server credential is returned if it exists
- **And** global credential is returned if per-server doesn't exist
- **And** None is returned if neither exists

### AC4: delete_credential supports per-server deletion

- **Given** a stored per-server credential
- **When** calling `delete_credential(type, server_id="my-server")`
- **Then** only the per-server credential is deleted
- **And** global credential remains unchanged

### AC5: ALLOWED_CREDENTIAL_TYPES includes new types

- **Given** the credential type validation
- **When** storing `sudo_password` or `ssh_password` credentials
- **Then** the types are accepted
- **And** credentials are encrypted and stored

### AC6: credential_exists supports per-server check

- **Given** a stored per-server credential
- **When** calling `credential_exists(type, server_id="my-server")`
- **Then** True is returned
- **And** False for non-existent server credentials

## Scope

### In Scope

- Extend `store_credential()` with optional server_id parameter
- Extend `get_credential()` with optional server_id parameter
- New `get_effective_credential()` method with fallback chain
- Extend `delete_credential()` with optional server_id parameter
- Extend `credential_exists()` with optional server_id parameter
- Add `sudo_password` and `ssh_password` to ALLOWED_CREDENTIAL_TYPES
- Unit tests for all scenarios

### Out of Scope

- API endpoints (US0087)
- Agent deployment changes (US0085, US0086)
- UI changes (US0088)

## Technical Notes

### Updated Service Interface

```python
# Allowed credential types - extended
ALLOWED_CREDENTIAL_TYPES = frozenset({
    "tailscale_token",
    "ssh_private_key",
    "sudo_password",     # NEW
    "ssh_password",      # NEW
})


class CredentialService:
    async def store_credential(
        self,
        credential_type: str,
        plaintext_value: str,
        server_id: str | None = None,
    ) -> str:
        """Store an encrypted credential.

        Args:
            credential_type: Type of credential.
            plaintext_value: The sensitive value to encrypt and store.
            server_id: Optional server ID for per-server credentials.
                      If None, stores as global credential.

        Returns:
            The credential ID (UUID).
        """
        ...

    async def get_credential(
        self,
        credential_type: str,
        server_id: str | None = None,
    ) -> str | None:
        """Retrieve and decrypt a credential.

        Args:
            credential_type: Type of credential to retrieve.
            server_id: Optional server ID. If None, retrieves global.
                      Does NOT fallback - use get_effective_credential for that.

        Returns:
            The decrypted plaintext value, or None if not found.
        """
        ...

    async def get_effective_credential(
        self,
        credential_type: str,
        server_id: str,
    ) -> str | None:
        """Retrieve credential with fallback chain.

        Retrieval order:
        1. Per-server credential (if exists)
        2. Global credential (if exists)
        3. None

        Args:
            credential_type: Type of credential to retrieve.
            server_id: Server ID to check for per-server credential.

        Returns:
            The decrypted plaintext value, or None if not found.
        """
        # Try per-server first
        per_server = await self.get_credential(credential_type, server_id)
        if per_server is not None:
            return per_server

        # Fall back to global
        return await self.get_credential(credential_type, server_id=None)

    async def delete_credential(
        self,
        credential_type: str,
        server_id: str | None = None,
    ) -> bool:
        """Delete a credential.

        Args:
            credential_type: Type of credential to delete.
            server_id: Optional server ID. If None, deletes global.

        Returns:
            True if the credential existed and was deleted.
        """
        ...

    async def credential_exists(
        self,
        credential_type: str,
        server_id: str | None = None,
    ) -> bool:
        """Check if a credential exists without decrypting.

        Args:
            credential_type: Type of credential to check.
            server_id: Optional server ID. If None, checks global.

        Returns:
            True if the credential exists.
        """
        ...
```

### Query Changes

```python
# Current query (global only)
stmt = select(Credential).where(Credential.credential_type == credential_type)

# New query (per-server aware)
stmt = select(Credential).where(
    Credential.credential_type == credential_type,
    Credential.server_id == server_id  # None for global
)
```

### Files Modified

| File | Changes |
|------|---------|
| `backend/src/homelab_cmd/services/credential_service.py` | Add server_id to all methods, new types, get_effective_credential |
| `backend/tests/test_credential_service.py` | New tests for per-server functionality |

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Get per-server when only global exists | Returns None (use get_effective_credential for fallback) |
| Get effective when both exist | Returns per-server |
| Get effective when only global exists | Returns global |
| Get effective when neither exists | Returns None |
| Store per-server with invalid server_id | FK constraint error (caught by DB) |
| Delete per-server leaves global | Global remains unchanged |
| Store sudo_password | Accepted, encrypted |
| Store unknown credential type | ValueError raised |

## Test Scenarios

- [ ] Store global credential (server_id=None)
- [ ] Store per-server credential
- [ ] Get global credential
- [ ] Get per-server credential
- [ ] Get per-server returns None when only global exists
- [ ] Get effective returns per-server when both exist
- [ ] Get effective returns global when per-server doesn't exist
- [ ] Get effective returns None when neither exists
- [ ] Delete global credential
- [ ] Delete per-server credential
- [ ] Delete per-server leaves global intact
- [ ] Store sudo_password type
- [ ] Store ssh_password type
- [ ] credential_exists for per-server
- [ ] credential_exists for global

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0084-01 | Store per-server credential | AC1 | Unit | Ready |
| TC-US0084-02 | Get per-server credential | AC2 | Unit | Ready |
| TC-US0084-03 | Get effective - per-server exists | AC3 | Unit | Ready |
| TC-US0084-04 | Get effective - only global | AC3 | Unit | Ready |
| TC-US0084-05 | Get effective - neither exists | AC3 | Unit | Ready |
| TC-US0084-06 | Delete per-server credential | AC4 | Unit | Ready |
| TC-US0084-07 | Store sudo_password type | AC5 | Unit | Ready |
| TC-US0084-08 | Store ssh_password type | AC5 | Unit | Ready |
| TC-US0084-09 | credential_exists per-server | AC6 | Unit | Ready |

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0083: Per-Server Credential Schema | Story | Ready |

## Estimation

**Story Points:** 5

**Complexity:** Medium - Extends existing service with new parameter and fallback logic

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-27 | Claude | Initial story creation |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
