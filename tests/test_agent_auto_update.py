"""Tests for Agent Auto-Update Mechanism - Hub/Backend API (TS0201).

US0184: Agent Auto-Update Mechanism

Backend API tests verifying heartbeat response includes version information,
auto-update toggle via server PUT, and manual update triggering.

Test cases:
- TC001: Heartbeat response includes latest agent version
- TC002: Heartbeat response without configured version
- TC003: Heartbeat response includes update command when pending
- TC008: Auto-update toggle default is disabled
- TC009: Enable auto-update via API
- TC010: Disable auto-update via API
- TC023: Manual update works regardless of auto-update setting
"""

from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient


# =============================================================================
# TC001-TC003: Heartbeat response version and update fields
# =============================================================================


class TestHeartbeatVersionResponse:
    """Heartbeat response includes agent version information (US0184)."""

    def test_heartbeat_response_includes_latest_agent_version(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """TC001: Heartbeat response should include latest_agent_version from hub settings.

        When agent_version is configured on the hub, the heartbeat response
        should advertise it so agents can detect available updates.
        """
        # Configure a known agent version on the hub
        with patch("homelab_cmd.api.routes.agents.settings") as mock_settings:
            mock_settings.agent_version = "2.5.0"

            response = send_heartbeat(
                client,
                auth_headers,
                "version-check-server",
                agent_version="2.0.0",
            )

        assert response.status_code == 200
        data = response.json()
        assert data["latest_agent_version"] == "2.5.0"

    def test_heartbeat_response_without_configured_version(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """TC002: Heartbeat response should return null when no agent version configured.

        When the hub has not configured an agent_version (e.g. fresh install),
        latest_agent_version should be null to indicate no update is available.
        """
        with patch("homelab_cmd.api.routes.agents.settings") as mock_settings:
            mock_settings.agent_version = None

            response = send_heartbeat(
                client,
                auth_headers,
                "no-version-config-server",
                agent_version="2.0.0",
            )

        assert response.status_code == 200
        data = response.json()
        assert data["latest_agent_version"] is None

    def test_heartbeat_response_includes_update_command_when_pending(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC003: Heartbeat response includes update_command when update is pending.

        When a server has agent_update_status='pending' and the agent supports
        self-update (version >= 2.1.0), the heartbeat response should include
        update_command='update' to trigger the agent to download and install.
        """
        # Create server and send initial heartbeat with updater-capable version
        client.post(
            "/api/v1/servers",
            json={"id": "pending-update-server", "hostname": "pending.local"},
            headers=auth_headers,
        )

        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "pending-update-server",
                "hostname": "pending.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "agent_version": "2.1.0",
            },
            headers=auth_headers,
        )

        # Trigger a manual update to set status to "pending"
        mock_settings = MagicMock()
        mock_settings.agent_version = "2.2.0"
        with patch("homelab_cmd.config.get_settings", return_value=mock_settings):
            trigger_response = client.post(
                "/api/v1/servers/pending-update-server/trigger-update",
                headers=auth_headers,
            )
            assert trigger_response.status_code == 200

        # Next heartbeat should include the update command
        with patch("homelab_cmd.api.routes.agents.settings") as mock_agent_settings:
            mock_agent_settings.agent_version = "2.2.0"

            hb_response = client.post(
                "/api/v1/agents/heartbeat",
                json={
                    "server_id": "pending-update-server",
                    "hostname": "pending.local",
                    "timestamp": datetime.now(UTC).isoformat(),
                    "agent_version": "2.1.0",
                },
                headers=auth_headers,
            )

        assert hb_response.status_code == 200
        data = hb_response.json()
        assert data["update_command"] == "update"

    def test_heartbeat_no_update_command_when_agent_too_old(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Update command should not be sent to agents older than 2.1.0.

        Agents prior to 2.1.0 do not have the updater module and cannot
        perform self-updates. The hub should clear the pending status.
        """
        # Create server with old agent version
        client.post(
            "/api/v1/servers",
            json={"id": "old-agent-server", "hostname": "old-agent.local"},
            headers=auth_headers,
        )

        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "old-agent-server",
                "hostname": "old-agent.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "agent_version": "1.0.0",
            },
            headers=auth_headers,
        )

        # Trigger update
        mock_settings = MagicMock()
        mock_settings.agent_version = "2.2.0"
        with patch("homelab_cmd.config.get_settings", return_value=mock_settings):
            client.post(
                "/api/v1/servers/old-agent-server/trigger-update",
                headers=auth_headers,
            )

        # Heartbeat from old agent should NOT receive update command
        with patch("homelab_cmd.api.routes.agents.settings") as mock_agent_settings:
            mock_agent_settings.agent_version = "2.2.0"

            hb_response = client.post(
                "/api/v1/agents/heartbeat",
                json={
                    "server_id": "old-agent-server",
                    "hostname": "old-agent.local",
                    "timestamp": datetime.now(UTC).isoformat(),
                    "agent_version": "1.0.0",
                },
                headers=auth_headers,
            )

        assert hb_response.status_code == 200
        data = hb_response.json()
        assert data["update_command"] is None


# =============================================================================
# TC008-TC010: Auto-update toggle API
# =============================================================================


class TestAutoUpdateToggle:
    """Auto-update toggle via server PUT endpoint (US0184)."""

    def test_auto_update_default_is_disabled(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """TC008: New server should have auto_update_agent disabled by default.

        Auto-update is opt-in per server. Freshly created servers should
        have auto_update_agent=False to prevent unintended updates.
        """
        create_server(client, auth_headers, "default-autoupdate-server")

        response = client.get(
            "/api/v1/servers/default-autoupdate-server",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["auto_update_agent"] is False

    def test_enable_auto_update_via_api(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """TC009: PUT server should enable auto_update_agent.

        Admin can enable automatic agent updates for a specific server
        via the server update API.
        """
        create_server(client, auth_headers, "enable-autoupdate-server")

        put_response = client.put(
            "/api/v1/servers/enable-autoupdate-server",
            json={"auto_update_agent": True},
            headers=auth_headers,
        )
        assert put_response.status_code == 200
        assert put_response.json()["auto_update_agent"] is True

        # Verify the change persisted
        get_response = client.get(
            "/api/v1/servers/enable-autoupdate-server",
            headers=auth_headers,
        )
        assert get_response.json()["auto_update_agent"] is True

    def test_disable_auto_update_via_api(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """TC010: PUT server should disable auto_update_agent.

        Admin can disable automatic agent updates after previously enabling them.
        """
        create_server(client, auth_headers, "disable-autoupdate-server")

        # Enable first
        client.put(
            "/api/v1/servers/disable-autoupdate-server",
            json={"auto_update_agent": True},
            headers=auth_headers,
        )

        # Then disable
        put_response = client.put(
            "/api/v1/servers/disable-autoupdate-server",
            json={"auto_update_agent": False},
            headers=auth_headers,
        )
        assert put_response.status_code == 200
        assert put_response.json()["auto_update_agent"] is False

        # Verify the change persisted
        get_response = client.get(
            "/api/v1/servers/disable-autoupdate-server",
            headers=auth_headers,
        )
        assert get_response.json()["auto_update_agent"] is False

    def test_auto_update_toggle_does_not_affect_other_fields(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Toggling auto_update_agent should not alter other server fields."""
        create_server(
            client,
            auth_headers,
            "toggle-isolated-server",
            display_name="My Test Server",
        )

        # Toggle auto-update on
        put_response = client.put(
            "/api/v1/servers/toggle-isolated-server",
            json={"auto_update_agent": True},
            headers=auth_headers,
        )
        assert put_response.status_code == 200
        data = put_response.json()
        assert data["auto_update_agent"] is True
        assert data["display_name"] == "My Test Server"
        assert data["is_paused"] is False


# =============================================================================
# TC023: Manual update trigger
# =============================================================================


class TestManualUpdateTrigger:
    """Manual update trigger endpoint (US0184 AC6)."""

    def test_manual_update_works_regardless_of_auto_update_setting(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """TC023: POST /servers/{id}/trigger-update queues update even when auto-update is off.

        Manual updates should always work, regardless of the auto_update_agent
        setting. This allows admins to push critical updates to servers that
        have opted out of automatic updates.
        """
        # Create server with auto-update disabled (default)
        send_heartbeat(
            client,
            auth_headers,
            "manual-update-server",
            agent_version="2.1.0",
        )

        # Verify auto-update is disabled
        server_data = client.get(
            "/api/v1/servers/manual-update-server", headers=auth_headers
        ).json()
        assert server_data["auto_update_agent"] is False

        # Trigger manual update
        mock_settings = MagicMock()
        mock_settings.agent_version = "2.5.0"
        with patch("homelab_cmd.config.get_settings", return_value=mock_settings):
            trigger_response = client.post(
                "/api/v1/servers/manual-update-server/trigger-update",
                headers=auth_headers,
            )

        assert trigger_response.status_code == 200
        data = trigger_response.json()
        assert data["status"] == "queued"
        assert data["target_version"] == "2.5.0"
        assert data["current_version"] == "2.1.0"

    def test_manual_update_rejects_when_no_version_configured(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """Manual update should return 400 when hub has no agent version configured."""
        send_heartbeat(
            client,
            auth_headers,
            "no-hub-version-server",
            agent_version="2.1.0",
        )

        mock_settings = MagicMock()
        mock_settings.agent_version = None
        with patch("homelab_cmd.config.get_settings", return_value=mock_settings):
            trigger_response = client.post(
                "/api/v1/servers/no-hub-version-server/trigger-update",
                headers=auth_headers,
            )

        assert trigger_response.status_code == 400
        assert trigger_response.json()["detail"]["code"] == "NO_UPDATE_AVAILABLE"

    def test_manual_update_rejects_when_already_latest(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """Manual update should return 400 when agent is already on the latest version."""
        send_heartbeat(
            client,
            auth_headers,
            "already-latest-server",
            agent_version="2.5.0",
        )

        mock_settings = MagicMock()
        mock_settings.agent_version = "2.5.0"
        with patch("homelab_cmd.config.get_settings", return_value=mock_settings):
            trigger_response = client.post(
                "/api/v1/servers/already-latest-server/trigger-update",
                headers=auth_headers,
            )

        assert trigger_response.status_code == 400
        assert trigger_response.json()["detail"]["code"] == "NO_UPDATE_AVAILABLE"

    def test_manual_update_returns_404_for_unknown_server(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Manual update should return 404 for non-existent server."""
        trigger_response = client.post(
            "/api/v1/servers/nonexistent-server/trigger-update",
            headers=auth_headers,
        )
        assert trigger_response.status_code == 404

    def test_manual_update_sets_pending_status(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """Manual update should set agent_update_status to 'pending' on the server."""
        send_heartbeat(
            client,
            auth_headers,
            "pending-status-server",
            agent_version="2.1.0",
        )

        mock_settings = MagicMock()
        mock_settings.agent_version = "2.5.0"
        with patch("homelab_cmd.config.get_settings", return_value=mock_settings):
            client.post(
                "/api/v1/servers/pending-status-server/trigger-update",
                headers=auth_headers,
            )

        server_data = client.get(
            "/api/v1/servers/pending-status-server", headers=auth_headers
        ).json()
        assert server_data["agent_update_status"] == "pending"


# =============================================================================
# Heartbeat update status reporting
# =============================================================================


class TestHeartbeatUpdateStatusReporting:
    """Agent reports update status back via heartbeat (US0184)."""

    def test_heartbeat_reports_update_success(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Agent reports successful update via heartbeat update_status field."""
        # Create server
        client.post(
            "/api/v1/servers",
            json={"id": "update-success-server", "hostname": "success.local"},
            headers=auth_headers,
        )

        # Send heartbeat with update_status=success
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "update-success-server",
                "hostname": "success.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "agent_version": "2.5.0",
                "update_status": "success",
            },
            headers=auth_headers,
        )
        assert response.status_code == 200

        # Verify server update status is cleared on success
        server_data = client.get(
            "/api/v1/servers/update-success-server", headers=auth_headers
        ).json()
        assert server_data["agent_update_status"] is None
        assert server_data["agent_update_error"] is None

    def test_heartbeat_reports_update_failure(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Agent reports failed update with error message via heartbeat."""
        client.post(
            "/api/v1/servers",
            json={"id": "update-failed-server", "hostname": "failed.local"},
            headers=auth_headers,
        )

        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "update-failed-server",
                "hostname": "failed.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "agent_version": "2.1.0",
                "update_status": "failed",
                "update_error": "Checksum mismatch",
            },
            headers=auth_headers,
        )
        assert response.status_code == 200

        server_data = client.get(
            "/api/v1/servers/update-failed-server", headers=auth_headers
        ).json()
        assert server_data["agent_update_status"] == "failed"
        assert server_data["agent_update_error"] == "Checksum mismatch"
