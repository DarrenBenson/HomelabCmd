"""Tests for per-filesystem metrics API (US0178).

Tests the complete flow from agent collection through API response.
"""

from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from homelab_cmd.api.schemas.heartbeat import FilesystemMetric, HeartbeatRequest
from homelab_cmd.api.schemas.server import ServerResponse
from homelab_cmd.db.models.metrics import FilesystemMetrics


class TestFilesystemMetricSchema:
    """Test FilesystemMetric Pydantic schema validation (TC005-TC007)."""

    def test_valid_filesystem_metric(self):
        """TC005: FilesystemMetric schema validates complete entry."""
        fs = FilesystemMetric(
            mount_point="/",
            device="/dev/sda1",
            fs_type="ext4",
            total_bytes=107374182400,
            used_bytes=64424509440,
            available_bytes=42949672960,
            percent=60.0,
        )

        assert fs.mount_point == "/"
        assert fs.device == "/dev/sda1"
        assert fs.fs_type == "ext4"
        assert fs.total_bytes == 107374182400
        assert fs.used_bytes == 64424509440
        assert fs.available_bytes == 42949672960
        assert fs.percent == 60.0

    def test_missing_mount_point_raises_error(self):
        """TC006: FilesystemMetric schema rejects missing fields."""
        with pytest.raises(ValidationError) as exc_info:
            FilesystemMetric(
                # mount_point missing
                device="/dev/sda1",
                fs_type="ext4",
                total_bytes=107374182400,
                used_bytes=64424509440,
                available_bytes=42949672960,
                percent=60.0,
            )

        errors = exc_info.value.errors()
        assert any(e["loc"] == ("mount_point",) for e in errors)

    def test_invalid_type_raises_error(self):
        """TC007: FilesystemMetric schema rejects invalid types."""
        with pytest.raises(ValidationError) as exc_info:
            FilesystemMetric(
                mount_point="/",
                device="/dev/sda1",
                fs_type="ext4",
                total_bytes="invalid",  # Should be int
                used_bytes=64424509440,
                available_bytes=42949672960,
                percent=60.0,
            )

        errors = exc_info.value.errors()
        assert any(e["loc"] == ("total_bytes",) for e in errors)

    def test_percent_bounds_validation(self):
        """Test percent must be between 0 and 100."""
        # Valid boundary values
        FilesystemMetric(
            mount_point="/",
            device="/dev/sda1",
            fs_type="ext4",
            total_bytes=100,
            used_bytes=0,
            available_bytes=100,
            percent=0.0,  # Valid: 0%
        )

        FilesystemMetric(
            mount_point="/",
            device="/dev/sda1",
            fs_type="ext4",
            total_bytes=100,
            used_bytes=100,
            available_bytes=0,
            percent=100.0,  # Valid: 100%
        )

        # Invalid: percent > 100
        with pytest.raises(ValidationError):
            FilesystemMetric(
                mount_point="/",
                device="/dev/sda1",
                fs_type="ext4",
                total_bytes=100,
                used_bytes=100,
                available_bytes=0,
                percent=101.0,  # Invalid
            )

        # Invalid: percent < 0
        with pytest.raises(ValidationError):
            FilesystemMetric(
                mount_point="/",
                device="/dev/sda1",
                fs_type="ext4",
                total_bytes=100,
                used_bytes=0,
                available_bytes=100,
                percent=-1.0,  # Invalid
            )


