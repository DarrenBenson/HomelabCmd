"""Unit tests for SSHPooledExecutor service methods.

Part of EP0008: Tailscale Integration (US0079).
Extended by EP0013: Synchronous Command Execution (US0151).

These tests cover service layer methods that need additional coverage:
- _load_file_based_key
- _load_private_key
- _compute_fingerprint
- _connect_sync
- get_connection
- test_connection
- clear_pool
- close
"""

import tempfile
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from paramiko import AuthenticationException, SSHException

from homelab_cmd.services.ssh_executor import (
    HostKeyChangedError,
    SSHAuthenticationError,
    SSHConnectionError,
    SSHKeyNotConfiguredError,
    SSHPooledExecutor,
    SSHTestResult,
)


@pytest.fixture
def mock_credential_service():
    """Create mock credential service."""
    service = MagicMock()
    service.get_credential = AsyncMock(return_value=None)
    return service


@pytest.fixture
def mock_host_key_service():
    """Create mock host key service."""
    service = MagicMock()
    service.get_host_key = AsyncMock(return_value=None)
    service.store_host_key = AsyncMock()
    service.update_last_seen = AsyncMock()
    return service


@pytest.fixture
def executor(mock_credential_service, mock_host_key_service):
    """Create SSH executor with mocked dependencies."""
    return SSHPooledExecutor(mock_credential_service, mock_host_key_service)


class TestSSHExceptions:
    """Tests for custom SSH exception classes."""

    def test_ssh_key_not_configured_default_message(self):
        """Test SSHKeyNotConfiguredError has default message."""
        error = SSHKeyNotConfiguredError()
        assert "SSH key" in str(error)
        assert "Settings" in str(error)

    def test_ssh_key_not_configured_custom_message(self):
        """Test SSHKeyNotConfiguredError accepts custom message."""
        error = SSHKeyNotConfiguredError("Custom message")
        assert "Custom message" in str(error)

    def test_ssh_connection_error_message(self):
        """Test SSHConnectionError formats message correctly."""
        error = SSHConnectionError(
            hostname="test.local",
            last_error=OSError("Connection refused"),
            attempts=3,
        )
        assert "test.local" in str(error)
        assert "3 attempts" in str(error)
        assert "Connection refused" in str(error)

    def test_ssh_connection_error_without_last_error(self):
        """Test SSHConnectionError handles None last_error."""
        error = SSHConnectionError(
            hostname="test.local",
            last_error=None,
            attempts=3,
        )
        assert "test.local" in str(error)
        assert "3 attempts" in str(error)

    def test_ssh_authentication_error_default(self):
        """Test SSHAuthenticationError default message."""
        error = SSHAuthenticationError(hostname="test.local", username="admin")
        assert "test.local" in str(error)
        assert "admin" in str(error)
        assert "Authentication failed" in str(error)

    def test_ssh_authentication_error_custom_message(self):
        """Test SSHAuthenticationError custom message."""
        error = SSHAuthenticationError(
            hostname="test.local", username="admin", message="Invalid key"
        )
        assert "Invalid key" in str(error)

    def test_host_key_changed_error(self):
        """Test HostKeyChangedError message includes fingerprints."""
        error = HostKeyChangedError(
            hostname="test.local",
            old_fingerprint="SHA256:old",
            new_fingerprint="SHA256:new",
        )
        assert "test.local" in str(error)
        assert "SHA256:old" in str(error)
        assert "SHA256:new" in str(error)
        assert "man-in-the-middle" in str(error).lower()


class TestComputeFingerprint:
    """Tests for _compute_fingerprint method."""

    def test_compute_fingerprint_format(self, executor):
        """Test fingerprint has SHA256: prefix and base64 encoding."""
        key_bytes = b"test-key-data"
        fingerprint = executor._compute_fingerprint(key_bytes)

        assert fingerprint.startswith("SHA256:")
        # Should be base64 without padding
        assert "=" not in fingerprint

    def test_compute_fingerprint_deterministic(self, executor):
        """Test fingerprint is deterministic for same input."""
        key_bytes = b"consistent-key"
        fp1 = executor._compute_fingerprint(key_bytes)
        fp2 = executor._compute_fingerprint(key_bytes)

        assert fp1 == fp2

    def test_compute_fingerprint_different_for_different_keys(self, executor):
        """Test different keys produce different fingerprints."""
        fp1 = executor._compute_fingerprint(b"key1")
        fp2 = executor._compute_fingerprint(b"key2")

        assert fp1 != fp2


