"""Credential service for encrypted credential storage.

Part of EP0008: Tailscale Integration (US0081).
Updated EP0015: Per-Host Credential Management (US0084).

Provides secure storage and retrieval of sensitive credentials using
Fernet symmetric encryption. Credentials are encrypted at rest in the
database and decrypted only when needed.

Supports both global credentials (server_id=None) and per-server
credentials (server_id set). Per-server credentials override global
credentials when retrieved via get_effective_credential().
"""

import binascii
import logging
import uuid
from datetime import UTC, datetime

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.db.models.credential import Credential

logger = logging.getLogger(__name__)

# Allowed credential types (EP0015: added sudo_password, ssh_password)
ALLOWED_CREDENTIAL_TYPES = frozenset(
    {
        "tailscale_token",
        "ssh_private_key",
        "sudo_password",
        "ssh_password",
    }
)


class CredentialDecryptionError(Exception):
    """Raised when credential decryption fails.

    This occurs when the encryption key has changed or the stored
    ciphertext is corrupted.
    """

    def __init__(self, credential_type: str, message: str | None = None) -> None:
        self.credential_type = credential_type
        if message is None:
            message = (
                f"Failed to decrypt credential '{credential_type}'. "
                "The encryption key may have changed. Please re-enter the credential."
            )
        super().__init__(message)


