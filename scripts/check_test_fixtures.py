#!/usr/bin/env python
"""Enforce fixture usage in tests.

This script checks that tests use shared fixtures instead of
duplicating common patterns like server creation and heartbeat sending.

Usage:
    python scripts/check_test_fixtures.py
    python scripts/check_test_fixtures.py --fix  # Future: auto-fix mode

Exit codes:
    0: All checks passed
    1: Violations found
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# Patterns that indicate fixture should be used
FORBIDDEN_PATTERNS: list[tuple[str, str, str]] = [
    # (pattern, violation_type, suggestion)
    (
        r'client\.post\("/api/v1/servers"\s*,\s*json\s*=',
        "Direct server creation",
        "Use `create_server` fixture instead",
    ),
    (
        r'client\.post\("/api/v1/agents/heartbeat"\s*,\s*json\s*=',
        "Direct heartbeat sending",
        "Use `send_heartbeat` fixture instead",
    ),
]

# Files to exclude from checks (e.g., conftest.py where fixtures are defined)
EXCLUDE_FILES = {"conftest.py"}


def check_file(path: Path) -> list[dict]:
    """Check a single file for violations.

    Args:
        path: Path to the test file

    Returns:
        List of violation dictionaries
    """
    violations = []
    content = path.read_text()
    lines = content.splitlines()

    for line_num, line in enumerate(lines, start=1):
        for pattern, violation_type, suggestion in FORBIDDEN_PATTERNS:
            if re.search(pattern, line):
                violations.append(
                    {
                        "file": str(path),
                        "line": line_num,
                        "type": violation_type,
                        "suggestion": suggestion,
                        "content": line.strip(),
                    }
                )

    return violations


def check_tests(tests_dir: Path) -> list[dict]:
    """Check all test files for violations.

    Args:
        tests_dir: Path to tests directory

    Returns:
        List of all violations found
    """
    all_violations = []

    for test_file in tests_dir.glob("test_*.py"):
        if test_file.name in EXCLUDE_FILES:
            continue
        violations = check_file(test_file)
        all_violations.extend(violations)

    return all_violations


def main() -> int:
    """Main entry point.

    Returns:
        Exit code (0 for success, 1 for violations found)
    """
    parser = argparse.ArgumentParser(
        description="Check that tests use shared fixtures instead of duplicating patterns"
    )
    parser.add_argument(
        "--fix",
        action="store_true",
        help="Auto-fix violations (not yet implemented)",
    )
    parser.add_argument(
        "--tests-dir",
        type=Path,
        default=Path("tests"),
        help="Path to tests directory",
    )
    args = parser.parse_args()

    if args.fix:
        print("Auto-fix mode is not yet implemented.")
        return 1

    if not args.tests_dir.exists():
        print(f"Tests directory not found: {args.tests_dir}")
        return 1

    violations = check_tests(args.tests_dir)

    if violations:
        print(f"Found {len(violations)} fixture usage violation(s):\n")
        for v in violations:
            print(f"{v['file']}:{v['line']}: {v['type']}")
            print(f"  {v['content']}")
            print(f"  -> {v['suggestion']}")
            print()
        return 1

    print("All fixture usage checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
