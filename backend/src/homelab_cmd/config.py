"""Configuration management using pydantic-settings."""

import logging
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

# Default API key for development only
DEV_API_KEY = "dev-key-change-me"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_prefix="HOMELAB_CMD_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # API Configuration
    api_key: str = DEV_API_KEY
    api_title: str = "HomelabCmd API"
    api_version: str = "1.0.0"

    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8080
    debug: bool = False
    external_url: str | None = None  # External URL for agent callbacks (e.g., behind reverse proxy)

    # Database (placeholder for US0001)
    database_url: str = "sqlite:///./data/homelab.db"

    # SSH Configuration (EP0006: Ad-hoc Scanning)
    ssh_key_path: str = "/app/ssh"
    ssh_default_username: str = "root"
    ssh_default_port: int = 22
    ssh_connection_timeout: int = 10

    # Credential Encryption (EP0008: Tailscale Integration)
    # Must be set in production; validated at startup in main.py lifespan
    encryption_key: str | None = None

    def is_dev_key(self) -> bool:
        """Check if using the default development API key."""
        return self.api_key == DEV_API_KEY


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    settings = Settings()

    # Warn if using development key
    if settings.is_dev_key():
        logger.warning(
            "Using default development API key. "
            "Set HOMELAB_CMD_API_KEY environment variable for production."
        )

    return settings
