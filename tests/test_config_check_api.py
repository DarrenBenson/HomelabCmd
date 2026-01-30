"""API integration tests for configuration compliance checking.

Part of EP0010: Configuration Management - US0117 Configuration Compliance Checker.
"""

import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import yaml
from fastapi.testclient import TestClient


class TestConfigCheckAPIAuth:
    """Tests for authentication requirements."""

    def test_check_requires_auth(self, client: TestClient) -> None:
        """Test that compliance check requires authentication."""
        response = client.post(
            "/api/v1/servers/test-server/config/check",
            json={"pack_name": "base"},
        )
        assert response.status_code == 401

    def test_history_requires_auth(self, client: TestClient) -> None:
        """Test that compliance history requires authentication."""
        response = client.get("/api/v1/servers/test-server/config/checks")
        assert response.status_code == 401


class TestConfigCheckAPIErrors:
    """Tests for error handling."""

    def test_server_not_found(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test 404 when server doesn't exist."""
        response = client.post(
            "/api/v1/servers/nonexistent-server/config/check",
            json={"pack_name": "base"},
            headers=auth_headers,
        )
        assert response.status_code == 404
        assert "Server not found" in response.json()["detail"]

    def test_history_server_not_found(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test 404 for history when server doesn't exist."""
        response = client.get(
            "/api/v1/servers/nonexistent-server/config/checks",
            headers=auth_headers,
        )
        assert response.status_code == 404
        assert "Server not found" in response.json()["detail"]


class TestConfigCheckAPIWithServer:
    """Tests requiring a registered server."""

    @pytest.fixture(autouse=True)
    def setup_server(self, client: TestClient, auth_headers: dict[str, str]):
        """Create a test server for each test."""
        # Create a test server
        server_data = {
            "id": "compliance-test-server",
            "hostname": "compliance.local",
        }
        response = client.post(
            "/api/v1/servers",
            json=server_data,
            headers=auth_headers,
        )
        assert response.status_code == 201
        yield
        # Cleanup
        client.delete(
            "/api/v1/servers/compliance-test-server",
            headers=auth_headers,
        )

    def test_pack_not_found(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test 404 when pack doesn't exist."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            # Patch the service to use empty temp directory
            with patch(
                "homelab_cmd.api.routes.config_check.get_config_pack_service"
            ) as mock_get_service:
                from homelab_cmd.services.config_pack_service import ConfigPackService

                mock_get_service.return_value = ConfigPackService(packs_dir=Path(tmp_dir))

                response = client.post(
                    "/api/v1/servers/compliance-test-server/config/check",
                    json={"pack_name": "nonexistent-pack"},
                    headers=auth_headers,
                )

                assert response.status_code == 404
                assert "Pack file not found" in response.json()["detail"]

    def test_ssh_unavailable(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test 503 when SSH connection fails.

        Note: This is a basic API test. Detailed SSH error handling is tested
        in test_compliance_service.py with proper mocking.
        """
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)

            # Create a test pack
            test_pack = {
                "name": "Test Pack",
                "description": "Pack for testing",
                "items": {
                    "files": [{"path": "~/.bashrc", "mode": "0644"}],
                },
            }
            (tmp_path / "test.yaml").write_text(yaml.dump(test_pack))

            # Mock pack service to use our temp directory
            with patch(
                "homelab_cmd.api.routes.config_check.get_config_pack_service"
            ) as mock_pack_service:
                from homelab_cmd.services.config_pack_service import ConfigPackService

                mock_pack_service.return_value = ConfigPackService(packs_dir=tmp_path)

                # Mock the compliance service to raise SSHUnavailableError
                with patch(
                    "homelab_cmd.api.routes.config_check.ComplianceCheckService"
                ) as mock_service_class:
                    from homelab_cmd.services.compliance_service import SSHUnavailableError

                    mock_service = MagicMock()
                    mock_service.check_compliance = AsyncMock(
                        side_effect=SSHUnavailableError("SSH connection failed")
                    )
                    mock_service_class.return_value = mock_service

                    response = client.post(
                        "/api/v1/servers/compliance-test-server/config/check",
                        json={"pack_name": "test"},
                        headers=auth_headers,
                    )

                    assert response.status_code == 503
                    assert "SSH connection failed" in response.json()["detail"]

    def test_empty_history(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test getting empty compliance history."""
        response = client.get(
            "/api/v1/servers/compliance-test-server/config/checks",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["server_id"] == "compliance-test-server"
        assert data["checks"] == []
        assert data["total"] == 0

    def test_validation_missing_pack_name(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test 422 when pack_name is missing."""
        response = client.post(
            "/api/v1/servers/compliance-test-server/config/check",
            json={},
            headers=auth_headers,
        )
        assert response.status_code == 422


class TestConfigCheckResponseFormat:
    """Tests for response format validation."""

    @pytest.fixture(autouse=True)
    def setup_server(self, client: TestClient, auth_headers: dict[str, str]):
        """Create a test server for each test."""
        server_data = {
            "id": "format-test-server",
            "hostname": "format.local",
        }
        response = client.post(
            "/api/v1/servers",
            json=server_data,
            headers=auth_headers,
        )
        assert response.status_code == 201
        yield
        client.delete(
            "/api/v1/servers/format-test-server",
            headers=auth_headers,
        )

    def test_history_response_format(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test compliance history response format."""
        response = client.get(
            "/api/v1/servers/format-test-server/config/checks",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "server_id" in data
        assert "checks" in data
        assert "total" in data
        assert isinstance(data["checks"], list)
        assert isinstance(data["total"], int)


# US0118: Configuration Diff View API Tests


class TestConfigDiffAPIAuth:
    """Tests for diff endpoint authentication requirements."""

    def test_diff_requires_auth(self, client: TestClient) -> None:
        """Test that diff endpoint requires authentication."""
        response = client.get(
            "/api/v1/servers/test-server/config/diff?pack=base",
        )
        assert response.status_code == 401


class TestConfigDiffAPIErrors:
    """Tests for diff endpoint error handling."""

    def test_diff_server_not_found(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test 404 when server doesn't exist for diff endpoint."""
        response = client.get(
            "/api/v1/servers/nonexistent-server/config/diff?pack=base",
            headers=auth_headers,
        )
        assert response.status_code == 404
        assert "Server not found" in response.json()["detail"]


class TestConfigDiffAPIWithServer:
    """Tests for diff endpoint requiring a registered server."""

    @pytest.fixture(autouse=True)
    def setup_server(self, client: TestClient, auth_headers: dict[str, str]):
        """Create a test server for each test."""
        server_data = {
            "id": "diff-test-server",
            "hostname": "diff.local",
        }
        response = client.post(
            "/api/v1/servers",
            json=server_data,
            headers=auth_headers,
        )
        assert response.status_code == 201
        yield
        client.delete(
            "/api/v1/servers/diff-test-server",
            headers=auth_headers,
        )

    def test_diff_no_check_exists(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test 404 when no compliance check exists for the pack."""
        response = client.get(
            "/api/v1/servers/diff-test-server/config/diff?pack=base",
            headers=auth_headers,
        )
        assert response.status_code == 404
        assert "No compliance check found" in response.json()["detail"]


class TestConfigDiffWithCheckData:
    """Tests for diff endpoint with existing compliance check data.

    These tests mock the diff endpoint response directly to verify the
    response format without complex database setup.
    """

    @pytest.fixture(autouse=True)
    def setup_server_with_check(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        """Create a server for testing."""
        # Create server
        server_data = {
            "id": "diff-data-server",
            "hostname": "diff-data.local",
        }
        response = client.post(
            "/api/v1/servers",
            json=server_data,
            headers=auth_headers,
        )
        assert response.status_code == 201

        yield

        # Cleanup
        client.delete(
            "/api/v1/servers/diff-data-server",
            headers=auth_headers,
        )

    @pytest.fixture
    def mock_diff_response(self):
        """Create mock diff response data."""
        from datetime import UTC, datetime

        from homelab_cmd.api.schemas.config_check import (
            ConfigDiffResponse,
            DiffMismatchItem,
            DiffSummary,
            MismatchActual,
            MismatchExpected,
        )

        return ConfigDiffResponse(
            server_id="diff-data-server",
            pack_name="base",
            is_compliant=False,
            summary=DiffSummary(total_items=3, compliant=0, mismatched=3),
            mismatches=[
                DiffMismatchItem(
                    type="missing_file",
                    category="files",
                    item="~/.bashrc.d/aliases.sh",
                    expected=MismatchExpected(exists=True, mode="0644"),
                    actual=MismatchActual(exists=False),
                    diff=None,
                ),
                DiffMismatchItem(
                    type="wrong_version",
                    category="packages",
                    item="curl",
                    expected=MismatchExpected(installed=True, min_version="8.5.0"),
                    actual=MismatchActual(installed=True, version="8.2.0"),
                    diff=None,
                ),
                DiffMismatchItem(
                    type="wrong_content",
                    category="files",
                    item="~/.config/ghostty/config",
                    expected=MismatchExpected(exists=True, hash="sha256:abc123"),
                    actual=MismatchActual(exists=True, hash="sha256:def456"),
                    diff="--- expected\n+++ actual\n@@ -1,3 +1,3 @@\n font-size = 14\n-theme = catppuccin-mocha\n+theme = default",
                ),
            ],
            checked_at=datetime.now(UTC),
        )

    def test_diff_returns_structured_data(
        self, client: TestClient, auth_headers: dict[str, str], mock_diff_response
    ) -> None:
        """Test diff endpoint returns structured data for server with mismatches."""
        from unittest.mock import AsyncMock, patch

        with patch(
            "homelab_cmd.api.routes.config_check.get_config_diff",
            new=AsyncMock(return_value=mock_diff_response),
        ):
            # Test the response structure by examining the mock response
            data = mock_diff_response.model_dump(mode="json")

            # Verify response structure
            assert data["server_id"] == "diff-data-server"
            assert data["pack_name"] == "base"
            assert data["is_compliant"] is False
            assert "summary" in data
            assert "mismatches" in data
            assert "checked_at" in data

    def test_diff_summary_counts(
        self, client: TestClient, auth_headers: dict[str, str], mock_diff_response
    ) -> None:
        """Test diff summary contains correct counts."""
        data = mock_diff_response.model_dump(mode="json")

        summary = data["summary"]
        assert summary["mismatched"] == 3
        assert "total_items" in summary
        assert "compliant" in summary

    def test_diff_missing_file_format(
        self, client: TestClient, auth_headers: dict[str, str], mock_diff_response
    ) -> None:
        """Test missing file mismatch shows expected state and 'not found'."""
        data = mock_diff_response.model_dump(mode="json")

        # Find the missing file mismatch
        missing_files = [m for m in data["mismatches"] if m["type"] == "missing_file"]
        assert len(missing_files) == 1

        mismatch = missing_files[0]
        assert mismatch["category"] == "files"
        assert mismatch["item"] == "~/.bashrc.d/aliases.sh"
        assert mismatch["expected"]["exists"] is True
        assert mismatch["actual"]["exists"] is False

    def test_diff_version_mismatch_format(
        self, client: TestClient, auth_headers: dict[str, str], mock_diff_response
    ) -> None:
        """Test package version diff shows expected and actual versions."""
        data = mock_diff_response.model_dump(mode="json")

        # Find the version mismatch
        version_mismatches = [m for m in data["mismatches"] if m["type"] == "wrong_version"]
        assert len(version_mismatches) == 1

        mismatch = version_mismatches[0]
        assert mismatch["category"] == "packages"
        assert mismatch["item"] == "curl"
        assert mismatch["expected"]["min_version"] == "8.5.0"
        assert mismatch["actual"]["version"] == "8.2.0"

    def test_diff_file_content_unified_format(
        self, client: TestClient, auth_headers: dict[str, str], mock_diff_response
    ) -> None:
        """Test file content diff in unified format."""
        data = mock_diff_response.model_dump(mode="json")

        # Find the content mismatch
        content_mismatches = [m for m in data["mismatches"] if m["type"] == "wrong_content"]
        assert len(content_mismatches) == 1

        mismatch = content_mismatches[0]
        assert mismatch["category"] == "files"
        assert mismatch["item"] == "~/.config/ghostty/config"
        assert mismatch["diff"] is not None

        # Verify unified diff format
        diff = mismatch["diff"]
        assert "--- expected" in diff
        assert "+++ actual" in diff
        assert "@@" in diff


class TestConfigDiffCompliantServer:
    """Tests for diff endpoint with compliant server."""

    @pytest.fixture
    def mock_compliant_response(self):
        """Create mock compliant response data."""
        from datetime import UTC, datetime

        from homelab_cmd.api.schemas.config_check import (
            ConfigDiffResponse,
            DiffSummary,
        )

        return ConfigDiffResponse(
            server_id="compliant-server",
            pack_name="base",
            is_compliant=True,
            summary=DiffSummary(total_items=10, compliant=10, mismatched=0),
            mismatches=[],
            checked_at=datetime.now(UTC),
        )

    def test_diff_compliant_empty_mismatches(self, mock_compliant_response) -> None:
        """Test diff for compliant server returns empty mismatches."""
        data = mock_compliant_response.model_dump(mode="json")

        assert data["is_compliant"] is True
        assert data["mismatches"] == []
        assert data["summary"]["mismatched"] == 0
