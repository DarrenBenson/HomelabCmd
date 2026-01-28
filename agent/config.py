"""Configuration handling for the HomelabCmd monitoring agent.

This module provides configuration loading from YAML files and environment
variables, with validation of required fields.
"""

from __future__ import annotations

import logging
import os
import re
import socket
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

import yaml

logger = logging.getLogger(__name__)

# Constants
DEFAULT_HEARTBEAT_INTERVAL = 60
DEFAULT_COMMAND_TIMEOUT = 30

# Agent operating modes (BG0017)
AGENT_MODE_READONLY = "readonly"
AGENT_MODE_READWRITE = "readwrite"
VALID_AGENT_MODES = {AGENT_MODE_READONLY, AGENT_MODE_READWRITE}
DEFAULT_AGENT_MODE = AGENT_MODE_READONLY  # Safe default

# UUID v4 validation pattern
UUID_V4_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


@dataclass
class AgentConfig:
    """Agent configuration loaded from YAML file."""

    hub_url: str
    server_id: str
    server_guid: str  # Permanent UUID v4 identity (US0070)
    # Authentication (supports both legacy and per-agent tokens)
    api_key: str | None = None  # Legacy shared API key
    api_token: str | None = None  # Per-agent token (preferred)
    heartbeat_interval: int = DEFAULT_HEARTBEAT_INTERVAL
    monitored_services: list[str] | None = None
    # Agent operating mode (BG0017): "readonly" or "readwrite"
    # - readonly: Metrics collection only, no command execution
    # - readwrite: Full management including command execution
    mode: str = DEFAULT_AGENT_MODE
    # Command execution settings (US0027) - only effective in readwrite mode
    command_execution_enabled: bool = False
    use_sudo: bool = False
    command_timeout: int = DEFAULT_COMMAND_TIMEOUT

    def has_valid_auth(self) -> bool:
        """Check if this agent has valid authentication configured.

        Returns:
            True if either api_token or api_key is set.
        """
        return bool(self.api_token) or bool(self.api_key)

    def uses_per_agent_auth(self) -> bool:
        """Check if this agent uses per-agent token authentication.

        Returns:
            True if api_token is set (preferred auth method).
        """
        return bool(self.api_token)

    def can_execute_commands(self) -> bool:
        """Check if this agent can execute commands (BG0017).

        Commands are only allowed when:
        1. Agent is in readwrite mode
        2. command_execution_enabled is True

        Returns:
            True if command execution is permitted, False otherwise.
        """
        return self.mode == AGENT_MODE_READWRITE and self.command_execution_enabled


def _generate_guid() -> str:
    """Generate a new UUID v4 GUID for this agent.

    Returns:
        Lowercase UUID v4 string (e.g., "a1b2c3d4-e5f6-4890-abcd-ef1234567890").
    """
    return str(uuid4()).lower()


def _is_valid_guid(guid: str | None) -> bool:
    """Validate that a string is a valid UUID v4.

    Args:
        guid: String to validate.

    Returns:
        True if valid UUID v4 format, False otherwise.
    """
    if not guid:
        return False
    return bool(UUID_V4_PATTERN.match(guid))


def _persist_guid_to_config(config_path: Path, guid: str) -> None:
    """Persist a generated GUID to the config file.

    Updates the YAML config file to include the server_guid field.
    If the file cannot be written (permissions, disk full), logs a warning
    but does not raise an exception.

    Args:
        config_path: Path to the YAML configuration file.
        guid: The GUID to persist.
    """
    try:
        # Read existing config
        with open(config_path) as f:
            data = yaml.safe_load(f) or {}

        # Add GUID
        data["server_guid"] = guid

        # Write back
        with open(config_path, "w") as f:
            yaml.dump(data, f, default_flow_style=False)

        logger.info("Persisted server_guid to config file: %s", config_path)
    except OSError as e:
        logger.warning(
            "Could not persist GUID to config file %s: %s. "
            "GUID will be regenerated on next restart if config is not updated.",
            config_path,
            e,
        )


