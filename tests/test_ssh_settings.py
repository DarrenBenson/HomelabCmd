"""Tests for SSH Settings (US0079: SSH Connection via Tailscale).

TDD: Tests written first, implementation follows.

Tests cover:
- SSH host key model CRUD operations (AC6)
- SSH key upload and encrypted storage (AC2)
- Connection pooling (AC3)
- Retry logic (AC4)
- Test connection endpoint (AC5)
- Host key verification (AC6)
"""

import pytest
from cryptography.fernet import Fernet
from datetime import UTC, datetime


# =============================================================================
# Phase 1: SSH Host Key Model Tests
# =============================================================================


class TestSSHHostKeyModel:
    """Tests for SSHHostKey database model."""

    @pytest.mark.asyncio
    async def test_create_ssh_host_key(self, db_session) -> None:
        """AC6: Create and store a host key for a machine."""
        from homelab_cmd.db.models.ssh_host_key import SSHHostKey
        from homelab_cmd.db.models.server import Server

        # Create a server first (required for foreign key)
        server = Server(
            id="test-server",
            hostname="test-server.local",
            tailscale_hostname="test-server.tail-abc123.ts.net",
        )
        db_session.add(server)
        await db_session.flush()

        # Create host key
        host_key = SSHHostKey(
            id="host-key-uuid-1",
            machine_id="test-server",
            hostname="test-server.tail-abc123.ts.net",
            key_type="ssh-ed25519",
            public_key="AAAAC3NzaC1lZDI1NTE5AAAAIExample...",
            fingerprint="SHA256:abc123def456",
        )
        db_session.add(host_key)
        await db_session.commit()

        # Verify stored correctly
        assert host_key.id == "host-key-uuid-1"
        assert host_key.machine_id == "test-server"
        assert host_key.hostname == "test-server.tail-abc123.ts.net"
        assert host_key.key_type == "ssh-ed25519"
        assert host_key.fingerprint == "SHA256:abc123def456"
        assert host_key.first_seen is not None
        assert host_key.last_seen is not None

    @pytest.mark.asyncio
    async def test_ssh_host_key_unique_machine_id(self, db_session) -> None:
        """AC6: Only one host key per machine (unique constraint)."""
        from sqlalchemy.exc import IntegrityError

        from homelab_cmd.db.models.ssh_host_key import SSHHostKey
        from homelab_cmd.db.models.server import Server

        # Create a server
        server = Server(
            id="test-server-2",
            hostname="test-server-2.local",
            tailscale_hostname="test-server-2.tail-abc123.ts.net",
        )
        db_session.add(server)
        await db_session.flush()

        # Create first host key
        host_key1 = SSHHostKey(
            id="host-key-uuid-2a",
            machine_id="test-server-2",
            hostname="test-server-2.tail-abc123.ts.net",
            key_type="ssh-ed25519",
            public_key="AAAAC3NzaC1lZDI1NTE5AAAAIExample1...",
            fingerprint="SHA256:key1",
        )
        db_session.add(host_key1)
        await db_session.commit()

        # Try to create second host key for same machine
        host_key2 = SSHHostKey(
            id="host-key-uuid-2b",
            machine_id="test-server-2",
            hostname="test-server-2.tail-abc123.ts.net",
            key_type="ssh-rsa",
            public_key="AAAAB3NzaC1yc2EAAAADAQABAAAExample2...",
            fingerprint="SHA256:key2",
        )
        db_session.add(host_key2)

        with pytest.raises(IntegrityError):
            await db_session.commit()

    @pytest.mark.asyncio
    async def test_ssh_host_key_timestamps(self, db_session) -> None:
        """AC6: Host key has first_seen and last_seen timestamps."""
        from homelab_cmd.db.models.ssh_host_key import SSHHostKey
        from homelab_cmd.db.models.server import Server

        server = Server(
            id="test-server-3",
            hostname="test-server-3.local",
            tailscale_hostname="test-server-3.tail-abc123.ts.net",
        )
        db_session.add(server)
        await db_session.flush()

        before_create = datetime.now(UTC)

        host_key = SSHHostKey(
            id="host-key-uuid-3",
            machine_id="test-server-3",
            hostname="test-server-3.tail-abc123.ts.net",
            key_type="ssh-ed25519",
            public_key="AAAAC3NzaC1lZDI1NTE5AAAAIExample...",
            fingerprint="SHA256:abc123",
        )
        db_session.add(host_key)
        await db_session.commit()

        after_create = datetime.now(UTC)

        # Timestamps should be set
        assert host_key.first_seen is not None
        assert host_key.last_seen is not None
        # Should be between before and after
        assert before_create <= host_key.first_seen <= after_create
        assert before_create <= host_key.last_seen <= after_create


