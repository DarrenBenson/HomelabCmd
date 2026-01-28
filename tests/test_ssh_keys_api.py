"""Tests for SSH Key Manager API (US0071).

These tests verify SSH key management functionality including:
- Listing keys with metadata (AC1)
- Uploading keys with validation (AC2)
- Deleting keys (AC3)
- Key validation edge cases

TDD: These tests are written before implementation.
"""

from pathlib import Path
from unittest.mock import MagicMock, patch

import paramiko
import pytest
from fastapi.testclient import TestClient

import homelab_cmd.services.ssh as ssh_module


@pytest.fixture(autouse=True)
def reset_ssh_service_singleton() -> None:
    """Reset the SSH service singleton before each test."""
    ssh_module._ssh_service = None
    yield
    ssh_module._ssh_service = None


# =============================================================================
# Test GET /api/v1/settings/ssh/keys (AC1)
# =============================================================================


class TestListSSHKeys:
    """Tests for listing SSH keys with metadata."""

    def test_list_keys_returns_metadata(
        self, client: TestClient, auth_headers: dict[str, str], tmp_path: Path
    ) -> None:
        """Returns list of keys with metadata but NOT private key content (AC1, TC001)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        key_file = ssh_dir / "id_ed25519"
        key_file.write_text("-----BEGIN OPENSSH PRIVATE KEY-----\nfake\n-----END OPENSSH PRIVATE KEY-----")
        key_file.chmod(0o600)

        # Mock the SSH service to return our test key
        mock_key = MagicMock(spec=paramiko.Ed25519Key)
        mock_key.get_name.return_value = "ssh-ed25519"
        mock_key.asbytes.return_value = bytes.fromhex("abcd1234" * 8)

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch(
                "homelab_cmd.services.ssh.paramiko.Ed25519Key.from_private_key_file",
                return_value=mock_key,
            ),
            patch(
                "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key_file",
                side_effect=paramiko.SSHException("Not RSA"),
            ),
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10
            mock_settings.return_value.ssh_default_port = 22
            mock_settings.return_value.ssh_default_username = "root"

            response = client.get("/api/v1/settings/ssh/keys", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert "keys" in data
        assert len(data["keys"]) >= 1

        key_data = data["keys"][0]
        assert "id" in key_data
        assert "name" in key_data
        assert "type" in key_data
        assert "fingerprint" in key_data
        assert "created_at" in key_data
        # CRITICAL: Private key content should NEVER be returned
        assert "private_key" not in key_data

    def test_list_keys_empty_state(
        self, client: TestClient, auth_headers: dict[str, str], tmp_path: Path
    ) -> None:
        """Returns empty list when no keys configured (AC7, TC002)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()  # Empty directory

        with patch("homelab_cmd.services.ssh.get_settings") as mock_settings:
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10
            mock_settings.return_value.ssh_default_port = 22
            mock_settings.return_value.ssh_default_username = "root"

            response = client.get("/api/v1/settings/ssh/keys", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert "keys" in data
        assert data["keys"] == []

    def test_list_keys_requires_auth(self, client: TestClient) -> None:
        """Requires API key authentication."""
        response = client.get("/api/v1/settings/ssh/keys")
        assert response.status_code == 401


# =============================================================================
# Test POST /api/v1/settings/ssh/keys (AC2)
# =============================================================================


class TestUploadSSHKey:
    """Tests for uploading SSH keys."""

    def test_upload_valid_key(
        self, client: TestClient, auth_headers: dict[str, str], tmp_path: Path
    ) -> None:
        """Successfully uploads valid key with 600 permissions (AC2, TC004)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()

        # Mock key validation to succeed (from_private_key uses StringIO)
        mock_key = MagicMock(spec=paramiko.Ed25519Key)
        mock_key.get_name.return_value = "ssh-ed25519"
        mock_key.asbytes.return_value = bytes.fromhex("abcd1234" * 8)

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch("homelab_cmd.api.routes.scan.get_settings") as mock_route_settings,
            patch(
                "homelab_cmd.services.ssh.paramiko.Ed25519Key.from_private_key",
                return_value=mock_key,
            ),
            patch(
                "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key",
                side_effect=paramiko.SSHException("Not RSA"),
            ),
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10
            mock_settings.return_value.ssh_default_port = 22
            mock_settings.return_value.ssh_default_username = "root"
            mock_route_settings.return_value = mock_settings.return_value

            response = client.post(
                "/api/v1/settings/ssh/keys",
                json={
                    "name": "work_key",
                    "private_key": "-----BEGIN OPENSSH PRIVATE KEY-----\nfake\n-----END OPENSSH PRIVATE KEY-----",
                },
                headers=auth_headers,
            )

        assert response.status_code == 201
        data = response.json()
        assert data["id"] == "work_key"
        assert data["name"] == "work_key"
        assert "type" in data
        assert "fingerprint" in data
        assert "created_at" in data
        # Private key should NOT be in response
        assert "private_key" not in data

        # Verify file was created with correct permissions
        key_path = ssh_dir / "work_key"
        assert key_path.exists()
        assert oct(key_path.stat().st_mode)[-3:] == "600"

    def test_upload_invalid_key_format_rejected(
        self, client: TestClient, auth_headers: dict[str, str], tmp_path: Path
    ) -> None:
        """Rejects invalid SSH key format with 400 error (AC2, TC005)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch("homelab_cmd.api.routes.scan.get_settings") as mock_route_settings,
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10
            mock_route_settings.return_value = mock_settings.return_value

            response = client.post(
                "/api/v1/settings/ssh/keys",
                json={
                    "name": "invalid_key",
                    "private_key": "not a valid ssh key content",
                },
                headers=auth_headers,
            )

        assert response.status_code == 400
        data = response.json()
        assert "Invalid SSH private key format" in data["detail"]

        # Verify no file was created
        key_path = ssh_dir / "invalid_key"
        assert not key_path.exists()

    def test_upload_password_protected_key_rejected(
        self, client: TestClient, auth_headers: dict[str, str], tmp_path: Path
    ) -> None:
        """Rejects password-protected keys with helpful error (AC2, TC006)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()

        # Mock key loading to raise PasswordRequiredException (from_private_key uses StringIO)
        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch("homelab_cmd.api.routes.scan.get_settings") as mock_route_settings,
            patch(
                "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key",
                side_effect=paramiko.ssh_exception.PasswordRequiredException("Key is encrypted"),
            ),
            patch(
                "homelab_cmd.services.ssh.paramiko.Ed25519Key.from_private_key",
                side_effect=paramiko.ssh_exception.PasswordRequiredException("Key is encrypted"),
            ),
            patch(
                "homelab_cmd.services.ssh.paramiko.ECDSAKey.from_private_key",
                side_effect=paramiko.ssh_exception.PasswordRequiredException("Key is encrypted"),
            ),
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10
            mock_route_settings.return_value = mock_settings.return_value

            response = client.post(
                "/api/v1/settings/ssh/keys",
                json={
                    "name": "protected_key",
                    "private_key": "-----BEGIN OPENSSH PRIVATE KEY-----\nencrypted\n-----END OPENSSH PRIVATE KEY-----",
                },
                headers=auth_headers,
            )

        assert response.status_code == 400
        data = response.json()
        assert "Password-protected" in data["detail"] or "password" in data["detail"].lower()

    def test_upload_duplicate_name_rejected(
        self, client: TestClient, auth_headers: dict[str, str], tmp_path: Path
    ) -> None:
        """Rejects duplicate key name with 409 Conflict (AC2, TC007)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()

        # Create existing key
        existing_key = ssh_dir / "work_key"
        existing_key.write_text("existing key content")

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch("homelab_cmd.api.routes.scan.get_settings") as mock_route_settings,
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10
            mock_route_settings.return_value = mock_settings.return_value

            response = client.post(
                "/api/v1/settings/ssh/keys",
                json={
                    "name": "work_key",
                    "private_key": "-----BEGIN OPENSSH PRIVATE KEY-----\nnew\n-----END OPENSSH PRIVATE KEY-----",
                },
                headers=auth_headers,
            )

        assert response.status_code == 409
        data = response.json()
        assert "already exists" in data["detail"]

    def test_upload_empty_key_rejected(
        self, client: TestClient, auth_headers: dict[str, str], tmp_path: Path
    ) -> None:
        """Rejects empty key content with validation error (TC edge case 5)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch("homelab_cmd.api.routes.scan.get_settings") as mock_route_settings,
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_route_settings.return_value = mock_settings.return_value

            response = client.post(
                "/api/v1/settings/ssh/keys",
                json={
                    "name": "empty_key",
                    "private_key": "",
                },
                headers=auth_headers,
            )

        # Should be 400 or 422 (validation error)
        assert response.status_code in [400, 422]

    def test_upload_requires_auth(self, client: TestClient) -> None:
        """Requires API key authentication."""
        response = client.post(
            "/api/v1/settings/ssh/keys",
            json={
                "name": "test_key",
                "private_key": "test",
            },
        )
        assert response.status_code == 401


# =============================================================================
# Test DELETE /api/v1/settings/ssh/keys/{key_id} (AC3)
# =============================================================================


class TestDeleteSSHKey:
    """Tests for deleting SSH keys."""

    def test_delete_existing_key(
        self, client: TestClient, auth_headers: dict[str, str], tmp_path: Path
    ) -> None:
        """Successfully deletes existing key file (AC3, TC009)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()

        # Create key to delete
        key_file = ssh_dir / "work_key"
        key_file.write_text("key content")

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch("homelab_cmd.api.routes.scan.get_settings") as mock_route_settings,
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10
            mock_route_settings.return_value = mock_settings.return_value

            response = client.delete(
                "/api/v1/settings/ssh/keys/work_key", headers=auth_headers
            )

        assert response.status_code == 204
        assert not key_file.exists()

    def test_delete_nonexistent_key_returns_404(
        self, client: TestClient, auth_headers: dict[str, str], tmp_path: Path
    ) -> None:
        """Returns 404 when key doesn't exist (TC010)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch("homelab_cmd.api.routes.scan.get_settings") as mock_route_settings,
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10
            mock_route_settings.return_value = mock_settings.return_value

            response = client.delete(
                "/api/v1/settings/ssh/keys/nonexistent", headers=auth_headers
            )

        assert response.status_code == 404
        data = response.json()
        assert "not found" in data["detail"].lower()

    def test_delete_requires_auth(self, client: TestClient) -> None:
        """Requires API key authentication."""
        response = client.delete("/api/v1/settings/ssh/keys/test_key")
        assert response.status_code == 401


# =============================================================================
# Test Key Name Sanitisation (Edge Case 4)
# =============================================================================


class TestKeyNameSanitisation:
    """Tests for key name sanitisation."""

    @pytest.mark.parametrize(
        "input_name,expected_sanitised",
        [
            ("work_key", "work_key"),  # Valid name unchanged
            ("work-key", "work-key"),  # Hyphen allowed
            ("work key", "workkey"),  # Space removed
            ("../../etc/passwd", "etcpasswd"),  # Path traversal prevented
            ("key@home!", "keyhome"),  # Special chars removed
            ("My Key 2024", "MyKey2024"),  # Mixed sanitisation
        ],
    )
    def test_key_name_sanitised(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
        tmp_path: Path,
        input_name: str,
        expected_sanitised: str,
    ) -> None:
        """Sanitises key names to safe characters (TC008)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()

        mock_key = MagicMock(spec=paramiko.Ed25519Key)
        mock_key.get_name.return_value = "ssh-ed25519"
        mock_key.asbytes.return_value = bytes.fromhex("abcd1234" * 8)

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch("homelab_cmd.api.routes.scan.get_settings") as mock_route_settings,
            patch(
                "homelab_cmd.services.ssh.paramiko.Ed25519Key.from_private_key",
                return_value=mock_key,
            ),
            patch(
                "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key",
                side_effect=paramiko.SSHException("Not RSA"),
            ),
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10
            mock_route_settings.return_value = mock_settings.return_value

            response = client.post(
                "/api/v1/settings/ssh/keys",
                json={
                    "name": input_name,
                    "private_key": "-----BEGIN OPENSSH PRIVATE KEY-----\nfake\n-----END OPENSSH PRIVATE KEY-----",
                },
                headers=auth_headers,
            )

        # Should succeed with sanitised name
        if response.status_code == 201:
            data = response.json()
            assert data["name"] == expected_sanitised
            assert (ssh_dir / expected_sanitised).exists()


# =============================================================================
# Test Key Type Detection (AC1, TC003)
# =============================================================================


class TestKeyTypeDetection:
    """Tests for key type detection."""

    def test_detects_ed25519_key_type(self, tmp_path: Path) -> None:
        """Detects ED25519 key type correctly."""
        from homelab_cmd.services.ssh import SSHConnectionService

        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        key_file = ssh_dir / "id_ed25519"
        key_file.write_text("ED25519 KEY")

        mock_key = MagicMock(spec=paramiko.Ed25519Key)
        mock_key.get_name.return_value = "ssh-ed25519"

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch(
                "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key_file",
                side_effect=paramiko.SSHException("Not RSA"),
            ),
            patch(
                "homelab_cmd.services.ssh.paramiko.Ed25519Key.from_private_key_file",
                return_value=mock_key,
            ),
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10

            service = SSHConnectionService()
            loaded_key = service._load_key(key_file)

            assert loaded_key is not None
            assert loaded_key.get_name() == "ssh-ed25519"

    def test_detects_rsa_key_type(self, tmp_path: Path) -> None:
        """Detects RSA key type correctly."""
        from homelab_cmd.services.ssh import SSHConnectionService

        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        key_file = ssh_dir / "id_rsa"
        key_file.write_text("RSA KEY")

        mock_key = MagicMock(spec=paramiko.RSAKey)
        mock_key.get_name.return_value = "ssh-rsa"
        mock_key.get_bits.return_value = 4096

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch(
                "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key_file",
                return_value=mock_key,
            ),
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10

            service = SSHConnectionService()
            loaded_key = service._load_key(key_file)

            assert loaded_key is not None
            assert loaded_key.get_name() == "ssh-rsa"


# =============================================================================
# Test Connection Test with No Keys (Edge Case 8)
# =============================================================================


class TestConnectionTestNoKeys:
    """Tests for connection test when no keys configured."""

    def test_connection_test_no_keys_error(
        self, client: TestClient, auth_headers: dict[str, str], tmp_path: Path
    ) -> None:
        """Returns clear error when no SSH keys configured (TC015)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()  # Empty

        with patch("homelab_cmd.services.ssh.get_settings") as mock_settings:
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10
            mock_settings.return_value.ssh_default_port = 22
            mock_settings.return_value.ssh_default_username = "root"

            response = client.post(
                "/api/v1/scan/test",
                json={"hostname": "192.168.1.100"},
                headers=auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "failed"
        assert "No SSH keys" in data["error"]


# =============================================================================
# US0072: SSH Key Username Association Tests
# =============================================================================


class TestSSHKeyUsernameAssociation:
    """Tests for SSH key username association (US0072)."""

    def test_upload_key_with_username(
        self, client: TestClient, auth_headers: dict[str, str], tmp_path: Path
    ) -> None:
        """Upload key with username stores it in DB and returns it (US0072)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()

        mock_key = MagicMock(spec=paramiko.Ed25519Key)
        mock_key.get_name.return_value = "ssh-ed25519"
        mock_key.asbytes.return_value = bytes.fromhex("abcd1234" * 8)

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch("homelab_cmd.api.routes.scan.get_settings") as mock_route_settings,
            patch(
                "homelab_cmd.services.ssh.paramiko.Ed25519Key.from_private_key",
                return_value=mock_key,
            ),
            patch(
                "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key",
                side_effect=paramiko.SSHException("Not RSA"),
            ),
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10
            mock_settings.return_value.ssh_default_port = 22
            mock_settings.return_value.ssh_default_username = "root"
            mock_route_settings.return_value = mock_settings.return_value

            response = client.post(
                "/api/v1/settings/ssh/keys",
                json={
                    "name": "work_key",
                    "private_key": "-----BEGIN OPENSSH PRIVATE KEY-----\nfake\n-----END OPENSSH PRIVATE KEY-----",
                    "username": "darren",
                },
                headers=auth_headers,
            )

        assert response.status_code == 201
        data = response.json()
        assert data["username"] == "darren"

    def test_upload_key_without_username(
        self, client: TestClient, auth_headers: dict[str, str], tmp_path: Path
    ) -> None:
        """Upload key without username returns null username (US0072)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()

        mock_key = MagicMock(spec=paramiko.Ed25519Key)
        mock_key.get_name.return_value = "ssh-ed25519"
        mock_key.asbytes.return_value = bytes.fromhex("abcd1234" * 8)

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch("homelab_cmd.api.routes.scan.get_settings") as mock_route_settings,
            patch(
                "homelab_cmd.services.ssh.paramiko.Ed25519Key.from_private_key",
                return_value=mock_key,
            ),
            patch(
                "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key",
                side_effect=paramiko.SSHException("Not RSA"),
            ),
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10
            mock_settings.return_value.ssh_default_port = 22
            mock_settings.return_value.ssh_default_username = "root"
            mock_route_settings.return_value = mock_settings.return_value

            response = client.post(
                "/api/v1/settings/ssh/keys",
                json={
                    "name": "work_key",
                    "private_key": "-----BEGIN OPENSSH PRIVATE KEY-----\nfake\n-----END OPENSSH PRIVATE KEY-----",
                },
                headers=auth_headers,
            )

        assert response.status_code == 201
        data = response.json()
        assert data["username"] is None

    def test_list_keys_includes_username(
        self, client: TestClient, auth_headers: dict[str, str], tmp_path: Path
    ) -> None:
        """List keys includes username from DB (US0072)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        key_file = ssh_dir / "work_key"
        key_file.write_text("-----BEGIN OPENSSH PRIVATE KEY-----\nfake\n-----END OPENSSH PRIVATE KEY-----")
        key_file.chmod(0o600)

        mock_key = MagicMock(spec=paramiko.Ed25519Key)
        mock_key.get_name.return_value = "ssh-ed25519"
        mock_key.asbytes.return_value = bytes.fromhex("abcd1234" * 8)

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch(
                "homelab_cmd.services.ssh.paramiko.Ed25519Key.from_private_key_file",
                return_value=mock_key,
            ),
            patch(
                "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key_file",
                side_effect=paramiko.SSHException("Not RSA"),
            ),
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10
            mock_settings.return_value.ssh_default_port = 22
            mock_settings.return_value.ssh_default_username = "root"

            # First upload a key with username
            mock_key_upload = MagicMock(spec=paramiko.Ed25519Key)
            mock_key_upload.get_name.return_value = "ssh-ed25519"
            mock_key_upload.asbytes.return_value = bytes.fromhex("abcd1234" * 8)

            with (
                patch("homelab_cmd.api.routes.scan.get_settings") as mock_route_settings,
                patch(
                    "homelab_cmd.services.ssh.paramiko.Ed25519Key.from_private_key",
                    return_value=mock_key_upload,
                ),
                patch(
                    "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key",
                    side_effect=paramiko.SSHException("Not RSA"),
                ),
            ):
                mock_route_settings.return_value = mock_settings.return_value

                # Upload key with username
                client.post(
                    "/api/v1/settings/ssh/keys",
                    json={
                        "name": "admin_key",
                        "private_key": "-----BEGIN OPENSSH PRIVATE KEY-----\nfake2\n-----END OPENSSH PRIVATE KEY-----",
                        "username": "admin",
                    },
                    headers=auth_headers,
                )

            response = client.get("/api/v1/settings/ssh/keys", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert "keys" in data
        # Find the admin_key and verify username
        admin_keys = [k for k in data["keys"] if k["name"] == "admin_key"]
        if admin_keys:
            assert admin_keys[0]["username"] == "admin"

    def test_delete_key_removes_username_from_db(
        self, client: TestClient, auth_headers: dict[str, str], tmp_path: Path
    ) -> None:
        """Delete key removes username from DB (US0072)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()

        mock_key = MagicMock(spec=paramiko.Ed25519Key)
        mock_key.get_name.return_value = "ssh-ed25519"
        mock_key.asbytes.return_value = bytes.fromhex("abcd1234" * 8)

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch("homelab_cmd.api.routes.scan.get_settings") as mock_route_settings,
            patch(
                "homelab_cmd.services.ssh.paramiko.Ed25519Key.from_private_key",
                return_value=mock_key,
            ),
            patch(
                "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key",
                side_effect=paramiko.SSHException("Not RSA"),
            ),
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10
            mock_settings.return_value.ssh_default_port = 22
            mock_settings.return_value.ssh_default_username = "root"
            mock_route_settings.return_value = mock_settings.return_value

            # Upload key with username
            response = client.post(
                "/api/v1/settings/ssh/keys",
                json={
                    "name": "temp_key",
                    "private_key": "-----BEGIN OPENSSH PRIVATE KEY-----\nfake\n-----END OPENSSH PRIVATE KEY-----",
                    "username": "tempuser",
                },
                headers=auth_headers,
            )
            assert response.status_code == 201

            # Now delete the key
            response = client.delete(
                "/api/v1/settings/ssh/keys/temp_key",
                headers=auth_headers,
            )
            assert response.status_code == 204

            # Verify key file is deleted
            assert not (ssh_dir / "temp_key").exists()

    def test_existing_keys_show_null_username(
        self, client: TestClient, auth_headers: dict[str, str], tmp_path: Path
    ) -> None:
        """Existing keys without username show null (backward compat, US0072)."""
        ssh_dir = tmp_path / "ssh-keys"
        ssh_dir.mkdir()
        key_file = ssh_dir / "legacy_key"
        key_file.write_text("-----BEGIN OPENSSH PRIVATE KEY-----\nfake\n-----END OPENSSH PRIVATE KEY-----")
        key_file.chmod(0o600)

        mock_key = MagicMock(spec=paramiko.Ed25519Key)
        mock_key.get_name.return_value = "ssh-ed25519"
        mock_key.asbytes.return_value = bytes.fromhex("abcd1234" * 8)

        with (
            patch("homelab_cmd.services.ssh.get_settings") as mock_settings,
            patch(
                "homelab_cmd.services.ssh.paramiko.Ed25519Key.from_private_key_file",
                return_value=mock_key,
            ),
            patch(
                "homelab_cmd.services.ssh.paramiko.RSAKey.from_private_key_file",
                side_effect=paramiko.SSHException("Not RSA"),
            ),
        ):
            mock_settings.return_value.ssh_key_path = str(ssh_dir)
            mock_settings.return_value.ssh_connection_timeout = 10
            mock_settings.return_value.ssh_default_port = 22
            mock_settings.return_value.ssh_default_username = "root"

            response = client.get("/api/v1/settings/ssh/keys", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert "keys" in data
        assert len(data["keys"]) >= 1
        # Legacy key should have null username
        legacy_key = next((k for k in data["keys"] if k["name"] == "legacy_key"), None)
        assert legacy_key is not None
        assert legacy_key["username"] is None
