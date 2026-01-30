"""Pydantic schemas for configuration compliance checking API.

Part of EP0010: Configuration Management - US0117 Configuration Compliance Checker.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ConfigCheckRequest(BaseModel):
    """Request schema for triggering a configuration compliance check."""

    pack_name: str = Field(..., description="Name of the configuration pack to check against")


class MismatchExpected(BaseModel):
    """Expected state for a configuration item."""

    exists: bool | None = Field(None, description="Whether file should exist")
    mode: str | None = Field(None, description="Expected file permissions (octal)")
    hash: str | None = Field(None, description="Expected content hash (sha256)")
    installed: bool | None = Field(None, description="Whether package should be installed")
    min_version: str | None = Field(None, description="Minimum required version")
    value: str | None = Field(None, description="Expected setting value")


class MismatchActual(BaseModel):
    """Actual state found on the server."""

    exists: bool | None = Field(None, description="Whether file exists")
    mode: str | None = Field(None, description="Actual file permissions (octal)")
    hash: str | None = Field(None, description="Actual content hash (sha256)")
    installed: bool | None = Field(None, description="Whether package is installed")
    version: str | None = Field(None, description="Installed package version")
    value: str | None = Field(None, description="Actual setting value")


MismatchType = Literal[
    "missing_file",
    "wrong_permissions",
    "wrong_content",
    "missing_package",
    "wrong_version",
    "wrong_setting",
]


class MismatchItem(BaseModel):
    """A single compliance mismatch between expected and actual state."""

    type: MismatchType = Field(..., description="Type of mismatch detected")
    item: str = Field(..., description="Item identifier (file path, package name, or setting key)")
    expected: MismatchExpected = Field(..., description="Expected state")
    actual: MismatchActual = Field(..., description="Actual state found")


class ConfigCheckResponse(BaseModel):
    """Response schema for a configuration compliance check result."""

    server_id: str = Field(..., description="Server identifier")
    pack_name: str = Field(..., description="Configuration pack that was checked")
    is_compliant: bool = Field(..., description="True if all checks passed")
    mismatches: list[MismatchItem] = Field(
        default_factory=list, description="List of compliance mismatches found"
    )
    checked_at: datetime = Field(..., description="Timestamp when check was performed")
    check_duration_ms: int = Field(..., description="Duration of check in milliseconds")


class ConfigCheckHistoryItem(BaseModel):
    """Summary of a past compliance check for history listings."""

    id: int = Field(..., description="Check record ID")
    pack_name: str = Field(..., description="Configuration pack checked")
    is_compliant: bool = Field(..., description="Whether server was compliant")
    mismatch_count: int = Field(..., description="Number of mismatches found")
    checked_at: datetime = Field(..., description="When check was performed")
    check_duration_ms: int = Field(..., description="Duration of check in milliseconds")


class ConfigCheckHistoryResponse(BaseModel):
    """Response for listing compliance check history."""

    server_id: str = Field(..., description="Server identifier")
    checks: list[ConfigCheckHistoryItem] = Field(
        default_factory=list, description="List of past checks"
    )
    total: int = Field(..., description="Total number of checks")


# US0118: Configuration Diff View schemas


class DiffSummary(BaseModel):
    """Summary statistics for configuration diff."""

    total_items: int = Field(..., description="Total configuration items checked")
    compliant: int = Field(..., description="Number of compliant items")
    mismatched: int = Field(..., description="Number of mismatched items")


MismatchCategory = Literal["files", "packages", "settings"]


class DiffMismatchItem(BaseModel):
    """Enhanced mismatch item with diff content for display."""

    type: MismatchType = Field(..., description="Type of mismatch detected")
    category: MismatchCategory = Field(..., description="Mismatch category")
    item: str = Field(..., description="Item identifier (file path, package name, or setting key)")
    expected: MismatchExpected = Field(..., description="Expected state")
    actual: MismatchActual = Field(..., description="Actual state found")
    diff: str | None = Field(None, description="Unified diff content for file mismatches")


class ConfigDiffResponse(BaseModel):
    """Response schema for configuration diff view.

    Part of EP0010: Configuration Management - US0118 Configuration Diff View.
    """

    server_id: str = Field(..., description="Server identifier")
    pack_name: str = Field(..., description="Configuration pack that was checked")
    is_compliant: bool = Field(..., description="True if all checks passed")
    summary: DiffSummary = Field(..., description="Summary statistics")
    mismatches: list[DiffMismatchItem] = Field(
        default_factory=list, description="List of mismatches with diff content"
    )
    checked_at: datetime = Field(..., description="Timestamp when check was performed")


# US0120: Compliance Dashboard Widget schemas

ComplianceStatus = Literal["compliant", "non_compliant", "never_checked"]


class ComplianceMachineSummary(BaseModel):
    """Per-machine compliance status for the dashboard widget."""

    id: str = Field(..., description="Server identifier (slug)")
    display_name: str = Field(..., description="Display name for UI")
    status: ComplianceStatus = Field(..., description="Compliance status")
    pack: str | None = Field(None, description="Pack name if checked")
    mismatch_count: int | None = Field(None, description="Number of mismatches if non-compliant")
    checked_at: datetime | None = Field(None, description="When last checked")


class ComplianceSummaryStats(BaseModel):
    """Summary counts for compliance dashboard."""

    compliant: int = Field(..., description="Number of compliant machines")
    non_compliant: int = Field(..., description="Number of non-compliant machines")
    never_checked: int = Field(..., description="Number of never-checked machines")
    total: int = Field(..., description="Total number of machines")


class ComplianceSummaryResponse(BaseModel):
    """Response schema for fleet-wide compliance summary.

    Part of EP0010: Configuration Management - US0120 Compliance Dashboard Widget.
    """

    summary: ComplianceSummaryStats = Field(..., description="Summary counts")
    machines: list[ComplianceMachineSummary] = Field(
        default_factory=list, description="Per-machine compliance status"
    )