class CredentialService:
    """Service for storing and retrieving encrypted credentials.

    Uses Fernet symmetric encryption for secure at-rest storage.
    Credentials are decrypted only when needed and never logged.

    Supports per-server credentials (EP0015) in addition to global credentials.

    Args:
        session: SQLAlchemy async session for database operations.
        encryption_key: Fernet encryption key (32 url-safe base64-encoded bytes).

    Raises:
        ValueError: If encryption_key is invalid.
    """

    def __init__(self, session: AsyncSession, encryption_key: str) -> None:
        self.session = session
        try:
            self._cipher = Fernet(encryption_key.encode())
        except (ValueError, binascii.Error) as e:
            raise ValueError(
                "Invalid encryption key format. "
                "Key must be 32 url-safe base64-encoded bytes. "
                "Generate a new key with: python -m homelab_cmd.cli generate-key"
            ) from e

    async def store_credential(
        self,
        credential_type: str,
        plaintext_value: str,
        server_id: str | None = None,
    ) -> str:
        """Store an encrypted credential.

        If a credential of the same type (and server_id) exists, it is updated.
        Otherwise, a new credential is created.

        Args:
            credential_type: Type of credential (e.g., 'tailscale_token', 'sudo_password').
            plaintext_value: The sensitive value to encrypt and store.
            server_id: Optional server ID for per-server credentials.
                      If None, stores as a global credential.

        Returns:
            The credential ID (UUID).

        Raises:
            ValueError: If credential_type is unknown or value is empty.
        """
        # Validate credential type
        if credential_type not in ALLOWED_CREDENTIAL_TYPES:
            raise ValueError(
                f"Unknown credential type: '{credential_type}'. "
                f"Allowed: {', '.join(sorted(ALLOWED_CREDENTIAL_TYPES))}"
            )

        # Validate value is not empty
        if not plaintext_value or not plaintext_value.strip():
            raise ValueError("Credential value cannot be empty")

        # Encrypt the value
        encrypted_value = self._cipher.encrypt(plaintext_value.encode()).decode()

        # Check if credential exists (upsert) - match both type AND server_id
        stmt = select(Credential).where(
            and_(
                Credential.credential_type == credential_type,
                Credential.server_id == server_id,  # None matches NULL
            )
        )
        result = await self.session.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            # Update existing credential
            existing.encrypted_value = encrypted_value
            existing.updated_at = datetime.now(UTC)
            scope = f" for server {server_id}" if server_id else " (global)"
            logger.info("Updated credential: %s%s", credential_type, scope)
            return existing.id

        # Create new credential
        credential_id = str(uuid.uuid4())
        credential = Credential(
            id=credential_id,
            credential_type=credential_type,
            server_id=server_id,
            encrypted_value=encrypted_value,
        )
        self.session.add(credential)
        await self.session.flush()

        scope = f" for server {server_id}" if server_id else " (global)"
        logger.info("Stored new credential: %s%s", credential_type, scope)
        return credential_id

    async def get_credential(
        self,
        credential_type: str,
        server_id: str | None = None,
    ) -> str | None:
        """Retrieve and decrypt a credential.

        This method retrieves a specific credential matching both type and server_id.
        It does NOT implement fallback logic - use get_effective_credential() for that.

        Args:
            credential_type: Type of credential to retrieve.
            server_id: Optional server ID. If None, retrieves global credential.

        Returns:
            The decrypted plaintext value, or None if not found.

        Raises:
            CredentialDecryptionError: If decryption fails.
        """
        stmt = select(Credential).where(
            and_(
                Credential.credential_type == credential_type,
                Credential.server_id == server_id,  # None matches NULL
            )
        )
        result = await self.session.execute(stmt)
        credential = result.scalar_one_or_none()

        if credential is None:
            return None

        try:
            decrypted = self._cipher.decrypt(credential.encrypted_value.encode()).decode()
            return decrypted
        except InvalidToken as e:
            raise CredentialDecryptionError(credential_type) from e

    async def get_effective_credential(
        self,
        credential_type: str,
        server_id: str,
    ) -> str | None:
        """Retrieve credential with fallback chain.

        Implements per-server credential retrieval with automatic fallback
        to global credentials.

        Retrieval order:
        1. Per-server credential (if exists)
        2. Global credential (if exists)
        3. None

        Args:
            credential_type: Type of credential to retrieve.
            server_id: Server ID to check for per-server credential.

        Returns:
            The decrypted plaintext value, or None if not found.

        Raises:
            CredentialDecryptionError: If decryption fails.
        """
        # Try per-server first
        per_server = await self.get_credential(credential_type, server_id)
        if per_server is not None:
            logger.debug(
                "Using per-server %s for %s",
                credential_type,
                server_id,
            )
            return per_server

        # Fall back to global
        global_cred = await self.get_credential(credential_type, server_id=None)
        if global_cred is not None:
            logger.debug(
                "Using global %s for %s (no per-server credential)",
                credential_type,
                server_id,
            )
        return global_cred

    async def delete_credential(
        self,
        credential_type: str,
        server_id: str | None = None,
    ) -> bool:
        """Delete a credential.

        Args:
            credential_type: Type of credential to delete.
            server_id: Optional server ID. If None, deletes global credential.

        Returns:
            True if the credential existed and was deleted, False otherwise.
        """
        stmt = select(Credential).where(
            and_(
                Credential.credential_type == credential_type,
                Credential.server_id == server_id,  # None matches NULL
            )
        )
        result = await self.session.execute(stmt)
        credential = result.scalar_one_or_none()

        if credential is None:
            return False

        await self.session.delete(credential)
        await self.session.flush()

        scope = f" for server {server_id}" if server_id else " (global)"
        logger.info("Deleted credential: %s%s", credential_type, scope)
        return True

    async def credential_exists(
        self,
        credential_type: str,
        server_id: str | None = None,
    ) -> bool:
        """Check if a credential exists without decrypting.

        Args:
            credential_type: Type of credential to check.
            server_id: Optional server ID. If None, checks global credential.

        Returns:
            True if the credential exists, False otherwise.
        """
        stmt = select(Credential.id).where(
            and_(
                Credential.credential_type == credential_type,
                Credential.server_id == server_id,  # None matches NULL
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def get_credential_scope(
        self,
        credential_type: str,
        server_id: str,
    ) -> str:
        """Determine the scope of a credential for a given server.

        Returns which credential would be used for the server without
        actually decrypting the value.

        Args:
            credential_type: Type of credential to check.
            server_id: Server ID to check.

        Returns:
            'per_server' if server has a specific credential,
            'global' if only global credential exists,
            'none' if no credential exists.
        """
        # Check per-server first
        if await self.credential_exists(credential_type, server_id):
            return "per_server"

        # Check global
        if await self.credential_exists(credential_type, server_id=None):
            return "global"

        return "none"
