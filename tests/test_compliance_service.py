"""Tests for configuration compliance service.

Part of EP0010: Configuration Management - US0117 Configuration Compliance Checker.
"""

import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest
import yaml

from homelab_cmd.db.models import Server
from homelab_cmd.services.compliance_service import (
    ComplianceCheckService,
    SSHUnavailableError,
)
from homelab_cmd.services.config_pack_service import ConfigPackService
from homelab_cmd.services.ssh_executor import (
    SSHAuthenticationError,
    SSHConnectionError,
    SSHKeyNotConfiguredError,
    SSHPooledExecutor,
)


class MockSSHClient:
    """Mock SSH client for testing."""

    def __init__(self, command_responses: dict[str, str] | None = None):
        self.command_responses = command_responses or {}
        self.executed_commands = []

    def exec_command(self, command: str, timeout: int = 30):
        """Mock exec_command."""
        self.executed_commands.append(command)
        response = self.command_responses.get("default", "")
        for key, value in self.command_responses.items():
            if key in command:
                response = value
                break

        stdout = MagicMock()
        stdout.read.return_value = response.encode()
        return MagicMock(), stdout, MagicMock()


@pytest.fixture
def mock_ssh_executor():
    """Create a mock SSH executor."""
    executor = MagicMock(spec=SSHPooledExecutor)
    return executor


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    session = AsyncMock()
    return session


@pytest.fixture
def test_server():
    """Create a test server object."""
    server = MagicMock(spec=Server)
    server.id = "test-server"
    server.hostname = "test.local"
    server.tailscale_hostname = None
    server.ssh_username = "testuser"
    return server


