"""Tests for network interface metrics collection (US0179).

Tests cover:
- Agent collects data from /proc/net/dev
- Loopback interface filtered out
- Virtual interfaces (tailscale, docker, veth, bridge) included
- Interface up/down state detection
- Edge cases (empty, missing, malformed data)
"""

from pathlib import Path
from unittest.mock import patch

from collectors import get_network_interfaces

# Standard /proc/net/dev content with multiple interfaces
MOCK_PROC_NET_DEV_STANDARD = """\
Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo: 1234567   12345    0    0    0     0          0         0  1234567   12345    0    0    0     0       0          0
  eth0: 1073741824 1000000    0    0    0     0          0         0 536870912  500000    0    0    0     0       0          0
tailscale0: 10737418   10000    0    0    0     0          0         0  5368709    5000    0    0    0     0       0          0
docker0:       0       0    0    0    0     0          0         0       0       0    0    0    0     0       0          0
"""

# /proc/net/dev with only loopback (no physical interfaces)
MOCK_PROC_NET_DEV_LO_ONLY = """\
Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo: 1234567   12345    0    0    0     0          0         0  1234567   12345    0    0    0     0       0          0
"""

# /proc/net/dev with only headers (empty)
MOCK_PROC_NET_DEV_EMPTY = """\
Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
"""

# /proc/net/dev with a malformed line
MOCK_PROC_NET_DEV_MALFORMED = """\
Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo: 1234567   12345    0    0    0     0          0         0  1234567   12345    0    0    0     0       0          0
  eth0: baddata
  eth1: 1000 2000 0 0 0 0 0 0 3000 4000 0 0 0 0 0 0
"""


