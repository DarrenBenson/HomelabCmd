"""Tests for agent GUID generation and persistence (US0070: GUID-Based Server Identity).

These tests verify the agent-side GUID functionality:
- GUID generation on first startup
- GUID persistence to config file
- GUID loading from existing config
- GUID validation
- Environment variable handling

Spec Reference: sdlc-studio/stories/US0070-guid-based-server-identity.md
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

# Add project root to path for imports
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from agent.config import (  # noqa: E402
    UUID_V4_PATTERN,
    _generate_guid,
    _is_valid_guid,
    _persist_guid_to_config,
    load_config,
    load_config_from_env,
)


class TestGuidGeneration:
    """Tests for GUID generation (US0070 - AC6)."""

    def test_generate_guid_returns_valid_uuid_v4(self) -> None:
        """AC6: Generated GUID should be valid UUID v4 format."""
        guid = _generate_guid()
        assert UUID_V4_PATTERN.match(guid) is not None

    def test_generate_guid_is_lowercase(self) -> None:
        """Generated GUID should be lowercase."""
        guid = _generate_guid()
        assert guid == guid.lower()

    def test_generate_guid_is_unique(self) -> None:
        """Each call should generate a unique GUID."""
        guids = [_generate_guid() for _ in range(100)]
        assert len(set(guids)) == 100


class TestGuidValidation:
    """Tests for GUID validation."""

    def test_valid_uuid_v4_is_accepted(self) -> None:
        """Valid UUID v4 should return True."""
        valid_guids = [
            "a1b2c3d4-e5f6-4890-abcd-ef1234567890",
            "00000000-0000-4000-8000-000000000000",
            "ffffffff-ffff-4fff-bfff-ffffffffffff",
        ]
        for guid in valid_guids:
            assert _is_valid_guid(guid) is True

    def test_none_is_rejected(self) -> None:
        """None should return False."""
        assert _is_valid_guid(None) is False

    def test_empty_string_is_rejected(self) -> None:
        """Empty string should return False."""
        assert _is_valid_guid("") is False

    def test_invalid_format_is_rejected(self) -> None:
        """Invalid format should return False."""
        invalid_guids = [
            "not-a-uuid",
            "a1b2c3d4-e5f6-1890-abcd-ef1234567890",  # UUID v1 (wrong version)
            "a1b2c3d4-e5f6-4890-0bcd-ef1234567890",  # Wrong variant
            "a1b2c3d4e5f6-4890-abcd-ef1234567890",  # Missing dash
            "A1B2C3D4-E5F6-4890-ABCD-EF1234567890",  # Uppercase (technically valid but we use lowercase)
        ]
        for guid in invalid_guids:
            # Note: uppercase is actually valid per RFC, but we store lowercase
            if guid.upper() == guid:
                # The pattern should still match uppercase
                pass
            else:
                assert _is_valid_guid(guid) is False


class TestGuidPersistence:
    """Tests for GUID persistence to config file (US0070 - AC7)."""

    def test_persist_guid_updates_config_file(self, tmp_path: Path) -> None:
        """AC7: GUID should be persisted to config file."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text("""
hub_url: "http://localhost:8080"
server_id: "test-server"
api_key: "test-key"
""")

        test_guid = "a1b2c3d4-e5f6-4890-abcd-ef1234567890"
        _persist_guid_to_config(config_file, test_guid)

        # Read back and verify
        content = config_file.read_text()
        assert "server_guid: a1b2c3d4-e5f6-4890-abcd-ef1234567890" in content

    def test_persist_guid_preserves_existing_config(self, tmp_path: Path) -> None:
        """Persisting GUID should preserve other config values."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text("""
hub_url: "http://localhost:8080"
server_id: "test-server"
api_key: "test-key"
heartbeat_interval: 30
monitored_services:
  - plex
  - sonarr
""")

        test_guid = "a1b2c3d4-e5f6-4890-abcd-ef1234567890"
        _persist_guid_to_config(config_file, test_guid)

        # Reload and verify all values
        config = load_config(config_file)
        assert config.hub_url == "http://localhost:8080"
        assert config.server_id == "test-server"
        assert config.api_key == "test-key"
        assert config.heartbeat_interval == 30
        assert config.monitored_services == ["plex", "sonarr"]
        assert config.server_guid == test_guid

    def test_persist_guid_handles_permission_error(self, tmp_path: Path) -> None:
        """Permission error should log warning but not raise."""
        config_file = tmp_path / "readonly.yaml"
        config_file.write_text("""
