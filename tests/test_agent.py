"""Unit tests for the HomelabCmd monitoring agent.

Tests cover:
- Configuration loading and validation
- Metrics collection (with mocked psutil)
- Heartbeat sending with retry logic
- MAC address collection
- Package update detection
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import httpx
import pytest

# Add project root to path for imports
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from agent import (  # noqa: E402
    AgentConfig,
    get_all_services_status,
    get_cpu_info,
    get_mac_address,
    get_metrics,
    get_os_info,
    get_package_updates,
    get_service_status,
    load_config,
    send_heartbeat,
)

# =============================================================================
# Configuration Tests
# =============================================================================


class TestLoadConfig:
    """Tests for configuration loading."""

    def test_load_valid_config(self, tmp_path: Path) -> None:
        """Config loads successfully with all required fields."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text("""
hub_url: "http://localhost:8080"
server_id: "test-server"
api_key: "test-key"
heartbeat_interval: 30
""")

        config = load_config(config_file)

        assert config.hub_url == "http://localhost:8080"
        assert config.server_id == "test-server"
        assert config.api_key == "test-key"
        assert config.heartbeat_interval == 30

    def test_load_config_strips_trailing_slash(self, tmp_path: Path) -> None:
        """Hub URL trailing slash is stripped."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text("""
hub_url: "http://localhost:8080/"
server_id: "test-server"
api_key: "test-key"
""")

        config = load_config(config_file)
        assert config.hub_url == "http://localhost:8080"

    def test_load_config_default_interval(self, tmp_path: Path) -> None:
        """Default heartbeat interval is 60 seconds."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text("""
hub_url: "http://localhost:8080"
server_id: "test-server"
api_key: "test-key"
""")

        config = load_config(config_file)
        assert config.heartbeat_interval == 60

    def test_load_config_file_not_found(self, tmp_path: Path) -> None:
        """FileNotFoundError raised when config file doesn't exist."""
        with pytest.raises(FileNotFoundError, match="Configuration file not found"):
            load_config(tmp_path / "nonexistent.yaml")

    def test_load_config_empty_file(self, tmp_path: Path) -> None:
        """ValueError raised for empty config file."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text("")

        with pytest.raises(ValueError, match="Configuration file is empty"):
            load_config(config_file)

    def test_load_config_missing_hub_url(self, tmp_path: Path) -> None:
        """ValueError raised when hub_url is missing."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text("""
server_id: "test-server"
api_key: "test-key"
""")

        with pytest.raises(ValueError, match="hub_url"):
            load_config(config_file)

    def test_load_config_missing_server_id(self, tmp_path: Path) -> None:
        """ValueError raised when server_id is missing."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text("""
hub_url: "http://localhost:8080"
api_key: "test-key"
""")

        with pytest.raises(ValueError, match="server_id"):
            load_config(config_file)

    def test_load_config_missing_api_key(self, tmp_path: Path) -> None:
        """ValueError raised when api_key is missing."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text("""
hub_url: "http://localhost:8080"
server_id: "test-server"
""")

        with pytest.raises(ValueError, match="api_key"):
            load_config(config_file)

    def test_load_config_empty_required_field(self, tmp_path: Path) -> None:
        """ValueError raised when required field is empty."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text("""
