"""API integration tests for synchronous command execution.

Part of EP0013: Synchronous Command Execution - US0153 Command Execution API.
Tests written using TDD approach before implementation.
"""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from homelab_cmd.services.ssh_executor import (
    CommandResult,
    CommandTimeoutError,
    SSHAuthenticationError,
    SSHConnectionError,
)


class TestCommandExecuteAuth:
    """Tests for authentication requirements (AC2 subset)."""

    def test_execute_requires_auth(self, client: TestClient) -> None:
        """Test that command execution requires authentication."""
        response = client.post(
            "/api/v1/servers/test-server/commands/execute",
            json={"command": "systemctl restart nginx", "action_type": "restart_service"},
        )
        assert response.status_code == 401


class TestCommandExecuteServerNotFound:
    """Tests for server not found (AC2 - 404)."""

    def test_server_not_found_returns_404(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC04: Server not found returns 404."""
        response = client.post(
            "/api/v1/servers/nonexistent-server/commands/execute",
            json={"command": "systemctl restart nginx", "action_type": "restart_service"},
            headers=auth_headers,
        )
        assert response.status_code == 404
        detail = response.json()["detail"]
        assert "not found" in detail.lower() or "NOT_FOUND" in str(detail)


class TestCommandExecuteWithServer:
    """Tests requiring a registered server with tailscale hostname."""

    @pytest.fixture(autouse=True)
    def setup_server(self, client: TestClient, auth_headers: dict[str, str]):
        """Create a test server for each test."""
        server_data = {
            "id": "cmd-test-server",
            "hostname": "cmd-test.local",
            "tailscale_hostname": "cmd-test.tailnet-abc.ts.net",
        }
        response = client.post(
            "/api/v1/servers",
            json=server_data,
            headers=auth_headers,
        )
        assert response.status_code == 201
        yield
        # Cleanup
        client.delete("/api/v1/servers/cmd-test-server", headers=auth_headers)

    def test_valid_command_returns_200(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC01: Valid command returns 200 with correct response schema."""
        mock_result = CommandResult(
            exit_code=0,
            stdout="Service restarted successfully\n",
            stderr="",
            duration_ms=150,
            hostname="cmd-test.tailnet-abc.ts.net",
        )

        with patch(
            "homelab_cmd.api.routes.commands.get_ssh_executor"
        ) as mock_get_executor:
            mock_executor = AsyncMock()
            mock_executor.execute.return_value = mock_result
            mock_get_executor.return_value = mock_executor

            response = client.post(
                "/api/v1/servers/cmd-test-server/commands/execute",
                json={
                    "command": "systemctl restart nginx",
                    "action_type": "restart_service",
                },
                headers=auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["exit_code"] == 0
        assert data["stdout"] == "Service restarted successfully\n"
        assert data["stderr"] == ""
        assert data["duration_ms"] >= 0

    def test_nonzero_exit_code_returns_200(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC02: Command with non-zero exit code still returns 200."""
        mock_result = CommandResult(
            exit_code=1,
            stdout="",
            stderr="Failed to restart nginx.service: Unit not found\n",
            duration_ms=50,
            hostname="cmd-test.tailnet-abc.ts.net",
        )

        with patch(
            "homelab_cmd.api.routes.commands.get_ssh_executor"
        ) as mock_get_executor:
            mock_executor = AsyncMock()
            mock_executor.execute.return_value = mock_result
            mock_get_executor.return_value = mock_executor

            response = client.post(
                "/api/v1/servers/cmd-test-server/commands/execute",
                json={
                    "command": "systemctl restart nginx",
                    "action_type": "restart_service",
                },
                headers=auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["exit_code"] == 1
        assert "Unit not found" in data["stderr"]

    def test_stdout_stderr_captured_correctly(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC03: Command stdout and stderr captured correctly."""
        expected_stdout = "Line 1\nLine 2\nLine 3\n"
        expected_stderr = "Warning: something\n"
        mock_result = CommandResult(
            exit_code=0,
            stdout=expected_stdout,
            stderr=expected_stderr,
            duration_ms=200,
            hostname="cmd-test.tailnet-abc.ts.net",
        )

        with patch(
            "homelab_cmd.api.routes.commands.get_ssh_executor"
        ) as mock_get_executor:
            mock_executor = AsyncMock()
            mock_executor.execute.return_value = mock_result
            mock_get_executor.return_value = mock_executor

            response = client.post(
                "/api/v1/servers/cmd-test-server/commands/execute",
                json={
                    "command": "systemctl restart nginx",
                    "action_type": "restart_service",
                },
                headers=auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["stdout"] == expected_stdout
        assert data["stderr"] == expected_stderr

    def test_unwhitelisted_command_returns_400(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC05: Unwhitelisted command returns 400."""
        response = client.post(
            "/api/v1/servers/cmd-test-server/commands/execute",
            json={
                "command": "rm -rf /",
                "action_type": "unknown_action",
            },
            headers=auth_headers,
        )

        assert response.status_code == 400
        detail = response.json()["detail"]
        # Should mention whitelist or not allowed
        assert "whitelist" in str(detail).lower() or "not allowed" in str(detail).lower()

    def test_command_timeout_returns_408(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC06: Command timeout returns 408."""
        with patch(
            "homelab_cmd.api.routes.commands.get_ssh_executor"
        ) as mock_get_executor:
            mock_executor = AsyncMock()
            mock_executor.execute.side_effect = CommandTimeoutError(
                hostname="cmd-test.tailnet-abc.ts.net",
                command="systemctl restart nginx",
                timeout=30,
            )
            mock_get_executor.return_value = mock_executor

            response = client.post(
                "/api/v1/servers/cmd-test-server/commands/execute",
                json={
                    "command": "systemctl restart nginx",
                    "action_type": "restart_service",
                },
                headers=auth_headers,
            )

        assert response.status_code == 408
        detail = response.json()["detail"]
        assert "timed out" in str(detail).lower() or "timeout" in str(detail).lower()

    def test_ssh_connection_error_returns_500(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC07: SSH connection failure returns 500."""
        with patch(
            "homelab_cmd.api.routes.commands.get_ssh_executor"
        ) as mock_get_executor:
            mock_executor = AsyncMock()
            mock_executor.execute.side_effect = SSHConnectionError(
                hostname="cmd-test.tailnet-abc.ts.net",
                last_error=Exception("Connection refused"),
                attempts=3,
            )
            mock_get_executor.return_value = mock_executor

            response = client.post(
                "/api/v1/servers/cmd-test-server/commands/execute",
                json={
                    "command": "systemctl restart nginx",
                    "action_type": "restart_service",
                },
                headers=auth_headers,
            )

        assert response.status_code == 500
        detail = response.json()["detail"]
        assert "ssh" in str(detail).lower() or "connection" in str(detail).lower()

    def test_ssh_auth_error_returns_500(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC08: SSH authentication failure returns 500."""
        with patch(
            "homelab_cmd.api.routes.commands.get_ssh_executor"
        ) as mock_get_executor:
            mock_executor = AsyncMock()
            mock_executor.execute.side_effect = SSHAuthenticationError(
                hostname="cmd-test.tailnet-abc.ts.net",
                username="homelabcmd",
            )
            mock_get_executor.return_value = mock_executor

            response = client.post(
                "/api/v1/servers/cmd-test-server/commands/execute",
                json={
                    "command": "systemctl restart nginx",
                    "action_type": "restart_service",
                },
                headers=auth_headers,
            )

        assert response.status_code == 500
        detail = response.json()["detail"]
        assert "auth" in str(detail).lower()


class TestCommandExecuteRateLimiting:
    """Tests for rate limiting (AC3)."""

    @pytest.fixture(autouse=True)
    def setup_server(self, client: TestClient, auth_headers: dict[str, str]):
        """Create a test server for rate limit tests."""
        server_data = {
            "id": "ratelimit-test-server",
            "hostname": "ratelimit.local",
            "tailscale_hostname": "ratelimit.tailnet-abc.ts.net",
        }
        response = client.post(
            "/api/v1/servers",
            json=server_data,
            headers=auth_headers,
        )
        assert response.status_code == 201
        yield
        # Cleanup
        client.delete("/api/v1/servers/ratelimit-test-server", headers=auth_headers)

    def test_rate_limit_allows_10_requests(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC09: Rate limit allows 10 requests per minute."""
        mock_result = CommandResult(
            exit_code=0,
            stdout="OK",
            stderr="",
            duration_ms=10,
            hostname="ratelimit.tailnet-abc.ts.net",
        )

        with patch(
            "homelab_cmd.api.routes.commands.get_ssh_executor"
        ) as mock_get_executor:
            mock_executor = AsyncMock()
            mock_executor.execute.return_value = mock_result
            mock_get_executor.return_value = mock_executor

            # Clear any existing rate limit state
            with patch(
                "homelab_cmd.api.routes.commands._rate_limit_store", {}
            ):
                responses = []
                for _ in range(10):
                    response = client.post(
                        "/api/v1/servers/ratelimit-test-server/commands/execute",
                        json={
                            "command": "systemctl restart nginx",
                            "action_type": "restart_service",
                        },
                        headers=auth_headers,
                    )
                    responses.append(response.status_code)

        # All 10 should succeed (200)
        assert all(status == 200 for status in responses), f"Got statuses: {responses}"

    def test_rate_limit_returns_429_at_11th_request(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC10: Rate limit returns 429 at 11th request."""
        mock_result = CommandResult(
            exit_code=0,
            stdout="OK",
            stderr="",
            duration_ms=10,
            hostname="ratelimit.tailnet-abc.ts.net",
        )

        with patch(
            "homelab_cmd.api.routes.commands.get_ssh_executor"
        ) as mock_get_executor:
            mock_executor = AsyncMock()
            mock_executor.execute.return_value = mock_result
            mock_get_executor.return_value = mock_executor

            # Clear any existing rate limit state
            with patch(
                "homelab_cmd.api.routes.commands._rate_limit_store", {}
            ):
                # Make 10 successful requests
                for _ in range(10):
                    client.post(
                        "/api/v1/servers/ratelimit-test-server/commands/execute",
                        json={
                            "command": "systemctl restart nginx",
                            "action_type": "restart_service",
                        },
                        headers=auth_headers,
                    )

                # 11th request should be rate limited
                response = client.post(
                    "/api/v1/servers/ratelimit-test-server/commands/execute",
                    json={
                        "command": "systemctl restart nginx",
                        "action_type": "restart_service",
                    },
                    headers=auth_headers,
                )

        assert response.status_code == 429
        assert "Retry-After" in response.headers
        detail = response.json()["detail"]
        assert "rate" in str(detail).lower() or "limit" in str(detail).lower()


class TestCommandExecuteOpenAPI:
    """Tests for OpenAPI documentation (AC4)."""

    def test_openapi_schema_includes_endpoint(self, client: TestClient) -> None:
        """TC11: OpenAPI schema includes execute endpoint."""
        response = client.get("/api/openapi.json")
        assert response.status_code == 200

        schema = response.json()
        paths = schema.get("paths", {})

        # Check that the endpoint exists
        execute_path = "/api/v1/servers/{server_id}/commands/execute"
        assert execute_path in paths, f"Endpoint not found. Available paths: {list(paths.keys())}"

        # Check POST method exists
        post_schema = paths[execute_path].get("post", {})
        assert post_schema, "POST method not found"

        # Check request body schema references command and action_type
        request_body = post_schema.get("requestBody", {})
        assert request_body, "Request body schema missing"

        # Check response schema
        responses = post_schema.get("responses", {})
        assert "200" in responses, "200 response not documented"


class TestCommandExecuteValidation:
    """Tests for input validation."""

    @pytest.fixture(autouse=True)
    def setup_server(self, client: TestClient, auth_headers: dict[str, str]):
        """Create a test server for validation tests."""
        server_data = {
            "id": "validation-test-server",
            "hostname": "validation.local",
            "tailscale_hostname": "validation.tailnet-abc.ts.net",
        }
        response = client.post(
            "/api/v1/servers",
            json=server_data,
            headers=auth_headers,
        )
        assert response.status_code == 201
        yield
        client.delete("/api/v1/servers/validation-test-server", headers=auth_headers)

    def test_empty_command_returns_422(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Empty command should return 422 validation error."""
        response = client.post(
            "/api/v1/servers/validation-test-server/commands/execute",
            json={
                "command": "",
                "action_type": "restart_service",
            },
            headers=auth_headers,
        )
        # Pydantic validation error
        assert response.status_code == 422

    def test_missing_action_type_returns_422(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Missing action_type should return 422 validation error."""
        response = client.post(
            "/api/v1/servers/validation-test-server/commands/execute",
            json={
                "command": "systemctl restart nginx",
            },
            headers=auth_headers,
        )
        assert response.status_code == 422
