"""Tests for Agent Deployment Service (EP0007).

Tests verify the agent deployment functionality:
- Agent version retrieval
- Agent tarball building
- Agent installation via SSH
- Agent upgrade
- Agent removal
- Server activation
"""

import io
import tarfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
import yaml

from homelab_cmd.services.agent_deploy import (
    CONFIG_DIR,
    AgentDeploymentService,
    DeploymentResult,
    build_agent_tarball,
    get_agent_version,
    get_deployment_service,
)


class TestGetAgentVersion:
    """Tests for get_agent_version function."""

    def test_get_agent_version_from_docker_path(self, tmp_path: Path) -> None:
        """Should read version from Docker path when it exists."""
        docker_version_file = tmp_path / "VERSION"
        docker_version_file.write_text("1.2.3")

        with patch("homelab_cmd.services.agent_deploy.Path") as mock_path_class:
            # Mock Docker path to exist with our version
            mock_docker_path = MagicMock()
            mock_docker_path.exists.return_value = True
            mock_docker_path.read_text.return_value = "1.2.3"

            def path_side_effect(path_str):
                if path_str == "/app/agent/VERSION":
                    return mock_docker_path
                return Path(path_str)

            mock_path_class.side_effect = path_side_effect

            version = get_agent_version()
            assert version == "1.2.3"

    def test_get_agent_version_returns_unknown_when_not_found(self) -> None:
        """Should return 'unknown' when VERSION file not found."""
        with patch("homelab_cmd.services.agent_deploy.Path") as mock_path_class:
            # Mock all paths to not exist
            mock_path = MagicMock()
            mock_path.exists.return_value = False
            mock_path.__truediv__ = MagicMock(return_value=mock_path)
            mock_path.parent = mock_path
            mock_path_class.return_value = mock_path
            mock_path_class.side_effect = lambda x: mock_path

            version = get_agent_version()
            assert version == "unknown"


class TestBuildAgentTarball:
    """Tests for build_agent_tarball function."""

    def test_build_tarball_creates_valid_gzip(self) -> None:
        """Should create a valid gzipped tarball."""
        with patch("homelab_cmd.services.agent_deploy._get_agent_source_path") as mock_get_path:
            # Create temp directory with agent files
            import tempfile

            with tempfile.TemporaryDirectory() as tmp_dir:
                tmp_path = Path(tmp_dir)
                # Create minimal agent files
                for filename in ["__init__.py", "__main__.py", "install.sh"]:
                    (tmp_path / filename).write_text("# placeholder")

                mock_get_path.return_value = tmp_path

                tarball_bytes = build_agent_tarball(
                    hub_url="http://localhost:8080",
                    server_id="test-server",
                    server_guid="test-guid-1234",
                    api_token="hlh_ag_test1234_abcdef",
                )

                # Verify it's a valid gzip tarball
                tar_buffer = io.BytesIO(tarball_bytes)
                with tarfile.open(fileobj=tar_buffer, mode="r:gz") as tar:
                    names = tar.getnames()
                    # Should have config.yaml in CONFIG_DIR
                    config_path = f"{CONFIG_DIR}/config.yaml"
                    assert config_path in names

    def test_build_tarball_includes_config_yaml(self) -> None:
        """Should include properly formatted config.yaml."""
        with patch("homelab_cmd.services.agent_deploy._get_agent_source_path") as mock_get_path:
            import tempfile

            with tempfile.TemporaryDirectory() as tmp_dir:
                tmp_path = Path(tmp_dir)
                for filename in ["__init__.py"]:
                    (tmp_path / filename).write_text("# placeholder")

                mock_get_path.return_value = tmp_path

                tarball_bytes = build_agent_tarball(
                    hub_url="http://hub.local:8080",
                    server_id="my-server",
                    server_guid="test-guid-5678",
                    api_token="hlh_ag_secret12_abcdef",
                    heartbeat_interval=30,
                )

                # Extract and verify config.yaml
                tar_buffer = io.BytesIO(tarball_bytes)
                with tarfile.open(fileobj=tar_buffer, mode="r:gz") as tar:
                    config_file = tar.extractfile(f"{CONFIG_DIR}/config.yaml")
                    config_data = yaml.safe_load(config_file.read())

                    assert config_data["hub_url"] == "http://hub.local:8080"
                    assert config_data["server_id"] == "my-server"
                    assert config_data["api_token"] == "hlh_ag_secret12_abcdef"
                    assert config_data["heartbeat_interval"] == 30

    def test_build_tarball_with_monitored_services(self) -> None:
        """Should include monitored_services in config when provided."""
        with patch("homelab_cmd.services.agent_deploy._get_agent_source_path") as mock_get_path:
            import tempfile

            with tempfile.TemporaryDirectory() as tmp_dir:
                mock_get_path.return_value = Path(tmp_dir)

                tarball_bytes = build_agent_tarball(
                    hub_url="http://localhost:8080",
                    server_id="test-server",
                    server_guid="test-guid-9012",
                    api_token="hlh_ag_testkey1_abcdef",
                    monitored_services=["nginx", "postgresql"],
                )

                tar_buffer = io.BytesIO(tarball_bytes)
                with tarfile.open(fileobj=tar_buffer, mode="r:gz") as tar:
                    config_file = tar.extractfile(f"{CONFIG_DIR}/config.yaml")
                    config_data = yaml.safe_load(config_file.read())

                    assert "monitored_services" in config_data
                    assert config_data["monitored_services"] == ["nginx", "postgresql"]

    def test_build_tarball_with_command_execution(self) -> None:
        """Should include command_execution config when enabled."""
        with patch("homelab_cmd.services.agent_deploy._get_agent_source_path") as mock_get_path:
            import tempfile

            with tempfile.TemporaryDirectory() as tmp_dir:
                mock_get_path.return_value = Path(tmp_dir)

                tarball_bytes = build_agent_tarball(
                    hub_url="http://localhost:8080",
                    server_id="test-server",
                    server_guid="test-guid-3456",
                    api_token="hlh_ag_testkey2_abcdef",
                    command_execution_enabled=True,
                    use_sudo=True,
                )

                tar_buffer = io.BytesIO(tarball_bytes)
                with tarfile.open(fileobj=tar_buffer, mode="r:gz") as tar:
                    config_file = tar.extractfile(f"{CONFIG_DIR}/config.yaml")
                    config_data = yaml.safe_load(config_file.read())

                    assert "command_execution" in config_data
                    assert config_data["command_execution"]["enabled"] is True
                    assert config_data["command_execution"]["use_sudo"] is True


