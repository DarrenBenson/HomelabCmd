"""Host Key Service for SSH host key verification.

Part of EP0008: Tailscale Integration (US0079).

Implements Trust On First Use (TOFU) pattern for SSH host key verification.
Provides CRUD operations for storing and verifying SSH host keys.
"""

import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.db.models.ssh_host_key import SSHHostKey

logger = logging.getLogger(__name__)


class HostKeyService:
    """Service for storing and verifying SSH host keys (AC6).

    Implements TOFU (Trust On First Use) pattern:
    - On first connection, store the host key
    - On subsequent connections, verify the key matches
    - If key changes, raise an error for user confirmation

    Args:
        session: SQLAlchemy async session for database operations.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_host_key(self, machine_id: str) -> SSHHostKey | None:
        """Retrieve stored host key for a machine.

        Args:
            machine_id: The server/machine ID.

        Returns:
            SSHHostKey if found, None otherwise.
        """
        stmt = select(SSHHostKey).where(SSHHostKey.machine_id == machine_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def store_host_key(
        self,
        machine_id: str,
        hostname: str,
        key_type: str,
        public_key: str,
        fingerprint: str,
    ) -> str:
        """Store a host key on first connection (TOFU).

        Args:
            machine_id: The server/machine ID.
            hostname: Tailscale hostname.
            key_type: SSH key type (e.g., ssh-ed25519).
            public_key: Base64-encoded public key.
            fingerprint: SHA256 fingerprint.

        Returns:
            The host key ID.
        """
        host_key_id = str(uuid.uuid4())
        host_key = SSHHostKey(
            id=host_key_id,
            machine_id=machine_id,
            hostname=hostname,
            key_type=key_type,
            public_key=public_key,
            fingerprint=fingerprint,
        )
        self.session.add(host_key)
        await self.session.flush()

        logger.info("Stored host key for %s (%s)", hostname, fingerprint)
        return host_key_id

    async def update_last_seen(self, machine_id: str) -> bool:
        """Update last_seen timestamp for a host key.

        Called on each successful connection to track usage.

        Args:
            machine_id: The server/machine ID.

        Returns:
            True if updated, False if host key not found.
        """
        stmt = select(SSHHostKey).where(SSHHostKey.machine_id == machine_id)
        result = await self.session.execute(stmt)
        host_key = result.scalar_one_or_none()

        if host_key is None:
            return False

        host_key.last_seen = datetime.now(UTC)
        await self.session.flush()

        logger.debug("Updated last_seen for %s", host_key.hostname)
        return True

    async def delete_host_key(self, machine_id: str) -> bool:
        """Delete a host key (for accepting a new key).

        Called when user confirms acceptance of a changed host key.

        Args:
            machine_id: The server/machine ID.

        Returns:
            True if deleted, False if host key not found.
        """
        stmt = select(SSHHostKey).where(SSHHostKey.machine_id == machine_id)
        result = await self.session.execute(stmt)
        host_key = result.scalar_one_or_none()

        if host_key is None:
            return False

        await self.session.delete(host_key)
        await self.session.flush()

        logger.info("Deleted host key for machine %s", machine_id)
        return True
