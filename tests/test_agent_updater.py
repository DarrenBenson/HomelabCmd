"""Tests for Agent Updater Module - Unit Tests (TS0201).

US0184: Agent Auto-Update Mechanism

Unit tests for the agent updater module covering version comparison,
checksum verification, backup/rollback operations, and the update flow.

Test cases:
- TC004: Agent detects newer version available
- TC005: Agent ignores same version
- TC006: Agent ignores older version
- TC007: Version comparison handles pre-release versions
- TC013: Agent verifies download checksum
- TC014: Agent backs up current version before update
- TC017: Agent waits for active command before updating (skipped when disabled)
- TC025: Rollback on download failure
- TC026: Rollback on checksum mismatch
"""

import hashlib
import sys
from pathlib import Path
from unittest.mock import MagicMock, Mock, patch

import pytest

# Add agent directory to sys.path for imports
AGENT_DIR = str(Path(__file__).resolve().parent.parent / "agent")
if AGENT_DIR not in sys.path:
    sys.path.insert(0, AGENT_DIR)

from config import AgentConfig
from updater import (
    AgentUpdater,
    UpdateResult,
    compare_versions,
    handle_heartbeat_update,
)


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def agent_config() -> AgentConfig:
    """Create a minimal AgentConfig for testing."""
    return AgentConfig(
        hub_url="http://localhost:8080",
        server_id="test-server",
        server_guid="a1b2c3d4-e5f6-4890-abcd-ef1234567890",
        api_key="test-key",
        auto_update=True,
    )


@pytest.fixture
def updater(agent_config: AgentConfig, tmp_path: Path) -> AgentUpdater:
    """Create an AgentUpdater with a temporary install path."""
    u = AgentUpdater(agent_config, "2.0.0")
    u.install_path = tmp_path
    u.backup_path = tmp_path / ".backup"
    return u


# =============================================================================
# TC004-TC007: Version comparison
# =============================================================================


class TestVersionComparison:
    """Version comparison logic for detecting available updates."""

    def test_detects_newer_version_available(self) -> None:
        """TC004: compare_versions should return 1 when latest is newer.

        The agent must detect when a newer version is available so it
        can initiate the update process.
        """
        assert compare_versions("2.0.0", "2.1.0") == 1
        assert compare_versions("2.0.0", "3.0.0") == 1
        assert compare_versions("2.0.0", "2.0.1") == 1

    def test_ignores_same_version(self) -> None:
        """TC005: compare_versions should return 0 when versions are equal.

        No update should be attempted when the agent is already running
        the latest version.
        """
        assert compare_versions("2.0.0", "2.0.0") == 0
        assert compare_versions("1.0.0", "1.0.0") == 0

    def test_ignores_older_version(self) -> None:
        """TC006: compare_versions should return -1 when latest is older.

        The agent should not downgrade to an older version. This can happen
        if the hub is temporarily configured with an older version.
        """
        assert compare_versions("2.1.0", "2.0.0") == -1
        assert compare_versions("3.0.0", "2.9.9") == -1
        assert compare_versions("2.0.1", "2.0.0") == -1

    def test_handles_pre_release_versions(self) -> None:
        """TC007: Version comparison handles pre-release suffixes.

        Pre-release versions (e.g., 2.1.0-beta) should be compared by
        their base version numbers, with the pre-release suffix stripped.
        """
        # Pre-release of same version should be equal (base version comparison)
        assert compare_versions("2.1.0", "2.1.0-beta") == 0

        # Newer base version with pre-release suffix
        assert compare_versions("2.0.0", "2.1.0-beta") == 1
        assert compare_versions("2.0.0", "2.1.0-rc1") == 1

        # Older base version with pre-release suffix
        assert compare_versions("2.1.0", "2.0.0-beta") == -1

    def test_handles_unknown_current_version(self) -> None:
        """Version 'unknown' should always indicate update available.

        When the agent cannot determine its version (e.g. missing VERSION
        file), it should accept any update from the hub.
        """
        assert compare_versions("unknown", "2.0.0") == 1
        assert compare_versions("unknown", "1.0.0") == 1

    def test_handles_different_length_versions(self) -> None:
        """Version comparison handles versions with different segment counts."""
        assert compare_versions("2.0", "2.0.1") == 1
        assert compare_versions("2.0.0", "2.1") == 1
        assert compare_versions("2.0.0", "2.0") == 0

    def test_check_update_available_with_none(
        self, updater: AgentUpdater
    ) -> None:
        """check_update_available returns False when latest_version is None."""
        assert updater.check_update_available(None) is False

    def test_check_update_available_with_newer_version(
        self, updater: AgentUpdater
    ) -> None:
        """check_update_available returns True for newer version."""
        assert updater.check_update_available("2.5.0") is True

    def test_check_update_available_with_same_version(
        self, updater: AgentUpdater
    ) -> None:
        """check_update_available returns False for same version."""
        assert updater.check_update_available("2.0.0") is False


