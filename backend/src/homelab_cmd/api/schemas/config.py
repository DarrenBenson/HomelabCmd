"""Pydantic schemas for Config API endpoints.

This module defines the configuration schemas for the alerting system:
- Per-metric thresholds (CPU, Memory, Disk) with high/critical levels
- Sustained threshold tracking for transient metrics
- Notification cooldown settings
- Slack integration configuration
"""

from typing import Self

from pydantic import BaseModel, Field, model_validator


class MetricThreshold(BaseModel):
    """Per-metric threshold configuration.

    Each metric (CPU, Memory, Disk) has:
    - high_percent: threshold for HIGH severity alerts
    - critical_percent: threshold for CRITICAL severity alerts
    - sustained_heartbeats: number of consecutive breaches before alerting
      (0 = immediate, 3 = ~3 minutes at 60s heartbeat interval)
    """

    high_percent: int = Field(ge=0, le=100)
    critical_percent: int = Field(ge=0, le=100)
    sustained_heartbeats: int = Field(default=0, ge=0, le=10)

    @model_validator(mode="after")
    def critical_higher_than_high(self) -> Self:
        """Validate that critical threshold is higher than high threshold."""
        if self.critical_percent <= self.high_percent:
            msg = "critical_percent must be greater than high_percent"
            raise ValueError(msg)
        return self


class MetricThresholdUpdate(BaseModel):
    """Schema for updating a metric threshold (all fields optional)."""

    high_percent: int | None = Field(default=None, ge=0, le=100)
    critical_percent: int | None = Field(default=None, ge=0, le=100)
    sustained_heartbeats: int | None = Field(default=None, ge=0, le=10)


class CooldownConfig(BaseModel):
    """Notification cooldown settings per severity.

    Controls how often reminders are sent for ongoing issues:
    - critical_minutes: reminder interval for CRITICAL alerts (default 30 min)
    - high_minutes: reminder interval for HIGH alerts (default 4 hours)
    """

    critical_minutes: int = Field(default=30, ge=5, le=1440)
    high_minutes: int = Field(default=240, ge=15, le=1440)


class CooldownConfigUpdate(BaseModel):
    """Schema for updating cooldown config (all fields optional)."""

    critical_minutes: int | None = Field(default=None, ge=5, le=1440)
    high_minutes: int | None = Field(default=None, ge=15, le=1440)


class ThresholdsConfig(BaseModel):
    """Full thresholds configuration.

    Contains per-metric threshold settings and server offline timeout.

    Default values:
    - CPU: 85% high, 95% critical, 3 heartbeats (~3 min)
    - Memory: 85% high, 95% critical, 3 heartbeats (~3 min)
    - Disk: 80% high, 95% critical, immediate
    - Server offline: 180 seconds (3 missed heartbeats)
    """

    cpu: MetricThreshold = Field(
        default_factory=lambda: MetricThreshold(
            high_percent=85, critical_percent=95, sustained_heartbeats=3
        )
    )
    memory: MetricThreshold = Field(
        default_factory=lambda: MetricThreshold(
            high_percent=85, critical_percent=95, sustained_heartbeats=3
        )
    )
    disk: MetricThreshold = Field(
        default_factory=lambda: MetricThreshold(
            high_percent=80, critical_percent=95, sustained_heartbeats=0
        )
    )
    server_offline_seconds: int = Field(default=180, ge=30)


class ThresholdsUpdate(BaseModel):
    """Schema for updating thresholds (all fields optional)."""

    cpu: MetricThresholdUpdate | None = None
    memory: MetricThresholdUpdate | None = None
    disk: MetricThresholdUpdate | None = None
    server_offline_seconds: int | None = Field(default=None, ge=30)


class NotificationsConfig(BaseModel):
    """Notification configuration.

    Contains Slack webhook settings and notification preferences.
    Medium/Low severities are intentionally excluded as no triggers are defined.

    Action notifications (US0032):
    - notify_on_action_failure: Send notification when action fails (default: True)
    - notify_on_action_success: Send notification when action succeeds (default: False)
    """

    slack_webhook_url: str = ""
    cooldowns: CooldownConfig = Field(default_factory=CooldownConfig)
    notify_on_critical: bool = True
    notify_on_high: bool = True
    notify_on_remediation: bool = True
    notify_on_action_failure: bool = True
    notify_on_action_success: bool = False


class NotificationsUpdate(BaseModel):
    """Schema for updating notifications (all fields optional)."""

    slack_webhook_url: str | None = None
    cooldowns: CooldownConfigUpdate | None = None
    notify_on_critical: bool | None = None
    notify_on_high: bool | None = None
    notify_on_remediation: bool | None = None
    notify_on_action_failure: bool | None = None
    notify_on_action_success: bool | None = None


class ConfigResponse(BaseModel):
    """Schema for full configuration response."""

    thresholds: ThresholdsConfig
    notifications: NotificationsConfig


class ThresholdsResponse(BaseModel):
    """Schema for thresholds update response."""

    updated: list[str]
    thresholds: ThresholdsConfig


class NotificationsResponse(BaseModel):
    """Schema for notifications update response."""

    updated: list[str]
    notifications: NotificationsConfig


class TestWebhookRequest(BaseModel):
    """Request to test a Slack webhook URL."""

    webhook_url: str = Field(..., min_length=1)


class TestWebhookResponse(BaseModel):
    """Response from webhook test."""

    success: bool
    message: str | None = None
    error: str | None = None


class CostConfig(BaseModel):
    """Cost tracking configuration.

    Default values:
    - electricity_rate: £0.24/kWh (UK average)
    - currency_symbol: £
    """

    electricity_rate: float = Field(default=0.24, ge=0)
    currency_symbol: str = Field(default="£", max_length=10)


class CostConfigUpdate(BaseModel):
    """Schema for updating cost config (all fields optional)."""

    electricity_rate: float | None = Field(default=None, ge=0)
    currency_symbol: str | None = Field(default=None, max_length=10)


class CostConfigResponse(BaseModel):
    """Response for cost settings endpoint."""

    electricity_rate: float
    currency_symbol: str
    updated_at: str | None = None
