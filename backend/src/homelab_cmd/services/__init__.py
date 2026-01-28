"""Services package for HomelabCmd."""

from homelab_cmd.services.alerting import (
    AlertEvent,
    AlertingService,
    get_active_alerts_count,
    get_all_active_alerts,
)
from homelab_cmd.services.credential_service import (
    ALLOWED_CREDENTIAL_TYPES,
    CredentialDecryptionError,
    CredentialService,
)
from homelab_cmd.services.notifier import SlackNotifier, get_notifier
from homelab_cmd.services.scheduler import (
    OFFLINE_THRESHOLD_SECONDS,
    PRUNE_BATCH_SIZE,
    RETENTION_DAYS,
    STALE_CHECK_INTERVAL_SECONDS,
    check_offline_reminders,
    check_stale_servers,
    prune_old_metrics,
)
from homelab_cmd.services.tailscale_service import (
    TailscaleAuthError,
    TailscaleConnectionError,
    TailscaleConnectionResult,
    TailscaleError,
    TailscaleNotConfiguredError,
    TailscaleRateLimitError,
    TailscaleService,
)

__all__ = [
    "ALLOWED_CREDENTIAL_TYPES",
    "AlertEvent",
    "AlertingService",
    "CredentialDecryptionError",
    "CredentialService",
    "OFFLINE_THRESHOLD_SECONDS",
    "PRUNE_BATCH_SIZE",
    "RETENTION_DAYS",
    "STALE_CHECK_INTERVAL_SECONDS",
    "SlackNotifier",
    "TailscaleAuthError",
    "TailscaleConnectionError",
    "TailscaleConnectionResult",
    "TailscaleError",
    "TailscaleNotConfiguredError",
    "TailscaleRateLimitError",
    "TailscaleService",
    "check_offline_reminders",
    "check_stale_servers",
    "get_active_alerts_count",
    "get_all_active_alerts",
    "get_notifier",
    "prune_old_metrics",
]