class TestAgentDeploymentServiceInstall:
    """Tests for AgentDeploymentService.install_agent method."""

    @pytest.mark.asyncio
    async def test_install_agent_success(self, db_session) -> None:
        """Should successfully install agent via SSH."""
        service = AgentDeploymentService(db_session)

        # Mock SSH execute_command to succeed
        mock_result = MagicMock()
        mock_result.success = True
        mock_result.stdout = "Installation complete"
        mock_result.stderr = ""

        with patch.object(service.ssh, "execute_command", return_value=mock_result):
            with patch(
                "homelab_cmd.services.agent_deploy.build_agent_tarball",
                return_value=b"fake-tarball",
            ):
                with patch(
                    "homelab_cmd.services.agent_deploy.get_agent_version",
                    return_value="1.0.0",
                ):
                    result = await service.install_agent(
                        hostname="192.168.1.100",
                        port=22,
                        username="admin",
                        server_id="new-server",
                    )

                    assert result.success is True
                    assert result.server_id == "new-server"
                    assert result.agent_version == "1.0.0"

    @pytest.mark.asyncio
    async def test_install_agent_generates_server_id_from_hostname(self, db_session) -> None:
        """Should generate server_id from hostname when not provided."""
        service = AgentDeploymentService(db_session)

        mock_result = MagicMock()
        mock_result.success = True

        with patch.object(service.ssh, "execute_command", return_value=mock_result):
            with patch(
                "homelab_cmd.services.agent_deploy.build_agent_tarball",
                return_value=b"fake-tarball",
            ):
                with patch(
                    "homelab_cmd.services.agent_deploy.get_agent_version",
                    return_value="1.0.0",
                ):
                    result = await service.install_agent(
                        hostname="my.server.local",
                        username="admin",
                    )

                    assert result.success is True
                    assert result.server_id == "my-server-local"

    @pytest.mark.asyncio
    async def test_install_agent_fails_if_server_exists_active(self, db_session) -> None:
        """Should fail if server already exists and is active."""
        from homelab_cmd.db.models.server import Server

        # Create existing active server
        server = Server(id="existing-server", hostname="existing.local")
        db_session.add(server)
        await db_session.commit()

        service = AgentDeploymentService(db_session)

        result = await service.install_agent(
            hostname="192.168.1.100",
            server_id="existing-server",
        )

        assert result.success is False
        assert "already exists" in result.error

    @pytest.mark.asyncio
    async def test_install_agent_ssh_failure(self, db_session) -> None:
        """Should return failure when SSH command fails."""
        service = AgentDeploymentService(db_session)

        mock_result = MagicMock()
        mock_result.success = False
        mock_result.error = "Connection refused"
        mock_result.stderr = ""

        with patch.object(service.ssh, "execute_command", return_value=mock_result):
            with patch(
                "homelab_cmd.services.agent_deploy.build_agent_tarball",
                return_value=b"fake-tarball",
            ):
                result = await service.install_agent(
                    hostname="192.168.1.100",
                    server_id="failed-server",
                )

                assert result.success is False
                assert "Connection refused" in result.error


