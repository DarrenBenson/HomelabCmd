"""SSH settings API endpoints.

Part of EP0008: Tailscale Integration (US0079).

Provides endpoints for:
- Uploading SSH private key (encrypted storage)
- Getting SSH configuration status
- Updating default SSH username
- Removing SSH key
"""

import base64
import hashlib
import io
import logging

import paramiko
from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.deps import verify_api_key
from homelab_cmd.api.responses import AUTH_RESPONSES
from homelab_cmd.api.schemas.ssh import (
    SSHKeyDeleteResponse,
    SSHKeyStatusResponse,
    SSHKeyUploadResponse,
    SSHUsernameRequest,
    SSHUsernameResponse,
)
from homelab_cmd.config import get_settings
from homelab_cmd.db.models.config import Config
from homelab_cmd.db.models.credential import Credential
from homelab_cmd.db.session import get_async_session
from homelab_cmd.services.credential_service import CredentialService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings/ssh", tags=["Configuration"])


def _get_credential_service(session: AsyncSession) -> CredentialService:
    """Create a CredentialService with the encryption key from settings."""
    settings = get_settings()
    return CredentialService(session, settings.encryption_key or "")


def _get_key_fingerprint(pkey: paramiko.PKey) -> str:
    """Get SHA256 fingerprint of a key."""
    key_bytes = pkey.asbytes()
    fingerprint = hashlib.sha256(key_bytes).digest()
    b64_fingerprint = base64.b64encode(fingerprint).decode().rstrip("=")
    return f"SHA256:{b64_fingerprint}"


def _detect_key_type(key_content: str) -> tuple[str, paramiko.PKey]:
    """Detect key type and parse key from content.

    Args:
        key_content: The private key content as string.

    Returns:
        Tuple of (key_type_string, paramiko_key_object).

    Raises:
        ValueError: If key format is invalid or password-protected.
    """
    key_file = io.StringIO(key_content)

    # Try Ed25519 first (most common modern key)
    try:
        key_file.seek(0)
        pkey = paramiko.Ed25519Key.from_private_key(key_file)
        return "ssh-ed25519", pkey
    except paramiko.PasswordRequiredException as err:
        raise ValueError(
            "Password-protected keys are not supported. Please decrypt the key first."
        ) from err
    except paramiko.SSHException:
        pass

    # Try RSA
    try:
        key_file.seek(0)
        pkey = paramiko.RSAKey.from_private_key(key_file)
        bits = pkey.get_bits()
        return f"RSA-{bits}", pkey
    except paramiko.PasswordRequiredException as err:
        raise ValueError(
            "Password-protected keys are not supported. Please decrypt the key first."
        ) from err
    except paramiko.SSHException:
        pass

    # Try ECDSA
    try:
        key_file.seek(0)
        pkey = paramiko.ECDSAKey.from_private_key(key_file)
        bits = pkey.get_bits()
        return f"ECDSA-{bits}", pkey
    except paramiko.PasswordRequiredException as err:
        raise ValueError(
            "Password-protected keys are not supported. Please decrypt the key first."
        ) from err
    except paramiko.SSHException:
        pass

    raise ValueError("Invalid SSH private key format. Key must be PEM format (RSA, Ed25519, or ECDSA).")


