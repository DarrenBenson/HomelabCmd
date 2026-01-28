"""Tests for Extended Remediation Action Schema (TSP0009: TC149-TC151).

These tests verify the RemediationAction model extensions for US0023.

Spec Reference: sdlc-studio/testing/specs/TSP0009-remediation-engine.md
"""

from sqlalchemy import inspect

from homelab_cmd.db.models.remediation import ActionStatus, RemediationAction


class TestActionStatusEnum:
    """TC149: ActionStatus enum has all required status values."""

    def test_pending_status_exists(self) -> None:
        """ActionStatus.PENDING exists and has correct value."""
        assert hasattr(ActionStatus, "PENDING")
        assert ActionStatus.PENDING.value == "pending"

    def test_approved_status_exists(self) -> None:
        """ActionStatus.APPROVED exists and has correct value."""
        assert hasattr(ActionStatus, "APPROVED")
        assert ActionStatus.APPROVED.value == "approved"

    def test_rejected_status_exists(self) -> None:
        """ActionStatus.REJECTED exists and has correct value."""
        assert hasattr(ActionStatus, "REJECTED")
        assert ActionStatus.REJECTED.value == "rejected"

    def test_executing_status_exists(self) -> None:
        """ActionStatus.EXECUTING exists and has correct value."""
        assert hasattr(ActionStatus, "EXECUTING")
        assert ActionStatus.EXECUTING.value == "executing"

    def test_completed_status_exists(self) -> None:
        """ActionStatus.COMPLETED exists and has correct value."""
        assert hasattr(ActionStatus, "COMPLETED")
        assert ActionStatus.COMPLETED.value == "completed"

    def test_failed_status_exists(self) -> None:
        """ActionStatus.FAILED exists and has correct value."""
        assert hasattr(ActionStatus, "FAILED")
        assert ActionStatus.FAILED.value == "failed"

    def test_all_statuses_count(self) -> None:
        """ActionStatus enum has exactly 6 values."""
        assert len(ActionStatus) == 6


class TestRemediationActionApprovalFields:
    """TC150: RemediationAction has approval tracking fields."""

    def test_approved_by_field_exists(self) -> None:
        """approved_by field exists in RemediationAction model."""
        mapper = inspect(RemediationAction)
        column_names = [col.key for col in mapper.columns]
        assert "approved_by" in column_names

    def test_approved_at_field_exists(self) -> None:
        """approved_at field exists in RemediationAction model."""
        mapper = inspect(RemediationAction)
        column_names = [col.key for col in mapper.columns]
        assert "approved_at" in column_names

    def test_rejected_by_field_exists(self) -> None:
        """rejected_by field exists in RemediationAction model."""
        mapper = inspect(RemediationAction)
        column_names = [col.key for col in mapper.columns]
        assert "rejected_by" in column_names

    def test_rejected_at_field_exists(self) -> None:
        """rejected_at field exists in RemediationAction model."""
        mapper = inspect(RemediationAction)
        column_names = [col.key for col in mapper.columns]
        assert "rejected_at" in column_names

    def test_rejection_reason_field_exists(self) -> None:
        """rejection_reason field exists in RemediationAction model."""
        mapper = inspect(RemediationAction)
        column_names = [col.key for col in mapper.columns]
        assert "rejection_reason" in column_names

    def test_approval_fields_are_nullable(self) -> None:
        """Approval fields are nullable."""
        mapper = inspect(RemediationAction)
        for col in mapper.columns:
            if col.key in (
                "approved_by",
                "approved_at",
                "rejected_by",
                "rejected_at",
                "rejection_reason",
            ):
                assert col.nullable is True, f"{col.key} should be nullable"


class TestRemediationActionExecutionFields:
    """TC151: RemediationAction has execution result fields."""

    def test_executed_at_field_exists(self) -> None:
        """executed_at field exists in RemediationAction model."""
        mapper = inspect(RemediationAction)
        column_names = [col.key for col in mapper.columns]
        assert "executed_at" in column_names

    def test_completed_at_field_exists(self) -> None:
        """completed_at field exists in RemediationAction model."""
        mapper = inspect(RemediationAction)
        column_names = [col.key for col in mapper.columns]
        assert "completed_at" in column_names

    def test_exit_code_field_exists(self) -> None:
        """exit_code field exists in RemediationAction model."""
        mapper = inspect(RemediationAction)
        column_names = [col.key for col in mapper.columns]
        assert "exit_code" in column_names

    def test_stdout_field_exists(self) -> None:
        """stdout field exists in RemediationAction model."""
        mapper = inspect(RemediationAction)
        column_names = [col.key for col in mapper.columns]
        assert "stdout" in column_names

    def test_stderr_field_exists(self) -> None:
        """stderr field exists in RemediationAction model."""
        mapper = inspect(RemediationAction)
        column_names = [col.key for col in mapper.columns]
        assert "stderr" in column_names

    def test_execution_fields_are_nullable(self) -> None:
        """Execution fields are nullable."""
        mapper = inspect(RemediationAction)
        for col in mapper.columns:
            if col.key in ("executed_at", "completed_at", "exit_code", "stdout", "stderr"):
                assert col.nullable is True, f"{col.key} should be nullable"


class TestRemediationActionAlertLink:
    """Additional tests for alert_id foreign key (AC7)."""

    def test_alert_id_field_exists(self) -> None:
        """alert_id field exists in RemediationAction model."""
        mapper = inspect(RemediationAction)
        column_names = [col.key for col in mapper.columns]
        assert "alert_id" in column_names

    def test_alert_id_is_nullable(self) -> None:
        """alert_id is nullable (actions can be created without an alert)."""
        mapper = inspect(RemediationAction)
        for col in mapper.columns:
            if col.key == "alert_id":
                assert col.nullable is True, "alert_id should be nullable"