# =============================================================================
# Phase 2: HostKeyService Tests
# =============================================================================


class TestHostKeyService:
    """Tests for HostKeyService CRUD operations."""

    @pytest.mark.asyncio
    async def test_get_host_key_not_found(self, db_session) -> None:
        """Edge case: Get host key for machine without one returns None."""
        from homelab_cmd.services.host_key_service import HostKeyService

        service = HostKeyService(db_session)
        result = await service.get_host_key("nonexistent-machine")

        assert result is None

    @pytest.mark.asyncio
    async def test_store_host_key(self, db_session) -> None:
        """AC6: Store host key on first connection (TOFU)."""
        from homelab_cmd.db.models.server import Server
        from homelab_cmd.services.host_key_service import HostKeyService

        # Create server
        server = Server(
            id="store-test-server",
            hostname="store-test.local",
            tailscale_hostname="store-test.tail-abc123.ts.net",
        )
        db_session.add(server)
        await db_session.commit()

        service = HostKeyService(db_session)

        await service.store_host_key(
            machine_id="store-test-server",
            hostname="store-test.tail-abc123.ts.net",
            key_type="ssh-ed25519",
            public_key="AAAAC3NzaC1lZDI1NTE5AAAAITest...",
            fingerprint="SHA256:testfingerprint",
        )
        await db_session.commit()

        # Verify stored
        result = await service.get_host_key("store-test-server")
        assert result is not None
        assert result.hostname == "store-test.tail-abc123.ts.net"
        assert result.key_type == "ssh-ed25519"
        assert result.fingerprint == "SHA256:testfingerprint"

    @pytest.mark.asyncio
    async def test_update_last_seen(self, db_session) -> None:
        """AC6: Update last_seen timestamp on successful connection."""
        import asyncio
        from homelab_cmd.db.models.server import Server
        from homelab_cmd.services.host_key_service import HostKeyService

        # Create server
        server = Server(
            id="lastseen-test-server",
            hostname="lastseen-test.local",
            tailscale_hostname="lastseen-test.tail-abc123.ts.net",
        )
        db_session.add(server)
        await db_session.commit()

        service = HostKeyService(db_session)

        # Store initial host key
        await service.store_host_key(
            machine_id="lastseen-test-server",
            hostname="lastseen-test.tail-abc123.ts.net",
            key_type="ssh-ed25519",
            public_key="AAAAC3NzaC1lZDI1NTE5AAAAITest...",
            fingerprint="SHA256:testfingerprint",
        )
        await db_session.commit()

        initial = await service.get_host_key("lastseen-test-server")
        # Convert to naive for comparison (SQLite returns naive datetimes)
        initial_last_seen = initial.last_seen.replace(tzinfo=None) if initial.last_seen.tzinfo else initial.last_seen

        # Small delay to ensure timestamp difference
        await asyncio.sleep(0.01)

        # Update last_seen
        await service.update_last_seen("lastseen-test-server")
        await db_session.commit()

        updated = await service.get_host_key("lastseen-test-server")
        updated_last_seen = updated.last_seen.replace(tzinfo=None) if updated.last_seen.tzinfo else updated.last_seen
        assert updated_last_seen > initial_last_seen

    @pytest.mark.asyncio
    async def test_delete_host_key(self, db_session) -> None:
        """AC6: Delete host key (for accepting new key)."""
        from homelab_cmd.db.models.server import Server
        from homelab_cmd.services.host_key_service import HostKeyService

        # Create server
        server = Server(
            id="delete-test-server",
            hostname="delete-test.local",
            tailscale_hostname="delete-test.tail-abc123.ts.net",
        )
        db_session.add(server)
        await db_session.commit()

        service = HostKeyService(db_session)

        # Store host key
        await service.store_host_key(
            machine_id="delete-test-server",
            hostname="delete-test.tail-abc123.ts.net",
            key_type="ssh-ed25519",
            public_key="AAAAC3NzaC1lZDI1NTE5AAAAITest...",
            fingerprint="SHA256:testfingerprint",
        )
        await db_session.commit()

        # Verify exists
        assert await service.get_host_key("delete-test-server") is not None

        # Delete
        await service.delete_host_key("delete-test-server")
        await db_session.commit()

        # Verify deleted
        assert await service.get_host_key("delete-test-server") is None