@router.post(
    "/key",
    response_model=SSHKeyUploadResponse,
    operation_id="save_ssh_private_key",
    summary="Upload SSH private key",
    responses={
        **AUTH_RESPONSES,
        400: {
            "description": "Invalid SSH key format",
            "content": {
                "application/json": {
                    "example": {
                        "detail": {
                            "code": "INVALID_SSH_KEY",
                            "message": "Invalid SSH private key format. Key must be PEM format (RSA or Ed25519).",
                        }
                    }
                }
            },
        },
    },
)
async def upload_ssh_key(
    key: UploadFile,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> SSHKeyUploadResponse:
    """Upload an SSH private key for machine connections.

    The key is encrypted at rest using the application's encryption key.
    Supported formats: RSA, Ed25519, ECDSA (PEM format, not password-protected).

    AC2: SSH key encrypted storage.
    """
    # Read key content
    key_content = await key.read()
    try:
        key_str = key_content.decode("utf-8")
    except UnicodeDecodeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_SSH_KEY",
                "message": "Invalid SSH key encoding. Key must be UTF-8 encoded PEM format.",
            },
        ) from e

    # Validate and detect key type
    try:
        key_type, pkey = _detect_key_type(key_str)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_SSH_KEY",
                "message": str(e),
            },
        ) from e

    # Get fingerprint
    fingerprint = _get_key_fingerprint(pkey)

    # Store encrypted
    credential_service = _get_credential_service(session)
    await credential_service.store_credential("ssh_private_key", key_str)
    await session.commit()

    logger.info("SSH key uploaded: %s (%s)", key_type, fingerprint)

    return SSHKeyUploadResponse(
        success=True,
        message="SSH key uploaded and encrypted",
        key_type=key_type,
        fingerprint=fingerprint,
    )


@router.delete(
    "/key",
    response_model=SSHKeyDeleteResponse,
    operation_id="remove_ssh_private_key",
    summary="Remove SSH private key",
    responses={**AUTH_RESPONSES},
)
async def delete_ssh_key(
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> SSHKeyDeleteResponse:
    """Remove the stored SSH private key.

    This also clears any cached connections in the SSH executor pool.
    """
    credential_service = _get_credential_service(session)
    deleted = await credential_service.delete_credential("ssh_private_key")
    await session.commit()

    if deleted:
        logger.info("SSH key removed")
        return SSHKeyDeleteResponse(success=True, message="SSH key removed")

    return SSHKeyDeleteResponse(success=True, message="No SSH key was configured")


@router.get(
    "/status",
    response_model=SSHKeyStatusResponse,
    operation_id="get_ssh_status",
    summary="Get SSH configuration status",
    responses={**AUTH_RESPONSES},
)
async def get_ssh_status(
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> SSHKeyStatusResponse:
    """Get the current SSH configuration status.

    Returns whether an SSH key is configured and the default username.
    """
    credential_service = _get_credential_service(session)

    # Check if key exists (without decrypting fully)
    key_exists = await credential_service.credential_exists("ssh_private_key")

    # Get key metadata if exists
    key_type = None
    fingerprint = None
    uploaded_at = None

    if key_exists:
        # Get key to extract type and fingerprint
        key_content = await credential_service.get_credential("ssh_private_key")
        if key_content:
            try:
                key_type, pkey = _detect_key_type(key_content)
                fingerprint = _get_key_fingerprint(pkey)
            except ValueError:
                pass

        # Get credential record for upload time
        stmt = select(Credential).where(Credential.credential_type == "ssh_private_key")
        result = await session.execute(stmt)
        credential = result.scalar_one_or_none()
        if credential:
            uploaded_at = credential.created_at

    # Get default username from config
    stmt = select(Config).where(Config.key == "ssh_username")
    result = await session.execute(stmt)
    config = result.scalar_one_or_none()
    username = config.value if config else "homelabcmd"

    return SSHKeyStatusResponse(
        configured=key_exists,
        key_type=key_type,
        fingerprint=fingerprint,
        uploaded_at=uploaded_at,
        username=username,
    )


@router.put(
    "/username",
    response_model=SSHUsernameResponse,
    operation_id="update_ssh_username",
    summary="Update default SSH username",
    responses={**AUTH_RESPONSES},
)
async def update_ssh_username(
    request: SSHUsernameRequest,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> SSHUsernameResponse:
    """Update the default SSH username used for connections.

    AC1: The default username is 'homelabcmd' (configurable).
    """
    # Upsert config
    stmt = select(Config).where(Config.key == "ssh_username")
    result = await session.execute(stmt)
    config = result.scalar_one_or_none()

    if config:
        config.value = request.username
    else:
        config = Config(key="ssh_username", value=request.username)
        session.add(config)

    await session.commit()

    logger.info("SSH username updated to: %s", request.username)

    return SSHUsernameResponse(
        success=True,
        message="Default SSH username updated",
    )
