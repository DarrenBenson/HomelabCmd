"""Tests for Service Discovery API endpoints.

US0069: Service Discovery During Agent Installation
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from homelab_cmd.api.routes.discovery import is_system_service
from homelab_cmd.api.schemas.discovery import (
    DiscoveredService,
    ServiceDiscoveryRequest,
    ServiceDiscoveryResponse,
)


class TestIsSystemService:
    """Tests for system service filtering logic."""

    def test_systemd_services_are_filtered(self) -> None:
        """systemd-* services should be filtered as system services."""
        assert is_system_service("systemd-logind") is True
        assert is_system_service("systemd-journald") is True
        assert is_system_service("systemd-networkd") is True

    def test_dbus_filtered(self) -> None:
        """dbus service should be filtered."""
        assert is_system_service("dbus") is True
        assert is_system_service("dbus-broker") is True

    def test_getty_filtered(self) -> None:
        """getty services should be filtered."""
        assert is_system_service("getty@tty1") is True
        assert is_system_service("serial-getty@ttyS0") is True

    def test_ssh_filtered(self) -> None:
        """SSH services should be filtered."""
        assert is_system_service("ssh.service") is True
        assert is_system_service("sshd") is True

    def test_user_services_not_filtered(self) -> None:
        """User-installed services should not be filtered."""
        assert is_system_service("nginx") is False
        assert is_system_service("plex") is False
        assert is_system_service("docker") is False
        assert is_system_service("sonarr") is False
        assert is_system_service("radarr") is False
        assert is_system_service("postgresql") is False
        assert is_system_service("redis") is False

    def test_case_insensitive(self) -> None:
        """Filtering should be case insensitive."""
        assert is_system_service("SYSTEMD-LOGIND") is True
        assert is_system_service("Dbus") is True

    def test_common_system_services(self) -> None:
        """Common system services should be filtered."""
        assert is_system_service("cron") is True
        assert is_system_service("rsyslog") is True
        assert is_system_service("snapd") is True
        assert is_system_service("polkit") is True
        assert is_system_service("NetworkManager") is True


class TestServiceDiscoverySchemas:
    """Tests for service discovery Pydantic schemas."""

    def test_service_discovery_request_defaults(self) -> None:
        """ServiceDiscoveryRequest should have sensible defaults."""
        request = ServiceDiscoveryRequest(hostname="10.0.0.5")
        assert request.hostname == "10.0.0.5"
        assert request.port == 22
        assert request.username == "root"

    def test_service_discovery_request_custom_values(self) -> None:
        """ServiceDiscoveryRequest should accept custom values."""
        request = ServiceDiscoveryRequest(
            hostname="media.local",
            port=2222,
            username="darren",
        )
        assert request.hostname == "media.local"
        assert request.port == 2222
        assert request.username == "darren"

    def test_discovered_service_schema(self) -> None:
        """DiscoveredService should parse correctly."""
        service = DiscoveredService(
            name="nginx",
            status="running",
            description="A high performance web server",
        )
        assert service.name == "nginx"
        assert service.status == "running"
        assert service.description == "A high performance web server"

    def test_discovered_service_empty_description(self) -> None:
        """DiscoveredService should allow empty description."""
        service = DiscoveredService(
            name="custom-service",
            status="running",
            description="",
        )
        assert service.description == ""

    def test_service_discovery_response(self) -> None:
        """ServiceDiscoveryResponse should parse correctly."""
        response = ServiceDiscoveryResponse(
            services=[
                DiscoveredService(name="nginx", status="running", description="Web server"),
                DiscoveredService(name="plex", status="running", description="Media server"),
            ],
            total=2,
            filtered=5,
        )
        assert len(response.services) == 2
        assert response.total == 2
        assert response.filtered == 5


class TestServiceDiscoveryEndpoint:
    """Tests for the /discovery/services endpoint."""

    @pytest.fixture
    def mock_ssh_service(self) -> MagicMock:
        """Create a mock SSH service."""
        mock = MagicMock()
        mock.execute_command = AsyncMock()
        return mock

    @pytest.fixture
    def mock_session(self) -> MagicMock:
        """Create a mock database session."""
        session = MagicMock()
        # Mock execute to return empty config (no key_usernames)
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        session.execute = AsyncMock(return_value=mock_result)
        return session

    @pytest.mark.asyncio
    async def test_discover_services_parses_systemctl_output(
        self,
        mock_ssh_service: MagicMock,
        mock_session: MagicMock,
    ) -> None:
        """Endpoint should parse systemctl output correctly."""
        from homelab_cmd.api.routes.discovery import discover_services

        # Simulate systemctl output: unit|sub-state|description
        mock_ssh_service.execute_command.return_value = MagicMock(
            success=True,
            stdout="nginx.service|running|A high performance web server\n"
            "plex.service|running|Plex Media Server\n"
            "docker.service|running|Docker Application Container Engine\n",
            stderr="",
        )

        with patch(
            "homelab_cmd.api.routes.discovery.get_ssh_service",
            return_value=mock_ssh_service,
        ):
            request = ServiceDiscoveryRequest(
                hostname="10.0.0.5",
                port=22,
                username="root",
            )
            response = await discover_services(request, session=mock_session)

        assert response.total == 3
        assert len(response.services) == 3
        assert response.services[0].name == "docker"  # Sorted alphabetically
        assert response.services[1].name == "nginx"
        assert response.services[2].name == "plex"

    @pytest.mark.asyncio
    async def test_discover_services_filters_system_services(
        self,
        mock_ssh_service: MagicMock,
        mock_session: MagicMock,
    ) -> None:
        """Endpoint should filter system services by default."""
        from homelab_cmd.api.routes.discovery import discover_services

        mock_ssh_service.execute_command.return_value = MagicMock(
            success=True,
            stdout="nginx.service|running|Web server\n"
            "systemd-logind.service|running|Login Service\n"
            "dbus.service|running|D-Bus System Message Bus\n"
            "plex.service|running|Media Server\n",
            stderr="",
        )

        with patch(
            "homelab_cmd.api.routes.discovery.get_ssh_service",
            return_value=mock_ssh_service,
        ):
            request = ServiceDiscoveryRequest(hostname="10.0.0.5")
            response = await discover_services(request, include_system=False, session=mock_session)

        assert response.total == 2
        assert response.filtered == 2
        service_names = [s.name for s in response.services]
        assert "nginx" in service_names
        assert "plex" in service_names
        assert "systemd-logind" not in service_names
        assert "dbus" not in service_names

    @pytest.mark.asyncio
    async def test_discover_services_includes_system_when_requested(
        self,
        mock_ssh_service: MagicMock,
        mock_session: MagicMock,
    ) -> None:
        """Endpoint should include system services when include_system=True."""
        from homelab_cmd.api.routes.discovery import discover_services

        mock_ssh_service.execute_command.return_value = MagicMock(
            success=True,
            stdout="nginx.service|running|Web server\n"
            "systemd-logind.service|running|Login Service\n",
            stderr="",
        )

        with patch(
            "homelab_cmd.api.routes.discovery.get_ssh_service",
            return_value=mock_ssh_service,
        ):
            request = ServiceDiscoveryRequest(hostname="10.0.0.5")
            response = await discover_services(request, include_system=True, session=mock_session)

        assert response.total == 2
        assert response.filtered == 0
        service_names = [s.name for s in response.services]
        assert "nginx" in service_names
        assert "systemd-logind" in service_names

    @pytest.mark.asyncio
    async def test_discover_services_handles_empty_output(
        self,
        mock_ssh_service: MagicMock,
        mock_session: MagicMock,
    ) -> None:
        """Endpoint should handle empty systemctl output gracefully."""
        from homelab_cmd.api.routes.discovery import discover_services

        mock_ssh_service.execute_command.return_value = MagicMock(
            success=True,
            stdout="",
            stderr="",
        )

        with patch(
            "homelab_cmd.api.routes.discovery.get_ssh_service",
            return_value=mock_ssh_service,
        ):
            request = ServiceDiscoveryRequest(hostname="10.0.0.5")
            response = await discover_services(request, session=mock_session)

        assert response.total == 0
        assert len(response.services) == 0

    @pytest.mark.asyncio
    async def test_discover_services_ssh_failure_raises_502(
        self,
        mock_ssh_service: MagicMock,
        mock_session: MagicMock,
    ) -> None:
        """Endpoint should return 502 on SSH connection failure."""
        from fastapi import HTTPException

        from homelab_cmd.api.routes.discovery import discover_services

        mock_ssh_service.execute_command.side_effect = Exception("Connection refused")

        with patch(
            "homelab_cmd.api.routes.discovery.get_ssh_service",
            return_value=mock_ssh_service,
        ):
            request = ServiceDiscoveryRequest(hostname="10.0.0.5")
            with pytest.raises(HTTPException) as exc_info:
                await discover_services(request, session=mock_session)

        assert exc_info.value.status_code == 502
        assert "SSH connection failed" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_discover_services_timeout_raises_504(
        self,
        mock_ssh_service: MagicMock,
        mock_session: MagicMock,
    ) -> None:
        """Endpoint should return 504 on timeout."""
        from fastapi import HTTPException

        from homelab_cmd.api.routes.discovery import discover_services

        mock_ssh_service.execute_command.side_effect = TimeoutError("Connection timed out")

        with patch(
            "homelab_cmd.api.routes.discovery.get_ssh_service",
            return_value=mock_ssh_service,
        ):
            request = ServiceDiscoveryRequest(hostname="10.0.0.5")
            with pytest.raises(HTTPException) as exc_info:
                await discover_services(request, session=mock_session)

        assert exc_info.value.status_code == 504
        assert "timed out" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_discover_services_command_failure_raises_502(
        self,
        mock_ssh_service: MagicMock,
        mock_session: MagicMock,
    ) -> None:
        """Endpoint should return 502 when systemctl command fails."""
        from fastapi import HTTPException

        from homelab_cmd.api.routes.discovery import discover_services

        mock_ssh_service.execute_command.return_value = MagicMock(
            success=False,
            stdout="",
            stderr="systemctl: command not found",
            error=None,
        )

        with patch(
            "homelab_cmd.api.routes.discovery.get_ssh_service",
            return_value=mock_ssh_service,
        ):
            request = ServiceDiscoveryRequest(hostname="10.0.0.5")
            with pytest.raises(HTTPException) as exc_info:
                await discover_services(request, session=mock_session)

        assert exc_info.value.status_code == 502
        assert "Failed to list services" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_discover_services_removes_service_suffix(
        self,
        mock_ssh_service: MagicMock,
        mock_session: MagicMock,
    ) -> None:
        """Endpoint should strip .service suffix from unit names."""
        from homelab_cmd.api.routes.discovery import discover_services

        mock_ssh_service.execute_command.return_value = MagicMock(
            success=True,
            stdout="nginx.service|running|Web server\n",
            stderr="",
        )

        with patch(
            "homelab_cmd.api.routes.discovery.get_ssh_service",
            return_value=mock_ssh_service,
        ):
            request = ServiceDiscoveryRequest(hostname="10.0.0.5")
            response = await discover_services(request, session=mock_session)

        assert response.services[0].name == "nginx"
        assert ".service" not in response.services[0].name

    @pytest.mark.asyncio
    async def test_discover_services_handles_missing_description(
        self,
        mock_ssh_service: MagicMock,
        mock_session: MagicMock,
    ) -> None:
        """Endpoint should handle services without descriptions."""
        from homelab_cmd.api.routes.discovery import discover_services

        mock_ssh_service.execute_command.return_value = MagicMock(
            success=True,
            stdout="custom-app.service|running|\n",
            stderr="",
        )

        with patch(
            "homelab_cmd.api.routes.discovery.get_ssh_service",
            return_value=mock_ssh_service,
        ):
            request = ServiceDiscoveryRequest(hostname="10.0.0.5")
            response = await discover_services(request, session=mock_session)

        assert response.services[0].name == "custom-app"
        assert response.services[0].description == ""

    @pytest.mark.asyncio
    async def test_discover_services_sorts_alphabetically(
        self,
        mock_ssh_service: MagicMock,
        mock_session: MagicMock,
    ) -> None:
        """Endpoint should sort services alphabetically by name."""
        from homelab_cmd.api.routes.discovery import discover_services

        mock_ssh_service.execute_command.return_value = MagicMock(
            success=True,
            stdout="zebra.service|running|Z service\n"
            "alpha.service|running|A service\n"
            "midway.service|running|M service\n",
            stderr="",
        )

        with patch(
            "homelab_cmd.api.routes.discovery.get_ssh_service",
            return_value=mock_ssh_service,
        ):
            request = ServiceDiscoveryRequest(hostname="10.0.0.5")
            response = await discover_services(request, session=mock_session)

        assert response.services[0].name == "alpha"
        assert response.services[1].name == "midway"
        assert response.services[2].name == "zebra"
