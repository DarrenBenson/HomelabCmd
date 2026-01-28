"""FastAPI dependencies for authentication and common functionality."""

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Security
from fastapi.security import APIKeyHeader
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.config import get_settings
from homelab_cmd.db.session import get_async_session
from homelab_cmd.services.credential_service import CredentialService
from homelab_cmd.services.token_service import TokenService

# API key header scheme (legacy authentication)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


@dataclass
class AuthInfo:
    """Information about the authenticated agent or user.

    Attributes:
        method: Authentication method used ("per_agent" or "legacy")
        server_guid: Server GUID if using per-agent auth, None for legacy
        credential_prefix: Token prefix if using per-agent auth
    """

    method: str
    server_guid: str | None = None
    credential_prefix: str | None = None


async def verify_api_key(api_key: str | None = Security(api_key_header)) -> str:
    """Verify the API key from the X-API-Key header.

    This is the legacy authentication method using the shared API key.
    Use verify_agent_auth for endpoints that should support both methods.

    Args:
        api_key: The API key from the header (None if not provided)

    Returns:
        The validated API key

    Raises:
        HTTPException: 401 if the API key is missing or invalid
    """
    settings = get_settings()

    # Handle missing or empty API key
    if not api_key or not api_key.strip():
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHORIZED", "message": "Invalid or missing API key"},
        )

    # Trim whitespace and compare
    if api_key.strip() != settings.api_key:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHORIZED", "message": "Invalid or missing API key"},
        )

    return api_key


async def verify_agent_auth(
    api_key: str | None = Security(api_key_header),
    agent_token: Annotated[str | None, Header(alias="X-Agent-Token")] = None,
    server_guid: Annotated[str | None, Header(alias="X-Server-GUID")] = None,
    session: AsyncSession = Depends(get_async_session),
) -> AuthInfo:
    """Verify agent authentication using either per-agent token or legacy API key.

    This dependency supports dual authentication:
    1. Per-agent tokens: X-Agent-Token + X-Server-GUID headers (preferred)
    2. Legacy shared key: X-API-Key header (backward compatible)

    Per-agent tokens are tried first if present. Falls back to legacy key.

    Args:
        api_key: Legacy API key from X-API-Key header
        agent_token: Per-agent token from X-Agent-Token header
        server_guid: Server GUID from X-Server-GUID header
        session: Database session for credential lookup

    Returns:
        AuthInfo with authentication method and details

    Raises:
        HTTPException: 401 if authentication fails
    """
    settings = get_settings()

    # Try per-agent token first (if both headers present)
    if agent_token and server_guid:
        agent_token = agent_token.strip()
        server_guid = server_guid.strip()

        if agent_token and server_guid:
            service = TokenService(session)
            is_valid, credential = await service.validate_agent_token(
                plaintext_token=agent_token,
                server_guid=server_guid,
            )

            if is_valid and credential:
                # Commit the last_used_at update
                await session.commit()
                return AuthInfo(
                    method="per_agent",
                    server_guid=server_guid,
                    credential_prefix=credential.api_token_prefix,
                )

            # Per-agent auth was attempted but failed
            raise HTTPException(
                status_code=401,
                detail={
                    "code": "UNAUTHORIZED",
                    "message": "Invalid agent token or server GUID",
                },
            )

    # Fall back to legacy shared key
    if api_key:
        api_key = api_key.strip()
        if api_key and api_key == settings.api_key:
            return AuthInfo(method="legacy")

    # No valid authentication provided
    raise HTTPException(
        status_code=401,
        detail={"code": "UNAUTHORIZED", "message": "Invalid or missing authentication"},
    )


async def verify_agent_auth_optional(
    api_key: str | None = Security(api_key_header),
    agent_token: Annotated[str | None, Header(alias="X-Agent-Token")] = None,
    server_guid: Annotated[str | None, Header(alias="X-Server-GUID")] = None,
    session: AsyncSession = Depends(get_async_session),
) -> AuthInfo | None:
    """Optionally verify agent authentication.

    Like verify_agent_auth but returns None instead of raising 401 if no
    authentication is provided. Useful for endpoints that have optional auth.

    Args:
        api_key: Legacy API key from X-API-Key header
        agent_token: Per-agent token from X-Agent-Token header
        server_guid: Server GUID from X-Server-GUID header
        session: Database session for credential lookup

    Returns:
        AuthInfo if authenticated, None otherwise
    """
    settings = get_settings()

    # Try per-agent token first
    if agent_token and server_guid:
        agent_token = agent_token.strip()
        server_guid = server_guid.strip()

        if agent_token and server_guid:
            service = TokenService(session)
            is_valid, credential = await service.validate_agent_token(
                plaintext_token=agent_token,
                server_guid=server_guid,
            )

            if is_valid and credential:
                await session.commit()
                return AuthInfo(
                    method="per_agent",
                    server_guid=server_guid,
                    credential_prefix=credential.api_token_prefix,
                )

    # Try legacy key
    if api_key:
        api_key = api_key.strip()
        if api_key and api_key == settings.api_key:
            return AuthInfo(method="legacy")

    return None


async def get_credential_service(
    session: AsyncSession = Depends(get_async_session),
) -> CredentialService:
    """Get the credential service dependency (US0087).

    Returns:
        CredentialService instance configured with the session and encryption key.

    Raises:
        HTTPException: 500 if encryption key is not configured.
    """
    settings = get_settings()
    if not settings.encryption_key:
        raise HTTPException(
            status_code=500,
            detail={
                "code": "NO_ENCRYPTION_KEY",
                "message": "Encryption key not configured. Set HOMELAB_CMD_ENCRYPTION_KEY.",
            },
        )
    return CredentialService(session, settings.encryption_key)
