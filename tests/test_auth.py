"""Tests for API authentication."""

from fastapi.testclient import TestClient


class TestApiKeyAuthentication:
    """Tests for X-API-Key header authentication."""

    def test_missing_api_key_returns_401(self, client: TestClient) -> None:
        """Request without X-API-Key header should return 401."""
        response = client.get("/api/v1/servers")

        assert response.status_code == 401
        assert response.json() == {
            "detail": {"code": "UNAUTHORIZED", "message": "Invalid or missing API key"}
        }

    def test_empty_api_key_returns_401(self, client: TestClient) -> None:
        """Request with empty X-API-Key header should return 401."""
        response = client.get("/api/v1/servers", headers={"X-API-Key": ""})

        assert response.status_code == 401
        assert response.json()["detail"]["code"] == "UNAUTHORIZED"

    def test_invalid_api_key_returns_401(self, client: TestClient) -> None:
        """Request with wrong X-API-Key should return 401."""
        response = client.get("/api/v1/servers", headers={"X-API-Key": "wrong-key"})

        assert response.status_code == 401
        assert response.json()["detail"]["code"] == "UNAUTHORIZED"

    def test_valid_api_key_allows_access(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Request with valid X-API-Key should succeed."""
        response = client.get("/api/v1/servers", headers=auth_headers)

        assert response.status_code == 200
        assert "servers" in response.json()

    def test_api_key_with_whitespace_trimmed(self, client: TestClient, api_key: str) -> None:
        """API key with leading/trailing whitespace should be trimmed."""
        response = client.get("/api/v1/servers", headers={"X-API-Key": f"  {api_key}  "})

        assert response.status_code == 200

    def test_health_check_without_auth(self, client: TestClient) -> None:
        """Health check endpoint should not require authentication."""
        response = client.get("/api/v1/system/health")

        assert response.status_code == 200
        assert response.json()["status"] == "healthy"

    def test_health_check_with_auth_still_works(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Health check should work even if API key is provided."""
        response = client.get("/api/v1/system/health", headers=auth_headers)

        assert response.status_code == 200


class TestCors:
    """Tests for CORS configuration."""

    def test_cors_headers_on_response(self, client: TestClient) -> None:
        """Response should include CORS headers."""
        response = client.get(
            "/api/v1/system/health",
            headers={"Origin": "http://localhost:3000"},
        )

        assert response.status_code == 200
        assert "access-control-allow-origin" in response.headers

    def test_cors_preflight_request(self, client: TestClient) -> None:
        """OPTIONS preflight request should succeed without auth."""
        response = client.options(
            "/api/v1/servers",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "X-API-Key",
            },
        )

        assert response.status_code == 200
        assert "access-control-allow-methods" in response.headers


class TestErrorResponseFormat:
    """Tests for standardised error response format."""

    def test_401_error_format(self, client: TestClient) -> None:
        """401 errors should follow the standard format."""
        response = client.get("/api/v1/servers")

        assert response.status_code == 401
        error = response.json()
        assert "detail" in error
        assert "code" in error["detail"]
        assert "message" in error["detail"]
        assert error["detail"]["code"] == "UNAUTHORIZED"
