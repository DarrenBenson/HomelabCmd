"""Power estimation service for enhanced cost tracking.

Provides machine category inference and usage-based power calculation.
"""

import re
from dataclasses import dataclass
from enum import Enum


class MachineCategory(str, Enum):
    """Machine categories for power estimation."""

    SBC = "sbc"  # Single Board Computer (Raspberry Pi, etc.)
    MINI_PC = "mini_pc"  # Mini PC (NUC, small form factor)
    NAS = "nas"  # NAS / Home Server
    OFFICE_DESKTOP = "office_desktop"  # Office Desktop
    GAMING_DESKTOP = "gaming_desktop"  # Gaming Desktop
    WORKSTATION = "workstation"  # Workstation (high-end)
    OFFICE_LAPTOP = "office_laptop"  # Office Laptop
    GAMING_LAPTOP = "gaming_laptop"  # Gaming Laptop
    RACK_SERVER = "rack_server"  # Rack Server


@dataclass(frozen=True)
class PowerProfile:
    """Power consumption profile for a machine category."""

    label: str
    idle_watts: int
    max_watts: int


# Default power profiles for each machine category
POWER_PROFILES: dict[MachineCategory, PowerProfile] = {
    MachineCategory.SBC: PowerProfile(
        label="Single Board Computer",
        idle_watts=2,
        max_watts=6,
    ),
    MachineCategory.MINI_PC: PowerProfile(
        label="Mini PC",
        idle_watts=10,
        max_watts=25,
    ),
    MachineCategory.NAS: PowerProfile(
        label="NAS/Home Server",
        idle_watts=15,
        max_watts=35,
    ),
    MachineCategory.OFFICE_DESKTOP: PowerProfile(
        label="Office Desktop",
        idle_watts=40,
        max_watts=100,
    ),
    MachineCategory.GAMING_DESKTOP: PowerProfile(
        label="Gaming Desktop",
        idle_watts=75,
        max_watts=300,
    ),
    MachineCategory.WORKSTATION: PowerProfile(
        label="Workstation",
        idle_watts=100,
        max_watts=350,
    ),
    MachineCategory.OFFICE_LAPTOP: PowerProfile(
        label="Office Laptop",
        idle_watts=10,
        max_watts=30,
    ),
    MachineCategory.GAMING_LAPTOP: PowerProfile(
        label="Gaming Laptop",
        idle_watts=30,
        max_watts=100,
    ),
    MachineCategory.RACK_SERVER: PowerProfile(
        label="Rack Server",
        idle_watts=100,
        max_watts=300,
    ),
}


def infer_category_from_cpu(
    cpu_model: str | None, architecture: str | None
) -> MachineCategory | None:
    """Infer machine category from CPU model and architecture.

    Uses pattern matching to detect the machine type based on CPU
    characteristics. Returns None if no confident match is found.

    Args:
        cpu_model: CPU model string (e.g., "Intel Core i5-8250U")
        architecture: CPU architecture (e.g., "x86_64", "aarch64")

    Returns:
        Inferred MachineCategory or None if uncertain.
    """
    if not cpu_model:
        # Fall back to architecture-only detection
        if architecture:
            arch_lower = architecture.lower()
            if arch_lower in ("aarch64", "armv7l", "armv6l", "arm64"):
                return MachineCategory.SBC
        return None

    model_lower = cpu_model.lower()

    # Check for Apple M-series first (ARM but should be Office Laptop)
    apple_m_patterns = [
        r"\bm1\b",  # Apple M1
        r"\bm2\b",  # Apple M2
        r"\bm3\b",  # Apple M3
    ]
    for pattern in apple_m_patterns:
        if re.search(pattern, model_lower):
            return MachineCategory.OFFICE_LAPTOP

    # Check for ARM-based SBCs (Raspberry Pi, etc.)
    if architecture:
        arch_lower = architecture.lower()
        if arch_lower in ("aarch64", "armv7l", "armv6l", "arm64"):
            # ARM architecture - likely an SBC
            sbc_patterns = [
                "raspberry",
                "bcm2",  # Broadcom chips used in Raspberry Pi
                "cortex-a",
                "allwinner",
                "rockchip",
            ]
            if any(pattern in model_lower for pattern in sbc_patterns):
                return MachineCategory.SBC
            # Generic ARM without specific patterns - still likely SBC
            return MachineCategory.SBC

    # Server CPUs
    server_patterns = [
        r"\bxeon\b",
        r"\bepyc\b",
        r"\bopteron\b",
    ]
    for pattern in server_patterns:
        if re.search(pattern, model_lower):
            return MachineCategory.RACK_SERVER

    # Threadripper - Workstation
    if "threadripper" in model_lower:
        return MachineCategory.WORKSTATION

    # Mobile/Laptop CPUs (Intel U/P/G series, AMD Mobile/U)
    # Note: U/P suffix comes after model number like "8250U" or "1235P"
    mobile_patterns = [
        r"i[3579]-\d{4,5}u\b",  # e.g., i5-8250U, i7-10510U
        r"i[3579]-\d{4,5}p\b",  # e.g., i5-1235P
        r"i[3579]-\d{4,5}g\d\b",  # e.g., i5-1035G1
        r"ryzen.*mobile",
        r"ryzen.*\d{4}u\b",  # e.g., Ryzen 5 5500U
        r"ryzen.*pro.*\d{4}u\b",
    ]
    for pattern in mobile_patterns:
        if re.search(pattern, model_lower):
            return MachineCategory.OFFICE_LAPTOP

    # Low-power desktop/mini PC CPUs
    mini_pc_patterns = [
        r"\batom\b",
        r"\bceleron\b",
        r"\bpentium\b",
        r"\bn\d{2,4}\b",  # e.g., N100, N5095
        r"\bj\d{4}\b",  # e.g., J4125
    ]
    for pattern in mini_pc_patterns:
        if re.search(pattern, model_lower):
            return MachineCategory.MINI_PC

    # Workstation-class desktop CPUs (i7/i9, Ryzen 7/9)
    workstation_patterns = [
        r"core.*i[79]-",  # Intel Core i7/i9
        r"ryzen [79]\b",  # AMD Ryzen 7/9
        r"ryzen\s*[79]\s*\d",  # AMD Ryzen 7/9 with model number
    ]
    for pattern in workstation_patterns:
        if re.search(pattern, model_lower):
            return MachineCategory.WORKSTATION

    # Office desktop CPUs (i3/i5, Ryzen 3/5)
    office_patterns = [
        r"core.*i[35]-",  # Intel Core i3/i5
        r"ryzen [35]\b",  # AMD Ryzen 3/5
        r"ryzen\s*[35]\s*\d",  # AMD Ryzen 3/5 with model number
    ]
    for pattern in office_patterns:
        if re.search(pattern, model_lower):
            return MachineCategory.OFFICE_DESKTOP

    # If we have a Core or Ryzen but couldn't determine which tier
    if "core" in model_lower or "ryzen" in model_lower:
        return MachineCategory.OFFICE_DESKTOP

    return None


