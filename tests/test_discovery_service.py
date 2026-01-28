"""Tests for Discovery service (US0041: Network Discovery).

These tests verify the discovery service functionality:
- Subnet parsing and validation
- Host IP generation
- Host discovery logic
- Discovery execution
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from homelab_cmd.services.discovery import (
    DEFAULT_TIMEOUT_SECONDS,
    DiscoveredDevice,
    DiscoveryService,
    get_discovery_service,
)


class TestParseSubnet:
    """Tests for subnet parsing and validation."""

    def test_parse_valid_24_subnet(self) -> None:
        """Should parse a valid /24 subnet."""
        service = DiscoveryService()
        network = service.parse_subnet("192.168.1.0/24")
        assert str(network) == "192.168.1.0/24"

    def test_parse_valid_16_subnet(self) -> None:
        """Should parse a valid /16 subnet."""
        service = DiscoveryService()
        network = service.parse_subnet("10.0.0.0/16")
        assert str(network) == "10.0.0.0/16"

    def test_parse_invalid_format_raises_error(self) -> None:
        """Should raise ValueError for invalid format."""
        service = DiscoveryService()
        with pytest.raises(ValueError, match="Invalid subnet"):
            service.parse_subnet("not-a-subnet")

    def test_parse_too_large_subnet_raises_error(self) -> None:
        """Should raise ValueError for subnets larger than /16."""
        service = DiscoveryService()
        with pytest.raises(ValueError, match="Subnet too large"):
            service.parse_subnet("10.0.0.0/8")

    def test_parse_non_strict_subnet(self) -> None:
        """Should handle non-strict subnet notation (host bits set)."""
        service = DiscoveryService()
        # 192.168.1.100/24 has host bits set but should be normalized
        network = service.parse_subnet("192.168.1.100/24")
        assert str(network) == "192.168.1.0/24"

    def test_parse_single_host_subnet(self) -> None:
        """Should parse a /32 single host subnet."""
        service = DiscoveryService()
        network = service.parse_subnet("192.168.1.1/32")
        assert str(network) == "192.168.1.1/32"


class TestGetHostIps:
    """Tests for host IP generation from a subnet."""

    def test_get_host_ips_excludes_network_broadcast(self) -> None:
        """Should exclude network and broadcast addresses."""
        service = DiscoveryService()
        network = service.parse_subnet("192.168.1.0/24")
        hosts = service.get_host_ips(network)
        # /24 has 256 addresses, minus network and broadcast = 254 hosts
        assert "192.168.1.0" not in hosts
        assert "192.168.1.255" not in hosts
        assert "192.168.1.1" in hosts
        assert "192.168.1.254" in hosts

    def test_get_host_ips_correct_count_24(self) -> None:
        """Should return 254 hosts for a /24 subnet."""
        service = DiscoveryService()
        network = service.parse_subnet("192.168.1.0/24")
        hosts = service.get_host_ips(network)
        assert len(hosts) == 254

    def test_get_host_ips_correct_count_28(self) -> None:
        """Should return 14 hosts for a /28 subnet."""
        service = DiscoveryService()
        network = service.parse_subnet("192.168.1.0/28")
        hosts = service.get_host_ips(network)
        # /28 has 16 addresses, minus network and broadcast = 14 hosts
        assert len(hosts) == 14

    def test_get_host_ips_small_subnet(self) -> None:
        """Should handle small subnets like /30."""
        service = DiscoveryService()
        network = service.parse_subnet("192.168.1.0/30")
        hosts = service.get_host_ips(network)
        # /30 has 4 addresses, minus network and broadcast = 2 hosts
        assert len(hosts) == 2
        assert "192.168.1.1" in hosts
        assert "192.168.1.2" in hosts


class TestDiscoverHost:
    """Tests for individual host discovery."""

    @pytest.mark.asyncio
    async def test_discover_host_success_returns_device(self) -> None:
        """Successful connection should return a DiscoveredDevice."""
        service = DiscoveryService(timeout=0.1)

        # Mock successful connection
        mock_reader = AsyncMock()
        mock_writer = MagicMock()
        mock_writer.close = MagicMock()
        mock_writer.wait_closed = AsyncMock()

        with patch("asyncio.open_connection", return_value=(mock_reader, mock_writer)):
            with patch.object(service, "_get_hostname", return_value="test-host.local"):
                result = await service.discover_host("192.168.1.100")

                assert result is not None
                assert isinstance(result, DiscoveredDevice)
                assert result.ip == "192.168.1.100"
                assert result.hostname == "test-host.local"
                assert result.response_time_ms >= 0

    @pytest.mark.asyncio
    async def test_discover_host_timeout_returns_none(self) -> None:
        """Connection timeout should return None."""
        service = DiscoveryService(timeout=0.01)

        with patch("asyncio.open_connection", side_effect=TimeoutError()):
            result = await service.discover_host("192.168.1.100")
            assert result is None

    @pytest.mark.asyncio
    async def test_discover_host_connection_refused_returns_none(self) -> None:
        """Connection refused should return None."""
        service = DiscoveryService(timeout=0.1)

        with patch("asyncio.open_connection", side_effect=ConnectionRefusedError()):
            result = await service.discover_host("192.168.1.100")
            assert result is None

    @pytest.mark.asyncio
    async def test_discover_host_os_error_returns_none(self) -> None:
        """Other OS errors should return None."""
        service = DiscoveryService(timeout=0.1)

        with patch("asyncio.open_connection", side_effect=OSError("Network unreachable")):
            result = await service.discover_host("192.168.1.100")
            assert result is None


class TestExecuteDiscovery:
    """Tests for full discovery execution."""

    @pytest.mark.asyncio
    async def test_execute_discovery_updates_progress(self, db_session) -> None:
        """Discovery should update progress as it scans."""
        from homelab_cmd.db.models.discovery import Discovery, DiscoveryStatus

        # Create a discovery record
        discovery = Discovery(
            subnet="192.168.1.0/30",  # Small subnet for faster test
            status=DiscoveryStatus.PENDING.value,
        )
        db_session.add(discovery)
        await db_session.commit()
        await db_session.refresh(discovery)

        service = DiscoveryService(timeout=0.01)

        # Mock discover_host to fail quickly
        with patch.object(service, "discover_host", return_value=None):
            await service.execute_discovery(discovery, db_session)

        # Verify status was updated
        await db_session.refresh(discovery)
        assert discovery.status == DiscoveryStatus.COMPLETED.value
        assert discovery.completed_at is not None

    @pytest.mark.asyncio
    async def test_execute_discovery_handles_error_gracefully(self, db_session) -> None:
        """Discovery should handle errors and mark as failed."""
        from homelab_cmd.db.models.discovery import Discovery, DiscoveryStatus

        # Create a discovery record
        discovery = Discovery(
            subnet="192.168.1.0/24",
            status=DiscoveryStatus.PENDING.value,
        )
        db_session.add(discovery)
        await db_session.commit()
        await db_session.refresh(discovery)

        service = DiscoveryService(timeout=0.01)

        # Mock discover_subnet to raise an error
        with patch.object(service, "discover_subnet", side_effect=Exception("Test error")):
            await service.execute_discovery(discovery, db_session)

        # Verify status was set to failed
        await db_session.refresh(discovery)
        assert discovery.status == DiscoveryStatus.FAILED.value
        assert discovery.error == "Test error"


class TestDiscoveryServiceSingleton:
    """Tests for the discovery service singleton."""

    def test_get_discovery_service_returns_instance(self) -> None:
        """Should return a DiscoveryService instance."""
        service = get_discovery_service()
        assert isinstance(service, DiscoveryService)

    def test_get_discovery_service_returns_same_instance(self) -> None:
        """Should return the same instance on subsequent calls."""
        service1 = get_discovery_service()
        service2 = get_discovery_service()
        assert service1 is service2


class TestDiscoveryServiceConfig:
    """Tests for discovery service configuration."""

    def test_default_timeout(self) -> None:
        """Should use default timeout if not specified."""
        service = DiscoveryService()
        assert service.timeout == DEFAULT_TIMEOUT_SECONDS

    def test_custom_timeout(self) -> None:
        """Should accept custom timeout."""
        service = DiscoveryService(timeout=1.0)
        assert service.timeout == 1.0


class TestDiscoveredDevice:
    """Tests for DiscoveredDevice dataclass."""

    def test_discovered_device_fields(self) -> None:
        """DiscoveredDevice should have ip, hostname, and response_time_ms."""
        device = DiscoveredDevice(
            ip="192.168.1.1",
            hostname="test-host.local",
            response_time_ms=15.5,
        )
        assert device.ip == "192.168.1.1"
        assert device.hostname == "test-host.local"
        assert device.response_time_ms == 15.5

    def test_discovered_device_optional_hostname(self) -> None:
        """Hostname should default to empty string if not provided."""
        device = DiscoveredDevice(
            ip="192.168.1.1",
            hostname="",
            response_time_ms=10.0,
        )
        assert device.hostname == ""


class TestGetAgentGuid:
    """Tests for GUID query via SSH (US0070 - AC7)."""

    @pytest.mark.asyncio
    async def test_get_agent_guid_returns_valid_guid(self) -> None:
        """Should return GUID when agent config contains valid GUID."""
        service = DiscoveryService()
        test_guid = "a1b2c3d4-e5f6-4890-abcd-ef1234567890"

        # Mock SSH service to return valid GUID
        mock_result = MagicMock()
        mock_result.success = True
        mock_result.stdout = f"  {test_guid}  \n"

        mock_ssh = AsyncMock()
        mock_ssh.execute_command = AsyncMock(return_value=mock_result)

        with patch("homelab_cmd.services.discovery.get_ssh_service", return_value=mock_ssh):
            guid = await service.get_agent_guid("192.168.1.100")
            assert guid == test_guid.lower()

    @pytest.mark.asyncio
    async def test_get_agent_guid_returns_none_for_invalid_guid(self) -> None:
        """Should return None when agent config contains invalid GUID."""
        service = DiscoveryService()

        # Mock SSH service to return invalid GUID
        mock_result = MagicMock()
        mock_result.success = True
        mock_result.stdout = "not-a-valid-uuid\n"

        mock_ssh = AsyncMock()
        mock_ssh.execute_command = AsyncMock(return_value=mock_result)

        with patch("homelab_cmd.services.discovery.get_ssh_service", return_value=mock_ssh):
            guid = await service.get_agent_guid("192.168.1.100")
            assert guid is None

    @pytest.mark.asyncio
    async def test_get_agent_guid_returns_none_on_ssh_failure(self) -> None:
        """Should return None when SSH command fails."""
        service = DiscoveryService()

        # Mock SSH service to return failure
        mock_result = MagicMock()
        mock_result.success = False
        mock_result.stdout = ""

        mock_ssh = AsyncMock()
        mock_ssh.execute_command = AsyncMock(return_value=mock_result)

        with patch("homelab_cmd.services.discovery.get_ssh_service", return_value=mock_ssh):
            guid = await service.get_agent_guid("192.168.1.100")
            assert guid is None

    @pytest.mark.asyncio
    async def test_get_agent_guid_returns_none_on_exception(self) -> None:
        """Should return None when SSH throws exception."""
        service = DiscoveryService()

        mock_ssh = AsyncMock()
        mock_ssh.execute_command = AsyncMock(side_effect=Exception("Connection refused"))

        with patch("homelab_cmd.services.discovery.get_ssh_service", return_value=mock_ssh):
            guid = await service.get_agent_guid("192.168.1.100")
            assert guid is None


class TestSSHAuth:
    """Tests for SSH authentication testing.

    US0073: Network Discovery Key Selection - tests updated to expect 3 return values.
    """

    @pytest.mark.asyncio
    async def test_ssh_auth_success(self) -> None:
        """Should return success status when SSH connection succeeds."""
        service = DiscoveryService()

        # Mock SSH service test_connection to succeed with key_used
        mock_result = MagicMock()
        mock_result.success = True
        mock_result.key_used = "homelab-key"

        mock_ssh = AsyncMock()
        mock_ssh.test_connection = AsyncMock(return_value=mock_result)

        with patch("homelab_cmd.services.discovery.get_ssh_service", return_value=mock_ssh):
            status, error, key_used = await service.test_ssh_auth("192.168.1.100")
            assert status == "success"
            assert error is None
            assert key_used == "homelab-key"

    @pytest.mark.asyncio
    async def test_ssh_auth_failure_with_error_message(self) -> None:
        """Should return failed status with error message when SSH fails."""
        service = DiscoveryService()

        # Mock SSH service test_connection to fail
        mock_result = MagicMock()
        mock_result.success = False
        mock_result.error = "Permission denied (publickey)"

        mock_ssh = AsyncMock()
        mock_ssh.test_connection = AsyncMock(return_value=mock_result)

        with patch("homelab_cmd.services.discovery.get_ssh_service", return_value=mock_ssh):
            status, error, key_used = await service.test_ssh_auth("192.168.1.100")
            assert status == "failed"
            assert error == "Permission denied (publickey)"
            assert key_used is None

    @pytest.mark.asyncio
    async def test_ssh_auth_exception_returns_failed(self) -> None:
        """Should return failed status with error when exception occurs."""
        service = DiscoveryService()

        # Mock SSH service to throw exception
        mock_ssh = AsyncMock()
        mock_ssh.test_connection = AsyncMock(side_effect=Exception("Connection refused"))

        with patch("homelab_cmd.services.discovery.get_ssh_service", return_value=mock_ssh):
            status, error, key_used = await service.test_ssh_auth("192.168.1.100")
            assert status == "failed"
            assert "Connection refused" in error
            assert key_used is None

    @pytest.mark.asyncio
    async def test_ssh_auth_uses_custom_username_and_port(self) -> None:
        """Should pass custom username and port to SSH service."""
        service = DiscoveryService()

        mock_result = MagicMock()
        mock_result.success = True
        mock_result.key_used = "test-key"

        mock_ssh = AsyncMock()
        mock_ssh.test_connection = AsyncMock(return_value=mock_result)

        with patch("homelab_cmd.services.discovery.get_ssh_service", return_value=mock_ssh):
            await service.test_ssh_auth("192.168.1.100", username="testuser", port=2222)

            # Verify correct parameters were passed
            mock_ssh.test_connection.assert_called_once_with(
                "192.168.1.100", port=2222, username="testuser", key_usernames=None
            )

    @pytest.mark.asyncio
    async def test_ssh_auth_with_specific_key(self) -> None:
        """US0073: Should use specific key when key_id provided."""
        service = DiscoveryService()

        mock_result = MagicMock()
        mock_result.success = True

        mock_ssh = AsyncMock()
        mock_ssh.test_connection_with_key = AsyncMock(return_value=mock_result)

        with patch("homelab_cmd.services.discovery.get_ssh_service", return_value=mock_ssh):
            status, error, key_used = await service.test_ssh_auth(
                "192.168.1.100", key_id="homelab-key"
            )
            assert status == "success"
            assert key_used == "homelab-key"

            # Verify test_connection_with_key was called
            mock_ssh.test_connection_with_key.assert_called_once()


class TestDiscoverSubnetWithSSHAuth:
    """Tests for discover_subnet SSH auth and GUID matching.

    US0073: Network Discovery Key Selection - tests updated for 3-value returns.
    """

    @pytest.mark.asyncio
    async def test_discover_subnet_tests_ssh_auth_for_discovered_hosts(
        self, db_session
    ) -> None:
        """Should test SSH auth for each discovered host."""
        from homelab_cmd.db.models.discovery import Discovery, DiscoveryStatus

        # Create a discovery record with small subnet
        discovery = Discovery(
            subnet="192.168.1.0/30",  # 2 hosts
            status=DiscoveryStatus.PENDING.value,
        )
        db_session.add(discovery)
        await db_session.commit()
        await db_session.refresh(discovery)

        service = DiscoveryService(timeout=0.01)

        # Mock discover_host to return a device for first IP only
        async def mock_discover_host(ip):
            if ip == "192.168.1.1":
                return DiscoveredDevice(
                    ip=ip, hostname="test-host.local", response_time_ms=10
                )
            return None

        with patch.object(service, "discover_host", side_effect=mock_discover_host):
            with patch.object(
                service, "test_ssh_auth", return_value=("success", None, "homelab-key")
            ) as mock_ssh_auth:
                with patch.object(service, "check_is_monitored", return_value=False):
                    devices = await service.discover_subnet(discovery, db_session)

                    # SSH auth should have been tested for the discovered host
                    assert mock_ssh_auth.called
                    assert len(devices) == 1
                    assert devices[0].ssh_auth_status == "success"
                    assert devices[0].ssh_auth_error is None
                    assert devices[0].ssh_key_used == "homelab-key"

    @pytest.mark.asyncio
    async def test_discover_subnet_records_ssh_auth_failure(self, db_session) -> None:
        """Should record SSH auth failure status on discovered devices."""
        from homelab_cmd.db.models.discovery import Discovery, DiscoveryStatus

        discovery = Discovery(
            subnet="192.168.1.0/30",
            status=DiscoveryStatus.PENDING.value,
        )
        db_session.add(discovery)
        await db_session.commit()
        await db_session.refresh(discovery)

        service = DiscoveryService(timeout=0.01)

        async def mock_discover_host(ip):
            if ip == "192.168.1.1":
                return DiscoveredDevice(
                    ip=ip, hostname="test-host.local", response_time_ms=10
                )
            return None

        with patch.object(service, "discover_host", side_effect=mock_discover_host):
            with patch.object(
                service, "test_ssh_auth", return_value=("failed", "Permission denied", None)
            ):
                with patch.object(service, "check_is_monitored", return_value=False):
                    devices = await service.discover_subnet(discovery, db_session)

                    assert len(devices) == 1
                    assert devices[0].ssh_auth_status == "failed"
                    assert devices[0].ssh_auth_error == "Permission denied"
                    assert devices[0].ssh_key_used is None

    @pytest.mark.asyncio
    async def test_discover_subnet_passes_ssh_status_to_check_is_monitored(
        self, db_session
    ) -> None:
        """Should pass SSH success status to check_is_monitored for GUID matching."""
        from homelab_cmd.db.models.discovery import Discovery, DiscoveryStatus

        discovery = Discovery(
            subnet="192.168.1.0/30",
            status=DiscoveryStatus.PENDING.value,
        )
        db_session.add(discovery)
        await db_session.commit()
        await db_session.refresh(discovery)

        service = DiscoveryService(timeout=0.01)

        async def mock_discover_host(ip):
            if ip == "192.168.1.1":
                return DiscoveredDevice(
                    ip=ip, hostname="test-host.local", response_time_ms=10
                )
            return None

        with patch.object(service, "discover_host", side_effect=mock_discover_host):
            with patch.object(
                service, "test_ssh_auth", return_value=("success", None, "test-key")
            ):
                with patch.object(
                    service, "check_is_monitored", return_value=True
                ) as mock_check:
                    devices = await service.discover_subnet(discovery, db_session)

                    # Verify check_is_monitored was called with ssh_success=True
                    mock_check.assert_called_once()
                    call_kwargs = mock_check.call_args[1]
                    assert call_kwargs.get("ssh_success") is True
                    assert devices[0].is_monitored is True


class TestCheckIsMonitoredWithGuid:
    """Tests for GUID-based monitored check (US0070 - AC7)."""

    @pytest.mark.asyncio
    async def test_check_is_monitored_matches_by_guid(self, db_session) -> None:
        """Should match server by GUID when SSH is successful."""
        from homelab_cmd.db.models.server import Server

        test_guid = "b2c3d4e5-f6a7-4890-bcde-f12345678901"
        server = Server(
            id="guid-server",
            hostname="guid-server.local",
            guid=test_guid,
        )
        db_session.add(server)
        await db_session.commit()

        service = DiscoveryService()

        # Mock get_agent_guid to return the matching GUID
        with patch.object(service, "get_agent_guid", return_value=test_guid.lower()):
            is_monitored = await service.check_is_monitored(
                db_session,
                "192.168.1.100",  # Different IP
                "different-hostname.local",  # Different hostname
                ssh_success=True,
            )
            assert is_monitored is True

    @pytest.mark.asyncio
    async def test_check_is_monitored_falls_back_to_ip_when_guid_not_found(
        self, db_session
    ) -> None:
        """Should fall back to IP matching when GUID not found."""
        from homelab_cmd.db.models.server import Server

        server = Server(
            id="ip-server",
            hostname="ip-server.local",
            ip_address="192.168.1.100",
        )
        db_session.add(server)
        await db_session.commit()

        service = DiscoveryService()

        # Mock get_agent_guid to return None (no GUID found)
        with patch.object(service, "get_agent_guid", return_value=None):
            is_monitored = await service.check_is_monitored(
                db_session,
                "192.168.1.100",
                ssh_success=True,
            )
            assert is_monitored is True

    @pytest.mark.asyncio
    async def test_check_is_monitored_skips_guid_when_ssh_failed(self, db_session) -> None:
        """Should skip GUID check when SSH failed."""
        from homelab_cmd.db.models.server import Server

        server = Server(
            id="ssh-fail-server",
            hostname="ssh-fail-server.local",
            ip_address="192.168.1.100",
        )
        db_session.add(server)
        await db_session.commit()

        service = DiscoveryService()

        # get_agent_guid should not be called when ssh_success=False
        with patch.object(service, "get_agent_guid") as mock_get_guid:
            is_monitored = await service.check_is_monitored(
                db_session,
                "192.168.1.100",
                ssh_success=False,
            )
            assert is_monitored is True
            mock_get_guid.assert_not_called()