hub_url: ""
server_id: "test-server"
api_key: "test-key"
""")

        with pytest.raises(ValueError, match="hub_url"):
            load_config(config_file)


# =============================================================================
# OS Info Tests
# =============================================================================


class TestGetOsInfo:
    """Tests for OS information collection."""

    def test_returns_dict_with_expected_keys(self) -> None:
        """OS info returns dict with all expected keys."""
        info = get_os_info()

        assert "distribution" in info
        assert "version" in info
        assert "kernel" in info
        assert "architecture" in info

    def test_kernel_is_populated(self) -> None:
        """Kernel version is always available."""
        info = get_os_info()
        assert info["kernel"] is not None
        assert len(info["kernel"]) > 0

    def test_architecture_is_populated(self) -> None:
        """Architecture is always available."""
        info = get_os_info()
        assert info["architecture"] is not None
        assert info["architecture"] in ["x86_64", "aarch64", "armv7l", "i686", "i386"]


# =============================================================================
# Metrics Collection Tests
# =============================================================================


class TestGetMetrics:
    """Tests for system metrics collection."""

    def test_returns_dict_with_expected_keys(self) -> None:
        """Metrics returns dict with all expected keys."""
        metrics = get_metrics()

        expected_keys = [
            "cpu_percent",
            "memory_percent",
            "memory_total_mb",
            "memory_used_mb",
            "disk_percent",
            "disk_total_gb",
            "disk_used_gb",
            "network_rx_bytes",
            "network_tx_bytes",
            "load_1m",
            "load_5m",
            "load_15m",
            "uptime_seconds",
        ]

        for key in expected_keys:
            assert key in metrics

    def test_cpu_percent_in_valid_range(self) -> None:
        """CPU percent is between 0 and 100."""
        metrics = get_metrics()
        if metrics["cpu_percent"] is not None:
            assert 0 <= metrics["cpu_percent"] <= 100

    def test_memory_percent_in_valid_range(self) -> None:
        """Memory percent is between 0 and 100."""
        metrics = get_metrics()
        if metrics["memory_percent"] is not None:
            assert 0 <= metrics["memory_percent"] <= 100

    def test_disk_percent_in_valid_range(self) -> None:
        """Disk percent is between 0 and 100."""
        metrics = get_metrics()
        if metrics["disk_percent"] is not None:
            assert 0 <= metrics["disk_percent"] <= 100

    def test_uptime_is_positive(self) -> None:
        """Uptime is a positive number."""
        metrics = get_metrics()
        if metrics["uptime_seconds"] is not None:
            assert metrics["uptime_seconds"] > 0

    @patch("agent.collectors.psutil.cpu_percent")
    def test_handles_cpu_collection_failure(self, mock_cpu: MagicMock) -> None:
        """CPU collection failure returns None and continues."""
        mock_cpu.side_effect = OSError("CPU error")

        metrics = get_metrics()

        assert metrics["cpu_percent"] is None
        # Other metrics should still be collected
        assert "memory_percent" in metrics


# =============================================================================
# MAC Address Tests
# =============================================================================


class TestGetMacAddress:
    """Tests for MAC address collection."""

    def test_returns_string_or_none(self) -> None:
        """MAC address returns string or None."""
        mac = get_mac_address()
        assert mac is None or isinstance(mac, str)

    def test_mac_format_if_present(self) -> None:
        """If MAC is present, it has correct format."""
        mac = get_mac_address()
        if mac is not None:
            # MAC address format: XX:XX:XX:XX:XX:XX
            assert len(mac) == 17
            assert mac.count(":") == 5

    @patch("agent.collectors.psutil.net_if_addrs")
    def test_handles_collection_failure(self, mock_addrs: MagicMock) -> None:
        """MAC collection failure returns None."""
        mock_addrs.side_effect = OSError("Network error")

        mac = get_mac_address()
        assert mac is None


# =============================================================================
# Package Updates Tests
# =============================================================================


class TestGetPackageUpdates:
    """Tests for package update detection."""

    def test_returns_dict_with_expected_keys(self) -> None:
        """Package updates returns dict with expected keys."""
        updates = get_package_updates()

        assert "updates_available" in updates
        assert "security_updates" in updates

    @patch("agent.collectors.subprocess.run")
    def test_non_debian_system_returns_none(self, mock_run: MagicMock) -> None:
        """Non-Debian systems return None values."""
        from subprocess import CalledProcessError

        mock_run.side_effect = CalledProcessError(1, "which")

        updates = get_package_updates()

        assert updates["updates_available"] is None
        assert updates["security_updates"] is None

    @patch("agent.collectors.subprocess.run")
    def test_parses_upgrade_count(self, mock_run: MagicMock) -> None:
        """Correctly parses upgrade count from apt output."""
        # First call checks for apt, second does upgrade simulation
        mock_run.side_effect = [
            MagicMock(),  # which apt-get succeeds
            MagicMock(stdout="5 upgraded, 2 newly installed, 0 to remove and 3 not upgraded.\n"),
        ]

        updates = get_package_updates()

        assert updates["updates_available"] == 5

    @patch("agent.collectors.subprocess.run")
    def test_counts_security_updates(self, mock_run: MagicMock) -> None:
        """Correctly counts security updates."""
        mock_run.side_effect = [
            MagicMock(),  # which apt-get succeeds
            MagicMock(
                stdout="""Reading package lists...
