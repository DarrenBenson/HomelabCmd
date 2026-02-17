"""Progress parsing for command output streaming.

Part of US0156: Real-Time Command Output Streaming.

Parses apt/yum progress patterns to extract percentage and stage information
for displaying progress indicators in the UI.
"""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class ProgressInfo:
    """Progress information extracted from command output.

    Attributes:
        percent: Progress percentage (0-100).
        stage: Current stage description.
    """

    percent: int
    stage: str


# APT progress patterns
APT_PROGRESS_PATTERN = re.compile(r"Progress:\s*\[\s*(\d+)%\]")
APT_FETCHED_PATTERN = re.compile(r"Fetched\s+([\d.]+\s*[kMG]?B)\s+in\s+(\d+)s")
APT_READING_PATTERN = re.compile(r"Reading\s+(package|state|database)\s+(lists|information)", re.I)
APT_BUILDING_PATTERN = re.compile(r"Building\s+dependency\s+tree", re.I)
APT_CALCULATING_PATTERN = re.compile(r"Calculating\s+upgrade", re.I)
APT_UNPACKING_PATTERN = re.compile(r"Unpacking\s+(\S+)", re.I)
APT_SETTING_UP_PATTERN = re.compile(r"Setting\s+up\s+(\S+)", re.I)
APT_PROCESSING_PATTERN = re.compile(r"Processing\s+triggers", re.I)

# dpkg progress line: "Progress: [  5%]" or similar
DPKG_PROGRESS_PATTERN = re.compile(r"^\s*(\d+)%")


def parse_apt_progress(line: str) -> ProgressInfo | None:
    """Parse apt/dpkg progress patterns from output line.

    Detects various apt progress indicators:
    - 'Progress: [ 45%]' - explicit percentage
    - 'Reading package lists...' - early stage (10%)
    - 'Building dependency tree...' - early stage (15%)
    - 'Fetched 12.3 MB in 5s' - download complete (50%)
    - 'Unpacking package...' - install stage (60-80%)
    - 'Setting up package...' - configuration stage (80-95%)
    - 'Processing triggers...' - final stage (95%)

    Args:
        line: Single line of command output to parse.

    Returns:
        ProgressInfo if progress pattern matched, None otherwise.
    """
    line = line.strip()
    if not line:
        return None

    # Explicit percentage pattern (highest priority)
    match = APT_PROGRESS_PATTERN.search(line)
    if match:
        return ProgressInfo(percent=int(match.group(1)), stage="Installing packages")

    # dpkg percentage at start of line
    match = DPKG_PROGRESS_PATTERN.match(line)
    if match:
        return ProgressInfo(percent=int(match.group(1)), stage="Processing packages")

    # Stage-based progress detection
    if APT_READING_PATTERN.search(line):
        if "package lists" in line.lower():
            return ProgressInfo(percent=10, stage="Reading package lists")
        if "state" in line.lower():
            return ProgressInfo(percent=12, stage="Reading state information")
        return ProgressInfo(percent=10, stage="Reading database")

    if APT_BUILDING_PATTERN.search(line):
        return ProgressInfo(percent=15, stage="Building dependency tree")

    if APT_CALCULATING_PATTERN.search(line):
        return ProgressInfo(percent=20, stage="Calculating upgrade")

    if APT_FETCHED_PATTERN.search(line):
        return ProgressInfo(percent=50, stage="Download complete")

    match = APT_UNPACKING_PATTERN.search(line)
    if match:
        pkg = match.group(1)
        return ProgressInfo(percent=70, stage=f"Unpacking {pkg}")

    match = APT_SETTING_UP_PATTERN.search(line)
    if match:
        pkg = match.group(1)
        return ProgressInfo(percent=85, stage=f"Setting up {pkg}")

    if APT_PROCESSING_PATTERN.search(line):
        return ProgressInfo(percent=95, stage="Processing triggers")

    # Check for "Done" at end of stage
    if line.endswith("Done") or line.endswith("..."):
        return None  # Don't duplicate stage info

    return None


def is_progress_relevant(action_type: str) -> bool:
    """Check if progress parsing should be applied for this action type.

    Args:
        action_type: The type of action being executed.

    Returns:
        True if progress parsing makes sense for this action type.
    """
    return action_type in {
        "apt_update",
        "apt_upgrade_all",
        "apt_upgrade_security",
        "apply_updates",
    }
