"""System metrics and information collectors.

This module provides functions to collect system metrics (CPU, memory, disk,
network, etc.) and OS information for the HomelabCmd monitoring agent.
"""

from __future__ import annotations

import logging
import os
import platform
import re
import socket
import subprocess
import time
from pathlib import Path
from typing import Any

import psutil

logger = logging.getLogger(__name__)


def get_cpu_info() -> dict[str, str | int | None]:
    """Collect CPU information for power profile detection.

    Reads CPU model from /proc/cpuinfo and core count from os.cpu_count().

    Returns:
        Dictionary containing:
            cpu_model: CPU model name (e.g., "Intel(R) Core(TM) i5-8250U")
            cpu_cores: Number of logical CPU cores
    """
    cpu_model: str | None = None
    cpu_cores: int | None = None

    # Get core count from os module
    try:
        cpu_cores = os.cpu_count()
    except OSError as e:
        logger.warning("Failed to get CPU core count: %s", e)

    # Read CPU model from /proc/cpuinfo
    cpuinfo_path = Path("/proc/cpuinfo")
    try:
        if cpuinfo_path.exists():
            content = cpuinfo_path.read_text()
            for line in content.split("\n"):
                # x86/x86_64 systems use "model name"
                if line.startswith("model name"):
                    cpu_model = line.split(":", 1)[1].strip()
                    break
                # ARM systems use "Model" or "Hardware"
                elif line.startswith("Model"):
                    cpu_model = line.split(":", 1)[1].strip()
                    break
                elif line.startswith("Hardware"):
                    cpu_model = line.split(":", 1)[1].strip()
                    # Don't break - prefer "Model" if it comes later
    except OSError as e:
        logger.warning("Failed to read /proc/cpuinfo: %s", e)

    # Fallback: try platform.processor()
    if not cpu_model:
        try:
            proc = platform.processor()
            if proc:
                cpu_model = proc
        except Exception:
            pass

    return {
        "cpu_model": cpu_model,
        "cpu_cores": cpu_cores,
    }


def get_os_info() -> dict[str, str | None]:
    """Collect operating system information.

    Returns:
        Dictionary containing distribution, version, kernel, and architecture.
    """
    uname = platform.uname()

    # Try to get distribution info from freedesktop os-release
    distribution: str | None = None
    version: str | None = None

    try:
        if hasattr(platform, "freedesktop_os_release"):
            os_release = platform.freedesktop_os_release()
            distribution = os_release.get("NAME")
            version = os_release.get("VERSION_ID")
    except OSError:
        # freedesktop_os_release may raise OSError if /etc/os-release not found
        pass

    # Fallback to platform.linux_distribution equivalent
    if not distribution:
        try:
            # Try reading /etc/os-release directly
            os_release_path = Path("/etc/os-release")
            if os_release_path.exists():
                with open(os_release_path) as f:
                    for line in f:
                        if line.startswith("NAME="):
                            distribution = line.split("=", 1)[1].strip().strip('"')
                        elif line.startswith("VERSION_ID="):
                            version = line.split("=", 1)[1].strip().strip('"')
        except Exception:
            pass

    return {
        "distribution": distribution,
        "version": version,
        "kernel": uname.release,
        "architecture": uname.machine,
    }


def get_metrics() -> dict[str, float | int | None | bool]:
    """Collect system metrics using psutil.

    Returns:
        Dictionary containing CPU, memory, disk, network, load, and uptime metrics.
        Includes reboot_required flag (US0074).
        Returns partial metrics if some collections fail.
    """
    metrics: dict[str, Any] = {}

    # Reboot required (US0074)
    metrics["reboot_required"] = Path("/var/run/reboot-required").exists()

    # CPU (blocking 1-second sample for accuracy)
    try:
        metrics["cpu_percent"] = psutil.cpu_percent(interval=1)
    except (psutil.Error, OSError) as e:
        logger.warning("Failed to collect CPU metrics: %s", e)
        metrics["cpu_percent"] = None

    # Memory
    try:
        mem = psutil.virtual_memory()
        metrics["memory_percent"] = mem.percent
        metrics["memory_total_mb"] = mem.total // (1024 * 1024)
        metrics["memory_used_mb"] = mem.used // (1024 * 1024)
    except (psutil.Error, OSError) as e:
        logger.warning("Failed to collect memory metrics: %s", e)
        metrics["memory_percent"] = None
        metrics["memory_total_mb"] = None
        metrics["memory_used_mb"] = None

    # Disk (root mount)
    try:
        disk = psutil.disk_usage("/")
        metrics["disk_percent"] = disk.percent
        metrics["disk_total_gb"] = round(disk.total / (1024**3), 2)
        metrics["disk_used_gb"] = round(disk.used / (1024**3), 2)
    except (psutil.Error, OSError) as e:
        logger.warning("Failed to collect disk metrics: %s", e)
        metrics["disk_percent"] = None
        metrics["disk_total_gb"] = None
        metrics["disk_used_gb"] = None

    # Network I/O
    try:
        net = psutil.net_io_counters()
        metrics["network_rx_bytes"] = net.bytes_recv
        metrics["network_tx_bytes"] = net.bytes_sent
    except (psutil.Error, OSError) as e:
        logger.warning("Failed to collect network metrics: %s", e)
        metrics["network_rx_bytes"] = None
        metrics["network_tx_bytes"] = None

    # Load averages
    try:
        load = psutil.getloadavg()
        metrics["load_1m"] = round(load[0], 2)
        metrics["load_5m"] = round(load[1], 2)
        metrics["load_15m"] = round(load[2], 2)
    except (psutil.Error, OSError) as e:
        logger.warning("Failed to collect load averages: %s", e)
        metrics["load_1m"] = None
        metrics["load_5m"] = None
        metrics["load_15m"] = None

    # Uptime
    try:
        boot = psutil.boot_time()
        metrics["uptime_seconds"] = int(time.time() - boot)
    except (psutil.Error, OSError) as e:
        logger.warning("Failed to collect uptime: %s", e)
        metrics["uptime_seconds"] = None

    return metrics


