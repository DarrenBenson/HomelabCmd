"""Widget layout API endpoints.

Provides endpoints for managing per-machine widget layout preferences.
Uses the existing Config model for storage (no new table required).

US0173: Widget Layout Persistence
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.deps import verify_api_key
from homelab_cmd.api.responses import AUTH_RESPONSES, NOT_FOUND_RESPONSE
from homelab_cmd.api.schemas.widget_layout import (
    WidgetLayoutDeleteResponse,
    WidgetLayoutRequest,
    WidgetLayoutResponse,
    WidgetLayouts,
    WidgetLayoutSaveResponse,
)
from homelab_cmd.db.models.config import Config
from homelab_cmd.db.models.server import Server
from homelab_cmd.db.session import get_async_session

router = APIRouter(prefix="/machines", tags=["Widget Layout"])


def _get_layout_key(machine_id: str) -> str:
    """Generate config key for machine widget layout."""
    return f"widget_layout:{machine_id}"


async def _verify_machine_exists(session: AsyncSession, machine_id: str) -> None:
    """Verify that the machine exists, raise 404 if not."""
    result = await session.execute(select(Server).where(Server.id == machine_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail=f"Machine {machine_id} not found")


@router.get(
    "/{machine_id}/layout",
    response_model=WidgetLayoutResponse,
    operation_id="get_widget_layout",
    summary="Get widget layout for a machine",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE},
)
async def get_widget_layout(
    machine_id: str,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> WidgetLayoutResponse:
    """Get the saved widget layout for a machine.

    Returns the custom layout if one has been saved, otherwise returns null
    (frontend should use default layout).

    US0173 AC1: Load layout API
    US0173 AC3: Per-machine layouts
    """
    await _verify_machine_exists(session, machine_id)

    config_key = _get_layout_key(machine_id)
    result = await session.execute(select(Config).where(Config.key == config_key))
    config = result.scalar_one_or_none()

    if config and isinstance(config.value, dict):
        layouts_data = config.value.get("layouts", {})
        try:
            layouts = WidgetLayouts(
                lg=[dict(item) for item in layouts_data.get("lg", [])],
                md=[dict(item) for item in layouts_data.get("md", [])],
                sm=[dict(item) for item in layouts_data.get("sm", [])],
                xs=[dict(item) for item in layouts_data.get("xs", [])],
            )
            return WidgetLayoutResponse(layouts=layouts, updated_at=config.updated_at)
        except (ValueError, TypeError):
            # Corrupted layout data - return null (fallback to default)
            # US0173 Edge Case #3: Corrupted layout JSON
            return WidgetLayoutResponse(layouts=None, updated_at=None)

    return WidgetLayoutResponse(layouts=None, updated_at=None)


@router.put(
    "/{machine_id}/layout",
    response_model=WidgetLayoutSaveResponse,
    operation_id="save_widget_layout",
    summary="Save widget layout for a machine",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE},
)
async def save_widget_layout(
    machine_id: str,
    request: WidgetLayoutRequest,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> WidgetLayoutSaveResponse:
    """Save the widget layout for a machine.

    Stores the layout configuration in the database. Uses upsert pattern -
    creates if not exists, updates if exists.

    US0173 AC2: Save layout API
    US0173 AC3: Per-machine layouts
    US0173 AC4: Layout format (react-grid-layout JSON)
    """
    await _verify_machine_exists(session, machine_id)

    config_key = _get_layout_key(machine_id)
    result = await session.execute(select(Config).where(Config.key == config_key))
    config = result.scalar_one_or_none()

    now = datetime.now(UTC)

    # Convert to dict for JSON storage
    layouts_dict = {
        "lg": [item.model_dump(exclude_none=True) for item in request.layouts.lg],
        "md": [item.model_dump(exclude_none=True) for item in request.layouts.md],
        "sm": [item.model_dump(exclude_none=True) for item in request.layouts.sm],
        "xs": [item.model_dump(exclude_none=True) for item in request.layouts.xs],
    }

    if config:
        config.value = {"layouts": layouts_dict}
        config.updated_at = now
    else:
        config = Config(
            key=config_key,
            value={"layouts": layouts_dict},
            updated_at=now,
        )
        session.add(config)

    await session.flush()

    return WidgetLayoutSaveResponse(status="saved", updated_at=now)


@router.delete(
    "/{machine_id}/layout",
    response_model=WidgetLayoutDeleteResponse,
    operation_id="delete_widget_layout",
    summary="Reset widget layout to default",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE},
)
async def delete_widget_layout(
    machine_id: str,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> WidgetLayoutDeleteResponse:
    """Reset the widget layout for a machine to default.

    Deletes the saved layout so the frontend falls back to default layout.

    US0173 AC5: Reset to default
    """
    await _verify_machine_exists(session, machine_id)

    config_key = _get_layout_key(machine_id)
    result = await session.execute(select(Config).where(Config.key == config_key))
    config = result.scalar_one_or_none()

    if config:
        await session.delete(config)
        await session.flush()

    return WidgetLayoutDeleteResponse(status="deleted")
