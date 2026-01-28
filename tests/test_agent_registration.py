"""Integration tests for agent registration API.

Tests cover the full registration flow: create token, claim token, heartbeat with
per-agent auth, token rotation, and token revocation.
"""

from fastapi.testclient import TestClient


class TestCreateRegistrationToken:
    """Tests for POST /api/v1/agents/register/tokens."""

    def test_create_registration_token_success(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Should create registration token and return plaintext."""
        response = client.post(
            "/api/v1/agents/register/tokens",
            json={"mode": "readonly"},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["token"].startswith("hlh_rt_")
        assert data["token_prefix"].startswith("hlh_rt_")
        assert data["expires_at"] is not None
        assert "install_command" in data
        assert "--token" in data["install_command"]

    def test_create_registration_token_with_options(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Should accept display_name, services, and custom expiry."""
        response = client.post(
            "/api/v1/agents/register/tokens",
            json={
                "mode": "readwrite",
                "display_name": "My Server",
                "monitored_services": ["nginx", "docker"],
                "expiry_minutes": 30,
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["token"].startswith("hlh_rt_")

    def test_create_registration_token_requires_auth(
        self, client: TestClient
    ) -> None:
        """Should require authentication."""
        response = client.post(
            "/api/v1/agents/register/tokens",
            json={"mode": "readonly"},
        )

        assert response.status_code == 401


class TestListRegistrationTokens:
    """Tests for GET /api/v1/agents/register/tokens."""

    def test_list_registration_tokens_empty(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Should return empty list when no tokens exist."""
        response = client.get(
            "/api/v1/agents/register/tokens",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["tokens"] == []
        assert data["total"] == 0

    def test_list_registration_tokens_shows_pending(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Should list pending tokens."""
        # Create a token
        client.post(
            "/api/v1/agents/register/tokens",
            json={"mode": "readonly", "display_name": "Test Server"},
            headers=auth_headers,
        )

        response = client.get(
            "/api/v1/agents/register/tokens",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["tokens"]) == 1
        assert data["total"] == 1
        assert data["tokens"][0]["display_name"] == "Test Server"
        assert data["tokens"][0]["mode"] == "readonly"
        assert data["tokens"][0]["token_prefix"].startswith("hlh_rt_")
        assert data["tokens"][0]["is_expired"] is False
        assert data["tokens"][0]["is_claimed"] is False


class TestCancelRegistrationToken:
    """Tests for DELETE /api/v1/agents/register/tokens/{token_id}."""

    def test_cancel_registration_token_success(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Should cancel pending token."""
        # Create a token
        create_response = client.post(
            "/api/v1/agents/register/tokens",
            json={"mode": "readonly"},
            headers=auth_headers,
        )
        token = create_response.json()["token"]

        # Get the token ID from the list
        list_response = client.get(
            "/api/v1/agents/register/tokens",
            headers=auth_headers,
        )
        token_id = list_response.json()["tokens"][0]["id"]

        # Cancel it
        response = client.delete(
            f"/api/v1/agents/register/tokens/{token_id}",
            headers=auth_headers,
        )

        assert response.status_code == 204

        # Verify it's gone
        list_response = client.get(
            "/api/v1/agents/register/tokens",
            headers=auth_headers,
        )
        assert len(list_response.json()["tokens"]) == 0

    def test_cancel_nonexistent_token(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Should return 404 for non-existent token."""
        response = client.delete(
            "/api/v1/agents/register/tokens/99999",
            headers=auth_headers,
        )

        assert response.status_code == 404


class TestClaimRegistrationToken:
    """Tests for POST /api/v1/agents/register/claim."""

    def test_claim_token_success(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Full claim flow should create server and return credentials."""
        # Create a token
        create_response = client.post(
            "/api/v1/agents/register/tokens",
            json={"mode": "readonly", "display_name": "Test Server"},
            headers=auth_headers,
        )
        token = create_response.json()["token"]

        # Claim the token (no auth required - token is the auth)
        response = client.post(
            "/api/v1/agents/register/claim",
            json={
                "token": token,
                "server_id": "test-server",
                "hostname": "test.local",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["server_id"] == "test-server"
        assert data["server_guid"] is not None
        assert data["api_token"].startswith("hlh_ag_")
        assert "hub_url:" in data["config_yaml"]
        assert "server_id: test-server" in data["config_yaml"]

    def test_claim_token_creates_server(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Claiming should create the server record."""
        # Create and claim a token
        create_response = client.post(
            "/api/v1/agents/register/tokens",
            json={"mode": "readonly", "display_name": "My New Server"},
            headers=auth_headers,
        )
        token = create_response.json()["token"]

        client.post(
            "/api/v1/agents/register/claim",
            json={
                "token": token,
                "server_id": "new-server",
                "hostname": "new.local",
            },
        )

        # Verify server exists
        server_response = client.get(
            "/api/v1/servers/new-server",
            headers=auth_headers,
        )
        assert server_response.status_code == 200
        assert server_response.json()["display_name"] == "My New Server"

    def test_claim_invalid_token_fails(self, client: TestClient) -> None:
        """Should return 400 for invalid token."""
        response = client.post(
            "/api/v1/agents/register/claim",
            json={
                "token": "hlh_rt_" + "a" * 64,  # Valid format, but doesn't exist
                "server_id": "test-server",
                "hostname": "test.local",
            },
        )

        # Invalid tokens return 400 Bad Request
        assert response.status_code == 400


class TestPerAgentAuthentication:
    """Tests for per-agent token authentication on heartbeat."""

    def test_heartbeat_with_per_agent_token(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Agent should authenticate with per-agent token."""
        # Create and claim a token
        create_response = client.post(
            "/api/v1/agents/register/tokens",
            json={"mode": "readonly"},
            headers=auth_headers,
        )
        token = create_response.json()["token"]

        claim_response = client.post(
            "/api/v1/agents/register/claim",
            json={
                "token": token,
                "server_id": "per-agent-server",
                "hostname": "peragent.local",
            },
        )
        api_token = claim_response.json()["api_token"]
        server_guid = claim_response.json()["server_guid"]

        # Send heartbeat with per-agent auth
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "per-agent-server",
                "hostname": "peragent.local",
                "timestamp": "2026-01-22T12:00:00Z",
            },
            headers={
                "X-Agent-Token": api_token,
                "X-Server-GUID": server_guid,
            },
        )

        assert response.status_code == 200

    def test_heartbeat_with_legacy_api_key(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Legacy agents should still work with shared API key."""
        # Create server via legacy heartbeat
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "legacy-server",
                "hostname": "legacy.local",
                "timestamp": "2026-01-22T12:00:00Z",
            },
            headers=auth_headers,  # Uses X-API-Key
        )

        assert response.status_code == 200

    def test_heartbeat_with_invalid_token_fails(self, client: TestClient) -> None:
        """Invalid per-agent token should be rejected."""
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "test-server",
                "hostname": "test.local",
                "timestamp": "2026-01-22T12:00:00Z",
            },
            headers={
                "X-Agent-Token": "hlh_ag_invalid_token",
                "X-Server-GUID": "invalid-guid",
            },
        )

        assert response.status_code == 401


class TestTokenRotation:
    """Tests for POST /api/v1/agents/register/credentials/{guid}/rotate."""

    def test_rotate_token_success(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Should rotate token and return new one."""
        # Create and claim a token
        create_response = client.post(
            "/api/v1/agents/register/tokens",
            json={"mode": "readonly"},
            headers=auth_headers,
        )
        token = create_response.json()["token"]

        claim_response = client.post(
            "/api/v1/agents/register/claim",
            json={
                "token": token,
                "server_id": "rotate-test",
                "hostname": "rotate.local",
            },
        )
        old_api_token = claim_response.json()["api_token"]
        server_guid = claim_response.json()["server_guid"]

        # Rotate the token
        rotate_response = client.post(
            f"/api/v1/agents/register/credentials/{server_guid}/rotate",
            json={},
            headers=auth_headers,
        )

        assert rotate_response.status_code == 200
        data = rotate_response.json()
        assert data["success"] is True
        assert data["api_token"].startswith("hlh_ag_")
        assert data["api_token"] != old_api_token

        # Old token should no longer work
        old_heartbeat = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "rotate-test",
                "hostname": "rotate.local",
                "timestamp": "2026-01-22T12:00:00Z",
            },
            headers={
                "X-Agent-Token": old_api_token,
                "X-Server-GUID": server_guid,
            },
        )
        assert old_heartbeat.status_code == 401

        # New token should work
        new_heartbeat = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "rotate-test",
                "hostname": "rotate.local",
                "timestamp": "2026-01-22T12:00:00Z",
            },
            headers={
                "X-Agent-Token": data["api_token"],
                "X-Server-GUID": server_guid,
            },
        )
        assert new_heartbeat.status_code == 200


class TestTokenRevocation:
    """Tests for POST /api/v1/agents/register/credentials/{guid}/revoke."""

    def test_revoke_token_success(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Should revoke token and block further auth."""
        # Create and claim a token
        create_response = client.post(
            "/api/v1/agents/register/tokens",
            json={"mode": "readonly"},
            headers=auth_headers,
        )
        token = create_response.json()["token"]

        claim_response = client.post(
            "/api/v1/agents/register/claim",
            json={
                "token": token,
                "server_id": "revoke-test",
                "hostname": "revoke.local",
            },
        )
        api_token = claim_response.json()["api_token"]
        server_guid = claim_response.json()["server_guid"]

        # Token should work before revocation
        pre_revoke = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "revoke-test",
                "hostname": "revoke.local",
                "timestamp": "2026-01-22T12:00:00Z",
            },
            headers={
                "X-Agent-Token": api_token,
                "X-Server-GUID": server_guid,
            },
        )
        assert pre_revoke.status_code == 200

        # Revoke the token
        revoke_response = client.post(
            f"/api/v1/agents/register/credentials/{server_guid}/revoke",
            json={},
            headers=auth_headers,
        )

        assert revoke_response.status_code == 200
        assert revoke_response.json()["success"] is True

        # Token should no longer work
        post_revoke = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "revoke-test",
                "hostname": "revoke.local",
                "timestamp": "2026-01-22T12:00:00Z",
            },
            headers={
                "X-Agent-Token": api_token,
                "X-Server-GUID": server_guid,
            },
        )
        assert post_revoke.status_code == 401


