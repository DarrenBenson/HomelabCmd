# US0087: Per-Server Credential API Endpoints

> **Status:** Done
> **Epic:** [EP0015: Per-Host Credential Management](../epics/EP0015-per-host-credential-management.md)
> **Owner:** Darren
> **Created:** 2026-01-27
> **Story Points:** 5

## User Story

**As a** system administrator
**I want** API endpoints to manage per-server credentials
**So that** I can configure credentials via the dashboard

## Context

### Persona Reference

**Darren** - Prefers managing server configuration through the web UI rather than editing config files or using direct database access.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

With per-server credential support in the database and service layer, we need API endpoints to:

1. List credential types configured for a server
2. Store per-server credentials
3. Delete per-server credentials
4. Update server credential settings (ssh_username, sudo_mode)

Security is critical - credential values must never be returned in API responses.

## Acceptance Criteria

### AC1: List server credentials endpoint

- **Given** a server with configured credentials
- **When** calling `GET /api/v1/servers/{server_id}/credentials`
- **Then** response lists credential types that exist
- **And** response includes whether each is per-server or global fallback
- **And** response NEVER includes decrypted credential values

### AC2: Store server credential endpoint

- **Given** a valid server_id
- **When** calling `POST /api/v1/servers/{server_id}/credentials`
- **Then** the credential is stored encrypted for that server
- **And** response confirms success without echoing the value

### AC3: Delete server credential endpoint

- **Given** a server with a stored credential
- **When** calling `DELETE /api/v1/servers/{server_id}/credentials/{type}`
- **Then** the per-server credential is deleted
- **And** global credential remains unaffected
- **And** future requests fall back to global

### AC4: Update server credential settings

- **Given** a valid server_id
- **When** calling `PATCH /api/v1/servers/{server_id}` with ssh_username or sudo_mode
- **Then** the server's credential settings are updated
- **And** response includes updated values

### AC5: Credential type validation

- **Given** an invalid credential type
- **When** storing or deleting
- **Then** 400 error with list of valid types

### AC6: OpenAPI documentation complete

- **Given** the new endpoints
- **Then** OpenAPI spec includes full documentation
- **And** request/response schemas are documented
- **And** error responses are documented

## Scope

### In Scope

- `GET /api/v1/servers/{server_id}/credentials` - list credentials
- `POST /api/v1/servers/{server_id}/credentials` - store credential
- `DELETE /api/v1/servers/{server_id}/credentials/{type}` - delete credential
- Update `PATCH /api/v1/servers/{server_id}` to handle ssh_username, sudo_mode
- Request/response Pydantic schemas
- OpenAPI documentation
- Integration tests

### Out of Scope

- UI implementation (US0088)
- Global credential endpoints (already exist in ssh_settings)
- Credential rotation

## Technical Notes

### API Endpoints

```
GET    /api/v1/servers/{server_id}/credentials
POST   /api/v1/servers/{server_id}/credentials
DELETE /api/v1/servers/{server_id}/credentials/{credential_type}
```

### Request/Response Schemas

```python
# List credentials response
class ServerCredentialStatus(BaseModel):
    """Status of a credential type for a server."""
    credential_type: str = Field(description="Type of credential")
    configured: bool = Field(description="Whether credential is configured")
    scope: str = Field(description="'per_server' or 'global' or 'none'")

class ServerCredentialsResponse(BaseModel):
    """List of credential statuses for a server."""
    server_id: str
    ssh_username: str | None = Field(description="Per-server SSH username override")
    sudo_mode: str = Field(description="Sudo mode: 'passwordless' or 'password'")
    credentials: list[ServerCredentialStatus]

# Store credential request
class StoreServerCredentialRequest(BaseModel):
    """Request to store a per-server credential."""
    credential_type: str = Field(
        description="Type of credential",
        examples=["sudo_password", "ssh_private_key", "ssh_password"]
    )
    value: str = Field(
        description="The credential value (will be encrypted)",
        min_length=1
    )

class StoreServerCredentialResponse(BaseModel):
    """Response after storing a credential."""
    credential_type: str
    server_id: str
    message: str = "Credential stored successfully"

# Server update schema extension
class ServerUpdateRequest(BaseModel):
    """Request to update server settings."""
    # ... existing fields ...
    ssh_username: str | None = Field(
        default=None,
        description="Per-server SSH username override"
    )
    sudo_mode: str | None = Field(
        default=None,
        description="Sudo mode: 'passwordless' or 'password'"
    )
```

### API Implementation

