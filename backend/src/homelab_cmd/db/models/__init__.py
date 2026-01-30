"""Database models for HomelabCmd.

Import all models here to ensure they are registered with SQLAlchemy's
metadata when the database is initialised.
"""

from homelab_cmd.db.models.agent_credential import AgentCredential
from homelab_cmd.db.models.alert import Alert, AlertStatus, AlertType
from homelab_cmd.db.models.alert_state import AlertSeverity, AlertState, MetricType
from homelab_cmd.db.models.config import Config
from homelab_cmd.db.models.config_apply import ConfigApply, ConfigApplyStatus
from homelab_cmd.db.models.config_check import ConfigCheck
from homelab_cmd.db.models.cost_snapshot import CostSnapshot, CostSnapshotMonthly
from homelab_cmd.db.models.credential import Credential
from homelab_cmd.db.models.discovery import Discovery, DiscoveryStatus
from homelab_cmd.db.models.metrics import FilesystemMetrics, Metrics, NetworkInterfaceMetrics
from homelab_cmd.db.models.pending_package import PendingPackage
from homelab_cmd.db.models.registration_token import AgentMode, RegistrationToken
from homelab_cmd.db.models.remediation import ActionStatus, RemediationAction
from homelab_cmd.db.models.scan import Scan, ScanStatus, ScanType
from homelab_cmd.db.models.server import Server, ServerStatus
from homelab_cmd.db.models.service import (
    ExpectedService,
    ServiceStatus,
    ServiceStatusValue,
)
from homelab_cmd.db.models.ssh_host_key import SSHHostKey
from homelab_cmd.db.models.uptime import ServerUptimeDaily

__all__ = [
    "ActionStatus",
    "AgentCredential",
    "AgentMode",
    "Alert",
    "ConfigApply",
    "ConfigApplyStatus",
    "ConfigCheck",
    "CostSnapshot",
    "CostSnapshotMonthly",
    "Credential",
    "AlertSeverity",
    "AlertState",
    "AlertStatus",
    "AlertType",
    "Config",
    "Discovery",
    "DiscoveryStatus",
    "ExpectedService",
    "FilesystemMetrics",
    "MetricType",
    "Metrics",
    "NetworkInterfaceMetrics",
    "PendingPackage",
    "RegistrationToken",
    "RemediationAction",
    "Scan",
    "ScanStatus",
    "ScanType",
    "Server",
    "ServerStatus",
    "ServiceStatus",
    "ServiceStatusValue",
    "SSHHostKey",
    "ServerUptimeDaily",
]
