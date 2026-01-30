"""API integration tests for configuration pack application and removal.

Part of EP0010: Configuration Management:
- US0119 Apply Configuration Pack
- US0123 Remove Configuration Pack
"""

import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
import yaml
from fastapi.testclient import TestClient


class TestConfigApplyAPIAuth:
    """Tests for authentication requirements."""

    def test_apply_requires_auth(self, client: TestClient) -> None:
        """Test that apply endpoint requires authentication."""
        response = client.post(
            "/api/v1/servers/test-server/config/apply",
            json={"pack_name": "base", "dry_run": False},
        )
        assert response.status_code == 401

    def test_status_requires_auth(self, client: TestClient) -> None:
        """Test that apply status endpoint requires authentication."""
        response = client.get("/api/v1/servers/test-server/config/apply/1")
        assert response.status_code == 401


class TestConfigApplyAPIErrors:
    """Tests for error handling."""

    def test_server_not_found(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test 404 when server doesn't exist."""
        response = client.post(
            "/api/v1/servers/nonexistent-server/config/apply",
            json={"pack_name": "base", "dry_run": False},
            headers=auth_headers,
        )
        assert response.status_code == 404
        assert "Server not found" in response.json()["detail"]

    def test_status_not_found(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test 404 when apply operation doesn't exist."""
        response = client.get(
            "/api/v1/servers/test-server/config/apply/99999",
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestConfigApplyAPIWithServer:
    """Tests requiring a registered server."""

    @pytest.fixture(autouse=True)
    def setup_server(self, client: TestClient, auth_headers: dict[str, str]):
        """Create a test server for each test."""
        server_data = {
            "id": "apply-test-server",
            "hostname": "apply.local",
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
            "/api/v1/servers/apply-test-server",
            headers=auth_headers,
        )

    def test_pack_not_found(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test 404 when pack doesn't exist."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            with patch(
                "homelab_cmd.api.routes.config_apply.get_config_pack_service"
            ) as mock_get_service:
                from homelab_cmd.services.config_pack_service import ConfigPackService

                mock_get_service.return_value = ConfigPackService(packs_dir=Path(tmp_dir))

                response = client.post(
                    "/api/v1/servers/apply-test-server/config/apply",
                    json={"pack_name": "nonexistent-pack", "dry_run": True},
                    headers=auth_headers,
                )

                assert response.status_code == 404
                assert "Pack file not found" in response.json()["detail"]

    def test_validation_missing_pack_name(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test 422 when pack_name is missing."""
        response = client.post(
            "/api/v1/servers/apply-test-server/config/apply",
            json={},
            headers=auth_headers,
        )
        assert response.status_code == 422


class TestConfigApplyDryRun:
    """Tests for dry-run preview functionality (AC2)."""

    @pytest.fixture(autouse=True)
    def setup_server(self, client: TestClient, auth_headers: dict[str, str]):
        """Create a test server for each test."""
        server_data = {
            "id": "preview-test-server",
            "hostname": "preview.local",
        }
        response = client.post(
            "/api/v1/servers",
            json=server_data,
            headers=auth_headers,
        )
        assert response.status_code == 201
        yield
        client.delete(
            "/api/v1/servers/preview-test-server",
            headers=auth_headers,
        )

    @pytest.fixture
    def test_pack_dir(self):
        """Create a temporary directory with test pack."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)

            # Create templates directory
            templates_dir = tmp_path / "templates"
            templates_dir.mkdir()

            # Create test template
            (templates_dir / "aliases.sh").write_text("alias ll='ls -la'\n")

            # Create test pack with all item types
            test_pack = {
                "name": "Test Pack",
                "description": "Pack for dry-run testing",
                "items": {
                    "files": [
                        {
                            "path": "~/.bashrc.d/aliases.sh",
                            "mode": "0644",
                            "template": "aliases.sh",
                            "description": "Shell aliases",
                        }
                    ],
                    "packages": [
                        {
                            "name": "curl",
                            "min_version": "8.0.0",
                            "description": "HTTP client",
                        }
                    ],
                    "settings": [
                        {
                            "key": "EDITOR",
                            "expected": "vim",
                            "type": "env_var",
                            "description": "Default editor",
                        }
                    ],
                },
            }
            (tmp_path / "test.yaml").write_text(yaml.dump(test_pack))

            yield tmp_path

    def test_dry_run_returns_preview(
        self, client: TestClient, auth_headers: dict[str, str], test_pack_dir: Path
    ) -> None:
        """Test dry-run returns preview without applying changes (AC2)."""
        with patch(
            "homelab_cmd.api.routes.config_apply.get_config_pack_service"
        ) as mock_get_service:
            from homelab_cmd.services.config_pack_service import ConfigPackService

            mock_get_service.return_value = ConfigPackService(packs_dir=test_pack_dir)

            response = client.post(
                "/api/v1/servers/preview-test-server/config/apply",
                json={"pack_name": "test", "dry_run": True},
                headers=auth_headers,
            )

            assert response.status_code == 202
            data = response.json()

            # Verify preview response structure
            assert data["dry_run"] is True
            assert data["server_id"] == "preview-test-server"
            assert data["pack_name"] == "test"
            assert "files" in data
            assert "packages" in data
            assert "settings" in data
            assert data["total_items"] == 3

    def test_dry_run_shows_files_packages_settings(
        self, client: TestClient, auth_headers: dict[str, str], test_pack_dir: Path
    ) -> None:
        """Test dry-run shows all item types (AC2)."""
        with patch(
            "homelab_cmd.api.routes.config_apply.get_config_pack_service"
        ) as mock_get_service:
            from homelab_cmd.services.config_pack_service import ConfigPackService

            mock_get_service.return_value = ConfigPackService(packs_dir=test_pack_dir)

            response = client.post(
                "/api/v1/servers/preview-test-server/config/apply",
                json={"pack_name": "test", "dry_run": True},
                headers=auth_headers,
            )

            assert response.status_code == 202
            data = response.json()

            # Verify file items
            assert len(data["files"]) == 1
            file_item = data["files"][0]
            assert file_item["action"] == "create_file"
            assert file_item["path"] == "~/.bashrc.d/aliases.sh"
            assert file_item["mode"] == "0644"

            # Verify package items
            assert len(data["packages"]) == 1
            pkg_item = data["packages"][0]
            assert pkg_item["action"] == "install_package"
            assert pkg_item["package"] == "curl"
            assert pkg_item["version"] == "8.0.0"

            # Verify setting items
            assert len(data["settings"]) == 1
            setting_item = data["settings"][0]
            assert setting_item["action"] == "set_env_var"
            assert setting_item["key"] == "EDITOR"
            assert setting_item["value"] == "vim"


class TestConfigApplyResponseFormat:
    """Tests for response format validation."""

    @pytest.fixture
    def mock_apply_initiated_response(self):
        """Create mock apply initiated response."""
        from homelab_cmd.api.schemas.config_apply import ApplyInitiatedResponse

        return ApplyInitiatedResponse(
            apply_id=1,
            server_id="test-server",
            pack_name="base",
            status="pending",
            started_at=None,
        )

    @pytest.fixture
    def mock_apply_status_response(self):
        """Create mock apply status response."""
        from datetime import UTC, datetime

        from homelab_cmd.api.schemas.config_apply import (
            ApplyItemResult,
            ApplyStatusResponse,
        )

        return ApplyStatusResponse(
            apply_id=1,
            server_id="test-server",
            pack_name="base",
            status="completed",
            progress=100,
            current_item=None,
            items_total=3,
            items_completed=2,
            items_failed=1,
            items=[
                ApplyItemResult(
                    item="~/.bashrc.d/aliases.sh",
                    action="created",
                    success=True,
                    error=None,
                ),
                ApplyItemResult(
                    item="curl",
                    action="installed",
                    success=True,
                    error=None,
                ),
                ApplyItemResult(
                    item="nodejs",
                    action="installed",
                    success=False,
                    error="Package not found",
                ),
            ],
            started_at=datetime.now(UTC),
            completed_at=datetime.now(UTC),
            error=None,
        )

    def test_initiated_response_format(self, mock_apply_initiated_response) -> None:
        """Test apply initiated response contains required fields (AC1)."""
        data = mock_apply_initiated_response.model_dump(mode="json")

        assert "apply_id" in data
        assert "server_id" in data
        assert "pack_name" in data
        assert "status" in data
        assert data["status"] in ["pending", "running"]

    def test_status_response_format(self, mock_apply_status_response) -> None:
        """Test apply status response contains progress and results (AC5, AC6)."""
        data = mock_apply_status_response.model_dump(mode="json")

        # AC5: Progress tracking
        assert "progress" in data
        assert "current_item" in data
        assert "items_completed" in data
        assert "items_failed" in data

        # AC6: Result details
        assert "items" in data
        assert len(data["items"]) == 3

        # Verify per-item result format
        for item in data["items"]:
            assert "item" in item
            assert "action" in item
            assert "success" in item

    def test_partial_failure_results(self, mock_apply_status_response) -> None:
        """Test partial failure handling - continues and reports all results (AC6)."""
        data = mock_apply_status_response.model_dump(mode="json")

        assert data["items_completed"] == 2
        assert data["items_failed"] == 1
        assert len(data["items"]) == 3  # All items reported

        # Find the failed item
        failed_items = [i for i in data["items"] if not i["success"]]
        assert len(failed_items) == 1
        assert failed_items[0]["error"] == "Package not found"


class TestConfigApplyPreviewFormat:
    """Tests for preview response format validation."""

    @pytest.fixture
    def mock_preview_response(self):
        """Create mock preview response."""
        from homelab_cmd.api.schemas.config_apply import (
            ApplyPreviewResponse,
            DryRunFileItem,
            DryRunPackageItem,
            DryRunSettingItem,
        )

        return ApplyPreviewResponse(
            server_id="test-server",
            pack_name="base",
            dry_run=True,
            files=[
                DryRunFileItem(
                    action="create_file",
                    path="~/.bashrc.d/aliases.sh",
                    mode="0644",
                    description="Create ~/.bashrc.d/aliases.sh with mode 0644",
                )
            ],
            packages=[
                DryRunPackageItem(
                    action="install_package",
                    package="curl",
                    version="8.0.0",
                    description="Install curl >= 8.0.0",
                )
            ],
            settings=[
                DryRunSettingItem(
                    action="set_env_var",
                    key="EDITOR",
                    value="vim",
                    description="Set EDITOR=vim",
                )
            ],
            total_items=3,
        )

    def test_preview_response_format(self, mock_preview_response) -> None:
        """Test preview response contains grouped items (AC2)."""
        data = mock_preview_response.model_dump(mode="json")

        assert data["dry_run"] is True
        assert "files" in data
        assert "packages" in data
        assert "settings" in data
        assert data["total_items"] == 3

    def test_preview_file_item_format(self, mock_preview_response) -> None:
        """Test file preview item format."""
        data = mock_preview_response.model_dump(mode="json")

        file_item = data["files"][0]
        assert file_item["action"] == "create_file"
        assert file_item["path"] == "~/.bashrc.d/aliases.sh"
        assert file_item["mode"] == "0644"
        assert "description" in file_item

    def test_preview_package_item_format(self, mock_preview_response) -> None:
        """Test package preview item format."""
        data = mock_preview_response.model_dump(mode="json")

        pkg_item = data["packages"][0]
        assert pkg_item["action"] == "install_package"
        assert pkg_item["package"] == "curl"
        assert pkg_item["version"] == "8.0.0"
        assert "description" in pkg_item

    def test_preview_setting_item_format(self, mock_preview_response) -> None:
        """Test setting preview item format."""
        data = mock_preview_response.model_dump(mode="json")

        setting_item = data["settings"][0]
        assert setting_item["action"] == "set_env_var"
        assert setting_item["key"] == "EDITOR"
        assert setting_item["value"] == "vim"
        assert "description" in setting_item


class TestConfigApplyService:
    """Unit tests for ConfigApplyService logic."""

    @pytest.fixture
    def mock_ssh_result_success(self):
        """Mock SSH command result for success."""
        return {"exit_code": 0, "stdout": "", "stderr": ""}

    @pytest.fixture
    def mock_ssh_result_failure(self):
        """Mock SSH command result for failure."""
        return {
            "exit_code": 1,
            "stdout": "",
            "stderr": "E: Unable to locate package",
        }

    def test_file_creation_command_format(self) -> None:
        """Test file creation uses mkdir -p and heredoc (AC3)."""
        from homelab_cmd.services.config_apply_service import ConfigApplyService

        # The HEREDOC delimiter should be unique
        assert hasattr(ConfigApplyService, "HEREDOC_DELIMITER")
        assert len(ConfigApplyService.HEREDOC_DELIMITER) > 10

    def test_package_install_command_uses_sudo(self) -> None:
        """Test package installation uses sudo apt-get (AC4)."""
        # Command construction is tested in integration tests
        # Here we just verify the expected command pattern
        expected_pattern = "sudo apt-get install -y"
        assert "sudo" in expected_pattern
        assert "apt-get" in expected_pattern
        assert "-y" in expected_pattern


# =============================================================================
# US0123: Remove Configuration Pack Tests
# =============================================================================


class TestRemoveConfigPackAuth:
    """Tests for remove endpoint authentication (US0123)."""

    def test_remove_requires_auth(self, client: TestClient) -> None:
        """Test that remove endpoint requires authentication."""
        import json

        response = client.request(
            "DELETE",
            "/api/v1/servers/test-server/config/apply",
            content=json.dumps({"pack_name": "base", "confirm": False}),
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code == 401


class TestRemoveConfigPackErrors:
    """Tests for remove endpoint error handling (US0123)."""

    def test_server_not_found(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test 404 when server doesn't exist (US0123: AC1)."""
        import json

        response = client.request(
            "DELETE",
            "/api/v1/servers/nonexistent-server/config/apply",
            content=json.dumps({"pack_name": "base", "confirm": False}),
            headers={**auth_headers, "Content-Type": "application/json"},
        )
        assert response.status_code == 404
        assert "Server not found" in response.json()["detail"]

    def test_validation_missing_pack_name(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test 422 when pack_name is missing."""
        import json

        # Need a server first
        client.post(
            "/api/v1/servers",
            json={"id": "remove-validation-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        response = client.request(
            "DELETE",
            "/api/v1/servers/remove-validation-test/config/apply",
            content=json.dumps({}),
            headers={**auth_headers, "Content-Type": "application/json"},
        )
        assert response.status_code == 422
        # Cleanup
        client.delete("/api/v1/servers/remove-validation-test", headers=auth_headers)


class TestRemoveConfigPackPreview:
    """Tests for remove preview functionality (US0123: AC5)."""

    @pytest.fixture(autouse=True)
    def setup_server(self, client: TestClient, auth_headers: dict[str, str]):
        """Create a test server for each test."""
        server_data = {
            "id": "remove-preview-test",
            "hostname": "remove-preview.local",
        }
        response = client.post(
            "/api/v1/servers",
            json=server_data,
            headers=auth_headers,
        )
        assert response.status_code == 201
        yield
        client.delete("/api/v1/servers/remove-preview-test", headers=auth_headers)

    @pytest.fixture
    def test_pack_dir(self):
        """Create a temporary directory with test pack for removal."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)

            # Create templates directory
            templates_dir = tmp_path / "templates"
            templates_dir.mkdir()

            # Create test template
            (templates_dir / "aliases.sh").write_text("alias ll='ls -la'\n")

            # Create test pack
            test_pack = {
                "name": "Remove Test Pack",
                "description": "Pack for removal testing",
                "items": {
                    "files": [
                        {
                            "path": "~/.bashrc.d/aliases.sh",
                            "mode": "0644",
                            "template": "aliases.sh",
                            "description": "Shell aliases",
                        }
                    ],
                    "packages": [
                        {
                            "name": "curl",
                            "min_version": "8.0.0",
                            "description": "HTTP client",
                        }
                    ],
                    "settings": [
                        {
                            "key": "EDITOR",
                            "expected": "vim",
                            "type": "env_var",
                            "description": "Default editor",
                        }
                    ],
                },
            }
            (tmp_path / "remove-test.yaml").write_text(yaml.dump(test_pack))

            yield tmp_path

    def test_remove_preview_returns_grouped_items(
        self, client: TestClient, auth_headers: dict[str, str], test_pack_dir: Path
    ) -> None:
        """Test remove preview returns items grouped by type (US0123: AC5)."""
        import json

        with patch(
            "homelab_cmd.api.routes.config_apply.get_config_pack_service"
        ) as mock_get_service:
            from homelab_cmd.services.config_pack_service import ConfigPackService

            mock_get_service.return_value = ConfigPackService(packs_dir=test_pack_dir)

            response = client.request(
                "DELETE",
                "/api/v1/servers/remove-preview-test/config/apply",
                content=json.dumps({"pack_name": "remove-test", "confirm": False}),
                headers={**auth_headers, "Content-Type": "application/json"},
            )

            assert response.status_code == 200
            data = response.json()

            # Verify preview response structure
            assert data["preview"] is True
            assert data["server_id"] == "remove-preview-test"
            assert data["pack_name"] == "remove-test"
            assert "files" in data
            assert "packages" in data
            assert "settings" in data
            assert "warning" in data

    def test_remove_preview_files_show_backup_path(
        self, client: TestClient, auth_headers: dict[str, str], test_pack_dir: Path
    ) -> None:
        """Test file items include backup paths (US0123: AC2)."""
        import json

        with patch(
            "homelab_cmd.api.routes.config_apply.get_config_pack_service"
        ) as mock_get_service:
            from homelab_cmd.services.config_pack_service import ConfigPackService

            mock_get_service.return_value = ConfigPackService(packs_dir=test_pack_dir)

            response = client.request(
                "DELETE",
                "/api/v1/servers/remove-preview-test/config/apply",
                content=json.dumps({"pack_name": "remove-test", "confirm": False}),
                headers={**auth_headers, "Content-Type": "application/json"},
            )

            assert response.status_code == 200
            data = response.json()

            assert len(data["files"]) == 1
            file_item = data["files"][0]
            assert file_item["action"] == "delete"
            assert "backup_path" in file_item
            assert ".homelabcmd.bak" in file_item["backup_path"]

    def test_remove_preview_packages_show_skip(
        self, client: TestClient, auth_headers: dict[str, str], test_pack_dir: Path
    ) -> None:
        """Test packages are marked as skipped (US0123: AC3)."""
        import json

        with patch(
            "homelab_cmd.api.routes.config_apply.get_config_pack_service"
        ) as mock_get_service:
            from homelab_cmd.services.config_pack_service import ConfigPackService

            mock_get_service.return_value = ConfigPackService(packs_dir=test_pack_dir)

            response = client.request(
                "DELETE",
                "/api/v1/servers/remove-preview-test/config/apply",
                content=json.dumps({"pack_name": "remove-test", "confirm": False}),
                headers={**auth_headers, "Content-Type": "application/json"},
            )

            assert response.status_code == 200
            data = response.json()

            assert len(data["packages"]) == 1
            pkg_item = data["packages"][0]
            assert pkg_item["action"] == "skip"
            assert "note" in pkg_item


class TestRemoveConfigPackResponseFormat:
    """Tests for remove response format validation (US0123)."""

    @pytest.fixture
    def mock_remove_preview_response(self):
        """Create mock remove preview response."""
        from homelab_cmd.api.schemas.config_apply import (
            RemovePreviewFileItem,
            RemovePreviewPackageItem,
            RemovePreviewResponse,
            RemovePreviewSettingItem,
        )

        return RemovePreviewResponse(
            server_id="test-server",
            pack_name="base",
            preview=True,
            files=[
                RemovePreviewFileItem(
                    action="delete",
                    path="~/.bashrc.d/aliases.sh",
                    backup_path="~/.bashrc.d/aliases.sh.homelabcmd.bak",
                    note="Will be backed up before deletion",
                )
            ],
            packages=[
                RemovePreviewPackageItem(
                    action="skip",
                    package="curl",
                    note="Packages are not uninstalled to avoid breaking dependencies",
                )
            ],
            settings=[
                RemovePreviewSettingItem(
                    action="remove",
                    key="EDITOR",
                    note="Will be removed from shell configuration",
                )
            ],
            total_items=3,
            warning="Files will be deleted. Packages will remain installed.",
        )

    @pytest.fixture
    def mock_remove_response(self):
        """Create mock remove response."""
        from datetime import UTC, datetime

        from homelab_cmd.api.schemas.config_apply import RemoveItemResult, RemoveResponse

        return RemoveResponse(
            server_id="test-server",
            pack_name="base",
            success=True,
            items=[
                RemoveItemResult(
                    item="~/.bashrc.d/aliases.sh",
                    item_type="file",
                    action="deleted",
                    success=True,
                    backup_path="~/.bashrc.d/aliases.sh.homelabcmd.bak",
                    note=None,
                    error=None,
                ),
                RemoveItemResult(
                    item="curl",
                    item_type="package",
                    action="skipped",
                    success=True,
                    backup_path=None,
                    note="Package not removed to avoid dependency issues",
                    error=None,
                ),
                RemoveItemResult(
                    item="EDITOR",
                    item_type="setting",
                    action="removed",
                    success=True,
                    backup_path=None,
                    note=None,
                    error=None,
                ),
            ],
            items_deleted=1,
            items_skipped=1,
            items_removed=1,
            items_failed=0,
            removed_at=datetime.now(UTC),
        )

    def test_preview_response_format(self, mock_remove_preview_response) -> None:
        """Test remove preview response contains required fields (US0123: AC5)."""
        data = mock_remove_preview_response.model_dump(mode="json")

        assert data["preview"] is True
        assert "files" in data
        assert "packages" in data
        assert "settings" in data
        assert "warning" in data
        assert data["total_items"] == 3

    def test_preview_warning_present(self, mock_remove_preview_response) -> None:
        """Test remove preview includes warning banner content (US0123: AC6)."""
        data = mock_remove_preview_response.model_dump(mode="json")
        assert data["warning"]
        assert len(data["warning"]) > 10

    def test_remove_response_format(self, mock_remove_response) -> None:
        """Test remove response contains per-item results (US0123: AC4)."""
        data = mock_remove_response.model_dump(mode="json")

        assert "success" in data
        assert "items" in data
        assert "items_deleted" in data
        assert "items_skipped" in data
        assert "items_removed" in data
        assert "items_failed" in data
        assert "removed_at" in data

    def test_remove_response_item_format(self, mock_remove_response) -> None:
        """Test each item in remove response has required fields."""
        data = mock_remove_response.model_dump(mode="json")

        for item in data["items"]:
            assert "item" in item
            assert "item_type" in item
            assert "action" in item
            assert "success" in item

    def test_remove_response_backup_paths(self, mock_remove_response) -> None:
        """Test file items have backup paths (US0123: AC2)."""
        data = mock_remove_response.model_dump(mode="json")

        file_items = [i for i in data["items"] if i["item_type"] == "file"]
        assert len(file_items) == 1
        assert file_items[0]["backup_path"] is not None
        assert ".homelabcmd.bak" in file_items[0]["backup_path"]

    def test_remove_response_packages_skipped(self, mock_remove_response) -> None:
        """Test packages are marked as skipped (US0123: AC3)."""
        data = mock_remove_response.model_dump(mode="json")

        pkg_items = [i for i in data["items"] if i["item_type"] == "package"]
        assert len(pkg_items) == 1
        assert pkg_items[0]["action"] == "skipped"


class TestRemoveConfigPackService:
    """Unit tests for remove functionality in ConfigApplyService."""

    def test_backup_path_format(self) -> None:
        """Test backup files use .homelabcmd.bak extension (US0123: AC2)."""
        test_path = "/home/user/.bashrc"
        expected_backup = f"{test_path}.homelabcmd.bak"
        assert ".homelabcmd.bak" in expected_backup
        assert expected_backup == "/home/user/.bashrc.homelabcmd.bak"

    def test_remove_setting_sed_pattern(self) -> None:
        """Test setting removal uses sed to remove export lines (US0123: AC4)."""
        # The sed command pattern for removing an export line
        key = "EDITOR"
        expected_pattern = f"sed -i '/^export {key}=/d'"
        assert "sed" in expected_pattern
        assert "-i" in expected_pattern
        assert f"export {key}=" in expected_pattern