Building dependency tree...
Inst pkg1 [1.0] (1.1 Debian-Security:stable)
Inst pkg2 [2.0] (2.1 Debian:stable)
Inst pkg3 [3.0] (3.1 Debian-Security:stable)
3 upgraded, 0 newly installed, 0 to remove.
"""
            ),
        ]

        updates = get_package_updates()

        assert updates["security_updates"] == 2

    @patch("agent.collectors.subprocess.run")
    def test_apt_timeout_returns_none(self, mock_run: MagicMock) -> None:
        """TC039: Timeout running apt returns None values gracefully."""
        from subprocess import TimeoutExpired

        mock_run.side_effect = [
            MagicMock(),  # which apt-get succeeds
            TimeoutExpired("apt-get", 60),  # apt-get -s upgrade times out
        ]

        updates = get_package_updates()

        assert updates["updates_available"] is None
        assert updates["security_updates"] is None


# =============================================================================
# Heartbeat Sender Tests
# =============================================================================


class TestSendHeartbeat:
    """Tests for heartbeat sending with retry logic."""

    @pytest.fixture
    def config(self) -> AgentConfig:
        """Create test configuration."""
        return AgentConfig(
            hub_url="http://localhost:8080",
            server_id="test-server",
            api_key="test-key",
            server_guid="a1b2c3d4-e5f6-4890-abcd-ef1234567890",
            heartbeat_interval=60,
        )

    @pytest.fixture
    def metrics(self) -> dict[str, Any]:
        """Create test metrics."""
        return {
            "cpu_percent": 25.0,
            "memory_percent": 50.0,
            "memory_total_mb": 16000,
            "memory_used_mb": 8000,
            "disk_percent": 30.0,
            "disk_total_gb": 500.0,
            "disk_used_gb": 150.0,
            "network_rx_bytes": 1000000,
            "network_tx_bytes": 500000,
            "load_1m": 0.5,
            "load_5m": 0.3,
            "load_15m": 0.2,
            "uptime_seconds": 86400,
        }

    @pytest.fixture
    def os_info(self) -> dict[str, str | None]:
        """Create test OS info."""
        return {
            "distribution": "Ubuntu",
            "version": "22.04",
            "kernel": "5.15.0",
            "architecture": "x86_64",
        }

    @patch("agent.heartbeat.httpx.Client")
    def test_successful_heartbeat(
        self,
        mock_client_class: MagicMock,
        config: AgentConfig,
        metrics: dict[str, Any],
        os_info: dict[str, str | None],
    ) -> None:
        """Successful heartbeat returns True."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"status": "ok", "server_registered": False}

        mock_client = MagicMock()
        mock_client.post.return_value = mock_response
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client_class.return_value = mock_client

        result = send_heartbeat(config, metrics, os_info, None, {})

        assert result.success is True
        mock_client.post.assert_called_once()

    @patch("agent.heartbeat.httpx.Client")
    def test_auth_failure_no_retry(
        self,
        mock_client_class: MagicMock,
        config: AgentConfig,
        metrics: dict[str, Any],
        os_info: dict[str, str | None],
    ) -> None:
        """401 error does not trigger retry."""
        mock_response = MagicMock()
        mock_response.status_code = 401

        mock_client = MagicMock()
        mock_client.post.return_value = mock_response
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client_class.return_value = mock_client

        result = send_heartbeat(config, metrics, os_info, None, {})

        assert result.success is False
        # Should only be called once (no retry)
        assert mock_client.post.call_count == 1

    @patch("agent.heartbeat.time.sleep")
    @patch("agent.heartbeat.httpx.Client")
    def test_connection_error_retries(
        self,
        mock_client_class: MagicMock,
        mock_sleep: MagicMock,
        config: AgentConfig,
        metrics: dict[str, Any],
        os_info: dict[str, str | None],
    ) -> None:
        """Connection error triggers retry with delay."""
        mock_client = MagicMock()
        mock_client.post.side_effect = httpx.ConnectError("Connection refused")
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client_class.return_value = mock_client

        result = send_heartbeat(config, metrics, os_info, None, {})

        assert result.success is False
        # Should retry 3 times
        assert mock_client.post.call_count == 3
        # Should sleep between retries (2 sleeps for 3 attempts)
        assert mock_sleep.call_count == 2

    @patch("agent.heartbeat.time.sleep")
    @patch("agent.heartbeat.httpx.Client")
    def test_timeout_retries(
        self,
        mock_client_class: MagicMock,
        mock_sleep: MagicMock,
        config: AgentConfig,
        metrics: dict[str, Any],
        os_info: dict[str, str | None],
    ) -> None:
        """Timeout triggers retry."""
        mock_client = MagicMock()
        mock_client.post.side_effect = httpx.TimeoutException("Timeout")
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client_class.return_value = mock_client

        result = send_heartbeat(config, metrics, os_info, None, {})

        assert result.success is False
        assert mock_client.post.call_count == 3

    @patch("agent.heartbeat.time.sleep")
    @patch("agent.heartbeat.httpx.Client")
    def test_retry_succeeds_on_second_attempt(
        self,
        mock_client_class: MagicMock,
        mock_sleep: MagicMock,
        config: AgentConfig,
        metrics: dict[str, Any],
        os_info: dict[str, str | None],
    ) -> None:
        """Retry succeeds after initial failure."""
        mock_success = MagicMock()
        mock_success.status_code = 200
        mock_success.json.return_value = {"status": "ok", "server_registered": False}

        mock_client = MagicMock()
        mock_client.post.side_effect = [
            httpx.ConnectError("Connection refused"),
            mock_success,
        ]
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client_class.return_value = mock_client

        result = send_heartbeat(config, metrics, os_info, None, {})

        assert result.success is True
        assert mock_client.post.call_count == 2

    @patch("agent.heartbeat.httpx.Client")
    def test_correct_url_and_headers(
        self,
        mock_client_class: MagicMock,
        config: AgentConfig,
        metrics: dict[str, Any],
        os_info: dict[str, str | None],
    ) -> None:
        """Request uses correct URL and headers."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"status": "ok", "server_registered": False}

        mock_client = MagicMock()
        mock_client.post.return_value = mock_response
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client_class.return_value = mock_client

        send_heartbeat(config, metrics, os_info, None, {})

        call_args = mock_client.post.call_args
        assert call_args[0][0] == "http://localhost:8080/api/v1/agents/heartbeat"
        assert call_args[1]["headers"]["X-API-Key"] == "test-key"
        assert call_args[1]["headers"]["Content-Type"] == "application/json"

    @patch("agent.heartbeat.httpx.Client")
    def test_payload_structure(
        self,
        mock_client_class: MagicMock,
        config: AgentConfig,
        metrics: dict[str, Any],
        os_info: dict[str, str | None],
    ) -> None:
        """Request payload has correct structure."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"status": "ok", "server_registered": False}

        mock_client = MagicMock()
        mock_client.post.return_value = mock_response
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client_class.return_value = mock_client

        send_heartbeat(config, metrics, os_info, "aa:bb:cc:dd:ee:ff", {"updates_available": 5})

        call_args = mock_client.post.call_args
        payload = call_args[1]["json"]

        assert payload["server_id"] == "test-server"
        assert "hostname" in payload
        assert "timestamp" in payload
        assert payload["os_info"] == os_info
        assert payload["metrics"] == metrics

    @patch("agent.heartbeat.httpx.Client")
    def test_payload_includes_services_when_provided(
        self,
        mock_client_class: MagicMock,
        config: AgentConfig,
        metrics: dict[str, Any],
        os_info: dict[str, str | None],
    ) -> None:
        """Request payload includes services when provided (US0018 AC3)."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"status": "ok", "server_registered": False}

        mock_client = MagicMock()
        mock_client.post.return_value = mock_response
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client_class.return_value = mock_client

        services = [
            {
                "name": "plex",
                "status": "running",
                "pid": 1234,
                "memory_mb": 512.5,
                "cpu_percent": 2.3,
            },
            {
                "name": "sonarr",
                "status": "stopped",
                "pid": None,
                "memory_mb": None,
                "cpu_percent": None,
            },
        ]

        send_heartbeat(config, metrics, os_info, None, {}, services)

        call_args = mock_client.post.call_args
        payload = call_args[1]["json"]

        assert "services" in payload
        assert payload["services"] == services

    @patch("agent.heartbeat.httpx.Client")
    def test_payload_omits_services_when_none(
        self,
        mock_client_class: MagicMock,
        config: AgentConfig,
        metrics: dict[str, Any],
        os_info: dict[str, str | None],
    ) -> None:
        """Request payload omits services key when not provided (backward compatible)."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"status": "ok", "server_registered": False}

        mock_client = MagicMock()
        mock_client.post.return_value = mock_response
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client_class.return_value = mock_client

        send_heartbeat(config, metrics, os_info, None, {})

        call_args = mock_client.post.call_args
        payload = call_args[1]["json"]

        # services key should not be present when no services provided
        assert "services" not in payload


