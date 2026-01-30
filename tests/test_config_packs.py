"""Tests for configuration pack API endpoints.

Part of EP0010: Configuration Management - US0116 Configuration Pack Definitions.
"""

import tempfile
from pathlib import Path

import pytest
import yaml
from fastapi.testclient import TestClient

from homelab_cmd.services.config_pack_service import ConfigPackError, ConfigPackService


class TestConfigPackService:
    """Unit tests for ConfigPackService."""

    def test_load_pack_file_not_found(self, tmp_path: Path) -> None:
        """Test loading a non-existent pack raises error."""
        service = ConfigPackService(packs_dir=tmp_path)
        with pytest.raises(ConfigPackError, match="Pack file not found"):
            service.load_pack("nonexistent")

    def test_load_pack_empty_file(self, tmp_path: Path) -> None:
        """Test loading an empty pack file raises error."""
        pack_file = tmp_path / "empty.yaml"
        pack_file.write_text("")

        service = ConfigPackService(packs_dir=tmp_path)
        with pytest.raises(ConfigPackError, match="Empty pack file"):
            service.load_pack("empty")

    def test_load_pack_invalid_yaml(self, tmp_path: Path) -> None:
        """Test loading invalid YAML raises error."""
        pack_file = tmp_path / "invalid.yaml"
        pack_file.write_text("name: test\n  bad: indent")

        service = ConfigPackService(packs_dir=tmp_path)
        with pytest.raises(ConfigPackError, match="Invalid YAML"):
            service.load_pack("invalid")

    def test_load_pack_invalid_schema(self, tmp_path: Path) -> None:
        """Test loading pack with invalid schema raises error."""
        pack_file = tmp_path / "badschema.yaml"
        pack_file.write_text("invalid: data\n")

        service = ConfigPackService(packs_dir=tmp_path)
        with pytest.raises(ConfigPackError, match="Invalid pack schema"):
            service.load_pack("badschema")

    def test_load_pack_minimal(self, tmp_path: Path) -> None:
        """Test loading a minimal valid pack."""
        pack_data = {
            "name": "Test Pack",
            "description": "A test pack",
        }
        pack_file = tmp_path / "minimal.yaml"
        pack_file.write_text(yaml.dump(pack_data))

        service = ConfigPackService(packs_dir=tmp_path)
        pack = service.load_pack("minimal")

        assert pack.name == "Test Pack"
        assert pack.description == "A test pack"
        assert pack.extends is None
        assert pack.items.files == []
        assert pack.items.packages == []
        assert pack.items.settings == []

    def test_load_pack_with_items(self, tmp_path: Path) -> None:
        """Test loading a pack with all item types."""
        templates_dir = tmp_path / "templates"
        templates_dir.mkdir()
        (templates_dir / "test.conf").write_text("config content")

        pack_data = {
            "name": "Full Pack",
            "description": "Pack with all item types",
            "items": {
                "files": [
                    {
                        "path": "~/.config/test.conf",
                        "mode": "0644",
                        "template": "test.conf",
                        "description": "Test config file",
                    }
                ],
                "packages": [
                    {"name": "vim", "min_version": "9.0.0", "description": "Text editor"}
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
        pack_file = tmp_path / "full.yaml"
        pack_file.write_text(yaml.dump(pack_data))

        service = ConfigPackService(packs_dir=tmp_path)
        pack = service.load_pack("full")

        assert len(pack.items.files) == 1
        assert pack.items.files[0].path == "~/.config/test.conf"
        assert pack.items.files[0].mode == "0644"
        assert pack.items.files[0].template == "test.conf"

        assert len(pack.items.packages) == 1
        assert pack.items.packages[0].name == "vim"
        assert pack.items.packages[0].min_version == "9.0.0"

        assert len(pack.items.settings) == 1
        assert pack.items.settings[0].key == "EDITOR"
        assert pack.items.settings[0].expected == "vim"
        assert pack.items.settings[0].type == "env_var"

    def test_load_pack_missing_template(self, tmp_path: Path) -> None:
        """Test loading pack with missing template raises error."""
        pack_data = {
            "name": "Missing Template",
            "description": "Pack with missing template",
            "items": {
                "files": [
                    {"path": "~/.config/test.conf", "mode": "0644", "template": "missing.conf"}
                ]
            },
        }
        pack_file = tmp_path / "missing.yaml"
        pack_file.write_text(yaml.dump(pack_data))

        service = ConfigPackService(packs_dir=tmp_path)
        with pytest.raises(ConfigPackError, match="Template file not found"):
            service.load_pack("missing")

    def test_load_pack_with_extends(self, tmp_path: Path) -> None:
        """Test loading a pack that extends another pack."""
        # Create base pack
        base_data = {
            "name": "Base Pack",
            "description": "Base configuration",
            "items": {
                "packages": [{"name": "curl", "description": "HTTP client"}],
                "settings": [{"key": "TERM", "expected": "xterm-256color", "type": "env_var"}],
            },
        }
        (tmp_path / "base.yaml").write_text(yaml.dump(base_data))

        # Create child pack
        child_data = {
            "name": "Child Pack",
            "description": "Extends base",
            "extends": "base",
            "items": {
                "packages": [{"name": "wget", "description": "Download utility"}],
            },
        }
        (tmp_path / "child.yaml").write_text(yaml.dump(child_data))

        service = ConfigPackService(packs_dir=tmp_path)
        pack = service.load_pack("child")

        # Should have items from both packs
        assert len(pack.items.packages) == 2
        assert pack.items.packages[0].name == "curl"  # From base
        assert pack.items.packages[1].name == "wget"  # From child

        assert len(pack.items.settings) == 1
        assert pack.items.settings[0].key == "TERM"  # From base

    def test_load_pack_extends_chain(self, tmp_path: Path) -> None:
        """Test loading a pack with multiple inheritance levels."""
        # Base pack
        base_data = {
            "name": "Base",
            "description": "Level 0",
            "items": {"packages": [{"name": "pkg0", "description": "Level 0"}]},
        }
        (tmp_path / "base.yaml").write_text(yaml.dump(base_data))

        # Level 1
        level1_data = {
            "name": "Level 1",
            "description": "Level 1",
            "extends": "base",
            "items": {"packages": [{"name": "pkg1", "description": "Level 1"}]},
        }
        (tmp_path / "level1.yaml").write_text(yaml.dump(level1_data))

        # Level 2
        level2_data = {
            "name": "Level 2",
            "description": "Level 2",
            "extends": "level1",
            "items": {"packages": [{"name": "pkg2", "description": "Level 2"}]},
        }
        (tmp_path / "level2.yaml").write_text(yaml.dump(level2_data))

        service = ConfigPackService(packs_dir=tmp_path)
        pack = service.load_pack("level2")

        # Should have packages from all three levels in order
        assert len(pack.items.packages) == 3
        assert pack.items.packages[0].name == "pkg0"
        assert pack.items.packages[1].name == "pkg1"
        assert pack.items.packages[2].name == "pkg2"

    def test_load_pack_circular_extends_detected(self, tmp_path: Path) -> None:
        """Test that circular extends references are detected."""
        # Pack A extends B
        pack_a = {
            "name": "Pack A",
            "description": "A",
            "extends": "pack-b",
        }
        (tmp_path / "pack-a.yaml").write_text(yaml.dump(pack_a))

        # Pack B extends A (circular)
        pack_b = {
            "name": "Pack B",
            "description": "B",
            "extends": "pack-a",
        }
        (tmp_path / "pack-b.yaml").write_text(yaml.dump(pack_b))

        service = ConfigPackService(packs_dir=tmp_path)
        with pytest.raises(ConfigPackError, match="Circular extends reference"):
            service.load_pack("pack-a")

    def test_load_pack_extends_missing_parent(self, tmp_path: Path) -> None:
        """Test that missing parent pack raises error."""
        child_data = {
            "name": "Orphan",
            "description": "Missing parent",
            "extends": "nonexistent",
        }
        (tmp_path / "orphan.yaml").write_text(yaml.dump(child_data))

        service = ConfigPackService(packs_dir=tmp_path)
        with pytest.raises(ConfigPackError, match="Cannot resolve extends"):
            service.load_pack("orphan")

    def test_load_pack_without_resolve_extends(self, tmp_path: Path) -> None:
        """Test loading pack without resolving inheritance."""
        base_data = {
            "name": "Base",
            "description": "Base",
            "items": {"packages": [{"name": "base-pkg", "description": "From base"}]},
        }
        (tmp_path / "base.yaml").write_text(yaml.dump(base_data))

        child_data = {
            "name": "Child",
            "description": "Child",
            "extends": "base",
            "items": {"packages": [{"name": "child-pkg", "description": "From child"}]},
        }
        (tmp_path / "child.yaml").write_text(yaml.dump(child_data))

        service = ConfigPackService(packs_dir=tmp_path)
        pack = service.load_pack("child", resolve_extends=False)

        # Should only have child's own packages
        assert len(pack.items.packages) == 1
        assert pack.items.packages[0].name == "child-pkg"

    def test_list_packs_empty_directory(self, tmp_path: Path) -> None:
        """Test listing packs from empty directory."""
        service = ConfigPackService(packs_dir=tmp_path)
        packs = service.list_packs()
        assert packs == []

    def test_list_packs_nonexistent_directory(self, tmp_path: Path) -> None:
        """Test listing packs from nonexistent directory."""
        service = ConfigPackService(packs_dir=tmp_path / "nonexistent")
        packs = service.list_packs()
        assert packs == []

    def test_list_packs_with_valid_packs(self, tmp_path: Path) -> None:
        """Test listing packs returns metadata for valid packs."""
        pack1 = {"name": "Pack One", "description": "First pack"}
        pack2 = {
            "name": "Pack Two",
            "description": "Second pack",
            "items": {"packages": [{"name": "vim", "description": "Editor"}]},
        }

        (tmp_path / "pack-one.yaml").write_text(yaml.dump(pack1))
        (tmp_path / "pack-two.yaml").write_text(yaml.dump(pack2))

        service = ConfigPackService(packs_dir=tmp_path)
        packs = service.list_packs()

        assert len(packs) == 2
        # Should be sorted by name
        assert packs[0].name == "pack-one"
        assert packs[0].display_name == "Pack One"
        assert packs[0].item_count == 0

        assert packs[1].name == "pack-two"
        assert packs[1].display_name == "Pack Two"
        assert packs[1].item_count == 1

    def test_list_packs_skips_invalid_packs(self, tmp_path: Path) -> None:
        """Test that invalid packs are skipped in listing."""
        valid_pack = {"name": "Valid", "description": "Valid pack"}
        (tmp_path / "valid.yaml").write_text(yaml.dump(valid_pack))
        (tmp_path / "invalid.yaml").write_text("not: valid: yaml:")

        service = ConfigPackService(packs_dir=tmp_path)
        packs = service.list_packs()

        # Should only have the valid pack
        assert len(packs) == 1
        assert packs[0].name == "valid"

    def test_get_template_content(self, tmp_path: Path) -> None:
        """Test getting template content."""
        templates_dir = tmp_path / "templates"
        templates_dir.mkdir()
        (templates_dir / "test.conf").write_text("config content here")

        service = ConfigPackService(packs_dir=tmp_path)
        content = service.get_template_content("test.conf")
        assert content == "config content here"

    def test_get_template_content_not_found(self, tmp_path: Path) -> None:
        """Test getting nonexistent template raises error."""
        templates_dir = tmp_path / "templates"
        templates_dir.mkdir()

        service = ConfigPackService(packs_dir=tmp_path)
        with pytest.raises(ConfigPackError, match="Template not found"):
            service.get_template_content("missing.conf")

    def test_pack_caching(self, tmp_path: Path) -> None:
        """Test that loaded packs are cached."""
        pack_data = {"name": "Cached", "description": "Test caching"}
        (tmp_path / "cached.yaml").write_text(yaml.dump(pack_data))

        service = ConfigPackService(packs_dir=tmp_path)

        # First load
        service.load_pack("cached")

        # Modify the file
        (tmp_path / "cached.yaml").write_text(
            yaml.dump({"name": "Modified", "description": "Changed"})
        )

        # Second load should return cached version
        pack2 = service.load_pack("cached")
        assert pack2.name == "Cached"  # Still the cached version

        # Clear cache
        service.clear_cache()

        # Now should get the updated version
        pack3 = service.load_pack("cached")
        assert pack3.name == "Modified"


class TestConfigPackAPI:
    """API integration tests for config pack endpoints."""

    def test_list_packs_unauthorized(self, client: TestClient) -> None:
        """Test that listing packs requires authentication."""
        response = client.get("/api/v1/config/packs")
        assert response.status_code == 401

    def test_list_packs_success(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """Test listing packs returns expected structure."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            pack_data = {"name": "Test Pack", "description": "A test pack"}
            (tmp_path / "test-pack.yaml").write_text(yaml.dump(pack_data))

            # Patch the service singleton directly
            import homelab_cmd.api.routes.config_packs as config_packs_module

            original_service = config_packs_module._service
            try:
                config_packs_module._service = ConfigPackService(packs_dir=tmp_path)

                response = client.get("/api/v1/config/packs", headers=auth_headers)

                assert response.status_code == 200
                data = response.json()
                assert "packs" in data
                assert "total" in data
                assert data["total"] == 1
                assert data["packs"][0]["name"] == "test-pack"
                assert data["packs"][0]["display_name"] == "Test Pack"
            finally:
                config_packs_module._service = original_service

    def test_get_pack_unauthorized(self, client: TestClient) -> None:
        """Test that getting a pack requires authentication."""
        response = client.get("/api/v1/config/packs/test")
        assert response.status_code == 401

    def test_get_pack_not_found(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """Test getting nonexistent pack returns 404."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            import homelab_cmd.api.routes.config_packs as config_packs_module

            original_service = config_packs_module._service
            try:
                config_packs_module._service = ConfigPackService(packs_dir=Path(tmp_dir))

                response = client.get("/api/v1/config/packs/nonexistent", headers=auth_headers)
                assert response.status_code == 404
            finally:
                config_packs_module._service = original_service

    def test_get_pack_success(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """Test getting a pack returns full details."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            pack_data = {
                "name": "My Pack",
                "description": "Pack description",
                "items": {
                    "packages": [{"name": "vim", "description": "Editor"}],
                },
            }
            (tmp_path / "my-pack.yaml").write_text(yaml.dump(pack_data))

            import homelab_cmd.api.routes.config_packs as config_packs_module

            original_service = config_packs_module._service
            try:
                config_packs_module._service = ConfigPackService(packs_dir=tmp_path)

                response = client.get("/api/v1/config/packs/my-pack", headers=auth_headers)

                assert response.status_code == 200
                data = response.json()
                assert data["name"] == "My Pack"
                assert data["description"] == "Pack description"
                assert len(data["items"]["packages"]) == 1
                assert data["items"]["packages"][0]["name"] == "vim"
            finally:
                config_packs_module._service = original_service

    def test_get_pack_resolve_extends_false(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test getting pack without resolving extends."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)

            base_data = {
                "name": "Base",
                "description": "Base pack",
                "items": {"packages": [{"name": "base-pkg", "description": "From base"}]},
            }
            (tmp_path / "base.yaml").write_text(yaml.dump(base_data))

            child_data = {
                "name": "Child",
                "description": "Child pack",
                "extends": "base",
                "items": {"packages": [{"name": "child-pkg", "description": "From child"}]},
            }
            (tmp_path / "child.yaml").write_text(yaml.dump(child_data))

            import homelab_cmd.api.routes.config_packs as config_packs_module

            original_service = config_packs_module._service
            try:
                config_packs_module._service = ConfigPackService(packs_dir=tmp_path)

                # Without resolve_extends
                response = client.get(
                    "/api/v1/config/packs/child?resolve_extends=false", headers=auth_headers
                )

                assert response.status_code == 200
                data = response.json()
                # Should only have child's package
                assert len(data["items"]["packages"]) == 1
                assert data["items"]["packages"][0]["name"] == "child-pkg"

                # Clear cache before testing with resolve
                config_packs_module._service.clear_cache()

                # With resolve_extends (default)
                response = client.get("/api/v1/config/packs/child", headers=auth_headers)

                assert response.status_code == 200
                data = response.json()
                # Should have both packages
                assert len(data["items"]["packages"]) == 2
            finally:
                config_packs_module._service = original_service
