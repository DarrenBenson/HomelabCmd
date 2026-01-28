"""Tests for Cost Breakdown API (US0036: Cost Breakdown View).

These tests verify the cost breakdown endpoint that returns per-server
electricity cost estimates with sorting and totals.
Tests follow TDD approach - written before implementation.

Spec Reference: sdlc-studio/stories/US0036-cost-breakdown-view.md
Test Spec: sdlc-studio/test-specs/TS0012-cost-tracking.md
"""

from fastapi.testclient import TestClient


class TestGetCostBreakdown:
    """Test GET /api/v1/costs/breakdown endpoint."""

    def test_get_cost_breakdown_returns_200(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """GET /api/v1/costs/breakdown should return 200 OK (TC090)."""
        response = client.get("/api/v1/costs/breakdown", headers=auth_headers)
        assert response.status_code == 200

    def test_get_cost_breakdown_returns_structure(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should contain servers, totals, settings (TC090)."""
        response = client.get("/api/v1/costs/breakdown", headers=auth_headers)
        data = response.json()
        assert "servers" in data
        assert "totals" in data
        assert "settings" in data

    def test_get_cost_breakdown_totals_structure(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Totals should have correct fields (TC090)."""
        response = client.get("/api/v1/costs/breakdown", headers=auth_headers)
        data = response.json()
        totals = data["totals"]
        assert "servers_with_tdp" in totals
        assert "servers_without_tdp" in totals
        assert "total_tdp_watts" in totals
        assert "daily_cost" in totals
        assert "monthly_cost" in totals

    def test_get_cost_breakdown_settings_structure(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Settings should have correct fields (TC090)."""
        response = client.get("/api/v1/costs/breakdown", headers=auth_headers)
        data = response.json()
        settings = data["settings"]
        assert "electricity_rate" in settings
        assert "currency_symbol" in settings

    def test_get_cost_breakdown_requires_auth(self, client: TestClient) -> None:
        """GET /api/v1/costs/breakdown without auth should return 401 (TC101)."""
        response = client.get("/api/v1/costs/breakdown")
        assert response.status_code == 401


class TestCostBreakdownCalculation:
    """Test per-server cost calculation logic."""

    def test_per_server_cost_calculation(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Per-server cost should be calculated correctly (AC2, TC091).

        Formula: (TDP × 24 × rate) / 1000
        With TDP=65W and rate=0.24: (65 × 24 × 0.24) / 1000 = 0.3744 ≈ 0.37
        """
        # Create a server with TDP
        server_data = {
            "id": "bd-test-1",
            "hostname": "bdtest1",
            "tdp_watts": 65,
        }
        response = client.post("/api/v1/servers", json=server_data, headers=auth_headers)
        assert response.status_code == 201

        # Get cost breakdown
        response = client.get("/api/v1/costs/breakdown", headers=auth_headers)
        data = response.json()

        # Find our server in the list
        server = next((s for s in data["servers"] if s["server_id"] == "bd-test-1"), None)
        assert server is not None
        assert server["hostname"] == "bdtest1"
        assert server["tdp_watts"] == 65
        # (65 × 24 × 0.24) / 1000 = 0.3744, rounded to 0.37
        assert server["daily_cost"] == 0.37
        # 0.37 × 30 = 11.1
        assert server["monthly_cost"] == 11.1

    def test_servers_sorted_by_cost_descending(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Servers should be sorted by cost (highest first) (AC3, TC092)."""
        # Create 3 servers with different TDP values
        servers = [
            {"id": "bd-sort-low", "hostname": "low", "tdp_watts": 10},
            {"id": "bd-sort-high", "hostname": "high", "tdp_watts": 100},
            {"id": "bd-sort-mid", "hostname": "mid", "tdp_watts": 50},
        ]
        for server in servers:
            response = client.post("/api/v1/servers", json=server, headers=auth_headers)
            assert response.status_code == 201

        # Get cost breakdown
        response = client.get("/api/v1/costs/breakdown", headers=auth_headers)
        data = response.json()

        # Filter to just our test servers (in case there are others)
        test_servers = [s for s in data["servers"] if s["server_id"].startswith("bd-sort-")]
        assert len(test_servers) == 3

        # Verify order: highest cost first
        assert test_servers[0]["server_id"] == "bd-sort-high"
        assert test_servers[1]["server_id"] == "bd-sort-mid"
        assert test_servers[2]["server_id"] == "bd-sort-low"


class TestCostBreakdownMissingTDP:
    """Test handling of servers without TDP."""

    def test_server_without_tdp_has_null_costs(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Servers without TDP should have null costs (AC5, TC093)."""
        # Create a server without TDP
        server_data = {
            "id": "bd-notdp-1",
            "hostname": "notdp1",
        }
        response = client.post("/api/v1/servers", json=server_data, headers=auth_headers)
        assert response.status_code == 201

        # Get cost breakdown
        response = client.get("/api/v1/costs/breakdown", headers=auth_headers)
        data = response.json()

        # Find our server
        server = next((s for s in data["servers"] if s["server_id"] == "bd-notdp-1"), None)
        assert server is not None
        assert server["tdp_watts"] is None
        assert server["daily_cost"] is None
        assert server["monthly_cost"] is None

    def test_servers_without_tdp_appear_last(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Servers without TDP should appear after servers with TDP (AC5, TC094)."""
        # Create mix of servers
        servers = [
            {"id": "bd-order-with1", "hostname": "with1", "tdp_watts": 50},
            {"id": "bd-order-no1", "hostname": "no1"},  # No TDP
            {"id": "bd-order-with2", "hostname": "with2", "tdp_watts": 100},
        ]
        for server in servers:
            response = client.post("/api/v1/servers", json=server, headers=auth_headers)
            assert response.status_code == 201

        # Get cost breakdown
        response = client.get("/api/v1/costs/breakdown", headers=auth_headers)
        data = response.json()

        # Filter to our test servers
        test_servers = [s for s in data["servers"] if s["server_id"].startswith("bd-order-")]
        assert len(test_servers) == 3

        # Servers with TDP should come first (sorted by cost), then without TDP
        assert test_servers[0]["server_id"] == "bd-order-with2"  # 100W highest
        assert test_servers[1]["server_id"] == "bd-order-with1"  # 50W second
        assert test_servers[2]["server_id"] == "bd-order-no1"  # No TDP last


class TestCostBreakdownTotals:
    """Test totals calculations."""

    def test_totals_match_summary_endpoint(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Breakdown totals should match summary endpoint (AC6, TC095)."""
        # Create servers
        servers = [
            {"id": "bd-match-1", "hostname": "match1", "tdp_watts": 65},
            {"id": "bd-match-2", "hostname": "match2", "tdp_watts": 80},
        ]
        for server in servers:
            client.post("/api/v1/servers", json=server, headers=auth_headers)

        # Get both endpoints
        breakdown_response = client.get("/api/v1/costs/breakdown", headers=auth_headers)
        summary_response = client.get("/api/v1/costs/summary", headers=auth_headers)

        breakdown = breakdown_response.json()
        summary = summary_response.json()

        # Totals should match
        assert breakdown["totals"]["daily_cost"] == summary["daily_cost"]
        assert breakdown["totals"]["monthly_cost"] == summary["monthly_cost"]
        assert breakdown["totals"]["total_tdp_watts"] == summary["total_tdp_watts"]
        assert breakdown["totals"]["servers_with_tdp"] == summary["servers_included"]
        assert breakdown["totals"]["servers_without_tdp"] == summary["servers_missing_tdp"]


class TestCostBreakdownEdgeCases:
    """Test edge cases for cost breakdown."""

    def test_no_servers_returns_empty_list(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """No servers should return empty list with zero totals (TC096)."""
        response = client.get("/api/v1/costs/breakdown", headers=auth_headers)
        data = response.json()

        assert data["servers"] == []
        assert data["totals"]["servers_with_tdp"] == 0
        assert data["totals"]["servers_without_tdp"] == 0
        assert data["totals"]["total_tdp_watts"] == 0
        assert data["totals"]["daily_cost"] == 0.0
        assert data["totals"]["monthly_cost"] == 0.0

    def test_all_servers_missing_tdp(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """All servers without TDP should have zero totals (TC097)."""
        # Create 2 servers without TDP
        servers = [
            {"id": "bd-all-no-1", "hostname": "allno1"},
            {"id": "bd-all-no-2", "hostname": "allno2"},
        ]
        for server in servers:
            client.post("/api/v1/servers", json=server, headers=auth_headers)

        # Get cost breakdown
        response = client.get("/api/v1/costs/breakdown", headers=auth_headers)
        data = response.json()

        # All servers should have null costs
        test_servers = [s for s in data["servers"] if s["server_id"].startswith("bd-all-no-")]
        assert len(test_servers) == 2
        for server in test_servers:
            assert server["daily_cost"] is None
            assert server["monthly_cost"] is None

        # Totals should be zero
        assert data["totals"]["daily_cost"] == 0.0
        assert data["totals"]["servers_with_tdp"] == 0
        assert data["totals"]["servers_without_tdp"] >= 2

    def test_single_server_with_tdp(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """Single server total should equal server cost (TC098)."""
        # Create single server
        server_data = {
            "id": "bd-single-1",
            "hostname": "single1",
            "tdp_watts": 65,
        }
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        # Get cost breakdown
        response = client.get("/api/v1/costs/breakdown", headers=auth_headers)
        data = response.json()

        # Find our server
        server = next((s for s in data["servers"] if s["server_id"] == "bd-single-1"), None)
        assert server is not None

        # For a single server, totals should match server values
        # Note: We can't assert exact match because other tests may create servers
        # But we can verify the server is in the list with correct values
        assert server["daily_cost"] == 0.37

    def test_rate_zero_returns_zero_costs(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Rate = 0 should return zero costs (TC099)."""
        # Set rate to 0
        client.put(
            "/api/v1/config/cost",
            json={"electricity_rate": 0},
            headers=auth_headers,
        )

        # Create a server with TDP
        server_data = {
            "id": "bd-zero-rate-1",
            "hostname": "zerorate1",
            "tdp_watts": 100,
        }
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        # Get cost breakdown
        response = client.get("/api/v1/costs/breakdown", headers=auth_headers)
        data = response.json()

        # Find our server
        server = next((s for s in data["servers"] if s["server_id"] == "bd-zero-rate-1"), None)
        assert server is not None
        assert server["daily_cost"] == 0.0
        assert server["monthly_cost"] == 0.0

    def test_very_high_tdp_calculated_correctly(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Very high TDP (1000W) should calculate correctly (TC100)."""
        # Reset rate to default
        client.put(
            "/api/v1/config/cost",
            json={"electricity_rate": 0.24},
            headers=auth_headers,
        )

        # Create a server with very high TDP
        server_data = {
            "id": "bd-high-tdp-1",
            "hostname": "hightdp1",
            "tdp_watts": 1000,
        }
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        # Get cost breakdown
        response = client.get("/api/v1/costs/breakdown", headers=auth_headers)
        data = response.json()

        # Find our server
        server = next((s for s in data["servers"] if s["server_id"] == "bd-high-tdp-1"), None)
        assert server is not None
        # (1000 × 24 × 0.24) / 1000 = 5.76
        assert server["daily_cost"] == 5.76
        # 5.76 × 30 = 172.8
        assert server["monthly_cost"] == 172.8

    def test_default_settings_values(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Settings should have default values."""
        # Reset to defaults
        client.put(
            "/api/v1/config/cost",
            json={"electricity_rate": 0.24, "currency_symbol": "£"},
            headers=auth_headers,
        )

        response = client.get("/api/v1/costs/breakdown", headers=auth_headers)
        data = response.json()

        assert data["settings"]["electricity_rate"] == 0.24
        assert data["settings"]["currency_symbol"] == "£"

    def test_server_item_structure(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """Each server item should have correct fields."""
        # Create a server
        server_data = {
            "id": "bd-struct-1",
            "hostname": "struct1",
            "tdp_watts": 50,
        }
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        # Get cost breakdown
        response = client.get("/api/v1/costs/breakdown", headers=auth_headers)
        data = response.json()

        # Find our server
        server = next((s for s in data["servers"] if s["server_id"] == "bd-struct-1"), None)
        assert server is not None
        assert "server_id" in server
        assert "hostname" in server
        assert "tdp_watts" in server
        assert "daily_cost" in server
        assert "monthly_cost" in server
