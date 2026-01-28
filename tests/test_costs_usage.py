"""Tests for costs usage calculations.

These tests verify the cost helper functions:
- get_avg_cpu_24h: Average CPU calculation
- get_category_label: Category label lookup
- Usage-based cost calculations in summary/breakdown
"""

from datetime import UTC, datetime, timedelta

import pytest

from homelab_cmd.api.routes.costs import (
    get_avg_cpu_24h,
    get_category_label,
)
from homelab_cmd.db.models.metrics import Metrics
from homelab_cmd.db.models.server import Server


class TestGetAvgCpu24h:
    """Tests for average CPU calculation."""

    @pytest.mark.asyncio
    async def test_returns_average_with_metrics(self, db_session) -> None:
        """Should return average when metrics exist."""
        # Create a server
        server = Server(
            id="test-server",
            hostname="test-server.local",
        )
        db_session.add(server)
        await db_session.commit()

        # Create some metrics within 24 hours
        now = datetime.now(UTC)
        metrics_values = [50.0, 60.0, 70.0, 80.0]  # Average = 65.0
        for i, cpu in enumerate(metrics_values):
            metric = Metrics(
                server_id="test-server",
                timestamp=now - timedelta(hours=i),
                cpu_percent=cpu,
            )
            db_session.add(metric)
        await db_session.commit()

        avg = await get_avg_cpu_24h(db_session, "test-server")
        assert avg is not None
        assert abs(avg - 65.0) < 0.1

    @pytest.mark.asyncio
    async def test_returns_none_no_data(self, db_session) -> None:
        """Should return None when no metrics exist."""
        avg = await get_avg_cpu_24h(db_session, "nonexistent-server")
        assert avg is None

    @pytest.mark.asyncio
    async def test_ignores_old_metrics(self, db_session) -> None:
        """Should ignore metrics older than 24 hours."""
        # Create a server
        server = Server(
            id="test-server-old",
            hostname="test-server-old.local",
        )
        db_session.add(server)
        await db_session.commit()

        # Create old metrics (more than 24 hours ago)
        old_time = datetime.now(UTC) - timedelta(hours=48)
        metric = Metrics(
            server_id="test-server-old",
            timestamp=old_time,
            cpu_percent=90.0,
        )
        db_session.add(metric)
        await db_session.commit()

        avg = await get_avg_cpu_24h(db_session, "test-server-old")
        assert avg is None

    @pytest.mark.asyncio
    async def test_excludes_null_cpu_values(self, db_session) -> None:
        """Should exclude metrics with null CPU values."""
        # Create a server
        server = Server(
            id="test-server-nulls",
            hostname="test-server-nulls.local",
        )
        db_session.add(server)
        await db_session.commit()

        now = datetime.now(UTC)

        # Create metrics with some null CPU values
        metrics_data = [
            (50.0, now - timedelta(hours=1)),
            (None, now - timedelta(hours=2)),  # Should be excluded
            (70.0, now - timedelta(hours=3)),
        ]
        for cpu, ts in metrics_data:
            metric = Metrics(
                server_id="test-server-nulls",
                timestamp=ts,
                cpu_percent=cpu,
            )
            db_session.add(metric)
        await db_session.commit()

        avg = await get_avg_cpu_24h(db_session, "test-server-nulls")
        assert avg is not None
        # Average of 50 and 70 = 60
        assert abs(avg - 60.0) < 0.1


class TestGetCategoryLabel:
    """Tests for category label lookup."""

    def test_mini_pc_label(self) -> None:
        """Should return correct label for mini_pc."""
        label = get_category_label("mini_pc")
        assert label == "Mini PC"

    def test_rack_server_label(self) -> None:
        """Should return correct label for rack_server."""
        label = get_category_label("rack_server")
        assert label == "Rack Server"

    def test_sbc_label(self) -> None:
        """Should return correct label for sbc."""
        label = get_category_label("sbc")
        assert label == "Single Board Computer"

    def test_invalid_category_returns_none(self) -> None:
        """Should return None for invalid category."""
        label = get_category_label("invalid_category")
        assert label is None

    def test_none_category_returns_none(self) -> None:
        """Should return None when category is None."""
        label = get_category_label(None)
        assert label is None

    def test_empty_string_returns_none(self) -> None:
        """Should return None when category is empty string."""
        label = get_category_label("")
        assert label is None