def get_mac_address() -> str | None:
    """Get MAC address of primary network interface.

    Returns:
        MAC address of the first non-loopback interface with an IPv4 address,
        or None if unavailable.
    """
    try:
        addrs = psutil.net_if_addrs()
        stats = psutil.net_if_stats()

        for iface, addr_list in addrs.items():
            # Skip loopback interfaces
            if iface == "lo":
                continue

            # Check if interface is up
            iface_stats = stats.get(iface)
            if iface_stats is None or not iface_stats.isup:
                continue

            # Find interface with IPv4 address
            has_ipv4 = any(a.family == socket.AF_INET for a in addr_list)
            if not has_ipv4:
                continue

            # Find MAC address (AF_LINK or AF_PACKET)
            for addr in addr_list:
                if addr.family == psutil.AF_LINK:
                    mac = addr.address
                    # Validate it looks like a MAC address
                    if mac and ":" in mac and len(mac) == 17:
                        return mac

        logger.debug("No suitable network interface found for MAC address")
        return None
    except (psutil.Error, OSError) as e:
        logger.warning("Failed to get MAC address: %s", e)
        return None


def is_running_in_container() -> bool:
    """Detect if the agent is running inside a container.

    Checks for common container indicators:
    - /.dockerenv file (Docker)
    - /run/.containerenv file (Podman)
    - 'docker' or 'lxc' in /proc/1/cgroup
    """
    # Check for Docker
    if Path("/.dockerenv").exists():
        return True

    # Check for Podman
    if Path("/run/.containerenv").exists():
        return True

    # Check cgroup for container runtime
    try:
        cgroup_path = Path("/proc/1/cgroup")
        if cgroup_path.exists():
            content = cgroup_path.read_text()
            if "docker" in content or "lxc" in content or "containerd" in content:
                return True
    except Exception:
        pass

    return False


def get_package_update_list() -> list[dict[str, Any]]:
    """Get detailed list of available package updates (Debian-based systems).

    Parses `apt list --upgradable` output to collect package details including
    name, current version, new version, repository, and security flag.

    Returns:
        List of package dictionaries, each containing:
            name: Package name (e.g., "openssl")
            current_version: Currently installed version
            new_version: Available version
            repository: Source repository (e.g., "bookworm-security")
            is_security: True if package is from a security repository

        Returns empty list on non-Debian systems or errors.
    """
    packages: list[dict[str, Any]] = []

    # Check if apt is available
    try:
        subprocess.run(
            ["which", "apt"],
            capture_output=True,
            check=True,
            timeout=5,
        )
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
        logger.debug("apt not available - skipping package list")
        return packages

    try:
        # Get list of upgradable packages
        proc = subprocess.run(
            ["apt", "list", "--upgradable"],
            capture_output=True,
            text=True,
            timeout=30,
        )

        # Parse output line by line
        # Format: package/repo version arch [upgradable from: old_version]
        # Example: openssl/bookworm-security 3.0.14-1~deb12u1 amd64 [upgradable from: 3.0.13-1~deb12u1]
        pattern = re.compile(r"^([^/]+)/(\S+)\s+(\S+)\s+\S+\s+\[upgradable from:\s+([^\]]+)\]")

        for line in proc.stdout.split("\n"):
            match = pattern.match(line)
            if match:
                name = match.group(1)
                repository = match.group(2)
                new_version = match.group(3)
                current_version = match.group(4)

                packages.append(
                    {
                        "name": name,
                        "current_version": current_version,
                        "new_version": new_version,
                        "repository": repository,
                        "is_security": "security" in repository.lower(),
                    }
                )

    except subprocess.TimeoutExpired:
        logger.warning("apt list --upgradable timed out")
    except subprocess.CalledProcessError as e:
        logger.warning("apt list failed: %s", e)
    except OSError as e:
        logger.warning("Failed to get package list: %s", e)

    return packages