# =============================================================================
# Service Status Collection Tests (US0018)
# =============================================================================


class TestGetServiceStatus:
    """Tests for service status collection (US0018 AC2, AC4)."""

    @patch("agent.collectors.subprocess.run")
    def test_running_service_returns_correct_status(self, mock_run: MagicMock) -> None:
        """Running service returns status='running' and PID (AC2, AC4)."""
        mock_run.return_value = MagicMock(
            stdout="ActiveState=active\nMainPID=12345\nMemoryCurrent=536870912\n"
        )

        status = get_service_status("plex")

        assert status["name"] == "plex"
        assert status["status"] == "running"
        assert status["pid"] == 12345
        assert status["memory_mb"] == 512.0  # 536870912 / 1024 / 1024

    @patch("agent.collectors.subprocess.run")
    def test_stopped_service_returns_stopped_status(self, mock_run: MagicMock) -> None:
        """Stopped service returns status='stopped'."""
        mock_run.return_value = MagicMock(
            stdout="ActiveState=inactive\nMainPID=0\nMemoryCurrent=[not set]\n"
        )

        status = get_service_status("nginx")

        assert status["name"] == "nginx"
        assert status["status"] == "stopped"
        assert status["pid"] is None
        assert status["memory_mb"] is None

    @patch("agent.collectors.subprocess.run")
    def test_failed_service_returns_failed_status(self, mock_run: MagicMock) -> None:
        """Failed service returns status='failed'."""
        mock_run.return_value = MagicMock(
            stdout="ActiveState=failed\nMainPID=0\nMemoryCurrent=[not set]\n"
        )

        status = get_service_status("broken-service")

        assert status["status"] == "failed"

    @patch("agent.collectors.subprocess.run")
    def test_activating_service_maps_to_running(self, mock_run: MagicMock) -> None:
        """Activating service maps to 'running'."""
        mock_run.return_value = MagicMock(
            stdout="ActiveState=activating\nMainPID=5678\nMemoryCurrent=100000\n"
        )

        status = get_service_status("starting-service")

        assert status["status"] == "running"

    @patch("agent.collectors.subprocess.run")
    def test_unknown_state_returns_unknown(self, mock_run: MagicMock) -> None:
        """Unknown ActiveState returns status='unknown'."""
        mock_run.return_value = MagicMock(stdout="ActiveState=\nMainPID=0\nMemoryCurrent=\n")

        status = get_service_status("mystery-service")

        assert status["status"] == "unknown"

    @patch("agent.collectors.subprocess.run")
    def test_systemctl_not_found_returns_unknown(self, mock_run: MagicMock) -> None:
        """Missing systemctl returns status='unknown'."""
        mock_run.side_effect = FileNotFoundError("systemctl not found")

        status = get_service_status("any-service")

        assert status["status"] == "unknown"
        assert status["pid"] is None

    @patch("agent.collectors.subprocess.run")
    def test_systemctl_timeout_returns_unknown(self, mock_run: MagicMock) -> None:
        """Timeout returns status='unknown'."""
        from subprocess import TimeoutExpired

        mock_run.side_effect = TimeoutExpired("systemctl", 5)

        status = get_service_status("slow-service")

        assert status["status"] == "unknown"

    @patch("agent.collectors.subprocess.run")
    def test_calls_systemctl_with_correct_args(self, mock_run: MagicMock) -> None:
        """systemctl is called with correct arguments."""
        mock_run.return_value = MagicMock(stdout="ActiveState=active\nMainPID=1\nMemoryCurrent=0\n")

        get_service_status("test-service")

        mock_run.assert_called_once()
        call_args = mock_run.call_args
        assert call_args[0][0] == [
            "systemctl",
            "show",
            "test-service",
            "--property=ActiveState,MainPID,MemoryCurrent",
        ]
        assert call_args[1]["timeout"] == 5