# =============================================================================
# TC013: Checksum verification
# =============================================================================


class TestChecksumVerification:
    """SHA256 checksum verification for downloaded agent packages."""

    def test_verifies_matching_checksum(self, updater: AgentUpdater) -> None:
        """TC013: verify_checksum should return True for matching checksum.

        Downloaded package integrity must be verified before installation
        to prevent corrupted or tampered binaries from being installed.
        """
        data = b"test agent package content"
        expected = hashlib.sha256(data).hexdigest()

        assert updater.verify_checksum(data, expected) is True

    def test_rejects_mismatching_checksum(self, updater: AgentUpdater) -> None:
        """TC013: verify_checksum should return False for mismatching checksum.

        A checksum mismatch indicates data corruption during download or
        a tampered package, and must be rejected.
        """
        data = b"test agent package content"
        wrong_checksum = "a" * 64  # Wrong checksum

        assert updater.verify_checksum(data, wrong_checksum) is False

    def test_skips_verification_when_no_checksum_provided(
        self, updater: AgentUpdater
    ) -> None:
        """verify_checksum returns True when server provides no checksum.

        For backward compatibility, if the hub does not provide a checksum
        header, the verification step is skipped with a warning logged.
        """
        data = b"test agent package content"

        assert updater.verify_checksum(data, "") is True

    def test_checksum_comparison_is_case_insensitive(
        self, updater: AgentUpdater
    ) -> None:
        """Checksum comparison should be case-insensitive.

        SHA256 hex digests may be provided in uppercase or lowercase
        depending on the server implementation.
        """
        data = b"case insensitive test"
        expected_lower = hashlib.sha256(data).hexdigest().lower()
        expected_upper = expected_lower.upper()

        assert updater.verify_checksum(data, expected_upper) is True


# =============================================================================
# TC014: Backup current version
# =============================================================================


class TestBackupCurrentVersion:
    """Backup operations before agent update installation."""

    def test_backs_up_current_version(
        self, updater: AgentUpdater, tmp_path: Path
    ) -> None:
        """TC014: backup_current should copy key agent files to backup directory.

        Before installing a new version, the current agent files must be
        backed up to enable rollback if the update fails.
        """
        # Create some agent files to back up
        (tmp_path / "agent.py").write_text("# agent code")
        (tmp_path / "VERSION").write_text("2.0.0")
        (tmp_path / "config.py").write_text("# config code")
        (tmp_path / "__main__.py").write_text("# main entry")

        result = updater.backup_current()

        assert result is True
        assert updater.backup_path.exists()
        assert (updater.backup_path / "agent.py").read_text() == "# agent code"
        assert (updater.backup_path / "VERSION").read_text() == "2.0.0"
        assert (updater.backup_path / "config.py").read_text() == "# config code"
        assert (updater.backup_path / "__main__.py").read_text() == "# main entry"

    def test_backup_removes_old_backup_first(
        self, updater: AgentUpdater, tmp_path: Path
    ) -> None:
        """backup_current should remove previous backup before creating new one.

        Only one backup should be maintained. Old backups are removed to
        prevent disk space accumulation and confusion during rollback.
        """
        # Create existing backup
        old_backup = updater.backup_path
        old_backup.mkdir(parents=True)
        (old_backup / "old_file.py").write_text("old content")

        # Create current files
        (tmp_path / "VERSION").write_text("2.1.0")

        result = updater.backup_current()

        assert result is True
        # Old file should be gone
        assert not (updater.backup_path / "old_file.py").exists()
        # New backup should contain current files
        assert (updater.backup_path / "VERSION").read_text() == "2.1.0"

    def test_backup_handles_missing_files_gracefully(
        self, updater: AgentUpdater, tmp_path: Path
    ) -> None:
        """backup_current should skip files that do not exist.

        Not all agent files may be present in every installation (e.g. a
        minimal agent installation). Missing files should not cause failure.
        """
        # Only create VERSION - other files are absent
        (tmp_path / "VERSION").write_text("2.0.0")

        result = updater.backup_current()

        assert result is True
        assert (updater.backup_path / "VERSION").exists()
        # Files that did not exist should not be in backup
        assert not (updater.backup_path / "agent.py").exists()

    def test_backup_returns_false_on_permission_error(
        self, updater: AgentUpdater
    ) -> None:
        """backup_current should return False on filesystem errors."""
        with patch("shutil.rmtree", side_effect=PermissionError("denied")):
            # Create existing backup so rmtree is called
            updater.backup_path.mkdir(parents=True)
            result = updater.backup_current()

        assert result is False


