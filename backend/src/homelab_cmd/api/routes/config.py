"""Configuration API endpoints.

Provides endpoints for managing alert thresholds and notification settings.
Supports partial updates with nested merging for metric-specific settings.
"""

from datetime import UTC, datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.deps import verify_api_key
from homelab_cmd.api.responses import AUTH_RESPONSES
from homelab_cmd.api.schemas.config import (
    ConfigResponse,
    CostConfig,
    CostConfigResponse,
    CostConfigUpdate,
    NotificationsConfig,
    NotificationsResponse,
    NotificationsUpdate,
    TestWebhookRequest,
    TestWebhookResponse,
    ThresholdsConfig,
    ThresholdsResponse,
    ThresholdsUpdate,
)
from homelab_cmd.db.models.config import Config
from homelab_cmd.db.session import get_async_session

router = APIRouter(prefix="/config", tags=["Configuration"])

# Default configuration values
DEFAULT_THRESHOLDS = ThresholdsConfig()
DEFAULT_NOTIFICATIONS = NotificationsConfig()
DEFAULT_COST = CostConfig()


async def get_config_value(session: AsyncSession, key: str) -> dict | None:
    """Get a configuration value from the database."""
    result = await session.execute(select(Config).where(Config.key == key))
    config = result.scalar_one_or_none()
    return config.value if config else None


async def set_config_value(session: AsyncSession, key: str, value: dict) -> None:
    """Set a configuration value in the database (upsert)."""
    result = await session.execute(select(Config).where(Config.key == key))
    config = result.scalar_one_or_none()

    if config:
        config.value = value
    else:
        config = Config(key=key, value=value)
        session.add(config)

    await session.flush()


def _merge_metric_threshold(
    current: dict,
    update: dict | None,
) -> tuple[dict, list[str]]:
    """Merge metric threshold update into current values.

    Args:
        current: Current metric threshold dict
        update: Update dict (may be None or have None fields)

    Returns:
        Tuple of (merged dict, list of updated field names)
    """
    if update is None:
        return current, []

    updated_fields: list[str] = []
    result = current.copy()

    for field in ["high_percent", "critical_percent", "sustained_seconds", "sustained_heartbeats"]:
        if field in update and update[field] is not None:
            if result.get(field) != update[field]:
                result[field] = update[field]
                updated_fields.append(field)

    return result, updated_fields


def _merge_cooldown_config(
    current: dict,
    update: dict | None,
) -> tuple[dict, list[str]]:
    """Merge cooldown config update into current values.

    Args:
        current: Current cooldown config dict
        update: Update dict (may be None or have None fields)

    Returns:
        Tuple of (merged dict, list of updated field names)
    """
    if update is None:
        return current, []

    updated_fields: list[str] = []
    result = current.copy()

    for field in ["critical_minutes", "high_minutes"]:
        if field in update and update[field] is not None:
            if result.get(field) != update[field]:
                result[field] = update[field]
                updated_fields.append(field)

    return result, updated_fields