class TestGetAllServicesStatus:
    """Tests for get_all_services_status function."""

    @patch("agent.collectors.get_service_status")
    def test_returns_list_of_status_dicts(self, mock_get_status: MagicMock) -> None:
        """Returns list of service status dictionaries."""
        mock_get_status.side_effect = [
            {"name": "plex", "status": "running", "pid": 123, "memory_mb": 100, "cpu_percent": 1.0},
            {
                "name": "nginx",
                "status": "stopped",
                "pid": None,
                "memory_mb": None,
                "cpu_percent": None,
            },
        ]

        results = get_all_services_status(["plex", "nginx"])

        assert len(results) == 2
        assert results[0]["name"] == "plex"
        assert results[1]["name"] == "nginx"

    @patch("agent.collectors.get_service_status")
    def test_empty_list_returns_empty_list(self, mock_get_status: MagicMock) -> None:
        """Empty services list returns empty result."""
        results = get_all_services_status([])

        assert results == []
        mock_get_status.assert_not_called()

    @patch("agent.collectors.get_service_status")
    def test_calls_get_service_status_for_each(self, mock_get_status: MagicMock) -> None:
        """get_service_status called for each service."""
        mock_get_status.return_value = {
            "name": "x",
            "status": "running",
            "pid": 1,
            "memory_mb": 1,
            "cpu_percent": 1,
        }

        get_all_services_status(["a", "b", "c"])

        assert mock_get_status.call_count == 3