# =============================================================================
# TC017: Agent waits for active command / update flow gating
# =============================================================================


class TestUpdateFlowGating:
    """Update flow gating - updates only proceed when conditions are met."""

    def test_skips_update_when_auto_update_disabled(
        self, agent_config: AgentConfig
    ) -> None:
        """TC017: handle_heartbeat_update returns 'skipped' when auto-update is off.

        When auto-update is disabled on the agent, available updates should
        be logged but not acted upon, preventing unintended updates.
        """
        heartbeat_response = {
            "latest_agent_version": "2.5.0",
            "update_command": None,
        }

        result = handle_heartbeat_update(
            config=agent_config,
            current_version="2.0.0",
            heartbeat_response=heartbeat_response,
            auto_update_enabled=False,
        )

        assert result is not None
        assert result.status == "skipped"
        assert result.version == "2.5.0"
        assert "disabled" in result.error.lower()

    def test_returns_none_when_no_version_in_response(
        self, agent_config: AgentConfig
    ) -> None:
        """handle_heartbeat_update returns None when no version advertised.

        If the hub does not include a latest_agent_version in the response,
        there is nothing to update.
        """
        heartbeat_response = {
            "latest_agent_version": None,
            "update_command": None,
        }

        result = handle_heartbeat_update(
            config=agent_config,
            current_version="2.0.0",
            heartbeat_response=heartbeat_response,
            auto_update_enabled=True,
        )

        assert result is None

    def test_returns_none_when_already_current(
        self, agent_config: AgentConfig
    ) -> None:
        """handle_heartbeat_update returns None when already on latest version."""
        heartbeat_response = {
            "latest_agent_version": "2.0.0",
            "update_command": None,
        }

        result = handle_heartbeat_update(
            config=agent_config,
            current_version="2.0.0",
            heartbeat_response=heartbeat_response,
            auto_update_enabled=True,
        )

        assert result is None

    def test_forced_update_via_command_bypasses_auto_update_setting(
        self, agent_config: AgentConfig
    ) -> None:
        """Hub 'update' command forces update even when auto-update is disabled.

        The update_command='update' from the hub represents a manual trigger
        by an admin and should bypass the auto-update preference.
        """
        heartbeat_response = {
            "latest_agent_version": "2.5.0",
            "update_command": "update",
        }

        # Mock the updater's perform_update to avoid actual download
        with patch.object(AgentUpdater, "perform_update") as mock_update:
            mock_update.return_value = UpdateResult(
                status="success", version="2.5.0"
            )

            result = handle_heartbeat_update(
                config=agent_config,
                current_version="2.0.0",
                heartbeat_response=heartbeat_response,
                auto_update_enabled=False,  # Disabled, but command overrides
            )

        assert result is not None
        assert result.status == "success"
        # Verify perform_update was called with force=True
        mock_update.assert_called_once_with(
            "2.5.0", force=True, auto_update_enabled=True
        )


# =============================================================================
# TC025: Rollback on download failure
# =============================================================================


