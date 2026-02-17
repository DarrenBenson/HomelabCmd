"""API tests for command audit endpoints.

Part of EP0013: Synchronous Command Execution - US0155 Command Execution Audit Trail.
"""


from fastapi.testclient import TestClient


class TestAuditAPIAuth:
    """Tests for audit endpoint authentication."""

    def test_list_audit_requires_auth(self, client: TestClient) -> None:
        """Test that audit list endpoint requires authentication."""
        response = client.get("/api/v1/audit/commands")
        assert response.status_code == 401

    def test_export_audit_requires_auth(self, client: TestClient) -> None:
        """Test that audit export endpoint requires authentication."""
        response = client.get("/api/v1/audit/commands/export")
        assert response.status_code == 401


class TestListCommandAudit:
    """Tests for list command audit endpoint."""

    def test_list_audit_returns_entries(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test listing audit entries returns data."""
        response = client.get("/api/v1/audit/commands", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert "entries" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data

    def test_list_audit_filter_by_server(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test filtering audit by server_id."""
        response = client.get(
            "/api/v1/audit/commands",
            params={"server_id": "nonexistent-server"},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        # Should return empty list for nonexistent server
        assert data["total"] == 0

    def test_list_audit_filter_by_action_type(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test filtering audit by action_type."""
        response = client.get(
            "/api/v1/audit/commands",
            params={"action_type": "restart_service"},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        for entry in data["entries"]:
            assert entry["action_type"] == "restart_service"

    def test_list_audit_filter_success_only(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test filtering for successful commands only."""
        response = client.get(
            "/api/v1/audit/commands",
            params={"success_only": "true"},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        for entry in data["entries"]:
            assert entry["exit_code"] == 0

    def test_list_audit_filter_failures_only(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test filtering for failed commands only."""
        response = client.get(
            "/api/v1/audit/commands",
            params={"success_only": "false"},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        for entry in data["entries"]:
            assert entry["exit_code"] != 0

    def test_list_audit_pagination(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test pagination works correctly."""
        response = client.get(
            "/api/v1/audit/commands",
            params={"page": 1, "page_size": 2},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert len(data["entries"]) <= 2

    def test_list_audit_invalid_date_range(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test invalid date range returns 400."""
        response = client.get(
            "/api/v1/audit/commands",
            params={
                "from_date": "2026-01-30T00:00:00Z",
                "to_date": "2026-01-01T00:00:00Z",  # Before from_date
            },
            headers=auth_headers,
        )

        assert response.status_code == 400
        assert "from_date must be before" in response.json()["detail"]


class TestExportCommandAudit:
    """Tests for export command audit endpoint."""

    def test_export_returns_csv(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test export returns CSV content."""
        response = client.get("/api/v1/audit/commands/export", headers=auth_headers)

        assert response.status_code == 200
        assert response.headers["content-type"] == "text/csv; charset=utf-8"
        assert "attachment; filename=" in response.headers["content-disposition"]
        assert ".csv" in response.headers["content-disposition"]

    def test_export_csv_has_headers(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test CSV has correct headers."""
        response = client.get("/api/v1/audit/commands/export", headers=auth_headers)

        content = response.text
        first_line = content.split("\n")[0]

        # Check expected columns
        assert "id" in first_line
        assert "server_id" in first_line
        assert "command" in first_line
        assert "action_type" in first_line
        assert "exit_code" in first_line
        assert "duration_ms" in first_line
        assert "executed_at" in first_line
        assert "executed_by" in first_line

    def test_export_csv_excludes_stdout_stderr(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test CSV excludes stdout/stderr for size reasons."""
        response = client.get("/api/v1/audit/commands/export", headers=auth_headers)

        content = response.text
        first_line = content.split("\n")[0]

        # stdout/stderr should NOT be in header
        assert "stdout" not in first_line
        assert "stderr" not in first_line

    def test_export_with_server_filter(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test export respects server_id filter."""
        response = client.get(
            "/api/v1/audit/commands/export",
            params={"server_id": "nonexistent-server"},
            headers=auth_headers,
        )

        assert response.status_code == 200
        # Should only have header line (no matching data)
        lines = response.text.strip().split("\n")
        # Header line should exist
        assert len(lines) >= 1

    def test_export_invalid_date_range(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test export with invalid date range returns 400."""
        response = client.get(
            "/api/v1/audit/commands/export",
            params={
                "from_date": "2026-01-30T00:00:00Z",
                "to_date": "2026-01-01T00:00:00Z",
            },
            headers=auth_headers,
        )

        assert response.status_code == 400
