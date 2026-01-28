"""OpenAPI 3.1 compliance tests.

These tests validate that the generated OpenAPI specification meets
production quality standards as defined in TRD Section 4.1.
"""

import re

from fastapi.testclient import TestClient


class TestOpenAPIVersion:
    """Tests for OpenAPI version compliance."""

    def test_openapi_version_is_3_1(self, client: TestClient) -> None:
        """OpenAPI spec should be version 3.1.x."""
        response = client.get("/api/openapi.json")
        spec = response.json()

        assert spec["openapi"].startswith("3.1"), f"Expected OpenAPI 3.1.x, got {spec['openapi']}"


class TestOpenAPIMetadata:
    """Tests for OpenAPI metadata completeness."""

    def test_info_contact_present(self, client: TestClient) -> None:
        """OpenAPI spec should have contact information."""
        response = client.get("/api/openapi.json")
        spec = response.json()

        assert "contact" in spec["info"], "Missing contact in info"
        assert "name" in spec["info"]["contact"], "Missing contact.name"
        assert "url" in spec["info"]["contact"], "Missing contact.url"

    def test_info_license_present(self, client: TestClient) -> None:
        """OpenAPI spec should have license information."""
        response = client.get("/api/openapi.json")
        spec = response.json()

        assert "license" in spec["info"], "Missing license in info"
        assert "name" in spec["info"]["license"], "Missing license.name"

    def test_servers_present(self, client: TestClient) -> None:
        """OpenAPI spec should have servers array."""
        response = client.get("/api/openapi.json")
        spec = response.json()

        assert "servers" in spec, "Missing servers array"
        assert len(spec["servers"]) > 0, "Servers array is empty"
        assert "url" in spec["servers"][0], "Missing url in server"

    def test_description_present(self, client: TestClient) -> None:
        """OpenAPI spec should have a description."""
        response = client.get("/api/openapi.json")
        spec = response.json()

        assert "description" in spec["info"], "Missing description in info"
        assert len(spec["info"]["description"]) > 50, "Description too short"


class TestOperationIds:
    """Tests for operation ID compliance."""

    def test_all_operations_have_operation_id(self, client: TestClient) -> None:
        """Every operation should have an operationId."""
        response = client.get("/api/openapi.json")
        spec = response.json()

        missing_operation_ids = []
        for path, methods in spec["paths"].items():
            for method, operation in methods.items():
                if method in ["get", "post", "put", "delete", "patch"]:
                    if "operationId" not in operation:
                        missing_operation_ids.append(f"{method.upper()} {path}")

        assert not missing_operation_ids, (
            f"Missing operationId on: {', '.join(missing_operation_ids)}"
        )

    def test_operation_ids_follow_convention(self, client: TestClient) -> None:
        """Operation IDs should follow {verb}_{resource} convention."""
        response = client.get("/api/openapi.json")
        spec = response.json()

        # Valid patterns: verb_resource (e.g., list_servers, get_server, create_heartbeat)
        # save/remove added for credential management operations (EP0008)
        # import/check added for Tailscale device import (US0078)
        # store added for per-server credential storage (US0087)
        valid_pattern = re.compile(
            r"^(list|get|create|update|delete|acknowledge|resolve|test|pause|unpause|approve|reject|export|cancel|discover|save|remove|import|check|store)_[a-z_]+$"
        )

        invalid_operation_ids = []
        for path, methods in spec["paths"].items():
            for method, operation in methods.items():
                if method in ["get", "post", "put", "delete", "patch"]:
                    op_id = operation.get("operationId", "")
                    if not valid_pattern.match(op_id):
                        invalid_operation_ids.append(f"{op_id} ({method.upper()} {path})")

        assert not invalid_operation_ids, (
            f"Invalid operationId format: {', '.join(invalid_operation_ids)}"
        )

    def test_operation_ids_are_unique(self, client: TestClient) -> None:
        """All operation IDs should be unique."""
        response = client.get("/api/openapi.json")
        spec = response.json()

        operation_ids: list[str] = []
        for _path, methods in spec["paths"].items():
            for method, operation in methods.items():
                if method in ["get", "post", "put", "delete", "patch"]:
                    op_id = operation.get("operationId")
                    if op_id:
                        operation_ids.append(op_id)

        duplicates = [op_id for op_id in operation_ids if operation_ids.count(op_id) > 1]
        assert not duplicates, f"Duplicate operationIds: {set(duplicates)}"


class TestTagDescriptions:
    """Tests for tag descriptions."""

    def test_all_tags_have_descriptions(self, client: TestClient) -> None:
        """Every tag should have a non-empty description."""
        response = client.get("/api/openapi.json")
        spec = response.json()

        tags = spec.get("tags", [])
        assert tags, "No tags defined in spec"

        missing_descriptions = []
        for tag in tags:
            if "description" not in tag or not tag["description"].strip():
                missing_descriptions.append(tag.get("name", "unnamed"))

        assert not missing_descriptions, (
            f"Tags missing descriptions: {', '.join(missing_descriptions)}"
        )