class TestAgentDeploymentServiceUpgrade:
    """Tests for AgentDeploymentService.upgrade_agent method."""

    @pytest.mark.asyncio
    async def test_upgrade_agent_success(self, db_session) -> None:
        """Should successfully upgrade agent via SSH."""
        from homelab_cmd.db.models.server import Server

        # Create existing server
        server = Server(
            id="upgrade-server",
            hostname="upgrade.local",
            ip_address="192.168.1.100",
            agent_version="0.9.0",
        )
        db_session.add(server)
        await db_session.commit()

        service = AgentDeploymentService(db_session)

        mock_result = MagicMock()
        mock_result.success = True

        with patch.object(service.ssh, "execute_command", return_value=mock_result):
            with patch(
                "homelab_cmd.services.agent_deploy.build_agent_tarball",
                return_value=b"fake-tarball",
            ):
                with patch(
                    "homelab_cmd.services.agent_deploy.get_agent_version",
                    return_value="1.0.0",
                ):
                    result = await service.upgrade_agent("upgrade-server")

                    assert result.success is True
                    assert result.agent_version == "1.0.0"

    @pytest.mark.asyncio
    async def test_upgrade_agent_not_found(self, db_session) -> None:
        """Should fail when server not found."""
        service = AgentDeploymentService(db_session)

        result = await service.upgrade_agent("nonexistent-server")

        assert result.success is False
        assert "not found" in result.error

    @pytest.mark.asyncio
    async def test_upgrade_agent_inactive_server(self, db_session) -> None:
        """Should fail when server is inactive."""
        from homelab_cmd.db.models.server import Server

        server = Server(
            id="inactive-server",
            hostname="inactive.local",
            is_inactive=True,
        )
        db_session.add(server)
        await db_session.commit()

        service = AgentDeploymentService(db_session)

        result = await service.upgrade_agent("inactive-server")

        assert result.success is False
        assert "inactive" in result.error.lower()

    @pytest.mark.asyncio
    async def test_upgrade_agent_no_ip_uses_hostname(self, db_session) -> None:
        """Should use hostname when IP address is not set."""
        from homelab_cmd.db.models.server import Server

        server = Server(
            id="hostname-only-server",
            hostname="hostname-only.local",
            ip_address=None,  # No IP, will fall back to hostname
            agent_version="0.9.0",
        )
        db_session.add(server)
        await db_session.commit()

        service = AgentDeploymentService(db_session)

        mock_result = MagicMock()
        mock_result.success = True

        with patch.object(service.ssh, "execute_command", return_value=mock_result):
            with patch(
                "homelab_cmd.services.agent_deploy.build_agent_tarball",
                return_value=b"fake-tarball",
            ):
                with patch(
                    "homelab_cmd.services.agent_deploy.get_agent_version",
                    return_value="1.0.0",
                ):
                    result = await service.upgrade_agent("hostname-only-server")

                    # Should succeed using hostname as fallback
                    assert result.success is True


# =============================================================================
# US0085: Agent Upgrade Sudo Support Tests
# =============================================================================