# =============================================================================
# Phase 2: SSHPooledExecutor Tests
# =============================================================================


class TestSSHPooledExecutorRetry:
    """Tests for retry logic in SSHPooledExecutor (AC4)."""

    @pytest.mark.asyncio
    async def test_retry_on_connection_timeout(self, db_session) -> None:
        """AC4: Retry up to 3 times on connection timeout."""
        from unittest.mock import MagicMock, patch
        from homelab_cmd.services.ssh_executor import SSHPooledExecutor
        from homelab_cmd.services.host_key_service import HostKeyService
        from homelab_cmd.services.credential_service import CredentialService
        from cryptography.fernet import Fernet
        import socket

        # Setup mocks
        encryption_key = Fernet.generate_key().decode()
        credential_service = CredentialService(db_session, encryption_key)

        # Store SSH key
        await credential_service.store_credential(
            "ssh_private_key",
            "-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----",
        )
        await db_session.commit()

        host_key_service = HostKeyService(db_session)
        executor = SSHPooledExecutor(credential_service, host_key_service)

        with patch("homelab_cmd.services.ssh_executor.paramiko.SSHClient") as mock_client, \
             patch("homelab_cmd.services.ssh_executor.paramiko.Ed25519Key.from_private_key") as mock_key:
            mock_instance = MagicMock()
            mock_client.return_value = mock_instance
            mock_instance.connect.side_effect = socket.timeout("Connection timed out")
            mock_key.return_value = MagicMock()

            result = await executor.test_connection(
                hostname="test.tail-abc123.ts.net",
                username="homelabcmd",
                machine_id="test-machine",
            )

            # Verify 3 attempts were made
            assert mock_instance.connect.call_count == 3
            assert result.success is False
            assert result.attempts == 3
            assert "failed after 3 attempts" in result.error

    @pytest.mark.asyncio
    async def test_no_retry_on_auth_failure(self, db_session) -> None:
        """AC4: Do NOT retry on authentication failure (not transient)."""
        from unittest.mock import MagicMock, patch
        from homelab_cmd.services.ssh_executor import SSHPooledExecutor
        from homelab_cmd.services.host_key_service import HostKeyService
        from homelab_cmd.services.credential_service import CredentialService
        from cryptography.fernet import Fernet
        from paramiko import AuthenticationException

        encryption_key = Fernet.generate_key().decode()
        credential_service = CredentialService(db_session, encryption_key)

        await credential_service.store_credential(
            "ssh_private_key",
            "-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----",
        )
        await db_session.commit()

        host_key_service = HostKeyService(db_session)
        executor = SSHPooledExecutor(credential_service, host_key_service)

        with patch("homelab_cmd.services.ssh_executor.paramiko.SSHClient") as mock_client, \
             patch("homelab_cmd.services.ssh_executor.paramiko.Ed25519Key.from_private_key") as mock_key:
            mock_instance = MagicMock()
            mock_client.return_value = mock_instance
            mock_instance.connect.side_effect = AuthenticationException("Auth failed")
            mock_key.return_value = MagicMock()

            result = await executor.test_connection(
                hostname="test.tail-abc123.ts.net",
                username="homelabcmd",
                machine_id="test-machine",
            )

            # Only 1 attempt (no retry on auth failure)
            assert mock_instance.connect.call_count == 1
            assert result.success is False
            assert "Auth failed" in result.error or "Authentication failed" in result.error