@pytest.fixture
def temp_packs_dir():
    """Create temporary directory with test packs."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)

        # Create a test pack
        test_pack = {
            "name": "Test Pack",
            "description": "Pack for testing",
            "items": {
                "files": [
                    {"path": "~/.config/test.conf", "mode": "0644"},
                    {"path": "~/.bashrc", "mode": "0644", "content_hash": "sha256:abc123"},
                ],
                "packages": [
                    {"name": "curl", "min_version": "8.0.0"},
                    {"name": "git"},
                ],
                "settings": [
                    {"key": "EDITOR", "expected": "vim", "type": "env_var"},
                ],
            },
        }
        (tmp_path / "test-pack.yaml").write_text(yaml.dump(test_pack))

        # Create empty pack
        empty_pack = {
            "name": "Empty Pack",
            "description": "Pack with no items",
        }
        (tmp_path / "empty-pack.yaml").write_text(yaml.dump(empty_pack))

        yield tmp_path


class TestComplianceService:
    """Unit tests for ComplianceCheckService."""

    @pytest.mark.asyncio
    async def test_check_compliance_empty_pack(
        self, mock_ssh_executor, mock_session, test_server, temp_packs_dir
    ):
        """Test checking compliance against empty pack."""
        pack_service = ConfigPackService(packs_dir=temp_packs_dir)
        service = ComplianceCheckService(pack_service, mock_ssh_executor)

        result = await service.check_compliance(
            session=mock_session,
            server=test_server,
            pack_name="empty-pack",
        )

        assert result.is_compliant is True
        assert result.mismatches == []
        assert result.server_id == "test-server"
        assert result.pack_name == "empty-pack"

    @pytest.mark.asyncio
    async def test_check_compliance_ssh_key_not_configured(
        self, mock_session, test_server, temp_packs_dir
    ):
        """Test handling when SSH key is not configured."""
        pack_service = ConfigPackService(packs_dir=temp_packs_dir)
        mock_executor = MagicMock(spec=SSHPooledExecutor)
        mock_executor.get_connection = AsyncMock(
            side_effect=SSHKeyNotConfiguredError()
        )

        service = ComplianceCheckService(pack_service, mock_executor)

        with pytest.raises(SSHUnavailableError, match="No SSH key configured"):
            await service.check_compliance(
                session=mock_session,
                server=test_server,
                pack_name="test-pack",
            )

    @pytest.mark.asyncio
    async def test_check_compliance_ssh_auth_error(
        self, mock_session, test_server, temp_packs_dir
    ):
        """Test handling SSH authentication failure."""
        pack_service = ConfigPackService(packs_dir=temp_packs_dir)
        mock_executor = MagicMock(spec=SSHPooledExecutor)
        mock_executor.get_connection = AsyncMock(
            side_effect=SSHAuthenticationError("test.local", "testuser")
        )

        service = ComplianceCheckService(pack_service, mock_executor)

        with pytest.raises(SSHUnavailableError, match="authentication failed"):
            await service.check_compliance(
                session=mock_session,
                server=test_server,
                pack_name="test-pack",
            )

    @pytest.mark.asyncio
    async def test_check_compliance_ssh_connection_error(
        self, mock_session, test_server, temp_packs_dir
    ):
        """Test handling SSH connection failure."""
        pack_service = ConfigPackService(packs_dir=temp_packs_dir)
        mock_executor = MagicMock(spec=SSHPooledExecutor)
        mock_executor.get_connection = AsyncMock(
            side_effect=SSHConnectionError("test.local", Exception("timeout"), 3)
        )

        service = ComplianceCheckService(pack_service, mock_executor)

        with pytest.raises(SSHUnavailableError, match="connection failed"):
            await service.check_compliance(
                session=mock_session,
                server=test_server,
                pack_name="test-pack",
            )


class TestFileChecking:
    """Tests for file compliance checking."""

    @pytest.mark.asyncio
    async def test_file_missing(self, mock_session, test_server, temp_packs_dir):
        """Test detection of missing file."""
        # SSH response indicates file is missing
        ssh_response = "/home/testuser/.config/test.conf|MISSING||\n/home/testuser/.bashrc|EXISTS|644|abc123"

        mock_client = MockSSHClient({"default": ssh_response})
        mock_executor = MagicMock(spec=SSHPooledExecutor)
        mock_executor.get_connection = AsyncMock(return_value=mock_client)

        pack_service = ConfigPackService(packs_dir=temp_packs_dir)
        service = ComplianceCheckService(pack_service, mock_executor)

        result = await service.check_compliance(
            session=mock_session,
            server=test_server,
            pack_name="test-pack",
        )

        # Should have mismatch for missing file
        file_mismatches = [m for m in result.mismatches if m.type == "missing_file"]
        assert len(file_mismatches) == 1
        assert file_mismatches[0].item == "~/.config/test.conf"
        assert file_mismatches[0].expected.exists is True
        assert file_mismatches[0].actual.exists is False

    @pytest.mark.asyncio
    async def test_file_wrong_permissions(self, mock_session, test_server, temp_packs_dir):
        """Test detection of wrong file permissions."""
        # SSH response indicates wrong permissions (755 instead of 644)
        ssh_response = "/home/testuser/.config/test.conf|EXISTS|755|hash123\n/home/testuser/.bashrc|EXISTS|644|abc123"

        mock_client = MockSSHClient({"default": ssh_response})
        mock_executor = MagicMock(spec=SSHPooledExecutor)
        mock_executor.get_connection = AsyncMock(return_value=mock_client)

        pack_service = ConfigPackService(packs_dir=temp_packs_dir)
        service = ComplianceCheckService(pack_service, mock_executor)

        result = await service.check_compliance(
            session=mock_session,
            server=test_server,
            pack_name="test-pack",
        )

        # Should have mismatch for wrong permissions
        perm_mismatches = [m for m in result.mismatches if m.type == "wrong_permissions"]
        assert len(perm_mismatches) == 1
        assert perm_mismatches[0].item == "~/.config/test.conf"
        assert perm_mismatches[0].expected.mode == "0644"
        assert perm_mismatches[0].actual.mode == "755"

    @pytest.mark.asyncio
    async def test_file_wrong_content(self, mock_session, test_server, temp_packs_dir):
        """Test detection of wrong file content hash."""
        # SSH response indicates wrong content hash
        ssh_response = "/home/testuser/.config/test.conf|EXISTS|644|hash123\n/home/testuser/.bashrc|EXISTS|644|wronghash"

        mock_client = MockSSHClient({"default": ssh_response})
        mock_executor = MagicMock(spec=SSHPooledExecutor)
        mock_executor.get_connection = AsyncMock(return_value=mock_client)

        pack_service = ConfigPackService(packs_dir=temp_packs_dir)
        service = ComplianceCheckService(pack_service, mock_executor)

        result = await service.check_compliance(
            session=mock_session,
            server=test_server,
            pack_name="test-pack",
        )

        # Should have mismatch for wrong content
        content_mismatches = [m for m in result.mismatches if m.type == "wrong_content"]
        assert len(content_mismatches) == 1
        assert content_mismatches[0].item == "~/.bashrc"
        assert content_mismatches[0].expected.hash == "sha256:abc123"


class TestPackageChecking:
    """Tests for package compliance checking."""

    @pytest.mark.asyncio
    async def test_package_missing(self, mock_session, test_server, temp_packs_dir):
        """Test detection of missing package."""
        # File check passes
        file_response = "/home/testuser/.config/test.conf|EXISTS|644|hash\n/home/testuser/.bashrc|EXISTS|644|abc123"

        # Package check - curl not installed
        pkg_response = "git\t2.40.0\tinstall ok installed"

        mock_client = MockSSHClient({
            "stat": file_response,
            "dpkg-query": pkg_response,
            "echo": "EDITOR=vim",
        })
        mock_executor = MagicMock(spec=SSHPooledExecutor)
        mock_executor.get_connection = AsyncMock(return_value=mock_client)

        pack_service = ConfigPackService(packs_dir=temp_packs_dir)
        service = ComplianceCheckService(pack_service, mock_executor)

        result = await service.check_compliance(
            session=mock_session,
            server=test_server,
            pack_name="test-pack",
        )

        # Should have mismatch for missing package
        pkg_mismatches = [m for m in result.mismatches if m.type == "missing_package"]
        assert len(pkg_mismatches) == 1
        assert pkg_mismatches[0].item == "curl"
        assert pkg_mismatches[0].expected.installed is True
        assert pkg_mismatches[0].actual.installed is False

    @pytest.mark.asyncio
    async def test_package_wrong_version(self, mock_session, test_server, temp_packs_dir):
        """Test detection of package with wrong version."""
        # File check passes
        file_response = "/home/testuser/.config/test.conf|EXISTS|644|hash\n/home/testuser/.bashrc|EXISTS|644|abc123"

        # Package check - curl installed but old version
        pkg_response = "curl\t7.88.0-1\tinstall ok installed\ngit\t2.40.0\tinstall ok installed"

        mock_client = MockSSHClient({
            "stat": file_response,
            "dpkg-query": pkg_response,
            "echo": "EDITOR=vim",
        })
        mock_executor = MagicMock(spec=SSHPooledExecutor)
        mock_executor.get_connection = AsyncMock(return_value=mock_client)

        pack_service = ConfigPackService(packs_dir=temp_packs_dir)
        service = ComplianceCheckService(pack_service, mock_executor)

        result = await service.check_compliance(
            session=mock_session,
            server=test_server,
            pack_name="test-pack",
        )

        # Should have mismatch for wrong version
        ver_mismatches = [m for m in result.mismatches if m.type == "wrong_version"]
        assert len(ver_mismatches) == 1
        assert ver_mismatches[0].item == "curl"
        assert ver_mismatches[0].expected.min_version == "8.0.0"
        assert ver_mismatches[0].actual.version == "7.88.0-1"


class TestSettingChecking:
    """Tests for setting compliance checking."""

    @pytest.mark.asyncio
    async def test_setting_wrong_value(self, mock_session, test_server, temp_packs_dir):
        """Test detection of wrong environment variable value."""
        # File check passes
        file_response = "/home/testuser/.config/test.conf|EXISTS|644|hash\n/home/testuser/.bashrc|EXISTS|644|abc123"

        # Package check passes
        pkg_response = "curl\t8.5.0\tinstall ok installed\ngit\t2.40.0\tinstall ok installed"

        # Setting check - wrong EDITOR value
        setting_response = "EDITOR=nano"

        mock_client = MockSSHClient({
            "stat": file_response,
            "dpkg-query": pkg_response,
            "echo": setting_response,
        })
        mock_executor = MagicMock(spec=SSHPooledExecutor)
        mock_executor.get_connection = AsyncMock(return_value=mock_client)

        pack_service = ConfigPackService(packs_dir=temp_packs_dir)
        service = ComplianceCheckService(pack_service, mock_executor)

        result = await service.check_compliance(
            session=mock_session,
            server=test_server,
            pack_name="test-pack",
        )

        # Should have mismatch for wrong setting
        setting_mismatches = [m for m in result.mismatches if m.type == "wrong_setting"]
        assert len(setting_mismatches) == 1
        assert setting_mismatches[0].item == "EDITOR"
        assert setting_mismatches[0].expected.value == "vim"
        assert setting_mismatches[0].actual.value == "nano"


class TestFullCompliance:
    """Tests for full compliance scenarios."""

    @pytest.mark.asyncio
    async def test_all_compliant(self, mock_session, test_server, temp_packs_dir):
        """Test when server is fully compliant."""
        # All checks pass
        file_response = "/home/testuser/.config/test.conf|EXISTS|644|hash\n/home/testuser/.bashrc|EXISTS|644|abc123"
        pkg_response = "curl\t8.5.0\tinstall ok installed\ngit\t2.40.0\tinstall ok installed"
        setting_response = "EDITOR=vim"

        mock_client = MockSSHClient({
            "stat": file_response,
            "dpkg-query": pkg_response,
            "echo": setting_response,
        })
        mock_executor = MagicMock(spec=SSHPooledExecutor)
        mock_executor.get_connection = AsyncMock(return_value=mock_client)

        pack_service = ConfigPackService(packs_dir=temp_packs_dir)
        service = ComplianceCheckService(pack_service, mock_executor)

        result = await service.check_compliance(
            session=mock_session,
            server=test_server,
            pack_name="test-pack",
        )

        assert result.is_compliant is True
        assert result.mismatches == []
        assert result.check_duration_ms >= 0

    @pytest.mark.asyncio
    async def test_stores_result_in_database(self, mock_session, test_server, temp_packs_dir):
        """Test that compliance result is stored in database."""
        file_response = "/home/testuser/.config/test.conf|EXISTS|644|hash\n/home/testuser/.bashrc|EXISTS|644|abc123"
        pkg_response = "curl\t8.5.0\tinstall ok installed\ngit\t2.40.0\tinstall ok installed"
        setting_response = "EDITOR=vim"

        mock_client = MockSSHClient({
            "stat": file_response,
            "dpkg-query": pkg_response,
            "echo": setting_response,
        })
        mock_executor = MagicMock(spec=SSHPooledExecutor)
        mock_executor.get_connection = AsyncMock(return_value=mock_client)

        pack_service = ConfigPackService(packs_dir=temp_packs_dir)
        service = ComplianceCheckService(pack_service, mock_executor)

        await service.check_compliance(
            session=mock_session,
            server=test_server,
            pack_name="test-pack",
        )

        # Verify session.add was called with ConfigCheck
        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()

        # Check the ConfigCheck object
        added_obj = mock_session.add.call_args[0][0]
        assert added_obj.server_id == "test-server"
        assert added_obj.pack_name == "test-pack"
        assert added_obj.is_compliant is True
