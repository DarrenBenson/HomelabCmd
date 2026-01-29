"""Tests for per-interface network metrics (US0179).

Tests cover:
- NetworkInterfaceMetric Pydantic schema validation
- NetworkInterfaceMetrics database model
- Heartbeat processing with network_interfaces
- Server API response includes network_interfaces
"""

from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from homelab_cmd.api.schemas.heartbeat import HeartbeatRequest, NetworkInterfaceMetric
from homelab_cmd.api.schemas.server import NetworkInterfaceMetricResponse
from homelab_cmd.db.models.metrics import NetworkInterfaceMetrics


class TestNetworkInterfaceMetricSchema:
    """Tests for NetworkInterfaceMetric Pydantic schema (US0179 AC2)."""

    def test_valid_interface_metric(self):
        """TC005: NetworkInterfaceMetric schema validates complete entry."""
        metric = NetworkInterfaceMetric(
            name="eth0",
            rx_bytes=1073741824,
            tx_bytes=536870912,
            rx_packets=1000000,
            tx_packets=500000,
            is_up=True,
        )
        assert metric.name == "eth0"
        assert metric.rx_bytes == 1073741824
        assert metric.tx_bytes == 536870912
        assert metric.rx_packets == 1000000
        assert metric.tx_packets == 500000
        assert metric.is_up is True

    def test_interface_metric_missing_name(self):
        """TC006: NetworkInterfaceMetric schema rejects missing fields."""
        with pytest.raises(ValidationError) as exc_info:
            NetworkInterfaceMetric(
                rx_bytes=1073741824,
                tx_bytes=536870912,
                rx_packets=1000000,
                tx_packets=500000,
                is_up=True,
            )
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("name",) for e in errors)

    def test_interface_metric_missing_rx_bytes(self):
        """NetworkInterfaceMetric schema rejects missing rx_bytes."""
        with pytest.raises(ValidationError) as exc_info:
            NetworkInterfaceMetric(
                name="eth0",
                tx_bytes=536870912,
                rx_packets=1000000,
                tx_packets=500000,
                is_up=True,
            )
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("rx_bytes",) for e in errors)

    def test_interface_metric_invalid_type(self):
        """TC007: NetworkInterfaceMetric schema rejects invalid types."""
        with pytest.raises(ValidationError) as exc_info:
            NetworkInterfaceMetric(
                name="eth0",
                rx_bytes="invalid",  # Should be int
                tx_bytes=536870912,
                rx_packets=1000000,
                tx_packets=500000,
                is_up=True,
            )
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("rx_bytes",) for e in errors)

    def test_interface_metric_negative_bytes_rejected(self):
        """NetworkInterfaceMetric schema rejects negative byte counts."""
        with pytest.raises(ValidationError) as exc_info:
            NetworkInterfaceMetric(
                name="eth0",
                rx_bytes=-1,  # Negative not allowed
                tx_bytes=536870912,
                rx_packets=1000000,
                tx_packets=500000,
                is_up=True,
            )
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("rx_bytes",) for e in errors)

    def test_interface_metric_is_up_false(self):
        """NetworkInterfaceMetric allows is_up=false (EC1: interface down)."""
        metric = NetworkInterfaceMetric(
            name="docker0",
            rx_bytes=0,
            tx_bytes=0,
            rx_packets=0,
            tx_packets=0,
            is_up=False,
        )
        assert metric.is_up is False

    def test_interface_metric_tailscale_name(self):
        """NetworkInterfaceMetric accepts tailscale interface names (AC4)."""
        metric = NetworkInterfaceMetric(
            name="tailscale0",
            rx_bytes=10737418,
            tx_bytes=5368709,
            rx_packets=10000,
            tx_packets=5000,
            is_up=True,
        )
        assert metric.name == "tailscale0"

    def test_interface_metric_docker_bridge_name(self):
        """NetworkInterfaceMetric accepts docker bridge interface names (AC4)."""
        metric = NetworkInterfaceMetric(
            name="br-abcd1234",
            rx_bytes=0,
            tx_bytes=0,
            rx_packets=0,
            tx_packets=0,
            is_up=True,
        )
        assert metric.name == "br-abcd1234"