class TestSSHPooledExecutorPool:
    """Tests for connection pooling in SSHPooledExecutor (AC3)."""

    @pytest.mark.asyncio
    async def test_connection_pool_reuse(self, db_session) -> None:
        """AC3: Reuse existing connection within 5-minute TTL."""
        from unittest.mock import MagicMock, patch
        from homelab_cmd.db.models.server import Server
        from homelab_cmd.services.ssh_executor import SSHPooledExecutor
        from homelab_cmd.services.host_key_service import HostKeyService
        from homelab_cmd.services.credential_service import CredentialService
        from cryptography.fernet import Fernet

        # Create server (required for host key storage)
        server = Server(
            id="pool-test-machine",
            hostname="pool-test.local",
            tailscale_hostname="pool-test.tail-abc123.ts.net",
        )
        db_session.add(server)
        await db_session.commit()

        encryption_key = Fernet.generate_key().decode()
        credential_service = CredentialService(db_session, encryption_key)

        await credential_service.store_credential(
            "ssh_private_key",
            "-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----",
        )
        await db_session.commit()

        host_key_service = HostKeyService(db_session)
        executor = SSHPooledExecutor(credential_service, host_key_service)

        with patch("homelab_cmd.services.ssh_executor.paramiko.SSHClient") as mock_client, \
             patch("homelab_cmd.services.ssh_executor.paramiko.Ed25519Key.from_private_key") as mock_key:
            mock_instance = MagicMock()
            mock_client.return_value = mock_instance
            mock_transport = MagicMock()
            mock_instance.get_transport.return_value = mock_transport
            mock_transport.is_active.return_value = True

            # Mock host key with proper string returns
            mock_host_key = MagicMock()
            mock_host_key.get_name.return_value = "ssh-ed25519"
            mock_host_key.asbytes.return_value = b"test-key-bytes"
            mock_host_key.get_base64.return_value = "AAAAC3NzaC1lZDI1NTE5AAAAITest..."
            mock_transport.get_remote_server_key.return_value = mock_host_key

            mock_key.return_value = MagicMock()

            # First connection
            await executor.get_connection(
                hostname="pool-test.tail-abc123.ts.net",
                username="homelabcmd",
                machine_id="pool-test-machine",
            )

            # Second connection (should reuse)
            await executor.get_connection(
                hostname="pool-test.tail-abc123.ts.net",
                username="homelabcmd",
                machine_id="pool-test-machine",
            )

            # Only one connect call (second reused from pool)
            assert mock_instance.connect.call_count == 1

    @pytest.mark.asyncio
    async def test_clear_pool_on_key_change(self, db_session) -> None:
        """AC3: Clear connection pool when SSH key is changed."""
        from unittest.mock import MagicMock
        from homelab_cmd.services.ssh_executor import SSHPooledExecutor
        from homelab_cmd.services.host_key_service import HostKeyService
        from homelab_cmd.services.credential_service import CredentialService
        from cryptography.fernet import Fernet

        encryption_key = Fernet.generate_key().decode()
        credential_service = CredentialService(db_session, encryption_key)

        await credential_service.store_credential(
            "ssh_private_key",
            "-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----",
        )
        await db_session.commit()

        host_key_service = HostKeyService(db_session)
        executor = SSHPooledExecutor(credential_service, host_key_service)

        # Add a mock connection to pool
        mock_conn = MagicMock()
        executor._pool["test-hostname"] = (mock_conn, datetime.now(UTC))

        # Clear pool (called when SSH key changes)
        await executor.clear_pool()

        # Pool should be empty
        assert len(executor._pool) == 0
        # Connection should be closed
        mock_conn.close.assert_called_once()


# =============================================================================
# Phase 3: SSH Settings API Tests
# =============================================================================


