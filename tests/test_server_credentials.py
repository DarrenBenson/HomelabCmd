"""Tests for Per-Server Credential API Endpoints (US0087).

These tests verify the server credential endpoints for EP0015: Per-Host Credential Management.

Spec Reference: sdlc-studio/stories/US0087-per-server-credential-api.md
"""

from fastapi.testclient import TestClient


class TestListServerCredentials:
    """Tests for GET /api/v1/servers/{server_id}/credentials (AC1)."""

    def test_list_credentials_returns_200(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """GET /api/v1/servers/{id}/credentials should return 200 OK."""
        create_server(client, auth_headers, "test-creds-server")
        response = client.get("/api/v1/servers/test-creds-server/credentials", headers=auth_headers)
        assert response.status_code == 200

    def test_list_credentials_returns_server_id(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Response should include the server_id."""
        create_server(client, auth_headers, "test-creds-server-id")
        response = client.get(
            "/api/v1/servers/test-creds-server-id/credentials", headers=auth_headers
        )
        assert response.json()["server_id"] == "test-creds-server-id"

    def test_list_credentials_returns_credential_types(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Response should include list of credential types."""
        create_server(client, auth_headers, "test-creds-types")
        response = client.get("/api/v1/servers/test-creds-types/credentials", headers=auth_headers)
        data = response.json()
        assert "credentials" in data
        assert isinstance(data["credentials"], list)
        # Should have entries for each credential type
        cred_types = [c["credential_type"] for c in data["credentials"]]
        assert "ssh_private_key" in cred_types
        assert "sudo_password" in cred_types
        assert "ssh_password" in cred_types

    def test_list_credentials_shows_scope_none_when_not_configured(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Credentials should show scope 'none' when not configured."""
        create_server(client, auth_headers, "test-no-creds")
        response = client.get("/api/v1/servers/test-no-creds/credentials", headers=auth_headers)
        credentials = response.json()["credentials"]
        # All should be scope 'none' since nothing configured
        for cred in credentials:
            assert cred["scope"] == "none"
            assert cred["configured"] is False

    def test_list_credentials_includes_ssh_username(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Response should include ssh_username field."""
        create_server(client, auth_headers, "test-username")
        response = client.get("/api/v1/servers/test-username/credentials", headers=auth_headers)
        assert "ssh_username" in response.json()

    def test_list_credentials_includes_sudo_mode(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Response should include sudo_mode field."""
        create_server(client, auth_headers, "test-sudo-mode")
        response = client.get("/api/v1/servers/test-sudo-mode/credentials", headers=auth_headers)
        data = response.json()
        assert "sudo_mode" in data
        assert data["sudo_mode"] == "passwordless"  # Default

    def test_list_credentials_404_for_nonexistent_server(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Returns 404 when server doesn't exist."""
        response = client.get("/api/v1/servers/nonexistent/credentials", headers=auth_headers)
        assert response.status_code == 404
        assert "NOT_FOUND" in response.json()["detail"]["code"]

    def test_list_credentials_requires_auth(self, client: TestClient) -> None:
        """Returns 401 without authentication."""
        response = client.get("/api/v1/servers/any-server/credentials")
        assert response.status_code == 401

    def test_list_credentials_never_returns_values(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Response should NEVER include credential values (AC1)."""
        create_server(client, auth_headers, "test-no-values")
        # Store a credential first
        client.post(
            "/api/v1/servers/test-no-values/credentials",
            json={"credential_type": "sudo_password", "value": "secret123"},
            headers=auth_headers,
        )
        # List should not return the value
        response = client.get("/api/v1/servers/test-no-values/credentials", headers=auth_headers)
        data = response.json()
        # Check no 'value' field anywhere
        assert "value" not in data
        for cred in data["credentials"]:
            assert "value" not in cred


class TestStoreServerCredential:
    """Tests for POST /api/v1/servers/{server_id}/credentials (AC2)."""

    def test_store_credential_returns_200(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """POST /api/v1/servers/{id}/credentials should return 200 OK."""
        create_server(client, auth_headers, "test-store-cred")
        response = client.post(
            "/api/v1/servers/test-store-cred/credentials",
            json={"credential_type": "sudo_password", "value": "mypassword"},
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_store_credential_returns_confirmation(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Response should confirm the stored credential type."""
        create_server(client, auth_headers, "test-store-confirm")
        response = client.post(
            "/api/v1/servers/test-store-confirm/credentials",
            json={"credential_type": "sudo_password", "value": "mypassword"},
            headers=auth_headers,
        )
        data = response.json()
        assert data["credential_type"] == "sudo_password"
        assert data["server_id"] == "test-store-confirm"
        assert "message" in data

    def test_store_credential_never_echoes_value(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Response should NEVER echo the credential value (AC2)."""
        create_server(client, auth_headers, "test-no-echo")
        response = client.post(
            "/api/v1/servers/test-no-echo/credentials",
            json={"credential_type": "sudo_password", "value": "secret"},
            headers=auth_headers,
        )
        data = response.json()
        # Value should not appear in response
        assert "value" not in data
        assert "secret" not in str(data)

    def test_store_credential_shows_per_server_scope(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """After storing, list should show scope='per_server'."""
        create_server(client, auth_headers, "test-scope-server")
        # Store credential
        client.post(
            "/api/v1/servers/test-scope-server/credentials",
            json={"credential_type": "sudo_password", "value": "mypassword"},
            headers=auth_headers,
        )
        # List should show per_server scope
        response = client.get("/api/v1/servers/test-scope-server/credentials", headers=auth_headers)
        credentials = response.json()["credentials"]
        sudo_cred = next(c for c in credentials if c["credential_type"] == "sudo_password")
        assert sudo_cred["scope"] == "per_server"
        assert sudo_cred["configured"] is True

    def test_store_credential_404_for_nonexistent_server(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Returns 404 when server doesn't exist."""
        response = client.post(
            "/api/v1/servers/nonexistent/credentials",
            json={"credential_type": "sudo_password", "value": "test"},
            headers=auth_headers,
        )
        assert response.status_code == 404
        assert "NOT_FOUND" in response.json()["detail"]["code"]

    def test_store_credential_requires_auth(self, client: TestClient) -> None:
        """Returns 401 without authentication."""
        response = client.post(
            "/api/v1/servers/any-server/credentials",
            json={"credential_type": "sudo_password", "value": "test"},
        )
        assert response.status_code == 401

    def test_store_credential_invalid_type_returns_400(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Invalid credential type returns 400 with valid types (AC5)."""
        create_server(client, auth_headers, "test-invalid-type")
        response = client.post(
            "/api/v1/servers/test-invalid-type/credentials",
            json={"credential_type": "invalid_type", "value": "test"},
            headers=auth_headers,
        )
        assert response.status_code == 400
        detail = response.json()["detail"]
        assert "INVALID_CREDENTIAL_TYPE" in detail["code"]
        # Should list valid types
        assert "sudo_password" in detail["message"]
        assert "ssh_private_key" in detail["message"]
        assert "ssh_password" in detail["message"]

    def test_store_credential_empty_value_rejected(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Empty credential value returns 422 validation error."""
        create_server(client, auth_headers, "test-empty-value")
        response = client.post(
            "/api/v1/servers/test-empty-value/credentials",
            json={"credential_type": "sudo_password", "value": ""},
            headers=auth_headers,
        )
        assert response.status_code == 422


class TestDeleteServerCredential:
    """Tests for DELETE /api/v1/servers/{server_id}/credentials/{type} (AC3)."""

    def test_delete_credential_returns_200(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """DELETE /api/v1/servers/{id}/credentials/{type} should return 200."""
        create_server(client, auth_headers, "test-delete-cred")
        # Store a credential first
        client.post(
            "/api/v1/servers/test-delete-cred/credentials",
            json={"credential_type": "sudo_password", "value": "mypassword"},
            headers=auth_headers,
        )
        # Delete it
        response = client.delete(
            "/api/v1/servers/test-delete-cred/credentials/sudo_password",
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_delete_credential_returns_confirmation(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Response should confirm deletion."""
        create_server(client, auth_headers, "test-delete-confirm")
        client.post(
            "/api/v1/servers/test-delete-confirm/credentials",
            json={"credential_type": "sudo_password", "value": "mypassword"},
            headers=auth_headers,
        )
        response = client.delete(
            "/api/v1/servers/test-delete-confirm/credentials/sudo_password",
            headers=auth_headers,
        )
        data = response.json()
        assert "message" in data
        assert data["fallback_to_global"] is True

    def test_delete_credential_falls_back_to_none(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """After deletion, scope falls back to 'none' (AC3)."""
        create_server(client, auth_headers, "test-fallback")
        # Store and delete
        client.post(
            "/api/v1/servers/test-fallback/credentials",
            json={"credential_type": "sudo_password", "value": "mypassword"},
            headers=auth_headers,
        )
        client.delete(
            "/api/v1/servers/test-fallback/credentials/sudo_password",
            headers=auth_headers,
        )
        # List should show scope='none'
        response = client.get("/api/v1/servers/test-fallback/credentials", headers=auth_headers)
        credentials = response.json()["credentials"]
        sudo_cred = next(c for c in credentials if c["credential_type"] == "sudo_password")
        # No global credential, so should be 'none'
        assert sudo_cred["scope"] == "none"
        assert sudo_cred["configured"] is False

    def test_delete_nonexistent_credential_returns_404(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Returns 404 when credential doesn't exist."""
        create_server(client, auth_headers, "test-delete-404")
        response = client.delete(
            "/api/v1/servers/test-delete-404/credentials/sudo_password",
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_delete_credential_404_for_nonexistent_server(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Returns 404 when server doesn't exist."""
        response = client.delete(
            "/api/v1/servers/nonexistent/credentials/sudo_password",
            headers=auth_headers,
        )
        assert response.status_code == 404
        assert "NOT_FOUND" in response.json()["detail"]["code"]

    def test_delete_credential_requires_auth(self, client: TestClient) -> None:
        """Returns 401 without authentication."""
        response = client.delete("/api/v1/servers/any-server/credentials/sudo_password")
        assert response.status_code == 401

    def test_delete_credential_invalid_type_returns_400(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Invalid credential type returns 400 (AC5)."""
        create_server(client, auth_headers, "test-delete-invalid")
        response = client.delete(
            "/api/v1/servers/test-delete-invalid/credentials/invalid_type",
            headers=auth_headers,
        )
        assert response.status_code == 400
        detail = response.json()["detail"]
        assert "INVALID_CREDENTIAL_TYPE" in detail["code"]


class TestUpdateServerCredentialSettings:
    """Tests for PATCH /api/v1/servers/{server_id} with ssh_username/sudo_mode (AC4)."""

    def test_update_ssh_username_via_put(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """PUT /api/v1/servers/{id} should update ssh_username."""
        create_server(client, auth_headers, "test-ssh-user")
        response = client.put(
            "/api/v1/servers/test-ssh-user",
            json={"ssh_username": "admin"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["ssh_username"] == "admin"

    def test_update_sudo_mode_via_put(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """PUT /api/v1/servers/{id} should update sudo_mode."""
        create_server(client, auth_headers, "test-sudo")
        response = client.put(
            "/api/v1/servers/test-sudo",
            json={"sudo_mode": "password"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["sudo_mode"] == "password"

    def test_update_ssh_username_and_sudo_mode_together(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Both can be updated in same request."""
        create_server(client, auth_headers, "test-both")
        response = client.put(
            "/api/v1/servers/test-both",
            json={"ssh_username": "deploy", "sudo_mode": "password"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["ssh_username"] == "deploy"
        assert data["sudo_mode"] == "password"

    def test_get_server_includes_ssh_username(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """GET /api/v1/servers/{id} should include ssh_username."""
        create_server(client, auth_headers, "test-get-user")
        response = client.get("/api/v1/servers/test-get-user", headers=auth_headers)
        assert "ssh_username" in response.json()

    def test_get_server_includes_sudo_mode(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """GET /api/v1/servers/{id} should include sudo_mode with default."""
        create_server(client, auth_headers, "test-get-sudo")
        response = client.get("/api/v1/servers/test-get-sudo", headers=auth_headers)
        data = response.json()
        assert "sudo_mode" in data
        assert data["sudo_mode"] == "passwordless"  # Default

    def test_list_servers_includes_ssh_username(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """GET /api/v1/servers should include ssh_username."""
        create_server(client, auth_headers, "test-list-user")
        client.put(
            "/api/v1/servers/test-list-user",
            json={"ssh_username": "myuser"},
            headers=auth_headers,
        )
        response = client.get("/api/v1/servers", headers=auth_headers)
        servers = response.json()["servers"]
        server = next(s for s in servers if s["id"] == "test-list-user")
        assert server["ssh_username"] == "myuser"

    def test_list_servers_includes_sudo_mode(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """GET /api/v1/servers should include sudo_mode."""
        create_server(client, auth_headers, "test-list-sudo")
        response = client.get("/api/v1/servers", headers=auth_headers)
        servers = response.json()["servers"]
        server = next(s for s in servers if s["id"] == "test-list-sudo")
        assert "sudo_mode" in server
        assert server["sudo_mode"] == "passwordless"

    def test_invalid_sudo_mode_rejected(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Invalid sudo_mode value returns 422 validation error."""
        create_server(client, auth_headers, "test-invalid-sudo")
        response = client.put(
            "/api/v1/servers/test-invalid-sudo",
            json={"sudo_mode": "invalid_mode"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_clear_ssh_username(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Setting ssh_username to null clears it."""
        create_server(client, auth_headers, "test-clear-user")
        # Set username
        client.put(
            "/api/v1/servers/test-clear-user",
            json={"ssh_username": "admin"},
            headers=auth_headers,
        )
        # Clear it
        response = client.put(
            "/api/v1/servers/test-clear-user",
            json={"ssh_username": None},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["ssh_username"] is None
