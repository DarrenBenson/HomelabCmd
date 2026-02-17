"""API integration tests for command execution audit trail.

Part of EP0013: Synchronous Command Execution - US0155 Command Execution Audit Trail.
"""


from fastapi.testclient import TestClient


class TestAuditAPIAuth:
    """Tests for authentication requirements (AC2)."""

    def test_list_requires_auth(self, client: TestClient) -> None:
        """Test that audit list endpoint requires authentication."""
        response = client.get("/api/v1/audit/commands")
        assert response.status_code == 401

    def test_export_requires_auth(self, client: TestClient) -> None:
        """Test that CSV export requires authentication."""
        response = client.get("/api/v1/audit/commands/export")
        assert response.status_code == 401


class TestAuditAPIImmutability:
    """Tests for immutability enforcement (TC12, TC13 - AC3)."""

    def test_no_put_endpoint(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """TC12: No update endpoint exists."""
        # Try PUT to update an entry
        response = client.put(
            "/api/v1/audit/commands/1",
            json={"command": "modified"},
            headers=auth_headers,
        )
        # Should return 404 (route not found) or 405 (method not allowed)
        assert response.status_code in [404, 405]

    def test_no_patch_endpoint(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC12: No PATCH update endpoint exists."""
        response = client.patch(
            "/api/v1/audit/commands/1",
            json={"command": "modified"},
            headers=auth_headers,
        )
        assert response.status_code in [404, 405]

    def test_no_delete_endpoint(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC13: No delete endpoint exists."""
        response = client.delete(
            "/api/v1/audit/commands/1",
            headers=auth_headers,
        )
        assert response.status_code in [404, 405]

    def test_no_bulk_delete_endpoint(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC13: No bulk delete endpoint exists."""
        response = client.delete(
            "/api/v1/audit/commands",
            headers=auth_headers,
        )
        # DELETE on collection should not be supported
        assert response.status_code in [404, 405]


class TestAuditAPIList:
    """Tests for the list endpoint (TC05-TC11 - AC2)."""

    def test_list_empty_returns_empty_array(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test that empty database returns empty entries array."""
        response = client.get("/api/v1/audit/commands", headers=auth_headers)
        assert response.status_code == 200

        data = response.json()
        assert "entries" in data
        assert data["entries"] == []
        assert data["total"] == 0
        assert data["page"] == 1
        assert data["page_size"] == 100

    def test_list_with_default_pagination(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC05: Default pagination returns page 1 with size 100."""
        response = client.get("/api/v1/audit/commands", headers=auth_headers)
        assert response.status_code == 200

        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 100

    def test_list_custom_pagination(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC10: Custom pagination parameters are respected."""
        response = client.get(
            "/api/v1/audit/commands?page=2&page_size=50",
            headers=auth_headers,
        )
        assert response.status_code == 200

        data = response.json()
        assert data["page"] == 2
        assert data["page_size"] == 50

    def test_list_page_size_max_100(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test that page_size is limited to 100."""
        response = client.get(
            "/api/v1/audit/commands?page_size=200",
            headers=auth_headers,
        )
        # FastAPI should reject values over 100
        assert response.status_code == 422

    def test_list_page_size_min_1(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test that page_size must be at least 1."""
        response = client.get(
            "/api/v1/audit/commands?page_size=0",
            headers=auth_headers,
        )
        assert response.status_code == 422


class TestAuditAPIFilters:
    """Tests for filter parameters (TC06-TC09 - AC2)."""

    def test_filter_by_server_id_format(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC06: Filter by server_id parameter."""
        response = client.get(
            "/api/v1/audit/commands?server_id=test-server",
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_filter_by_action_type_format(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC07: Filter by action_type parameter."""
        response = client.get(
            "/api/v1/audit/commands?action_type=restart_service",
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_filter_by_date_range_format(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC08: Filter by date range."""
        from_date = "2026-01-20T00:00:00Z"
        to_date = "2026-01-25T23:59:59Z"

        response = client.get(
            f"/api/v1/audit/commands?from_date={from_date}&to_date={to_date}",
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_filter_by_success_only_true(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC09: Filter success_only=true."""
        response = client.get(
            "/api/v1/audit/commands?success_only=true",
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_filter_by_success_only_false(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC09: Filter success_only=false (failures only)."""
        response = client.get(
            "/api/v1/audit/commands?success_only=false",
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_invalid_date_range_returns_400(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test that from_date > to_date returns 400."""
        # from_date after to_date
        response = client.get(
            "/api/v1/audit/commands?from_date=2026-01-25T00:00:00Z&to_date=2026-01-20T00:00:00Z",
            headers=auth_headers,
        )
        assert response.status_code == 400
        assert "from_date must be before" in response.json()["detail"]


class TestAuditAPIExport:
    """Tests for CSV export endpoint."""

    def test_export_returns_csv(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test that export returns CSV content type."""
        response = client.get(
            "/api/v1/audit/commands/export",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("content-type", "")

    def test_export_has_content_disposition(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test that export has attachment disposition."""
        response = client.get(
            "/api/v1/audit/commands/export",
            headers=auth_headers,
        )
        assert response.status_code == 200
        content_disposition = response.headers.get("content-disposition", "")
        assert "attachment" in content_disposition
        assert "command_audit_" in content_disposition
        assert ".csv" in content_disposition

    def test_export_csv_header_row(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test that CSV has correct header row."""
        response = client.get(
            "/api/v1/audit/commands/export",
            headers=auth_headers,
        )
        assert response.status_code == 200

        content = response.content.decode("utf-8")
        lines = content.strip().split("\n")
        assert len(lines) >= 1

        # Check header
        header = lines[0]
        assert "id" in header
        assert "server_id" in header
        assert "command" in header
        assert "action_type" in header
        assert "exit_code" in header

    def test_export_with_filters(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test that export respects filters."""
        response = client.get(
            "/api/v1/audit/commands/export?server_id=test-server&action_type=restart_service",
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_export_invalid_date_range_returns_400(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test that export validates date range."""
        response = client.get(
            "/api/v1/audit/commands/export?from_date=2026-01-25T00:00:00Z&to_date=2026-01-20T00:00:00Z",
            headers=auth_headers,
        )
        assert response.status_code == 400


class TestAuditAPIResponseFormat:
    """Tests for response format validation."""

    def test_list_response_structure(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test that list response has correct structure."""
        response = client.get("/api/v1/audit/commands", headers=auth_headers)
        assert response.status_code == 200

        data = response.json()
        assert "entries" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data

        assert isinstance(data["entries"], list)
        assert isinstance(data["total"], int)
        assert isinstance(data["page"], int)
        assert isinstance(data["page_size"], int)
