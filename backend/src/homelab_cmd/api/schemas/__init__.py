"""Pydantic schemas for API request/response validation."""

from homelab_cmd.api.schemas.alerts import (
    AlertAcknowledgeResponse,
    AlertListResponse,
    AlertResolveResponse,
    AlertResponse,
)
from homelab_cmd.api.schemas.connectivity import (
    ConnectivityMode,
    ConnectivityStatusBarResponse,
    ConnectivityStatusResponse,
    ConnectivityUpdateRequest,
    ConnectivityUpdateResponse,
    SSHInfo,
    TailscaleInfo,
)
from homelab_cmd.api.schemas.heartbeat import (
    HeartbeatRequest,
    HeartbeatResponse,
    MetricsPayload,
    OSInfo,
)
from homelab_cmd.api.schemas.server import (
    LatestMetrics,
    ServerCreate,
    ServerListResponse,
    ServerResponse,
    ServerUpdate,
)

__all__ = [
    "AlertAcknowledgeResponse",
    "AlertListResponse",
    "AlertResolveResponse",
    "AlertResponse",
    "HeartbeatRequest",
    "HeartbeatResponse",
    "LatestMetrics",
    "MetricsPayload",
    "OSInfo",
    "ServerCreate",
    "ServerListResponse",
    "ServerResponse",
    "ServerUpdate",
    "ConnectivityMode",
    "ConnectivityStatusResponse",
    "ConnectivityUpdateRequest",
    "ConnectivityUpdateResponse",
    "ConnectivityStatusBarResponse",
    "SSHInfo",
    "TailscaleInfo",
]