```python
@router.get("/{server_id}/credentials", response_model=ServerCredentialsResponse)
async def list_server_credentials(
    server_id: str,
    session: AsyncSession = Depends(get_session),
    _api_key: str = Depends(verify_api_key),
    credential_service: CredentialService = Depends(get_credential_service),
) -> ServerCredentialsResponse:
    """List credential status for a server.

    Returns which credential types are configured and their scope
    (per-server or global fallback). Never returns actual credential values.
    """
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    credential_types = ["ssh_private_key", "sudo_password", "ssh_password"]
    credentials = []

    for cred_type in credential_types:
        # Check per-server
        per_server_exists = await credential_service.credential_exists(
            cred_type, server_id=server_id
        )
        # Check global
        global_exists = await credential_service.credential_exists(
            cred_type, server_id=None
        )

        if per_server_exists:
            scope = "per_server"
            configured = True
        elif global_exists:
            scope = "global"
            configured = True
        else:
            scope = "none"
            configured = False

        credentials.append(ServerCredentialStatus(
            credential_type=cred_type,
            configured=configured,
            scope=scope,
        ))

    return ServerCredentialsResponse(
        server_id=server_id,
        ssh_username=server.ssh_username,
        sudo_mode=server.sudo_mode,
        credentials=credentials,
    )


@router.post("/{server_id}/credentials", response_model=StoreServerCredentialResponse)
async def store_server_credential(
    server_id: str,
    request: StoreServerCredentialRequest,
    session: AsyncSession = Depends(get_session),
    _api_key: str = Depends(verify_api_key),
    credential_service: CredentialService = Depends(get_credential_service),
) -> StoreServerCredentialResponse:
    """Store a per-server credential.

    The credential value is encrypted before storage.
    """
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    await credential_service.store_credential(
        credential_type=request.credential_type,
        plaintext_value=request.value,
        server_id=server_id,
    )
    await session.commit()

    return StoreServerCredentialResponse(
        credential_type=request.credential_type,
        server_id=server_id,
    )


@router.delete("/{server_id}/credentials/{credential_type}")
async def delete_server_credential(
    server_id: str,
    credential_type: str,
    session: AsyncSession = Depends(get_session),
    _api_key: str = Depends(verify_api_key),
    credential_service: CredentialService = Depends(get_credential_service),
) -> dict:
    """Delete a per-server credential.

    After deletion, the server will fall back to the global credential
    (if one exists) for this credential type.
    """
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    deleted = await credential_service.delete_credential(
        credential_type=credential_type,
        server_id=server_id,
    )
    await session.commit()

    if not deleted:
        raise HTTPException(
            status_code=404,
            detail=f"No per-server credential of type '{credential_type}' found"
        )

    return {"message": "Credential deleted successfully", "fallback_to_global": True}
```

### Files Modified

| File | Changes |
|------|---------|
| `backend/src/homelab_cmd/api/routes/servers.py` | Add credential endpoints |
| `backend/src/homelab_cmd/api/schemas/server.py` | Add credential schemas |
| `backend/src/homelab_cmd/api/deps.py` | Add get_credential_service dependency |
| `backend/tests/test_api_servers.py` | Add credential endpoint tests |

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Server not found | 404 error |
| Invalid credential type | 400 error with valid types |
| Empty credential value | 422 validation error |
| Delete non-existent credential | 404 error |
| Invalid sudo_mode value | 422 validation error |
| Encryption key missing | 500 error (credential service fails) |

## Test Scenarios

- [x] List credentials for server with none configured
- [x] List credentials shows per-server and global scope
- [x] Store per-server credential succeeds
- [x] Store invalid credential type fails with 400
- [x] Delete per-server credential succeeds
- [x] Delete non-existent credential returns 404
- [x] Update ssh_username via PATCH
- [x] Update sudo_mode via PATCH
- [x] Invalid sudo_mode rejected
- [x] Response never includes credential value

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0087-01 | List server credentials | AC1 | Integration | Passed |
| TC-US0087-02 | Store per-server credential | AC2 | Integration | Passed |
| TC-US0087-03 | Delete per-server credential | AC3 | Integration | Passed |
| TC-US0087-04 | Update ssh_username | AC4 | Integration | Passed |
| TC-US0087-05 | Update sudo_mode | AC4 | Integration | Passed |
| TC-US0087-06 | Invalid credential type | AC5 | Integration | Passed |
| TC-US0087-07 | OpenAPI documentation | AC6 | Manual | Passed |

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0084: Credential Service Per-Host Support | Story | Ready |

## Estimation

**Story Points:** 5

**Complexity:** Medium - New endpoints with security considerations

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-27 | Claude | Initial story creation |
| 2026-01-27 | Claude | Implementation completed (TDD) |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