class TestHeartbeatWithNetworkInterfaces:
    """Tests for HeartbeatRequest with network_interfaces field (US0179 AC1, AC3)."""

    def test_heartbeat_with_network_interfaces(self):
        """TC011: Heartbeat accepts network_interfaces array."""
        heartbeat = HeartbeatRequest(
            server_id="test-server",
            server_guid="550e8400-e29b-41d4-a716-446655440001",
            hostname="testhost.local",
            timestamp=datetime.now(UTC),
            network_interfaces=[
                NetworkInterfaceMetric(
                    name="eth0",
                    rx_bytes=1073741824,
                    tx_bytes=536870912,
                    rx_packets=1000000,
                    tx_packets=500000,
                    is_up=True,
                ),
                NetworkInterfaceMetric(
                    name="tailscale0",
                    rx_bytes=10737418,
                    tx_bytes=5368709,
                    rx_packets=10000,
                    tx_packets=5000,
                    is_up=True,
                ),
            ],
        )
        assert len(heartbeat.network_interfaces) == 2
        assert heartbeat.network_interfaces[0].name == "eth0"
        assert heartbeat.network_interfaces[1].name == "tailscale0"

    def test_heartbeat_without_network_interfaces(self):
        """Heartbeat accepts null/missing network_interfaces (backward compat)."""
        heartbeat = HeartbeatRequest(
            server_id="test-server",
            server_guid="550e8400-e29b-41d4-a716-446655440001",
            hostname="testhost.local",
            timestamp=datetime.now(UTC),
        )
        assert heartbeat.network_interfaces is None

    def test_heartbeat_with_empty_network_interfaces(self):
        """Heartbeat accepts empty network_interfaces array (EC3: no interfaces)."""
        heartbeat = HeartbeatRequest(
            server_id="test-server",
            server_guid="550e8400-e29b-41d4-a716-446655440001",
            hostname="testhost.local",
            timestamp=datetime.now(UTC),
            network_interfaces=[],
        )
        assert heartbeat.network_interfaces == []


class TestNetworkInterfaceMetricsModel:
    """Tests for NetworkInterfaceMetrics SQLAlchemy model (US0179 AC5)."""

    def test_create_network_interface_metrics(self):
        """TC015: NetworkInterfaceMetrics model accepts valid data."""
        now = datetime.now(UTC)
        metrics = NetworkInterfaceMetrics(
            server_id="test-server",
            timestamp=now,
            interface_name="eth0",
            rx_bytes=1073741824,
            tx_bytes=536870912,
            rx_packets=1000000,
            tx_packets=500000,
            is_up=True,
        )
        assert metrics.server_id == "test-server"
        assert metrics.interface_name == "eth0"
        assert metrics.rx_bytes == 1073741824
        assert metrics.tx_bytes == 536870912
        assert metrics.rx_packets == 1000000
        assert metrics.tx_packets == 500000
        assert metrics.is_up is True

    def test_network_interface_metrics_repr(self):
        """NetworkInterfaceMetrics has useful string representation."""
        metrics = NetworkInterfaceMetrics(
            id=1,
            server_id="test-server",
            timestamp=datetime.now(UTC),
            interface_name="eth0",
            rx_bytes=1073741824,
            tx_bytes=536870912,
            rx_packets=1000000,
            tx_packets=500000,
            is_up=True,
        )
        repr_str = repr(metrics)
        assert "NetworkInterfaceMetrics" in repr_str
        assert "test-server" in repr_str
        assert "eth0" in repr_str


class TestNetworkInterfaceMetricResponse:
    """Tests for NetworkInterfaceMetricResponse API schema (US0179 AC3)."""

    def test_response_schema_valid(self):
        """NetworkInterfaceMetricResponse accepts valid data."""
        response = NetworkInterfaceMetricResponse(
            name="eth0",
            rx_bytes=1073741824,
            tx_bytes=536870912,
            rx_packets=1000000,
            tx_packets=500000,
            is_up=True,
        )
        assert response.name == "eth0"
        assert response.rx_bytes == 1073741824
        assert response.is_up is True
