"""Dashboard preferences API endpoints.

Provides endpoints for managing user dashboard preferences such as card order.
Uses the existing Config model for storage (no new table required).
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.deps import verify_api_key
from homelab_cmd.api.responses import AUTH_RESPONSES
from homelab_cmd.api.schemas.preferences import (
    CardOrder,
    CardOrderLoadResponse,
    CardOrderRequest,
    CardOrderSaveResponse,
    CollapsedSectionsRequest,
    CollapsedSectionsResponse,
    DashboardPreferencesRequest,
    DashboardPreferencesResponse,
    DashboardPreferencesSaveResponse,
    SectionCardOrderRequest,
    SectionCardOrderResponse,
)
from homelab_cmd.db.models.config import Config
from homelab_cmd.db.session import get_async_session

router = APIRouter(prefix="/preferences", tags=["Preferences"])

CONFIG_KEY_CARD_ORDER = "dashboard_card_order"
CONFIG_KEY_SECTION_ORDER = "dashboard_section_order"
CONFIG_KEY_COLLAPSED_SECTIONS = "dashboard_collapsed_sections"
CONFIG_KEY_DASHBOARD = "dashboard_preferences"  # US0136: Unified preferences


@router.put(
    "/card-order",
    response_model=CardOrderSaveResponse,
    operation_id="save_card_order",
    summary="Save dashboard card order",
    responses={**AUTH_RESPONSES},
)
async def save_card_order(
    request: CardOrderRequest,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> CardOrderSaveResponse:
    """Save the dashboard card order preference.

    Stores the ordered list of server IDs to persist card arrangement
    across page refreshes. Uses upsert pattern - creates if not exists,
    updates if exists.
    """
    result = await session.execute(
        select(Config).where(Config.key == CONFIG_KEY_CARD_ORDER)
    )
    config = result.scalar_one_or_none()

    now = datetime.now(UTC)

    if config:
        config.value = {"order": request.order}
        config.updated_at = now
    else:
        config = Config(
            key=CONFIG_KEY_CARD_ORDER,
            value={"order": request.order},
            updated_at=now,
        )
        session.add(config)

    await session.flush()

    return CardOrderSaveResponse(status="saved", timestamp=now)


@router.get(
    "/card-order",
    response_model=CardOrderLoadResponse,
    operation_id="get_card_order",
    summary="Get dashboard card order",
    responses={**AUTH_RESPONSES},
)
async def get_card_order(
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> CardOrderLoadResponse:
    """Get the saved dashboard card order preference.

    Returns the ordered list of server IDs for card arrangement.
    Returns empty list if no order has been saved yet.
    """
    result = await session.execute(
        select(Config).where(Config.key == CONFIG_KEY_CARD_ORDER)
    )
    config = result.scalar_one_or_none()

    if config and isinstance(config.value, dict):
        order = config.value.get("order", [])
        return CardOrderLoadResponse(order=order)

    return CardOrderLoadResponse(order=[])


# US0132: Section-specific card order endpoints


@router.put(
    "/section-order",
    response_model=CardOrderSaveResponse,
    operation_id="save_section_order",
    summary="Save section-specific card orders",
    responses={**AUTH_RESPONSES},
)
async def save_section_order(
    request: SectionCardOrderRequest,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> CardOrderSaveResponse:
    """Save section-specific card orders.

    Stores separate ordered lists for servers and workstations sections.
    Uses upsert pattern - creates if not exists, updates if exists.
    """
    result = await session.execute(
        select(Config).where(Config.key == CONFIG_KEY_SECTION_ORDER)
    )
    config = result.scalar_one_or_none()

    now = datetime.now(UTC)

    if config:
        config.value = {"servers": request.servers, "workstations": request.workstations}
        config.updated_at = now
    else:
        config = Config(
            key=CONFIG_KEY_SECTION_ORDER,
            value={"servers": request.servers, "workstations": request.workstations},
            updated_at=now,
        )
        session.add(config)

    await session.flush()

    return CardOrderSaveResponse(status="saved", timestamp=now)


@router.get(
    "/section-order",
    response_model=SectionCardOrderResponse,
    operation_id="get_section_order",
    summary="Get section-specific card orders",
    responses={**AUTH_RESPONSES},
)
async def get_section_order(
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> SectionCardOrderResponse:
    """Get saved section-specific card orders.

    Returns separate ordered lists for servers and workstations sections.
    Returns empty lists if no order has been saved yet.
    """
    result = await session.execute(
        select(Config).where(Config.key == CONFIG_KEY_SECTION_ORDER)
    )
    config = result.scalar_one_or_none()

    if config and isinstance(config.value, dict):
        return SectionCardOrderResponse(
            servers=config.value.get("servers", []),
            workstations=config.value.get("workstations", []),
        )

    return SectionCardOrderResponse(servers=[], workstations=[])


@router.put(
    "/collapsed-sections",
    response_model=CardOrderSaveResponse,
    operation_id="save_collapsed_sections",
    summary="Save collapsed section state",
    responses={**AUTH_RESPONSES},
)
async def save_collapsed_sections(
    request: CollapsedSectionsRequest,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> CardOrderSaveResponse:
    """Save collapsed section state.

    Stores which dashboard sections are collapsed.
    Uses upsert pattern - creates if not exists, updates if exists.
    """
    result = await session.execute(
        select(Config).where(Config.key == CONFIG_KEY_COLLAPSED_SECTIONS)
    )
    config = result.scalar_one_or_none()

    now = datetime.now(UTC)

    if config:
        config.value = {"collapsed": request.collapsed}
        config.updated_at = now
    else:
        config = Config(
            key=CONFIG_KEY_COLLAPSED_SECTIONS,
            value={"collapsed": request.collapsed},
            updated_at=now,
        )
        session.add(config)

    await session.flush()

    return CardOrderSaveResponse(status="saved", timestamp=now)


@router.get(
    "/collapsed-sections",
    response_model=CollapsedSectionsResponse,
    operation_id="get_collapsed_sections",
    summary="Get collapsed section state",
    responses={**AUTH_RESPONSES},
)
async def get_collapsed_sections(
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> CollapsedSectionsResponse:
    """Get saved collapsed section state.

    Returns which dashboard sections are collapsed.
    Returns empty list if no state has been saved yet.
    """
    result = await session.execute(
        select(Config).where(Config.key == CONFIG_KEY_COLLAPSED_SECTIONS)
    )
    config = result.scalar_one_or_none()

    if config and isinstance(config.value, dict):
        return CollapsedSectionsResponse(collapsed=config.value.get("collapsed", []))

    return CollapsedSectionsResponse(collapsed=[])


# US0136: Unified dashboard preferences endpoints


@router.get(
    "/dashboard",
    response_model=DashboardPreferencesResponse,
    operation_id="get_dashboard_preferences",
    summary="Get all dashboard preferences",
    responses={**AUTH_RESPONSES},
)
async def get_dashboard_preferences(
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> DashboardPreferencesResponse:
    """Get all dashboard preferences in a single call.

    Returns unified preferences including card order, collapsed sections,
    and view mode. Returns defaults if no preferences have been saved.

    US0136 AC1: Unified preference storage
    US0136 AC2: Single-call load
    US0136 AC4: Preference structure
    """
    result = await session.execute(
        select(Config).where(Config.key == CONFIG_KEY_DASHBOARD)
    )
    config = result.scalar_one_or_none()

    if config and isinstance(config.value, dict):
        value = config.value
        card_order_data = value.get("card_order", {})
        return DashboardPreferencesResponse(
            card_order=CardOrder(
                servers=card_order_data.get("servers", []),
                workstations=card_order_data.get("workstations", []),
            ),
            collapsed_sections=value.get("collapsed_sections", []),
            view_mode=value.get("view_mode", "grid"),
            updated_at=config.updated_at,
        )

    # Return defaults with null updated_at (first-time user)
    return DashboardPreferencesResponse(
        card_order=CardOrder(servers=[], workstations=[]),
        collapsed_sections=[],
        view_mode="grid",
        updated_at=None,
    )


@router.put(
    "/dashboard",
    response_model=DashboardPreferencesSaveResponse,
    operation_id="save_dashboard_preferences",
    summary="Save all dashboard preferences",
    responses={**AUTH_RESPONSES},
)
async def save_dashboard_preferences(
    request: DashboardPreferencesRequest,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> DashboardPreferencesSaveResponse:
    """Save all dashboard preferences atomically.

    Stores card order, collapsed sections, and view mode in a single
    database record. Uses upsert pattern - creates if not exists,
    updates if exists.

    US0136 AC1: Unified preference storage
    US0136 AC3: Changes saved immediately
    US0136 AC5: Conflict resolution (last-write-wins)
    """
    result = await session.execute(
        select(Config).where(Config.key == CONFIG_KEY_DASHBOARD)
    )
    config = result.scalar_one_or_none()

    now = datetime.now(UTC)

    # Deduplicate card_order lists while preserving order
    def dedupe(items: list[str]) -> list[str]:
        seen: set[str] = set()
        result: list[str] = []
        for item in items:
            if item not in seen:
                seen.add(item)
                result.append(item)
        return result

    preference_value = {
        "card_order": {
            "servers": dedupe(request.card_order.servers),
            "workstations": dedupe(request.card_order.workstations),
        },
        "collapsed_sections": request.collapsed_sections,
        "view_mode": request.view_mode,
    }

    if config:
        config.value = preference_value
        config.updated_at = now
    else:
        config = Config(
            key=CONFIG_KEY_DASHBOARD,
            value=preference_value,
            updated_at=now,
        )
        session.add(config)

    await session.flush()

    return DashboardPreferencesSaveResponse(status="saved", updated_at=now)
