"""Tests for API documentation endpoints."""

from fastapi.testclient import TestClient


class TestSwaggerUI:
    """Tests for Swagger UI at /api/docs."""

    def test_swagger_ui_accessible(self, client: TestClient) -> None:
        """Swagger UI should be accessible at /api/docs."""
        response = client.get("/api/docs")

        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]

    def test_swagger_ui_no_auth_required(self, client: TestClient) -> None:
        """Swagger UI should not require authentication."""
        response = client.get("/api/docs", headers={})

        assert response.status_code == 200


class TestReDoc:
    """Tests for ReDoc at /api/redoc."""

    def test_redoc_accessible(self, client: TestClient) -> None:
        """ReDoc should be accessible at /api/redoc."""
        response = client.get("/api/redoc")

        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]

    def test_redoc_no_auth_required(self, client: TestClient) -> None:
        """ReDoc should not require authentication."""
        response = client.get("/api/redoc", headers={})

        assert response.status_code == 200


class TestOpenAPISpec:
    """Tests for OpenAPI specification at /api/openapi.json."""

    def test_openapi_spec_accessible(self, client: TestClient) -> None:
        """OpenAPI spec should be accessible at /api/openapi.json."""
        response = client.get("/api/openapi.json")

        assert response.status_code == 200
        assert "application/json" in response.headers["content-type"]

    def test_openapi_spec_valid_json(self, client: TestClient) -> None:
        """OpenAPI spec should be valid JSON."""
        response = client.get("/api/openapi.json")

        # Should not raise
        data = response.json()
        assert isinstance(data, dict)

    def test_openapi_spec_has_required_fields(self, client: TestClient) -> None:
        """OpenAPI spec should have required top-level fields."""
        response = client.get("/api/openapi.json")
        data = response.json()

        assert "openapi" in data
        assert "info" in data
        assert "paths" in data

    def test_openapi_spec_has_title_and_version(self, client: TestClient) -> None:
        """OpenAPI spec should have title and version in info."""
        response = client.get("/api/openapi.json")
        data = response.json()

        assert "title" in data["info"]
        assert "version" in data["info"]
        assert data["info"]["title"] == "HomelabCmd API"

    def test_openapi_spec_includes_health_endpoint(self, client: TestClient) -> None:
        """OpenAPI spec should document the health endpoint."""
        response = client.get("/api/openapi.json")
        data = response.json()

        assert "/api/v1/system/health" in data["paths"]

    def test_openapi_spec_includes_servers_endpoint(self, client: TestClient) -> None:
        """OpenAPI spec should document the servers endpoint."""
        response = client.get("/api/openapi.json")
        data = response.json()

        assert "/api/v1/servers" in data["paths"]

    def test_openapi_spec_documents_api_key_security(self, client: TestClient) -> None:
        """OpenAPI spec should document API key security scheme."""
        response = client.get("/api/openapi.json")
        data = response.json()

        # Check for security scheme
        assert "components" in data, "Missing components"
        assert "securitySchemes" in data["components"], "Missing securitySchemes"
        schemes = data["components"]["securitySchemes"]
        assert any("APIKey" in name for name in schemes)

    def test_openapi_spec_has_tag_descriptions(self, client: TestClient) -> None:
        """OpenAPI spec should have descriptions for all tags."""
        response = client.get("/api/openapi.json")
        data = response.json()

        tags = data.get("tags", [])
        assert tags, "No tags defined"
        for tag in tags:
            assert "description" in tag, f"Tag {tag.get('name')} missing description"
            assert tag["description"], f"Tag {tag.get('name')} has empty description"

    def test_openapi_spec_has_contact_info(self, client: TestClient) -> None:
        """OpenAPI spec should have contact information."""
        response = client.get("/api/openapi.json")
        data = response.json()

        assert "contact" in data["info"], "Missing contact info"
        assert "name" in data["info"]["contact"], "Missing contact name"
        assert "url" in data["info"]["contact"], "Missing contact URL"

    def test_openapi_spec_has_license_info(self, client: TestClient) -> None:
        """OpenAPI spec should have license information."""
        response = client.get("/api/openapi.json")
        data = response.json()

        assert "license" in data["info"], "Missing license info"
        assert "name" in data["info"]["license"], "Missing license name"

    def test_openapi_spec_has_servers(self, client: TestClient) -> None:
        """OpenAPI spec should have servers array."""
        response = client.get("/api/openapi.json")
        data = response.json()

        assert "servers" in data, "Missing servers array"
        assert len(data["servers"]) > 0, "Servers array is empty"

    def test_openapi_spec_no_auth_required(self, client: TestClient) -> None:
        """OpenAPI spec should not require authentication."""
        response = client.get("/api/openapi.json", headers={})

        assert response.status_code == 200


class TestApiVersioning:
    """Tests for API versioning."""

    def test_all_endpoints_under_api_v1(self, client: TestClient) -> None:
        """All API endpoints should be under /api/v1 prefix."""
        response = client.get("/api/openapi.json")
        data = response.json()

        for path in data["paths"]:
            # Skip documentation endpoints
            if path.startswith("/api/docs") or path.startswith("/api/redoc"):
                continue
            if path == "/api/openapi.json":
                continue

            assert path.startswith("/api/v1"), f"Path {path} not under /api/v1"
