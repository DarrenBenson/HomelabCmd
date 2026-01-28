"""Tests for Agent Heartbeat Endpoint (TSP0001: TC013-TC017).

These tests verify the heartbeat endpoint for US0003: Agent Heartbeat Endpoint.

Spec Reference: sdlc-studio/testing/specs/TSP0001-core-monitoring-api.md
"""

from fastapi.testclient import TestClient


class TestHeartbeatStoresMetrics:
    """TC013: Heartbeat stores metrics."""

    def test_heartbeat_returns_200(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """POST /api/v1/agents/heartbeat should return 200 OK."""
        response = send_heartbeat(
            client,
            auth_headers,
            "omv-mediaserver",
            metrics={
                "cpu_percent": 45.5,
                "memory_percent": 67.2,
                "disk_percent": 82.0,
                "load_1m": 1.5,
                "load_5m": 1.2,
                "load_15m": 0.9,
                "uptime_seconds": 86400,
            },
        )
        assert response.status_code == 200

    def test_heartbeat_accepts_partial_metrics(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """Heartbeat should accept partial metrics (some fields missing)."""
        response = send_heartbeat(
            client, auth_headers, "partial-metrics-server", metrics={"cpu_percent": 45.5}
        )
        assert response.status_code == 200

    def test_heartbeat_accepts_no_metrics(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """Heartbeat should accept request without metrics."""
        response = send_heartbeat(client, auth_headers, "no-metrics-server")
        assert response.status_code == 200


class TestHeartbeatUpdatesStatus:
    """TC014: Heartbeat updates server status to online."""

    def test_heartbeat_changes_unknown_to_online(
        self, client: TestClient, auth_headers: dict[str, str], create_server, send_heartbeat
    ) -> None:
        """Server status should change from 'unknown' to 'online' on heartbeat."""
        create_server(client, auth_headers, "test-status-server")
        get_response = client.get("/api/v1/servers/test-status-server", headers=auth_headers)
        assert get_response.json()["status"] == "unknown"

        send_heartbeat(client, auth_headers, "test-status-server")
        get_response = client.get("/api/v1/servers/test-status-server", headers=auth_headers)
        assert get_response.json()["status"] == "online"

    def test_heartbeat_updates_last_seen_timestamp(
        self, client: TestClient, auth_headers: dict[str, str], create_server, send_heartbeat
    ) -> None:
        """last_seen timestamp should be updated on heartbeat."""
        create_server(client, auth_headers, "test-lastseen-server")
        get_response = client.get("/api/v1/servers/test-lastseen-server", headers=auth_headers)
        assert get_response.json()["last_seen"] is None

        send_heartbeat(client, auth_headers, "test-lastseen-server")
        get_response = client.get("/api/v1/servers/test-lastseen-server", headers=auth_headers)
        assert get_response.json()["last_seen"] is not None


class TestHeartbeatAutoRegisters:
    """TC015: Heartbeat auto-registers unknown server."""

    def test_heartbeat_creates_new_server_record(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """Heartbeat from unknown server should create new server record."""
        response = send_heartbeat(
            client,
            auth_headers,
            "new-server",
            hostname="new-server.home.lan",
            metrics={"cpu_percent": 50.0},
            os_info={"distribution": "Debian", "version": "12"},
        )
        assert response.status_code == 200
        server_response = client.get("/api/v1/servers/new-server", headers=auth_headers)
        assert server_response.status_code == 200

    def test_heartbeat_response_indicates_server_registered(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """Response should indicate when server was auto-registered."""
        response = send_heartbeat(
            client, auth_headers, "auto-reg-server", hostname="auto-reg-server.home.lan"
        )
        assert response.json()["server_registered"] is True

    def test_heartbeat_response_indicates_existing_server(
        self, client: TestClient, auth_headers: dict[str, str], create_server, send_heartbeat
    ) -> None:
        """Response should indicate when server already existed."""
        create_server(client, auth_headers, "existing-server")
        response = send_heartbeat(client, auth_headers, "existing-server")
        assert response.json()["server_registered"] is False

    def test_auto_registered_server_status_is_online(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """Auto-registered server status should be 'online'."""
        send_heartbeat(
            client, auth_headers, "auto-online-server", hostname="auto-online-server.home.lan"
        )
        server_response = client.get("/api/v1/servers/auto-online-server", headers=auth_headers)
        assert server_response.json()["status"] == "online"

    def test_auto_registered_server_hostname_set(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """Auto-registered server should have hostname from heartbeat."""
        send_heartbeat(
            client, auth_headers, "auto-hostname-server", hostname="custom-hostname.home.lan"
        )
        server_response = client.get("/api/v1/servers/auto-hostname-server", headers=auth_headers)
        assert server_response.json()["hostname"] == "custom-hostname.home.lan"


class TestHeartbeatUpdatesOsInfo:
    """TC016: Heartbeat updates OS info."""

    def test_heartbeat_updates_os_distribution(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """os_distribution should be updated from heartbeat."""
        send_heartbeat(
            client,
            auth_headers,
            "os-distro-server",
            os_info={
                "distribution": "Debian GNU/Linux",
                "version": "12 (bookworm)",
                "kernel": "6.1.0-18-amd64",
                "architecture": "x86_64",
            },
        )
        server_response = client.get("/api/v1/servers/os-distro-server", headers=auth_headers)
        assert server_response.json()["os_distribution"] == "Debian GNU/Linux"

    def test_heartbeat_updates_os_version(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """os_version should be updated from heartbeat."""
        send_heartbeat(
            client,
            auth_headers,
            "os-version-server",
            os_info={"distribution": "Ubuntu", "version": "22.04 LTS"},
        )
        server_response = client.get("/api/v1/servers/os-version-server", headers=auth_headers)
        assert server_response.json()["os_version"] == "22.04 LTS"

    def test_heartbeat_updates_kernel_version(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """kernel_version should be updated from heartbeat."""
        send_heartbeat(client, auth_headers, "kernel-server", os_info={"kernel": "6.1.0-18-amd64"})
        server_response = client.get("/api/v1/servers/kernel-server", headers=auth_headers)
        assert server_response.json()["kernel_version"] == "6.1.0-18-amd64"

    def test_heartbeat_updates_architecture(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """architecture should be updated from heartbeat."""
        send_heartbeat(client, auth_headers, "arch-server", os_info={"architecture": "arm64"})
        server_response = client.get("/api/v1/servers/arch-server", headers=auth_headers)
        assert server_response.json()["architecture"] == "arm64"


class TestHeartbeatResponsePendingCommands:
    """TC017: Heartbeat response includes pending commands."""

    def test_heartbeat_response_has_status_ok(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """Response should have 'status' = 'ok'."""
        response = send_heartbeat(client, auth_headers, "status-ok-server")
        assert response.json()["status"] == "ok"

    def test_heartbeat_response_has_pending_commands_array(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """Response should have 'pending_commands' array (empty for MVP)."""
        response = send_heartbeat(client, auth_headers, "pending-cmd-server")
        assert response.json()["pending_commands"] == []

    def test_heartbeat_response_has_server_registered_field(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """Response should have 'server_registered' boolean field."""
        response = send_heartbeat(client, auth_headers, "reg-field-server")
        assert "server_registered" in response.json()
        assert isinstance(response.json()["server_registered"], bool)


class TestHeartbeatAuthentication:
    """Heartbeat authentication tests."""

    def test_heartbeat_requires_auth(self, client: TestClient) -> None:
        """POST /api/v1/agents/heartbeat without auth should return 401."""
        heartbeat_data = {
            "server_id": "test",
            "hostname": "test",
            "timestamp": "2026-01-18T10:30:00Z",
        }
        response = client.post("/api/v1/agents/heartbeat", json=heartbeat_data)
        assert response.status_code == 401

    def test_heartbeat_rejects_invalid_api_key(self, client: TestClient) -> None:
        """POST /api/v1/agents/heartbeat with invalid key should return 401."""
        heartbeat_data = {
            "server_id": "test",
            "hostname": "test",
            "timestamp": "2026-01-18T10:30:00Z",
        }
        response = client.post(
            "/api/v1/agents/heartbeat",
            json=heartbeat_data,
            headers={"X-API-Key": "invalid-key"},
        )
        assert response.status_code == 401


class TestHeartbeatValidation:
    """Heartbeat request validation tests."""

    def test_heartbeat_rejects_missing_server_id(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Heartbeat should reject request without server_id."""
        heartbeat_data = {
            "hostname": "test",
            "timestamp": "2026-01-18T10:30:00Z",
        }
        response = client.post(
            "/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers
        )
        assert response.status_code == 422

    def test_heartbeat_rejects_missing_hostname(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Heartbeat should reject request without hostname."""
        heartbeat_data = {
            "server_id": "test",
            "timestamp": "2026-01-18T10:30:00Z",
        }
        response = client.post(
            "/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers
        )
        assert response.status_code == 422

    def test_heartbeat_rejects_missing_timestamp(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Heartbeat should reject request without timestamp."""
        heartbeat_data = {
            "server_id": "test",
            "hostname": "test",
        }
        response = client.post(
            "/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers
        )
        assert response.status_code == 422

    def test_heartbeat_rejects_invalid_server_id_format(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Heartbeat should reject invalid server_id format (uppercase not allowed)."""
        heartbeat_data = {
            "server_id": "Invalid_Server_ID",
            "hostname": "test",
            "timestamp": "2026-01-18T10:30:00Z",
        }
        response = client.post(
            "/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers
        )
        assert response.status_code == 422


class TestHeartbeatPackageUpdates:
    """Tests for package update fields (US0044)."""

    def test_heartbeat_stores_updates_available(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """Heartbeat should store updates_available on server."""
        response = send_heartbeat(
            client, auth_headers, "updates-test-server", updates_available=12, security_updates=3
        )
        assert response.status_code == 200
        server_response = client.get("/api/v1/servers/updates-test-server", headers=auth_headers)
        assert server_response.json()["updates_available"] == 12

    def test_heartbeat_stores_security_updates(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """Heartbeat should store security_updates on server."""
        send_heartbeat(
            client, auth_headers, "security-test-server", updates_available=10, security_updates=5
        )
        server_response = client.get("/api/v1/servers/security-test-server", headers=auth_headers)
        assert server_response.json()["security_updates"] == 5

    def test_heartbeat_accepts_null_updates(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """Heartbeat should accept null values for update fields (non-Debian systems)."""
        response = send_heartbeat(
            client,
            auth_headers,
            "null-updates-server",
            updates_available=None,
            security_updates=None,
        )
        assert response.status_code == 200

    def test_heartbeat_without_updates_fields(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """Heartbeat without update fields should still work (backwards compatible)."""
        response = send_heartbeat(client, auth_headers, "no-updates-field-server")
        assert response.status_code == 200

    def test_heartbeat_updates_zero_updates(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """Heartbeat should store zero values correctly."""
        send_heartbeat(
            client, auth_headers, "zero-updates-server", updates_available=0, security_updates=0
        )
        server_response = client.get("/api/v1/servers/zero-updates-server", headers=auth_headers)
        assert server_response.json()["updates_available"] == 0
        assert server_response.json()["security_updates"] == 0

    def test_heartbeat_rejects_negative_updates(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Heartbeat should reject negative update counts."""
        heartbeat_data = {
            "server_id": "negative-updates-server",
            "hostname": "negative-updates-server",
            "timestamp": "2026-01-18T10:30:00Z",
            "updates_available": -1,
        }
        response = client.post(
            "/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers
        )
        assert response.status_code == 422

    def test_server_list_includes_update_fields(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """Server list response should include update fields."""
        send_heartbeat(
            client, auth_headers, "list-updates-server", updates_available=8, security_updates=2
        )
        list_response = client.get("/api/v1/servers", headers=auth_headers)
        servers = list_response.json()["servers"]
        server = next(s for s in servers if s["id"] == "list-updates-server")
        assert server["updates_available"] == 8
        assert server["security_updates"] == 2


class TestHeartbeatServiceStatus:
    """Tests for service status in heartbeat (US0018)."""

    def test_heartbeat_accepts_services_array(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """Heartbeat should accept services array (AC3)."""
        response = send_heartbeat(
            client,
            auth_headers,
            "service-test-server",
            services=[
                {
                    "name": "plex",
                    "status": "running",
                    "pid": 12345,
                    "memory_mb": 512.5,
                    "cpu_percent": 2.3,
                },
                {
                    "name": "sonarr",
                    "status": "stopped",
                    "pid": None,
                    "memory_mb": None,
                    "cpu_percent": None,
                },
            ],
        )
        assert response.status_code == 200

    def test_heartbeat_without_services_still_works(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """Heartbeat without services should still work (backward compatible)."""
        response = send_heartbeat(client, auth_headers, "no-services-server")
        assert response.status_code == 200

    def test_heartbeat_rejects_invalid_service_status(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Heartbeat should reject invalid service status values."""
        heartbeat_data = {
            "server_id": "invalid-status-server",
            "hostname": "invalid-status-server",
            "timestamp": "2026-01-18T10:30:00Z",
            "services": [{"name": "test", "status": "invalid-status"}],
        }
        response = client.post(
            "/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers
        )
        assert response.status_code == 422

    def test_heartbeat_accepts_all_valid_statuses(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """Heartbeat should accept all valid status values."""
        for status in ["running", "stopped", "failed", "unknown"]:
            response = send_heartbeat(
                client,
                auth_headers,
                f"status-{status}-server",
                services=[{"name": "test", "status": status}],
            )
            assert response.status_code == 200, f"Status '{status}' should be valid"

    def test_heartbeat_rejects_negative_pid(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Heartbeat should reject negative PID values."""
        heartbeat_data = {
            "server_id": "negative-pid-server",
            "hostname": "negative-pid-server",
            "timestamp": "2026-01-18T10:30:00Z",
            "services": [{"name": "test", "status": "running", "pid": -1}],
        }
        response = client.post(
            "/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers
        )
        assert response.status_code == 422

    def test_heartbeat_rejects_cpu_over_100(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Heartbeat should reject CPU percent over 100."""
        heartbeat_data = {
            "server_id": "high-cpu-server",
            "hostname": "high-cpu-server",
            "timestamp": "2026-01-18T10:30:00Z",
            "services": [{"name": "test", "status": "running", "cpu_percent": 150.0}],
        }
        response = client.post(
            "/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers
        )
        assert response.status_code == 422

    def test_heartbeat_accepts_empty_services_array(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """Heartbeat should accept empty services array."""
        response = send_heartbeat(client, auth_headers, "empty-services-server", services=[])
        assert response.status_code == 200


class TestHeartbeatCpuInfo:
    """Tests for CPU info in heartbeat (US0053 - TS0012)."""

    def test_heartbeat_accepts_cpu_info(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """TC184: Heartbeat should accept cpu_info object."""
        response = send_heartbeat(
            client,
            auth_headers,
            "cpu-info-test-server",
            cpu_info={"cpu_model": "Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz", "cpu_cores": 4},
        )
        assert response.status_code == 200

    def test_heartbeat_stores_cpu_model(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """TC186: Heartbeat should store cpu_model on server."""
        send_heartbeat(
            client,
            auth_headers,
            "cpu-model-store-server",
            cpu_info={"cpu_model": "AMD Ryzen 5 3600 6-Core Processor", "cpu_cores": 12},
        )
        server_response = client.get("/api/v1/servers/cpu-model-store-server", headers=auth_headers)
        assert server_response.json()["cpu_model"] == "AMD Ryzen 5 3600 6-Core Processor"

    def test_heartbeat_stores_cpu_cores(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """TC186: Heartbeat should store cpu_cores on server."""
        send_heartbeat(
            client,
            auth_headers,
            "cpu-cores-store-server",
            cpu_info={"cpu_model": "Intel Xeon E5-2680 v4", "cpu_cores": 28},
        )
        server_response = client.get("/api/v1/servers/cpu-cores-store-server", headers=auth_headers)
        assert server_response.json()["cpu_cores"] == 28

    def test_heartbeat_without_cpu_info_still_works(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """TC185: Heartbeat without cpu_info should still work (backwards compatible)."""
        response = send_heartbeat(client, auth_headers, "no-cpu-info-server")
        assert response.status_code == 200

    def test_heartbeat_cpu_info_with_null_values(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """TC190: Heartbeat should accept null cpu_model (e.g. container environment)."""
        response = send_heartbeat(
            client,
            auth_headers,
            "null-cpu-info-server",
            cpu_info={"cpu_model": None, "cpu_cores": 4},
        )
        assert response.status_code == 200

    def test_heartbeat_updates_cpu_info_on_subsequent_heartbeat(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """TC187: CPU info should be updated on subsequent heartbeats."""
        send_heartbeat(
            client,
            auth_headers,
            "cpu-update-server",
            cpu_info={"cpu_model": "Intel Core i5", "cpu_cores": 4},
        )
        send_heartbeat(
            client,
            auth_headers,
            "cpu-update-server",
            cpu_info={"cpu_model": "Intel Core i7-10700 (Updated)", "cpu_cores": 8},
        )
        server_response = client.get("/api/v1/servers/cpu-update-server", headers=auth_headers)
        assert server_response.json()["cpu_model"] == "Intel Core i7-10700 (Updated)"
        assert server_response.json()["cpu_cores"] == 8

    def test_heartbeat_cpu_cores_validation_min(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """CPU cores should be at least 1."""
        heartbeat_data = {
            "server_id": "cpu-cores-min-server",
            "hostname": "cpu-cores-min-server",
            "timestamp": "2026-01-20T10:30:00Z",
            "cpu_info": {"cpu_model": "Test CPU", "cpu_cores": 0},
        }
        response = client.post(
            "/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers
        )
        assert response.status_code == 422

    def test_heartbeat_cpu_model_max_length(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC191: CPU model should be truncated or rejected if too long."""
        heartbeat_data = {
            "server_id": "cpu-long-model-server",
            "hostname": "cpu-long-model-server",
            "timestamp": "2026-01-20T10:30:00Z",
            "cpu_info": {"cpu_model": "A" * 300, "cpu_cores": 4},
        }
        response = client.post(
            "/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers
        )
        assert response.status_code == 422

    def test_heartbeat_arm_cpu_model(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """Heartbeat should accept ARM CPU model strings."""
        response = send_heartbeat(
            client,
            auth_headers,
            "arm-cpu-server",
            os_info={"architecture": "aarch64"},
            cpu_info={"cpu_model": "Raspberry Pi 4 Model B Rev 1.4", "cpu_cores": 4},
        )
        assert response.status_code == 200
        server_response = client.get("/api/v1/servers/arm-cpu-server", headers=auth_headers)
        assert server_response.json()["cpu_model"] == "Raspberry Pi 4 Model B Rev 1.4"
        assert server_response.json()["architecture"] == "aarch64"


class TestHeartbeatCategoryDetection:
    """Tests for machine category auto-detection (US0054 - TS0013 - TC215-TC217)."""

    def test_heartbeat_auto_detects_category(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """TC215: Heartbeat with cpu_info should auto-detect machine_category."""
        response = send_heartbeat(
            client,
            auth_headers,
            "category-auto-detect-server",
            os_info={"architecture": "x86_64"},
            cpu_info={"cpu_model": "Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz", "cpu_cores": 4},
        )
        assert response.status_code == 200
        server_response = client.get(
            "/api/v1/servers/category-auto-detect-server", headers=auth_headers
        )
        assert server_response.json()["machine_category"] == "office_laptop"
        assert server_response.json()["machine_category_source"] == "auto"

    def test_heartbeat_auto_detects_sbc_for_arm(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """TC215: ARM architecture should be auto-detected as SBC."""
        send_heartbeat(
            client,
            auth_headers,
            "category-arm-sbc-server",
            os_info={"architecture": "aarch64"},
            cpu_info={"cpu_model": "Raspberry Pi 4 Model B Rev 1.4", "cpu_cores": 4},
        )
        server_response = client.get(
            "/api/v1/servers/category-arm-sbc-server", headers=auth_headers
        )
        assert server_response.json()["machine_category"] == "sbc"
        assert server_response.json()["machine_category_source"] == "auto"

    def test_heartbeat_without_cpu_info_skips_category_detection(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """TC216: Heartbeat without cpu_info should not set category."""
        send_heartbeat(client, auth_headers, "no-category-detect-server")
        server_response = client.get(
            "/api/v1/servers/no-category-detect-server", headers=auth_headers
        )
        assert server_response.json()["machine_category"] is None
        assert server_response.json()["machine_category_source"] is None

    def test_user_set_category_not_overwritten(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """TC217: User-set category should not be overwritten by auto-detection."""
        send_heartbeat(
            client,
            auth_headers,
            "user-category-preserve-server",
            os_info={"architecture": "x86_64"},
            cpu_info={"cpu_model": "Intel N100", "cpu_cores": 4},
        )
        server_response = client.get(
            "/api/v1/servers/user-category-preserve-server", headers=auth_headers
        )
        assert server_response.json()["machine_category"] == "mini_pc"
        assert server_response.json()["machine_category_source"] == "auto"

    def test_heartbeat_xeon_detected_as_rack_server(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """Xeon CPU should be auto-detected as rack_server."""
        send_heartbeat(
            client,
            auth_headers,
            "category-xeon-server",
            os_info={"architecture": "x86_64"},
            cpu_info={"cpu_model": "Intel(R) Xeon(R) CPU E5-2680 v4 @ 2.40GHz", "cpu_cores": 28},
        )
        server_response = client.get("/api/v1/servers/category-xeon-server", headers=auth_headers)
        assert server_response.json()["machine_category"] == "rack_server"
        assert server_response.json()["machine_category_source"] == "auto"

    def test_heartbeat_ryzen_9_detected_as_workstation(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """Ryzen 9 CPU should be auto-detected as workstation."""
        send_heartbeat(
            client,
            auth_headers,
            "category-ryzen9-server",
            os_info={"architecture": "x86_64"},
            cpu_info={"cpu_model": "AMD Ryzen 9 7950X 16-Core Processor", "cpu_cores": 32},
        )
        server_response = client.get("/api/v1/servers/category-ryzen9-server", headers=auth_headers)
        assert server_response.json()["machine_category"] == "workstation"
        assert server_response.json()["machine_category_source"] == "auto"

    def test_heartbeat_unknown_cpu_no_category(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """Unknown CPU model should not set a category."""
        send_heartbeat(
            client,
            auth_headers,
            "category-unknown-cpu-server",
            os_info={"architecture": "x86_64"},
            cpu_info={"cpu_model": "Unknown Custom Processor", "cpu_cores": 4},
        )
        server_response = client.get(
            "/api/v1/servers/category-unknown-cpu-server", headers=auth_headers
        )
        assert server_response.json()["machine_category"] is None
