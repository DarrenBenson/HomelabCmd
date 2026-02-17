"""Agent self-update module for HomelabCmd.

US0184: Agent Auto-Update Mechanism

This module handles:
- Version comparison
- Downloading new agent versions from the hub
- Checksum verification
- Self-replacement with backup
- Rollback on failure
"""

from __future__ import annotations

import hashlib
import logging
import os
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path

import httpx

# Support both running as module and standalone script
try:
    from .config import AgentConfig
except ImportError:
    from config import AgentConfig

logger = logging.getLogger(__name__)

# Constants
DOWNLOAD_TIMEOUT = 300.0  # 5 minutes for large downloads
RETRY_COUNT = 3
RETRY_DELAY_SECONDS = 5
STARTUP_CHECK_TIMEOUT = 30  # Seconds to wait for new agent to start


@dataclass
class UpdateResult:
    """Result of an update operation."""

    status: str  # "current", "success", "failed", "skipped"
    version: str | None = None
    error: str | None = None


def compare_versions(current: str, latest: str) -> int:
    """Compare semver versions.

    Args:
        current: Current version string (e.g., "2.0.0")
        latest: Latest version string (e.g., "2.1.0")

    Returns:
        1 if latest > current, 0 if equal, -1 if latest < current
    """
    if current == latest:
        return 0

    # Handle "unknown" version - always consider update available
    if current == "unknown":
        return 1

    try:
        # Parse version strings into tuples of integers
        def parse_version(v: str) -> tuple[int, ...]:
            # Remove any pre-release suffix (e.g., "2.1.0-beta" -> "2.1.0")
            base = v.split("-")[0]
            parts = base.split(".")
            return tuple(int(p) for p in parts)

        current_parts = parse_version(current)
        latest_parts = parse_version(latest)

        # Pad shorter version with zeros
        max_len = max(len(current_parts), len(latest_parts))
        current_parts = current_parts + (0,) * (max_len - len(current_parts))
        latest_parts = latest_parts + (0,) * (max_len - len(latest_parts))

        if latest_parts > current_parts:
            return 1
        elif latest_parts < current_parts:
            return -1
        else:
            return 0
    except (ValueError, AttributeError):
        # If parsing fails, compare as strings
        if latest > current:
            return 1
        elif latest < current:
            return -1
        return 0


def get_agent_install_path() -> Path:
    """Get the path where the agent is installed.

    Returns:
        Path to the agent installation directory.
    """
    # Check if running from installed location
    if Path("/opt/homelab-agent/agent.py").exists():
        return Path("/opt/homelab-agent")

    # Fall back to the directory containing this module
    return Path(__file__).parent


def get_backup_path(install_path: Path) -> Path:
    """Get the backup directory path for rollback.

    Args:
        install_path: Agent installation directory.

    Returns:
        Path to the backup directory.
    """
    return install_path / ".backup"


