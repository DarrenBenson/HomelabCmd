"""Tests for Settings class (config.py).

Unit tests verifying Settings class attributes and defaults.

Spec Reference: BG0009 regression test - external_url setting
"""


class TestSettingsAttributes:
    """Test Settings class has all required attributes."""

    def test_settings_has_external_url_attribute(self) -> None:
        """Settings class must have external_url attribute (BG0009 regression)."""
        # Clear cache to get fresh settings
        from homelab_cmd.config import Settings

        settings = Settings()
        # Must have external_url attribute (this was the root cause of BG0009)
        assert hasattr(settings, "external_url")

    def test_external_url_defaults_to_none(self, monkeypatch) -> None:
        """external_url should default to None when env var is not set."""
        # Clear the env var to test default value
        monkeypatch.delenv("HOMELAB_CMD_EXTERNAL_URL", raising=False)
        monkeypatch.delenv("EXTERNAL_URL", raising=False)

        from homelab_cmd.config import Settings

        # Disable .env file reading to test true default value
        settings = Settings(_env_file=None)
        assert settings.external_url is None

    def test_external_url_from_env(self, monkeypatch) -> None:
        """external_url should be settable via HOMELAB_CMD_EXTERNAL_URL env var."""
        from homelab_cmd.config import Settings

        monkeypatch.setenv("HOMELAB_CMD_EXTERNAL_URL", "https://homelab.example.com")
        settings = Settings()
        assert settings.external_url == "https://homelab.example.com"


class TestSettingsServerConfiguration:
    """Test server configuration settings."""

    def test_settings_has_host(self) -> None:
        """Settings must have host attribute."""
        from homelab_cmd.config import Settings

        settings = Settings()
        assert hasattr(settings, "host")
        assert settings.host == "0.0.0.0"

    def test_settings_has_port(self) -> None:
        """Settings must have port attribute."""
        from homelab_cmd.config import Settings

        settings = Settings()
        assert hasattr(settings, "port")
        assert settings.port == 8080

    def test_settings_has_debug(self) -> None:
        """Settings must have debug attribute."""
        from homelab_cmd.config import Settings

        settings = Settings()
        assert hasattr(settings, "debug")
        assert settings.debug is False