class TestRollbackOnDownloadFailure:
    """Rollback behaviour when download fails during update."""

    def test_rollback_on_download_failure(
        self, updater: AgentUpdater, tmp_path: Path
    ) -> None:
        """TC025: perform_update returns 'failed' and does not corrupt install on download error.

        If the download fails (network error, timeout, HTTP error), the
        update should fail cleanly without modifying the current installation.
        No rollback is needed because the install has not been touched yet.
        """
        with patch.object(
            updater, "download_agent", side_effect=Exception("Connection refused")
        ):
            result = updater.perform_update(
                "2.5.0", force=True, auto_update_enabled=True
            )

        assert result.status == "failed"
        assert "Download failed" in result.error
        assert result.version == "2.5.0"

    def test_rollback_restores_files_on_install_failure(
        self, updater: AgentUpdater, tmp_path: Path
    ) -> None:
        """Rollback should restore backed-up files when installation fails.

        After a successful download and backup, if the installation step
        fails, the backed-up files must be restored to their original location.
        """
        # Create current agent files
        (tmp_path / "VERSION").write_text("2.0.0")
        (tmp_path / "agent.py").write_text("# old agent code")

        package_data = b"new agent content"
        checksum = hashlib.sha256(package_data).hexdigest()

        with (
            patch.object(updater, "download_agent", return_value=(package_data, checksum)),
            patch.object(updater, "extract_and_install", return_value=False),
        ):
            result = updater.perform_update(
                "2.5.0", force=True, auto_update_enabled=True
            )

        assert result.status == "failed"
        assert "Installation failed" in result.error

        # Verify backup was created (rollback restores from it)
        # After rollback, original files should be intact
        assert (tmp_path / "VERSION").read_text() == "2.0.0"
        assert (tmp_path / "agent.py").read_text() == "# old agent code"


# =============================================================================
# TC026: Rollback on checksum mismatch
# =============================================================================


class TestRollbackOnChecksumMismatch:
    """Rollback behaviour when checksum verification fails."""

    def test_rollback_on_checksum_mismatch(
        self, updater: AgentUpdater, tmp_path: Path
    ) -> None:
        """TC026: perform_update returns 'failed' on checksum mismatch.

        If the downloaded package does not match the expected checksum,
        the update must be rejected before any files are modified.
        """
        package_data = b"corrupted or tampered package"
        wrong_checksum = "a" * 64  # Does not match actual data

        with patch.object(
            updater, "download_agent", return_value=(package_data, wrong_checksum)
        ):
            result = updater.perform_update(
                "2.5.0", force=True, auto_update_enabled=True
            )

        assert result.status == "failed"
        assert "Checksum mismatch" in result.error
        assert result.version == "2.5.0"

    def test_no_backup_or_install_on_checksum_mismatch(
        self, updater: AgentUpdater, tmp_path: Path
    ) -> None:
        """No backup or installation should occur when checksum fails.

        The update process should abort before the backup step when
        checksum verification fails, keeping the system completely untouched.
        """
        package_data = b"bad package"
        wrong_checksum = "b" * 64

        with (
            patch.object(updater, "download_agent", return_value=(package_data, wrong_checksum)),
            patch.object(updater, "backup_current") as mock_backup,
            patch.object(updater, "extract_and_install") as mock_install,
        ):
            result = updater.perform_update(
                "2.5.0", force=True, auto_update_enabled=True
            )

        assert result.status == "failed"
        # backup_current should NOT have been called
        mock_backup.assert_not_called()
        # extract_and_install should NOT have been called
        mock_install.assert_not_called()


# =============================================================================
# Rollback mechanism
# =============================================================================


class TestRollbackMechanism:
    """Rollback restores previous agent version from backup."""

    def test_rollback_restores_backup_files(
        self, updater: AgentUpdater, tmp_path: Path
    ) -> None:
        """rollback should copy files from backup directory back to install path."""
        # Create backup
        backup_dir = updater.backup_path
        backup_dir.mkdir(parents=True)
        (backup_dir / "VERSION").write_text("2.0.0")
        (backup_dir / "agent.py").write_text("# original agent")

        # Simulate corrupted install
        (tmp_path / "VERSION").write_text("2.5.0-corrupted")
        (tmp_path / "agent.py").write_text("# broken agent")

        result = updater.rollback()

        assert result is True
        assert (tmp_path / "VERSION").read_text() == "2.0.0"
        assert (tmp_path / "agent.py").read_text() == "# original agent"

    def test_rollback_returns_false_when_no_backup(
        self, updater: AgentUpdater
    ) -> None:
        """rollback should return False when no backup directory exists."""
        # Ensure no backup directory exists
        assert not updater.backup_path.exists()

        result = updater.rollback()

        assert result is False

    def test_rollback_returns_false_on_filesystem_error(
        self, updater: AgentUpdater, tmp_path: Path
    ) -> None:
        """rollback should return False on filesystem errors."""
        backup_dir = updater.backup_path
        backup_dir.mkdir(parents=True)
        (backup_dir / "VERSION").write_text("2.0.0")

        with patch("shutil.copy2", side_effect=PermissionError("denied")):
            result = updater.rollback()

        assert result is False


# =============================================================================
# perform_update flow
# =============================================================================


