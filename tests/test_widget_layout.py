"""Tests for widget layout API endpoints (US0173)."""

import pytest
from fastapi.testclient import TestClient


class TestWidgetLayoutAPI:
    """Test widget layout API endpoints."""

    @pytest.fixture
    def test_server_id(self) -> str:
        """Return a test server ID."""
        return "test-server-widget"

    @pytest.fixture
    def setup_test_server(
        self, client: TestClient, auth_headers: dict, test_server_id: str
    ) -> str:
        """Create a test server for widget layout tests."""
        response = client.post(
            "/api/v1/servers",
            json={
                "id": test_server_id,
                "hostname": "test-widget.local",
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        return test_server_id

    def test_get_layout_no_saved_layout(
        self, client: TestClient, auth_headers: dict, setup_test_server: str
    ) -> None:
        """Test GET /machines/{id}/layout returns null when no layout saved."""
        response = client.get(
            f"/api/v1/machines/{setup_test_server}/layout",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["layouts"] is None
        assert data["updated_at"] is None

    def test_get_layout_machine_not_found(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        """Test GET /machines/{id}/layout returns 404 for non-existent machine."""
        response = client.get(
            "/api/v1/machines/non-existent-server/layout",
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_save_layout(
        self, client: TestClient, auth_headers: dict, setup_test_server: str
    ) -> None:
        """Test PUT /machines/{id}/layout saves layout successfully."""
        layout_data = {
            "layouts": {
                "lg": [
                    {"i": "cpu_chart", "x": 0, "y": 0, "w": 6, "h": 3},
                    {"i": "memory_gauge", "x": 6, "y": 0, "w": 6, "h": 3},
                ],
                "md": [{"i": "cpu_chart", "x": 0, "y": 0, "w": 6, "h": 3}],
                "sm": [{"i": "cpu_chart", "x": 0, "y": 0, "w": 6, "h": 3}],
                "xs": [{"i": "cpu_chart", "x": 0, "y": 0, "w": 1, "h": 3}],
            }
        }

        response = client.put(
            f"/api/v1/machines/{setup_test_server}/layout",
            json=layout_data,
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "saved"
        assert "updated_at" in data

    def test_save_and_get_layout(
        self, client: TestClient, auth_headers: dict, setup_test_server: str
    ) -> None:
        """Test that saved layout can be retrieved."""
        layout_data = {
            "layouts": {
                "lg": [
                    {"i": "cpu_chart", "x": 0, "y": 0, "w": 4, "h": 3, "minW": 2, "minH": 2}
                ],
                "md": [{"i": "cpu_chart", "x": 0, "y": 0, "w": 4, "h": 3}],
                "sm": [],
                "xs": [],
            }
        }

        # Save layout
        save_response = client.put(
            f"/api/v1/machines/{setup_test_server}/layout",
            json=layout_data,
            headers=auth_headers,
        )
        assert save_response.status_code == 200

        # Retrieve layout
        get_response = client.get(
            f"/api/v1/machines/{setup_test_server}/layout",
            headers=auth_headers,
        )
        assert get_response.status_code == 200
        data = get_response.json()

        assert data["layouts"] is not None
        assert len(data["layouts"]["lg"]) == 1
        assert data["layouts"]["lg"][0]["i"] == "cpu_chart"
        assert data["layouts"]["lg"][0]["x"] == 0
        assert data["layouts"]["lg"][0]["w"] == 4
        assert data["layouts"]["lg"][0]["minW"] == 2
        assert data["updated_at"] is not None

    def test_update_layout(
        self, client: TestClient, auth_headers: dict, setup_test_server: str
    ) -> None:
        """Test that layout can be updated (upsert)."""
        # Save initial layout
        initial_layout = {
            "layouts": {
                "lg": [{"i": "cpu_chart", "x": 0, "y": 0, "w": 4, "h": 3}],
                "md": [],
                "sm": [],
                "xs": [],
            }
        }
        client.put(
            f"/api/v1/machines/{setup_test_server}/layout",
            json=initial_layout,
            headers=auth_headers,
        )

        # Update layout
        updated_layout = {
            "layouts": {
                "lg": [
                    {"i": "cpu_chart", "x": 0, "y": 0, "w": 6, "h": 4},
                    {"i": "memory_gauge", "x": 6, "y": 0, "w": 6, "h": 4},
                ],
                "md": [],
                "sm": [],
                "xs": [],
            }
        }
        response = client.put(
            f"/api/v1/machines/{setup_test_server}/layout",
            json=updated_layout,
            headers=auth_headers,
        )
        assert response.status_code == 200

        # Verify update
        get_response = client.get(
            f"/api/v1/machines/{setup_test_server}/layout",
            headers=auth_headers,
        )
        data = get_response.json()
        assert len(data["layouts"]["lg"]) == 2
        assert data["layouts"]["lg"][0]["w"] == 6

    def test_delete_layout(
        self, client: TestClient, auth_headers: dict, setup_test_server: str
    ) -> None:
        """Test DELETE /machines/{id}/layout resets to default."""
        # Save a layout first
        layout_data = {
            "layouts": {
                "lg": [{"i": "cpu_chart", "x": 0, "y": 0, "w": 4, "h": 3}],
                "md": [],
                "sm": [],
                "xs": [],
            }
        }
        client.put(
            f"/api/v1/machines/{setup_test_server}/layout",
            json=layout_data,
            headers=auth_headers,
        )

        # Delete layout
        delete_response = client.delete(
            f"/api/v1/machines/{setup_test_server}/layout",
            headers=auth_headers,
        )
        assert delete_response.status_code == 200
        assert delete_response.json()["status"] == "deleted"

        # Verify layout is gone
        get_response = client.get(
            f"/api/v1/machines/{setup_test_server}/layout",
            headers=auth_headers,
        )
        data = get_response.json()
        assert data["layouts"] is None

    def test_delete_layout_when_none_exists(
        self, client: TestClient, auth_headers: dict, setup_test_server: str
    ) -> None:
        """Test DELETE /machines/{id}/layout succeeds even when no layout saved."""
        response = client.delete(
            f"/api/v1/machines/{setup_test_server}/layout",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "deleted"

    def test_save_layout_machine_not_found(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        """Test PUT /machines/{id}/layout returns 404 for non-existent machine."""
        response = client.put(
            "/api/v1/machines/non-existent-server/layout",
            json={"layouts": {"lg": [], "md": [], "sm": [], "xs": []}},
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_delete_layout_machine_not_found(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        """Test DELETE /machines/{id}/layout returns 404 for non-existent machine."""
        response = client.delete(
            "/api/v1/machines/non-existent-server/layout",
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_layout_with_optional_fields(
        self, client: TestClient, auth_headers: dict, setup_test_server: str
    ) -> None:
        """Test layout with all optional fields."""
        layout_data = {
            "layouts": {
                "lg": [
                    {
                        "i": "cpu_chart",
                        "x": 0,
                        "y": 0,
                        "w": 4,
                        "h": 3,
                        "minW": 2,
                        "minH": 2,
                        "maxW": 8,
                        "maxH": 6,
                    }
                ],
                "md": [],
                "sm": [],
                "xs": [],
            }
        }

        response = client.put(
            f"/api/v1/machines/{setup_test_server}/layout",
            json=layout_data,
            headers=auth_headers,
        )
        assert response.status_code == 200

        # Verify optional fields preserved
        get_response = client.get(
            f"/api/v1/machines/{setup_test_server}/layout",
            headers=auth_headers,
        )
        data = get_response.json()
        item = data["layouts"]["lg"][0]
        assert item["minW"] == 2
        assert item["minH"] == 2
        assert item["maxW"] == 8
        assert item["maxH"] == 6
