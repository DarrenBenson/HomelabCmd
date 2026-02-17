"""Unit tests for HostKeyService.

Part of EP0008: Tailscale Integration (US0079).
Tests the TOFU (Trust On First Use) pattern for SSH host key verification.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.db.models import Server
from homelab_cmd.db.models.ssh_host_key import SSHHostKey
from homelab_cmd.services.host_key_service import HostKeyService


class TestHostKeyServiceInit:
    """Tests for HostKeyService initialisation."""

    def test_init_stores_session(self, db_session: AsyncSession) -> None:
        """Test service stores session reference."""
        service = HostKeyService(db_session)
        assert service.session == db_session


class TestGetHostKey:
    """Tests for get_host_key method."""

    @pytest.mark.asyncio
    async def test_get_host_key_not_found(self, db_session: AsyncSession) -> None:
        """Test returns None when host key not found."""
        service = HostKeyService(db_session)

        result = await service.get_host_key("nonexistent-machine")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_host_key_found(self, db_session: AsyncSession) -> None:
        """Test returns host key when found."""
        # Create server first (foreign key requirement)
        server = Server(id="test-machine", hostname="test.local")
        db_session.add(server)
        await db_session.flush()

        # Create a host key
        host_key = SSHHostKey(
            id="test-key-id",
            machine_id="test-machine",
            hostname="test.tailnet.ts.net",
            key_type="ssh-ed25519",
            public_key="AAAAC3NzaC1lZDI1NTE5AAAAITest",
            fingerprint="SHA256:TestFingerprint",
        )
        db_session.add(host_key)
        await db_session.flush()

        service = HostKeyService(db_session)
        result = await service.get_host_key("test-machine")

        assert result is not None
        assert result.machine_id == "test-machine"
        assert result.hostname == "test.tailnet.ts.net"
        assert result.fingerprint == "SHA256:TestFingerprint"


class TestStoreHostKey:
    """Tests for store_host_key method."""

    @pytest.mark.asyncio
    async def test_store_host_key_creates_record(self, db_session: AsyncSession) -> None:
        """Test storing host key creates database record."""
        # Create server first (foreign key requirement)
        server = Server(id="new-machine", hostname="new.local")
        db_session.add(server)
        await db_session.flush()

        service = HostKeyService(db_session)

        key_id = await service.store_host_key(
            machine_id="new-machine",
            hostname="new.tailnet.ts.net",
            key_type="ssh-ed25519",
            public_key="AAAAC3NzaC1lZDI1NTE5AAAAINew",
            fingerprint="SHA256:NewFingerprint",
        )

        assert key_id is not None
        assert len(key_id) == 36  # UUID format

        # Verify record was created
        result = await service.get_host_key("new-machine")
        assert result is not None
        assert result.id == key_id
        assert result.hostname == "new.tailnet.ts.net"
        assert result.key_type == "ssh-ed25519"
        assert result.public_key == "AAAAC3NzaC1lZDI1NTE5AAAAINew"
        assert result.fingerprint == "SHA256:NewFingerprint"

    @pytest.mark.asyncio
    async def test_store_host_key_returns_uuid(self, db_session: AsyncSession) -> None:
        """Test store_host_key returns valid UUID."""
        import uuid

        # Create server first (foreign key requirement)
        server = Server(id="uuid-test", hostname="uuid.local")
        db_session.add(server)
        await db_session.flush()

        service = HostKeyService(db_session)

        key_id = await service.store_host_key(
            machine_id="uuid-test",
            hostname="uuid.tailnet.ts.net",
            key_type="ssh-rsa",
            public_key="AAAAB3NzaC1yc2EAAAADAQABAAAB",
            fingerprint="SHA256:UuidTest",
        )

        # Should be valid UUID
        parsed_uuid = uuid.UUID(key_id)
        assert str(parsed_uuid) == key_id


class TestUpdateLastSeen:
    """Tests for update_last_seen method."""

    @pytest.mark.asyncio
    async def test_update_last_seen_not_found(self, db_session: AsyncSession) -> None:
        """Test returns False when host key not found."""
        service = HostKeyService(db_session)

        result = await service.update_last_seen("nonexistent-machine")

        assert result is False

    @pytest.mark.asyncio
    async def test_update_last_seen_success(self, db_session: AsyncSession) -> None:
        """Test updates last_seen timestamp."""
        from datetime import UTC, datetime, timedelta

        # Create server first (foreign key requirement)
        server = Server(id="update-test", hostname="update.local")
        db_session.add(server)
        await db_session.flush()

        # Create host key with old timestamp
        old_time = datetime.now(UTC) - timedelta(days=7)
        host_key = SSHHostKey(
            id="last-seen-test",
            machine_id="update-test",
            hostname="update.tailnet.ts.net",
            key_type="ssh-ed25519",
            public_key="AAAAC3NzaC1lZDI1NTE5AAAAIUpdate",
            fingerprint="SHA256:UpdateTest",
            last_seen=old_time,
        )
        db_session.add(host_key)
        await db_session.flush()

        service = HostKeyService(db_session)
        before_update = datetime.now(UTC)
        result = await service.update_last_seen("update-test")
        after_update = datetime.now(UTC)

        assert result is True

        # Verify timestamp was updated
        updated = await service.get_host_key("update-test")
        assert updated.last_seen >= before_update
        assert updated.last_seen <= after_update


class TestDeleteHostKey:
    """Tests for delete_host_key method."""

    @pytest.mark.asyncio
    async def test_delete_host_key_not_found(self, db_session: AsyncSession) -> None:
        """Test returns False when host key not found."""
        service = HostKeyService(db_session)

        result = await service.delete_host_key("nonexistent-machine")

        assert result is False

    @pytest.mark.asyncio
    async def test_delete_host_key_success(self, db_session: AsyncSession) -> None:
        """Test deletes host key successfully."""
        # Create server first (foreign key requirement)
        server = Server(id="delete-test", hostname="delete.local")
        db_session.add(server)
        await db_session.flush()

        # Create host key
        host_key = SSHHostKey(
            id="delete-test-key",
            machine_id="delete-test",
            hostname="delete.tailnet.ts.net",
            key_type="ssh-ed25519",
            public_key="AAAAC3NzaC1lZDI1NTE5AAAAIDelete",
            fingerprint="SHA256:DeleteTest",
        )
        db_session.add(host_key)
        await db_session.flush()

        # Verify it exists
        service = HostKeyService(db_session)
        assert await service.get_host_key("delete-test") is not None

        # Delete it
        result = await service.delete_host_key("delete-test")

        assert result is True

        # Verify it's gone
        assert await service.get_host_key("delete-test") is None

    @pytest.mark.asyncio
    async def test_delete_host_key_idempotent(self, db_session: AsyncSession) -> None:
        """Test deleting already-deleted key returns False."""
        # Create server first (foreign key requirement)
        server = Server(id="idempotent", hostname="idempotent.local")
        db_session.add(server)
        await db_session.flush()

        # Create and delete host key
        host_key = SSHHostKey(
            id="idempotent-test",
            machine_id="idempotent",
            hostname="idempotent.tailnet.ts.net",
            key_type="ssh-ed25519",
            public_key="AAAAC3NzaC1lZDI1NTE5AAAAIIdem",
            fingerprint="SHA256:Idempotent",
        )
        db_session.add(host_key)
        await db_session.flush()

        service = HostKeyService(db_session)

        # First delete succeeds
        result1 = await service.delete_host_key("idempotent")
        assert result1 is True

        # Second delete returns False
        result2 = await service.delete_host_key("idempotent")
        assert result2 is False
