"""Tests for SSH Connection Service (US0037).

These tests verify SSH key discovery, permission validation, and key loading
functionality for ad-hoc device scanning.

Coverage targets: Lines 70-97, 99-131, 142-162, 180-270, 296-374, 405-456
"""

from pathlib import Path
from unittest.mock import MagicMock, patch

import paramiko
import pytest
from paramiko import AuthenticationException, SSHException

# =============================================================================
# Test get_available_keys() - Lines 70-97
# =============================================================================


class TestGetAvailableKeys:
    """Tests for SSH key discovery."""

    def test_returns_empty_when_directory_missing(self, tmp_path: Path) -> None:
        """Returns empty list when key directory does not exist."""
        with patch("homelab_cmd.services.ssh.get_settings") as mock_settings:
            mock_settings.return_value.ssh_key_path = str(tmp_path / "nonexistent")
            mock_settings.return_value.ssh_connection_timeout = 10

            from homelab_cmd.services.ssh import SSHConnectionService

            service = SSHConnectionService()
            keys = service.get_available_keys()

            assert keys == []

    def test_returns_empty_when_path_is_file(self, tmp_path: Path) -> None:
        """Returns empty list when key path is a file, not directory (Line 82-83)."""
        key_file = tmp_path / "not-a-directory"
        key_file.write_text("this is a file")

        with patch("homelab_cmd.services.ssh.get_settings") as mock_settings:
            mock_settings.return_value.ssh_key_path = str(key_file)
            mock_settings.return_value.ssh_connection_timeout = 10

            from homelab_cmd.services.ssh import SSHConnectionService

            service = SSHConnectionService()
            keys = service.get_available_keys()

            assert keys == []

    def test_returns_sorted_key_files(self, tmp_path: Path) -> None:
        """Returns sorted list of discovered key files."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        (ssh_dir / "id_rsa").write_text("RSA KEY")
        (ssh_dir / "id_ed25519").write_text("ED25519 KEY")
        (ssh_dir / "id_ecdsa").write_text("ECDSA KEY")
        (ssh_dir / "id_rsa.pub").write_text("RSA PUBLIC KEY")  # Should be ignored

        with patch("homelab_cmd.services.ssh.get_settings") as mock_settings:
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10

            from homelab_cmd.services.ssh import SSHConnectionService

            service = SSHConnectionService()
            keys = service.get_available_keys()

            # Standard patterns found, sorted alphabetically
            assert "id_ecdsa" in keys
            assert "id_ed25519" in keys
            assert "id_rsa" in keys
            # Public keys are excluded
            assert "id_rsa.pub" not in keys
            # List is sorted
            assert keys == sorted(keys)

    def test_includes_custom_key_files(self, tmp_path: Path) -> None:
        """Includes non-standard key files that don't have .pub extension."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        (ssh_dir / "id_rsa").write_text("RSA KEY")
        (ssh_dir / "custom_key").write_text("CUSTOM KEY")
        (ssh_dir / "custom_key.pub").write_text("CUSTOM PUBLIC KEY")

        with patch("homelab_cmd.services.ssh.get_settings") as mock_settings:
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10

            from homelab_cmd.services.ssh import SSHConnectionService

            service = SSHConnectionService()
            keys = service.get_available_keys()

            assert "custom_key" in keys
            assert "custom_key.pub" not in keys


# =============================================================================
# Test validate_key_permissions() - Lines 99-131
# =============================================================================