@router.get(
    "",
    response_model=ConfigResponse,
    operation_id="get_config",
    summary="Get all system configuration",
    responses={**AUTH_RESPONSES},
)
async def get_config(
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ConfigResponse:
    """Get all system configuration.

    Returns the current configuration including alert thresholds and
    notification settings. Returns defaults if not yet configured.
    """
    # Get thresholds from DB or use defaults
    thresholds_data = await get_config_value(session, "thresholds")
    if thresholds_data:
        thresholds = ThresholdsConfig(**thresholds_data)
    else:
        thresholds = DEFAULT_THRESHOLDS

    # Get notifications from DB or use defaults
    notifications_data = await get_config_value(session, "notifications")
    if notifications_data:
        notifications = NotificationsConfig(**notifications_data)
    else:
        notifications = DEFAULT_NOTIFICATIONS

    return ConfigResponse(thresholds=thresholds, notifications=notifications)


@router.put(
    "/thresholds",
    response_model=ThresholdsResponse,
    operation_id="update_thresholds",
    summary="Update alert threshold configuration",
    responses={**AUTH_RESPONSES},
)
async def update_thresholds(
    update: ThresholdsUpdate,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ThresholdsResponse:
    """Update alert threshold configuration.

    Supports partial updates with deep merging for per-metric settings.
    Only provided fields are updated; omitted fields retain their current values.

    Example request body:
    ```json
    {
        "cpu": {"high_percent": 80},
        "disk": {"critical_percent": 90, "sustained_seconds": 60}
    }
    ```
    """
    # Get current thresholds
    current_data = await get_config_value(session, "thresholds")
    if current_data:
        current = ThresholdsConfig(**current_data)
    else:
        current = DEFAULT_THRESHOLDS

    # Track all updated fields with their paths
    updated_fields: list[str] = []
    result_dict = current.model_dump()

    # Handle nested metric threshold updates
    update_dict = update.model_dump(exclude_unset=True)

    for metric in ["cpu", "memory", "disk"]:
        if metric in update_dict and update_dict[metric] is not None:
            merged, fields = _merge_metric_threshold(
                result_dict[metric],
                update_dict[metric],
            )
            if fields:
                result_dict[metric] = merged
                updated_fields.extend(f"{metric}.{f}" for f in fields)

    # Handle flat server_offline_seconds field
    if "server_offline_seconds" in update_dict:
        new_value = update_dict["server_offline_seconds"]
        if new_value is not None and result_dict["server_offline_seconds"] != new_value:
            result_dict["server_offline_seconds"] = new_value
            updated_fields.append("server_offline_seconds")

    # Validate the merged result (will raise if critical <= high)
    try:
        thresholds = ThresholdsConfig(**result_dict)
    except ValidationError as e:
        # Convert Pydantic validation error to HTTP 422
        # Use first error message for simplicity
        first_error = e.errors()[0]
        detail = f"{first_error['loc']}: {first_error['msg']}"
        raise HTTPException(status_code=422, detail=detail) from e

    # Save to database
    await set_config_value(session, "thresholds", thresholds.model_dump())

    return ThresholdsResponse(
        updated=updated_fields,
        thresholds=thresholds,
    )


@router.put(
    "/notifications",
    response_model=NotificationsResponse,
    operation_id="update_notifications",
    summary="Update notification configuration",
    responses={**AUTH_RESPONSES},
)
async def update_notifications(
    update: NotificationsUpdate,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> NotificationsResponse:
    """Update notification configuration.

    Supports partial updates with deep merging for cooldown settings.
    Only provided fields are updated; omitted fields retain their current values.

    Example request body:
    ```json
    {
        "slack_webhook_url": "https://hooks.slack.com/...",
        "cooldowns": {"critical_minutes": 15}
    }
    ```
    """
    # Get current notifications
    current_data = await get_config_value(session, "notifications")
    if current_data:
        current = NotificationsConfig(**current_data)
    else:
        current = DEFAULT_NOTIFICATIONS

    # Track all updated fields with their paths
    updated_fields: list[str] = []
    result_dict = current.model_dump()

    update_dict = update.model_dump(exclude_unset=True)

    # Handle nested cooldown config
    if "cooldowns" in update_dict and update_dict["cooldowns"] is not None:
        merged, fields = _merge_cooldown_config(
            result_dict["cooldowns"],
            update_dict["cooldowns"],
        )
        if fields:
            result_dict["cooldowns"] = merged
            updated_fields.extend(f"cooldowns.{f}" for f in fields)

    # Handle flat fields
    flat_fields = [
        "slack_webhook_url",
        "notify_on_critical",
        "notify_on_high",
        "notify_on_remediation",
    ]
    for field in flat_fields:
        if field in update_dict:
            new_value = update_dict[field]
            if new_value is not None and result_dict[field] != new_value:
                result_dict[field] = new_value
                updated_fields.append(field)

    # Create validated config
    notifications = NotificationsConfig(**result_dict)

    # Save to database
    await set_config_value(session, "notifications", notifications.model_dump())

    return NotificationsResponse(
        updated=updated_fields,
        notifications=notifications,
    )


@router.post(
    "/test-webhook",
    response_model=TestWebhookResponse,
    operation_id="test_webhook",
    summary="Test a Slack webhook URL",
    responses={**AUTH_RESPONSES},
)
async def test_webhook(
    request: TestWebhookRequest,
    _: str = Depends(verify_api_key),
) -> TestWebhookResponse:
    """Test a Slack webhook URL by sending a test message.

    Sends a formatted test message to the provided Slack webhook URL.
    Does not require or modify stored configuration - uses the URL
    provided in the request body.

    Returns success/error status with appropriate message.
    """
    # Format test message
    timestamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")
    payload = {
        "attachments": [
            {
                "color": "#3B82F6",  # Blue (info)
                "blocks": [
                    {
                        "type": "header",
                        "text": {"type": "plain_text", "text": "HomelabCmd Test"},
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": "Webhook configured successfully!",
                        },
                    },
                    {
                        "type": "context",
                        "elements": [{"type": "mrkdwn", "text": f"Sent at {timestamp}"}],
                    },
                ],
            }
        ]
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(request.webhook_url, json=payload)

            if response.status_code == 200:
                return TestWebhookResponse(success=True, message="Test message sent successfully")
            elif response.status_code == 404:
                return TestWebhookResponse(success=False, error="Invalid webhook URL")
            elif response.status_code == 429:
                return TestWebhookResponse(
                    success=False, error="Too many requests, try again later"
                )
            else:
                # Try to extract Slack error message
                try:
                    error_text = response.text
                except Exception:
                    error_text = f"HTTP {response.status_code}"
                return TestWebhookResponse(
                    success=False, error=f"Slack returned error: {error_text}"
                )

    except httpx.TimeoutException:
        return TestWebhookResponse(success=False, error="Connection timed out")
    except httpx.ConnectError:
        return TestWebhookResponse(success=False, error="Failed to connect to webhook URL")
    except Exception as e:
        return TestWebhookResponse(success=False, error=str(e))


@router.get(
    "/cost",
    response_model=CostConfigResponse,
    operation_id="get_cost_config",
    summary="Get cost tracking configuration",
    responses={**AUTH_RESPONSES},
)
async def get_cost_config(
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> CostConfigResponse:
    """Get cost tracking configuration.

    Returns the current electricity rate and currency symbol settings.
    Returns defaults (£0.24/kWh) if not yet configured.
    """
    cost_data = await get_config_value(session, "cost")
    if cost_data:
        cost = CostConfig(**cost_data)
        # Get updated_at from the config record
        result = await session.execute(select(Config).where(Config.key == "cost"))
        config_record = result.scalar_one_or_none()
        updated_at = (
            config_record.updated_at.isoformat()
            if config_record and config_record.updated_at
            else None
        )
    else:
        cost = DEFAULT_COST
        updated_at = None

    return CostConfigResponse(
        electricity_rate=cost.electricity_rate,
        currency_symbol=cost.currency_symbol,
        updated_at=updated_at,
    )


@router.put(
    "/cost",
    response_model=CostConfigResponse,
    operation_id="update_cost_config",
    summary="Update cost tracking configuration",
    responses={**AUTH_RESPONSES},
)
async def update_cost_config(
    update: CostConfigUpdate,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> CostConfigResponse:
    """Update cost tracking configuration.

    Supports partial updates - only provided fields are updated.
    Omitted fields retain their current values.
    """
    # Get current cost config
    current_data = await get_config_value(session, "cost")
    if current_data:
        current = CostConfig(**current_data)
    else:
        current = DEFAULT_COST

    # Apply partial updates
    result_dict = current.model_dump()
    update_dict = update.model_dump(exclude_unset=True)

    for field in ["electricity_rate", "currency_symbol"]:
        if field in update_dict and update_dict[field] is not None:
            result_dict[field] = update_dict[field]

    # Create validated config
    cost = CostConfig(**result_dict)

    # Save to database
    await set_config_value(session, "cost", cost.model_dump())

    # Get updated_at
    result = await session.execute(select(Config).where(Config.key == "cost"))
    config_record = result.scalar_one_or_none()
    updated_at = (
        config_record.updated_at.isoformat() if config_record and config_record.updated_at else None
    )

    return CostConfigResponse(
        electricity_rate=cost.electricity_rate,
        currency_symbol=cost.currency_symbol,
        updated_at=updated_at,
    )
