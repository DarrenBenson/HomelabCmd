"""Pydantic schemas for configuration pack API."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class FileItem(BaseModel):
    """Schema for a file item in a configuration pack."""

    path: str = Field(..., description="File path (may include ~ for home directory)")
    mode: str = Field(..., description="File permissions in octal format")
    template: str | None = Field(None, description="Template filename to use for content")
    content_hash: str | None = Field(
        None, description="Expected content hash (sha256:...)"
    )
    description: str | None = Field(None, description="Human-readable description")


class PackageItem(BaseModel):
    """Schema for a package item in a configuration pack."""

    name: str = Field(..., description="Package name")
    min_version: str | None = Field(None, description="Minimum required version")
    description: str | None = Field(None, description="Human-readable description")


class SettingItem(BaseModel):
    """Schema for a setting item in a configuration pack."""

    key: str = Field(..., description="Setting key (variable name)")
    expected: str = Field(..., description="Expected value")
    type: Literal["env_var", "config"] = Field(
        ..., description="Setting type (env_var or config)"
    )
    description: str | None = Field(None, description="Human-readable description")


class PackItems(BaseModel):
    """Schema for all items in a configuration pack."""

    files: list[FileItem] = Field(default_factory=list, description="File definitions")
    packages: list[PackageItem] = Field(
        default_factory=list, description="Package definitions"
    )
    settings: list[SettingItem] = Field(
        default_factory=list, description="Setting definitions"
    )


class ConfigPack(BaseModel):
    """Schema for a complete configuration pack definition."""

    name: str = Field(..., description="Pack display name")
    description: str = Field(..., description="Pack purpose and description")
    extends: str | None = Field(None, description="Parent pack name to extend")
    items: PackItems = Field(default_factory=PackItems, description="Pack items")


class ConfigPackMetadata(BaseModel):
    """Schema for configuration pack metadata (API response)."""

    name: str = Field(..., description="Pack identifier (filename without .yaml)")
    display_name: str = Field(..., description="Pack display name")
    description: str = Field(..., description="Pack purpose and description")
    item_count: int = Field(..., description="Total number of items in pack")
    extends: str | None = Field(None, description="Parent pack name")
    last_updated: datetime = Field(..., description="Last modification timestamp")


class ConfigPackListResponse(BaseModel):
    """Schema for the list packs API response."""

    packs: list[ConfigPackMetadata] = Field(
        ..., description="List of available configuration packs"
    )
    total: int = Field(..., description="Total number of packs")