class TestValidateKeyPermissions:
    """Tests for SSH key permission validation."""

    def test_valid_permissions_returns_true(self, tmp_path: Path) -> None:
        """Returns True for keys with correct 600 permissions."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        key_file = ssh_dir / "id_rsa"
        key_file.write_text("RSA KEY")
        key_file.chmod(0o600)

        with patch("homelab_cmd.services.ssh.get_settings") as mock_settings:
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10

            from homelab_cmd.services.ssh import SSHConnectionService

            service = SSHConnectionService()
            results = service.validate_key_permissions()

            assert results["id_rsa"] is True

    def test_invalid_permissions_returns_false(self, tmp_path: Path) -> None:
        """Returns False for keys with incorrect permissions."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        key_file = ssh_dir / "id_rsa"
        key_file.write_text("RSA KEY")
        key_file.chmod(0o644)  # Too permissive

        with patch("homelab_cmd.services.ssh.get_settings") as mock_settings:
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10

            from homelab_cmd.services.ssh import SSHConnectionService

            service = SSHConnectionService()
            results = service.validate_key_permissions()

            assert results["id_rsa"] is False

    def test_oserror_returns_false(self, tmp_path: Path) -> None:
        """Returns False when stat() raises OSError (Lines 126-128)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        key_file = ssh_dir / "id_rsa"
        key_file.write_text("RSA KEY")

        with patch("homelab_cmd.services.ssh.get_settings") as mock_settings:
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10

            from homelab_cmd.services.ssh import SSHConnectionService

            service = SSHConnectionService()

            # Mock get_available_keys to return our key, then mock the stat call
            with patch.object(service, "get_available_keys", return_value=["id_rsa"]):
                # Now mock the key_file.stat() call to raise OSError
                with patch.object(Path, "stat", side_effect=OSError("Permission denied")):
                    results = service.validate_key_permissions()
                    assert results["id_rsa"] is False


# =============================================================================
# Test _load_key() - Lines 133-162
# =============================================================================


class TestLoadKey:
    """Tests for SSH key loading."""

    def test_loads_rsa_key_successfully(self, tmp_path: Path) -> None:
        """Successfully loads RSA key using paramiko (Lines 142-147)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        key_file = ssh_dir / "id_rsa"
        key_file.write_text("RSA KEY CONTENT")

        mock_key = MagicMock(spec=paramiko.RSAKey)

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch(
                "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key_file",
                return_value=mock_key,
            ) as mock_rsa,
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10

            from homelab_cmd.services.ssh import SSHConnectionService

            service = SSHConnectionService()
            result = service._load_key(key_file)

            mock_rsa.assert_called_once_with(str(key_file))
            assert result == mock_key

    def test_loads_ed25519_key_when_rsa_fails(self, tmp_path: Path) -> None:
        """Falls back to Ed25519 when RSA loading fails (Lines 149-152)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        key_file = ssh_dir / "id_ed25519"
        key_file.write_text("ED25519 KEY CONTENT")

        mock_key = MagicMock(spec=paramiko.Ed25519Key)

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch(
                "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key_file",
                side_effect=paramiko.SSHException("Not an RSA key"),
            ),
            patch(
                "homelab_cmd.services.ssh.paramiko.Ed25519Key.from_private_key_file",
                return_value=mock_key,
            ) as mock_ed25519,
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10

            from homelab_cmd.services.ssh import SSHConnectionService

            service = SSHConnectionService()
            result = service._load_key(key_file)

            mock_ed25519.assert_called_once_with(str(key_file))
            assert result == mock_key

    def test_loads_ecdsa_key_when_others_fail(self, tmp_path: Path) -> None:
        """Falls back to ECDSA when RSA and Ed25519 fail (Lines 154-157)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        key_file = ssh_dir / "id_ecdsa"
        key_file.write_text("ECDSA KEY CONTENT")

        mock_key = MagicMock(spec=paramiko.ECDSAKey)

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch(
                "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key_file",
                side_effect=paramiko.SSHException("Not an RSA key"),
            ),
            patch(
                "homelab_cmd.services.ssh.paramiko.Ed25519Key.from_private_key_file",
                side_effect=paramiko.SSHException("Not an Ed25519 key"),
            ),
            patch(
                "homelab_cmd.services.ssh.paramiko.ECDSAKey.from_private_key_file",
                return_value=mock_key,
            ) as mock_ecdsa,
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10

            from homelab_cmd.services.ssh import SSHConnectionService

            service = SSHConnectionService()
            result = service._load_key(key_file)

            mock_ecdsa.assert_called_once_with(str(key_file))
            assert result == mock_key

    def test_returns_none_for_unsupported_format(self, tmp_path: Path) -> None:
        """Returns None when all key types fail (Lines 161-162)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        key_file = ssh_dir / "unknown_key"
        key_file.write_text("UNKNOWN KEY FORMAT")

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch(
                "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key_file",
                side_effect=paramiko.SSHException("Not an RSA key"),
            ),
            patch(
                "homelab_cmd.services.ssh.paramiko.Ed25519Key.from_private_key_file",
                side_effect=paramiko.SSHException("Not an Ed25519 key"),
            ),
            patch(
                "homelab_cmd.services.ssh.paramiko.ECDSAKey.from_private_key_file",
                side_effect=paramiko.SSHException("Not an ECDSA key"),
            ),
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10

            from homelab_cmd.services.ssh import SSHConnectionService

            service = SSHConnectionService()
            result = service._load_key(key_file)

            assert result is None


# =============================================================================
# Test get_ssh_service() singleton - Lines 463-472
# =============================================================================


class TestGetSshService:
    """Tests for SSH service singleton."""

    def test_returns_service_instance(self) -> None:
        """get_ssh_service returns an SSHConnectionService instance."""
        # Reset the singleton
        import homelab_cmd.services.ssh as ssh_module

        ssh_module._ssh_service = None

        with patch("homelab_cmd.services.ssh.get_settings") as mock_settings:
            mock_settings.return_value.ssh_key_path = "/tmp/test-keys"
            mock_settings.return_value.ssh_connection_timeout = 10

            from homelab_cmd.services.ssh import SSHConnectionService, get_ssh_service

            service = get_ssh_service()

            assert isinstance(service, SSHConnectionService)

    def test_returns_same_instance(self) -> None:
        """get_ssh_service returns the same singleton instance."""
        import homelab_cmd.services.ssh as ssh_module

        ssh_module._ssh_service = None

        with patch("homelab_cmd.services.ssh.get_settings") as mock_settings:
            mock_settings.return_value.ssh_key_path = "/tmp/test-keys"
            mock_settings.return_value.ssh_connection_timeout = 10

            from homelab_cmd.services.ssh import get_ssh_service

            service1 = get_ssh_service()
            service2 = get_ssh_service()

            assert service1 is service2


# =============================================================================
# Test _test_connection_sync() - Lines 164-274
# =============================================================================


class TestConnectionSync:
    """Tests for synchronous SSH connection testing."""

    def test_returns_error_when_no_keys(self, tmp_path: Path) -> None:
        """Returns error when no SSH keys are available (Lines 182-187)."""
        ssh_dir = tmp_path / "empty-ssh"
        ssh_dir.mkdir()

        with patch("homelab_cmd.services.ssh.get_settings") as mock_settings:
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10

            from homelab_cmd.services.ssh import SSHConnectionService

            service = SSHConnectionService()
            result = service._test_connection_sync("test-host", 22, "testuser")

        assert result.success is False
        assert result.hostname == "test-host"
        assert result.error is not None
        assert "No SSH keys configured" in result.error

    def test_successful_connection(self, tmp_path: Path) -> None:
        """Successfully connects and returns hostname (Lines 189-230)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        key_file = ssh_dir / "id_rsa"
        key_file.write_text("RSA KEY")

        mock_pkey = MagicMock(spec=paramiko.RSAKey)
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.read.return_value = b"remote-hostname"

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch("homelab_cmd.services.ssh.paramiko.SSHClient", return_value=mock_client),
            patch(
                "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key_file",
                return_value=mock_pkey,
            ),
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10
            mock_client.exec_command.return_value = (None, mock_stdout, None)

            from homelab_cmd.services.ssh import SSHConnectionService

            service = SSHConnectionService()
            result = service._test_connection_sync("test-host", 22, "testuser")

            assert result.success is True
            assert result.hostname == "test-host"
            assert result.remote_hostname == "remote-hostname"
            assert result.response_time_ms is not None
            mock_client.connect.assert_called_once()
            mock_client.close.assert_called()

    def test_auth_failure_tries_next_key(self, tmp_path: Path) -> None:
        """Tries next key when authentication fails (Lines 232-235)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        (ssh_dir / "id_rsa").write_text("RSA KEY")
        (ssh_dir / "id_ed25519").write_text("ED25519 KEY")

        mock_pkey1 = MagicMock(spec=paramiko.RSAKey)
        mock_pkey2 = MagicMock(spec=paramiko.Ed25519Key)
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.read.return_value = b"remote-hostname"

        # First key fails auth, second succeeds
        mock_client.connect.side_effect = [
            AuthenticationException("Key rejected"),
            None,  # Success on second key
        ]
        mock_client.exec_command.return_value = (None, mock_stdout, None)

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch("homelab_cmd.services.ssh.paramiko.SSHClient", return_value=mock_client),
            patch(
                "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key_file",
                return_value=mock_pkey1,
            ),
            patch(
                "homelab_cmd.services.ssh.paramiko.Ed25519Key.from_private_key_file",
                return_value=mock_pkey2,
            ),
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10

            from homelab_cmd.services.ssh import SSHConnectionService

            service = SSHConnectionService()
            result = service._test_connection_sync("test-host", 22, "testuser")

            assert result.success is True
            assert mock_client.connect.call_count == 2

    def test_timeout_returns_error(self, tmp_path: Path) -> None:
        """Returns error on connection timeout (Lines 237-244)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        (ssh_dir / "id_rsa").write_text("RSA KEY")

        mock_pkey = MagicMock(spec=paramiko.RSAKey)
        mock_client = MagicMock()
        mock_client.connect.side_effect = TimeoutError("Connection timed out")

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch("homelab_cmd.services.ssh.paramiko.SSHClient", return_value=mock_client),
            patch(
                "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key_file",
                return_value=mock_pkey,
            ),
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10

            from homelab_cmd.services.ssh import SSHConnectionService

            service = SSHConnectionService()
            result = service._test_connection_sync("test-host", 22, "testuser")

        assert result.success is False
        assert result.error is not None
        assert "timed out" in result.error

    def test_oserror_tries_next_key(self, tmp_path: Path) -> None:
        """Tries next key on OSError (Lines 246-249)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        (ssh_dir / "id_rsa").write_text("RSA KEY")

        mock_pkey = MagicMock(spec=paramiko.RSAKey)
        mock_client = MagicMock()
        mock_client.connect.side_effect = OSError("Connection refused")

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch("homelab_cmd.services.ssh.paramiko.SSHClient", return_value=mock_client),
            patch(
                "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key_file",
                return_value=mock_pkey,
            ),
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10

            from homelab_cmd.services.ssh import SSHConnectionService

            service = SSHConnectionService()
            result = service._test_connection_sync("test-host", 22, "testuser")

        assert result.success is False
        assert result.error is not None
        assert "Connection refused" in result.error

    def test_ssh_exception_tries_next_key(self, tmp_path: Path) -> None:
        """Tries next key on SSHException (Lines 251-254)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        (ssh_dir / "id_rsa").write_text("RSA KEY")

        mock_pkey = MagicMock(spec=paramiko.RSAKey)
        mock_client = MagicMock()
        mock_client.connect.side_effect = SSHException("Protocol error")

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch("homelab_cmd.services.ssh.paramiko.SSHClient", return_value=mock_client),
            patch(
                "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key_file",
                return_value=mock_pkey,
            ),
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10

            from homelab_cmd.services.ssh import SSHConnectionService

            service = SSHConnectionService()
            result = service._test_connection_sync("test-host", 22, "testuser")

        assert result.success is False
        assert result.error is not None
        assert "SSH error" in result.error

    def test_all_keys_rejected(self, tmp_path: Path) -> None:
        """Returns error when all keys are rejected (Lines 270-273)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        (ssh_dir / "id_rsa").write_text("RSA KEY")
        (ssh_dir / "id_ed25519").write_text("ED25519 KEY")

        mock_pkey = MagicMock(spec=paramiko.RSAKey)
        mock_client = MagicMock()
        mock_client.connect.side_effect = AuthenticationException("Key rejected")

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch("homelab_cmd.services.ssh.paramiko.SSHClient", return_value=mock_client),
            patch(
                "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key_file",
                return_value=mock_pkey,
            ),
            patch(
                "homelab_cmd.services.ssh.paramiko.Ed25519Key.from_private_key_file",
                return_value=mock_pkey,
            ),
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10

            from homelab_cmd.services.ssh import SSHConnectionService

            service = SSHConnectionService()
            result = service._test_connection_sync("test-host", 22, "testuser")

        assert result.success is False
        assert result.error is not None
        assert "keys rejected" in result.error

    def test_no_valid_keys_loaded(self, tmp_path: Path) -> None:
        """Returns error when no keys can be loaded (Lines 263-268)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        (ssh_dir / "id_rsa").write_text("INVALID KEY")

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch(
                "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key_file",
                side_effect=SSHException("Invalid key"),
            ),
            patch(
                "homelab_cmd.services.ssh.paramiko.Ed25519Key.from_private_key_file",
                side_effect=SSHException("Invalid key"),
            ),
            patch(
                "homelab_cmd.services.ssh.paramiko.ECDSAKey.from_private_key_file",
                side_effect=SSHException("Invalid key"),
            ),
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10

            from homelab_cmd.services.ssh import SSHConnectionService

            service = SSHConnectionService()
            result = service._test_connection_sync("test-host", 22, "testuser")

        assert result.success is False
        assert result.error is not None
        assert "No valid SSH keys" in result.error


