"""Tests for command execution audit service.

Part of EP0013: Synchronous Command Execution - US0155 Command Execution Audit Trail.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from homelab_cmd.services.audit_service import (
    MAX_OUTPUT_SIZE,
    TRUNCATION_MARKER,
    cleanup_old_audit_entries,
    create_audit_log,
    list_audit_logs,
    truncate_output,
)


class TestTruncateOutput:
    """Tests for the truncate_output helper function (TC03, TC04)."""

    def test_none_input_returns_none(self):
        """Test that None input returns None."""
        result = truncate_output(None)
        assert result is None

    def test_short_output_unchanged(self):
        """Test that output under limit is unchanged."""
        short_text = "This is a short output"
        result = truncate_output(short_text)
        assert result == short_text

    def test_exactly_at_limit_unchanged(self):
        """Test that output exactly at limit is unchanged."""
        # Create output exactly at max size
        text = "x" * MAX_OUTPUT_SIZE
        result = truncate_output(text)
        assert result == text

    def test_output_over_limit_truncated(self):
        """Test that output over limit is truncated with marker."""
        # Create output 15KB (over 10KB limit)
        large_text = "x" * 15360
        result = truncate_output(large_text)

        assert result is not None
        assert len(result.encode("utf-8")) <= MAX_OUTPUT_SIZE
        assert result.endswith(TRUNCATION_MARKER)

    def test_truncation_preserves_content_start(self):
        """Test that truncation preserves the beginning of the content."""
        # Create output with identifiable start
        large_text = "START_MARKER" + "x" * 15000
        result = truncate_output(large_text)

        assert result is not None
        assert result.startswith("START_MARKER")

    def test_multibyte_characters_handled(self):
        """Test that multi-byte UTF-8 characters don't cause errors."""
        # Create output with multi-byte characters (emoji, etc)
        large_text = "\U0001F600" * 5000  # Grinning face emoji (4 bytes each)
        result = truncate_output(large_text)

        assert result is not None
        assert len(result.encode("utf-8")) <= MAX_OUTPUT_SIZE
        # Should be valid UTF-8
        result.encode("utf-8")


class TestCreateAuditLog:
    """Tests for the create_audit_log function (TC01, TC02)."""

    @pytest.fixture
    def mock_session(self):
        """Create a mock database session."""
        session = MagicMock()
        session.add = MagicMock()
        session.commit = AsyncMock()
        session.refresh = AsyncMock()
        return session

    @pytest.mark.asyncio
    async def test_creates_entry_for_successful_command(self, mock_session):
        """TC01: Audit entry created for successful command."""
        _result = await create_audit_log(
            db=mock_session,
            server_id="test-server",
            command="systemctl restart nginx",
            action_type="restart_service",
            exit_code=0,
            stdout="Service restarted successfully",
            stderr="",
            duration_ms=1234,
            executed_by="dashboard",
        )

        # Verify session operations
        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()
        mock_session.refresh.assert_called_once()

        # Check the entry passed to add
        added_entry = mock_session.add.call_args[0][0]
        assert added_entry.server_id == "test-server"
        assert added_entry.command == "systemctl restart nginx"
        assert added_entry.action_type == "restart_service"
        assert added_entry.exit_code == 0
        assert added_entry.stdout == "Service restarted successfully"
        assert added_entry.duration_ms == 1234
        assert added_entry.executed_by == "dashboard"

    @pytest.mark.asyncio
    async def test_creates_entry_for_failed_command(self, mock_session):
        """TC02: Audit entry created for failed command."""
        _result = await create_audit_log(
            db=mock_session,
            server_id="test-server",
            command="systemctl restart invalid",
            action_type="restart_service",
            exit_code=1,
            stdout="",
            stderr="Unit invalid.service not found",
            duration_ms=523,
            executed_by="dashboard",
        )

        # Verify entry was created even for failure
        mock_session.add.assert_called_once()
        added_entry = mock_session.add.call_args[0][0]
        assert added_entry.exit_code == 1
        assert added_entry.stderr == "Unit invalid.service not found"

    @pytest.mark.asyncio
    async def test_truncates_large_stdout(self, mock_session):
        """TC03: stdout truncated at 10KB."""
        large_stdout = "x" * 15360  # 15KB

        await create_audit_log(
            db=mock_session,
            server_id="test-server",
            command="cat large_file",
            action_type="custom",
            exit_code=0,
            stdout=large_stdout,
            stderr="",
            duration_ms=100,
        )

        added_entry = mock_session.add.call_args[0][0]
        assert len(added_entry.stdout.encode("utf-8")) <= MAX_OUTPUT_SIZE
        assert added_entry.stdout.endswith(TRUNCATION_MARKER)

    @pytest.mark.asyncio
    async def test_truncates_large_stderr(self, mock_session):
        """TC04: stderr truncated at 10KB."""
        large_stderr = "Error: " + "x" * 15360  # 15KB+

        await create_audit_log(
            db=mock_session,
            server_id="test-server",
            command="failing_command",
            action_type="custom",
            exit_code=1,
            stdout="",
            stderr=large_stderr,
            duration_ms=100,
        )

        added_entry = mock_session.add.call_args[0][0]
        assert len(added_entry.stderr.encode("utf-8")) <= MAX_OUTPUT_SIZE
        assert added_entry.stderr.endswith(TRUNCATION_MARKER)

    @pytest.mark.asyncio
    async def test_executed_at_is_set(self, mock_session):
        """Test that executed_at timestamp is set automatically."""
        before = datetime.now(UTC)

        await create_audit_log(
            db=mock_session,
            server_id="test-server",
            command="echo test",
            action_type="custom",
        )

        after = datetime.now(UTC)
        added_entry = mock_session.add.call_args[0][0]

        assert before <= added_entry.executed_at <= after

    @pytest.mark.asyncio
    async def test_default_executed_by(self, mock_session):
        """Test that executed_by defaults to 'dashboard'."""
        await create_audit_log(
            db=mock_session,
            server_id="test-server",
            command="echo test",
            action_type="custom",
        )

        added_entry = mock_session.add.call_args[0][0]
        assert added_entry.executed_by == "dashboard"


