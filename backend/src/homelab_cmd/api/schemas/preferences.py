"""Schemas for dashboard preferences API."""

from datetime import datetime

from pydantic import BaseModel, Field


class CardOrderRequest(BaseModel):
    """Request schema for saving card order."""

    order: list[str] = Field(
        ...,
        description="Ordered list of server IDs",
        examples=[["server-1", "server-2", "server-3"]],
    )


class CardOrderSaveResponse(BaseModel):
    """Response schema for save operation."""

    status: str = Field(default="saved", description="Operation status")
    timestamp: datetime = Field(..., description="Save timestamp")


class CardOrderLoadResponse(BaseModel):
    """Response schema for load operation."""

    order: list[str] = Field(
        default_factory=list,
        description="Ordered list of server IDs (empty if none saved)",
    )


# US0132: Section-specific card order schemas


class SectionCardOrderRequest(BaseModel):
    """Request schema for saving section-specific card orders."""

    servers: list[str] = Field(
        default_factory=list,
        description="Ordered list of server IDs",
        examples=[["server-1", "server-2"]],
    )
    workstations: list[str] = Field(
        default_factory=list,
        description="Ordered list of workstation IDs",
        examples=[["workstation-1"]],
    )


class SectionCardOrderResponse(BaseModel):
    """Response schema for section card orders."""

    servers: list[str] = Field(default_factory=list)
    workstations: list[str] = Field(default_factory=list)


class CollapsedSectionsRequest(BaseModel):
    """Request schema for saving collapsed section state."""

    collapsed: list[str] = Field(
        default_factory=list,
        description="List of collapsed section names",
        examples=[["workstations"]],
    )


class CollapsedSectionsResponse(BaseModel):
    """Response schema for collapsed sections."""

    collapsed: list[str] = Field(default_factory=list)


# US0136: Unified dashboard preferences schemas


class CardOrder(BaseModel):
    """Card order by section type."""

    servers: list[str] = Field(
        default_factory=list,
        description="Ordered list of server GUIDs",
    )
    workstations: list[str] = Field(
        default_factory=list,
        description="Ordered list of workstation GUIDs",
    )


class DashboardPreferencesRequest(BaseModel):
    """Request schema for unified dashboard preferences."""

    card_order: CardOrder = Field(
        default_factory=CardOrder,
        description="Card ordering per section",
    )
    collapsed_sections: list[str] = Field(
        default_factory=list,
        description="List of collapsed section names",
        examples=[["workstations"]],
    )
    view_mode: str = Field(
        default="grid",
        description="Dashboard view mode",
        examples=["grid"],
    )


class DashboardPreferencesResponse(BaseModel):
    """Response schema for unified dashboard preferences."""

    card_order: CardOrder = Field(default_factory=CardOrder)
    collapsed_sections: list[str] = Field(default_factory=list)
    view_mode: str = Field(default="grid")
    updated_at: datetime | None = Field(
        default=None,
        description="Last update timestamp (null if never saved)",
    )


class DashboardPreferencesSaveResponse(BaseModel):
    """Response schema for save operation."""

    status: str = Field(default="saved", description="Operation status")
    updated_at: datetime = Field(..., description="Save timestamp")
