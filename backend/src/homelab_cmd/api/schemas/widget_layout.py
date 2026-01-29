"""Schemas for widget layout API."""

from datetime import datetime

from pydantic import BaseModel, Field


class LayoutItem(BaseModel):
    """Single widget position in the grid layout."""

    i: str = Field(..., description="Widget identifier")
    x: int = Field(..., ge=0, description="X position in grid units")
    y: int = Field(..., ge=0, description="Y position in grid units")
    w: int = Field(..., ge=1, description="Width in grid units")
    h: int = Field(..., ge=1, description="Height in grid units")
    minW: int | None = Field(default=None, ge=1, description="Minimum width")
    minH: int | None = Field(default=None, ge=1, description="Minimum height")
    maxW: int | None = Field(default=None, ge=1, description="Maximum width")
    maxH: int | None = Field(default=None, ge=1, description="Maximum height")


class WidgetLayouts(BaseModel):
    """Layout configuration for all breakpoints."""

    lg: list[LayoutItem] = Field(
        default_factory=list,
        description="Layout for large screens (>=1200px)",
    )
    md: list[LayoutItem] = Field(
        default_factory=list,
        description="Layout for medium screens (>=996px)",
    )
    sm: list[LayoutItem] = Field(
        default_factory=list,
        description="Layout for small screens (>=768px)",
    )
    xs: list[LayoutItem] = Field(
        default_factory=list,
        description="Layout for extra small screens (<768px)",
    )


class WidgetLayoutRequest(BaseModel):
    """Request schema for saving widget layout."""

    layouts: WidgetLayouts = Field(..., description="Layout configuration")


class WidgetLayoutResponse(BaseModel):
    """Response schema for widget layout."""

    layouts: WidgetLayouts | None = Field(
        default=None,
        description="Layout configuration (null if no custom layout saved)",
    )
    updated_at: datetime | None = Field(
        default=None,
        description="Last update timestamp (null if using default)",
    )


class WidgetLayoutSaveResponse(BaseModel):
    """Response schema for layout save operation."""

    status: str = Field(default="saved", description="Operation status")
    updated_at: datetime = Field(..., description="Save timestamp")


class WidgetLayoutDeleteResponse(BaseModel):
    """Response schema for layout reset/delete operation."""

    status: str = Field(default="deleted", description="Operation status")