class TestConfigMonitoredServices:
    """Tests for monitored_services configuration."""

    def test_load_config_with_monitored_services(self, tmp_path: Path) -> None:
        """Config loads monitored_services list (AC1)."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text("""
hub_url: "http://localhost:8080"
server_id: "test-server"
api_key: "test-key"
monitored_services:
  - plex
  - sonarr
  - radarr
""")

        config = load_config(config_file)

        assert config.monitored_services == ["plex", "sonarr", "radarr"]

    def test_load_config_without_monitored_services(self, tmp_path: Path) -> None:
        """Config works without monitored_services (optional)."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text("""
hub_url: "http://localhost:8080"
server_id: "test-server"
api_key: "test-key"
""")

        config = load_config(config_file)

        assert config.monitored_services is None


# =============================================================================
# CPU Info Collection Tests (US0053 - TS0012)
# =============================================================================


class TestGetCpuInfo:
    """Tests for CPU information collection (US0053 - TS0012)."""

    def test_returns_dict_with_expected_keys(self) -> None:
        """TC180/TC183: CPU info returns dict with cpu_model and cpu_cores."""
        info = get_cpu_info()

        assert "cpu_model" in info
        assert "cpu_cores" in info

    def test_cpu_cores_is_populated(self) -> None:
        """TC183: CPU cores is populated from os.cpu_count()."""
        info = get_cpu_info()

        # cpu_cores should be a positive integer (or None in edge cases)
        if info["cpu_cores"] is not None:
            assert isinstance(info["cpu_cores"], int)
            assert info["cpu_cores"] > 0

    @patch("agent.collectors.os.cpu_count")
    def test_cpu_cores_from_os_cpu_count(self, mock_cpu_count: MagicMock) -> None:
        """TC183: cpu_cores uses os.cpu_count()."""
        mock_cpu_count.return_value = 8

        info = get_cpu_info()

        assert info["cpu_cores"] == 8
        mock_cpu_count.assert_called_once()

    @patch("agent.collectors.os.cpu_count")
    def test_handles_cpu_count_none(self, mock_cpu_count: MagicMock) -> None:
        """Edge case: os.cpu_count() returning None is handled."""
        mock_cpu_count.return_value = None

        info = get_cpu_info()

        assert info["cpu_cores"] is None

    @patch("agent.collectors.Path")
    def test_x86_cpu_model_from_proc_cpuinfo(self, mock_path: MagicMock) -> None:
        """TC180: x86 CPU model extracted from 'model name' in /proc/cpuinfo."""
        cpuinfo_content = """processor       : 0
