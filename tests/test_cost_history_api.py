"""
API tests for historical cost tracking endpoints (US0183).

Tests AC2 (historical cost API), AC4 (per-server history), AC5 (monthly summary).
"""

from datetime import date, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient


class TestCostHistoryEndpoints:
    """Tests for GET /api/v1/costs/history endpoint (AC2)."""

    def test_get_cost_history_daily(self, client: TestClient, auth_headers):
        """Test getting daily cost history."""
        today = date.today()
        start_date = today - timedelta(days=7)

        response = client.get(
            f"/api/v1/costs/history?start_date={start_date.isoformat()}&end_date={today.isoformat()}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "aggregation" in data
        assert "start_date" in data
        assert "end_date" in data
        assert "currency_symbol" in data
        assert data["aggregation"] == "daily"

    def test_get_cost_history_weekly(self, client: TestClient, auth_headers):
        """Test getting weekly aggregated cost history."""
        today = date.today()
        start_date = today - timedelta(days=90)

        response = client.get(
            f"/api/v1/costs/history?start_date={start_date.isoformat()}&end_date={today.isoformat()}&aggregation=weekly",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["aggregation"] == "weekly"

    def test_get_cost_history_monthly(self, client: TestClient, auth_headers):
        """Test getting monthly aggregated cost history."""
        today = date.today()
        start_date = today - timedelta(days=365)

        response = client.get(
            f"/api/v1/costs/history?start_date={start_date.isoformat()}&end_date={today.isoformat()}&aggregation=monthly",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["aggregation"] == "monthly"

    def test_get_cost_history_with_server_filter(self, client: TestClient, auth_headers):
        """Test getting cost history filtered by server ID."""
        server_id = str(uuid4())
        today = date.today()
        start_date = today - timedelta(days=30)

        response = client.get(
            f"/api/v1/costs/history?start_date={start_date.isoformat()}&end_date={today.isoformat()}&server_id={server_id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    def test_get_cost_history_invalid_date_range(self, client: TestClient, auth_headers):
        """Test that invalid date range returns error."""
        today = date.today()
        future_date = today + timedelta(days=30)

        response = client.get(
            f"/api/v1/costs/history?start_date={future_date.isoformat()}&end_date={today.isoformat()}",
            headers=auth_headers,
        )

        # Should return 422 for validation error
        assert response.status_code in [400, 422]

    def test_get_cost_history_missing_dates(self, client: TestClient, auth_headers):
        """Test that missing required dates returns error."""
        response = client.get(
            "/api/v1/costs/history",
            headers=auth_headers,
        )

        assert response.status_code == 422

    def test_get_cost_history_unauthorized(self, client: TestClient):
        """Test that unauthorized request returns 401."""
        today = date.today()
        start_date = today - timedelta(days=7)

        response = client.get(
            f"/api/v1/costs/history?start_date={start_date.isoformat()}&end_date={today.isoformat()}",
        )

        assert response.status_code in [401, 403]


class TestMonthlySummaryEndpoint:
    """Tests for GET /api/v1/costs/summary/monthly endpoint (AC5)."""

    def test_get_monthly_summary_current_year(self, client: TestClient, auth_headers):
        """Test getting monthly summary for current year."""
        response = client.get(
            "/api/v1/costs/summary/monthly",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "months" in data
        assert "year" in data
        assert "year_to_date_cost" in data
        assert "currency_symbol" in data
        assert data["year"] == date.today().year

    def test_get_monthly_summary_specific_year(self, client: TestClient, auth_headers):
        """Test getting monthly summary for a specific year."""
        year = 2025

        response = client.get(
            f"/api/v1/costs/summary/monthly?year={year}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["year"] == year

    def test_get_monthly_summary_includes_change_percent(self, client: TestClient, auth_headers):
        """Test that monthly summary includes month-over-month change percentage."""
        response = client.get(
            "/api/v1/costs/summary/monthly",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Each month should have change_percent field (can be null for first month)
        for month in data.get("months", []):
            assert "change_percent" in month
            assert "previous_month_cost" in month

    def test_get_monthly_summary_unauthorized(self, client: TestClient):
        """Test that unauthorized request returns 401."""
        response = client.get(
            "/api/v1/costs/summary/monthly",
        )

        assert response.status_code in [401, 403]


class TestServerCostHistoryEndpoint:
    """Tests for GET /api/v1/servers/{server_id}/costs/history endpoint (AC4)."""

    def test_get_server_cost_history_7d(self, client: TestClient, auth_headers, test_server):
        """Test getting 7-day cost history for a server."""
        response = client.get(
            f"/api/v1/servers/{test_server['id']}/costs/history?period=7d",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "server_id" in data
        assert "hostname" in data
        assert "period" in data
        assert "items" in data
        assert "currency_symbol" in data
        assert data["period"] == "7d"

    def test_get_server_cost_history_30d(self, client: TestClient, auth_headers, test_server):
        """Test getting 30-day cost history for a server."""
        response = client.get(
            f"/api/v1/servers/{test_server['id']}/costs/history?period=30d",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "30d"

    def test_get_server_cost_history_90d(self, client: TestClient, auth_headers, test_server):
        """Test getting 90-day cost history for a server."""
        response = client.get(
            f"/api/v1/servers/{test_server['id']}/costs/history?period=90d",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "90d"

    def test_get_server_cost_history_default_period(self, client: TestClient, auth_headers, test_server):
        """Test that default period is 30d."""
        response = client.get(
            f"/api/v1/servers/{test_server['id']}/costs/history",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "30d"

    def test_get_server_cost_history_not_found(self, client: TestClient, auth_headers):
        """Test getting cost history for non-existent server returns 404."""
        fake_id = str(uuid4())

        response = client.get(
            f"/api/v1/servers/{fake_id}/costs/history",
            headers=auth_headers,
        )

        assert response.status_code == 404

    def test_get_server_cost_history_invalid_period(self, client: TestClient, auth_headers, test_server):
        """Test that invalid period returns error."""
        response = client.get(
            f"/api/v1/servers/{test_server['id']}/costs/history?period=invalid",
            headers=auth_headers,
        )

        assert response.status_code == 422

    def test_get_server_cost_history_unauthorized(self, client: TestClient, test_server):
        """Test that unauthorized request returns 401."""
        response = client.get(
            f"/api/v1/servers/{test_server['id']}/costs/history",
        )

        assert response.status_code in [401, 403]


@pytest.fixture
def test_server(client: TestClient, auth_headers):
    """Create a test server for API tests."""
    server_id = f"cost-test-{uuid4().hex[:8]}"
    server_data = {
        "id": server_id,
        "hostname": "cost-history-test.local",
        "tdp_watts": 65,
        "idle_watts": 20,
    }

    response = client.post(
        "/api/v1/servers",
        json=server_data,
        headers=auth_headers,
    )

    assert response.status_code == 201, f"Server creation failed: {response.json()}"
    return response.json()