class AgentUpdater:
    """Handles agent self-update operations."""

    def __init__(self, config: AgentConfig, current_version: str):
        """Initialise the updater.

        Args:
            config: Agent configuration with hub URL.
            current_version: Current agent version string.
        """
        self.config = config
        self.current_version = current_version
        self.install_path = get_agent_install_path()
        self.backup_path = get_backup_path(self.install_path)

    def check_update_available(self, latest_version: str | None) -> bool:
        """Check if an update is available.

        Args:
            latest_version: Latest version advertised by hub.

        Returns:
            True if update is available.
        """
        if not latest_version:
            return False

        return compare_versions(self.current_version, latest_version) > 0

    def download_agent(self, version: str) -> tuple[bytes, str]:
        """Download new agent version from hub.

        Args:
            version: Version to download.

        Returns:
            Tuple of (agent package bytes, checksum from server).

        Raises:
            Exception: If download fails after retries.
        """
        url = f"{self.config.hub_url}/api/v1/agents/download"
        params = {"version": version}

        headers: dict[str, str] = {}
        if self.config.api_token:
            headers["X-Agent-Token"] = self.config.api_token
            headers["X-Server-GUID"] = self.config.server_guid
        elif self.config.api_key:
            headers["X-API-Key"] = self.config.api_key

        last_error: Exception | None = None

        for attempt in range(1, RETRY_COUNT + 1):
            try:
                logger.info(
                    "Downloading agent version %s (attempt %d/%d)",
                    version,
                    attempt,
                    RETRY_COUNT,
                )

                with httpx.Client(timeout=DOWNLOAD_TIMEOUT) as client:
                    response = client.get(url, params=params, headers=headers)

                    if response.status_code == 200:
                        checksum = response.headers.get("X-Checksum-SHA256", "")
                        return response.content, checksum
                    else:
                        last_error = Exception(
                            f"Download failed: HTTP {response.status_code}"
                        )
                        logger.warning(
                            "Download failed (attempt %d/%d): HTTP %d",
                            attempt,
                            RETRY_COUNT,
                            response.status_code,
                        )

            except httpx.TimeoutException as e:
                last_error = e
                logger.warning(
                    "Download timed out (attempt %d/%d): %s",
                    attempt,
                    RETRY_COUNT,
                    e,
                )
            except Exception as e:
                last_error = e
                logger.warning(
                    "Download error (attempt %d/%d): %s",
                    attempt,
                    RETRY_COUNT,
                    e,
                )

            if attempt < RETRY_COUNT:
                logger.debug("Retrying in %d seconds...", RETRY_DELAY_SECONDS)
                time.sleep(RETRY_DELAY_SECONDS)

        raise Exception(f"Download failed after {RETRY_COUNT} attempts: {last_error}")

    def verify_checksum(self, data: bytes, expected_checksum: str) -> bool:
        """Verify SHA256 checksum of downloaded data.

        Args:
            data: Downloaded bytes.
            expected_checksum: Expected SHA256 checksum.

        Returns:
            True if checksum matches.
        """
        if not expected_checksum:
            logger.warning("No checksum provided by server - skipping verification")
            return True

        actual = hashlib.sha256(data).hexdigest()
        matches = actual.lower() == expected_checksum.lower()

        if not matches:
            logger.error(
                "Checksum mismatch: expected %s, got %s",
                expected_checksum,
                actual,
            )

        return matches

    def backup_current(self) -> bool:
        """Backup current agent installation.

        Returns:
            True if backup succeeded.
        """
        try:
            # Remove old backup if exists
            if self.backup_path.exists():
                shutil.rmtree(self.backup_path)

            # Create backup directory
            self.backup_path.mkdir(parents=True, exist_ok=True)

            # Copy key files to backup
            for filename in ["agent.py", "VERSION", "config.py", "heartbeat.py",
                            "collectors.py", "updater.py", "__init__.py", "__main__.py"]:
                src = self.install_path / filename
                if src.exists():
                    shutil.copy2(src, self.backup_path / filename)

            logger.info("Backed up current agent to %s", self.backup_path)
            return True

        except Exception as e:
            logger.error("Failed to create backup: %s", e)
            return False

    def extract_and_install(self, package_data: bytes, version: str) -> bool:
        """Extract downloaded package and install new agent.

        Args:
            package_data: Downloaded package bytes (tar.gz or raw Python).
            version: Version being installed.

        Returns:
            True if installation succeeded.
        """
        try:
            # Create temp directory for extraction
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)

                # Try to detect format and extract
                if package_data[:2] == b"\x1f\x8b":  # gzip magic bytes
                    # It's a tar.gz archive
                    import tarfile
                    import io

                    tar_file = temp_path / "agent.tar.gz"
                    tar_file.write_bytes(package_data)

                    with tarfile.open(tar_file, "r:gz") as tar:
                        tar.extractall(temp_path)

                    # Find agent files in extracted content
                    extracted_files = list(temp_path.glob("**/*.py"))
                    if not extracted_files:
                        raise Exception("No Python files found in archive")

                    # Copy extracted files to install path
                    for py_file in extracted_files:
                        dest = self.install_path / py_file.name
                        shutil.copy2(py_file, dest)

                else:
                    # Assume it's raw agent.py content
                    agent_file = self.install_path / "agent.py"
                    agent_file.write_bytes(package_data)

                # Update VERSION file
                version_file = self.install_path / "VERSION"
                version_file.write_text(version)

            logger.info("Installed new agent version %s", version)
            return True

        except Exception as e:
            logger.error("Failed to install new agent: %s", e)
            return False

    def restart_service(self) -> bool:
        """Restart the agent service.

        Returns:
            True if restart command succeeded.
        """
        try:
            # Try systemd restart
            result = subprocess.run(
                ["systemctl", "restart", "homelab-agent"],
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode == 0:
                logger.info("Agent service restarted successfully")
                return True
            else:
                logger.warning("systemctl restart failed: %s", result.stderr)
                # Fall through to try other methods

        except FileNotFoundError:
            logger.debug("systemctl not available")
        except subprocess.TimeoutExpired:
            logger.error("Service restart timed out")
            return False
        except Exception as e:
            logger.warning("systemctl restart failed: %s", e)

        # If systemd not available, exit and let supervisor restart us
        logger.info("Exiting for supervisor restart...")
        sys.exit(0)

    def rollback(self) -> bool:
        """Restore previous agent version from backup.

        Returns:
            True if rollback succeeded.
        """
        if not self.backup_path.exists():
            logger.error("No backup available for rollback")
            return False

        try:
            # Copy backup files back
            for backup_file in self.backup_path.iterdir():
                if backup_file.is_file():
                    dest = self.install_path / backup_file.name
                    shutil.copy2(backup_file, dest)

            logger.info("Rolled back to previous agent version")
            return True

        except Exception as e:
            logger.error("Rollback failed: %s", e)
            return False

    def perform_update(
        self,
        latest_version: str,
        force: bool = False,
        auto_update_enabled: bool = False,
    ) -> UpdateResult:
        """Perform agent self-update.

        Args:
            latest_version: Target version to update to.
            force: If True, update even if auto_update is disabled.
            auto_update_enabled: Whether auto-update is enabled for this server.

        Returns:
            UpdateResult with status and details.
        """
        # Check if update is needed
        if not self.check_update_available(latest_version):
            logger.debug("Agent is current (version %s)", self.current_version)
            return UpdateResult(status="current", version=self.current_version)

        # Check if auto-update is enabled (unless forced)
        if not force and not auto_update_enabled:
            logger.info(
                "Update available (%s -> %s) but auto-update disabled",
                self.current_version,
                latest_version,
            )
            return UpdateResult(
                status="skipped",
                version=latest_version,
                error="Auto-update disabled",
            )

        logger.info(
            "Starting update: %s -> %s",
            self.current_version,
            latest_version,
        )

        # Download new version
        try:
            package_data, checksum = self.download_agent(latest_version)
        except Exception as e:
            return UpdateResult(
                status="failed",
                version=latest_version,
                error=f"Download failed: {e}",
            )

        # Verify checksum
        if not self.verify_checksum(package_data, checksum):
            return UpdateResult(
                status="failed",
                version=latest_version,
                error="Checksum mismatch",
            )

        # Backup current version
        if not self.backup_current():
            return UpdateResult(
                status="failed",
                version=latest_version,
                error="Backup failed",
            )

        # Install new version
        if not self.extract_and_install(package_data, latest_version):
            # Rollback on install failure
            self.rollback()
            return UpdateResult(
                status="failed",
                version=latest_version,
                error="Installation failed",
            )

        # Restart service
        # Note: This may not return if we exit for supervisor restart
        self.restart_service()

        return UpdateResult(
            status="success",
            version=latest_version,
        )


def handle_heartbeat_update(
    config: AgentConfig,
    current_version: str,
    heartbeat_response: dict,
    auto_update_enabled: bool = False,
) -> UpdateResult | None:
    """Handle update logic based on heartbeat response.

    Called after each heartbeat to check for and potentially perform updates.

    Args:
        config: Agent configuration.
        current_version: Current agent version.
        heartbeat_response: Response from heartbeat API.
        auto_update_enabled: Whether auto-update is enabled.

    Returns:
        UpdateResult if update was attempted, None otherwise.
    """
    latest_version = heartbeat_response.get("latest_agent_version")
    update_command = heartbeat_response.get("update_command")

    # Check if we should update
    updater = AgentUpdater(config, current_version)

    # Forced update via command
    if update_command == "update":
        logger.info("Received update command from hub")
        return updater.perform_update(
            latest_version or current_version,
            force=True,
            auto_update_enabled=True,
        )

    # Check for available update
    if not latest_version:
        return None

    if not updater.check_update_available(latest_version):
        return None

    # Log that update is available
    logger.info("New agent version available: %s (current: %s)",
                latest_version, current_version)

    # Perform update if auto-update enabled
    if auto_update_enabled:
        return updater.perform_update(
            latest_version,
            force=False,
            auto_update_enabled=True,
        )

    return UpdateResult(
        status="skipped",
        version=latest_version,
        error="Auto-update disabled",
    )