class TestLoadPrivateKey:
    """Tests for _load_private_key method."""

    def test_load_rsa_key(self, executor):
        """Test loading RSA private key."""
        # Generate a simple RSA key for testing
        with patch("homelab_cmd.services.ssh_executor.paramiko.RSAKey") as mock_rsa:
            mock_key = MagicMock()
            mock_rsa.from_private_key.return_value = mock_key

            # Ed25519 fails, RSA succeeds
            with patch(
                "homelab_cmd.services.ssh_executor.paramiko.Ed25519Key"
            ) as mock_ed:
                mock_ed.from_private_key.side_effect = SSHException("Not Ed25519")

                result = executor._load_private_key("fake-key-content")

                assert result == mock_key

    def test_load_ed25519_key(self, executor):
        """Test loading Ed25519 private key."""
        with patch(
            "homelab_cmd.services.ssh_executor.paramiko.Ed25519Key"
        ) as mock_ed:
            mock_key = MagicMock()
            mock_ed.from_private_key.return_value = mock_key

            result = executor._load_private_key("fake-key-content")

            assert result == mock_key

    def test_load_ecdsa_key(self, executor):
        """Test loading ECDSA private key."""
        with patch(
            "homelab_cmd.services.ssh_executor.paramiko.Ed25519Key"
        ) as mock_ed:
            mock_ed.from_private_key.side_effect = SSHException("Not Ed25519")

            with patch(
                "homelab_cmd.services.ssh_executor.paramiko.RSAKey"
            ) as mock_rsa:
                mock_rsa.from_private_key.side_effect = SSHException("Not RSA")

                with patch(
                    "homelab_cmd.services.ssh_executor.paramiko.ECDSAKey"
                ) as mock_ecdsa:
                    mock_key = MagicMock()
                    mock_ecdsa.from_private_key.return_value = mock_key

                    result = executor._load_private_key("fake-key-content")

                    assert result == mock_key

    def test_load_unsupported_key_raises(self, executor):
        """Test unsupported key format raises SSHException."""
        with patch(
            "homelab_cmd.services.ssh_executor.paramiko.Ed25519Key"
        ) as mock_ed:
            mock_ed.from_private_key.side_effect = SSHException("Not Ed25519")

            with patch(
                "homelab_cmd.services.ssh_executor.paramiko.RSAKey"
            ) as mock_rsa:
                mock_rsa.from_private_key.side_effect = SSHException("Not RSA")

                with patch(
                    "homelab_cmd.services.ssh_executor.paramiko.ECDSAKey"
                ) as mock_ecdsa:
                    mock_ecdsa.from_private_key.side_effect = SSHException("Not ECDSA")

                    with pytest.raises(SSHException, match="unsupported format"):
                        executor._load_private_key("bad-key")


