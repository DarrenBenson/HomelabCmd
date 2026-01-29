"""Tests for preferences API endpoints.

US0131: Card Order Persistence
US0132: Server and Workstation Grouping (section orders and collapse state)
"""

from fastapi.testclient import TestClient


class TestGetCardOrder:
    """Tests for GET /api/v1/preferences/card-order endpoint."""

    def test_get_card_order_returns_empty_when_not_set(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        """TC11: GET returns empty array when no order saved."""
        response = client.get(
            "/api/v1/preferences/card-order",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["order"] == []

    def test_get_card_order_requires_auth(self, client: TestClient):
        """TC15: Auth required for GET endpoint."""
        response = client.get("/api/v1/preferences/card-order")

        assert response.status_code == 401

    def test_get_card_order_returns_saved_order(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        """TC10: GET /api/v1/preferences/card-order returns order."""
        # First, save an order
        order = ["server-1", "server-2", "server-3"]
        client.put(
            "/api/v1/preferences/card-order",
            json={"order": order},
            headers=auth_headers,
        )

        # Then get it
        response = client.get(
            "/api/v1/preferences/card-order",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["order"] == order


class TestSaveCardOrder:
    """Tests for PUT /api/v1/preferences/card-order endpoint."""

    def test_save_card_order_creates_new(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        """TC08: PUT /api/v1/preferences/card-order saves order."""
        order = ["alpha", "beta", "gamma"]
        response = client.put(
            "/api/v1/preferences/card-order",
            json={"order": order},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "saved"
        assert "timestamp" in data

    def test_save_card_order_requires_auth(self, client: TestClient):
        """TC14: Auth required for PUT endpoint."""
        response = client.put(
            "/api/v1/preferences/card-order",
            json={"order": ["a", "b"]},
        )

        assert response.status_code == 401

    def test_save_card_order_updates_existing(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        """TC09: PUT updates existing order (upsert)."""
        # Save initial order
        initial_order = ["a", "b"]
        client.put(
            "/api/v1/preferences/card-order",
            json={"order": initial_order},
            headers=auth_headers,
        )

        # Update with new order
        new_order = ["b", "a", "c"]
        response = client.put(
            "/api/v1/preferences/card-order",
            json={"order": new_order},
            headers=auth_headers,
        )

        assert response.status_code == 200

        # Verify the update
        get_response = client.get(
            "/api/v1/preferences/card-order",
            headers=auth_headers,
        )
        data = get_response.json()
        assert data["order"] == new_order

    def test_save_empty_order(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        """Empty order array is valid (resets to default)."""
        response = client.put(
            "/api/v1/preferences/card-order",
            json={"order": []},
            headers=auth_headers,
        )

        assert response.status_code == 200

        # Verify empty order saved
        get_response = client.get(
            "/api/v1/preferences/card-order",
            headers=auth_headers,
        )
        data = get_response.json()
        assert data["order"] == []

    def test_save_card_order_validates_request(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        """Order field is required in request body."""
        response = client.put(
            "/api/v1/preferences/card-order",
            json={},
            headers=auth_headers,
        )

        assert response.status_code == 422


# US0132: Section Order Tests


class TestGetSectionOrder:
    """Tests for GET /api/v1/preferences/section-order endpoint."""

    def test_get_section_order_returns_empty_when_not_set(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        """TC19: GET returns empty arrays when no order saved."""
        response = client.get(
            "/api/v1/preferences/section-order",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["servers"] == []
        assert data["workstations"] == []

    def test_get_section_order_requires_auth(self, client: TestClient):
        """TC20: Auth required for GET section-order endpoint."""
        response = client.get("/api/v1/preferences/section-order")

        assert response.status_code == 401

    def test_get_section_order_returns_saved_order(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        """TC19: GET section-order returns per-section orders."""
        # First, save orders
        servers = ["server-1", "server-2"]
        workstations = ["workstation-1"]
        client.put(
            "/api/v1/preferences/section-order",
            json={"servers": servers, "workstations": workstations},
            headers=auth_headers,
        )

        # Then get it
        response = client.get(
            "/api/v1/preferences/section-order",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["servers"] == servers
        assert data["workstations"] == workstations


class TestSaveSectionOrder:
    """Tests for PUT /api/v1/preferences/section-order endpoint."""

    def test_save_section_order_creates_new(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        """TC18: PUT section-order saves per-section orders."""
        servers = ["alpha", "beta"]
        workstations = ["gamma"]
        response = client.put(
            "/api/v1/preferences/section-order",
            json={"servers": servers, "workstations": workstations},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "saved"
        assert "timestamp" in data

    def test_save_section_order_requires_auth(self, client: TestClient):
        """TC20: Auth required for PUT section-order endpoint."""
        response = client.put(
            "/api/v1/preferences/section-order",
            json={"servers": ["a"], "workstations": ["b"]},
        )

        assert response.status_code == 401

    def test_save_section_order_updates_existing(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        """PUT updates existing section order (upsert)."""
        # Save initial order
        client.put(
            "/api/v1/preferences/section-order",
            json={"servers": ["a", "b"], "workstations": ["x"]},
            headers=auth_headers,
        )

        # Update with new order
        new_servers = ["b", "a", "c"]
        new_workstations = ["y", "x"]
        response = client.put(
            "/api/v1/preferences/section-order",
            json={"servers": new_servers, "workstations": new_workstations},
            headers=auth_headers,
        )

        assert response.status_code == 200

        # Verify the update
        get_response = client.get(
            "/api/v1/preferences/section-order",
            headers=auth_headers,
        )
        data = get_response.json()
        assert data["servers"] == new_servers
        assert data["workstations"] == new_workstations


# US0132: Collapsed Sections Tests


class TestGetCollapsedSections:
    """Tests for GET /api/v1/preferences/collapsed-sections endpoint."""

    def test_get_collapsed_sections_returns_empty_when_not_set(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        """TC13: GET returns empty array when no state saved."""
        response = client.get(
            "/api/v1/preferences/collapsed-sections",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["collapsed"] == []

    def test_get_collapsed_sections_requires_auth(self, client: TestClient):
        """TC20: Auth required for GET collapsed-sections endpoint."""
        response = client.get("/api/v1/preferences/collapsed-sections")

        assert response.status_code == 401

    def test_get_collapsed_sections_returns_saved_state(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        """TC13: GET collapsed-sections returns saved state."""
        # First, save state
        collapsed = ["workstations"]
        client.put(
            "/api/v1/preferences/collapsed-sections",
            json={"collapsed": collapsed},
            headers=auth_headers,
        )

        # Then get it
        response = client.get(
            "/api/v1/preferences/collapsed-sections",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["collapsed"] == collapsed


class TestSaveCollapsedSections:
    """Tests for PUT /api/v1/preferences/collapsed-sections endpoint."""

    def test_save_collapsed_sections_creates_new(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        """TC12: PUT collapsed-sections saves state."""
        collapsed = ["workstations"]
        response = client.put(
            "/api/v1/preferences/collapsed-sections",
            json={"collapsed": collapsed},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "saved"
        assert "timestamp" in data

    def test_save_collapsed_sections_requires_auth(self, client: TestClient):
        """TC20: Auth required for PUT collapsed-sections endpoint."""
        response = client.put(
            "/api/v1/preferences/collapsed-sections",
            json={"collapsed": ["servers"]},
        )

        assert response.status_code == 401

    def test_save_collapsed_sections_updates_existing(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        """PUT updates existing collapsed state (upsert)."""
        # Save initial state
        client.put(
            "/api/v1/preferences/collapsed-sections",
            json={"collapsed": ["workstations"]},
            headers=auth_headers,
        )

        # Update with new state
        new_collapsed = ["servers", "workstations"]
        response = client.put(
            "/api/v1/preferences/collapsed-sections",
            json={"collapsed": new_collapsed},
            headers=auth_headers,
        )

        assert response.status_code == 200

        # Verify the update
        get_response = client.get(
            "/api/v1/preferences/collapsed-sections",
            headers=auth_headers,
        )
        data = get_response.json()
        assert data["collapsed"] == new_collapsed

    def test_save_empty_collapsed_sections(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        """Empty collapsed array is valid (all sections expanded)."""
        response = client.put(
            "/api/v1/preferences/collapsed-sections",
            json={"collapsed": []},
            headers=auth_headers,
        )

        assert response.status_code == 200

        # Verify empty list saved
        get_response = client.get(
            "/api/v1/preferences/collapsed-sections",
            headers=auth_headers,
        )
        data = get_response.json()
        assert data["collapsed"] == []