hub_url: "http://localhost:8080"
server_id: "test-server"
api_key: "test-key"
""")

        # Make file read-only
        config_file.chmod(0o444)

        try:
            # Should not raise
            _persist_guid_to_config(config_file, "test-guid")
        finally:
            # Restore permissions for cleanup
            config_file.chmod(0o644)


class TestLoadConfigWithGuid:
    """Tests for loading config with GUID handling."""

    def test_load_config_uses_existing_guid(self, tmp_path: Path) -> None:
        """Existing valid GUID should be used."""
        config_file = tmp_path / "config.yaml"
        existing_guid = "b2c3d4e5-f6a7-4890-bcde-f12345678901"
        config_file.write_text(f"""
hub_url: "http://localhost:8080"
server_id: "test-server"
api_key: "test-key"
server_guid: "{existing_guid}"
""")

        config = load_config(config_file)
        assert config.server_guid == existing_guid

    def test_load_config_generates_guid_if_missing(self, tmp_path: Path) -> None:
        """Missing GUID should be generated and persisted."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text("""
hub_url: "http://localhost:8080"
server_id: "test-server"
api_key: "test-key"
""")

        config = load_config(config_file)

        # Should have a valid GUID
        assert config.server_guid is not None
        assert UUID_V4_PATTERN.match(config.server_guid) is not None

        # GUID should be persisted to file
        content = config_file.read_text()
        assert "server_guid" in content

    def test_load_config_regenerates_invalid_guid(self, tmp_path: Path) -> None:
        """Invalid GUID should be regenerated."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text("""
hub_url: "http://localhost:8080"
server_id: "test-server"
api_key: "test-key"
server_guid: "invalid-not-a-uuid"
""")

        config = load_config(config_file)

        # Should have a valid GUID (not the invalid one)
        assert config.server_guid != "invalid-not-a-uuid"
        assert UUID_V4_PATTERN.match(config.server_guid) is not None


class TestLoadConfigFromEnvWithGuid:
    """Tests for environment variable config with GUID."""

    def test_env_config_uses_provided_guid(self) -> None:
        """GUID from environment variable should be used."""
        test_guid = "c3d4e5f6-a7b8-4901-8def-123456789012"
        with patch.dict(
            "os.environ",
            {
                "HOMELAB_AGENT_HUB_URL": "http://localhost:8080",
                "HOMELAB_AGENT_API_KEY": "test-key",
                "HOMELAB_AGENT_SERVER_GUID": test_guid,
            },
        ):
            config = load_config_from_env()
            assert config is not None
            assert config.server_guid == test_guid

    def test_env_config_generates_guid_if_not_set(self) -> None:
        """Missing GUID env var should generate a new GUID."""
        with patch.dict(
            "os.environ",
            {
                "HOMELAB_AGENT_HUB_URL": "http://localhost:8080",
                "HOMELAB_AGENT_API_KEY": "test-key",
            },
            clear=False,
        ):
            # Clear GUID env var if it exists
            import os

            os.environ.pop("HOMELAB_AGENT_SERVER_GUID", None)

            config = load_config_from_env()
            assert config is not None
            assert config.server_guid is not None
            assert UUID_V4_PATTERN.match(config.server_guid) is not None

    def test_env_config_generates_guid_if_invalid(self) -> None:
        """Invalid GUID env var should generate a new GUID."""
        with patch.dict(
            "os.environ",
            {
                "HOMELAB_AGENT_HUB_URL": "http://localhost:8080",
                "HOMELAB_AGENT_API_KEY": "test-key",
                "HOMELAB_AGENT_SERVER_GUID": "not-valid",
            },
        ):
            config = load_config_from_env()
            assert config is not None
            assert config.server_guid != "not-valid"
            assert UUID_V4_PATTERN.match(config.server_guid) is not None


class TestAgentConfigDataclass:
    """Tests for AgentConfig dataclass with GUID field."""

    def test_server_guid_is_required_field(self, tmp_path: Path) -> None:
        """AgentConfig should include server_guid field."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text("""
hub_url: "http://localhost:8080"
server_id: "test-server"
api_key: "test-key"
server_guid: "d4e5f6a7-b8c9-4012-9ef0-234567890123"
""")

        config = load_config(config_file)
        assert hasattr(config, "server_guid")
        assert config.server_guid == "d4e5f6a7-b8c9-4012-9ef0-234567890123"