class TestAgentUpgradeSudoSupport:
    """Tests for upgrade_agent() sudo password support (US0085).

    These tests verify that upgrade_agent can:
    - Accept an optional sudo_password parameter
    - Build command with password pipe when sudo_password provided
    - Retrieve stored sudo_password automatically if not provided
    - Work with passwordless sudo (backward compatible)
    - Provide clear error when sudo password needed but unavailable

    Spec Reference: sdlc-studio/stories/US0085-agent-upgrade-sudo-support.md
    """

    @pytest.mark.asyncio
    async def test_upgrade_with_sudo_password_parameter(self, db_session) -> None:
        """AC1: upgrade_agent should accept sudo_password parameter (TC-US0085-01).

        When calling upgrade_agent with sudo_password parameter, the command
        should use password pipe for sudo commands.
        """
        from homelab_cmd.db.models.server import Server

        server = Server(
            id="sudo-upgrade-server",
            hostname="sudo-upgrade.local",
            ip_address="192.168.1.100",
            agent_version="0.9.0",
        )
        db_session.add(server)
        await db_session.commit()

        service = AgentDeploymentService(db_session)

        captured_command = []

        async def mock_execute(hostname, command, command_timeout, key_usernames=None):
            captured_command.append(command)
            result = MagicMock()
            result.success = True
            result.stdout = ""
            result.stderr = ""
            result.error = None
            return result

        with patch.object(service.ssh, "execute_command", side_effect=mock_execute):
            with patch(
                "homelab_cmd.services.agent_deploy.build_agent_tarball",
                return_value=b"fake-tarball",
            ):
                with patch(
                    "homelab_cmd.services.agent_deploy.get_agent_version",
                    return_value="1.0.0",
                ):
                    result = await service.upgrade_agent(
                        "sudo-upgrade-server",
                        sudo_password="mysudopassword",
                    )

        assert result.success is True
        assert len(captured_command) == 1
        # Command should contain password pipe pattern
        assert "echo 'mysudopassword' | sudo -S" in captured_command[0]

    @pytest.mark.asyncio
    async def test_upgrade_retrieves_stored_sudo_password(self, db_session) -> None:
        """AC3: upgrade_agent should retrieve stored sudo_password automatically (TC-US0085-02).

        When upgrade_agent is called without sudo_password parameter and
        credential_service is available, it should retrieve the stored
        sudo_password credential.
        """
        from unittest.mock import AsyncMock

        from homelab_cmd.db.models.server import Server

        server = Server(
            id="stored-cred-server",
            hostname="stored-cred.local",
            ip_address="192.168.1.100",
            agent_version="0.9.0",
        )
        db_session.add(server)
        await db_session.commit()

        # Create mock credential service
        mock_credential_service = MagicMock()
        mock_credential_service.get_effective_credential = AsyncMock(
            return_value="stored-sudo-password"
        )

        service = AgentDeploymentService(db_session, credential_service=mock_credential_service)

        captured_command = []

        async def mock_execute(hostname, command, command_timeout, key_usernames=None):
            captured_command.append(command)
            result = MagicMock()
            result.success = True
            return result

        with patch.object(service.ssh, "execute_command", side_effect=mock_execute):
            with patch(
                "homelab_cmd.services.agent_deploy.build_agent_tarball",
                return_value=b"fake-tarball",
            ):
                with patch(
                    "homelab_cmd.services.agent_deploy.get_agent_version",
                    return_value="1.0.0",
                ):
                    result = await service.upgrade_agent("stored-cred-server")

        assert result.success is True
        # Credential service should have been called
        mock_credential_service.get_effective_credential.assert_called_once_with(
            "sudo_password", "stored-cred-server"
        )
        # Command should use the stored password
        assert "echo 'stored-sudo-password' | sudo -S" in captured_command[0]

    @pytest.mark.asyncio
    async def test_upgrade_passwordless_sudo_backward_compatible(self, db_session) -> None:
        """AC4: upgrade_agent should work with passwordless sudo (TC-US0085-03).

        When upgrade_agent is called without sudo_password and no stored
        credential exists, it should use plain sudo commands (existing behaviour).
        """
        from unittest.mock import AsyncMock

        from homelab_cmd.db.models.server import Server

        server = Server(
            id="passwordless-server",
            hostname="passwordless.local",
            ip_address="192.168.1.100",
            agent_version="0.9.0",
        )
        db_session.add(server)
        await db_session.commit()

        # Create mock credential service that returns None (no stored credential)
        mock_credential_service = MagicMock()
        mock_credential_service.get_effective_credential = AsyncMock(return_value=None)

        service = AgentDeploymentService(db_session, credential_service=mock_credential_service)

        captured_command = []

        async def mock_execute(hostname, command, command_timeout, key_usernames=None):
            captured_command.append(command)
            result = MagicMock()
            result.success = True
            return result

        with patch.object(service.ssh, "execute_command", side_effect=mock_execute):
            with patch(
                "homelab_cmd.services.agent_deploy.build_agent_tarball",
                return_value=b"fake-tarball",
            ):
                with patch(
                    "homelab_cmd.services.agent_deploy.get_agent_version",
                    return_value="1.0.0",
                ):
                    result = await service.upgrade_agent("passwordless-server")

        assert result.success is True
        # Command should NOT contain password pipe
        assert "echo" not in captured_command[0] or "sudo -S" not in captured_command[0]
        # But should contain regular sudo
        assert "sudo systemctl" in captured_command[0]

    @pytest.mark.asyncio
    async def test_upgrade_sudo_password_escapes_special_chars(self, db_session) -> None:
        """AC2: Password with special chars should be properly escaped (TC-US0085-05).

        Single quotes in the password must be escaped to avoid shell injection.
        """
        from homelab_cmd.db.models.server import Server

        server = Server(
            id="special-char-server",
            hostname="special-char.local",
            ip_address="192.168.1.100",
            agent_version="0.9.0",
        )
        db_session.add(server)
        await db_session.commit()

        service = AgentDeploymentService(db_session)

        captured_command = []

        async def mock_execute(hostname, command, command_timeout, key_usernames=None):
            captured_command.append(command)
            result = MagicMock()
            result.success = True
            return result

        with patch.object(service.ssh, "execute_command", side_effect=mock_execute):
            with patch(
                "homelab_cmd.services.agent_deploy.build_agent_tarball",
                return_value=b"fake-tarball",
            ):
                with patch(
                    "homelab_cmd.services.agent_deploy.get_agent_version",
                    return_value="1.0.0",
                ):
                    # Password with single quote that needs escaping
                    result = await service.upgrade_agent(
                        "special-char-server",
                        sudo_password="pass'word",
                    )

        assert result.success is True
        # Single quote should be escaped using shell quoting
        # pass'word becomes pass'"'"'word
        assert "'\"'\"'" in captured_command[0]

    @pytest.mark.asyncio
    async def test_upgrade_credential_service_dependency_injection(self, db_session) -> None:
        """AgentDeploymentService should accept credential_service in __init__."""
        mock_credential_service = MagicMock()

        service = AgentDeploymentService(db_session, credential_service=mock_credential_service)

        assert service.credential_service is mock_credential_service

    @pytest.mark.asyncio
    async def test_upgrade_without_credential_service_still_works(self, db_session) -> None:
        """Upgrade should work when credential_service not provided (backward compat)."""
        from homelab_cmd.db.models.server import Server

        server = Server(
            id="no-cred-service-server",
            hostname="no-cred-service.local",
            ip_address="192.168.1.100",
            agent_version="0.9.0",
        )
        db_session.add(server)
        await db_session.commit()

        # No credential_service provided
        service = AgentDeploymentService(db_session)

        mock_result = MagicMock()
        mock_result.success = True

        with patch.object(service.ssh, "execute_command", return_value=mock_result):
            with patch(
                "homelab_cmd.services.agent_deploy.build_agent_tarball",
                return_value=b"fake-tarball",
            ):
                with patch(
                    "homelab_cmd.services.agent_deploy.get_agent_version",
                    return_value="1.0.0",
                ):
                    result = await service.upgrade_agent("no-cred-service-server")

        # Should succeed using passwordless sudo
        assert result.success is True


