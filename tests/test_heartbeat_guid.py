"""Tests for GUID-based server identity (US0070: GUID-Based Server Identity).

These tests verify the permanent GUID-based identity feature:
- GUID matching in heartbeat endpoint
- GUID migration for existing servers
- Duplicate GUID rejection
- Volatile field updates (IP, hostname)
- Backward compatibility for old agents without GUID

Spec Reference: sdlc-studio/stories/US0070-guid-based-server-identity.md
"""

import re
from datetime import UTC, datetime

from fastapi.testclient import TestClient

# Valid UUID v4 pattern for validation
UUID_V4_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


class TestHeartbeatGuidMatching:
    """Tests for GUID-based server matching (US0070 - AC1, AC2)."""

    def test_heartbeat_with_guid_matches_server(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC1: Heartbeat with server_guid should match server by GUID."""
        test_guid = "a1b2c3d4-e5f6-4890-abcd-ef1234567890"

        # First heartbeat auto-registers with GUID
        response1 = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_guid": test_guid,
                "server_id": "guid-test-server",
                "hostname": "guid-test-server.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )
        assert response1.status_code == 200
        assert response1.json()["server_registered"] is True

        # Second heartbeat should match by GUID even with different server_id
        response2 = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_guid": test_guid,
                "server_id": "different-server-id",  # Different ID, same GUID
                "hostname": "new-hostname.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )
        assert response2.status_code == 200
        assert response2.json()["server_registered"] is False  # Existing server found

    def test_heartbeat_without_guid_falls_back_to_server_id(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """AC2: Heartbeat without GUID should fall back to server_id matching."""
        # Create server without GUID
        create_server(client, auth_headers, "fallback-test-server")

        # Heartbeat without GUID should match by server_id
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "fallback-test-server",
                "hostname": "fallback-test-server.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["server_registered"] is False


class TestHeartbeatGuidMigration:
    """Tests for GUID migration path (US0070 - AC3)."""

    def test_existing_server_gets_guid_on_first_new_heartbeat(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """AC3: Existing server should get GUID from first heartbeat with GUID."""
        # Create server without GUID (old agent)
        create_server(client, auth_headers, "migration-test-server")

        # Verify server has no GUID initially
        server_response = client.get("/api/v1/servers/migration-test-server", headers=auth_headers)
        assert server_response.status_code == 200
        assert server_response.json().get("guid") is None

        # Send heartbeat with GUID (upgraded agent)
        test_guid = "b2c3d4e5-f6a7-4890-bcde-f12345678901"
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_guid": test_guid,
                "server_id": "migration-test-server",
                "hostname": "migration-test-server.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["server_registered"] is False  # Existing server

        # Verify server now has GUID
        server_response = client.get("/api/v1/servers/migration-test-server", headers=auth_headers)
        assert server_response.json()["guid"] == test_guid


class TestHeartbeatGuidConflict:
    """Tests for GUID conflict handling (US0070 - AC4)."""

    def test_heartbeat_with_same_guid_matches_existing_server(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Heartbeat with same GUID should match existing server (not conflict)."""
        test_guid = "c3d4e5f6-a7b8-4901-8def-123456789012"

        # Register first server with GUID
        response1 = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_guid": test_guid,
                "server_id": "first-server",
                "hostname": "first-server.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )
        assert response1.status_code == 200
        assert response1.json()["server_registered"] is True

        # Heartbeat with same GUID but different server_id should match by GUID
        response2 = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_guid": test_guid,
                "server_id": "second-server",  # Different server_id
                "hostname": "second-server.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )
        # Should match by GUID - not register new server
        assert response2.status_code == 200
        assert response2.json()["server_registered"] is False

    def test_guid_mismatch_on_existing_server_returns_409(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC4: GUID mismatch on existing server should return 409 Conflict."""
        # Register server with GUID
        original_guid = "d4e5f6a7-b8c9-4012-9ef0-234567890123"
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_guid": original_guid,
                "server_id": "mismatch-test-server",
                "hostname": "mismatch-test-server.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        # Try heartbeat with same server_id but different GUID
        different_guid = "e5f6a7b8-c9d0-4123-8f01-345678901234"
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_guid": different_guid,
                "server_id": "mismatch-test-server",  # Same server_id
                "hostname": "mismatch-test-server.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )
        assert response.status_code == 409
        assert response.json()["detail"]["code"] == "CONFLICT"


class TestHeartbeatVolatileFieldUpdates:
    """Tests for volatile field updates (US0070 - AC5)."""

    def test_hostname_updated_on_every_heartbeat(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC5: Hostname should be updated on every heartbeat."""
        test_guid = "f6a7b8c9-d0e1-4234-9012-456789012345"

        # First heartbeat with initial hostname
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_guid": test_guid,
                "server_id": "volatile-hostname-server",
                "hostname": "original-hostname.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        # Verify initial hostname
        server_response = client.get(
            "/api/v1/servers/volatile-hostname-server", headers=auth_headers
        )
        assert server_response.json()["hostname"] == "original-hostname.local"

        # Second heartbeat with new hostname (DHCP changed)
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_guid": test_guid,
                "server_id": "volatile-hostname-server",
                "hostname": "new-hostname.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        # Verify hostname was updated
        server_response = client.get(
            "/api/v1/servers/volatile-hostname-server", headers=auth_headers
        )
        assert server_response.json()["hostname"] == "new-hostname.local"


class TestHeartbeatGuidValidation:
    """Tests for GUID format validation."""

    def test_heartbeat_rejects_invalid_guid_format(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """GUID must be valid UUID v4 format."""
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_guid": "not-a-valid-uuid",
                "server_id": "invalid-guid-server",
                "hostname": "invalid-guid-server.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_heartbeat_rejects_uuid_v1_format(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """GUID must be UUID v4 specifically (not v1)."""
        # UUID v1 has a 1 in the version position (position 14)
        uuid_v1 = "550e8400-e29b-11d4-a716-446655440000"
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_guid": uuid_v1,
                "server_id": "uuid-v1-server",
                "hostname": "uuid-v1-server.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_heartbeat_accepts_valid_uuid_v4(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Valid UUID v4 should be accepted."""
        valid_uuid_v4 = "a7b8c9d0-e1f2-4345-8012-567890123456"
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_guid": valid_uuid_v4,
                "server_id": "valid-uuid-server",
                "hostname": "valid-uuid-server.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_heartbeat_accepts_lowercase_uuid(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Lowercase UUID should be accepted."""
        lowercase_uuid = "b8c9d0e1-f2a3-4456-9123-678901234567"
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_guid": lowercase_uuid,
                "server_id": "lowercase-uuid-server",
                "hostname": "lowercase-uuid-server.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )
        assert response.status_code == 200


class TestHeartbeatGuidAutoRegistration:
    """Tests for auto-registration with GUID."""

    def test_auto_registration_stores_guid(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Auto-registered server should have GUID stored."""
        test_guid = "c9d0e1f2-a3b4-4567-a234-789012345678"
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_guid": test_guid,
                "server_id": "auto-reg-guid-server",
                "hostname": "auto-reg-guid-server.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["server_registered"] is True

        # Verify GUID was stored
        server_response = client.get("/api/v1/servers/auto-reg-guid-server", headers=auth_headers)
        assert server_response.json()["guid"] == test_guid

    def test_auto_registration_without_guid_has_null_guid(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Auto-registered server without GUID should have null guid field."""
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "auto-reg-no-guid-server",
                "hostname": "auto-reg-no-guid-server.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["server_registered"] is True

        # Verify GUID is null
        server_response = client.get(
            "/api/v1/servers/auto-reg-no-guid-server", headers=auth_headers
        )
        assert server_response.json().get("guid") is None


class TestHeartbeatGuidBackwardCompatibility:
    """Tests for backward compatibility with old agents (US0070 - AC2)."""

    def test_old_agent_heartbeat_still_works(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Old agents without server_guid field should continue to work."""
        create_server(client, auth_headers, "old-agent-server")

        # Heartbeat without server_guid (old agent)
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "old-agent-server",
                "hostname": "old-agent-server.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "metrics": {"cpu_percent": 25.0, "memory_percent": 50.0},
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["server_registered"] is False

    def test_old_agent_can_upgrade_to_guid(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Old agent can upgrade by adding GUID in subsequent heartbeats."""
        create_server(client, auth_headers, "upgrade-agent-server")

        # First heartbeat without GUID (old agent)
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "upgrade-agent-server",
                "hostname": "upgrade-agent-server.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        # Second heartbeat with GUID (upgraded agent)
        test_guid = "d0e1f2a3-b4c5-4678-b345-890123456789"
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_guid": test_guid,
                "server_id": "upgrade-agent-server",
                "hostname": "upgrade-agent-server.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )
        assert response.status_code == 200

        # Verify GUID was added
        server_response = client.get("/api/v1/servers/upgrade-agent-server", headers=auth_headers)
        assert server_response.json()["guid"] == test_guid