# =============================================================================
# Test _execute_command_sync() - Lines 276-380
# =============================================================================


class TestExecuteCommandSync:
    """Tests for synchronous SSH command execution."""

    def test_returns_error_when_no_keys(self, tmp_path: Path) -> None:
        """Returns error when no SSH keys are available (Lines 298-305)."""
        ssh_dir = tmp_path / "empty-ssh"
        ssh_dir.mkdir()

        with patch("homelab_cmd.services.ssh.get_settings") as mock_settings:
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10

            from homelab_cmd.services.ssh import SSHConnectionService

            service = SSHConnectionService()
            result = service._execute_command_sync("test-host", 22, "testuser", "ls -la")

        assert result.success is False
        assert result.exit_code == -1
        assert result.error is not None
        assert "No SSH keys configured" in result.error

    def test_successful_command_execution(self, tmp_path: Path) -> None:
        """Successfully executes command and returns output (Lines 319-344)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        (ssh_dir / "id_rsa").write_text("RSA KEY")

        mock_pkey = MagicMock(spec=paramiko.RSAKey)
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stderr = MagicMock()
        mock_channel = MagicMock()

        mock_stdout.read.return_value = b"file1.txt\nfile2.txt"
        mock_stdout.channel = mock_channel
        mock_channel.recv_exit_status.return_value = 0
        mock_stderr.read.return_value = b""

        mock_client.exec_command.return_value = (None, mock_stdout, mock_stderr)

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch("homelab_cmd.services.ssh.paramiko.SSHClient", return_value=mock_client),
            patch(
                "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key_file",
                return_value=mock_pkey,
            ),
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10

            from homelab_cmd.services.ssh import SSHConnectionService

            service = SSHConnectionService()
            result = service._execute_command_sync("test-host", 22, "testuser", "ls -la")

            assert result.success is True
            assert result.exit_code == 0
            assert "file1.txt" in result.stdout
            assert result.stderr == ""
            mock_client.exec_command.assert_called_once_with("ls -la", timeout=30)

    def test_command_with_non_zero_exit(self, tmp_path: Path) -> None:
        """Returns success=False for non-zero exit code."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        (ssh_dir / "id_rsa").write_text("RSA KEY")

        mock_pkey = MagicMock(spec=paramiko.RSAKey)
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stderr = MagicMock()
        mock_channel = MagicMock()

        mock_stdout.read.return_value = b""
        mock_stdout.channel = mock_channel
        mock_channel.recv_exit_status.return_value = 1
        mock_stderr.read.return_value = b"File not found"

        mock_client.exec_command.return_value = (None, mock_stdout, mock_stderr)

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch("homelab_cmd.services.ssh.paramiko.SSHClient", return_value=mock_client),
            patch(
                "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key_file",
                return_value=mock_pkey,
            ),
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10

            from homelab_cmd.services.ssh import SSHConnectionService

            service = SSHConnectionService()
            result = service._execute_command_sync("test-host", 22, "testuser", "cat missing.txt")

            assert result.success is False
            assert result.exit_code == 1
            assert "File not found" in result.stderr

    def test_timeout_returns_error(self, tmp_path: Path) -> None:
        """Returns error on connection timeout (Lines 350-358)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        (ssh_dir / "id_rsa").write_text("RSA KEY")

        mock_pkey = MagicMock(spec=paramiko.RSAKey)
        mock_client = MagicMock()
        mock_client.connect.side_effect = TimeoutError("Connection timed out")

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch("homelab_cmd.services.ssh.paramiko.SSHClient", return_value=mock_client),
            patch(
                "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key_file",
                return_value=mock_pkey,
            ),
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10

            from homelab_cmd.services.ssh import SSHConnectionService

            service = SSHConnectionService()
            result = service._execute_command_sync("test-host", 22, "testuser", "ls")

        assert result.success is False
        assert result.exit_code == -1
        assert result.error is not None
        assert "timed out" in result.error

    def test_auth_failure_tries_next_key(self, tmp_path: Path) -> None:
        """Tries next key when authentication fails (Lines 346-348)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        (ssh_dir / "id_rsa").write_text("RSA KEY")
        (ssh_dir / "id_ed25519").write_text("ED25519 KEY")

        mock_pkey = MagicMock(spec=paramiko.RSAKey)
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stderr = MagicMock()
        mock_channel = MagicMock()

        # First key fails, second succeeds
        mock_client.connect.side_effect = [
            AuthenticationException("Key rejected"),
            None,
        ]
        mock_stdout.read.return_value = b"output"
        mock_stdout.channel = mock_channel
        mock_channel.recv_exit_status.return_value = 0
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (None, mock_stdout, mock_stderr)

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch("homelab_cmd.services.ssh.paramiko.SSHClient", return_value=mock_client),
            patch(
                "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key_file",
                return_value=mock_pkey,
            ),
            patch(
                "homelab_cmd.services.ssh.paramiko.Ed25519Key.from_private_key_file",
                return_value=mock_pkey,
            ),
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10

            from homelab_cmd.services.ssh import SSHConnectionService

            service = SSHConnectionService()
            result = service._execute_command_sync("test-host", 22, "testuser", "ls")

            assert result.success is True
            assert mock_client.connect.call_count == 2

    def test_all_keys_rejected(self, tmp_path: Path) -> None:
        """Returns error when all keys are rejected (Lines 374-380)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        (ssh_dir / "id_rsa").write_text("RSA KEY")

        mock_pkey = MagicMock(spec=paramiko.RSAKey)
        mock_client = MagicMock()
        mock_client.connect.side_effect = AuthenticationException("Key rejected")

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch("homelab_cmd.services.ssh.paramiko.SSHClient", return_value=mock_client),
            patch(
                "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key_file",
                return_value=mock_pkey,
            ),
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10

            from homelab_cmd.services.ssh import SSHConnectionService

            service = SSHConnectionService()
            result = service._execute_command_sync("test-host", 22, "testuser", "ls")

        assert result.success is False
        assert result.error is not None
        assert "All keys rejected" in result.error


# =============================================================================
# Test async wrappers - Lines 382-456
# =============================================================================


class TestConnectionAsync:
    """Tests for async test_connection() wrapper."""

    @pytest.mark.asyncio
    async def test_calls_sync_method_with_defaults(self, tmp_path: Path) -> None:
        """Calls sync method with default port and username (Lines 442-456)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()

        with patch("homelab_cmd.services.ssh.get_settings") as mock_settings:
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10
            mock_settings.return_value.ssh_default_port = 22
            mock_settings.return_value.ssh_default_username = "defaultuser"

            from homelab_cmd.services.ssh import ConnectionResult, SSHConnectionService

            service = SSHConnectionService()

            # Mock the sync method to avoid actual SSH calls
            mock_result = ConnectionResult(
                success=True,
                hostname="test-host",
                remote_hostname="remote",
                response_time_ms=50,
            )
            with patch.object(
                service, "_test_connection_sync", return_value=mock_result
            ) as mock_sync:
                result = await service.test_connection("test-host")

                assert result.success is True
                mock_sync.assert_called_once_with("test-host", 22, "defaultuser", None)

    @pytest.mark.asyncio
    async def test_uses_provided_port_and_username(self, tmp_path: Path) -> None:
        """Uses provided port and username instead of defaults."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()

        with patch("homelab_cmd.services.ssh.get_settings") as mock_settings:
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10
            mock_settings.return_value.ssh_default_port = 22
            mock_settings.return_value.ssh_default_username = "defaultuser"

            from homelab_cmd.services.ssh import ConnectionResult, SSHConnectionService

            service = SSHConnectionService()

            mock_result = ConnectionResult(success=True, hostname="test-host")
            with patch.object(
                service, "_test_connection_sync", return_value=mock_result
            ) as mock_sync:
                await service.test_connection("test-host", port=2222, username="customuser")

                mock_sync.assert_called_once_with("test-host", 2222, "customuser", None)

    @pytest.mark.asyncio
    async def test_validates_keys_on_first_call(self, tmp_path: Path) -> None:
        """Validates key permissions on first connection attempt (Lines 447-448)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        (ssh_dir / "id_rsa").write_text("RSA KEY")
        (ssh_dir / "id_rsa").chmod(0o600)

        with patch("homelab_cmd.services.ssh.get_settings") as mock_settings:
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10
            mock_settings.return_value.ssh_default_port = 22
            mock_settings.return_value.ssh_default_username = "testuser"

            from homelab_cmd.services.ssh import ConnectionResult, SSHConnectionService

            service = SSHConnectionService()
            assert service._keys_validated is False

            mock_result = ConnectionResult(success=True, hostname="test-host")
            with patch.object(service, "_test_connection_sync", return_value=mock_result):
                await service.test_connection("test-host")

            assert service._keys_validated is True