class TestLoadFileBasedKey:
    """Tests for _load_file_based_key method."""

    def test_load_file_based_key_path_not_exists(self, executor):
        """Test returns None when SSH key path doesn't exist."""
        with patch("homelab_cmd.config.get_settings") as mock_settings:
            mock_settings.return_value.ssh_key_path = "/nonexistent/path"

            result = executor._load_file_based_key()

            assert result is None

    def test_load_file_based_key_ed25519(self, executor):
        """Test loading Ed25519 key from file."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            key_path = Path(tmp_dir)
            key_file = key_path / "id_ed25519"
            key_file.write_text("fake-key-content")

            with patch("homelab_cmd.config.get_settings") as mock_settings:
                mock_settings.return_value.ssh_key_path = str(key_path)

                with patch(
                    "homelab_cmd.services.ssh_executor.paramiko.RSAKey"
                ) as mock_rsa:
                    mock_rsa.from_private_key_file.side_effect = SSHException("Not RSA")

                    with patch(
                        "homelab_cmd.services.ssh_executor.paramiko.Ed25519Key"
                    ) as mock_ed:
                        mock_key = MagicMock()
                        mock_ed.from_private_key_file.return_value = mock_key

                        result = executor._load_file_based_key()

                        assert result == mock_key

    def test_load_file_based_key_rsa(self, executor):
        """Test loading RSA key from file."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            key_path = Path(tmp_dir)
            key_file = key_path / "id_rsa"
            key_file.write_text("fake-key-content")

            with patch("homelab_cmd.config.get_settings") as mock_settings:
                mock_settings.return_value.ssh_key_path = str(key_path)

                with patch(
                    "homelab_cmd.services.ssh_executor.paramiko.RSAKey"
                ) as mock_rsa:
                    mock_key = MagicMock()
                    mock_rsa.from_private_key_file.return_value = mock_key

                    result = executor._load_file_based_key()

                    assert result == mock_key

    def test_load_file_based_key_ecdsa(self, executor):
        """Test loading ECDSA key from file."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            key_path = Path(tmp_dir)
            key_file = key_path / "id_ecdsa"
            key_file.write_text("fake-key-content")

            with patch("homelab_cmd.config.get_settings") as mock_settings:
                mock_settings.return_value.ssh_key_path = str(key_path)

                with patch(
                    "homelab_cmd.services.ssh_executor.paramiko.RSAKey"
                ) as mock_rsa:
                    mock_rsa.from_private_key_file.side_effect = SSHException("Not RSA")

                    with patch(
                        "homelab_cmd.services.ssh_executor.paramiko.Ed25519Key"
                    ) as mock_ed:
                        mock_ed.from_private_key_file.side_effect = SSHException(
                            "Not Ed25519"
                        )

                        with patch(
                            "homelab_cmd.services.ssh_executor.paramiko.ECDSAKey"
                        ) as mock_ecdsa:
                            mock_key = MagicMock()
                            mock_ecdsa.from_private_key_file.return_value = mock_key

                            result = executor._load_file_based_key()

                            assert result == mock_key

    def test_load_file_based_key_tries_glob_pattern(self, executor):
        """Test tries id_* glob pattern for key files."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            key_path = Path(tmp_dir)
            # Create a non-standard key file
            key_file = key_path / "id_custom"
            key_file.write_text("fake-key-content")

            with patch("homelab_cmd.config.get_settings") as mock_settings:
                mock_settings.return_value.ssh_key_path = str(key_path)

                with patch(
                    "homelab_cmd.services.ssh_executor.paramiko.Ed25519Key"
                ) as mock_ed:
                    mock_key = MagicMock()
                    mock_ed.from_private_key_file.return_value = mock_key

                    result = executor._load_file_based_key()

                    assert result == mock_key

    def test_load_file_based_key_skips_pub_files(self, executor):
        """Test skips .pub files in glob."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            key_path = Path(tmp_dir)
            pub_file = key_path / "id_rsa.pub"
            pub_file.write_text("public key")

            with patch("homelab_cmd.config.get_settings") as mock_settings:
                mock_settings.return_value.ssh_key_path = str(key_path)

                result = executor._load_file_based_key()

                # Should return None because only .pub file exists
                assert result is None

    def test_load_file_based_key_no_valid_key(self, executor):
        """Test returns None when no valid key found."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            key_path = Path(tmp_dir)
            key_file = key_path / "id_ed25519"
            key_file.write_text("invalid-key")

            with patch("homelab_cmd.config.get_settings") as mock_settings:
                mock_settings.return_value.ssh_key_path = str(key_path)

                with patch(
                    "homelab_cmd.services.ssh_executor.paramiko.RSAKey"
                ) as mock_rsa:
                    mock_rsa.from_private_key_file.side_effect = SSHException("Invalid")

                    with patch(
                        "homelab_cmd.services.ssh_executor.paramiko.Ed25519Key"
                    ) as mock_ed:
                        mock_ed.from_private_key_file.side_effect = SSHException(
                            "Invalid"
                        )

                        with patch(
                            "homelab_cmd.services.ssh_executor.paramiko.ECDSAKey"
                        ) as mock_ecdsa:
                            mock_ecdsa.from_private_key_file.side_effect = SSHException(
                                "Invalid"
                            )

                            result = executor._load_file_based_key()

                            assert result is None


