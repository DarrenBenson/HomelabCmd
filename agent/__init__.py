"""HomelabCmd Monitoring Agent package.

A lightweight agent that collects system metrics and sends heartbeats
to the HomelabCmd server. Designed to run as a systemd service.

Usage:
    python -m agent [-c CONFIG] [-v]
"""

from .collectors import (
    get_all_services_status,
    get_cpu_info,
    get_mac_address,
    get_metrics,
    get_os_info,
    get_package_update_list,
    get_package_updates,
    get_service_status,
)
from .config import (
    DEFAULT_HEARTBEAT_INTERVAL,
    AgentConfig,
    load_config,
    load_config_from_env,
)
from .heartbeat import send_heartbeat

__all__ = [
    "AgentConfig",
    "DEFAULT_HEARTBEAT_INTERVAL",
    "get_all_services_status",
    "get_cpu_info",
    "get_mac_address",
    "get_metrics",
    "get_os_info",
    "get_package_update_list",
    "get_package_updates",
    "get_service_status",
    "load_config",
    "load_config_from_env",
    "send_heartbeat",
]
