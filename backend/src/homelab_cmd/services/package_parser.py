"""Package status parser for apt output.

Part of US0198: Package Held Back Status Indicator.

Parses apt output to distinguish between:
- Upgradable packages (will install when update applied)
- Held-back packages (will NOT install), with reasons:
  - phased: Ubuntu/Debian phased rollout
  - dependency: Upgrade would cause dependency conflict
  - manual: User held via apt-mark hold
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Literal

logger = logging.getLogger(__name__)


@dataclass
class PackageInfo:
    """Information about a single package.

    Attributes:
        name: Package name.
        current_version: Currently installed version.
        candidate_version: Available upgrade version.
        status: Whether package is upgradable or held_back.
        hold_reason: Reason for being held back (if applicable).
        phased_percentage: Rollout percentage (0-100) for phased updates.
        repository: Source repository name.
        is_security: Whether from a security repository.
    """

    name: str
    current_version: str
    candidate_version: str
    status: Literal["upgradable", "held_back"]
    hold_reason: Literal["phased", "dependency", "manual"] | None = None
    phased_percentage: int | None = None
    repository: str = ""
    is_security: bool = False


@dataclass
class PackageStatus:
    """Package status summary for a server.

    Attributes:
        upgradable_count: Number of packages that will install.
        held_back_count: Number of packages that will NOT install.
        security_count: Number of security updates.
        packages: List of all packages with their status.
    """

    upgradable_count: int
    held_back_count: int
    security_count: int
    packages: list[PackageInfo]


def parse_apt_list_upgradable(output: str) -> list[PackageInfo]:
    """Parse `apt list --upgradable` output.

    Example output:
        Listing... Done
        firefox/jammy-updates 121.0+build1-0ubuntu0.22.04.1 amd64 [upgradable from: 120.0+build1-0ubuntu0.22.04.1]
        nginx/jammy-security 1.24.0-1ubuntu1.1 amd64 [upgradable from: 1.24.0-1ubuntu1]

    Args:
        output: Raw output from apt list --upgradable command.

    Returns:
        List of PackageInfo objects for all upgradable packages.
    """
    packages = []

    # Pattern: package_name/repo version arch [upgradable from: current_version]
    # Some packages may have : in name (e.g., libfoo:amd64)
    pattern = re.compile(
        r"^([^\s/]+)/([^\s]+)\s+([^\s]+)\s+[^\s]+\s+\[upgradable from:\s+([^\]]+)\]",
        re.MULTILINE,
    )

    for match in pattern.finditer(output):
        name = match.group(1)
        repository = match.group(2)
        candidate_version = match.group(3)
        current_version = match.group(4)

        # Check if security update (common patterns)
        is_security = any(
            sec_repo in repository.lower()
            for sec_repo in ["security", "-security"]
        )

        packages.append(
            PackageInfo(
                name=name,
                current_version=current_version,
                candidate_version=candidate_version,
                status="upgradable",
                hold_reason=None,
                phased_percentage=None,
                repository=repository,
                is_security=is_security,
            )
        )

    return packages


def parse_apt_mark_showhold(output: str) -> set[str]:
    """Parse `apt-mark showhold` output.

    Example output:
        linux-image-generic
        linux-headers-generic

    Args:
        output: Raw output from apt-mark showhold command.

    Returns:
        Set of package names that are manually held.
    """
    held = set()
    for line in output.strip().split("\n"):
        line = line.strip()
        if line:
            held.add(line)
    return held


def parse_apt_simulate_kept_back(output: str) -> set[str]:
    """Parse `apt-get dist-upgrade --simulate` to find kept-back packages.

    Example output:
        Reading package lists... Done
        Building dependency tree... Done
        Calculating upgrade... Done
        The following packages have been kept back:
          firefox linux-image-generic
        0 upgraded, 0 newly installed, 0 to remove and 2 not upgraded.

    Args:
        output: Raw output from apt-get dist-upgrade --simulate command.

    Returns:
        Set of package names that were kept back.
    """
    kept_back = set()

    # Find "kept back" section
    kept_back_match = re.search(
        r"The following packages have been kept back:\s*\n((?:\s+[^\n]+\n?)+)",
        output,
        re.IGNORECASE,
    )

    if kept_back_match:
        packages_line = kept_back_match.group(1)
        # Split on whitespace and filter empty strings
        for pkg in packages_line.split():
            pkg = pkg.strip()
            if pkg:
                kept_back.add(pkg)

    return kept_back


def parse_apt_policy_phased(output: str, package_name: str) -> int | None:
    """Parse `apt policy <package>` to detect phased rollout percentage.

    Example output:
        firefox:
          Installed: 120.0+build1-0ubuntu0.22.04.1
          Candidate: 121.0+build1-0ubuntu0.22.04.1
          Version table:
             121.0+build1-0ubuntu0.22.04.1 500 (phased 45%)
                500 http://archive.ubuntu.com/ubuntu jammy-updates/main amd64 Packages
        nginx:
          Installed: 1.24.0-1
          ...

    Args:
        output: Raw output from apt policy command (may contain multiple packages).
        package_name: Package name to look for.

    Returns:
        Phased percentage (0-100) if package is in phased rollout, None otherwise.
    """
    # Find the section for this specific package
    # apt policy output starts each package with "package_name:\n"
    # We need to find the section for our package and search within it
    package_header = f"{package_name}:"
    start_idx = output.find(package_header)
    if start_idx == -1:
        return None

    # Find the end of this package's section (next package header or end of output)
    # Package headers are at the start of a line followed by ":"
    end_idx = len(output)
    # Look for next package header after our package's section
    remaining = output[start_idx + len(package_header):]
    next_pkg_match = re.search(r"\n\S+:", remaining)
    if next_pkg_match:
        end_idx = start_idx + len(package_header) + next_pkg_match.start()

    # Extract just this package's section
    package_section = output[start_idx:end_idx]

    # Pattern: version priority (phased XX%)
    pattern = re.compile(r"\(phased\s+(\d+)%\)", re.IGNORECASE)

    match = pattern.search(package_section)
    if match:
        return int(match.group(1))

    return None


def categorise_packages(
    upgradable: list[PackageInfo],
    manually_held: set[str],
    kept_back: set[str],
    phased_info: dict[str, int],
) -> PackageStatus:
    """Categorise packages into upgradable and held-back.

    Args:
        upgradable: List of packages from apt list --upgradable.
        manually_held: Set of manually held package names.
        kept_back: Set of packages kept back by apt-get dist-upgrade.
        phased_info: Dict mapping package name to phased percentage.

    Returns:
        PackageStatus with categorised packages.
    """
    packages = []
    upgradable_count = 0
    held_back_count = 0
    security_count = 0

    for pkg in upgradable:
        # Determine if this package is held back
        is_held = False
        hold_reason = None
        phased_pct = None

        # Check manual hold first (explicit user action)
        if pkg.name in manually_held:
            is_held = True
            hold_reason = "manual"
        # Check if kept back (could be phased or dependency)
        elif pkg.name in kept_back:
            is_held = True
            # Check if it's a phased update
            if pkg.name in phased_info:
                hold_reason = "phased"
                phased_pct = phased_info[pkg.name]
            else:
                # Assume dependency conflict if kept back but not phased
                hold_reason = "dependency"

        # Create categorised package info
        categorised = PackageInfo(
            name=pkg.name,
            current_version=pkg.current_version,
            candidate_version=pkg.candidate_version,
            status="held_back" if is_held else "upgradable",
            hold_reason=hold_reason,
            phased_percentage=phased_pct,
            repository=pkg.repository,
            is_security=pkg.is_security,
        )
        packages.append(categorised)

        # Update counts
        if is_held:
            held_back_count += 1
        else:
            upgradable_count += 1

        if pkg.is_security:
            security_count += 1

    return PackageStatus(
        upgradable_count=upgradable_count,
        held_back_count=held_back_count,
        security_count=security_count,
        packages=packages,
    )


async def get_package_status_from_commands(
    apt_list_output: str,
    apt_mark_output: str,
    apt_simulate_output: str,
    apt_policy_outputs: dict[str, str] | None = None,
) -> PackageStatus:
    """Build package status from pre-collected apt command outputs.

    This function is useful when you've already run the apt commands
    and have their outputs available.

    Args:
        apt_list_output: Output from `apt list --upgradable`.
        apt_mark_output: Output from `apt-mark showhold`.
        apt_simulate_output: Output from `apt-get dist-upgrade --simulate`.
        apt_policy_outputs: Optional dict mapping package name to apt policy output.

    Returns:
        PackageStatus with categorised packages.
    """
    # Parse all outputs
    upgradable = parse_apt_list_upgradable(apt_list_output)
    manually_held = parse_apt_mark_showhold(apt_mark_output)
    kept_back = parse_apt_simulate_kept_back(apt_simulate_output)

    # Parse phased info from policy outputs
    phased_info: dict[str, int] = {}
    if apt_policy_outputs:
        for pkg_name, policy_output in apt_policy_outputs.items():
            pct = parse_apt_policy_phased(policy_output, pkg_name)
            if pct is not None:
                phased_info[pkg_name] = pct

    return categorise_packages(upgradable, manually_held, kept_back, phased_info)