class TestSecurityScheme:
    """Tests for security scheme documentation."""

    def test_api_key_security_scheme_defined(self, client: TestClient) -> None:
        """API key security scheme should be defined."""
        response = client.get("/api/openapi.json")
        spec = response.json()

        assert "components" in spec, "Missing components"
        assert "securitySchemes" in spec["components"], "Missing securitySchemes"

        schemes = spec["components"]["securitySchemes"]
        api_key_schemes = [
            name for name, scheme in schemes.items() if scheme.get("type") == "apiKey"
        ]

        assert api_key_schemes, "No apiKey security scheme found"

    def test_api_key_in_header(self, client: TestClient) -> None:
        """API key should be configured for header location."""
        response = client.get("/api/openapi.json")
        spec = response.json()

        schemes = spec["components"]["securitySchemes"]
        for name, scheme in schemes.items():
            if scheme.get("type") == "apiKey":
                assert scheme.get("in") == "header", f"Security scheme {name} should be in header"
                break


class TestResponseDocumentation:
    """Tests for response code documentation."""

    def test_authenticated_endpoints_document_401(self, client: TestClient) -> None:
        """Authenticated endpoints should document 401 response."""
        response = client.get("/api/openapi.json")
        spec = response.json()

        # Skip endpoints that don't require auth
        unauthenticated_paths = [
            "/api/v1/system/health",
            "/api/v1/agents/register/claim",  # Token is the auth
            "/api/v1/agents/register/install.sh",  # Public install script
        ]

        missing_401 = []
        for path, methods in spec["paths"].items():
            if path in unauthenticated_paths:
                continue

            for method, operation in methods.items():
                if method in ["get", "post", "put", "delete", "patch"]:
                    responses = operation.get("responses", {})
                    if "401" not in responses:
                        missing_401.append(f"{method.upper()} {path}")

        assert not missing_401, f"Missing 401 response documentation: {', '.join(missing_401)}"

    def test_path_param_endpoints_document_404(self, client: TestClient) -> None:
        """Endpoints with path parameters should document 404 response."""
        response = client.get("/api/openapi.json")
        spec = response.json()

        missing_404 = []
        for path, methods in spec["paths"].items():
            # Check if path has parameters (contains {})
            if "{" not in path:
                continue

            for method, operation in methods.items():
                if method in ["get", "post", "put", "delete", "patch"]:
                    responses = operation.get("responses", {})
                    if "404" not in responses:
                        missing_404.append(f"{method.upper()} {path}")

        assert not missing_404, f"Missing 404 response documentation: {', '.join(missing_404)}"


class TestExpectedEndpoints:
    """Tests for expected endpoint coverage."""

    EXPECTED_ENDPOINTS = [
        ("/api/v1/system/health", "get"),
        ("/api/v1/servers", "get"),
        ("/api/v1/servers", "post"),
        ("/api/v1/servers/{server_id}", "get"),
        ("/api/v1/servers/{server_id}", "put"),
        ("/api/v1/servers/{server_id}", "delete"),
        ("/api/v1/servers/{server_id}/metrics", "get"),
        ("/api/v1/agents/heartbeat", "post"),
        ("/api/v1/config", "get"),
        ("/api/v1/config/thresholds", "put"),
        ("/api/v1/config/notifications", "put"),
        ("/api/v1/config/test-webhook", "post"),
        ("/api/v1/alerts", "get"),
        ("/api/v1/alerts/{alert_id}", "get"),
        ("/api/v1/alerts/{alert_id}/acknowledge", "post"),
        ("/api/v1/alerts/{alert_id}/resolve", "post"),
    ]

    def test_all_expected_endpoints_documented(self, client: TestClient) -> None:
        """All expected endpoints should be documented in OpenAPI spec."""
        response = client.get("/api/openapi.json")
        spec = response.json()

        missing_endpoints = []
        for path, method in self.EXPECTED_ENDPOINTS:
            if path not in spec["paths"]:
                missing_endpoints.append(f"{method.upper()} {path}")
            elif method not in spec["paths"][path]:
                missing_endpoints.append(f"{method.upper()} {path}")

        assert not missing_endpoints, (
            f"Missing endpoint documentation: {', '.join(missing_endpoints)}"
        )


class TestSchemaDescriptions:
    """Tests for schema field descriptions."""

    def test_request_schemas_have_field_descriptions(self, client: TestClient) -> None:
        """Request body schemas should have field descriptions."""
        response = client.get("/api/openapi.json")
        spec = response.json()

        schemas = spec.get("components", {}).get("schemas", {})

        # Request schemas that should have descriptions
        request_schemas = ["ServerCreate", "HeartbeatRequest"]

        for schema_name in request_schemas:
            if schema_name not in schemas:
                continue

            schema = schemas[schema_name]
            properties = schema.get("properties", {})

            missing_descriptions = []
            for prop_name, prop_def in properties.items():
                if "description" not in prop_def:
                    missing_descriptions.append(prop_name)

            assert not missing_descriptions, (
                f"Schema {schema_name} missing field descriptions: "
                f"{', '.join(missing_descriptions)}"
            )
