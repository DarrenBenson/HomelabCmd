"""Tests for Cost Summary API (US0035: Dashboard Cost Summary Display).

These tests verify the cost summary endpoint that calculates estimated electricity costs.
Tests follow TDD approach - written before implementation.

Spec Reference: sdlc-studio/stories/US0035-dashboard-cost-display.md
Test Spec: sdlc-studio/test-specs/TS0012-cost-tracking.md
"""

from fastapi.testclient import TestClient


class TestGetCostSummary:
    """Test GET /api/v1/costs/summary endpoint."""

    def test_get_cost_summary_returns_200(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """GET /api/v1/costs/summary should return 200 OK (TC079)."""
        response = client.get("/api/v1/costs/summary", headers=auth_headers)
        assert response.status_code == 200

    def test_get_cost_summary_returns_structure(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should contain all required fields (TC079)."""
        response = client.get("/api/v1/costs/summary", headers=auth_headers)
        data = response.json()
        assert "daily_cost" in data
        assert "monthly_cost" in data
        assert "currency_symbol" in data
        assert "servers_included" in data
        assert "servers_missing_tdp" in data
        assert "total_tdp_watts" in data
        assert "electricity_rate" in data

    def test_get_cost_summary_no_servers(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """With no servers, should return zero values (TC079)."""
        response = client.get("/api/v1/costs/summary", headers=auth_headers)
        data = response.json()
        assert data["daily_cost"] == 0.0
        assert data["monthly_cost"] == 0.0
        assert data["servers_included"] == 0
        assert data["servers_missing_tdp"] == 0
        assert data["total_tdp_watts"] == 0

    def test_get_cost_summary_requires_auth(self, client: TestClient) -> None:
        """GET /api/v1/costs/summary without auth should return 401 (TC087)."""
        response = client.get("/api/v1/costs/summary")
        assert response.status_code == 401


class TestCostCalculation:
    """Test cost calculation logic."""

    def test_single_server_calculation(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Single server cost should be calculated correctly (AC3, TC080).

        Formula: (TDP × 24 × rate) / 1000
        With TDP=65W and rate=0.24: (65 × 24 × 0.24) / 1000 = 0.3744 ≈ 0.37
        """
        # Create a server with TDP
        server_data = {
            "id": "test-server-1",
            "hostname": "test1",
            "tdp_watts": 65,
        }
        response = client.post("/api/v1/servers", json=server_data, headers=auth_headers)
        assert response.status_code == 201

        # Get cost summary
        response = client.get("/api/v1/costs/summary", headers=auth_headers)
        data = response.json()

        assert data["servers_included"] == 1
        assert data["total_tdp_watts"] == 65
        # (65 × 24 × 0.24) / 1000 = 0.3744, rounded to 0.37
        assert data["daily_cost"] == 0.37
        # 0.37 × 30 = 11.1
        assert data["monthly_cost"] == 11.1

    def test_multiple_servers_calculation(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Multiple servers should sum TDP correctly (TC081)."""
        # Create 3 servers with TDP
        servers = [
            {"id": "test-calc-1", "hostname": "calc1", "tdp_watts": 65},
            {"id": "test-calc-2", "hostname": "calc2", "tdp_watts": 80},
            {"id": "test-calc-3", "hostname": "calc3", "tdp_watts": 120},
        ]
        for server in servers:
            response = client.post("/api/v1/servers", json=server, headers=auth_headers)
            assert response.status_code == 201

        # Get cost summary
        response = client.get("/api/v1/costs/summary", headers=auth_headers)
        data = response.json()

        assert data["servers_included"] == 3
        assert data["total_tdp_watts"] == 265  # 65 + 80 + 120
        # US0092: Daily costs are now summed per-server for consistency with breakdown
        # (65×24×0.24)/1000 = 0.37, (80×24×0.24)/1000 = 0.46, (120×24×0.24)/1000 = 0.69
        # 0.37 + 0.46 + 0.69 = 1.52
        assert data["daily_cost"] == 1.52

    def test_servers_without_tdp_excluded(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Servers without TDP should be excluded from calculation (AC4, TC082)."""
        # Create 3 servers, 1 without TDP
        servers = [
            {"id": "test-mixed-1", "hostname": "mixed1", "tdp_watts": 65},
            {"id": "test-mixed-2", "hostname": "mixed2"},  # No TDP
            {"id": "test-mixed-3", "hostname": "mixed3", "tdp_watts": 80},
        ]
        for server in servers:
            response = client.post("/api/v1/servers", json=server, headers=auth_headers)
            assert response.status_code == 201

        # Get cost summary
        response = client.get("/api/v1/costs/summary", headers=auth_headers)
        data = response.json()

        assert data["servers_included"] == 2
        assert data["servers_missing_tdp"] == 1
        assert data["total_tdp_watts"] == 145  # 65 + 80

    def test_monthly_cost_equals_daily_times_30(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Monthly cost should be daily × 30 (AC2, TC084)."""
        # Create a server
        server_data = {
            "id": "test-monthly-1",
            "hostname": "monthly1",
            "tdp_watts": 100,
        }
        response = client.post("/api/v1/servers", json=server_data, headers=auth_headers)
        assert response.status_code == 201

        # Get cost summary
        response = client.get("/api/v1/costs/summary", headers=auth_headers)
        data = response.json()

        # Verify monthly = daily × 30
        expected_monthly = round(data["daily_cost"] * 30, 2)
        assert data["monthly_cost"] == expected_monthly


class TestCostConfigIntegration:
    """Test integration with cost configuration."""

    def test_returns_configured_currency(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Should return configured currency symbol (AC5, TC083)."""
        # Set currency to $
        client.put(
            "/api/v1/config/cost",
            json={"currency_symbol": "$"},
            headers=auth_headers,
        )

        # Get cost summary
        response = client.get("/api/v1/costs/summary", headers=auth_headers)
        data = response.json()

        assert data["currency_symbol"] == "$"

    def test_returns_configured_rate(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Should return configured electricity rate (TC088)."""
        # Set rate to 0.28
        client.put(
            "/api/v1/config/cost",
            json={"electricity_rate": 0.28},
            headers=auth_headers,
        )

        # Get cost summary
        response = client.get("/api/v1/costs/summary", headers=auth_headers)
        data = response.json()

        assert data["electricity_rate"] == 0.28

    def test_cost_uses_configured_rate(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Cost calculation should use configured rate."""
        # Set rate to 0.30
        client.put(
            "/api/v1/config/cost",
            json={"electricity_rate": 0.30},
            headers=auth_headers,
        )

        # Create a server with TDP
        server_data = {
            "id": "test-rate-1",
            "hostname": "rate1",
            "tdp_watts": 100,
        }
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        # Get cost summary
        response = client.get("/api/v1/costs/summary", headers=auth_headers)
        data = response.json()

        # (100 × 24 × 0.30) / 1000 = 0.72
        assert data["daily_cost"] == 0.72


class TestCostSummaryEdgeCases:
    """Test edge cases for cost summary."""

    def test_rate_zero_returns_zero_cost(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Rate = 0 should return zero cost (TC085)."""
        # Set rate to 0
        client.put(
            "/api/v1/config/cost",
            json={"electricity_rate": 0},
            headers=auth_headers,
        )

        # Create a server with TDP
        server_data = {
            "id": "test-zero-rate-1",
            "hostname": "zerorate1",
            "tdp_watts": 100,
        }
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        # Get cost summary
        response = client.get("/api/v1/costs/summary", headers=auth_headers)
        data = response.json()

        assert data["daily_cost"] == 0.0
        assert data["monthly_cost"] == 0.0

    def test_all_servers_without_tdp(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """All servers without TDP should return zero cost (TC089)."""
        # Create servers without TDP
        servers = [
            {"id": "test-no-tdp-1", "hostname": "notdp1"},
            {"id": "test-no-tdp-2", "hostname": "notdp2"},
        ]
        for server in servers:
            client.post("/api/v1/servers", json=server, headers=auth_headers)

        # Get cost summary
        response = client.get("/api/v1/costs/summary", headers=auth_headers)
        data = response.json()

        assert data["daily_cost"] == 0.0
        assert data["monthly_cost"] == 0.0
        assert data["servers_included"] == 0
        assert data["servers_missing_tdp"] == 2

    def test_integer_tdp_handled(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """Integer TDP should be handled correctly (TC086)."""
        # Create a server with integer TDP
        server_data = {
            "id": "test-int-tdp-1",
            "hostname": "inttdp1",
            "tdp_watts": 65,
        }
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        # Get cost summary
        response = client.get("/api/v1/costs/summary", headers=auth_headers)
        data = response.json()

        assert isinstance(data["total_tdp_watts"], int)
        assert data["total_tdp_watts"] == 65

    def test_default_currency_is_pound(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Default currency should be £."""
        response = client.get("/api/v1/costs/summary", headers=auth_headers)
        data = response.json()
        assert data["currency_symbol"] == "£"

    def test_default_rate_is_024(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """Default rate should be 0.24."""
        response = client.get("/api/v1/costs/summary", headers=auth_headers)
        data = response.json()
        assert data["electricity_rate"] == 0.24