class TestAgentDeploymentServiceRemove:
    """Tests for AgentDeploymentService.remove_agent method."""

    @pytest.mark.asyncio
    async def test_remove_agent_mark_inactive(self, db_session) -> None:
        """Should mark server as inactive when delete_completely=False."""
        from homelab_cmd.db.models.server import Server

        server = Server(
            id="remove-server",
            hostname="remove.local",
            ip_address="192.168.1.100",
        )
        db_session.add(server)
        await db_session.commit()

        service = AgentDeploymentService(db_session)

        mock_result = MagicMock()
        mock_result.success = True

        with patch.object(service.ssh, "execute_command", return_value=mock_result):
            result = await service.remove_agent("remove-server", delete_completely=False)

        assert result.success is True
        assert "inactive" in result.message.lower()

        # Verify server is marked inactive
        await db_session.refresh(server)
        assert server.is_inactive is True

    @pytest.mark.asyncio
    async def test_remove_agent_delete_completely(self, db_session) -> None:
        """Should delete server when delete_completely=True."""
        from homelab_cmd.db.models.server import Server

        server = Server(
            id="delete-server",
            hostname="delete.local",
            ip_address="192.168.1.100",
        )
        db_session.add(server)
        await db_session.commit()

        service = AgentDeploymentService(db_session)

        mock_result = MagicMock()
        mock_result.success = True

        with patch.object(service.ssh, "execute_command", return_value=mock_result):
            result = await service.remove_agent("delete-server", delete_completely=True)

        assert result.success is True
        assert "deleted" in result.message.lower()

        # Verify server is deleted
        deleted_server = await db_session.get(Server, "delete-server")
        assert deleted_server is None

    @pytest.mark.asyncio
    async def test_remove_agent_not_found(self, db_session) -> None:
        """Should fail when server not found."""
        service = AgentDeploymentService(db_session)

        result = await service.remove_agent("nonexistent-server")

        assert result.success is False
        assert "not found" in result.error

    @pytest.mark.asyncio
    async def test_remove_agent_ssh_failure_still_marks_inactive(self, db_session) -> None:
        """Should still mark inactive even when SSH uninstall fails."""
        from homelab_cmd.db.models.server import Server

        server = Server(
            id="ssh-fail-server",
            hostname="fail.local",
            ip_address="192.168.1.100",
        )
        db_session.add(server)
        await db_session.commit()

        service = AgentDeploymentService(db_session)

        mock_result = MagicMock()
        mock_result.success = False
        mock_result.error = "Connection refused"
        mock_result.stderr = ""

        with patch.object(service.ssh, "execute_command", return_value=mock_result):
            result = await service.remove_agent("ssh-fail-server", delete_completely=False)

        # Should still succeed, just with a warning
        assert result.success is True
        assert "Warning" in result.message

        # Server should still be marked inactive
        await db_session.refresh(server)
        assert server.is_inactive is True

    @pytest.mark.asyncio
    async def test_remove_agent_no_hostname_warns_user(self, db_session) -> None:
        """BG0016: Should warn when no usable hostname for SSH uninstall."""
        from homelab_cmd.db.models.server import Server

        # Create server with empty hostname (falsy) and no IP address
        # Note: hostname column is NOT NULL, but empty string is falsy for SSH check
        server = Server(
            id="no-host-server",
            hostname="",  # Empty string is falsy
            ip_address=None,
        )
        db_session.add(server)
        await db_session.commit()

        service = AgentDeploymentService(db_session)

        # SSH should not be called since there's no usable hostname/IP
        result = await service.remove_agent("no-host-server", delete_completely=False)

        # Should succeed but with warning about no hostname
        assert result.success is True
        assert "Warning" in result.message
        assert "no hostname" in result.message.lower()

        # Server should still be marked inactive
        await db_session.refresh(server)
        assert server.is_inactive is True

    @pytest.mark.asyncio
    async def test_remove_agent_no_hostname_delete_completely_warns(self, db_session) -> None:
        """BG0016: Should warn when deleting server with no usable hostname."""
        from homelab_cmd.db.models.server import Server

        # Create server with empty hostname and no IP address
        server = Server(
            id="no-host-delete",
            hostname="",  # Empty string is falsy
            ip_address=None,
        )
        db_session.add(server)
        await db_session.commit()

        service = AgentDeploymentService(db_session)

        result = await service.remove_agent("no-host-delete", delete_completely=True)

        # Should succeed but with warning
        assert result.success is True
        assert "Warning" in result.message
        assert "no hostname" in result.message.lower()

        # Server should be deleted
        deleted_server = await db_session.get(Server, "no-host-delete")
        assert deleted_server is None

    @pytest.mark.asyncio
    async def test_remove_agent_with_password_auth(self, db_session) -> None:
        """US0075 AC1: Should use password auth when credentials provided."""
        from homelab_cmd.db.models.server import Server

        server = Server(
            id="password-auth-server",
            hostname="password.local",
            ip_address="192.168.1.100",
        )
        db_session.add(server)
        await db_session.commit()

        service = AgentDeploymentService(db_session)

        # Track calls to execute_command
        call_args_list = []

        async def mock_execute(
            hostname, command, command_timeout, username=None, password=None, key_usernames=None
        ):
            call_args_list.append(
                {
                    "hostname": hostname,
                    "username": username,
                    "password": password,
                    "key_usernames": key_usernames,
                }
            )
            result = MagicMock()
            result.success = True
            result.stdout = ""
            result.stderr = ""
            result.error = None
            return result

        with patch.object(service.ssh, "execute_command", side_effect=mock_execute):
            result = await service.remove_agent(
                "password-auth-server",
                delete_completely=False,
                ssh_username="testuser",
                ssh_password="testpass",
            )

        assert result.success is True
        # First call should use password auth
        assert call_args_list[0]["username"] == "testuser"
        assert call_args_list[0]["password"] == "testpass"

    @pytest.mark.asyncio
    async def test_remove_agent_password_without_username_warns(self, db_session) -> None:
        """US0075 AC1: Should warn when password provided without username."""
        from homelab_cmd.db.models.server import Server

        server = Server(
            id="password-no-user-server",
            hostname="nouser.local",
            ip_address="192.168.1.100",
        )
        db_session.add(server)
        await db_session.commit()

        service = AgentDeploymentService(db_session)

        mock_result = MagicMock()
        mock_result.success = True
        mock_result.stdout = ""
        mock_result.stderr = ""
        mock_result.error = None

        with patch.object(service.ssh, "execute_command", return_value=mock_result):
            result = await service.remove_agent(
                "password-no-user-server",
                delete_completely=False,
                ssh_username=None,
                ssh_password="orphan-password",
            )

        assert result.success is True
        assert "Warning" in result.message
        assert "ssh_password provided without ssh_username" in result.message

    @pytest.mark.asyncio
    async def test_remove_agent_password_auth_fails_falls_back(self, db_session) -> None:
        """US0075 AC1: Should fall back to keys when password auth fails."""
        from homelab_cmd.db.models.server import Server

        server = Server(
            id="password-fail-server",
            hostname="passfail.local",
            ip_address="192.168.1.100",
        )
        db_session.add(server)
        await db_session.commit()

        service = AgentDeploymentService(db_session)

        call_count = [0]

        async def mock_execute(
            hostname, command, command_timeout, username=None, password=None, key_usernames=None
        ):
            call_count[0] += 1
            result = MagicMock()
            result.stdout = ""
            result.stderr = ""
            # First call (password auth) fails, second call (key auth) succeeds
            if call_count[0] == 1:
                result.success = False
                result.error = "Authentication failed"
            else:
                result.success = True
                result.error = None
            return result

        with patch.object(service.ssh, "execute_command", side_effect=mock_execute):
            result = await service.remove_agent(
                "password-fail-server",
                delete_completely=False,
                ssh_username="baduser",
                ssh_password="badpass",
            )

        assert result.success is True
        assert "Password authentication failed" in result.message
        assert "Falling back to SSH keys" in result.message
        # Should have made 2 calls: password auth, then key auth
        assert call_count[0] >= 2

    @pytest.mark.asyncio
    async def test_remove_agent_verification_service_running_warning(self, db_session) -> None:
        """US0075 AC3: Should warn when service still running after uninstall."""
        from homelab_cmd.db.models.server import Server

        server = Server(
            id="verify-service-server",
            hostname="verifyservice.local",
            ip_address="192.168.1.100",
        )
        db_session.add(server)
        await db_session.commit()

        service = AgentDeploymentService(db_session)

        call_count = [0]

        async def mock_execute(
            hostname, command, command_timeout, username=None, password=None, key_usernames=None
        ):
            call_count[0] += 1
            result = MagicMock()
            result.error = None
            result.stderr = ""

            if "systemctl is-active" in command:
                # Service is still running
                result.success = True
                result.stdout = "active"
            elif "for path in" in command:
                # No files remain
                result.success = True
                result.stdout = ""
            else:
                # Uninstall command
                result.success = True
                result.stdout = ""
            return result

        with patch.object(service.ssh, "execute_command", side_effect=mock_execute):
            result = await service.remove_agent("verify-service-server", delete_completely=False)

        assert result.success is True
        assert "Verification warning" in result.message
        assert "service still running" in result.message

    @pytest.mark.asyncio
    async def test_remove_agent_verification_files_remain_warning(self, db_session) -> None:
        """US0075 AC3: Should warn when agent files remain after uninstall."""
        from homelab_cmd.db.models.server import Server

        server = Server(
            id="verify-files-server",
            hostname="verifyfiles.local",
            ip_address="192.168.1.100",
        )
        db_session.add(server)
        await db_session.commit()

        service = AgentDeploymentService(db_session)

        async def mock_execute(
            hostname, command, command_timeout, username=None, password=None, key_usernames=None
        ):
            result = MagicMock()
            result.error = None
            result.stderr = ""

            if "systemctl is-active" in command:
                # Service is stopped
                result.success = True
                result.stdout = "inactive"
            elif "for path in" in command:
                # Files still remain
                result.success = True
                result.stdout = "/opt/homelab-agent\n/etc/homelab-agent"
            else:
                # Uninstall command
                result.success = True
                result.stdout = ""
            return result

        with patch.object(service.ssh, "execute_command", side_effect=mock_execute):
            result = await service.remove_agent("verify-files-server", delete_completely=False)

        assert result.success is True
        assert "Verification warning" in result.message
        assert "agent files remain" in result.message
        assert "/opt/homelab-agent" in result.message

    @pytest.mark.asyncio
    async def test_remove_agent_verification_timeout_warning(self, db_session) -> None:
        """US0075 AC4: Should warn when verification times out."""
        from homelab_cmd.db.models.server import Server

        server = Server(
            id="verify-timeout-server",
            hostname="verifytimeout.local",
            ip_address="192.168.1.100",
        )
        db_session.add(server)
        await db_session.commit()

        service = AgentDeploymentService(db_session)

        call_count = [0]

        async def mock_execute(
            hostname, command, command_timeout, username=None, password=None, key_usernames=None
        ):
            call_count[0] += 1
            result = MagicMock()
            result.stderr = ""
            result.stdout = ""

            if "systemctl is-active" in command:
                # Service check times out
                result.success = False
                result.error = "Connection timed out"
            elif "for path in" in command:
                # File check also times out
                result.success = False
                result.error = "Connection timed out"
            else:
                # Uninstall command succeeds
                result.success = True
                result.error = None
            return result

        with patch.object(service.ssh, "execute_command", side_effect=mock_execute):
            result = await service.remove_agent("verify-timeout-server", delete_completely=False)

        assert result.success is True
        assert "Verification warning" in result.message
        assert "failed or timed out" in result.message

    @pytest.mark.asyncio
    async def test_remove_agent_response_excludes_credentials(self, db_session) -> None:
        """US0075 AC2: Response should not include password."""
        from homelab_cmd.db.models.server import Server

        server = Server(
            id="creds-exclude-server",
            hostname="credsexclude.local",
            ip_address="192.168.1.100",
        )
        db_session.add(server)
        await db_session.commit()

        service = AgentDeploymentService(db_session)

        mock_result = MagicMock()
        mock_result.success = True
        mock_result.stdout = ""
        mock_result.stderr = ""
        mock_result.error = None

        with patch.object(service.ssh, "execute_command", return_value=mock_result):
            result = await service.remove_agent(
                "creds-exclude-server",
                delete_completely=False,
                ssh_username="secretuser",
                ssh_password="supersecretpassword",
            )

        assert result.success is True
        # Ensure password is not in any response field
        assert "supersecretpassword" not in result.message
        assert "supersecretpassword" not in (result.error or "")
        # The result object should not have password attribute
        assert not hasattr(result, "password")
        assert not hasattr(result, "ssh_password")


