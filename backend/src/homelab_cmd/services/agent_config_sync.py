"""Agent config sync service.

Synchronises expected services from the database to the agent's config file via SSH.
When services are added/removed in the UI, this updates the agent's monitored_services list.
"""

import logging
from typing import TYPE_CHECKING

from sqlalchemy import select

from homelab_cmd.db.models.config import Config
from homelab_cmd.db.models.server import Server
from homelab_cmd.db.models.service import ExpectedService
from homelab_cmd.services.ssh import get_ssh_service

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Agent config file path
AGENT_CONFIG_PATH = "/etc/homelab-agent/config.yaml"

# Default SSH username if not configured
DEFAULT_SSH_USERNAME = "root"


async def _get_ssh_config(session: "AsyncSession") -> tuple[str, dict[str, str]]:
    """Get SSH config including default username and key usernames.

    Returns:
        Tuple of (default_username, key_usernames_dict)
    """
    # Get ssh config which contains key_usernames (key is "ssh" not "ssh_config")
    result = await session.execute(select(Config).where(Config.key == "ssh"))
    config = result.scalar_one_or_none()
    ssh_config = config.value if config else {}
    key_usernames = ssh_config.get("key_usernames", {})

    # Get default username
    result = await session.execute(select(Config).where(Config.key == "ssh_username"))
    username_config = result.scalar_one_or_none()
    default_username = username_config.value if username_config else DEFAULT_SSH_USERNAME

    return default_username, key_usernames


async def sync_services_to_agent(
    session: "AsyncSession",
    server_id: str,
    key_id: str | None = None,
) -> tuple[bool, str]:
    """Sync expected services from database to agent config via SSH.

    Updates the agent's monitored_services list in its YAML config file,
    then restarts the agent to apply changes.

    Args:
        session: Database session.
        server_id: Server ID to sync.
        key_id: Optional SSH key ID to use. If None, tries all keys.

    Returns:
        Tuple of (success, message).
    """
    # Get server details
    server = await session.get(Server, server_id)
    if not server:
        return False, f"Server '{server_id}' not found"

    # Determine hostname - prefer Tailscale hostname
    hostname = server.tailscale_hostname or server.hostname
    if not hostname:
        return False, "Server has no hostname configured"

    # Get all enabled expected services for this server
    result = await session.execute(
        select(ExpectedService).where(
            ExpectedService.server_id == server_id,
            ExpectedService.enabled == True,  # noqa: E712
        )
    )
    services = result.scalars().all()
    service_names = [s.service_name for s in services]

    # Build the YAML list for monitored_services
    if service_names:
        services_list = ", ".join(f'"{name}"' for name in sorted(service_names))
        services_yaml_line = f"monitored_services: [{services_list}]"
    else:
        services_yaml_line = "monitored_services: []"

    # SSH command to update the config file using Python (safer YAML handling)
    # This preserves other config values and handles YAML properly
    # Uses sudo for file access since config is owned by root
    update_script = f'''
sudo python3 << 'PYTHON_EOF'
import yaml
import os
import sys

CONFIG_FILE = "{AGENT_CONFIG_PATH}"

# Check if config file exists
if not os.path.exists(CONFIG_FILE):
    print(f"Config file not found: {{CONFIG_FILE}}")
    sys.exit(1)

# Read current config
try:
    with open(CONFIG_FILE, 'r') as f:
        config = yaml.safe_load(f) or {{}}
except Exception as e:
    print(f"Failed to read config: {{e}}")
    sys.exit(1)

# Update monitored_services
config['monitored_services'] = {list(sorted(service_names))}

# Write back
try:
    with open(CONFIG_FILE, 'w') as f:
        yaml.dump(config, f, default_flow_style=False)
    print(f"Updated config with {{len(config['monitored_services'])}} services")
except Exception as e:
    print(f"Failed to write config: {{e}}")
    sys.exit(1)
PYTHON_EOF

# Restart agent to pick up changes
sudo systemctl restart homelab-agent
echo "Agent restarted"
'''

    # Get SSH service and configuration
    ssh_service = get_ssh_service()
    default_username, key_usernames = await _get_ssh_config(session)

    # Priority: server-specific > global default > fallback
    username = server.ssh_username or default_username

    try:
        result = await ssh_service.execute_command(
            hostname=hostname,
            username=username,
            command=update_script,
            command_timeout=30,
            key_filter=key_id,
            key_usernames=key_usernames,
        )

        if result.success:
            logger.info(
                "Synced %d services to agent on %s: %s",
                len(service_names),
                hostname,
                service_names,
            )
            return True, f"Synced {len(service_names)} services to agent"
        else:
            error_msg = result.error or result.stderr or result.stdout or "Unknown error"
            logger.warning(
                "Failed to sync services to agent on %s (exit_code=%d): stdout=%s, stderr=%s, error=%s",
                hostname,
                result.exit_code,
                result.stdout[:200] if result.stdout else "",
                result.stderr[:200] if result.stderr else "",
                result.error,
            )
            return False, f"SSH command failed: {error_msg}"

    except Exception as e:
        logger.exception("Failed to sync services to agent on %s", hostname)
        return False, f"SSH error: {e}"
