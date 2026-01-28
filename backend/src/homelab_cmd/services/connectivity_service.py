"""Connectivity Mode Management Service for US0080.

Manages switching between Tailscale and Direct SSH connectivity modes.
Handles auto-detection of mode based on Tailscale token presence.
"""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.routes.config import get_config_value, set_config_value
from homelab_cmd.api.schemas.connectivity import (
    ConnectivityMode,
    ConnectivityStatusBarResponse,
    ConnectivityStatusResponse,
    ConnectivityUpdateResponse,
    SSHInfo,
    TailscaleInfo,
)
from homelab_cmd.services.credential_service import CredentialService
from homelab_cmd.services.tailscale_service import TailscaleError

logger = logging.getLogger(__name__)


class TailscaleTokenRequiredError(Exception):
    """Raised when Tailscale mode requires a valid token."""

    pass


class ConnectivityService:
    """Service for managing connectivity mode settings."""

    def __init__(
        self,
        session: AsyncSession,
        credential_service: CredentialService,
    ) -> None:
        """Initialise connectivity service.

        Args:
            session: Database session for config storage.
            credential_service: Service for credential management.
        """
        self._session = session
        self._credential_service = credential_service

    async def detect_connectivity_mode(self) -> ConnectivityMode:
        """Auto-detect connectivity mode based on configuration.

        Returns:
            'tailscale' if valid token exists, 'direct_ssh' otherwise.
        """
        # Check if Tailscale token exists
        token_exists = await self._credential_service.credential_exists("tailscale_token")
        if not token_exists:
            return "direct_ssh"

        # Validate token by testing connection
        try:
            if await self._test_tailscale_connection():
                return "tailscale"
        except TailscaleError:
            logger.warning("Tailscale token validation failed, falling back to direct_ssh")

        return "direct_ssh"

    async def _test_tailscale_connection(self) -> bool:
        """Test Tailscale API connection.

        Returns:
            True if connection successful, False otherwise.
        """
        # Import here to avoid circular imports
        from homelab_cmd.services.tailscale_service import TailscaleService

        try:
            # Check token exists first
            token_exists = await self._credential_service.credential_exists("tailscale_token")
            if not token_exists:
                return False

            # Use TailscaleService with credential service
            client = TailscaleService(self._credential_service)
            try:
                result = await client.test_connection()
                return result.success
            finally:
                await client.close()
        except TailscaleError as e:
            logger.debug("Tailscale connection test failed: %s", e)
            return False

    async def _get_tailscale_info(self) -> dict:
        """Get Tailscale connection information.

        Returns:
            Dict with configured, connected, tailnet, device_count.
        """
        token_exists = await self._credential_service.credential_exists("tailscale_token")
        if not token_exists:
            return {
                "configured": False,
                "connected": False,
                "tailnet": None,
                "device_count": 0,
            }

        # Try to get tailnet info
        from homelab_cmd.services.tailscale_service import TailscaleService

        try:
            # Use TailscaleService with credential service
            client = TailscaleService(self._credential_service)
            try:
                result = await client.test_connection()
                if result.success:
                    # Get device count
                    device_count = await self._get_tailscale_device_count()
                    return {
                        "configured": True,
                        "connected": True,
                        "tailnet": result.tailnet,
                        "device_count": device_count,
                    }
                return {
                    "configured": True,
                    "connected": False,
                    "tailnet": None,
                    "device_count": 0,
                }
            finally:
                await client.close()
        except TailscaleError as e:
            logger.warning("Failed to get Tailscale info: %s", e)
            return {
                "configured": True,
                "connected": False,
                "tailnet": None,
                "device_count": 0,
            }

    async def _get_tailscale_device_count(self) -> int:
        """Get count of Tailscale devices.

        Returns:
            Number of devices in tailnet.
        """
        from homelab_cmd.services.tailscale_service import TailscaleCache, TailscaleService

        try:
            # Check token exists first
            token_exists = await self._credential_service.credential_exists("tailscale_token")
            if not token_exists:
                return 0

            # Use TailscaleService with credential service
            cache = TailscaleCache()
            client = TailscaleService(self._credential_service)
            try:
                device_list = await client.get_devices_cached(cache, set())
                return len(device_list.devices)
            finally:
                await client.close()
        except TailscaleError as e:
            logger.debug("Failed to get device count: %s", e)
            return 0

    async def _get_ssh_info(self) -> SSHInfo:
        """Get SSH configuration information.

        Returns:
            SSHInfo with username and key status.
        """
        # Get username from config - handle both dict and string cases defensively
        username_config = await get_config_value(self._session, "ssh_username")
        username = "homelabcmd"  # default
        if username_config:
            if isinstance(username_config, dict):
                username = username_config.get("username", "homelabcmd")
            elif isinstance(username_config, str):
                # Legacy or malformed data - use the string as username
                username = username_config

        # Check if SSH key exists
        key_exists = await self._credential_service.credential_exists("ssh_private_key")

        # Get key upload time from credential metadata if available
        key_uploaded_at = None
        if key_exists:
            # For now, we don't have metadata, so leave as None
            key_uploaded_at = None

        return SSHInfo(
            username=username,
            key_configured=key_exists,
            key_uploaded_at=key_uploaded_at,
        )

    async def get_connectivity_status(self) -> ConnectivityStatusResponse:
        """Get full connectivity configuration status.

        Returns:
            ConnectivityStatusResponse with mode and all settings.
        """
        # Get current mode from config or auto-detect - handle both dict and string
        mode_config = await get_config_value(self._session, "connectivity_mode")
        if mode_config:
            if isinstance(mode_config, dict):
                mode = mode_config.get("mode", "direct_ssh")
            elif isinstance(mode_config, str):
                mode = mode_config
            else:
                mode = "direct_ssh"
            mode_auto_detected = False
        else:
            mode = await self.detect_connectivity_mode()
            mode_auto_detected = True

        # Get Tailscale info
        tailscale_info = await self._get_tailscale_info()

        # Get SSH info
        ssh_info = await self._get_ssh_info()

        return ConnectivityStatusResponse(
            mode=mode,
            mode_auto_detected=mode_auto_detected,
            tailscale=TailscaleInfo(**tailscale_info),
            ssh=ssh_info,
        )

    async def update_connectivity_mode(
        self,
        mode: ConnectivityMode,
        ssh_username: str | None,
    ) -> ConnectivityUpdateResponse:
        """Update connectivity mode.

        Args:
            mode: New connectivity mode.
            ssh_username: SSH username to set (optional).

        Returns:
            ConnectivityUpdateResponse with result.

        Raises:
            TailscaleTokenRequiredError: If switching to Tailscale without token.
        """
        # Validate Tailscale mode requires token
        if mode == "tailscale":
            token_exists = await self._credential_service.credential_exists("tailscale_token")
            if not token_exists:
                raise TailscaleTokenRequiredError(
                    "Tailscale mode requires a valid API token. Configure token first."
                )

            # Validate token is working
            if not await self._test_tailscale_connection():
                raise TailscaleTokenRequiredError(
                    "Tailscale API token is invalid or expired. "
                    "Please configure a valid token first."
                )

        # Save mode to config
        await set_config_value(self._session, "connectivity_mode", {"mode": mode})

        # Save SSH username if provided
        if ssh_username:
            await set_config_value(self._session, "ssh_username", {"username": ssh_username})

        # Note: SSH connection pool clearing is handled per-instance by SSHPooledExecutor.
        # Individual executors manage their own connection pools with TTL expiry.
        # No global pool clearing needed on mode change - connections will naturally expire.

        return ConnectivityUpdateResponse(
            success=True,
            mode=mode,
            message=f"Connectivity mode set to {mode}",
        )

    async def get_status_bar_info(self) -> ConnectivityStatusBarResponse:
        """Get minimal status for dashboard status bar.

        Returns:
            ConnectivityStatusBarResponse with mode, display, healthy.
        """
        # Get current mode - handle both dict and string
        mode_config = await get_config_value(self._session, "connectivity_mode")
        if mode_config:
            if isinstance(mode_config, dict):
                mode = mode_config.get("mode", "direct_ssh")
            elif isinstance(mode_config, str):
                mode = mode_config
            else:
                mode = "direct_ssh"
        else:
            mode = await self.detect_connectivity_mode()

        # Generate display text
        if mode == "tailscale":
            device_count = await self._get_tailscale_device_count()
            display = f"Tailscale ({device_count} devices)"
            # Check if actually connected
            token_exists = await self._credential_service.credential_exists("tailscale_token")
            healthy = token_exists
        else:
            display = "Direct SSH"
            healthy = True

        return ConnectivityStatusBarResponse(
            mode=mode,
            display=display,
            healthy=healthy,
        )