vendor_id       : GenuineIntel
model name      : Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz
cpu MHz         : 1800.000
"""
        mock_cpuinfo = MagicMock()
        mock_cpuinfo.exists.return_value = True
        mock_cpuinfo.read_text.return_value = cpuinfo_content
        mock_path.return_value = mock_cpuinfo

        info = get_cpu_info()

        assert info["cpu_model"] == "Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz"

    @patch("agent.collectors.Path")
    def test_arm_cpu_model_from_model_field(self, mock_path: MagicMock) -> None:
        """TC181: ARM CPU model extracted from 'Model' field in /proc/cpuinfo."""
        cpuinfo_content = """processor       : 0
BogoMIPS        : 108.00
Features        : fp asimd
Hardware        : BCM2711
Revision        : d03114
Model           : Raspberry Pi 4 Model B Rev 1.4
"""
        mock_cpuinfo = MagicMock()
        mock_cpuinfo.exists.return_value = True
        mock_cpuinfo.read_text.return_value = cpuinfo_content
        mock_path.return_value = mock_cpuinfo

        info = get_cpu_info()

        assert info["cpu_model"] == "Raspberry Pi 4 Model B Rev 1.4"

    @patch("agent.collectors.Path")
    def test_arm_cpu_model_hardware_fallback(self, mock_path: MagicMock) -> None:
        """TC182: ARM uses Hardware field as fallback when Model not present."""
        cpuinfo_content = """processor       : 0
Hardware        : BCM2711
"""
        mock_cpuinfo = MagicMock()
        mock_cpuinfo.exists.return_value = True
        mock_cpuinfo.read_text.return_value = cpuinfo_content
        mock_path.return_value = mock_cpuinfo

        info = get_cpu_info()

        assert info["cpu_model"] == "BCM2711"

    @patch("agent.collectors.platform.processor")
    @patch("agent.collectors.Path")
    def test_fallback_to_platform_processor(
        self, mock_path: MagicMock, mock_processor: MagicMock
    ) -> None:
        """Fallback to platform.processor() when /proc/cpuinfo unavailable."""
        mock_cpuinfo = MagicMock()
        mock_cpuinfo.exists.return_value = False
        mock_path.return_value = mock_cpuinfo
        mock_processor.return_value = "Apple M1"

        info = get_cpu_info()

        assert info["cpu_model"] == "Apple M1"

    @patch("agent.collectors.platform.processor")
    @patch("agent.collectors.Path")
    def test_handles_proc_cpuinfo_not_readable(
        self, mock_path: MagicMock, mock_processor: MagicMock
    ) -> None:
        """TC190: Handles /proc/cpuinfo not readable (e.g., container)."""
        mock_cpuinfo = MagicMock()
        mock_cpuinfo.exists.return_value = True
        mock_cpuinfo.read_text.side_effect = PermissionError("Permission denied")
        mock_path.return_value = mock_cpuinfo
        mock_processor.return_value = ""

        info = get_cpu_info()

        # Should not raise, returns None for cpu_model
        assert info["cpu_model"] is None

    @patch("agent.collectors.Path")
    def test_handles_empty_proc_cpuinfo(self, mock_path: MagicMock) -> None:
        """Edge case: Empty /proc/cpuinfo file."""
        mock_cpuinfo = MagicMock()
        mock_cpuinfo.exists.return_value = True
        mock_cpuinfo.read_text.return_value = ""
        mock_path.return_value = mock_cpuinfo

        info = get_cpu_info()

        # Should handle gracefully
        assert "cpu_model" in info

    @patch("agent.collectors.Path")
    def test_multicore_cpu_returns_first_model(self, mock_path: MagicMock) -> None:
        """Edge case: Multiple processors return first model found."""
        cpuinfo_content = """processor       : 0
model name      : Intel Core i7-10700

processor       : 1
model name      : Intel Core i7-10700

processor       : 2
model name      : Intel Core i7-10700
"""
        mock_cpuinfo = MagicMock()
        mock_cpuinfo.exists.return_value = True
        mock_cpuinfo.read_text.return_value = cpuinfo_content
        mock_path.return_value = mock_cpuinfo

        info = get_cpu_info()

        # Should return the first model found
        assert info["cpu_model"] == "Intel Core i7-10700"
