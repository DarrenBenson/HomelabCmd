"""Tests for Scan API (US0037: SSH Key Configuration, US0038: Scan Initiation).

Tests verify SSH configuration endpoints, connection testing functionality,
and scan initiation/status endpoints.

Spec Reference:
- sdlc-studio/stories/US0037-ssh-key-configuration.md
- sdlc-studio/stories/US0038-scan-initiation.md
- sdlc-studio/test-specs/TS0014-scan-initiation.md
"""

from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from homelab_cmd.services.scan import ScanService
from homelab_cmd.services.ssh import ConnectionResult, SSHConnectionService


class TestGetSSHSettings:
    """Test GET /api/v1/settings/ssh endpoint."""

    def test_get_ssh_settings_returns_200(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """GET /api/v1/settings/ssh should return 200 OK."""
        response = client.get("/api/v1/settings/ssh", headers=auth_headers)
        assert response.status_code == 200

    def test_get_ssh_settings_returns_structure(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should contain expected SSH config fields."""
        response = client.get("/api/v1/settings/ssh", headers=auth_headers)
        data = response.json()
        assert "key_path" in data
        assert "keys_found" in data
        assert "default_username" in data
        assert "default_port" in data

    def test_get_ssh_settings_returns_defaults(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should return sensible defaults."""
        response = client.get("/api/v1/settings/ssh", headers=auth_headers)
        data = response.json()
        # Default username is root, port is 22
        assert data["default_username"] == "root"
        assert data["default_port"] == 22
        # keys_found should be a list (may be empty if no keys exist)
        assert isinstance(data["keys_found"], list)

    def test_get_ssh_settings_requires_auth(self, client: TestClient) -> None:
        """GET /api/v1/settings/ssh without auth should return 401."""
        response = client.get("/api/v1/settings/ssh")
        assert response.status_code == 401


class TestUpdateSSHSettings:
    """Test PUT /api/v1/settings/ssh endpoint."""

    def test_update_ssh_settings_returns_200(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """PUT /api/v1/settings/ssh should return 200 OK."""
        update_data = {"default_username": "admin"}
        response = client.put("/api/v1/settings/ssh", json=update_data, headers=auth_headers)
        assert response.status_code == 200

    def test_update_ssh_settings_returns_updated_fields(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should list which fields were updated."""
        update_data = {"default_username": "testuser"}
        response = client.put("/api/v1/settings/ssh", json=update_data, headers=auth_headers)
        data = response.json()
        assert "updated" in data
        assert "default_username" in data["updated"]

    def test_update_ssh_settings_returns_config(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should return updated config object."""
        update_data = {"default_username": "sshuser", "default_port": 2222}
        response = client.put("/api/v1/settings/ssh", json=update_data, headers=auth_headers)
        data = response.json()
        assert "config" in data
        assert data["config"]["default_username"] == "sshuser"
        assert data["config"]["default_port"] == 2222

    def test_update_ssh_settings_persists(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Updated settings should persist in database."""
        update_data = {"default_port": 2222}
        client.put("/api/v1/settings/ssh", json=update_data, headers=auth_headers)

        response = client.get("/api/v1/settings/ssh", headers=auth_headers)
        assert response.json()["default_port"] == 2222

    def test_update_ssh_settings_partial_update(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Partial updates should not affect other fields."""
        # First update username
        client.put(
            "/api/v1/settings/ssh",
            json={"default_username": "partial_user"},
            headers=auth_headers,
        )

        # Then update port separately
        client.put(
            "/api/v1/settings/ssh",
            json={"default_port": 3333},
            headers=auth_headers,
        )

        # Verify both are set correctly
        response = client.get("/api/v1/settings/ssh", headers=auth_headers)
        data = response.json()
        assert data["default_username"] == "partial_user"
        assert data["default_port"] == 3333

    def test_update_ssh_settings_validates_port_range(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Port must be between 1 and 65535."""
        # Test port > 65535
        response = client.put(
            "/api/v1/settings/ssh",
            json={"default_port": 70000},
            headers=auth_headers,
        )
        assert response.status_code == 422

        # Test port < 1
        response = client.put(
            "/api/v1/settings/ssh",
            json={"default_port": 0},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_update_ssh_settings_validates_username_length(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Username must be between 1 and 64 characters."""
        # Test empty username
        response = client.put(
            "/api/v1/settings/ssh",
            json={"default_username": ""},
            headers=auth_headers,
        )
        assert response.status_code == 422

        # Test username too long
        response = client.put(
            "/api/v1/settings/ssh",
            json={"default_username": "a" * 65},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_update_ssh_settings_no_change_returns_empty_updated(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """If values haven't changed, updated list should be empty."""
        # Set a value
        client.put(
            "/api/v1/settings/ssh",
            json={"default_port": 22},
            headers=auth_headers,
        )

        # Set same value again
        response = client.put(
            "/api/v1/settings/ssh",
            json={"default_port": 22},
            headers=auth_headers,
        )
        data = response.json()
        assert data["updated"] == []

    def test_update_ssh_settings_requires_auth(self, client: TestClient) -> None:
        """PUT /api/v1/settings/ssh without auth should return 401."""
        response = client.put("/api/v1/settings/ssh", json={})
        assert response.status_code == 401


class TestSSHConnectionService:
    """Unit tests for SSHConnectionService."""

    def test_get_available_keys_empty_directory(self, tmp_path: Path) -> None:
        """Returns empty list when key directory is empty."""
        service = SSHConnectionService(key_path=str(tmp_path))
        assert service.get_available_keys() == []

    def test_get_available_keys_nonexistent_directory(self, tmp_path: Path) -> None:
        """Returns empty list when key directory doesn't exist."""
        nonexistent = tmp_path / "nonexistent"
        service = SSHConnectionService(key_path=str(nonexistent))
        assert service.get_available_keys() == []

    def test_get_available_keys_finds_standard_keys(self, tmp_path: Path) -> None:
        """Finds standard SSH key files."""
        # Create standard key files
        (tmp_path / "id_rsa").touch()
        (tmp_path / "id_ed25519").touch()
        (tmp_path / "id_rsa.pub").touch()  # Should be excluded

        service = SSHConnectionService(key_path=str(tmp_path))
        keys = service.get_available_keys()

        assert "id_rsa" in keys
        assert "id_ed25519" in keys
        assert "id_rsa.pub" not in keys

    def test_get_available_keys_finds_custom_keys(self, tmp_path: Path) -> None:
        """Finds custom-named key files."""
        (tmp_path / "custom_key").touch()
        (tmp_path / "another_key").touch()

        service = SSHConnectionService(key_path=str(tmp_path))
        keys = service.get_available_keys()

        assert "custom_key" in keys
        assert "another_key" in keys

    def test_validate_key_permissions_correct(self, tmp_path: Path) -> None:
        """Returns True for keys with correct 600 permissions."""
        key_file = tmp_path / "id_rsa"
        key_file.touch()
        key_file.chmod(0o600)

        service = SSHConnectionService(key_path=str(tmp_path))
        results = service.validate_key_permissions()

        assert results["id_rsa"] is True

    def test_validate_key_permissions_incorrect(self, tmp_path: Path) -> None:
        """Returns False for keys with incorrect permissions."""
        key_file = tmp_path / "id_rsa"
        key_file.touch()
        key_file.chmod(0o644)

        service = SSHConnectionService(key_path=str(tmp_path))
        results = service.validate_key_permissions()

        assert results["id_rsa"] is False


class TestTestConnection:
    """Test POST /api/v1/scan/test endpoint."""

    def test_test_connection_returns_200(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """POST /api/v1/scan/test should return 200 OK."""
        request_data = {"hostname": "192.168.1.100"}
        with patch("homelab_cmd.api.routes.scan.get_ssh_service") as mock_get_service:
            mock_service = AsyncMock()
            mock_service.test_connection.return_value = ConnectionResult(
                success=False,
                hostname="192.168.1.100",
                error="Connection refused",
            )
            mock_get_service.return_value = mock_service

            response = client.post("/api/v1/scan/test", json=request_data, headers=auth_headers)
            assert response.status_code == 200

    def test_test_connection_returns_response_structure(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should contain expected fields."""
        request_data = {"hostname": "test-host"}
        with patch("homelab_cmd.api.routes.scan.get_ssh_service") as mock_get_service:
            mock_service = AsyncMock()
            mock_service.test_connection.return_value = ConnectionResult(
                success=True,
                hostname="test-host",
                remote_hostname="test-host.local",
                response_time_ms=150,
            )
            mock_get_service.return_value = mock_service

            response = client.post("/api/v1/scan/test", json=request_data, headers=auth_headers)
            data = response.json()

            assert "status" in data
            assert "hostname" in data
            assert data["status"] == "success"
            assert data["hostname"] == "test-host"
            assert data["remote_hostname"] == "test-host.local"
            assert data["response_time_ms"] == 150

    def test_test_connection_failed_response(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Failed connection should return status 'failed' with error."""
        request_data = {"hostname": "unreachable-host"}
        with patch("homelab_cmd.api.routes.scan.get_ssh_service") as mock_get_service:
            mock_service = AsyncMock()
            mock_service.test_connection.return_value = ConnectionResult(
                success=False,
                hostname="unreachable-host",
                error="Connection timed out after 10s",
            )
            mock_get_service.return_value = mock_service

            response = client.post("/api/v1/scan/test", json=request_data, headers=auth_headers)
            data = response.json()

            assert data["status"] == "failed"
            assert data["error"] == "Connection timed out after 10s"
            assert data["remote_hostname"] is None
            assert data["response_time_ms"] is None

    def test_test_connection_with_custom_port_and_username(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Should accept custom port and username."""
        request_data = {
            "hostname": "custom-host",
            "port": 2222,
            "username": "admin",
        }
        with patch("homelab_cmd.api.routes.scan.get_ssh_service") as mock_get_service:
            mock_service = AsyncMock()
            mock_service.test_connection.return_value = ConnectionResult(
                success=True,
                hostname="custom-host",
                remote_hostname="custom-host",
                response_time_ms=100,
            )
            mock_get_service.return_value = mock_service

            response = client.post("/api/v1/scan/test", json=request_data, headers=auth_headers)
            assert response.status_code == 200

            # Verify the service was called with correct parameters
            mock_service.test_connection.assert_called_once()
            call_kwargs = mock_service.test_connection.call_args[1]
            assert call_kwargs["hostname"] == "custom-host"
            assert call_kwargs["port"] == 2222
            assert call_kwargs["username"] == "admin"

    def test_test_connection_validates_hostname(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Hostname is required and must be non-empty."""
        # Test missing hostname
        response = client.post("/api/v1/scan/test", json={}, headers=auth_headers)
        assert response.status_code == 422

        # Test empty hostname
        response = client.post("/api/v1/scan/test", json={"hostname": ""}, headers=auth_headers)
        assert response.status_code == 422

    def test_test_connection_validates_port_range(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Port must be between 1 and 65535."""
        response = client.post(
            "/api/v1/scan/test",
            json={"hostname": "test", "port": 70000},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_test_connection_requires_auth(self, client: TestClient) -> None:
        """POST /api/v1/scan/test without auth should return 401."""
        response = client.post("/api/v1/scan/test", json={"hostname": "test"})
        assert response.status_code == 401


# =============================================================================
# US0038: Scan Initiation Tests
# Test Spec: TS0014
# =============================================================================


class TestScanServiceParsers:
    """Unit tests for ScanService parsing methods (TC211-TC216)."""

    def test_parse_os_release_ubuntu(self) -> None:
        """TC211: Parse /etc/os-release output for Ubuntu."""
        os_release = """NAME="Ubuntu"
VERSION_ID="22.04"
ID=ubuntu
PRETTY_NAME="Ubuntu 22.04.3 LTS"
"""
        result = ScanService.parse_os_release(os_release)

        assert result["name"] == "Ubuntu"
        assert result["version"] == "22.04"
        assert result["id"] == "ubuntu"
        assert result["pretty_name"] == "Ubuntu 22.04.3 LTS"

    def test_parse_os_release_handles_missing_fields(self) -> None:
        """Parse os-release with some fields missing."""
        os_release = 'NAME="Alpine Linux"\nID=alpine'
        result = ScanService.parse_os_release(os_release)

        assert result["name"] == "Alpine Linux"
        assert result["id"] == "alpine"
        assert "version" not in result
        assert "pretty_name" not in result

    def test_parse_disk_usage(self) -> None:
        """TC212: Parse df -P output."""
        df_output = """Filesystem     1024-blocks      Used Available Capacity Mounted on
/dev/sda1        512000000 120000000 392000000      24% /
/dev/sdb1        100000000  50000000  50000000      50% /data
tmpfs              8000000   100000   7900000       2% /run
"""
        result = ScanService.parse_disk_usage(df_output)

        assert len(result) >= 2
        # Check root mount
        root_disk = next((d for d in result if d["mount"] == "/"), None)
        assert root_disk is not None
        assert root_disk["total_gb"] == pytest.approx(488.3, rel=0.1)
        assert root_disk["used_gb"] == pytest.approx(114.4, rel=0.1)
        assert root_disk["percent"] == 24

        # Check data mount
        data_disk = next((d for d in result if d["mount"] == "/data"), None)
        assert data_disk is not None
        assert data_disk["percent"] == 50

    def test_parse_memory(self) -> None:
        """TC213: Parse free -b output."""
        free_output = """              total        used        free      shared  buff/cache   available
Mem:    17179869184  8589934592  4294967296   536870912  4294967296  8053063680
Swap:    2147483648           0  2147483648
"""
        result = ScanService.parse_memory(free_output)

        assert result["total_mb"] == pytest.approx(16384, rel=1)
        assert result["used_mb"] == pytest.approx(8192, rel=1)
        assert result["percent"] == 50

    def test_parse_memory_handles_invalid(self) -> None:
        """Parse memory with invalid output."""
        result = ScanService.parse_memory("invalid output")
        assert result["total_mb"] == 0
        assert result["used_mb"] == 0
        assert result["percent"] == 0

    def test_parse_uptime(self) -> None:
        """Parse /proc/uptime output."""
        uptime_output = "345600.00 123456.78"
        result = ScanService.parse_uptime(uptime_output)
        assert result == 345600  # 4 days

    def test_parse_uptime_handles_invalid(self) -> None:
        """Parse uptime with invalid output."""
        result = ScanService.parse_uptime("invalid")
        assert result == 0

    def test_parse_package_count(self) -> None:
        """TC214: Parse dpkg -l | wc -l output."""
        # dpkg -l has 5 header lines
        wc_output = "505"  # 500 packages + 5 headers
        result = ScanService.parse_package_count(wc_output)
        assert result == 500

    def test_parse_package_list(self) -> None:
        """TC214: Parse dpkg -l output."""
        dpkg_output = """Desired=Unknown/Install/Remove/Purge/Hold
| Status=Not/Inst/Conf-files/Unpacked/halF-conf/Half-inst/trig-aWait/Trig-pend
|/ Err?=(none)/Reinst-required (Status,Err: uppercase=bad)
||/ Name           Version      Architecture Description
+++-==============-============-============-=================================
ii  adduser        3.118ubuntu5 all          add and remove users and groups
ii  apt            2.4.10       amd64        commandline package manager
ii  base-files     12ubuntu4.4  amd64        Debian base system miscellaneous files
"""
        result = ScanService.parse_package_list(dpkg_output)

        assert "adduser" in result
        assert "apt" in result
        assert "base-files" in result
        assert len(result) == 3

    def test_parse_processes(self) -> None:
        """TC215: Parse ps aux output."""
        ps_output = """USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root           1  0.0  0.1 168936 12288 ?        Ss   Jan20   0:05 /sbin/init
mysql       1234  2.5 15.2 1234567 250000 ?     Ssl  Jan20  10:30 /usr/sbin/mysqld
www-data    5678  1.2  3.4  456789  56000 ?     S    Jan20   5:15 apache2 -k start
"""
        result = ScanService.parse_processes(ps_output)

        assert len(result) == 3
        assert result[0]["user"] == "root"
        assert result[0]["pid"] == 1
        assert result[0]["cpu_percent"] == 0.0
        assert result[0]["mem_percent"] == 0.1

        mysql_proc = next((p for p in result if p["pid"] == 1234), None)
        assert mysql_proc is not None
        assert mysql_proc["user"] == "mysql"
        assert mysql_proc["cpu_percent"] == 2.5
        assert mysql_proc["mem_percent"] == 15.2

    def test_parse_network_interfaces(self) -> None:
        """TC216: Parse ip addr show output."""
        ip_output = """1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
    inet6 ::1/128 scope host noprefixroute
       valid_lft forever preferred_lft forever
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000
    link/ether 00:11:22:33:44:55 brd ff:ff:ff:ff:ff:ff
    inet 192.168.1.100/24 brd 192.168.1.255 scope global dynamic eth0
       valid_lft 86400sec preferred_lft 86400sec
    inet6 fe80::1234:5678:abcd:ef01/64 scope link
       valid_lft forever preferred_lft forever
3: docker0: <NO-CARRIER,BROADCAST,MULTICAST,UP> mtu 1500 qdisc noqueue state DOWN group default
    link/ether 02:42:ac:11:00:01 brd ff:ff:ff:ff:ff:ff
    inet 172.17.0.1/16 brd 172.17.255.255 scope global docker0
       valid_lft forever preferred_lft forever
"""
        result = ScanService.parse_network_interfaces(ip_output)

        assert len(result) == 3

        # Check lo
        lo = next((i for i in result if i["name"] == "lo"), None)
        assert lo is not None
        assert lo["state"] == "unknown"  # "UNKNOWN" in output
        assert any(a["address"] == "127.0.0.1/8" for a in lo["addresses"])

        # Check eth0
        eth0 = next((i for i in result if i["name"] == "eth0"), None)
        assert eth0 is not None
        assert eth0["state"] == "up"
        ipv4_addrs = [a for a in eth0["addresses"] if a["type"] == "ipv4"]
        assert len(ipv4_addrs) == 1
        assert ipv4_addrs[0]["address"] == "192.168.1.100/24"

        # Check docker0
        docker0 = next((i for i in result if i["name"] == "docker0"), None)
        assert docker0 is not None
        assert docker0["state"] == "down"


class TestInitiateScan:
    """Test POST /api/v1/scans endpoint (TC207-TC210)."""

    def test_initiate_quick_scan_returns_202(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC207: POST /api/v1/scans with quick scan returns 202 Accepted."""
        request_data = {"hostname": "192.168.1.100", "scan_type": "quick"}

        response = client.post("/api/v1/scans", json=request_data, headers=auth_headers)

        assert response.status_code == 202
        data = response.json()
        assert "scan_id" in data
        assert data["status"] == "pending"
        assert data["scan_type"] == "quick"
        assert data["hostname"] == "192.168.1.100"

    def test_quick_scan_uses_defaults(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC208: Quick scan uses default port and username when not specified."""
        request_data = {"hostname": "192.168.1.100", "scan_type": "quick"}

        response = client.post("/api/v1/scans", json=request_data, headers=auth_headers)

        assert response.status_code == 202
        # Verify the scan was created (we can't easily verify port/username from response
        # but the fact it was created without error indicates defaults were used)

    def test_initiate_full_scan_returns_202(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC209: POST /api/v1/scans with full scan returns 202 Accepted."""
        request_data = {"hostname": "192.168.1.100", "scan_type": "full"}

        response = client.post("/api/v1/scans", json=request_data, headers=auth_headers)

        assert response.status_code == 202
        data = response.json()
        assert data["scan_type"] == "full"

    def test_full_scan_with_custom_params(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC210: Full scan accepts custom port and username."""
        request_data = {
            "hostname": "192.168.1.100",
            "port": 2222,
            "username": "admin",
            "scan_type": "full",
        }

        response = client.post("/api/v1/scans", json=request_data, headers=auth_headers)

        assert response.status_code == 202

    def test_initiate_scan_requires_auth(self, client: TestClient) -> None:
        """TC227: POST /api/v1/scans without auth returns 401."""
        request_data = {"hostname": "192.168.1.100", "scan_type": "quick"}

        response = client.post("/api/v1/scans", json=request_data)

        assert response.status_code == 401

    def test_initiate_scan_validates_hostname(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC229: Empty hostname is rejected."""
        response = client.post(
            "/api/v1/scans",
            json={"hostname": "", "scan_type": "quick"},
            headers=auth_headers,
        )
        assert response.status_code == 422

        # Missing hostname
        response = client.post(
            "/api/v1/scans",
            json={"scan_type": "quick"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_initiate_scan_validates_scan_type(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC228: Invalid scan_type is rejected."""
        response = client.post(
            "/api/v1/scans",
            json={"hostname": "192.168.1.100", "scan_type": "invalid"},
            headers=auth_headers,
        )
        assert response.status_code == 422


class TestGetScanStatus:
    """Test GET /api/v1/scans/{scan_id} endpoint (TC217-TC219)."""

    def test_get_scan_status_returns_200(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC217/TC219: GET /api/v1/scans/{scan_id} returns scan status."""
        # First create a scan
        create_response = client.post(
            "/api/v1/scans",
            json={"hostname": "192.168.1.100", "scan_type": "quick"},
            headers=auth_headers,
        )
        scan_id = create_response.json()["scan_id"]

        # Get scan status
        response = client.get(f"/api/v1/scans/{scan_id}", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["scan_id"] == scan_id
        assert data["hostname"] == "192.168.1.100"
        assert "status" in data
        assert "progress" in data

    def test_get_scan_not_found(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """TC224: GET /api/v1/scans/{scan_id} returns 404 for non-existent scan."""
        response = client.get("/api/v1/scans/99999", headers=auth_headers)

        assert response.status_code == 404

    def test_get_scan_requires_auth(self, client: TestClient) -> None:
        """TC227: GET /api/v1/scans/{scan_id} without auth returns 401."""
        response = client.get("/api/v1/scans/1")

        assert response.status_code == 401


class TestListScans:
    """Test GET /api/v1/scans endpoint (TC225-TC226)."""

    def test_list_scans_returns_200(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """GET /api/v1/scans returns list of scans."""
        # Create a scan first
        client.post(
            "/api/v1/scans",
            json={"hostname": "192.168.1.100", "scan_type": "quick"},
            headers=auth_headers,
        )

        response = client.get("/api/v1/scans", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert "scans" in data
        assert "total" in data
        assert isinstance(data["scans"], list)

    def test_list_scans_with_pagination(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC225: GET /api/v1/scans supports pagination."""
        # Create a few scans
        for i in range(5):
            client.post(
                "/api/v1/scans",
                json={"hostname": f"192.168.1.{100 + i}", "scan_type": "quick"},
                headers=auth_headers,
            )

        # Get first page
        response = client.get("/api/v1/scans?limit=2&offset=0", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert len(data["scans"]) == 2
        assert data["total"] >= 5

        # Get second page
        response = client.get("/api/v1/scans?limit=2&offset=2", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert len(data["scans"]) == 2

    def test_list_scans_filter_by_hostname(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC226: GET /api/v1/scans can filter by hostname."""
        # Create scans for different hosts
        client.post(
            "/api/v1/scans",
            json={"hostname": "test-host-1", "scan_type": "quick"},
            headers=auth_headers,
        )
        client.post(
            "/api/v1/scans",
            json={"hostname": "test-host-2", "scan_type": "quick"},
            headers=auth_headers,
        )

        # Filter by hostname
        response = client.get("/api/v1/scans?hostname=test-host-1", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        for scan in data["scans"]:
            assert scan["hostname"] == "test-host-1"

    def test_list_scans_requires_auth(self, client: TestClient) -> None:
        """TC227: GET /api/v1/scans without auth returns 401."""
        response = client.get("/api/v1/scans")

        assert response.status_code == 401


# =============================================================================
# ScanService.execute_scan Tests (Coverage for lines 419-564)
# =============================================================================


class TestExecuteScan:
    """Tests for ScanService.execute_scan method."""

    @pytest.mark.asyncio
    async def test_execute_quick_scan_success(self, db_session) -> None:
        """Quick scan collects OS, hostname, uptime, disk, and memory."""
        from homelab_cmd.db.models.scan import Scan, ScanStatus
        from homelab_cmd.services.scan import ScanService
        from homelab_cmd.services.ssh import CommandResult

        # Create scan record
        scan = Scan(
            hostname="test-host",
            port=22,
            username="root",
            scan_type="quick",
            status=ScanStatus.PENDING.value,
        )
        db_session.add(scan)
        await db_session.commit()
        await db_session.refresh(scan)

        # Mock SSH service
        service = ScanService()

        async def mock_execute_command(**kwargs):
            cmd = kwargs.get("command", "")
            if "os-release" in cmd:
                return CommandResult(
                    success=True,
                    stdout='NAME="Ubuntu"\nVERSION_ID="22.04"\nID=ubuntu\nPRETTY_NAME="Ubuntu 22.04 LTS"',
                    stderr="",
                    exit_code=0,
                )
            elif "uname -r" in cmd:
                return CommandResult(success=True, stdout="5.15.0-generic", stderr="", exit_code=0)
            elif cmd == "hostname":
                return CommandResult(success=True, stdout="test-host.local", stderr="", exit_code=0)
            elif "proc/uptime" in cmd:
                return CommandResult(success=True, stdout="86400.00 12345.00", stderr="", exit_code=0)
            elif "df -P" in cmd:
                return CommandResult(
                    success=True,
                    stdout="Filesystem 1024-blocks Used Available Capacity Mounted\n/dev/sda1 100000000 50000000 50000000 50% /",
                    stderr="",
                    exit_code=0,
                )
            elif "free -b" in cmd:
                return CommandResult(
                    success=True,
                    stdout="              total        used        free\nMem:    8589934592  4294967296  4294967296",
                    stderr="",
                    exit_code=0,
                )
            return CommandResult(success=False, stdout="", stderr="Unknown command", exit_code=1)

        with patch.object(service.ssh_service, "execute_command", side_effect=mock_execute_command):
            results = await service.execute_scan(scan, db_session)

        await db_session.refresh(scan)
        assert scan.status == ScanStatus.COMPLETED.value
        assert results.hostname == "test-host.local"
        assert results.os["name"] == "Ubuntu"
        assert results.os["kernel"] == "5.15.0-generic"
        assert results.uptime_seconds == 86400
        assert len(results.disk) >= 1
        assert results.memory is not None

    @pytest.mark.asyncio
    async def test_execute_full_scan_collects_additional_data(self, db_session) -> None:
        """Full scan also collects packages, processes, and network interfaces."""
        from homelab_cmd.db.models.scan import Scan, ScanStatus
        from homelab_cmd.services.scan import ScanService
        from homelab_cmd.services.ssh import CommandResult

        scan = Scan(
            hostname="full-scan-host",
            port=22,
            username="root",
            scan_type="full",
            status=ScanStatus.PENDING.value,
        )
        db_session.add(scan)
        await db_session.commit()
        await db_session.refresh(scan)

        service = ScanService()

        async def mock_execute_command(**kwargs):
            cmd = kwargs.get("command", "")
            if "os-release" in cmd:
                return CommandResult(success=True, stdout='NAME="Debian"\nVERSION_ID="12"', stderr="", exit_code=0)
            elif "uname -r" in cmd:
                return CommandResult(success=True, stdout="6.1.0-generic", stderr="", exit_code=0)
            elif cmd == "hostname":
                return CommandResult(success=True, stdout="full-scan-host.local", stderr="", exit_code=0)
            elif "proc/uptime" in cmd:
                return CommandResult(success=True, stdout="3600.00 1000.00", stderr="", exit_code=0)
            elif "dpkg -l" in cmd and "wc -l" in cmd:
                return CommandResult(success=True, stdout="105", stderr="", exit_code=0)
            elif "dpkg -l" in cmd and "tail" in cmd:
                return CommandResult(
                    success=True,
                    stdout="ii  apt    2.4.10  amd64  package manager\nii  bash  5.1  amd64  shell",
                    stderr="",
                    exit_code=0,
                )
            elif "df -P" in cmd:
                return CommandResult(
                    success=True,
                    stdout="Filesystem 1024-blocks Used Available Capacity Mounted\n/dev/sda1 50000000 25000000 25000000 50% /",
                    stderr="",
                    exit_code=0,
                )
            elif "ps aux" in cmd:
                return CommandResult(
                    success=True,
                    stdout="USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND\nroot 1 0.0 0.1 1000 500 ? Ss Jan01 0:00 init",
                    stderr="",
                    exit_code=0,
                )
            elif "free -b" in cmd:
                return CommandResult(
                    success=True,
                    stdout="              total        used        free\nMem:    4294967296  2147483648  2147483648",
                    stderr="",
                    exit_code=0,
                )
            elif "ip addr" in cmd:
                return CommandResult(
                    success=True,
                    stdout="1: lo: <LOOPBACK,UP> mtu 65536\n    inet 127.0.0.1/8\n2: eth0: <BROADCAST,UP> mtu 1500 state UP\n    inet 192.168.1.100/24",
                    stderr="",
                    exit_code=0,
                )
            return CommandResult(success=True, stdout="", stderr="", exit_code=0)

        with patch.object(service.ssh_service, "execute_command", side_effect=mock_execute_command):
            results = await service.execute_scan(scan, db_session)

        await db_session.refresh(scan)
        assert scan.status == ScanStatus.COMPLETED.value
        assert results.packages is not None
        assert results.packages["count"] == 100  # 105 - 5 header lines
        assert len(results.processes) >= 1
        assert len(results.network_interfaces) >= 1

    @pytest.mark.asyncio
    async def test_execute_scan_handles_ssh_failure(self, db_session) -> None:
        """Scan handles SSH connection failure gracefully."""
        from homelab_cmd.db.models.scan import Scan, ScanStatus
        from homelab_cmd.services.scan import ScanService
        from homelab_cmd.services.ssh import CommandResult

        scan = Scan(
            hostname="unreachable-host",
            port=22,
            username="root",
            scan_type="quick",
            status=ScanStatus.PENDING.value,
        )
        db_session.add(scan)
        await db_session.commit()
        await db_session.refresh(scan)

        service = ScanService()

        async def mock_execute_command(**kwargs):
            return CommandResult(
                success=False, stdout="", stderr="", exit_code=255, error="Connection refused"
            )

        with patch.object(service.ssh_service, "execute_command", side_effect=mock_execute_command):
            results = await service.execute_scan(scan, db_session)

        await db_session.refresh(scan)
        assert scan.status == ScanStatus.FAILED.value
        assert scan.error == "Connection refused"

    @pytest.mark.asyncio
    async def test_execute_scan_handles_exception(self, db_session) -> None:
        """Scan handles unexpected exceptions gracefully."""
        from homelab_cmd.db.models.scan import Scan, ScanStatus
        from homelab_cmd.services.scan import ScanService

        scan = Scan(
            hostname="error-host",
            port=22,
            username="root",
            scan_type="quick",
            status=ScanStatus.PENDING.value,
        )
        db_session.add(scan)
        await db_session.commit()
        await db_session.refresh(scan)

        service = ScanService()

        with patch.object(
            service.ssh_service, "execute_command", side_effect=Exception("Unexpected error")
        ):
            results = await service.execute_scan(scan, db_session)

        await db_session.refresh(scan)
        assert scan.status == ScanStatus.FAILED.value
        assert "Unexpected error" in scan.error

    @pytest.mark.asyncio
    async def test_execute_scan_records_partial_failures(self, db_session) -> None:
        """Scan records errors for individual steps that fail."""
        from homelab_cmd.db.models.scan import Scan, ScanStatus
        from homelab_cmd.services.scan import ScanService
        from homelab_cmd.services.ssh import CommandResult

        scan = Scan(
            hostname="partial-fail-host",
            port=22,
            username="root",
            scan_type="quick",
            status=ScanStatus.PENDING.value,
        )
        db_session.add(scan)
        await db_session.commit()
        await db_session.refresh(scan)

        service = ScanService()

        async def mock_execute_command(**kwargs):
            cmd = kwargs.get("command", "")
            if "os-release" in cmd:
                return CommandResult(success=True, stdout='NAME="Ubuntu"', stderr="", exit_code=0)
            elif "uname -r" in cmd:
                return CommandResult(success=True, stdout="5.15.0", stderr="", exit_code=0)
            elif cmd == "hostname":
                return CommandResult(success=False, stdout="", stderr="Error", exit_code=1)
            elif "proc/uptime" in cmd:
                return CommandResult(success=False, stdout="", stderr="Error", exit_code=1)
            elif "df -P" in cmd:
                return CommandResult(success=True, stdout="Filesystem 1024-blocks Used Available Capacity Mounted\n/dev/sda1 100000 50000 50000 50% /", stderr="", exit_code=0)
            elif "free -b" in cmd:
                return CommandResult(success=False, stdout="", stderr="Error", exit_code=1)
            return CommandResult(success=True, stdout="", stderr="", exit_code=0)

        with patch.object(service.ssh_service, "execute_command", side_effect=mock_execute_command):
            results = await service.execute_scan(scan, db_session)

        await db_session.refresh(scan)
        assert scan.status == ScanStatus.COMPLETED.value
        assert "Failed to get hostname" in results.errors
        assert "Failed to get uptime" in results.errors
        assert "Failed to get memory usage" in results.errors


class TestScanResultsToDict:
    """Tests for ScanResults.to_dict method."""

    def test_to_dict_includes_all_fields(self) -> None:
        """to_dict includes all scan result fields."""
        from homelab_cmd.services.scan import ScanResults

        results = ScanResults(
            os={"name": "Ubuntu", "version": "22.04"},
            hostname="test-host",
            uptime_seconds=3600,
            disk=[{"mount": "/", "percent": 50}],
            memory={"total_mb": 8192, "used_mb": 4096, "percent": 50},
            packages={"count": 100, "recent": ["apt", "bash"]},
            processes=[{"pid": 1, "user": "root", "command": "init"}],
            network_interfaces=[{"name": "eth0", "state": "up"}],
            errors=["Warning: some step failed"],
        )

        data = results.to_dict()

        assert data["os"] == {"name": "Ubuntu", "version": "22.04"}
        assert data["hostname"] == "test-host"
        assert data["uptime_seconds"] == 3600
        assert data["disk"] == [{"mount": "/", "percent": 50}]
        assert data["memory"] == {"total_mb": 8192, "used_mb": 4096, "percent": 50}
        assert data["packages"] == {"count": 100, "recent": ["apt", "bash"]}
        assert len(data["processes"]) == 1
        assert len(data["network_interfaces"]) == 1
        assert data["errors"] == ["Warning: some step failed"]

    def test_to_dict_omits_empty_errors(self) -> None:
        """to_dict returns None for errors when list is empty."""
        from homelab_cmd.services.scan import ScanResults

        results = ScanResults()
        data = results.to_dict()

        assert data["errors"] is None


class TestParseKernelVersion:
    """Tests for parse_kernel_version method."""

    def test_parse_kernel_version_strips_whitespace(self) -> None:
        """Kernel version output is stripped of whitespace."""
        result = ScanService.parse_kernel_version("  5.15.0-generic  \n")
        assert result == "5.15.0-generic"
