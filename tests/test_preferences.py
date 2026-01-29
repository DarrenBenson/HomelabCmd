"""Tests for Dashboard Preferences API (US0136: Dashboard Preferences Sync).

These tests verify the unified dashboard preferences endpoints.
"""

from fastapi.testclient import TestClient


class TestGetDashboardPreferences:
    """Test GET /api/v1/preferences/dashboard endpoint."""

    def test_returns_200(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """GET /api/v1/preferences/dashboard should return 200 OK."""
        response = client.get("/api/v1/preferences/dashboard", headers=auth_headers)
        assert response.status_code == 200

    def test_returns_default_preferences_for_new_user(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Should return default preferences when none saved (AC4)."""
        response = client.get("/api/v1/preferences/dashboard", headers=auth_headers)
        data = response.json()

        assert data["card_order"] == {"servers": [], "workstations": []}
        assert data["collapsed_sections"] == []
        assert data["view_mode"] == "grid"
        assert data["updated_at"] is None

    def test_requires_authentication(self, client: TestClient) -> None:
        """Should return 401 without API key."""
        response = client.get("/api/v1/preferences/dashboard")
        assert response.status_code == 401


class TestSaveDashboardPreferences:
    """Test PUT /api/v1/preferences/dashboard endpoint."""

    def test_returns_200(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """PUT /api/v1/preferences/dashboard should return 200 OK."""
        preferences = {
            "card_order": {"servers": ["s1"], "workstations": []},
            "collapsed_sections": [],
            "view_mode": "grid",
        }
        response = client.put(
            "/api/v1/preferences/dashboard", json=preferences, headers=auth_headers
        )
        assert response.status_code == 200

    def test_returns_saved_status(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Should return status 'saved' and updated_at timestamp."""
        preferences = {
            "card_order": {"servers": [], "workstations": []},
            "collapsed_sections": [],
            "view_mode": "grid",
        }
        response = client.put(
            "/api/v1/preferences/dashboard", json=preferences, headers=auth_headers
        )
        data = response.json()

        assert data["status"] == "saved"
        assert "updated_at" in data
        assert data["updated_at"] is not None

    def test_persists_card_order(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Saved card order should be returned on next get (AC1)."""
        preferences = {
            "card_order": {"servers": ["s1", "s2"], "workstations": ["w1"]},
            "collapsed_sections": [],
            "view_mode": "grid",
        }
        client.put(
            "/api/v1/preferences/dashboard", json=preferences, headers=auth_headers
        )

        response = client.get("/api/v1/preferences/dashboard", headers=auth_headers)
        data = response.json()

        assert data["card_order"]["servers"] == ["s1", "s2"]
        assert data["card_order"]["workstations"] == ["w1"]

    def test_persists_collapsed_sections(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Saved collapsed sections should be returned on next get (AC1)."""
        preferences = {
            "card_order": {"servers": [], "workstations": []},
            "collapsed_sections": ["servers", "workstations"],
            "view_mode": "grid",
        }
        client.put(
            "/api/v1/preferences/dashboard", json=preferences, headers=auth_headers
        )

        response = client.get("/api/v1/preferences/dashboard", headers=auth_headers)
        data = response.json()

        assert data["collapsed_sections"] == ["servers", "workstations"]

    def test_persists_view_mode(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Saved view mode should be returned on next get (AC1)."""
        preferences = {
            "card_order": {"servers": [], "workstations": []},
            "collapsed_sections": [],
            "view_mode": "list",
        }
        client.put(
            "/api/v1/preferences/dashboard", json=preferences, headers=auth_headers
        )

        response = client.get("/api/v1/preferences/dashboard", headers=auth_headers)
        data = response.json()

        assert data["view_mode"] == "list"

    def test_updates_existing_preferences(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Subsequent saves should update existing preferences (AC5 - last-write-wins)."""
        # Save first preferences
        client.put(
            "/api/v1/preferences/dashboard",
            json={
                "card_order": {"servers": ["s1"], "workstations": []},
                "collapsed_sections": [],
                "view_mode": "grid",
            },
            headers=auth_headers,
        )

        # Save second preferences
        client.put(
            "/api/v1/preferences/dashboard",
            json={
                "card_order": {"servers": ["s2", "s3"], "workstations": ["w1"]},
                "collapsed_sections": ["servers"],
                "view_mode": "list",
            },
            headers=auth_headers,
        )

        # Verify second preferences are active
        response = client.get("/api/v1/preferences/dashboard", headers=auth_headers)
        data = response.json()

        assert data["card_order"]["servers"] == ["s2", "s3"]
        assert data["card_order"]["workstations"] == ["w1"]
        assert data["collapsed_sections"] == ["servers"]
        assert data["view_mode"] == "list"

    def test_requires_authentication(self, client: TestClient) -> None:
        """Should return 401 without API key."""
        preferences = {
            "card_order": {"servers": [], "workstations": []},
            "collapsed_sections": [],
            "view_mode": "grid",
        }
        response = client.put("/api/v1/preferences/dashboard", json=preferences)
        assert response.status_code == 401


class TestPreferencesResponseStructure:
    """Test response structure matches US0136 AC4 specification."""

    def test_response_has_card_order_with_sections(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """card_order should have servers and workstations arrays."""
        response = client.get("/api/v1/preferences/dashboard", headers=auth_headers)
        data = response.json()

        assert "card_order" in data
        assert "servers" in data["card_order"]
        assert "workstations" in data["card_order"]
        assert isinstance(data["card_order"]["servers"], list)
        assert isinstance(data["card_order"]["workstations"], list)

    def test_response_has_collapsed_sections_array(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """collapsed_sections should be an array."""
        response = client.get("/api/v1/preferences/dashboard", headers=auth_headers)
        data = response.json()

        assert "collapsed_sections" in data
        assert isinstance(data["collapsed_sections"], list)

    def test_response_has_view_mode_string(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """view_mode should be a string."""
        response = client.get("/api/v1/preferences/dashboard", headers=auth_headers)
        data = response.json()

        assert "view_mode" in data
        assert isinstance(data["view_mode"], str)

    def test_response_has_updated_at(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """updated_at should be present (null for new user, timestamp after save)."""
        response = client.get("/api/v1/preferences/dashboard", headers=auth_headers)
        data = response.json()

        assert "updated_at" in data