class TestGetAgentCredential:
    """Tests for GET /api/v1/agents/register/credentials/{guid}."""

    def test_get_credential_success(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Should return credential metadata (not the token)."""
        # Create and claim a token
        create_response = client.post(
            "/api/v1/agents/register/tokens",
            json={"mode": "readonly"},
            headers=auth_headers,
        )
        token = create_response.json()["token"]

        claim_response = client.post(
            "/api/v1/agents/register/claim",
            json={
                "token": token,
                "server_id": "cred-test",
                "hostname": "cred.local",
            },
        )
        server_guid = claim_response.json()["server_guid"]

        # Get credential info
        response = client.get(
            f"/api/v1/agents/register/credentials/{server_guid}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["server_guid"] == server_guid
        assert data["api_token_prefix"].startswith("hlh_ag_")
        assert data["is_revoked"] is False
        assert data["is_legacy"] is False

    def test_get_credential_not_found(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Should return 404 for non-existent credential."""
        response = client.get(
            "/api/v1/agents/register/credentials/nonexistent-guid",
            headers=auth_headers,
        )

        assert response.status_code == 404


class TestInstallScriptEndpoint:
    """Tests for GET /api/v1/agents/register/install.sh."""

    def test_get_install_script(self, client: TestClient) -> None:
        """Should return bash install script (no auth required)."""
        response = client.get("/api/v1/agents/register/install.sh")

        assert response.status_code == 200
        assert "text/" in response.headers.get("content-type", "")
        content = response.text
        assert "#!/bin/bash" in content
        assert "--token" in content