class TestConnectSync:
    """Tests for _connect_sync method."""

    def test_connect_sync_basic(self, executor):
        """Test basic synchronous connection."""
        mock_pkey = MagicMock()

        with patch("homelab_cmd.services.ssh_executor.paramiko.SSHClient") as mock_ssh:
            mock_client = MagicMock()
            mock_transport = MagicMock()
            mock_server_key = MagicMock()
            mock_server_key.asbytes.return_value = b"key-bytes"
            mock_server_key.get_name.return_value = "ssh-rsa"
            mock_server_key.get_base64.return_value = "base64key"
            mock_transport.get_remote_server_key.return_value = mock_server_key
            mock_client.get_transport.return_value = mock_transport
            mock_ssh.return_value = mock_client

            result = executor._connect_sync(
                hostname="test.local",
                username="admin",
                pkey=mock_pkey,
                stored_host_key=None,
                machine_id="machine-1",
            )

            assert result == mock_client
            mock_client.connect.assert_called_once()

    def test_connect_sync_verifies_stored_host_key(self, executor):
        """Test connection verifies against stored host key."""
        mock_pkey = MagicMock()
        mock_stored_key = MagicMock()
        mock_stored_key.fingerprint = "SHA256:expected"

        with patch("homelab_cmd.services.ssh_executor.paramiko.SSHClient") as mock_ssh:
            mock_client = MagicMock()
            mock_transport = MagicMock()
            mock_server_key = MagicMock()
            # Create key that matches expected fingerprint
            mock_server_key.asbytes.return_value = b"key-bytes"
            mock_transport.get_remote_server_key.return_value = mock_server_key
            mock_client.get_transport.return_value = mock_transport
            mock_ssh.return_value = mock_client

            # Compute actual fingerprint and set expected
            actual_fp = executor._compute_fingerprint(b"key-bytes")
            mock_stored_key.fingerprint = actual_fp

            result = executor._connect_sync(
                hostname="test.local",
                username="admin",
                pkey=mock_pkey,
                stored_host_key=mock_stored_key,
                machine_id="machine-1",
            )

            assert result == mock_client

    def test_connect_sync_host_key_changed_raises(self, executor):
        """Test raises HostKeyChangedError when host key changes."""
        mock_pkey = MagicMock()
        mock_stored_key = MagicMock()
        mock_stored_key.fingerprint = "SHA256:old-fingerprint"

        with patch("homelab_cmd.services.ssh_executor.paramiko.SSHClient") as mock_ssh:
            mock_client = MagicMock()
            mock_transport = MagicMock()
            mock_server_key = MagicMock()
            mock_server_key.asbytes.return_value = b"new-key-bytes"
            mock_transport.get_remote_server_key.return_value = mock_server_key
            mock_client.get_transport.return_value = mock_transport
            mock_ssh.return_value = mock_client

            with pytest.raises(HostKeyChangedError):
                executor._connect_sync(
                    hostname="test.local",
                    username="admin",
                    pkey=mock_pkey,
                    stored_host_key=mock_stored_key,
                    machine_id="machine-1",
                )


