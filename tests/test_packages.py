"""Tests for Package Update List View (TS0010: TC175-TC189).

These tests verify the package list collection, storage, and display for US0051.

Spec Reference: sdlc-studio/test-specs/TS0010-package-update-list.md
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

# Add project root to path for imports
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


# =============================================================================
# Agent Collection Tests (TC175-TC178)
# =============================================================================


class TestGetPackageUpdateList:
    """Tests for agent package list collection (AC1)."""

    @patch("agent.collectors.subprocess.run")
    def test_collects_package_list_on_debian_system(self, mock_run: MagicMock) -> None:
        """TC175: Agent collects full package list with all details."""
        from agent import get_package_update_list

        # First call checks for apt, second runs apt list
        mock_run.side_effect = [
            MagicMock(),  # which apt succeeds
            MagicMock(
                stdout="""Listing...
openssl/bookworm-security 3.0.14-1~deb12u1 amd64 [upgradable from: 3.0.13-1~deb12u1]
vim/bookworm 9.0.1499-1 amd64 [upgradable from: 9.0.1378-2]
"""
            ),
        ]

        packages = get_package_update_list()

        assert len(packages) == 2

        # Check openssl (security package)
        openssl = next(p for p in packages if p["name"] == "openssl")
        assert openssl["current_version"] == "3.0.13-1~deb12u1"
        assert openssl["new_version"] == "3.0.14-1~deb12u1"
        assert openssl["repository"] == "bookworm-security"
        assert openssl["is_security"] is True

        # Check vim (non-security package)
        vim = next(p for p in packages if p["name"] == "vim")
        assert vim["current_version"] == "9.0.1378-2"
        assert vim["new_version"] == "9.0.1499-1"
        assert vim["repository"] == "bookworm"
        assert vim["is_security"] is False

    @patch("agent.collectors.subprocess.run")
    def test_returns_empty_list_on_non_debian_system(self, mock_run: MagicMock) -> None:
        """TC176: Non-Debian systems return empty list without error."""
        from agent import get_package_update_list

        mock_run.side_effect = FileNotFoundError("apt not found")

        packages = get_package_update_list()

        assert packages == []

    @patch("agent.collectors.subprocess.run")
    def test_handles_apt_timeout_gracefully(self, mock_run: MagicMock) -> None:
        """TC177: Timeout returns empty list."""
        from subprocess import TimeoutExpired

        from agent import get_package_update_list

        mock_run.side_effect = [
            MagicMock(),  # which apt succeeds
            TimeoutExpired("apt", 30),
        ]

        packages = get_package_update_list()

        assert packages == []

    @patch("agent.collectors.subprocess.run")
    def test_parses_package_with_special_characters(self, mock_run: MagicMock) -> None:
        """TC178: Package names with dots, numbers, plus signs parsed correctly."""
        from agent import get_package_update_list

        mock_run.side_effect = [
            MagicMock(),  # which apt succeeds
            MagicMock(
                stdout="""Listing...