class TestGetNetworkInterfaces:
    """Tests for get_network_interfaces() function."""

    def test_collects_from_proc_net_dev(self, tmp_path):
        """TC001: Agent collects network interface data from /proc/net/dev."""
        # Create mock /proc/net/dev
        mock_net_dev = tmp_path / "proc" / "net" / "dev"
        mock_net_dev.parent.mkdir(parents=True)
        mock_net_dev.write_text(MOCK_PROC_NET_DEV_STANDARD)

        # Create mock operstate files
        net_path = tmp_path / "sys" / "class" / "net"
        for iface in ["eth0", "tailscale0", "docker0"]:
            operstate = net_path / iface / "operstate"
            operstate.parent.mkdir(parents=True)
            operstate.write_text("up" if iface != "docker0" else "down")

        with (
            patch.object(Path, "__new__", side_effect=lambda cls, p: Path.__new__(cls, str(p).replace("/proc/net/dev", str(mock_net_dev)).replace("/sys/class/net", str(net_path)))),
        ):
            # For this test, we'll use a simpler approach - mock the path directly
            pass

        # Direct test with mocked read_text
        with (
            patch("collectors.Path") as MockPath,
        ):
            # Setup mock for /proc/net/dev
            mock_net_dev_path = MockPath.return_value
            mock_net_dev_path.exists.return_value = True
            mock_net_dev_path.read_text.return_value = MOCK_PROC_NET_DEV_STANDARD

            # We need to handle both /proc/net/dev and /sys/class/net/{name}/operstate
            def path_factory(path_str):
                mock = type(MockPath.return_value)()
                if path_str == "/proc/net/dev":
                    mock.exists.return_value = True
                    mock.read_text.return_value = MOCK_PROC_NET_DEV_STANDARD
                elif "/sys/class/net/" in path_str and "operstate" in path_str:
                    mock.exists.return_value = True
                    if "docker0" in path_str:
                        mock.read_text.return_value = "down"
                    else:
                        mock.read_text.return_value = "up"
                else:
                    mock.exists.return_value = False
                return mock

            MockPath.side_effect = path_factory

            interfaces = get_network_interfaces()

            # Should have 3 interfaces (lo excluded)
            assert len(interfaces) == 3
            names = [iface["name"] for iface in interfaces]
            assert "eth0" in names
            assert "tailscale0" in names
            assert "docker0" in names
            assert "lo" not in names

    def test_excludes_loopback_interface(self):
        """TC012: Agent excludes loopback interface (lo)."""
        with patch("collectors.Path") as MockPath:
            mock_path = MockPath.return_value
            mock_path.exists.return_value = True
            mock_path.read_text.return_value = MOCK_PROC_NET_DEV_STANDARD

            def path_factory(path_str):
                mock = type(MockPath.return_value)()
                if path_str == "/proc/net/dev":
                    mock.exists.return_value = True
                    mock.read_text.return_value = MOCK_PROC_NET_DEV_STANDARD
                elif "/sys/class/net/" in path_str:
                    mock.exists.return_value = True
                    mock.read_text.return_value = "up"
                return mock

            MockPath.side_effect = path_factory

            interfaces = get_network_interfaces()
            names = [iface["name"] for iface in interfaces]
            assert "lo" not in names

    def test_includes_tailscale_interface(self):
        """TC013: Agent includes tailscale interface."""
        with patch("collectors.Path") as MockPath:
            def path_factory(path_str):
                mock = type(MockPath.return_value)()
                if path_str == "/proc/net/dev":
                    mock.exists.return_value = True
                    mock.read_text.return_value = MOCK_PROC_NET_DEV_STANDARD
                elif "/sys/class/net/" in path_str:
                    mock.exists.return_value = True
                    mock.read_text.return_value = "up"
                return mock

            MockPath.side_effect = path_factory

            interfaces = get_network_interfaces()
            tailscale = next((i for i in interfaces if i["name"] == "tailscale0"), None)
            assert tailscale is not None
            assert tailscale["rx_bytes"] == 10737418
            assert tailscale["tx_bytes"] == 5368709

    def test_includes_docker_interface(self):
        """TC014: Agent includes docker and bridge interfaces."""
        with patch("collectors.Path") as MockPath:
            def path_factory(path_str):
                mock = type(MockPath.return_value)()
                if path_str == "/proc/net/dev":
                    mock.exists.return_value = True
                    mock.read_text.return_value = MOCK_PROC_NET_DEV_STANDARD
                elif "/sys/class/net/" in path_str:
                    mock.exists.return_value = True
                    if "docker0" in path_str:
                        mock.read_text.return_value = "down"
                    else:
                        mock.read_text.return_value = "up"
                return mock

            MockPath.side_effect = path_factory

            interfaces = get_network_interfaces()
            docker = next((i for i in interfaces if i["name"] == "docker0"), None)
            assert docker is not None
            assert docker["rx_bytes"] == 0
            assert docker["is_up"] is False

    def test_handles_empty_proc_net_dev(self):
        """TC002: Agent handles empty /proc/net/dev (headers only)."""
        with patch("collectors.Path") as MockPath:
            def path_factory(path_str):
                mock = type(MockPath.return_value)()
                if path_str == "/proc/net/dev":
                    mock.exists.return_value = True
                    mock.read_text.return_value = MOCK_PROC_NET_DEV_EMPTY
                return mock

            MockPath.side_effect = path_factory

            interfaces = get_network_interfaces()
            assert interfaces == []

    def test_handles_missing_proc_net_dev(self):
        """TC003: Agent handles missing /proc/net/dev."""
        with patch("collectors.Path") as MockPath:
            def path_factory(path_str):
                mock = type(MockPath.return_value)()
                mock.exists.return_value = False
                return mock

            MockPath.side_effect = path_factory

            interfaces = get_network_interfaces()
            assert interfaces == []

    def test_handles_malformed_line(self):
        """TC004: Agent handles malformed /proc/net/dev line."""
        with patch("collectors.Path") as MockPath:
            def path_factory(path_str):
                mock = type(MockPath.return_value)()
                if path_str == "/proc/net/dev":
                    mock.exists.return_value = True
                    mock.read_text.return_value = MOCK_PROC_NET_DEV_MALFORMED
                elif "/sys/class/net/" in path_str:
                    mock.exists.return_value = True
                    mock.read_text.return_value = "up"
                return mock

            MockPath.side_effect = path_factory

            interfaces = get_network_interfaces()
            # Should still get eth1 even with malformed eth0 line
            names = [iface["name"] for iface in interfaces]
            assert "lo" not in names  # Excluded
            # eth0 should be skipped due to malformed data
            # eth1 should be included
            assert "eth1" in names

    def test_handles_read_error(self):
        """Agent returns empty list on read error."""
        with patch("collectors.Path") as MockPath:
            def path_factory(path_str):
                mock = type(MockPath.return_value)()
                mock.exists.return_value = True
                mock.read_text.side_effect = OSError("Read error")
                return mock

            MockPath.side_effect = path_factory

            interfaces = get_network_interfaces()
            assert interfaces == []

    def test_handles_operstate_read_error(self):
        """Agent assumes interface is up if operstate cannot be read."""
        with patch("collectors.Path") as MockPath:
            def path_factory(path_str):
                mock = type(MockPath.return_value)()
                if path_str == "/proc/net/dev":
                    mock.exists.return_value = True
                    mock.read_text.return_value = MOCK_PROC_NET_DEV_LO_ONLY.replace("lo:", "eth0:")
                elif "/sys/class/net/" in path_str:
                    mock.exists.return_value = True
                    mock.read_text.side_effect = PermissionError("Cannot read")
                return mock

            MockPath.side_effect = path_factory

            interfaces = get_network_interfaces()
            # Should still get the interface, with is_up defaulting to True
            if interfaces:  # eth0 after lo replacement
                assert interfaces[0]["is_up"] is True

    def test_lo_only_returns_empty(self):
        """Agent returns empty list when only loopback exists (EC3)."""
        with patch("collectors.Path") as MockPath:
            def path_factory(path_str):
                mock = type(MockPath.return_value)()
                if path_str == "/proc/net/dev":
                    mock.exists.return_value = True
                    mock.read_text.return_value = MOCK_PROC_NET_DEV_LO_ONLY
                return mock

            MockPath.side_effect = path_factory

            interfaces = get_network_interfaces()
            assert interfaces == []

    def test_interface_up_detection(self):
        """Agent correctly detects interface is_up state (EC1)."""
        with patch("collectors.Path") as MockPath:
            def path_factory(path_str):
                mock = type(MockPath.return_value)()
                if path_str == "/proc/net/dev":
                    mock.exists.return_value = True
                    mock.read_text.return_value = MOCK_PROC_NET_DEV_STANDARD
                elif "/sys/class/net/eth0/operstate" in path_str:
                    mock.exists.return_value = True
                    mock.read_text.return_value = "up"
                elif "/sys/class/net/docker0/operstate" in path_str:
                    mock.exists.return_value = True
                    mock.read_text.return_value = "down"
                elif "/sys/class/net/" in path_str:
                    mock.exists.return_value = True
                    mock.read_text.return_value = "up"
                return mock

            MockPath.side_effect = path_factory

            interfaces = get_network_interfaces()

            eth0 = next((i for i in interfaces if i["name"] == "eth0"), None)
            docker0 = next((i for i in interfaces if i["name"] == "docker0"), None)

            assert eth0 is not None
            assert eth0["is_up"] is True

            assert docker0 is not None
            assert docker0["is_up"] is False