class TestExecuteCommandAsync:
    """Tests for async execute_command() wrapper."""

    @pytest.mark.asyncio
    async def test_calls_sync_method_with_defaults(self, tmp_path: Path) -> None:
        """Calls sync method with default port and username (Lines 405-421)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()

        with patch("homelab_cmd.services.ssh.get_settings") as mock_settings:
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10
            mock_settings.return_value.ssh_default_port = 22
            mock_settings.return_value.ssh_default_username = "defaultuser"

            from homelab_cmd.services.ssh import CommandResult, SSHConnectionService

            service = SSHConnectionService()

            mock_result = CommandResult(
                success=True,
                stdout="output",
                stderr="",
                exit_code=0,
            )
            with patch.object(
                service, "_execute_command_sync", return_value=mock_result
            ) as mock_sync:
                result = await service.execute_command("test-host", command="ls -la")

                assert result.success is True
                # Args: hostname, port, username, command, command_timeout, key_usernames, key_filter
                mock_sync.assert_called_once_with(
                    "test-host",
                    22,
                    "defaultuser",
                    "ls -la",
                    30,
                    None,
                    None,
                    None,
                )

    @pytest.mark.asyncio
    async def test_uses_custom_command_timeout(self, tmp_path: Path) -> None:
        """Uses custom command timeout when provided."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()

        with patch("homelab_cmd.services.ssh.get_settings") as mock_settings:
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10
            mock_settings.return_value.ssh_default_port = 22
            mock_settings.return_value.ssh_default_username = "testuser"

            from homelab_cmd.services.ssh import CommandResult, SSHConnectionService

            service = SSHConnectionService()

            mock_result = CommandResult(success=True, stdout="", stderr="", exit_code=0)
            with patch.object(
                service, "_execute_command_sync", return_value=mock_result
            ) as mock_sync:
                await service.execute_command("test-host", command="long-task", command_timeout=120)

                # Args: hostname, port, username, command, command_timeout, key_usernames, key_filter
                mock_sync.assert_called_once_with(
                    "test-host",
                    22,
                    "testuser",
                    "long-task",
                    120,
                    None,
                    None,
                    None,
                )

    @pytest.mark.asyncio
    async def test_validates_keys_on_first_call(self, tmp_path: Path) -> None:
        """Validates key permissions on first command execution (Lines 410-411)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        (ssh_dir / "id_rsa").write_text("RSA KEY")
        (ssh_dir / "id_rsa").chmod(0o600)

        with patch("homelab_cmd.services.ssh.get_settings") as mock_settings:
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10
            mock_settings.return_value.ssh_default_port = 22
            mock_settings.return_value.ssh_default_username = "testuser"

            from homelab_cmd.services.ssh import CommandResult, SSHConnectionService

            service = SSHConnectionService()
            assert service._keys_validated is False

            mock_result = CommandResult(success=True, stdout="", stderr="", exit_code=0)
            with patch.object(service, "_execute_command_sync", return_value=mock_result):
                await service.execute_command("test-host", command="ls")

            assert service._keys_validated is True


# =============================================================================
# US0072: SSH Key Username Association Tests
# =============================================================================


class TestKeyUsernameAssociation:
    """Tests for key_usernames parameter in SSH connections (US0072)."""

    def test_connection_uses_key_specific_username(self, tmp_path: Path) -> None:
        """Connection uses key-specific username when provided (US0072)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        (ssh_dir / "work_key").write_text("RSA KEY")

        mock_pkey = MagicMock(spec=paramiko.RSAKey)
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.read.return_value = b"remote-hostname"

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch("homelab_cmd.services.ssh.paramiko.SSHClient", return_value=mock_client),
            patch(
                "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key_file",
                return_value=mock_pkey,
            ),
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10
            mock_client.exec_command.return_value = (None, mock_stdout, None)

            from homelab_cmd.services.ssh import SSHConnectionService

            service = SSHConnectionService()

            # Provide key_usernames mapping
            key_usernames = {"work_key": "darren"}
            result = service._test_connection_sync(
                "test-host", 22, "root", key_usernames=key_usernames
            )

            assert result.success is True
            # Verify the connect was called with the key-specific username
            mock_client.connect.assert_called_once()
            call_kwargs = mock_client.connect.call_args
            assert call_kwargs[1]["username"] == "darren"

    def test_connection_falls_back_to_default_username(self, tmp_path: Path) -> None:
        """Connection falls back to default username when key has no mapping (US0072)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        (ssh_dir / "other_key").write_text("RSA KEY")

        mock_pkey = MagicMock(spec=paramiko.RSAKey)
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.read.return_value = b"remote-hostname"

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch("homelab_cmd.services.ssh.paramiko.SSHClient", return_value=mock_client),
            patch(
                "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key_file",
                return_value=mock_pkey,
            ),
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10
            mock_client.exec_command.return_value = (None, mock_stdout, None)

            from homelab_cmd.services.ssh import SSHConnectionService

            service = SSHConnectionService()

            # Provide key_usernames that doesn't include our key
            key_usernames = {"work_key": "darren"}
            result = service._test_connection_sync(
                "test-host", 22, "root", key_usernames=key_usernames
            )

            assert result.success is True
            # Verify the connect was called with the default username
            mock_client.connect.assert_called_once()
            call_kwargs = mock_client.connect.call_args
            assert call_kwargs[1]["username"] == "root"

    def test_execute_command_uses_key_specific_username(self, tmp_path: Path) -> None:
        """Command execution uses key-specific username when provided (US0072)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        (ssh_dir / "admin_key").write_text("RSA KEY")

        mock_pkey = MagicMock(spec=paramiko.RSAKey)
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stderr = MagicMock()
        mock_channel = MagicMock()

        mock_stdout.read.return_value = b"output"
        mock_stdout.channel = mock_channel
        mock_channel.recv_exit_status.return_value = 0
        mock_stderr.read.return_value = b""

        mock_client.exec_command.return_value = (None, mock_stdout, mock_stderr)

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch("homelab_cmd.services.ssh.paramiko.SSHClient", return_value=mock_client),
            patch(
                "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key_file",
                return_value=mock_pkey,
            ),
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10

            from homelab_cmd.services.ssh import SSHConnectionService

            service = SSHConnectionService()

            # Provide key_usernames mapping
            key_usernames = {"admin_key": "admin"}
            result = service._execute_command_sync(
                "test-host", 22, "root", "ls -la", key_usernames=key_usernames
            )

            assert result.success is True
            # Verify the connect was called with the key-specific username
            mock_client.connect.assert_called_once()
            call_kwargs = mock_client.connect.call_args
            assert call_kwargs[1]["username"] == "admin"

    @pytest.mark.asyncio
    async def test_async_test_connection_passes_key_usernames(self, tmp_path: Path) -> None:
        """Async test_connection passes key_usernames to sync method (US0072)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()

        with patch("homelab_cmd.services.ssh.get_settings") as mock_settings:
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10
            mock_settings.return_value.ssh_default_port = 22
            mock_settings.return_value.ssh_default_username = "defaultuser"

            from homelab_cmd.services.ssh import ConnectionResult, SSHConnectionService

            service = SSHConnectionService()

            mock_result = ConnectionResult(
                success=True,
                hostname="test-host",
                remote_hostname="remote",
                response_time_ms=50,
            )
            key_usernames = {"work_key": "darren"}

            with patch.object(
                service, "_test_connection_sync", return_value=mock_result
            ) as mock_sync:
                result = await service.test_connection("test-host", key_usernames=key_usernames)

                assert result.success is True
                mock_sync.assert_called_once_with("test-host", 22, "defaultuser", key_usernames)

    @pytest.mark.asyncio
    async def test_async_execute_command_passes_key_usernames(self, tmp_path: Path) -> None:
        """Async execute_command passes key_usernames to sync method (US0072)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()

        with patch("homelab_cmd.services.ssh.get_settings") as mock_settings:
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10
            mock_settings.return_value.ssh_default_port = 22
            mock_settings.return_value.ssh_default_username = "defaultuser"

            from homelab_cmd.services.ssh import CommandResult, SSHConnectionService

            service = SSHConnectionService()

            mock_result = CommandResult(
                success=True,
                stdout="output",
                stderr="",
                exit_code=0,
            )
            key_usernames = {"admin_key": "admin"}

            with patch.object(
                service, "_execute_command_sync", return_value=mock_result
            ) as mock_sync:
                result = await service.execute_command(
                    "test-host", command="ls -la", key_usernames=key_usernames
                )

                assert result.success is True
                # Args: hostname, port, username, command, command_timeout, key_usernames, key_filter, password
                mock_sync.assert_called_once_with(
                    "test-host", 22, "defaultuser", "ls -la", 30, key_usernames, None, None
                )