@dataclass
class PowerConfig:
    """Resolved power configuration for a server."""

    category: MachineCategory | None
    category_source: str | None  # "auto", "user", or None
    idle_watts: int
    max_watts: int


def get_power_config(
    machine_category: str | None,
    machine_category_source: str | None,
    idle_watts_override: int | None,
    tdp_watts_override: int | None,
) -> PowerConfig | None:
    """Resolve power configuration with user overrides.

    Priority:
    1. User-provided wattage overrides (idle_watts, tdp_watts)
    2. Machine category defaults (from POWER_PROFILES)
    3. None if no configuration available

    Args:
        machine_category: Machine category value
        machine_category_source: "auto" or "user"
        idle_watts_override: User-specified idle power (optional)
        tdp_watts_override: User-specified max/TDP power (optional)

    Returns:
        PowerConfig with resolved values, or None if unconfigured.
    """
    # Try to get category profile
    category: MachineCategory | None = None
    profile: PowerProfile | None = None

    if machine_category:
        try:
            category = MachineCategory(machine_category)
            profile = POWER_PROFILES.get(category)
        except ValueError:
            pass

    # If we have no category and no overrides, return None
    if not profile and idle_watts_override is None and tdp_watts_override is None:
        return None

    # Resolve values with overrides taking precedence
    idle = idle_watts_override
    max_power = tdp_watts_override

    if profile:
        if idle is None:
            idle = profile.idle_watts
        if max_power is None:
            max_power = profile.max_watts

    # If still missing values, we can't calculate
    if idle is None or max_power is None:
        return None

    return PowerConfig(
        category=category,
        category_source=machine_category_source,
        idle_watts=idle,
        max_watts=max_power,
    )


def calculate_power_watts(idle_watts: int, max_watts: int, cpu_percent: float) -> float:
    """Calculate estimated power consumption based on CPU usage.

    Uses linear interpolation between idle and max power:
    Power = idle + (max - idle) * (cpu_percent / 100)

    Args:
        idle_watts: Power consumption at idle
        max_watts: Power consumption at full load
        cpu_percent: CPU usage percentage (0-100)

    Returns:
        Estimated power in watts.
    """
    # Clamp CPU percentage to valid range
    cpu_pct = max(0.0, min(100.0, cpu_percent))

    power = idle_watts + (max_watts - idle_watts) * (cpu_pct / 100.0)
    return round(power, 1)


def calculate_daily_kwh(power_watts: float) -> float:
    """Calculate daily energy consumption in kWh.

    Args:
        power_watts: Average power consumption in watts

    Returns:
        Daily energy consumption in kWh.
    """
    return round((power_watts * 24) / 1000, 3)


def calculate_daily_cost(power_watts: float, rate_per_kwh: float) -> float:
    """Calculate daily electricity cost.

    Args:
        power_watts: Average power consumption in watts
        rate_per_kwh: Electricity rate per kWh

    Returns:
        Daily cost rounded to 2 decimal places.
    """
    kwh_per_day = (power_watts * 24) / 1000
    return round(kwh_per_day * rate_per_kwh, 2)


def calculate_workstation_cost(
    tdp_watts: int,
    hours_used: float,
    rate_per_kwh: float,
) -> float:
    """Calculate workstation cost based on actual usage.

    US0092: Workstation Cost Tracking (AC2)

    Unlike servers which run 24/7, workstations are billed based on
    actual uptime hours.

    Formula: cost = (TDP_watts × actual_hours × rate) / 1000

    Args:
        tdp_watts: Power consumption in watts (TDP)
        hours_used: Actual hours of operation
        rate_per_kwh: Electricity rate per kWh

    Returns:
        Cost rounded to 2 decimal places.
    """
    kwh = (tdp_watts * hours_used) / 1000
    return round(kwh * rate_per_kwh, 2)