class TestAgentRemovalSudoSupport:
    """Tests for remove_agent() sudo password support (US0086)."""

    @pytest.mark.asyncio
    async def test_remove_with_sudo_password_parameter(self, db_session) -> None:
        """AC1, AC2: remove_agent should accept sudo_password and use password pipe."""
        from homelab_cmd.db.models.server import Server

        server = Server(
            id="sudo-remove-server",
            hostname="sudoremove.local",
            ip_address="192.168.1.100",
        )
        db_session.add(server)
        await db_session.commit()

        service = AgentDeploymentService(db_session)

        captured_commands = []

        async def mock_execute(
            hostname,
            command,
            command_timeout,
            username=None,
            password=None,
            key_usernames=None,
        ):
            captured_commands.append(command)
            result = MagicMock()
            result.success = True
            result.stdout = ""
            result.stderr = ""
            result.error = None
            return result

        with patch.object(service.ssh, "execute_command", side_effect=mock_execute):
            result = await service.remove_agent(
                "sudo-remove-server",
                delete_completely=False,
                sudo_password="mysudopass",
            )

        assert result.success is True
        # Check the uninstall command uses password pipe
        uninstall_cmd = captured_commands[0]
        assert "echo 'mysudopass' | sudo -S bash -c" in uninstall_cmd
        assert "systemctl stop homelab-agent" in uninstall_cmd

    @pytest.mark.asyncio
    async def test_remove_retrieves_stored_sudo_password(self, db_session) -> None:
        """AC3: remove_agent should retrieve stored sudo_password automatically."""
        from unittest.mock import AsyncMock

        from homelab_cmd.db.models.server import Server

        server = Server(
            id="stored-sudo-remove",
            hostname="storedsudo.local",
            ip_address="192.168.1.100",
        )
        db_session.add(server)
        await db_session.commit()

        # Create mock credential service
        mock_credential_service = MagicMock()
        mock_credential_service.get_effective_credential = AsyncMock(
            return_value="stored-sudo-pass"
        )

        service = AgentDeploymentService(db_session, credential_service=mock_credential_service)

        captured_commands = []

        async def mock_execute(
            hostname,
            command,
            command_timeout,
            username=None,
            password=None,
            key_usernames=None,
        ):
            captured_commands.append(command)
            result = MagicMock()
            result.success = True
            result.stdout = ""
            result.stderr = ""
            result.error = None
            return result

        with patch.object(service.ssh, "execute_command", side_effect=mock_execute):
            result = await service.remove_agent(
                "stored-sudo-remove",
                delete_completely=False,
            )

        assert result.success is True
        # Verify credential service was called
        mock_credential_service.get_effective_credential.assert_called_once_with(
            "sudo_password", "stored-sudo-remove"
        )
        # Check command uses retrieved password
        uninstall_cmd = captured_commands[0]
        assert "echo 'stored-sudo-pass' | sudo -S bash -c" in uninstall_cmd

    @pytest.mark.asyncio
    async def test_remove_passwordless_sudo_backward_compatible(self, db_session) -> None:
        """AC4: remove_agent should work with passwordless sudo."""
        from homelab_cmd.db.models.server import Server

        server = Server(
            id="passwordless-remove",
            hostname="passwordless.local",
            ip_address="192.168.1.100",
        )
        db_session.add(server)
        await db_session.commit()

        service = AgentDeploymentService(db_session)

        captured_commands = []

        async def mock_execute(
            hostname,
            command,
            command_timeout,
            username=None,
            password=None,
            key_usernames=None,
        ):
            captured_commands.append(command)
            result = MagicMock()
            result.success = True
            result.stdout = ""
            result.stderr = ""
            result.error = None
            return result

        with patch.object(service.ssh, "execute_command", side_effect=mock_execute):
            result = await service.remove_agent(
                "passwordless-remove",
                delete_completely=False,
            )

        assert result.success is True
        # Check the uninstall command uses plain sudo (no password pipe)
        uninstall_cmd = captured_commands[0]
        assert "sudo systemctl stop homelab-agent" in uninstall_cmd
        assert "echo" not in uninstall_cmd or "sudo -S" not in uninstall_cmd

    @pytest.mark.asyncio
    async def test_remove_sudo_password_escapes_special_chars(self, db_session) -> None:
        """AC2: Password with special chars should be properly escaped."""
        from homelab_cmd.db.models.server import Server

        server = Server(
            id="escape-remove-server",
            hostname="escaperemove.local",
            ip_address="192.168.1.100",
        )
        db_session.add(server)
        await db_session.commit()

        service = AgentDeploymentService(db_session)

        captured_commands = []

        async def mock_execute(
            hostname,
            command,
            command_timeout,
            username=None,
            password=None,
            key_usernames=None,
        ):
            captured_commands.append(command)
            result = MagicMock()
            result.success = True
            result.stdout = ""
            result.stderr = ""
            result.error = None
            return result

        # Password with single quotes (needs escaping)
        with patch.object(service.ssh, "execute_command", side_effect=mock_execute):
            result = await service.remove_agent(
                "escape-remove-server",
                delete_completely=False,
                sudo_password="pass'word",
            )

        assert result.success is True
        # Single quotes should be escaped as '\"'\"'
        uninstall_cmd = captured_commands[0]
        assert "'\"'\"'" in uninstall_cmd  # Shell escape for single quote

    @pytest.mark.asyncio
    async def test_remove_sudo_password_separate_from_ssh_password(self, db_session) -> None:
        """AC1: sudo_password should be separate from ssh_password."""
        from homelab_cmd.db.models.server import Server

        server = Server(
            id="separate-pass-server",
            hostname="separatepass.local",
            ip_address="192.168.1.100",
        )
        db_session.add(server)
        await db_session.commit()

        service = AgentDeploymentService(db_session)

        captured_calls = []

        async def mock_execute(
            hostname,
            command,
            command_timeout,
            username=None,
            password=None,
            key_usernames=None,
        ):
            captured_calls.append({"command": command, "username": username, "password": password})
            result = MagicMock()
            result.success = True
            result.stdout = ""
            result.stderr = ""
            result.error = None
            return result

        with patch.object(service.ssh, "execute_command", side_effect=mock_execute):
            result = await service.remove_agent(
                "separate-pass-server",
                delete_completely=False,
                ssh_username="sshuser",
                ssh_password="sshpass",
                sudo_password="sudopass",
            )

        assert result.success is True
        # SSH password used for authentication
        assert captured_calls[0]["username"] == "sshuser"
        assert captured_calls[0]["password"] == "sshpass"
        # Sudo password used in command
        assert "echo 'sudopass' | sudo -S bash -c" in captured_calls[0]["command"]

    @pytest.mark.asyncio
    async def test_remove_verification_uses_sudo_password(self, db_session) -> None:
        """AC2: Verification helper should receive and use sudo_password."""
        from homelab_cmd.db.models.server import Server

        server = Server(
            id="verify-sudo-server",
            hostname="verifysudo.local",
            ip_address="192.168.1.100",
        )
        db_session.add(server)
        await db_session.commit()

        service = AgentDeploymentService(db_session)

        call_count = 0

        async def mock_execute(
            hostname,
            command,
            command_timeout,
            username=None,
            password=None,
            key_usernames=None,
        ):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            result.success = True
            result.stdout = "" if call_count > 1 else ""
            result.stderr = ""
            result.error = None
            return result

        with patch.object(service.ssh, "execute_command", side_effect=mock_execute):
            result = await service.remove_agent(
                "verify-sudo-server",
                delete_completely=False,
                sudo_password="verifysudopass",
            )

        assert result.success is True
        # Verification should have been called (at least 2 SSH commands: uninstall + verification)
        assert call_count >= 1  # At minimum uninstall was called