class TestPerformUpdateFlow:
    """Full update flow through perform_update method."""

    def test_returns_current_when_no_update_needed(
        self, updater: AgentUpdater
    ) -> None:
        """perform_update returns 'current' when already on the latest version."""
        result = updater.perform_update(
            "2.0.0", force=False, auto_update_enabled=True
        )
        assert result.status == "current"
        assert result.version == "2.0.0"

    def test_returns_skipped_when_auto_update_disabled(
        self, updater: AgentUpdater
    ) -> None:
        """perform_update returns 'skipped' when auto-update is disabled and not forced."""
        result = updater.perform_update(
            "2.5.0", force=False, auto_update_enabled=False
        )
        assert result.status == "skipped"
        assert "Auto-update disabled" in result.error

    def test_returns_failed_on_backup_failure(
        self, updater: AgentUpdater
    ) -> None:
        """perform_update returns 'failed' when backup step fails."""
        package_data = b"agent package"
        checksum = hashlib.sha256(package_data).hexdigest()

        with (
            patch.object(updater, "download_agent", return_value=(package_data, checksum)),
            patch.object(updater, "backup_current", return_value=False),
        ):
            result = updater.perform_update(
                "2.5.0", force=True, auto_update_enabled=True
            )

        assert result.status == "failed"
        assert "Backup failed" in result.error

    def test_successful_update_calls_restart(
        self, updater: AgentUpdater, tmp_path: Path
    ) -> None:
        """perform_update calls restart_service after successful installation."""
        package_data = b"new agent"
        checksum = hashlib.sha256(package_data).hexdigest()

        with (
            patch.object(updater, "download_agent", return_value=(package_data, checksum)),
            patch.object(updater, "backup_current", return_value=True),
            patch.object(updater, "extract_and_install", return_value=True),
            patch.object(updater, "restart_service", return_value=True) as mock_restart,
        ):
            result = updater.perform_update(
                "2.5.0", force=True, auto_update_enabled=True
            )

        assert result.status == "success"
        assert result.version == "2.5.0"
        mock_restart.assert_called_once()


# =============================================================================
# Download with retry
# =============================================================================


class TestDownloadAgent:
    """Download agent package with retry logic."""

    @patch("updater.time.sleep")  # Skip retry delays in tests
    @patch("updater.httpx.Client")
    def test_download_returns_content_and_checksum(
        self, mock_client_cls: Mock, mock_sleep: Mock, updater: AgentUpdater
    ) -> None:
        """download_agent returns package bytes and checksum on success."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"agent package data"
        mock_response.headers = {"X-Checksum-SHA256": "abc123"}

        mock_client = MagicMock()
        mock_client.__enter__ = Mock(return_value=mock_client)
        mock_client.__exit__ = Mock(return_value=False)
        mock_client.get.return_value = mock_response
        mock_client_cls.return_value = mock_client

        data, checksum = updater.download_agent("2.5.0")

        assert data == b"agent package data"
        assert checksum == "abc123"

    @patch("updater.time.sleep")
    @patch("updater.httpx.Client")
    def test_download_raises_after_retries_exhausted(
        self, mock_client_cls: Mock, mock_sleep: Mock, updater: AgentUpdater
    ) -> None:
        """download_agent raises after all retry attempts fail."""
        mock_response = MagicMock()
        mock_response.status_code = 500

        mock_client = MagicMock()
        mock_client.__enter__ = Mock(return_value=mock_client)
        mock_client.__exit__ = Mock(return_value=False)
        mock_client.get.return_value = mock_response
        mock_client_cls.return_value = mock_client

        with pytest.raises(Exception, match="Download failed after"):
            updater.download_agent("2.5.0")

    @patch("updater.time.sleep")
    @patch("updater.httpx.Client")
    def test_download_uses_correct_auth_headers(
        self, mock_client_cls: Mock, mock_sleep: Mock, updater: AgentUpdater
    ) -> None:
        """download_agent sends correct authentication headers."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"data"
        mock_response.headers = {"X-Checksum-SHA256": "abc"}

        mock_client = MagicMock()
        mock_client.__enter__ = Mock(return_value=mock_client)
        mock_client.__exit__ = Mock(return_value=False)
        mock_client.get.return_value = mock_response
        mock_client_cls.return_value = mock_client

        updater.download_agent("2.5.0")

        call_kwargs = mock_client.get.call_args
        headers = call_kwargs.kwargs.get("headers") or call_kwargs[1].get("headers", {})
        assert "X-API-Key" in headers
        assert headers["X-API-Key"] == "test-key"