class TestListAuditLogs:
    """Tests for the list_audit_logs function (TC05-TC11)."""

    @pytest.fixture
    def mock_session_with_entries(self):
        """Create a mock session that returns mock entries."""
        session = MagicMock()

        # Mock for the main query
        mock_entries = [MagicMock(id=i) for i in range(100)]

        # Create mock result objects
        count_result = MagicMock()
        count_result.scalar.return_value = 150  # Total entries

        entries_result = MagicMock()
        entries_result.scalars.return_value.all.return_value = mock_entries

        # Make execute return appropriate results based on query
        session.execute = AsyncMock(side_effect=[count_result, entries_result])

        return session

    @pytest.mark.asyncio
    async def test_returns_paginated_results(self, mock_session_with_entries):
        """TC05: Returns paginated results with total count."""
        entries, total = await list_audit_logs(
            db=mock_session_with_entries,
            page=1,
            page_size=100,
        )

        assert len(entries) == 100
        assert total == 150

    @pytest.mark.asyncio
    async def test_empty_filters_returns_recent(self):
        """TC07: No filters applied returns most recent entries."""
        session = MagicMock()

        # Setup mock
        count_result = MagicMock()
        count_result.scalar.return_value = 50

        entries_result = MagicMock()
        entries_result.scalars.return_value.all.return_value = []

        session.execute = AsyncMock(side_effect=[count_result, entries_result])

        entries, total = await list_audit_logs(db=session)

        # Should not error with no filters
        assert isinstance(entries, list)
        assert total == 50


class TestCleanupOldAuditEntries:
    """Tests for the cleanup_old_audit_entries function (TC14, TC15)."""

    @pytest.fixture
    def mock_session(self):
        """Create a mock session for cleanup tests."""
        session = MagicMock()
        mock_result = MagicMock()
        mock_result.rowcount = 5
        session.execute = AsyncMock(return_value=mock_result)
        session.commit = AsyncMock()
        return session

    @pytest.mark.asyncio
    async def test_cleanup_deletes_old_entries(self, mock_session):
        """TC14: Retention cleanup removes old entries."""
        deleted = await cleanup_old_audit_entries(
            db=mock_session,
            retention_days=90,
        )

        assert deleted == 5
        mock_session.execute.assert_called_once()
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_cleanup_respects_custom_retention(self, mock_session):
        """TC15: Retention cleanup respects configuration."""
        await cleanup_old_audit_entries(
            db=mock_session,
            retention_days=30,
        )

        # Verify the delete was called (actual SQL checked in integration tests)
        mock_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_cleanup_returns_zero_when_nothing_deleted(self):
        """Test cleanup returns 0 when no entries are old enough."""
        session = MagicMock()
        mock_result = MagicMock()
        mock_result.rowcount = 0
        session.execute = AsyncMock(return_value=mock_result)
        session.commit = AsyncMock()

        deleted = await cleanup_old_audit_entries(
            db=session,
            retention_days=90,
        )

        assert deleted == 0