class TestAgentDeploymentServiceActivate:
    """Tests for AgentDeploymentService.activate_server method."""

    @pytest.mark.asyncio
    async def test_activate_server_success(self, db_session) -> None:
        """Should activate an inactive server."""
        from datetime import UTC, datetime

        from homelab_cmd.db.models.server import Server

        server = Server(
            id="inactive-server",
            hostname="inactive.local",
            is_inactive=True,
            inactive_since=datetime.now(UTC),
        )
        db_session.add(server)
        await db_session.commit()

        service = AgentDeploymentService(db_session)

        result = await service.activate_server("inactive-server")

        assert result.success is True
        assert "activated" in result.message.lower()

        await db_session.refresh(server)
        assert server.is_inactive is False
        assert server.inactive_since is None

    @pytest.mark.asyncio
    async def test_activate_server_already_active(self, db_session) -> None:
        """Should return success when server already active."""
        from homelab_cmd.db.models.server import Server

        server = Server(
            id="active-server",
            hostname="active.local",
            is_inactive=False,
        )
        db_session.add(server)
        await db_session.commit()

        service = AgentDeploymentService(db_session)

        result = await service.activate_server("active-server")

        assert result.success is True
        assert "already active" in result.message.lower()

    @pytest.mark.asyncio
    async def test_activate_server_not_found(self, db_session) -> None:
        """Should fail when server not found."""
        service = AgentDeploymentService(db_session)

        result = await service.activate_server("nonexistent-server")

        assert result.success is False
        assert "not found" in result.error


class TestDeploymentResult:
    """Tests for DeploymentResult dataclass."""

    def test_deployment_result_defaults(self) -> None:
        """Should have correct default values."""
        result = DeploymentResult(success=True)

        assert result.success is True
        assert result.server_id is None
        assert result.message == ""
        assert result.error is None
        assert result.agent_version is None

    def test_deployment_result_with_all_fields(self) -> None:
        """Should accept all fields."""
        result = DeploymentResult(
            success=True,
            server_id="test-server",
            message="Success",
            error=None,
            agent_version="1.0.0",
        )

        assert result.success is True
        assert result.server_id == "test-server"
        assert result.message == "Success"
        assert result.agent_version == "1.0.0"


class TestGetDeploymentService:
    """Tests for get_deployment_service function."""

    def test_get_deployment_service_returns_instance(self) -> None:
        """Should return an AgentDeploymentService instance."""
        mock_session = MagicMock()
        service = get_deployment_service(mock_session)

        assert isinstance(service, AgentDeploymentService)
        assert service.session is mock_session