def get_package_updates() -> dict[str, int | None]:
    """Get count of available package updates (Debian-based systems).

    Returns:
        Dictionary with updates_available and security_updates counts.
        Returns None values on non-Debian systems or errors.
    """
    result: dict[str, int | None] = {"updates_available": None, "security_updates": None}

    # Check if apt-get is available
    try:
        subprocess.run(
            ["which", "apt-get"],
            capture_output=True,
            check=True,
            timeout=5,
        )
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
        logger.debug("apt-get not available - skipping update count")
        return result

    try:
        # Use apt-get with simulated upgrade to count updates
        # This doesn't require sudo and doesn't modify anything
        proc = subprocess.run(
            ["apt-get", "-s", "upgrade"],
            capture_output=True,
            text=True,
            timeout=60,
        )

        output = proc.stdout

        # Count total upgrades from summary line
        # Example: "5 upgraded, 0 newly installed, 0 to remove and 0 not upgraded."
        upgrade_match = re.search(r"(\d+) upgraded", output)
        if upgrade_match:
            result["updates_available"] = int(upgrade_match.group(1))
        else:
            result["updates_available"] = 0

        # Count security updates by looking for security repository lines
        # Example: "Inst package [old] (new Debian-Security:version)"
        security_count = 0
        for line in output.split("\n"):
            if "Inst " in line and "security" in line.lower():
                security_count += 1
        result["security_updates"] = security_count

    except subprocess.TimeoutExpired:
        logger.warning("apt update check timed out")
    except OSError as e:
        logger.warning("Failed to check for updates: %s", e)

    return result


# ActiveState to status mapping
_ACTIVE_STATE_MAP: dict[str, str] = {
    "active": "running",
    "inactive": "stopped",
    "failed": "failed",
    "activating": "running",
    "deactivating": "stopped",
    "reloading": "running",
}


def get_service_status(service_name: str) -> dict[str, Any]:
    """Get status of a systemd service.

    Queries systemctl for service state and process details.

    Args:
        service_name: Name of the systemd service (e.g., 'plex', 'nginx').

    Returns:
        Dictionary with:
            name: Service name
            status: One of 'running', 'stopped', 'failed', 'unknown'
            status_reason: Explanation if status is 'unknown' (optional)
            pid: Process ID if running, None otherwise
            memory_mb: Memory usage in MB if available
            cpu_percent: CPU usage percentage if available
    """
    result: dict[str, Any] = {
        "name": service_name,
        "status": "unknown",
        "pid": None,
        "memory_mb": None,
        "cpu_percent": None,
    }

    # Check if running in container where systemd isn't available
    if is_running_in_container():
        result["status_reason"] = "systemd not available (container)"
        return result

    try:
        # Query systemctl for service properties
        proc = subprocess.run(
            [
                "systemctl",
                "show",
                service_name,
                "--property=ActiveState,MainPID,MemoryCurrent",
            ],
            capture_output=True,
            text=True,
            timeout=5,
        )

        # Parse output (format: Property=Value)
        properties: dict[str, str] = {}
        for line in proc.stdout.strip().split("\n"):
            if "=" in line:
                key, value = line.split("=", 1)
                properties[key] = value

        # Map ActiveState to status
        active_state = properties.get("ActiveState", "")
        result["status"] = _ACTIVE_STATE_MAP.get(active_state, "unknown")

        # Get PID (0 means no main process)
        pid_str = properties.get("MainPID", "0")
        pid = int(pid_str) if pid_str.isdigit() else 0
        if pid > 0:
            result["pid"] = pid

            # Get memory from systemctl (in bytes, convert to MB)
            mem_str = properties.get("MemoryCurrent", "")
            if mem_str and mem_str != "[not set]" and mem_str.isdigit():
                result["memory_mb"] = round(int(mem_str) / (1024 * 1024), 2)

            # Get CPU percentage via psutil (requires brief measurement)
            try:
                process = psutil.Process(pid)
                # First call establishes baseline, second gets actual value
                process.cpu_percent()
                # Brief sleep for measurement interval
                time.sleep(0.1)
                result["cpu_percent"] = round(process.cpu_percent(), 2)
            except (psutil.NoSuchProcess, psutil.AccessDenied) as e:
                logger.debug("Could not get CPU for PID %d: %s", pid, e)

    except subprocess.TimeoutExpired:
        logger.warning("Timeout querying service status for %s", service_name)
        result["status_reason"] = "timeout"
    except FileNotFoundError:
        logger.warning("systemctl not found - cannot query service status")
        result["status_reason"] = "systemd not available"
    except OSError as e:
        logger.warning("Failed to get status for service %s: %s", service_name, e)
        result["status_reason"] = str(e)

    return result


def get_all_services_status(services: list[str]) -> list[dict[str, Any]]:
    """Get status of multiple systemd services.

    Args:
        services: List of service names to query.

    Returns:
        List of service status dictionaries (one per service).
    """
    if not services:
        return []

    results: list[dict[str, Any]] = []
    for service_name in services:
        status = get_service_status(service_name)
        results.append(status)

    return results
