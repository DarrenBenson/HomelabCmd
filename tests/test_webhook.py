"""Tests for Test Webhook API (US0049: Test Webhook Button).

These tests verify the POST /api/v1/config/test-webhook endpoint
for sending test messages to Slack webhook URLs.

Spec Reference: sdlc-studio/testing/specs/TSP0005-settings-configuration.md
Test Cases: TC058-TC062
"""

from unittest.mock import AsyncMock, patch

import httpx
from fastapi.testclient import TestClient


class TestWebhookEndpoint:
    """Test POST /api/v1/config/test-webhook endpoint."""

    def test_test_webhook_requires_auth(self, client: TestClient) -> None:
        """POST /api/v1/config/test-webhook without auth should return 401."""
        response = client.post(
            "/api/v1/config/test-webhook",
            json={"webhook_url": "https://hooks.slack.com/test"},
        )
        assert response.status_code == 401

    def test_test_webhook_accepts_valid_request(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """POST /api/v1/config/test-webhook with valid URL should be accepted (TC058)."""
        with patch("homelab_cmd.api.routes.config.httpx.AsyncClient") as mock_client:
            mock_response = AsyncMock()
            mock_response.status_code = 200
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )

            response = client.post(
                "/api/v1/config/test-webhook",
                json={"webhook_url": "https://hooks.slack.com/services/T00/B00/xxx"},
                headers=auth_headers,
            )
            assert response.status_code == 200

    def test_test_webhook_returns_success_on_200(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Should return success=true when Slack returns 200 (TC059)."""
        with patch("homelab_cmd.api.routes.config.httpx.AsyncClient") as mock_client:
            mock_response = AsyncMock()
            mock_response.status_code = 200
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )

            response = client.post(
                "/api/v1/config/test-webhook",
                json={"webhook_url": "https://hooks.slack.com/services/valid"},
                headers=auth_headers,
            )

            data = response.json()
            assert data["success"] is True
            assert "message" in data
            assert "successfully" in data["message"].lower()

    def test_test_webhook_returns_error_on_404(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Should return error for invalid webhook URL (404 from Slack) (TC060)."""
        with patch("homelab_cmd.api.routes.config.httpx.AsyncClient") as mock_client:
            mock_response = AsyncMock()
            mock_response.status_code = 404
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )

            response = client.post(
                "/api/v1/config/test-webhook",
                json={"webhook_url": "https://hooks.slack.com/services/invalid"},
                headers=auth_headers,
            )

            data = response.json()
            assert data["success"] is False
            assert "error" in data
            assert "invalid" in data["error"].lower()

    def test_test_webhook_handles_timeout(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Should return timeout error when connection times out (TC061)."""
        with patch("homelab_cmd.api.routes.config.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                side_effect=httpx.TimeoutException("Connection timed out")
            )

            response = client.post(
                "/api/v1/config/test-webhook",
                json={"webhook_url": "https://hooks.slack.com/services/slow"},
                headers=auth_headers,
            )

            data = response.json()
            assert data["success"] is False
            assert "error" in data
            assert "timed out" in data["error"].lower()

    def test_test_webhook_handles_rate_limit(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Should return rate limit error when Slack returns 429 (TC062)."""
        with patch("homelab_cmd.api.routes.config.httpx.AsyncClient") as mock_client:
            mock_response = AsyncMock()
            mock_response.status_code = 429
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )

            response = client.post(
                "/api/v1/config/test-webhook",
                json={"webhook_url": "https://hooks.slack.com/services/ratelimited"},
                headers=auth_headers,
            )

            data = response.json()
            assert data["success"] is False
            assert "error" in data
            assert "too many" in data["error"].lower() or "rate" in data["error"].lower()

    def test_test_webhook_handles_connection_error(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Should return connection error when cannot reach URL."""
        with patch("homelab_cmd.api.routes.config.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                side_effect=httpx.ConnectError("Failed to connect")
            )

            response = client.post(
                "/api/v1/config/test-webhook",
                json={"webhook_url": "https://unreachable.example.com/webhook"},
                headers=auth_headers,
            )

            data = response.json()
            assert data["success"] is False
            assert "error" in data
            assert "connect" in data["error"].lower()

    def test_test_webhook_sends_correct_payload(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Webhook request should contain proper Slack message format."""
        with patch("homelab_cmd.api.routes.config.httpx.AsyncClient") as mock_client:
            mock_response = AsyncMock()
            mock_response.status_code = 200
            mock_post = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.post = mock_post

            webhook_url = "https://hooks.slack.com/services/T00/B00/xxx"
            client.post(
                "/api/v1/config/test-webhook",
                json={"webhook_url": webhook_url},
                headers=auth_headers,
            )

            # Verify the call was made to the correct URL
            mock_post.assert_called_once()
            call_args = mock_post.call_args
            assert call_args[0][0] == webhook_url

            # Verify payload structure
            payload = call_args[1]["json"]
            assert "attachments" in payload
            assert len(payload["attachments"]) > 0
            assert "blocks" in payload["attachments"][0]

    def test_test_webhook_requires_webhook_url(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Request without webhook_url should return 422."""
        response = client.post(
            "/api/v1/config/test-webhook",
            json={},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_test_webhook_handles_other_http_errors(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Should handle other HTTP status codes from Slack."""
        with patch("homelab_cmd.api.routes.config.httpx.AsyncClient") as mock_client:
            mock_response = AsyncMock()
            mock_response.status_code = 500
            mock_response.text = "Internal Server Error"
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )

            response = client.post(
                "/api/v1/config/test-webhook",
                json={"webhook_url": "https://hooks.slack.com/services/error"},
                headers=auth_headers,
            )

            data = response.json()
            assert data["success"] is False
            assert "error" in data