libglib2.0-0/bookworm 2.74.6-2+deb12u3 amd64 [upgradable from: 2.74.6-2+deb12u2]
python3.12/bookworm 3.12.1-1 amd64 [upgradable from: 3.12.0-1]
"""
            ),
        ]

        packages = get_package_update_list()

        assert len(packages) == 2
        assert packages[0]["name"] == "libglib2.0-0"
        assert packages[0]["current_version"] == "2.74.6-2+deb12u2"
        assert packages[0]["new_version"] == "2.74.6-2+deb12u3"

    @patch("agent.collectors.subprocess.run")
    def test_handles_empty_apt_output(self, mock_run: MagicMock) -> None:
        """No packages available returns empty list."""
        from agent import get_package_update_list

        mock_run.side_effect = [
            MagicMock(),  # which apt succeeds
            MagicMock(stdout="Listing...\n"),  # No packages
        ]

        packages = get_package_update_list()

        assert packages == []

    @patch("agent.collectors.subprocess.run")
    def test_handles_subprocess_error(self, mock_run: MagicMock) -> None:
        """CalledProcessError returns empty list."""
        from subprocess import CalledProcessError

        from agent import get_package_update_list

        mock_run.side_effect = [
            MagicMock(),  # which apt succeeds
            CalledProcessError(1, "apt"),
        ]

        packages = get_package_update_list()

        assert packages == []


# =============================================================================
# API Endpoint Tests (TC183-TC185)
# =============================================================================


class TestGetServerPackagesEndpoint:
    """Tests for GET /api/v1/servers/{id}/packages endpoint (AC3)."""

    def test_returns_package_list_for_server(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC183: Returns 200 with packages array for existing server."""
        # Create server and send heartbeat with packages
        heartbeat_data = {
            "server_id": "package-test-server",
            "hostname": "package-test.local",
            "timestamp": "2026-01-20T10:00:00Z",
            "metrics": {
                "cpu_percent": 50.0,
                "memory_percent": 60.0,
                "disk_percent": 70.0,
            },
            "packages": [
                {
                    "name": "openssl",
                    "current_version": "3.0.13-1~deb12u1",
                    "new_version": "3.0.14-1~deb12u1",
                    "repository": "bookworm-security",
                    "is_security": True,
                },
                {
                    "name": "vim",
                    "current_version": "9.0.1378-2",
                    "new_version": "9.0.1499-1",
                    "repository": "bookworm",
                    "is_security": False,
                },
            ],
        }
        client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)

        # Get packages
        response = client.get("/api/v1/servers/package-test-server/packages", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["server_id"] == "package-test-server"
        assert data["total_count"] == 2
        assert data["security_count"] == 1
        assert len(data["packages"]) == 2

        # Verify package details
        openssl = next(p for p in data["packages"] if p["name"] == "openssl")
        assert openssl["is_security"] is True
        assert openssl["new_version"] == "3.0.14-1~deb12u1"

    def test_returns_404_for_unknown_server(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC184: Returns 404 for nonexistent server."""
        response = client.get("/api/v1/servers/nonexistent-server/packages", headers=auth_headers)

        assert response.status_code == 404
        assert response.json()["detail"]["code"] == "NOT_FOUND"
        assert "nonexistent-server" in response.json()["detail"]["message"]

    def test_returns_empty_packages_for_new_server(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC185: New server without heartbeat returns empty packages, null last_checked."""
        # Create server without heartbeat
        server_data = {
            "id": "new-server-no-packages",
            "hostname": "new-server.local",
        }
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        # Get packages
        response = client.get(
            "/api/v1/servers/new-server-no-packages/packages", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["packages"] == []
        assert data["total_count"] == 0
        assert data["security_count"] == 0
        assert data["last_checked"] is None

    def test_requires_authentication(self, client: TestClient) -> None:
        """Endpoint requires API key authentication."""
        response = client.get("/api/v1/servers/any-server/packages")

        assert response.status_code == 401


# =============================================================================
# Heartbeat Integration Tests (TC179-TC182)
# =============================================================================


class TestHeartbeatPackageProcessing:
    """Tests for heartbeat package storage (AC2, AC5)."""

    def test_heartbeat_stores_package_list(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC179: Packages in heartbeat are stored in database."""
        heartbeat_data = {
            "server_id": "heartbeat-package-server",
            "hostname": "heartbeat-test.local",
            "timestamp": "2026-01-20T10:00:00Z",
            "metrics": {"cpu_percent": 50.0, "memory_percent": 60.0, "disk_percent": 70.0},
            "packages": [
                {
                    "name": "openssl",
                    "current_version": "3.0.13",
                    "new_version": "3.0.14",
                    "repository": "bookworm-security",
                    "is_security": True,
                }
            ],
        }
        response = client.post(
            "/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers
        )
        assert response.status_code == 200

        # Verify packages are stored
        response = client.get(
            "/api/v1/servers/heartbeat-package-server/packages", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["packages"]) == 1
        assert data["packages"][0]["name"] == "openssl"

    def test_heartbeat_removes_packages_no_longer_pending(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC180: Packages not in new heartbeat are removed."""
        # First heartbeat with 3 packages
        heartbeat_data = {
            "server_id": "remove-package-server",
            "hostname": "remove-test.local",
            "timestamp": "2026-01-20T10:00:00Z",
            "metrics": {"cpu_percent": 50.0, "memory_percent": 60.0, "disk_percent": 70.0},
            "packages": [
                {
                    "name": "openssl",
                    "current_version": "1.0",
                    "new_version": "1.1",
                    "repository": "bookworm-security",
                    "is_security": True,
                },
                {
                    "name": "vim",
                    "current_version": "1.0",
                    "new_version": "1.1",
                    "repository": "bookworm",
                    "is_security": False,
                },
                {
                    "name": "curl",
                    "current_version": "1.0",
                    "new_version": "1.1",
                    "repository": "bookworm",
                    "is_security": False,
                },
            ],
        }
        client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)

        # Second heartbeat with only 2 packages (curl removed)
        heartbeat_data["timestamp"] = "2026-01-20T10:01:00Z"
        heartbeat_data["packages"] = [
            {
                "name": "openssl",
                "current_version": "1.0",
                "new_version": "1.1",
                "repository": "bookworm-security",
                "is_security": True,
            },
            {
                "name": "vim",
                "current_version": "1.0",
                "new_version": "1.1",
                "repository": "bookworm",
                "is_security": False,
            },
        ]
        client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)

        # Verify curl is gone
        response = client.get(
            "/api/v1/servers/remove-package-server/packages", headers=auth_headers
        )
        data = response.json()
        assert len(data["packages"]) == 2
        package_names = [p["name"] for p in data["packages"]]
        assert "curl" not in package_names
        assert "openssl" in package_names
        assert "vim" in package_names

    def test_heartbeat_updates_package_version(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC181: Package version changes are updated."""
        # First heartbeat
        heartbeat_data = {
            "server_id": "update-version-server",
            "hostname": "update-test.local",
            "timestamp": "2026-01-20T10:00:00Z",
            "metrics": {"cpu_percent": 50.0, "memory_percent": 60.0, "disk_percent": 70.0},
            "packages": [
                {
                    "name": "openssl",
                    "current_version": "3.0.13",
                    "new_version": "3.0.14",
                    "repository": "bookworm-security",
                    "is_security": True,
                },
            ],
        }
        client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)

        # Second heartbeat with updated version
        heartbeat_data["timestamp"] = "2026-01-20T10:01:00Z"
        heartbeat_data["packages"] = [
            {
                "name": "openssl",
                "current_version": "3.0.13",
                "new_version": "3.0.15",
                "repository": "bookworm-security",
                "is_security": True,
            },
        ]
        client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)

        # Verify version updated
        response = client.get(
            "/api/v1/servers/update-version-server/packages", headers=auth_headers
        )
        data = response.json()
        assert len(data["packages"]) == 1
        assert data["packages"][0]["new_version"] == "3.0.15"

    def test_heartbeat_without_packages_preserves_existing(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Heartbeat without packages field doesn't delete existing packages."""
        # First heartbeat with packages
        heartbeat_data = {
            "server_id": "preserve-package-server",
            "hostname": "preserve-test.local",
            "timestamp": "2026-01-20T10:00:00Z",
            "metrics": {"cpu_percent": 50.0, "memory_percent": 60.0, "disk_percent": 70.0},
            "packages": [
                {
                    "name": "openssl",
                    "current_version": "1.0",
                    "new_version": "1.1",
                    "repository": "bookworm-security",
                    "is_security": True,
                },
            ],
        }
        client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)

        # Second heartbeat without packages field (backward compatible agent)
        heartbeat_data["timestamp"] = "2026-01-20T10:01:00Z"
        del heartbeat_data["packages"]
        client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)

        # Verify packages preserved
        response = client.get(
            "/api/v1/servers/preserve-package-server/packages", headers=auth_headers
        )
        data = response.json()
        assert len(data["packages"]) == 1

    def test_heartbeat_with_empty_packages_clears_all(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC189: Heartbeat with empty packages array removes all packages."""
        # First heartbeat with packages
        heartbeat_data = {
            "server_id": "clear-package-server",
            "hostname": "clear-test.local",
            "timestamp": "2026-01-20T10:00:00Z",
            "metrics": {"cpu_percent": 50.0, "memory_percent": 60.0, "disk_percent": 70.0},
            "packages": [
                {
                    "name": "openssl",
                    "current_version": "1.0",
                    "new_version": "1.1",
                    "repository": "bookworm-security",
                    "is_security": True,
                },
                {
                    "name": "vim",
                    "current_version": "1.0",
                    "new_version": "1.1",
                    "repository": "bookworm",
                    "is_security": False,
                },
            ],
        }
        client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)

        # Second heartbeat with empty packages (all updates applied)
        heartbeat_data["timestamp"] = "2026-01-20T10:01:00Z"
        heartbeat_data["packages"] = []
        client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)

        # Verify all packages removed
        response = client.get("/api/v1/servers/clear-package-server/packages", headers=auth_headers)
        data = response.json()
        assert data["packages"] == []
        assert data["total_count"] == 0


# =============================================================================
# Filter Tests (TC186-TC187) - Frontend unit tests would be in vitest
# These are API-level tests for filtering support
# =============================================================================


class TestPackageListFiltering:
    """Tests for package list filtering capabilities (AC4)."""

    def test_response_includes_security_count(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC186/TC187: Response includes security_count for frontend filtering."""
        heartbeat_data = {
            "server_id": "filter-test-server",
            "hostname": "filter-test.local",
            "timestamp": "2026-01-20T10:00:00Z",
            "metrics": {"cpu_percent": 50.0, "memory_percent": 60.0, "disk_percent": 70.0},
            "packages": [
                {
                    "name": "openssl",
                    "current_version": "1.0",
                    "new_version": "1.1",
                    "repository": "bookworm-security",
                    "is_security": True,
                },
                {
                    "name": "libssl3",
                    "current_version": "1.0",
                    "new_version": "1.1",
                    "repository": "bookworm-security",
                    "is_security": True,
                },
                {
                    "name": "vim",
                    "current_version": "1.0",
                    "new_version": "1.1",
                    "repository": "bookworm",
                    "is_security": False,
                },
                {
                    "name": "curl",
                    "current_version": "1.0",
                    "new_version": "1.1",
                    "repository": "bookworm",
                    "is_security": False,
                },
                {
                    "name": "git",
                    "current_version": "1.0",
                    "new_version": "1.1",
                    "repository": "bookworm",
                    "is_security": False,
                },
            ],
        }
        client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)

        response = client.get("/api/v1/servers/filter-test-server/packages", headers=auth_headers)
        data = response.json()

        assert data["total_count"] == 5
        assert data["security_count"] == 2


# =============================================================================
# Edge Case Tests
# =============================================================================


class TestPackageEdgeCases:
    """Tests for package edge cases."""

    def test_large_package_list(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """TC182 (partial): Large package lists stored correctly."""
        # Create 100+ packages
        packages = [
            {
                "name": f"package-{i}",
                "current_version": "1.0",
                "new_version": "1.1",
                "repository": "bookworm-security" if i % 5 == 0 else "bookworm",
                "is_security": i % 5 == 0,
            }
            for i in range(105)
        ]

        heartbeat_data = {
            "server_id": "large-package-server",
            "hostname": "large-test.local",
            "timestamp": "2026-01-20T10:00:00Z",
            "metrics": {"cpu_percent": 50.0, "memory_percent": 60.0, "disk_percent": 70.0},
            "packages": packages,
        }
        response = client.post(
            "/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers
        )
        assert response.status_code == 200

        # Verify all packages stored
        response = client.get("/api/v1/servers/large-package-server/packages", headers=auth_headers)
        data = response.json()
        assert data["total_count"] == 105
        assert data["security_count"] == 21  # Every 5th package (0, 5, 10, ... 100)

    def test_package_name_with_special_characters(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Package names with special characters stored correctly."""
        heartbeat_data = {
            "server_id": "special-char-server",
            "hostname": "special-test.local",
            "timestamp": "2026-01-20T10:00:00Z",
            "metrics": {"cpu_percent": 50.0, "memory_percent": 60.0, "disk_percent": 70.0},
            "packages": [
                {
                    "name": "libglib2.0-0",
                    "current_version": "1.0",
                    "new_version": "1.1",
                    "repository": "bookworm",
                    "is_security": False,
                },
                {
                    "name": "python3.12-minimal",
                    "current_version": "1.0",
                    "new_version": "1.1",
                    "repository": "bookworm",
                    "is_security": False,
                },
                {
                    "name": "cpp-12",
                    "current_version": "1.0",
                    "new_version": "1.1",
                    "repository": "bookworm",
                    "is_security": False,
                },
            ],
        }
        client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)

        response = client.get("/api/v1/servers/special-char-server/packages", headers=auth_headers)
        data = response.json()
        package_names = [p["name"] for p in data["packages"]]
        assert "libglib2.0-0" in package_names
        assert "python3.12-minimal" in package_names
        assert "cpp-12" in package_names

    def test_repository_with_colons_slashes(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Repository paths with special characters stored correctly."""
        heartbeat_data = {
            "server_id": "repo-char-server",
            "hostname": "repo-test.local",
            "timestamp": "2026-01-20T10:00:00Z",
            "metrics": {"cpu_percent": 50.0, "memory_percent": 60.0, "disk_percent": 70.0},
            "packages": [
                {
                    "name": "openssl",
                    "current_version": "1.0",
                    "new_version": "1.1",
                    "repository": "bookworm-security/main",
                    "is_security": True,
                },
            ],
        }
        client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)

        response = client.get("/api/v1/servers/repo-char-server/packages", headers=auth_headers)
        data = response.json()
        assert data["packages"][0]["repository"] == "bookworm-security/main"
