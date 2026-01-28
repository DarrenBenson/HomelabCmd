"""Scan service for ad-hoc device scanning.

This module provides the scan execution logic for collecting system information
from remote devices via SSH. Supports quick and full scan types.

US0038: Scan Initiation
"""

import logging
import re
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.db.models.scan import Scan, ScanStatus, ScanType
from homelab_cmd.services.ssh import get_ssh_service

logger = logging.getLogger(__name__)


@dataclass
class ScanResults:
    """Structured scan results."""

    os: dict[str, str] | None = None
    hostname: str | None = None
    uptime_seconds: int | None = None
    disk: list[dict[str, Any]] = field(default_factory=list)
    memory: dict[str, Any] | None = None
    packages: dict[str, Any] | None = None
    processes: list[dict[str, Any]] = field(default_factory=list)
    network_interfaces: list[dict[str, Any]] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON storage."""
        return {
            "os": self.os,
            "hostname": self.hostname,
            "uptime_seconds": self.uptime_seconds,
            "disk": self.disk,
            "memory": self.memory,
            "packages": self.packages,
            "processes": self.processes,
            "network_interfaces": self.network_interfaces,
            "errors": self.errors if self.errors else None,
        }


class ScanService:
    """Service for executing scans on remote devices.

    Handles SSH command execution and result parsing for system information.
    """

    # Quick scan steps and their progress percentages
    QUICK_SCAN_STEPS = [
        ("Collecting OS information", 0),
        ("Getting hostname", 20),
        ("Checking uptime", 40),
        ("Collecting disk usage", 60),
        ("Collecting memory usage", 80),
        ("Finalising results", 100),
    ]

    # Full scan adds these steps
    FULL_SCAN_ADDITIONAL_STEPS = [
        ("Counting packages", 55),
        ("Listing recent packages", 60),
        ("Listing top processes", 70),
        ("Collecting network interfaces", 85),
    ]

    def __init__(self) -> None:
        """Initialise the scan service."""
        self.ssh_service = get_ssh_service()

    # =========================================================================
    # Parsing Methods
    # =========================================================================

    @staticmethod
    def parse_os_release(output: str) -> dict[str, str]:
        """Parse /etc/os-release output.

        Args:
            output: Content of /etc/os-release

        Returns:
            Dict with name, version, and other OS details.
        """
        result: dict[str, str] = {}

        for line in output.strip().split("\n"):
            if "=" in line:
                key, _, value = line.partition("=")
                # Remove quotes from value
                value = value.strip().strip('"').strip("'")
                key = key.strip().lower()

                if key == "name":
                    result["name"] = value
                elif key == "version_id":
                    result["version"] = value
                elif key == "pretty_name":
                    result["pretty_name"] = value
                elif key == "id":
                    result["id"] = value

        return result

    @staticmethod
    def parse_kernel_version(output: str) -> str:
        """Parse uname -r output.

        Args:
            output: Output of uname -r

        Returns:
            Kernel version string.
        """
        return output.strip()

    @staticmethod
    def parse_uptime(output: str) -> int:
        """Parse /proc/uptime output.

        Args:
            output: Content of /proc/uptime (two floats separated by space)

        Returns:
            Uptime in seconds (integer).
        """
        try:
            # First field is uptime in seconds
            uptime_str = output.strip().split()[0]
            return int(float(uptime_str))
        except (IndexError, ValueError):
            return 0

    @staticmethod
    def parse_disk_usage(output: str) -> list[dict[str, Any]]:
        """Parse df -P output.

        Args:
            output: Output of df -P (POSIX format)

        Returns:
            List of disk mount dictionaries.
        """
        disks = []

        lines = output.strip().split("\n")
        # Skip header line
        for line in lines[1:]:
            parts = line.split()
            if len(parts) >= 6:
                # df -P format: Filesystem 1024-blocks Used Available Capacity Mounted
                try:
                    total_kb = int(parts[1])
                    used_kb = int(parts[2])
                    percent_str = parts[4].rstrip("%")
                    percent = int(percent_str) if percent_str.isdigit() else 0
                    mount = parts[5]

                    # Skip pseudo filesystems
                    if mount.startswith("/dev") or mount == "/boot/efi":
                        if not parts[0].startswith("/dev"):
                            continue

                    disks.append(
                        {
                            "mount": mount,
                            "total_gb": round(total_kb / 1024 / 1024, 1),
                            "used_gb": round(used_kb / 1024 / 1024, 1),
                            "percent": percent,
                        }
                    )
                except (ValueError, IndexError):
                    continue

        return disks

    @staticmethod
    def parse_memory(output: str) -> dict[str, Any]:
        """Parse free -b output.

        Args:
            output: Output of free -b (bytes format)

        Returns:
            Dict with total, used, and percent memory.
        """
        try:
            lines = output.strip().split("\n")
            # Find the Mem: line
            for line in lines:
                if line.startswith("Mem:"):
                    parts = line.split()
                    if len(parts) >= 3:
                        total_bytes = int(parts[1])
                        used_bytes = int(parts[2])
                        total_mb = round(total_bytes / 1024 / 1024)
                        used_mb = round(used_bytes / 1024 / 1024)
                        percent = round((used_bytes / total_bytes) * 100) if total_bytes > 0 else 0

                        return {
                            "total_mb": total_mb,
                            "used_mb": used_mb,
                            "percent": percent,
                        }
        except (ValueError, IndexError):
            pass

        return {"total_mb": 0, "used_mb": 0, "percent": 0}

    @staticmethod
    def parse_package_count(output: str) -> int:
        """Parse package count output.

        Args:
            output: Output of dpkg -l | wc -l or rpm -qa | wc -l

        Returns:
            Number of packages.
        """
        try:
            # dpkg -l has 5 header lines, so subtract them
            count = int(output.strip())
            return max(0, count - 5)  # Subtract header lines for dpkg
        except ValueError:
            return 0

    @staticmethod
    def parse_package_list(output: str) -> list[str]:
        """Parse package list output.

        Args:
            output: Output of dpkg -l or rpm -qa

        Returns:
            List of package names (last 50).
        """
        packages = []
        lines = output.strip().split("\n")

        for line in lines:
            # Skip header lines for dpkg
            if line.startswith(("||", "++", "Desired", "|", "| ")):
                continue

            parts = line.split()
            if len(parts) >= 2:
                # dpkg format: status name version arch description
                # rpm format: name-version-release.arch
                if line.startswith(("ii ", "rc ", "hi ", "un ")):
                    packages.append(parts[1])  # dpkg format
                elif not line.startswith("|"):  # Skip remaining header variants
                    packages.append(parts[0])  # rpm format

        return packages[-50:]  # Return last 50

    @staticmethod
    def parse_processes(output: str) -> list[dict[str, Any]]:
        """Parse ps aux output.

        Args:
            output: Output of ps aux --sort=-pmem

        Returns:
            List of process dictionaries.
        """
        processes = []
        lines = output.strip().split("\n")

        # Skip header line
        for line in lines[1:]:
            parts = line.split(None, 10)  # Split on whitespace, max 11 parts
            if len(parts) >= 11:
                try:
                    processes.append(
                        {
                            "user": parts[0],
                            "pid": int(parts[1]),
                            "cpu_percent": float(parts[2]),
                            "mem_percent": float(parts[3]),
                            "command": parts[10][:100],  # Truncate long commands
                        }
                    )
                except (ValueError, IndexError):
                    continue

        return processes[:20]  # Return top 20

    @staticmethod
    def parse_network_interfaces(output: str) -> list[dict[str, Any]]:
        """Parse ip addr show output.

        Args:
            output: Output of ip addr show

        Returns:
            List of network interface dictionaries.
        """
        interfaces = []
        current_interface: dict[str, Any] | None = None

        for line in output.strip().split("\n"):
            # New interface starts with number: name:
            if re.match(r"^\d+:", line):
                if current_interface:
                    interfaces.append(current_interface)

                parts = line.split(":")
                if len(parts) >= 2:
                    name = parts[1].strip().split("@")[0]
                    current_interface = {
                        "name": name,
                        "state": "unknown",
                        "addresses": [],
                    }

                    # Check state - look for "state X" pattern first
                    state_match = re.search(r"state\s+(\w+)", line)
                    if state_match:
                        state = state_match.group(1).lower()
                        if state in ("up", "down", "unknown"):
                            current_interface["state"] = state
                    elif "state UP" in line or "> mtu" in line and ",UP" in line.split(">")[0]:
                        # Fallback: check flags for UP/DOWN
                        current_interface["state"] = "up"
                    elif "state DOWN" in line or "> mtu" in line and ",DOWN" in line.split(">")[0]:
                        current_interface["state"] = "down"

            elif current_interface and "inet " in line:
                # IPv4 address
                match = re.search(r"inet\s+(\d+\.\d+\.\d+\.\d+/\d+)", line)
                if match:
                    current_interface["addresses"].append(
                        {
                            "type": "ipv4",
                            "address": match.group(1),
                        }
                    )

            elif current_interface and "inet6 " in line:
                # IPv6 address
                match = re.search(r"inet6\s+([a-fA-F0-9:]+/\d+)", line)
                if match:
                    current_interface["addresses"].append(
                        {
                            "type": "ipv6",
                            "address": match.group(1),
                        }
                    )

        # Don't forget the last interface
        if current_interface:
            interfaces.append(current_interface)

        return interfaces

    # =========================================================================
    # Scan Execution
    # =========================================================================

    async def execute_scan(
        self,
        scan: Scan,
        session: AsyncSession,
        progress_callback: Callable[[int, str], None] | None = None,
    ) -> ScanResults:
        """Execute a scan on a remote device.

        Args:
            scan: Scan record with target configuration.
            session: Database session for updating progress.
            progress_callback: Optional callback for progress updates.

        Returns:
            ScanResults with collected data.
        """
        results = ScanResults()
        is_full = scan.scan_type == ScanType.FULL.value

        async def update_progress(percent: int, step: str) -> None:
            """Update scan progress in database."""
            scan.progress = percent
            scan.current_step = step
            await session.commit()
            if progress_callback:
                progress_callback(percent, step)

        # Mark as running
        scan.status = ScanStatus.RUNNING.value
        scan.started_at = datetime.now(UTC)
        await session.commit()

        try:
            # Step 1: OS Information
            await update_progress(0, "Collecting OS information")
            os_result = await self.ssh_service.execute_command(
                hostname=scan.hostname,
                port=scan.port,
                username=scan.username,
                command="cat /etc/os-release 2>/dev/null || echo ''",
            )
            if os_result.error:
                # Connection failed - abort scan
                scan.status = ScanStatus.FAILED.value
                scan.error = os_result.error
                scan.completed_at = datetime.now(UTC)
                await session.commit()
                return results

            os_info = self.parse_os_release(os_result.stdout)

            # Get kernel version
            kernel_result = await self.ssh_service.execute_command(
                hostname=scan.hostname,
                port=scan.port,
                username=scan.username,
                command="uname -r",
            )
            if kernel_result.success:
                os_info["kernel"] = self.parse_kernel_version(kernel_result.stdout)

            results.os = os_info

            # Step 2: Hostname
            await update_progress(20, "Getting hostname")
            hostname_result = await self.ssh_service.execute_command(
                hostname=scan.hostname,
                port=scan.port,
                username=scan.username,
                command="hostname",
            )
            if hostname_result.success:
                results.hostname = hostname_result.stdout.strip()
            else:
                results.errors.append("Failed to get hostname")

            # Step 3: Uptime
            await update_progress(40, "Checking uptime")
            uptime_result = await self.ssh_service.execute_command(
                hostname=scan.hostname,
                port=scan.port,
                username=scan.username,
                command="cat /proc/uptime",
            )
            if uptime_result.success:
                results.uptime_seconds = self.parse_uptime(uptime_result.stdout)
            else:
                results.errors.append("Failed to get uptime")

            # For full scan, collect additional data before disk/memory
            if is_full:
                # Step: Package count
                await update_progress(50, "Counting packages")
                pkg_count_result = await self.ssh_service.execute_command(
                    hostname=scan.hostname,
                    port=scan.port,
                    username=scan.username,
                    command="dpkg -l 2>/dev/null | wc -l || rpm -qa 2>/dev/null | wc -l || echo 0",
                )
                pkg_count = (
                    self.parse_package_count(pkg_count_result.stdout)
                    if pkg_count_result.success
                    else 0
                )

                # Step: Package list
                await update_progress(55, "Listing recent packages")
                pkg_list_result = await self.ssh_service.execute_command(
                    hostname=scan.hostname,
                    port=scan.port,
                    username=scan.username,
                    command="dpkg -l 2>/dev/null | tail -50 || rpm -qa 2>/dev/null | tail -50 || echo ''",
                )
                pkg_list = (
                    self.parse_package_list(pkg_list_result.stdout)
                    if pkg_list_result.success
                    else []
                )

                results.packages = {
                    "count": pkg_count,
                    "recent": pkg_list,
                }

            # Step 4: Disk usage
            progress_disk = 60 if not is_full else 65
            await update_progress(progress_disk, "Collecting disk usage")
            disk_result = await self.ssh_service.execute_command(
                hostname=scan.hostname,
                port=scan.port,
                username=scan.username,
                command="df -P",
            )
            if disk_result.success:
                results.disk = self.parse_disk_usage(disk_result.stdout)
            else:
                results.errors.append("Failed to get disk usage")

            # For full scan, collect processes
            if is_full:
                await update_progress(70, "Listing top processes")
                ps_result = await self.ssh_service.execute_command(
                    hostname=scan.hostname,
                    port=scan.port,
                    username=scan.username,
                    command="ps aux --sort=-pmem | head -21",
                )
                if ps_result.success:
                    results.processes = self.parse_processes(ps_result.stdout)
                else:
                    results.errors.append("Failed to get process list")

            # Step 5: Memory usage
            progress_mem = 80 if not is_full else 75
            await update_progress(progress_mem, "Collecting memory usage")
            mem_result = await self.ssh_service.execute_command(
                hostname=scan.hostname,
                port=scan.port,
                username=scan.username,
                command="free -b",
            )
            if mem_result.success:
                results.memory = self.parse_memory(mem_result.stdout)
            else:
                results.errors.append("Failed to get memory usage")

            # For full scan, collect network interfaces
            if is_full:
                await update_progress(85, "Collecting network interfaces")
                net_result = await self.ssh_service.execute_command(
                    hostname=scan.hostname,
                    port=scan.port,
                    username=scan.username,
                    command="ip addr show 2>/dev/null || ifconfig 2>/dev/null || echo ''",
                )
                if net_result.success:
                    results.network_interfaces = self.parse_network_interfaces(net_result.stdout)
                else:
                    results.errors.append("Failed to get network interfaces")

            # Step 6: Finalise
            await update_progress(100, "Finalising results")
            scan.status = ScanStatus.COMPLETED.value
            scan.results = results.to_dict()
            scan.completed_at = datetime.now(UTC)
            await session.commit()

        except Exception as e:
            logger.exception("Scan failed for %s: %s", scan.hostname, e)
            scan.status = ScanStatus.FAILED.value
            scan.error = str(e)
            scan.completed_at = datetime.now(UTC)
            await session.commit()

        return results


# Module-level instance for convenience
_scan_service: ScanService | None = None


def get_scan_service() -> ScanService:
    """Get the scan service instance.

    Returns:
        Singleton ScanService instance.
    """
    global _scan_service
    if _scan_service is None:
        _scan_service = ScanService()
    return _scan_service