def load_config_from_env() -> AgentConfig | None:
    """Load configuration from environment variables.

    Environment variables:
        HOMELAB_AGENT_HUB_URL: URL of the HomelabCmd server
        HOMELAB_AGENT_SERVER_ID: Unique server identifier (defaults to hostname)
        HOMELAB_AGENT_API_TOKEN: Per-agent API token (preferred, new auth)
        HOMELAB_AGENT_API_KEY: Legacy shared API key (for backward compatibility)
        HOMELAB_AGENT_SERVER_GUID: Permanent agent GUID (auto-generated if not set)
        HOMELAB_AGENT_HEARTBEAT_INTERVAL: Heartbeat interval in seconds
        HOMELAB_AGENT_MONITORED_SERVICES: Comma-separated list of services to monitor
        HOMELAB_AGENT_MODE: Operating mode ("readonly" or "readwrite", default: readonly)
        HOMELAB_AGENT_COMMAND_EXECUTION: Enable command execution (true/false)
        HOMELAB_AGENT_USE_SUDO: Use sudo for commands (true/false)
        HOMELAB_AGENT_COMMAND_TIMEOUT: Command timeout in seconds

    Returns:
        AgentConfig if required env vars are set, None otherwise.
    """
    hub_url = os.environ.get("HOMELAB_AGENT_HUB_URL")
    api_token = os.environ.get("HOMELAB_AGENT_API_TOKEN")
    api_key = os.environ.get("HOMELAB_AGENT_API_KEY")

    # Require hub_url and at least one auth method
    if not hub_url or not (api_token or api_key):
        return None

    server_id = os.environ.get("HOMELAB_AGENT_SERVER_ID", socket.gethostname())

    # GUID from env or generate new one (cannot persist in env-only mode)
    server_guid = os.environ.get("HOMELAB_AGENT_SERVER_GUID")
    if not _is_valid_guid(server_guid):
        server_guid = _generate_guid()
        logger.warning(
            "Generated new server_guid for env-based config. "
            "Set HOMELAB_AGENT_SERVER_GUID=%s to persist.",
            server_guid,
        )

    heartbeat_interval = int(
        os.environ.get("HOMELAB_AGENT_HEARTBEAT_INTERVAL", DEFAULT_HEARTBEAT_INTERVAL)
    )

    # Parse comma-separated services list
    services_str = os.environ.get("HOMELAB_AGENT_MONITORED_SERVICES", "")
    monitored_services = [s.strip() for s in services_str.split(",") if s.strip()] or None

    # Agent mode (BG0017)
    mode = os.environ.get("HOMELAB_AGENT_MODE", DEFAULT_AGENT_MODE).lower()
    if mode not in VALID_AGENT_MODES:
        logger.warning("Invalid agent mode '%s', defaulting to '%s'", mode, DEFAULT_AGENT_MODE)
        mode = DEFAULT_AGENT_MODE

    # Command execution settings (US0027) - only effective in readwrite mode
    command_execution_enabled = (
        os.environ.get("HOMELAB_AGENT_COMMAND_EXECUTION", "false").lower() == "true"
    )
    use_sudo = os.environ.get("HOMELAB_AGENT_USE_SUDO", "false").lower() == "true"
    command_timeout = int(os.environ.get("HOMELAB_AGENT_COMMAND_TIMEOUT", DEFAULT_COMMAND_TIMEOUT))

    auth_method = "per_agent" if api_token else "legacy"
    logger.info(
        "Loaded configuration from environment variables (mode=%s, auth=%s)", mode, auth_method
    )
    return AgentConfig(
        hub_url=hub_url.rstrip("/"),
        server_id=server_id,
        server_guid=server_guid,
        api_token=api_token,
        api_key=api_key,
        heartbeat_interval=heartbeat_interval,
        monitored_services=monitored_services,
        mode=mode,
        command_execution_enabled=command_execution_enabled,
        use_sudo=use_sudo,
        command_timeout=command_timeout,
    )


def load_config(
    config_path: Path = Path("/etc/homelab-agent/config.yaml"),
) -> AgentConfig:
    """Load and validate configuration from YAML file or environment.

    First attempts to load from YAML file. If the file doesn't exist,
    falls back to environment variables.

    GUID handling (US0070):
    - If server_guid exists in config and is valid, use it
    - If server_guid is missing or invalid, generate a new one and persist it
    - GUID is permanent and survives IP/hostname changes

    Args:
        config_path: Path to the YAML configuration file.

    Returns:
        Validated AgentConfig instance.

    Raises:
        FileNotFoundError: Config file does not exist and env vars not set.
        ValueError: Required field missing or invalid format.
    """
    # Try config file first
    if config_path.exists():
        with open(config_path) as f:
            data = yaml.safe_load(f)

        if not data:
            raise ValueError("Configuration file is empty")

        # Required fields (auth can be either api_token or api_key)
        if "hub_url" not in data or not data["hub_url"]:
            raise ValueError("Required configuration field missing: hub_url")
        if "server_id" not in data or not data["server_id"]:
            raise ValueError("Required configuration field missing: server_id")
        if not data.get("api_token") and not data.get("api_key"):
            raise ValueError("Authentication required: set either api_token or api_key")

        # GUID handling (US0070): load existing or generate and persist new one
        server_guid = data.get("server_guid")
        if not _is_valid_guid(server_guid):
            server_guid = _generate_guid()
            logger.info("Generated new server_guid: %s", server_guid)
            _persist_guid_to_config(config_path, server_guid)

        # Agent mode (BG0017)
        mode = str(data.get("mode", DEFAULT_AGENT_MODE)).lower()
        if mode not in VALID_AGENT_MODES:
            logger.warning("Invalid agent mode '%s', defaulting to '%s'", mode, DEFAULT_AGENT_MODE)
            mode = DEFAULT_AGENT_MODE

        # Command execution settings (US0027) - only effective in readwrite mode
        command_config = data.get("command_execution", {})
        if not isinstance(command_config, dict):
            command_config = {}

        # Extract auth credentials
        api_token = data.get("api_token")
        api_key = data.get("api_key")
        auth_method = "per_agent" if api_token else "legacy"

        logger.info(
            "Loaded configuration from %s (mode=%s, auth=%s)", config_path, mode, auth_method
        )
        return AgentConfig(
            hub_url=str(data["hub_url"]).rstrip("/"),
            server_id=str(data["server_id"]),
            server_guid=server_guid,
            api_token=str(api_token) if api_token else None,
            api_key=str(api_key) if api_key else None,
            heartbeat_interval=int(data.get("heartbeat_interval", DEFAULT_HEARTBEAT_INTERVAL)),
            monitored_services=data.get("monitored_services"),
            mode=mode,
            command_execution_enabled=bool(command_config.get("enabled", False)),
            use_sudo=bool(command_config.get("use_sudo", False)),
            command_timeout=int(command_config.get("timeout_seconds", DEFAULT_COMMAND_TIMEOUT)),
        )

    # Fall back to environment variables
    env_config = load_config_from_env()
    if env_config:
        return env_config

    raise FileNotFoundError(
        f"Configuration file not found: {config_path}. "
        "Set HOMELAB_AGENT_HUB_URL and HOMELAB_AGENT_API_KEY environment variables, "
        "or create a config file."
    )