class TestSSHSettingsAPI:
    """Tests for SSH settings API endpoints."""

    def test_upload_ssh_key_success(self, client, auth_headers) -> None:
        """AC2: Upload SSH private key stores encrypted value."""
        # Valid RSA key for testing (generated with paramiko)
        ssh_key = """-----BEGIN RSA PRIVATE KEY-----
MIIEpQIBAAKCAQEAtNKa9KP7Il+B6z8QdOgK06wmS3FeBXkP/hVo80UoC5yTSoVz
fuYFTy8opKu+DgaFC4YhKon8kSLCSzcrP4G97D5FREanbyYXOvbfxPkZw2qrMXEJ
CgS30j5Qr1pav0O867QQPMpzAeHwdrdhVDr/mOiNJpkID3wKkw+sDUkgMqHdGDEF
W8nSp7Olebsay48gjlRbTLF9d4vji5p/QvqUSqnK3iK0d4W4U2yrNLmpXe6F+vyY
Lzr4V9uCDp4eX8mHaDYvhfeWDFQS7YjLDQlYYjZRnh2Rtl/A7d+vMdpihfChAskN
LlxY0F5egLxSBIWwr84SCUyUD1ppGFTaIVkovwIDAQABAoIBAD9haL4ickbwmi3W
i5KmuRDL0Rp1kMKzVgc2AvTuQySay8f9seeDgc3pFkJuDm6FG4JYD+0Es9o9iEPs
AQVAGU2i4A2YBF1ByTe6S+ITfFPSYlIwsD3qPHJ9tDNapN9Qw3oMwfpE7f31b591
FLD9AxVaQguK7VfcHyq//gskHBySp3UpqBGVFDmU8gBbslHc8ngiarXBTbHWXc0M
piFznMaXUxsgYlZ3m67VXWgEL4/k6mC1t8X+RmInZd+CVxs64NU1pVqDnMeRUPZO
pKtec99Xv0z1jAuRkTyog/V2Ub97ZlDnZ3Tdty3UxXN42Yo1D4rxoRoYPikvxAKP
AoUwwtUCgYEA6naUj3NwmtECbplJ1jk9+0+5qlJsd4VyvJeLibYGy1Sd3SqGb8gu
Gao4B2MBvMFYrzUk5NRlx/UR0noH+YFP9vIiE301CNLLWNb1eMfzVbA6KCBco4y3
tTvbRPQNYx5Ljw+2uAY8ggu6yjniQp90pglwLc9fxB1v0AfttKIJG90CgYEAxW6p
+0YQe1ZosTht++CB8ULlZJZlDtN6j/0hYlnJTmIgv9UaxFrkTCZOB4cwt0H4wf+h
RyLjXDvUepAN0h3eevUbQJR5yaFO55gl/yDLG3znVPZuR2vXQT8cmMH6w8YzutZO
TSbzynKYefT4wFH21rTdDtbgceTYUyFdPnJxi0sCgYEAtDzr/0qy6ZB62iKkjDX8
29Bx3ej20PqZNTkaX4a6ulwV7wrdxdiQ99HOuH73uu63ChlEf1R32bsfNDnzH260
1hVU9L5vopTJFUZJ9ctf2CNc0bPvAxsNrhiRevRRxjxnwVZHFDhXE3GI6iSNNsH1
nh3rSov8BnrKlZVCunVFo1ECgYEAnJgq0LeA6SLfRPl6Gta2mjKyGbdEDp9kTgK7
UPPgPICOczlG0sk43MFhEI2E8UWtVco5FGAyr3xxColpvOeeCC6S4AUkF+4O1JiU
QqizEGlgXr5bN+DsSb8SIoNxL4jsjNvgHUexBDkigVDxYDFitGeeEmASg6O8hSso
dxh0wMMCgYEAwKzPo/iQTMWcurviWgNRlfVhwN1d0g+k0swqWDrof5dn9Nkoenyw
CmNh4+2EwNPFuhPMlBN07630yaM31yb8FUI2/zQXpo31zkGgM3rAw/onCwjoozyB
pVIPlywp/GtcgYcVZnECUI7BdYsWR+lI9z88+nO2GibqVGGJcKOe4/M=
-----END RSA PRIVATE KEY-----"""

        response = client.post(
            "/api/v1/settings/ssh/key",
            files={"key": ("id_rsa", ssh_key, "application/octet-stream")},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "key_type" in data
        assert "RSA" in data["key_type"]
        assert "fingerprint" in data
        assert data["fingerprint"].startswith("SHA256:")

    def test_upload_ssh_key_invalid_format(self, client, auth_headers) -> None:
        """Edge case: Invalid SSH key format rejected."""
        invalid_key = "not-a-valid-ssh-key"

        response = client.post(
            "/api/v1/settings/ssh/key",
            files={"key": ("invalid_key", invalid_key, "application/octet-stream")},
            headers=auth_headers,
        )

        assert response.status_code == 400
        data = response.json()
        assert data["detail"]["code"] == "INVALID_SSH_KEY"

    def test_delete_ssh_key(self, client, auth_headers) -> None:
        """AC2: Delete SSH key removes encrypted value."""
        response = client.delete(
            "/api/v1/settings/ssh/key",
            headers=auth_headers,
        )

        # Should succeed even if no key exists
        assert response.status_code == 200

    def test_get_ssh_status_no_key(self, client, auth_headers) -> None:
        """Edge case: Status shows no key configured."""
        response = client.get(
            "/api/v1/settings/ssh/status",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["configured"] is False

    def test_update_ssh_username(self, client, auth_headers) -> None:
        """AC1: Update default SSH username."""
        response = client.put(
            "/api/v1/settings/ssh/username",
            json={"username": "homelabcmd"},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True


class TestSSHTestConnectionAPI:
    """Tests for test-ssh endpoint (AC5)."""

    def test_test_ssh_no_key_configured(self, client, auth_headers) -> None:
        """Edge case: Test SSH without key configured returns error."""
        # Create a server via Tailscale import (which sets tailscale_hostname)
        import_response = client.post(
            "/api/v1/tailscale/import",
            json={
                "tailscale_hostname": "ssh-test.tail-abc123.ts.net",
                "tailscale_device_id": "test-device-123",
                "tailscale_ip": "100.64.0.1",
                "os": "linux",
                "display_name": "SSH Test Server",
            },
            headers=auth_headers,
        )
        assert import_response.status_code == 201

        response = client.post(
            "/api/v1/servers/ssh-test/test-ssh",
            headers=auth_headers,
        )

        assert response.status_code == 400
        data = response.json()
        assert data["detail"]["code"] == "NO_SSH_KEY"

    def test_test_ssh_no_tailscale_hostname(self, client, auth_headers, create_server) -> None:
        """Edge case: Test SSH on machine without Tailscale hostname."""
        # Create server without Tailscale hostname
        create_server(
            client,
            auth_headers,
            "no-tailscale-server",
        )

        response = client.post(
            "/api/v1/servers/no-tailscale-server/test-ssh",
            headers=auth_headers,
        )

        assert response.status_code == 400
        data = response.json()
        assert data["detail"]["code"] == "NO_TAILSCALE_HOSTNAME"


# =============================================================================
# Phase 2: Host Key Verification Tests (AC6)
# =============================================================================


class TestHostKeyVerification:
    """Tests for host key verification (AC6)."""

    @pytest.mark.asyncio
    async def test_host_key_stored_on_first_connection(self, db_session) -> None:
        """AC6: Host key stored on first connection (TOFU)."""
        from unittest.mock import MagicMock, patch
        from homelab_cmd.db.models.server import Server
        from homelab_cmd.services.ssh_executor import SSHPooledExecutor
        from homelab_cmd.services.host_key_service import HostKeyService
        from homelab_cmd.services.credential_service import CredentialService
        from cryptography.fernet import Fernet

        # Create server
        server = Server(
            id="tofu-test-server",
            hostname="tofu-test.local",
            tailscale_hostname="tofu-test.tail-abc123.ts.net",
        )
        db_session.add(server)
        await db_session.commit()

        encryption_key = Fernet.generate_key().decode()
        credential_service = CredentialService(db_session, encryption_key)

        await credential_service.store_credential(
            "ssh_private_key",
            "-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----",
        )
        await db_session.commit()

        host_key_service = HostKeyService(db_session)
        executor = SSHPooledExecutor(credential_service, host_key_service)

        with patch("homelab_cmd.services.ssh_executor.paramiko.SSHClient") as mock_client, \
             patch("homelab_cmd.services.ssh_executor.paramiko.Ed25519Key.from_private_key") as mock_key:
            mock_instance = MagicMock()
            mock_client.return_value = mock_instance
            mock_transport = MagicMock()
            mock_instance.get_transport.return_value = mock_transport
            mock_transport.is_active.return_value = True

            # Mock host key
            mock_host_key = MagicMock()
            mock_host_key.get_name.return_value = "ssh-ed25519"
            mock_host_key.asbytes.return_value = b"test-key-bytes"
            mock_host_key.get_base64.return_value = "AAAAC3NzaC1lZDI1NTE5AAAA..."
            mock_transport.get_remote_server_key.return_value = mock_host_key

            mock_key.return_value = MagicMock()

            # Connect (first time)
            await executor.get_connection(
                hostname="tofu-test.tail-abc123.ts.net",
                username="homelabcmd",
                machine_id="tofu-test-server",
            )

        # Verify host key was stored
        stored_key = await host_key_service.get_host_key("tofu-test-server")
        assert stored_key is not None
        assert stored_key.key_type == "ssh-ed25519"

    @pytest.mark.asyncio
    async def test_host_key_change_detected(self, db_session) -> None:
        """AC6: Host key change detected and error raised."""
        from unittest.mock import MagicMock, patch
        from homelab_cmd.db.models.server import Server
        from homelab_cmd.services.ssh_executor import SSHPooledExecutor, HostKeyChangedError
        from homelab_cmd.services.host_key_service import HostKeyService
        from homelab_cmd.services.credential_service import CredentialService
        from cryptography.fernet import Fernet

        # Create server
        server = Server(
            id="keychange-test-server",
            hostname="keychange-test.local",
            tailscale_hostname="keychange-test.tail-abc123.ts.net",
        )
        db_session.add(server)
        await db_session.commit()

        encryption_key = Fernet.generate_key().decode()
        credential_service = CredentialService(db_session, encryption_key)

        await credential_service.store_credential(
            "ssh_private_key",
            "-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----",
        )
        await db_session.commit()

        host_key_service = HostKeyService(db_session)

        # Store original host key
        await host_key_service.store_host_key(
            machine_id="keychange-test-server",
            hostname="keychange-test.tail-abc123.ts.net",
            key_type="ssh-ed25519",
            public_key="AAAAC3NzaC1lZDI1NTE5AAAAIOldKey...",
            fingerprint="SHA256:old-fingerprint",
        )
        await db_session.commit()

        executor = SSHPooledExecutor(credential_service, host_key_service)

        with patch("homelab_cmd.services.ssh_executor.paramiko.SSHClient") as mock_client, \
             patch("homelab_cmd.services.ssh_executor.paramiko.Ed25519Key.from_private_key") as mock_key:
            mock_instance = MagicMock()
            mock_client.return_value = mock_instance
            mock_transport = MagicMock()
            mock_instance.get_transport.return_value = mock_transport

            mock_host_key = MagicMock()
            mock_host_key.get_name.return_value = "ssh-ed25519"
            mock_host_key.asbytes.return_value = b"different-key-bytes"
            mock_host_key.get_base64.return_value = "AAAAC3NzaC1lZDI1NTE5AAAAInewKey..."
            mock_transport.get_remote_server_key.return_value = mock_host_key

            mock_key.return_value = MagicMock()

            # Should raise HostKeyChangedError
            with pytest.raises(HostKeyChangedError) as exc_info:
                await executor.get_connection(
                    hostname="keychange-test.tail-abc123.ts.net",
                    username="homelabcmd",
                    machine_id="keychange-test-server",
                )

            assert exc_info.value.hostname == "keychange-test.tail-abc123.ts.net"
            assert exc_info.value.old_fingerprint == "SHA256:old-fingerprint"