class TestGetConnection:
    """Tests for get_connection method."""

    @pytest.mark.asyncio
    async def test_get_connection_reuses_pooled(
        self, executor, mock_credential_service
    ):
        """Test reuses connection from pool if valid."""
        mock_client = MagicMock()
        mock_transport = MagicMock()
        mock_transport.is_active.return_value = True
        mock_client.get_transport.return_value = mock_transport

        # Add to pool
        executor._pool["test.local"] = (
            mock_client,
            datetime.now(UTC) + timedelta(minutes=5),
        )

        result = await executor.get_connection("test.local", "admin", "machine-1")

        assert result == mock_client

    @pytest.mark.asyncio
    async def test_get_connection_expired_creates_new(
        self, executor, mock_credential_service, mock_host_key_service
    ):
        """Test creates new connection when pooled is expired."""
        mock_old_client = MagicMock()
        # Add expired connection
        executor._pool["test.local"] = (
            mock_old_client,
            datetime.now(UTC) - timedelta(minutes=1),
        )

        mock_credential_service.get_credential.return_value = "ssh-key-content"

        mock_new_client = MagicMock()
        mock_transport = MagicMock()
        mock_server_key = MagicMock()
        mock_server_key.asbytes.return_value = b"key"
        mock_server_key.get_name.return_value = "ssh-rsa"
        mock_server_key.get_base64.return_value = "base64"
        mock_transport.get_remote_server_key.return_value = mock_server_key
        mock_new_client.get_transport.return_value = mock_transport

        with patch.object(
            executor, "_load_private_key", return_value=MagicMock()
        ):
            with patch.object(executor, "_connect_sync", return_value=mock_new_client):
                result = await executor.get_connection(
                    "test.local", "admin", "machine-1"
                )

                assert result == mock_new_client
                mock_old_client.close.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_connection_inactive_creates_new(
        self, executor, mock_credential_service, mock_host_key_service
    ):
        """Test creates new connection when pooled is inactive."""
        mock_old_client = MagicMock()
        mock_transport = MagicMock()
        mock_transport.is_active.return_value = False
        mock_old_client.get_transport.return_value = mock_transport

        executor._pool["test.local"] = (
            mock_old_client,
            datetime.now(UTC) + timedelta(minutes=5),
        )

        mock_credential_service.get_credential.return_value = "ssh-key-content"

        mock_new_client = MagicMock()
        mock_new_transport = MagicMock()
        mock_server_key = MagicMock()
        mock_server_key.asbytes.return_value = b"key"
        mock_server_key.get_name.return_value = "ssh-rsa"
        mock_server_key.get_base64.return_value = "base64"
        mock_new_transport.get_remote_server_key.return_value = mock_server_key
        mock_new_client.get_transport.return_value = mock_new_transport

        with patch.object(
            executor, "_load_private_key", return_value=MagicMock()
        ):
            with patch.object(executor, "_connect_sync", return_value=mock_new_client):
                result = await executor.get_connection(
                    "test.local", "admin", "machine-1"
                )

                assert result == mock_new_client

    @pytest.mark.asyncio
    async def test_get_connection_no_key_raises(
        self, executor, mock_credential_service
    ):
        """Test raises SSHKeyNotConfiguredError when no key available."""
        mock_credential_service.get_credential.return_value = None

        with patch.object(executor, "_load_file_based_key", return_value=None):
            with pytest.raises(SSHKeyNotConfiguredError):
                await executor.get_connection("test.local", "admin", "machine-1")

    @pytest.mark.asyncio
    async def test_get_connection_uses_file_based_fallback(
        self, executor, mock_credential_service, mock_host_key_service
    ):
        """Test falls back to file-based keys."""
        mock_credential_service.get_credential.return_value = None

        mock_pkey = MagicMock()
        mock_client = MagicMock()
        mock_transport = MagicMock()
        mock_server_key = MagicMock()
        mock_server_key.asbytes.return_value = b"key"
        mock_server_key.get_name.return_value = "ssh-rsa"
        mock_server_key.get_base64.return_value = "base64"
        mock_transport.get_remote_server_key.return_value = mock_server_key
        mock_client.get_transport.return_value = mock_transport

        with patch.object(executor, "_load_file_based_key", return_value=mock_pkey):
            with patch.object(executor, "_connect_sync", return_value=mock_client):
                result = await executor.get_connection(
                    "test.local", "admin", "machine-1"
                )

                assert result == mock_client

    @pytest.mark.asyncio
    async def test_get_connection_retries_on_transient_error(
        self, executor, mock_credential_service, mock_host_key_service
    ):
        """Test retries on transient connection errors."""
        mock_credential_service.get_credential.return_value = "ssh-key-content"

        mock_client = MagicMock()
        mock_transport = MagicMock()
        mock_server_key = MagicMock()
        mock_server_key.asbytes.return_value = b"key"
        mock_server_key.get_name.return_value = "ssh-rsa"
        mock_server_key.get_base64.return_value = "base64"
        mock_transport.get_remote_server_key.return_value = mock_server_key
        mock_client.get_transport.return_value = mock_transport

        call_count = 0

        def connect_side_effect(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise SSHException("Connection reset")
            return mock_client

        with patch.object(
            executor, "_load_private_key", return_value=MagicMock()
        ):
            with patch.object(
                executor, "_connect_sync", side_effect=connect_side_effect
            ):
                with patch("asyncio.sleep", new_callable=AsyncMock):
                    result = await executor.get_connection(
                        "test.local", "admin", "machine-1"
                    )

                    assert result == mock_client
                    assert call_count == 3

    @pytest.mark.asyncio
    async def test_get_connection_raises_after_max_retries(
        self, executor, mock_credential_service
    ):
        """Test raises SSHConnectionError after max retries."""
        mock_credential_service.get_credential.return_value = "ssh-key-content"

        with patch.object(
            executor, "_load_private_key", return_value=MagicMock()
        ):
            with patch.object(
                executor,
                "_connect_sync",
                side_effect=SSHException("Connection refused"),
            ):
                with patch("asyncio.sleep", new_callable=AsyncMock):
                    with pytest.raises(SSHConnectionError) as exc_info:
                        await executor.get_connection(
                            "test.local", "admin", "machine-1"
                        )

                    assert exc_info.value.attempts == 3

    @pytest.mark.asyncio
    async def test_get_connection_no_retry_on_auth_failure(
        self, executor, mock_credential_service
    ):
        """Test does not retry on authentication failure."""
        mock_credential_service.get_credential.return_value = "ssh-key-content"

        with patch.object(
            executor, "_load_private_key", return_value=MagicMock()
        ):
            with patch.object(
                executor,
                "_connect_sync",
                side_effect=AuthenticationException("Invalid key"),
            ):
                with pytest.raises(SSHAuthenticationError):
                    await executor.get_connection(
                        "test.local", "admin", "machine-1"
                    )

    @pytest.mark.asyncio
    async def test_get_connection_no_retry_on_host_key_change(
        self, executor, mock_credential_service
    ):
        """Test does not retry on host key change."""
        mock_credential_service.get_credential.return_value = "ssh-key-content"

        with patch.object(
            executor, "_load_private_key", return_value=MagicMock()
        ):
            with patch.object(
                executor,
                "_connect_sync",
                side_effect=HostKeyChangedError("test", "old", "new"),
            ):
                with pytest.raises(HostKeyChangedError):
                    await executor.get_connection(
                        "test.local", "admin", "machine-1"
                    )

    @pytest.mark.asyncio
    async def test_get_connection_stores_host_key_on_first_connect(
        self, executor, mock_credential_service, mock_host_key_service
    ):
        """Test stores host key on first connection (TOFU)."""
        mock_credential_service.get_credential.return_value = "ssh-key-content"
        mock_host_key_service.get_host_key.return_value = None  # No stored key

        mock_client = MagicMock()
        mock_transport = MagicMock()
        mock_server_key = MagicMock()
        mock_server_key.asbytes.return_value = b"key"
        mock_server_key.get_name.return_value = "ssh-rsa"
        mock_server_key.get_base64.return_value = "base64key"
        mock_transport.get_remote_server_key.return_value = mock_server_key
        mock_client.get_transport.return_value = mock_transport

        with patch.object(
            executor, "_load_private_key", return_value=MagicMock()
        ):
            with patch.object(executor, "_connect_sync", return_value=mock_client):
                await executor.get_connection("test.local", "admin", "machine-1")

                mock_host_key_service.store_host_key.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_connection_updates_last_seen(
        self, executor, mock_credential_service, mock_host_key_service
    ):
        """Test updates last_seen on subsequent connections."""
        mock_credential_service.get_credential.return_value = "ssh-key-content"

        mock_stored_key = MagicMock()
        mock_stored_key.fingerprint = "SHA256:test"
        mock_host_key_service.get_host_key.return_value = mock_stored_key

        mock_client = MagicMock()
        mock_transport = MagicMock()
        mock_server_key = MagicMock()
        # Match the fingerprint
        key_bytes = b"key"
        mock_server_key.asbytes.return_value = key_bytes
        mock_stored_key.fingerprint = executor._compute_fingerprint(key_bytes)
        mock_transport.get_remote_server_key.return_value = mock_server_key
        mock_client.get_transport.return_value = mock_transport

        with patch.object(
            executor, "_load_private_key", return_value=MagicMock()
        ):
            with patch.object(executor, "_connect_sync", return_value=mock_client):
                await executor.get_connection("test.local", "admin", "machine-1")

                mock_host_key_service.update_last_seen.assert_called_once_with(
                    "machine-1"
                )


class TestTestConnection:
    """Tests for test_connection method."""

    @pytest.mark.asyncio
    async def test_test_connection_success(
        self, executor, mock_credential_service, mock_host_key_service
    ):
        """Test successful connection test."""
        mock_credential_service.get_credential.return_value = "ssh-key-content"

        mock_client = MagicMock()
        mock_transport = MagicMock()
        mock_server_key = MagicMock()
        mock_server_key.asbytes.return_value = b"key"
        mock_server_key.get_name.return_value = "ssh-rsa"
        mock_server_key.get_base64.return_value = "base64"
        mock_transport.get_remote_server_key.return_value = mock_server_key
        mock_client.get_transport.return_value = mock_transport

        with patch.object(
            executor, "_load_private_key", return_value=MagicMock()
        ):
            with patch.object(executor, "_connect_sync", return_value=mock_client):
                result = await executor.test_connection(
                    "test.local", "admin", "machine-1"
                )

                assert isinstance(result, SSHTestResult)
                assert result.success is True
                assert result.hostname == "test.local"
                assert result.latency_ms is not None
                assert result.host_key_fingerprint is not None

    @pytest.mark.asyncio
    async def test_test_connection_no_key(
        self, executor, mock_credential_service
    ):
        """Test connection test with no SSH key."""
        mock_credential_service.get_credential.return_value = None

        result = await executor.test_connection("test.local", "admin", "machine-1")

        assert result.success is False
        assert "SSH key" in result.error

    @pytest.mark.asyncio
    async def test_test_connection_auth_failure(
        self, executor, mock_credential_service
    ):
        """Test connection test with auth failure."""
        mock_credential_service.get_credential.return_value = "ssh-key-content"

        with patch.object(
            executor, "_load_private_key", return_value=MagicMock()
        ):
            with patch.object(
                executor,
                "_connect_sync",
                side_effect=AuthenticationException("Invalid key"),
            ):
                result = await executor.test_connection(
                    "test.local", "admin", "machine-1"
                )

                assert result.success is False
                # Error message comes from SSHAuthenticationError which includes hostname
                assert result.error is not None

    @pytest.mark.asyncio
    async def test_test_connection_connection_failure(
        self, executor, mock_credential_service
    ):
        """Test connection test with connection failure."""
        mock_credential_service.get_credential.return_value = "ssh-key-content"

        with patch.object(
            executor, "_load_private_key", return_value=MagicMock()
        ):
            with patch.object(
                executor,
                "_connect_sync",
                side_effect=SSHException("Connection refused"),
            ):
                with patch("asyncio.sleep", new_callable=AsyncMock):
                    result = await executor.test_connection(
                        "test.local", "admin", "machine-1"
                    )

                    assert result.success is False
                    assert result.attempts == 3

    @pytest.mark.asyncio
    async def test_test_connection_host_key_changed(
        self, executor, mock_credential_service
    ):
        """Test connection test with host key changed."""
        mock_credential_service.get_credential.return_value = "ssh-key-content"

        with patch.object(
            executor, "_load_private_key", return_value=MagicMock()
        ):
            with patch.object(
                executor,
                "_connect_sync",
                side_effect=HostKeyChangedError("test", "old", "new"),
            ):
                result = await executor.test_connection(
                    "test.local", "admin", "machine-1"
                )

                assert result.success is False
                assert "key" in result.error.lower()


class TestClearPool:
    """Tests for clear_pool method."""

    @pytest.mark.asyncio
    async def test_clear_pool_closes_connections(self, executor):
        """Test clear_pool closes all pooled connections."""
        mock_client1 = MagicMock()
        mock_client2 = MagicMock()

        executor._pool = {
            "host1": (mock_client1, datetime.now(UTC)),
            "host2": (mock_client2, datetime.now(UTC)),
        }

        await executor.clear_pool()

        mock_client1.close.assert_called_once()
        mock_client2.close.assert_called_once()
        assert len(executor._pool) == 0

    @pytest.mark.asyncio
    async def test_clear_pool_handles_close_exception(self, executor):
        """Test clear_pool handles exceptions during close."""
        mock_client = MagicMock()
        mock_client.close.side_effect = RuntimeError("Close failed")

        executor._pool = {"host": (mock_client, datetime.now(UTC))}

        # Should not raise
        await executor.clear_pool()

        assert len(executor._pool) == 0


class TestClose:
    """Tests for close method."""

    @pytest.mark.asyncio
    async def test_close_clears_pool(self, executor):
        """Test close clears the connection pool."""
        mock_client = MagicMock()
        executor._pool = {"host": (mock_client, datetime.now(UTC))}

        await executor.close()

        assert len(executor._pool) == 0
        mock_client.close.assert_called_once()


class TestExecuteCommandSync:
    """Tests for _execute_command_sync method."""

    def test_execute_command_sync_success(self, executor):
        """Test synchronous command execution."""
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.read.return_value = b"output"
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        result = executor._execute_command_sync(mock_client, "echo test")

        assert result["exit_code"] == 0
        assert result["stdout"] == "output"
        assert result["stderr"] == ""

    def test_execute_command_sync_limits_output(self, executor):
        """Test output is limited to 10KB."""
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.read.return_value = b"x" * (10 * 1024)
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        executor._execute_command_sync(mock_client, "test")

        # Verify read was called with limit
        mock_stdout.read.assert_called_with(10 * 1024)
        mock_stderr.read.assert_called_with(10 * 1024)

    def test_execute_command_sync_handles_unicode_errors(self, executor):
        """Test handles non-UTF8 output gracefully."""
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.read.return_value = b"valid \xff invalid"
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        result = executor._execute_command_sync(mock_client, "test")

        # Should not raise, should use replacement character
        assert "valid" in result["stdout"]


class TestServerFallbacks:
    """Tests for server hostname fallback logic in execute."""

    @pytest.fixture
    def mock_server_no_tailscale(self):
        """Server without tailscale hostname."""
        server = MagicMock()
        server.id = "test-server"
        server.tailscale_hostname = None
        server.ip_address = "192.168.1.100"
        server.hostname = "local.server"
        server.ssh_username = "testuser"
        return server

    @pytest.fixture
    def mock_server_ip_only(self):
        """Server with only IP address."""
        server = MagicMock()
        server.id = "test-server"
        server.tailscale_hostname = None
        server.ip_address = "10.0.0.50"
        server.hostname = None
        server.ssh_username = "testuser"
        return server

    @pytest.mark.asyncio
    async def test_execute_uses_ip_fallback(
        self, executor, mock_server_no_tailscale
    ):
        """Test execute falls back to IP address when no tailscale hostname."""
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.read.return_value = b"output"
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        with patch.object(
            executor, "get_connection", new_callable=AsyncMock
        ) as mock_get_conn:
            mock_get_conn.return_value = mock_client

            with patch.object(
                executor._credential_service, "get_credential", new_callable=AsyncMock
            ) as mock_cred:
                mock_cred.return_value = None

                result = await executor.execute(
                    mock_server_no_tailscale, "hostname"
                )

                # Should use IP address
                call_args = mock_get_conn.call_args
                assert call_args[0][0] == "192.168.1.100"
                assert result.hostname == "192.168.1.100"

    @pytest.mark.asyncio
    async def test_execute_uses_hostname_fallback(
        self, executor, mock_server_ip_only
    ):
        """Test execute falls back to hostname when no tailscale or IP."""
        mock_server_ip_only.ip_address = None
        mock_server_ip_only.hostname = "fallback.local"

        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.read.return_value = b"output"
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        with patch.object(
            executor, "get_connection", new_callable=AsyncMock
        ) as mock_get_conn:
            mock_get_conn.return_value = mock_client

            with patch.object(
                executor._credential_service, "get_credential", new_callable=AsyncMock
            ) as mock_cred:
                mock_cred.return_value = None

                _result = await executor.execute(
                    mock_server_ip_only, "hostname"
                )

                call_args = mock_get_conn.call_args
                assert call_args[0][0] == "fallback.local"

    @pytest.mark.asyncio
    async def test_execute_raises_no_hostname(self, executor):
        """Test execute raises ValueError when no hostname available."""
        server = MagicMock()
        server.id = "test-server"
        server.tailscale_hostname = None
        server.ip_address = None
        server.hostname = None

        with pytest.raises(ValueError, match="no hostname"):
            await executor.execute(server, "test")