class TestHeartbeatRequestWithFilesystems:
    """Test HeartbeatRequest schema with filesystems field."""

    def test_heartbeat_with_filesystems(self):
        """Test HeartbeatRequest accepts filesystems array."""
        filesystems = [
            FilesystemMetric(
                mount_point="/",
                device="/dev/sda1",
                fs_type="ext4",
                total_bytes=107374182400,
                used_bytes=64424509440,
                available_bytes=42949672960,
                percent=60.0,
            ),
            FilesystemMetric(
                mount_point="/data",
                device="/dev/sdb1",
                fs_type="xfs",
                total_bytes=4000787030016,
                used_bytes=2800550921011,
                available_bytes=1200236108005,
                percent=70.0,
            ),
        ]

        req = HeartbeatRequest(
            server_id="test-server",
            hostname="test.local",
            timestamp=datetime.now(UTC),
            filesystems=filesystems,
        )

        assert req.filesystems is not None
        assert len(req.filesystems) == 2
        assert req.filesystems[0].mount_point == "/"
        assert req.filesystems[1].mount_point == "/data"

    def test_heartbeat_without_filesystems(self):
        """Test HeartbeatRequest works without filesystems (backward compat)."""
        req = HeartbeatRequest(
            server_id="test-server",
            hostname="test.local",
            timestamp=datetime.now(UTC),
        )

        assert req.filesystems is None

    def test_heartbeat_with_empty_filesystems(self):
        """Test HeartbeatRequest accepts empty filesystems list."""
        req = HeartbeatRequest(
            server_id="test-server",
            hostname="test.local",
            timestamp=datetime.now(UTC),
            filesystems=[],
        )

        assert req.filesystems == []


class TestFilesystemMetricsModel:
    """Test FilesystemMetrics SQLAlchemy model."""

    def test_model_creation(self):
        """Test FilesystemMetrics model can be instantiated."""
        now = datetime.now(UTC)
        fs_metrics = FilesystemMetrics(
            server_id="test-server",
            timestamp=now,
            mount_point="/",
            device="/dev/sda1",
            fs_type="ext4",
            total_bytes=107374182400,
            used_bytes=64424509440,
            available_bytes=42949672960,
            percent=60.0,
        )

        assert fs_metrics.server_id == "test-server"
        assert fs_metrics.mount_point == "/"
        assert fs_metrics.percent == 60.0

    def test_model_repr(self):
        """Test FilesystemMetrics __repr__ method."""
        fs_metrics = FilesystemMetrics(
            server_id="test-server",
            timestamp=datetime.now(UTC),
            mount_point="/data",
            device="/dev/sdb1",
            fs_type="xfs",
            total_bytes=100,
            used_bytes=70,
            available_bytes=30,
            percent=70.0,
        )

        repr_str = repr(fs_metrics)
        assert "FilesystemMetrics" in repr_str
        assert "test-server" in repr_str
        assert "/data" in repr_str


class TestServerResponseWithFilesystems:
    """Test ServerResponse schema includes filesystems."""

    def test_server_response_with_filesystems(self):
        """TC010: Server API returns multiple filesystems."""
        filesystems_data = [
            {
                "mount_point": "/",
                "device": "/dev/sda1",
                "fs_type": "ext4",
                "total_bytes": 107374182400,
                "used_bytes": 64424509440,
                "available_bytes": 42949672960,
                "percent": 60.0,
            },
            {
                "mount_point": "/data",
                "device": "/dev/sdb1",
                "fs_type": "xfs",
                "total_bytes": 4000787030016,
                "used_bytes": 2800550921011,
                "available_bytes": 1200236108005,
                "percent": 70.0,
            },
        ]

        # Create mock server data
        server_data = {
            "id": "test-server",
            "hostname": "test.local",
            "display_name": "Test Server",
            "ip_address": "192.168.1.100",
            "status": "online",
            "is_paused": False,
            "is_inactive": False,
            "sudo_mode": "passwordless",
            "machine_type": "server",
            "created_at": datetime.now(UTC),
            "updated_at": datetime.now(UTC),
            "filesystems": filesystems_data,
            "active_alert_count": 0,
        }

        response = ServerResponse(**server_data)

        assert response.filesystems is not None
        assert len(response.filesystems) == 2
        assert response.filesystems[0].mount_point == "/"
        assert response.filesystems[1].mount_point == "/data"
        assert response.filesystems[0].percent == 60.0
        assert response.filesystems[1].percent == 70.0

    def test_server_response_without_filesystems(self):
        """TC009: Server API returns empty filesystems for new server."""
        server_data = {
            "id": "new-server",
            "hostname": "new.local",
            "display_name": None,
            "ip_address": None,
            "status": "unknown",
            "is_paused": False,
            "is_inactive": False,
            "sudo_mode": "passwordless",
            "machine_type": "server",
            "created_at": datetime.now(UTC),
            "updated_at": datetime.now(UTC),
            "filesystems": None,  # No data yet
            "active_alert_count": 0,
        }

        response = ServerResponse(**server_data)

        assert response.filesystems is None