class TestUsageBasedCalculation:
    """Tests for usage-based cost calculations in API endpoints (TDP-only mode)."""

    def test_summary_with_tdp_watts(self, client, auth_headers) -> None:
        """Cost summary should include servers with tdp_watts configured."""
        # Create a server with TDP configuration (fallback mode)
        server_data = {
            "id": "tdp-test-server",
            "hostname": "tdp-test-server.local",
            "tdp_watts": 100,
        }
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        response = client.get("/api/v1/costs/summary", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        # Should have at least one configured server
        assert data["servers_included"] >= 1
        # Should have estimated watts based on TDP
        assert data["total_estimated_watts"] > 0

    def test_breakdown_with_tdp_watts(self, client, auth_headers) -> None:
        """Cost breakdown should include servers with tdp_watts."""
        # Create a server with TDP configuration
        server_data = {
            "id": "breakdown-tdp-server",
            "hostname": "breakdown-tdp-server.local",
            "tdp_watts": 65,
        }
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        response = client.get("/api/v1/costs/breakdown", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        # Find our server in the breakdown
        server_item = next(
            (s for s in data["servers"] if s["server_id"] == "breakdown-tdp-server"),
            None,
        )
        assert server_item is not None
        # In TDP-only mode, estimated watts equals TDP
        assert server_item["estimated_watts"] == 65.0
        assert server_item["tdp_watts"] == 65

    def test_unconfigured_server_in_breakdown(self, client, auth_headers) -> None:
        """Servers without power config should appear in unconfigured list."""
        # Create a server without any power configuration
        server_data = {
            "id": "unconfigured-server",
            "hostname": "unconfigured-server.local",
        }
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        response = client.get("/api/v1/costs/breakdown", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        # Find our server in the breakdown
        server_item = next(
            (s for s in data["servers"] if s["server_id"] == "unconfigured-server"),
            None,
        )
        assert server_item is not None
        # Should have null values for power fields
        assert server_item["estimated_watts"] is None
        assert server_item["daily_cost"] is None


class TestCostConfigAPI:
    """Tests for cost config API endpoints (under /config/cost)."""

    def test_get_cost_config_returns_200(self, client, auth_headers) -> None:
        """GET /api/v1/config/cost should return 200."""
        response = client.get("/api/v1/config/cost", headers=auth_headers)
        assert response.status_code == 200

    def test_get_cost_config_returns_defaults(self, client, auth_headers) -> None:
        """Default cost config should be returned."""
        response = client.get("/api/v1/config/cost", headers=auth_headers)
        data = response.json()
        assert "electricity_rate" in data
        assert "currency_symbol" in data
        # Check defaults
        assert data["electricity_rate"] == 0.24
        assert data["currency_symbol"] == "£"

    def test_update_cost_config(self, client, auth_headers) -> None:
        """PUT /api/v1/config/cost should update the settings."""
        response = client.put(
            "/api/v1/config/cost",
            json={"electricity_rate": 0.30, "currency_symbol": "$"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["electricity_rate"] == 0.30
        assert data["currency_symbol"] == "$"

    def test_update_cost_config_partial(self, client, auth_headers) -> None:
        """Should be able to update only electricity rate."""
        response = client.put(
            "/api/v1/config/cost",
            json={"electricity_rate": 0.15},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["electricity_rate"] == 0.15

    def test_cost_config_requires_auth(self, client) -> None:
        """Cost config endpoint should require auth."""
        response = client.get("/api/v1/config/cost")
        assert response.status_code == 401


class TestCostSummaryAPI:
    """Tests for cost summary API endpoint."""

    def test_summary_returns_200(self, client, auth_headers) -> None:
        """GET /api/v1/costs/summary should return 200."""
        response = client.get("/api/v1/costs/summary", headers=auth_headers)
        assert response.status_code == 200

    def test_summary_response_structure(self, client, auth_headers) -> None:
        """Summary should contain expected fields."""
        # First create a server with TDP so we have data
        server_data = {
            "id": "summary-test-server",
            "hostname": "summary-test-server.local",
            "tdp_watts": 100,
        }
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        response = client.get("/api/v1/costs/summary", headers=auth_headers)
        data = response.json()
        assert "servers_included" in data
        assert "total_estimated_watts" in data
        assert "daily_cost" in data
        assert "monthly_cost" in data
        assert "currency_symbol" in data
        assert "electricity_rate" in data

    def test_summary_requires_auth(self, client) -> None:
        """Summary endpoint should require auth."""
        response = client.get("/api/v1/costs/summary")
        assert response.status_code == 401


class TestCostBreakdownAPI:
    """Tests for cost breakdown API endpoint."""

    def test_breakdown_returns_200(self, client, auth_headers) -> None:
        """GET /api/v1/costs/breakdown should return 200."""
        response = client.get("/api/v1/costs/breakdown", headers=auth_headers)
        assert response.status_code == 200

    def test_breakdown_response_structure(self, client, auth_headers) -> None:
        """Breakdown should contain expected fields."""
        # First create a server so we have data
        server_data = {
            "id": "breakdown-test-server",
            "hostname": "breakdown-test-server.local",
            "tdp_watts": 65,
        }
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        response = client.get("/api/v1/costs/breakdown", headers=auth_headers)
        data = response.json()
        assert "servers" in data
        assert "totals" in data
        assert "settings" in data
        # Settings should contain rate and symbol
        assert "electricity_rate" in data["settings"]
        assert "currency_symbol" in data["settings"]

    def test_breakdown_requires_auth(self, client) -> None:
        """Breakdown endpoint should require auth."""
        response = client.get("/api/v1/costs/breakdown")
        assert response.status_code == 401


class TestCostSummaryNoServers:
    """Tests for cost summary with no servers."""

    def test_summary_empty_when_no_servers(self, client, auth_headers) -> None:
        """Summary should show zero when no servers exist."""
        response = client.get("/api/v1/costs/summary", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        # With no servers, costs should be zero
        assert data["daily_cost"] == 0.0
        assert data["monthly_cost"] == 0.0
        assert data["servers_included"] == 0
        assert data["servers_missing_config"] == 0

    def test_breakdown_empty_when_no_servers(self, client, auth_headers) -> None:
        """Breakdown should be empty when no servers exist."""
        response = client.get("/api/v1/costs/breakdown", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["servers"] == []
        assert data["totals"]["servers_configured"] == 0


class TestCostBreakdownSorting:
    """Tests for cost breakdown sorting."""

    def test_breakdown_sorted_by_cost_descending(self, client, auth_headers) -> None:
        """Configured servers should be sorted by monthly cost descending."""
        # Create servers with different TDP values
        for i, tdp in enumerate([50, 150, 100]):
            server_data = {
                "id": f"sort-test-server-{i}",
                "hostname": f"sort-test-server-{i}.local",
                "tdp_watts": tdp,
            }
            client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        response = client.get("/api/v1/costs/breakdown", headers=auth_headers)
        data = response.json()

        # Filter to just our test servers and verify order
        test_servers = [s for s in data["servers"] if s["server_id"].startswith("sort-test")]
        costs = [s["monthly_cost"] for s in test_servers if s["monthly_cost"] is not None]
        assert costs == sorted(costs, reverse=True)

    def test_unconfigured_servers_appear_last(self, client, auth_headers) -> None:
        """Unconfigured servers should appear after configured ones."""
        # Create a configured server
        client.post(
            "/api/v1/servers",
            json={"id": "configured-last", "hostname": "configured.local", "tdp_watts": 100},
            headers=auth_headers,
        )
        # Create an unconfigured server
        client.post(
            "/api/v1/servers",
            json={"id": "unconfigured-last", "hostname": "unconfigured.local"},
            headers=auth_headers,
        )

        response = client.get("/api/v1/costs/breakdown", headers=auth_headers)
        data = response.json()

        # Find positions
        configured_pos = None
        unconfigured_pos = None
        for i, s in enumerate(data["servers"]):
            if s["server_id"] == "configured-last":
                configured_pos = i
            elif s["server_id"] == "unconfigured-last":
                unconfigured_pos = i

        if configured_pos is not None and unconfigured_pos is not None:
            assert configured_pos < unconfigured_pos


class TestCostWithMachineCategory:
    """Tests for cost calculation with machine category (power profiles)."""

    def test_summary_with_machine_category(self, client, auth_headers, send_heartbeat) -> None:
        """Summary should use power profile for servers with machine category."""
        # Send heartbeat with CPU info to trigger category detection
        send_heartbeat(
            client,
            auth_headers,
            "category-test-server",
            metrics={"cpu_percent": 50.0, "memory_percent": 60.0, "disk_percent": 30.0},
        )
        # Manually update the server to have a machine category
        client.put(
            "/api/v1/servers/category-test-server",
            json={"machine_category": "mini_pc", "machine_category_source": "manual"},
            headers=auth_headers,
        )

        response = client.get("/api/v1/costs/summary", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        # Should have the server counted
        assert data["servers_included"] >= 1
        assert data["total_estimated_watts"] > 0

    def test_breakdown_with_machine_category(self, client, auth_headers, send_heartbeat) -> None:
        """Breakdown should show machine category info for categorised servers."""
        # Send heartbeat with CPU info
        send_heartbeat(
            client,
            auth_headers,
            "breakdown-cat-server",
            metrics={"cpu_percent": 40.0, "memory_percent": 50.0, "disk_percent": 20.0},
        )
        # Set machine category
        client.put(
            "/api/v1/servers/breakdown-cat-server",
            json={"machine_category": "sbc", "machine_category_source": "manual"},
            headers=auth_headers,
        )

        response = client.get("/api/v1/costs/breakdown", headers=auth_headers)
        data = response.json()

        # Find our server
        server_item = next(
            (s for s in data["servers"] if s["server_id"] == "breakdown-cat-server"),
            None,
        )
        assert server_item is not None
        assert server_item["machine_category"] == "sbc"
        assert server_item["machine_category_label"] == "Single Board Computer"
        assert server_item["estimated_watts"] is not None
        assert server_item["daily_cost"] is not None

    def test_breakdown_includes_avg_cpu_field(self, client, auth_headers, send_heartbeat) -> None:
        """Breakdown should include avg_cpu_percent field (may be null or value)."""
        # Send heartbeat with CPU info
        send_heartbeat(
            client,
            auth_headers,
            "avg-cpu-server",
            metrics={"cpu_percent": 75.0, "memory_percent": 50.0, "disk_percent": 20.0},
        )
        # Set machine category
        client.put(
            "/api/v1/servers/avg-cpu-server",
            json={"machine_category": "desktop", "machine_category_source": "manual"},
            headers=auth_headers,
        )

        response = client.get("/api/v1/costs/breakdown", headers=auth_headers)
        data = response.json()

        # Find our server
        server_item = next(
            (s for s in data["servers"] if s["server_id"] == "avg-cpu-server"),
            None,
        )
        assert server_item is not None
        # Field should exist (may be null if no 24h metrics, or value if metrics exist)
        assert "avg_cpu_percent" in server_item


class TestCostTotals:
    """Tests for cost breakdown totals."""

    def test_totals_include_all_fields(self, client, auth_headers) -> None:
        """Totals should include all expected fields."""
        # Create a server so we have data
        client.post(
            "/api/v1/servers",
            json={"id": "totals-test", "hostname": "totals.local", "tdp_watts": 80},
            headers=auth_headers,
        )

        response = client.get("/api/v1/costs/breakdown", headers=auth_headers)
        totals = response.json()["totals"]

        assert "servers_configured" in totals
        assert "servers_unconfigured" in totals
        assert "total_estimated_watts" in totals
        assert "daily_cost" in totals
        assert "monthly_cost" in totals

    def test_totals_match_server_count(self, client, auth_headers) -> None:
        """Totals server counts should match actual server list."""
        # Create one configured, one unconfigured
        client.post(
            "/api/v1/servers",
            json={"id": "count-configured", "hostname": "count.local", "tdp_watts": 100},
            headers=auth_headers,
        )
        client.post(
            "/api/v1/servers",
            json={"id": "count-unconfigured", "hostname": "uncount.local"},
            headers=auth_headers,
        )

        response = client.get("/api/v1/costs/breakdown", headers=auth_headers)
        data = response.json()
        totals = data["totals"]
        servers = data["servers"]

        # Count configured vs unconfigured
        configured_count = len([s for s in servers if s["estimated_watts"] is not None])
        unconfigured_count = len([s for s in servers if s["estimated_watts"] is None])

        assert totals["servers_configured"] == configured_count
        assert totals["servers_unconfigured"] == unconfigured_count
