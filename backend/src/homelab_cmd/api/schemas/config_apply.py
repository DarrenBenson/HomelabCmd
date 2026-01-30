"""Pydantic schemas for configuration pack application and removal API.

Part of EP0010: Configuration Management:
- US0119: Apply Configuration Pack
- US0123: Remove Configuration Pack
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

# Request schemas


class ApplyRequest(BaseModel):
    """Request schema for applying a configuration pack."""

    pack_name: str = Field(..., description="Name of the configuration pack to apply")
    dry_run: bool = Field(
        default=False, description="If true, preview changes without applying"
    )


# Dry-run preview item schemas


class DryRunFileItem(BaseModel):
    """Preview item for file creation/update."""

    action: Literal["create_file", "update_file"] = Field(
        ..., description="Action to take"
    )
    path: str = Field(..., description="File path to create/update")
    mode: str = Field(..., description="File permissions (octal)")
    description: str = Field(..., description="Human-readable description")


class DryRunPackageItem(BaseModel):
    """Preview item for package installation."""

    action: Literal["install_package", "upgrade_package"] = Field(
        ..., description="Action to take"
    )
    package: str = Field(..., description="Package name")
    version: str | None = Field(None, description="Target version (if specified)")
    description: str = Field(..., description="Human-readable description")


class DryRunSettingItem(BaseModel):
    """Preview item for setting change."""

    action: Literal["set_env_var", "set_config"] = Field(
        ..., description="Action to take"
    )
    key: str = Field(..., description="Setting key")
    value: str = Field(..., description="Value to set")
    description: str = Field(..., description="Human-readable description")


# Result item schema


class ApplyItemResult(BaseModel):
    """Result of applying a single configuration item."""

    item: str = Field(..., description="Item identifier (path, package name, or key)")
    action: str = Field(..., description="Action taken (created, installed, set, etc.)")
    success: bool = Field(..., description="Whether the action succeeded")
    error: str | None = Field(None, description="Error message if failed")


# Response schemas


ApplyStatus = Literal["pending", "running", "completed", "failed"]


class ApplyPreviewResponse(BaseModel):
    """Response for dry-run preview of configuration application.

    Part of US0119: AC2 - Dry-Run Option.
    """

    server_id: str = Field(..., description="Server identifier")
    pack_name: str = Field(..., description="Configuration pack name")
    dry_run: bool = Field(default=True, description="Always true for preview")
    files: list[DryRunFileItem] = Field(
        default_factory=list, description="Files to create/update"
    )
    packages: list[DryRunPackageItem] = Field(
        default_factory=list, description="Packages to install"
    )
    settings: list[DryRunSettingItem] = Field(
        default_factory=list, description="Settings to change"
    )
    total_items: int = Field(..., description="Total number of items to apply")


class ApplyInitiatedResponse(BaseModel):
    """Response when apply operation is initiated.

    Part of US0119: AC1 - Apply Endpoint.
    """

    apply_id: int = Field(..., description="Apply operation ID for status polling")
    server_id: str = Field(..., description="Server identifier")
    pack_name: str = Field(..., description="Configuration pack name")
    status: ApplyStatus = Field(..., description="Current status (pending/running)")
    started_at: datetime | None = Field(None, description="When apply started")


class ApplyStatusResponse(BaseModel):
    """Response for apply operation status and progress.

    Part of US0119: AC5 - Progress Tracking, AC6 - Result Details.
    """

    apply_id: int = Field(..., description="Apply operation ID")
    server_id: str = Field(..., description="Server identifier")
    pack_name: str = Field(..., description="Configuration pack name")
    status: ApplyStatus = Field(..., description="Current status")
    progress: int = Field(default=0, description="Progress percentage (0-100)")
    current_item: str | None = Field(None, description="Item currently being processed")
    items_total: int = Field(default=0, description="Total number of items")
    items_completed: int = Field(default=0, description="Number of completed items")
    items_failed: int = Field(default=0, description="Number of failed items")
    items: list[ApplyItemResult] = Field(
        default_factory=list, description="Per-item results"
    )
    started_at: datetime | None = Field(None, description="When apply started")
    completed_at: datetime | None = Field(None, description="When apply completed")
    error: str | None = Field(None, description="Overall error message if failed")


class ApplyResultResponse(BaseModel):
    """Response for completed apply operation.

    Part of US0119: AC6 - Result Details.
    """

    apply_id: int = Field(..., description="Apply operation ID")
    server_id: str = Field(..., description="Server identifier")
    pack_name: str = Field(..., description="Configuration pack name")
    success: bool = Field(..., description="Whether all items succeeded")
    items: list[ApplyItemResult] = Field(..., description="Per-item results")
    items_total: int = Field(..., description="Total number of items")
    items_succeeded: int = Field(..., description="Number of successful items")
    items_failed: int = Field(..., description="Number of failed items")
    started_at: datetime = Field(..., description="When apply started")
    completed_at: datetime = Field(..., description="When apply completed")
    duration_ms: int = Field(..., description="Total duration in milliseconds")


# US0123: Remove Configuration Pack Schemas


class RemoveRequest(BaseModel):
    """Request schema for removing a configuration pack.

    Part of US0123: AC1 - Remove Endpoint, AC5 - Confirmation Required.
    """

    pack_name: str = Field(..., description="Name of the configuration pack to remove")
    confirm: bool = Field(
        default=False,
        description="If false, return preview only. If true, execute removal.",
    )


class RemovePreviewFileItem(BaseModel):
    """Preview item for file deletion.

    Part of US0123: AC2 - File Removal.
    """

    action: Literal["delete"] = Field(default="delete", description="Action to take")
    path: str = Field(..., description="File path to delete")
    backup_path: str = Field(..., description="Backup path (.homelabcmd.bak)")
    note: str = Field(..., description="Human-readable note about the action")


class RemovePreviewPackageItem(BaseModel):
    """Preview item for package (always skipped).

    Part of US0123: AC3 - Package Preservation.
    """

    action: Literal["skip"] = Field(default="skip", description="Action (always skip)")
    package: str = Field(..., description="Package name")
    note: str = Field(
        default="Package will remain installed - may break dependencies",
        description="Explanation of why packages are not removed",
    )


class RemovePreviewSettingItem(BaseModel):
    """Preview item for setting removal.

    Part of US0123: AC4 - Settings Cleanup.
    """

    action: Literal["remove"] = Field(default="remove", description="Action to take")
    key: str = Field(..., description="Setting key to remove")
    note: str = Field(..., description="Human-readable note about the action")


class RemovePreviewResponse(BaseModel):
    """Response for dry-run preview of configuration removal.

    Part of US0123: AC5 - Confirmation Required.
    """

    server_id: str = Field(..., description="Server identifier")
    pack_name: str = Field(..., description="Configuration pack name")
    preview: bool = Field(default=True, description="Always true for preview")
    files: list[RemovePreviewFileItem] = Field(
        default_factory=list, description="Files to delete"
    )
    packages: list[RemovePreviewPackageItem] = Field(
        default_factory=list, description="Packages to skip (not removed)"
    )
    settings: list[RemovePreviewSettingItem] = Field(
        default_factory=list, description="Settings to remove"
    )
    total_items: int = Field(..., description="Total number of items in preview")
    warning: str = Field(
        default="Files will be deleted. Packages will remain installed.",
        description="Warning message for confirmation",
    )


class RemoveItemResult(BaseModel):
    """Result of removing a single configuration item.

    Part of US0123: AC6 - Result Details.
    """

    item: str = Field(..., description="Item identifier (path, package name, or key)")
    item_type: Literal["file", "package", "setting"] = Field(
        ..., description="Type of item"
    )
    action: Literal["deleted", "skipped", "removed", "failed"] = Field(
        ..., description="Action taken"
    )
    success: bool = Field(..., description="Whether the action succeeded")
    backup_path: str | None = Field(None, description="Backup path for files")
    note: str | None = Field(None, description="Additional information")
    error: str | None = Field(None, description="Error message if failed")


class RemoveResponse(BaseModel):
    """Response for completed remove operation.

    Part of US0123: AC1 - Remove Endpoint.
    """

    server_id: str = Field(..., description="Server identifier")
    pack_name: str = Field(..., description="Configuration pack name")
    success: bool = Field(..., description="Whether all removable items succeeded")
    items: list[RemoveItemResult] = Field(..., description="Per-item results")
    items_deleted: int = Field(..., description="Number of files deleted")
    items_skipped: int = Field(..., description="Number of packages skipped")
    items_removed: int = Field(..., description="Number of settings removed")
    items_failed: int = Field(..., description="Number of failed items")
    removed_at: datetime = Field(..., description="When removal completed")
