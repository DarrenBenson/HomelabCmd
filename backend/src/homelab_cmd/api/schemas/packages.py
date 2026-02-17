"""Package status API schemas.

Part of US0198: Package Held Back Status Indicator.

Provides schemas for the enhanced package status API that distinguishes
between upgradable and held-back packages.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class PackageInfoResponse(BaseModel):
    """Schema for a single package with status information.

    Attributes:
        name: Package name.
        current_version: Currently installed version.
        candidate_version: Available upgrade version.
        status: Whether package is upgradable or held_back.
        hold_reason: Reason for being held back (phased, dependency, manual).
        phased_percentage: Rollout percentage for phased updates.
        repository: Source repository name.
        is_security: Whether from a security repository.
    """

    name: str = Field(
        ...,
        description="Package name",
        json_schema_extra={"example": "firefox"},
    )
    current_version: str = Field(
        ...,
        description="Currently installed version",
        json_schema_extra={"example": "120.0-1"},
    )
    candidate_version: str = Field(
        ...,
        description="Available upgrade version",
        json_schema_extra={"example": "121.0-1"},
    )
    status: Literal["upgradable", "held_back"] = Field(
        ...,
        description="Package status: upgradable (will install) or held_back (will not install)",
        json_schema_extra={"example": "upgradable"},
    )
    hold_reason: Literal["phased", "dependency", "manual"] | None = Field(
        None,
        description="Reason package is held back: phased (rollout), dependency (conflict), or manual (apt-mark hold)",
        json_schema_extra={"example": "phased"},
    )
    phased_percentage: int | None = Field(
        None,
        ge=0,
        le=100,
        description="Phased rollout percentage (0-100) if hold_reason is 'phased'",
        json_schema_extra={"example": 45},
    )
    repository: str = Field(
        ...,
        description="Source repository name",
        json_schema_extra={"example": "jammy-updates"},
    )
    is_security: bool = Field(
        ...,
        description="True if from a security repository",
        json_schema_extra={"example": False},
    )


class PackageSummaryResponse(BaseModel):
    """Summary counts for package status.

    Attributes:
        upgradable_count: Number of packages that will install.
        held_back_count: Number of packages that will NOT install.
        security_count: Number of security updates.
    """

    upgradable_count: int = Field(
        ...,
        ge=0,
        description="Number of packages that will install when updates are applied",
        json_schema_extra={"example": 5},
    )
    held_back_count: int = Field(
        ...,
        ge=0,
        description="Number of packages that will NOT install (held back)",
        json_schema_extra={"example": 3},
    )
    security_count: int = Field(
        ...,
        ge=0,
        description="Number of security updates available",
        json_schema_extra={"example": 2},
    )


class PackageStatusResponse(BaseModel):
    """Full package status response for a server.

    Attributes:
        server_id: Server identifier.
        last_checked: Timestamp when package status was last checked.
        summary: Package count summary.
        packages: List of all packages with their status.
    """

    server_id: str = Field(
        ...,
        description="Server identifier",
        json_schema_extra={"example": "web-server-01"},
    )
    last_checked: datetime | None = Field(
        None,
        description="Timestamp when package status was last checked",
    )
    summary: PackageSummaryResponse = Field(
        ...,
        description="Package count summary",
    )
    packages: list[PackageInfoResponse] = Field(
        ...,
        description="List of all packages with their status",
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "server_id": "web-server-01",
                    "last_checked": "2026-01-31T12:00:00Z",
                    "summary": {
                        "upgradable_count": 5,
                        "held_back_count": 3,
                        "security_count": 2,
                    },
                    "packages": [
                        {
                            "name": "nginx",
                            "current_version": "1.24.0-1",
                            "candidate_version": "1.25.0-1",
                            "status": "upgradable",
                            "hold_reason": None,
                            "phased_percentage": None,
                            "repository": "jammy-updates",
                            "is_security": False,
                        },
                        {
                            "name": "firefox",
                            "current_version": "120.0-1",
                            "candidate_version": "121.0-1",
                            "status": "held_back",
                            "hold_reason": "phased",
                            "phased_percentage": 45,
                            "repository": "jammy-updates",
                            "is_security": False,
                        },
                    ],
                }
            ]
        }
    }
