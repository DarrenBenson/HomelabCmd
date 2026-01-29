"""Tests for agent filesystem metrics collection (US0178).

Tests the get_filesystem_metrics function in collectors.py.
"""

from unittest.mock import MagicMock, patch

from collectors import (
    _EXCLUDED_MOUNT_PREFIXES,
    _VIRTUAL_FS_TYPES,
    get_filesystem_metrics,
)


class TestGetFilesystemMetrics:
    """Test get_filesystem_metrics function (TC001-TC004, TC012-TC015)."""

    @patch("collectors.shutil.disk_usage")
    @patch("collectors.Path")
    def test_collects_filesystem_data(self, mock_path_cls, mock_disk_usage):
        """TC001: Agent collects filesystem data from /proc/mounts."""
        # Mock /proc/mounts content
        mounts_content = (
            "/dev/sda1 / ext4 rw,relatime 0 0\n"
            "/dev/sdb1 /data xfs rw,relatime 0 0\n"
        )

        mock_path = MagicMock()
        mock_path.exists.return_value = True
        mock_path.read_text.return_value = mounts_content
        mock_path_cls.return_value = mock_path

        # Mock disk_usage for each mount
        mock_disk_usage.side_effect = [
            MagicMock(total=107374182400, used=64424509440, free=42949672960),  # /
            MagicMock(total=4000787030016, used=2800550921011, free=1200236108005),  # /data
        ]

        result = get_filesystem_metrics()

        assert len(result) == 2
        assert result[0]["mount_point"] == "/"
        assert result[0]["device"] == "/dev/sda1"
        assert result[0]["fs_type"] == "ext4"
        assert result[0]["total_bytes"] == 107374182400
        assert result[0]["used_bytes"] == 64424509440
        assert result[0]["available_bytes"] == 42949672960
        assert result[0]["percent"] == 60.0

        assert result[1]["mount_point"] == "/data"
        assert result[1]["fs_type"] == "xfs"

    @patch("collectors.Path")
    def test_handles_empty_proc_mounts(self, mock_path_cls):
        """TC002: Agent handles empty /proc/mounts."""
        mock_path = MagicMock()
        mock_path.exists.return_value = True
        mock_path.read_text.return_value = ""
        mock_path_cls.return_value = mock_path

        result = get_filesystem_metrics()

        assert result == []

    @patch("collectors.shutil.disk_usage")
    @patch("collectors.Path")
    def test_handles_inaccessible_mount_point(self, mock_path_cls, mock_disk_usage):
        """TC003: Agent handles inaccessible mount point."""
        mounts_content = (
            "/dev/sda1 / ext4 rw,relatime 0 0\n"
            "/dev/sdb1 /restricted ext4 rw,relatime 0 0\n"
        )

        mock_path = MagicMock()
        mock_path.exists.return_value = True
        mock_path.read_text.return_value = mounts_content
        mock_path_cls.return_value = mock_path

        # First mount succeeds, second raises PermissionError
        mock_disk_usage.side_effect = [
            MagicMock(total=100, used=50, free=50),
            PermissionError("Permission denied"),
        ]

        result = get_filesystem_metrics()

        # Should still get the first filesystem
        assert len(result) == 1
        assert result[0]["mount_point"] == "/"

    @patch("collectors.shutil.disk_usage")
    @patch("collectors.Path")
    def test_handles_offline_network_mount(self, mock_path_cls, mock_disk_usage):
        """TC004: Agent handles OSError for offline network mount."""
        mounts_content = (
            "/dev/sda1 / ext4 rw,relatime 0 0\n"
            "nfs-server:/share /nfs nfs rw 0 0\n"
        )

        mock_path = MagicMock()
        mock_path.exists.return_value = True
        mock_path.read_text.return_value = mounts_content
        mock_path_cls.return_value = mock_path

        # First mount succeeds, NFS raises OSError
        mock_disk_usage.side_effect = [
            MagicMock(total=100, used=50, free=50),
            OSError("Network unreachable"),
        ]

        result = get_filesystem_metrics()

        # Should still get the local filesystem
        assert len(result) == 1
        assert result[0]["mount_point"] == "/"

    @patch("collectors.shutil.disk_usage")
    @patch("collectors.Path")
    def test_excludes_tmpfs(self, mock_path_cls, mock_disk_usage):
        """TC012: Agent excludes tmpfs filesystem."""
        mounts_content = (
            "/dev/sda1 / ext4 rw,relatime 0 0\n"
            "tmpfs /tmp tmpfs rw,nosuid,nodev 0 0\n"
        )

        mock_path = MagicMock()
        mock_path.exists.return_value = True
        mock_path.read_text.return_value = mounts_content
        mock_path_cls.return_value = mock_path

        mock_disk_usage.return_value = MagicMock(total=100, used=50, free=50)

        result = get_filesystem_metrics()

        assert len(result) == 1
        assert result[0]["mount_point"] == "/"
        assert not any(fs["fs_type"] == "tmpfs" for fs in result)

    @patch("collectors.shutil.disk_usage")
    @patch("collectors.Path")
    def test_excludes_devtmpfs(self, mock_path_cls, mock_disk_usage):
        """TC013: Agent excludes devtmpfs filesystem."""
        mounts_content = (
            "/dev/sda1 / ext4 rw,relatime 0 0\n"
            "devtmpfs /dev devtmpfs rw,nosuid,noexec,relatime 0 0\n"
        )

        mock_path = MagicMock()
        mock_path.exists.return_value = True
        mock_path.read_text.return_value = mounts_content
        mock_path_cls.return_value = mock_path

        mock_disk_usage.return_value = MagicMock(total=100, used=50, free=50)

        result = get_filesystem_metrics()

        assert len(result) == 1
        assert not any(fs["fs_type"] == "devtmpfs" for fs in result)

    @patch("collectors.shutil.disk_usage")
    @patch("collectors.Path")
    def test_excludes_squashfs_snap(self, mock_path_cls, mock_disk_usage):
        """TC014: Agent excludes squashfs (snap) filesystem."""
        mounts_content = (
            "/dev/sda1 / ext4 rw,relatime 0 0\n"
            "/dev/loop0 /snap/core/12345 squashfs ro,nodev,relatime 0 0\n"
        )

        mock_path = MagicMock()
        mock_path.exists.return_value = True
        mock_path.read_text.return_value = mounts_content
        mock_path_cls.return_value = mock_path

        mock_disk_usage.return_value = MagicMock(total=100, used=50, free=50)

        result = get_filesystem_metrics()

        assert len(result) == 1
        assert not any(fs["fs_type"] == "squashfs" for fs in result)
        assert not any(fs["mount_point"].startswith("/snap") for fs in result)

    @patch("collectors.shutil.disk_usage")
    @patch("collectors.Path")
    def test_excludes_system_paths(self, mock_path_cls, mock_disk_usage):
        """TC015: Agent excludes system paths (/sys, /proc, /run)."""
        mounts_content = (
            "/dev/sda1 / ext4 rw,relatime 0 0\n"
            "sysfs /sys sysfs rw,nosuid,nodev,noexec,relatime 0 0\n"
            "proc /proc proc rw,nosuid,nodev,noexec,relatime 0 0\n"
            "tmpfs /run tmpfs rw,nosuid,nodev,mode=755 0 0\n"
        )

        mock_path = MagicMock()
        mock_path.exists.return_value = True
        mock_path.read_text.return_value = mounts_content
        mock_path_cls.return_value = mock_path

        mock_disk_usage.return_value = MagicMock(total=100, used=50, free=50)

        result = get_filesystem_metrics()

        assert len(result) == 1
        assert result[0]["mount_point"] == "/"
        assert not any(fs["mount_point"].startswith("/sys") for fs in result)
        assert not any(fs["mount_point"].startswith("/proc") for fs in result)
        assert not any(fs["mount_point"].startswith("/run") for fs in result)

    @patch("collectors.shutil.disk_usage")
    @patch("collectors.Path")
    def test_deduplicates_bind_mounts(self, mock_path_cls, mock_disk_usage):
        """Test bind mounts are deduplicated by device."""
        mounts_content = (
            "/dev/sda1 / ext4 rw,relatime 0 0\n"
            "/dev/sda1 /mnt/bind ext4 rw,relatime 0 0\n"  # Same device, bind mount
        )

        mock_path = MagicMock()
        mock_path.exists.return_value = True
        mock_path.read_text.return_value = mounts_content
        mock_path_cls.return_value = mock_path

        mock_disk_usage.return_value = MagicMock(total=100, used=50, free=50)

        result = get_filesystem_metrics()

        # Should only have one entry for /dev/sda1
        assert len(result) == 1
        assert result[0]["mount_point"] == "/"

    @patch("collectors.Path")
    def test_handles_missing_proc_mounts(self, mock_path_cls):
        """Test handling when /proc/mounts doesn't exist."""
        mock_path = MagicMock()
        mock_path.exists.return_value = False
        mock_path_cls.return_value = mock_path

        result = get_filesystem_metrics()

        assert result == []

    @patch("collectors.Path")
    def test_handles_read_error(self, mock_path_cls):
        """Test handling when /proc/mounts can't be read."""
        mock_path = MagicMock()
        mock_path.exists.return_value = True
        mock_path.read_text.side_effect = OSError("Read error")
        mock_path_cls.return_value = mock_path

        result = get_filesystem_metrics()

        assert result == []


class TestVirtualFsTypeConstants:
    """Test virtual filesystem type exclusion list."""

    def test_excludes_common_virtual_types(self):
        """Verify common virtual filesystem types are in exclusion list."""
        expected = {"tmpfs", "devtmpfs", "squashfs", "overlay", "proc", "sysfs"}
        assert expected.issubset(_VIRTUAL_FS_TYPES)

    def test_mount_prefix_exclusions(self):
        """Verify system mount prefixes are excluded."""
        expected = ("/sys", "/proc", "/dev", "/run", "/snap")
        assert _EXCLUDED_MOUNT_PREFIXES == expected
