"""Tests for Cost Configuration API (US0034: Electricity Rate Configuration).

These tests verify the cost settings endpoints for electricity rate and currency symbol.
Tests follow TDD approach - written before implementation.

Spec Reference: sdlc-studio/stories/US0034-electricity-rate-configuration.md
Test Spec: sdlc-studio/test-specs/TS0012-cost-tracking.md
"""

from fastapi.testclient import TestClient


class TestGetCostConfig:
    """Test GET /api/v1/config/cost endpoint."""

    def test_get_cost_returns_200(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """GET /api/v1/config/cost should return 200 OK (TC063)."""
        response = client.get("/api/v1/config/cost", headers=auth_headers)
        assert response.status_code == 200

    def test_get_cost_returns_default_rate(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Default electricity rate should be £0.24/kWh (AC3, TC063)."""
        response = client.get("/api/v1/config/cost", headers=auth_headers)
        data = response.json()
        assert data["electricity_rate"] == 0.24
        assert data["currency_symbol"] == "£"

    def test_get_cost_returns_structure(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should contain required fields (TC064)."""
        response = client.get("/api/v1/config/cost", headers=auth_headers)
        data = response.json()
        assert "electricity_rate" in data
        assert "currency_symbol" in data
        assert "updated_at" in data

    def test_get_cost_returns_updated_at(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should include updated_at timestamp (TC078)."""
        # First set a value to ensure updated_at is populated
        client.put(
            "/api/v1/config/cost",
            json={"electricity_rate": 0.25},
            headers=auth_headers,
        )

        response = client.get("/api/v1/config/cost", headers=auth_headers)
        data = response.json()
        assert data["updated_at"] is not None

    def test_get_cost_requires_auth(self, client: TestClient) -> None:
        """GET /api/v1/config/cost without auth should return 401 (TC076)."""
        response = client.get("/api/v1/config/cost")
        assert response.status_code == 401


class TestUpdateCostConfig:
    """Test PUT /api/v1/config/cost endpoint."""

    def test_update_cost_returns_200(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """PUT /api/v1/config/cost should return 200 OK (TC065)."""
        update_data = {"electricity_rate": 0.28}
        response = client.put("/api/v1/config/cost", json=update_data, headers=auth_headers)
        assert response.status_code == 200

    def test_update_cost_rate(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """PUT should update electricity rate (AC2, TC065)."""
        update_data = {"electricity_rate": 0.32}
        response = client.put("/api/v1/config/cost", json=update_data, headers=auth_headers)
        data = response.json()
        assert data["electricity_rate"] == 0.32

    def test_update_cost_currency(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """PUT should update currency symbol (AC4, TC066)."""
        update_data = {"currency_symbol": "$"}
        response = client.put("/api/v1/config/cost", json=update_data, headers=auth_headers)
        data = response.json()
        assert data["currency_symbol"] == "$"

    def test_update_cost_persists(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """Updated values should persist (AC5, TC067)."""
        update_data = {"electricity_rate": 0.35, "currency_symbol": "€"}
        client.put("/api/v1/config/cost", json=update_data, headers=auth_headers)

        response = client.get("/api/v1/config/cost", headers=auth_headers)
        data = response.json()
        assert data["electricity_rate"] == 0.35
        assert data["currency_symbol"] == "€"

    def test_update_cost_partial_preserves_rate(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Partial update of currency should preserve rate (TC075)."""
        # Set both values
        client.put(
            "/api/v1/config/cost",
            json={"electricity_rate": 0.28, "currency_symbol": "£"},
            headers=auth_headers,
        )

        # Update only currency
        client.put(
            "/api/v1/config/cost",
            json={"currency_symbol": "$"},
            headers=auth_headers,
        )

        # Verify rate is preserved
        response = client.get("/api/v1/config/cost", headers=auth_headers)
        data = response.json()
        assert data["electricity_rate"] == 0.28
        assert data["currency_symbol"] == "$"

    def test_update_cost_partial_preserves_currency(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Partial update of rate should preserve currency (TC075)."""
        # Set both values
        client.put(
            "/api/v1/config/cost",
            json={"electricity_rate": 0.24, "currency_symbol": "$"},
            headers=auth_headers,
        )

        # Update only rate
        client.put(
            "/api/v1/config/cost",
            json={"electricity_rate": 0.30},
            headers=auth_headers,
        )

        # Verify currency is preserved
        response = client.get("/api/v1/config/cost", headers=auth_headers)
        data = response.json()
        assert data["electricity_rate"] == 0.30
        assert data["currency_symbol"] == "$"

    def test_update_cost_requires_auth(self, client: TestClient) -> None:
        """PUT /api/v1/config/cost without auth should return 401 (TC077)."""
        response = client.put("/api/v1/config/cost", json={"electricity_rate": 0.30})
        assert response.status_code == 401


class TestCostConfigEdgeCases:
    """Test edge cases for cost configuration."""

    def test_rate_zero_allowed(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """Rate = 0 should be allowed for free electricity scenario (TC068)."""
        update_data = {"electricity_rate": 0}
        response = client.put("/api/v1/config/cost", json=update_data, headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["electricity_rate"] == 0

    def test_negative_rate_rejected(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """Negative rate should return 422 (TC069)."""
        update_data = {"electricity_rate": -0.10}
        response = client.put("/api/v1/config/cost", json=update_data, headers=auth_headers)
        assert response.status_code == 422

    def test_very_high_rate_allowed(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """Very high rate should be allowed (TC070)."""
        update_data = {"electricity_rate": 999.99}
        response = client.put("/api/v1/config/cost", json=update_data, headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["electricity_rate"] == 999.99

    def test_empty_currency_allowed(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """Empty currency symbol should be allowed (TC071)."""
        update_data = {"currency_symbol": ""}
        response = client.put("/api/v1/config/cost", json=update_data, headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["currency_symbol"] == ""

    def test_multi_char_currency_allowed(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Multi-character currency like EUR should be allowed (TC072)."""
        update_data = {"currency_symbol": "EUR"}
        response = client.put("/api/v1/config/cost", json=update_data, headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["currency_symbol"] == "EUR"

    def test_rate_many_decimals_stored(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Rate with many decimals should be stored correctly (TC073)."""
        update_data = {"electricity_rate": 0.123456789}
        response = client.put("/api/v1/config/cost", json=update_data, headers=auth_headers)
        assert response.status_code == 200
        # Float precision may vary slightly, check approximate
        assert abs(response.json()["electricity_rate"] - 0.123456789) < 0.0000001

    def test_invalid_type_rejected(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """Invalid type for rate (string) should return 422 (TC074)."""
        update_data = {"electricity_rate": "abc"}
        response = client.put("/api/v1/config/cost", json=update_data, headers=auth_headers)
        assert response.status_code == 422
