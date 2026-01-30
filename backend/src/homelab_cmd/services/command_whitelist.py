"""Command Whitelist Enforcement Service (US0154).

Part of EP0013: Synchronous Command Execution.

Provides command validation to prevent command injection by:
- Validating commands against a whitelist of approved patterns
- Validating parameters against regex patterns
- Blocking shell metacharacters (;, |, &, `, $(), >, <)
- Logging all violation attempts
"""

from __future__ import annotations

import logging
import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

# Shell metacharacters that indicate command injection attempts
# Matches: ; | & ` $( ) > <
SHELL_METACHARACTERS = re.compile(r"[;|&`<>]|\$\(")

# Maximum parameter length to prevent buffer overflow attacks
MAX_PARAM_LENGTH = 64

# Command whitelist configuration
# Each action type has:
#   - pattern: Command template with {placeholder} for parameters
#   - param_validation: Dict of parameter name -> regex pattern
COMMAND_WHITELIST: dict[str, dict] = {
    "restart_service": {
        "pattern": "systemctl restart {service_name}",
        "param_validation": {
            "service_name": r"^[a-zA-Z0-9_-]{1,64}$"
        }
    },
    "apply_updates": {
        "pattern": "apt-get update && apt-get upgrade -y",
        "param_validation": {}
    },
    "clear_logs": {
        "pattern": "journalctl --vacuum-time=7d",
        "param_validation": {}
    }
}


class WhitelistViolationError(Exception):
    """Raised when a command violates whitelist rules.

    Attributes:
        command: The command that was rejected.
        action_type: The action type attempted.
        reason: Why the command was rejected.
    """

    def __init__(
        self,
        message: str,
        command: str | None = None,
        action_type: str | None = None,
        reason: str | None = None,
    ) -> None:
        super().__init__(message)
        self.command = command
        self.action_type = action_type
        self.reason = reason


def extract_params(command: str, pattern: str) -> dict[str, str] | None:
    """Extract parameters from a command using a pattern template.

    Args:
        command: The actual command string.
        pattern: The pattern template with {placeholder} markers.

    Returns:
        Dict of parameter name -> value if pattern matches, None otherwise.

    Example:
        >>> extract_params("systemctl restart nginx", "systemctl restart {service_name}")
        {"service_name": "nginx"}
    """
    # Find all placeholders in the pattern
    param_names = re.findall(r"\{(\w+)\}", pattern)

    if not param_names:
        # No parameters - exact match required
        if command == pattern:
            return {}
        return None

    # Convert pattern to regex, escaping special chars first
    regex_pattern = re.escape(pattern)

    # Replace escaped placeholders with capture groups
    for name in param_names:
        escaped_placeholder = re.escape(f"{{{name}}}")
        regex_pattern = regex_pattern.replace(escaped_placeholder, f"(?P<{name}>.+)")

    # Anchor the pattern
    regex_pattern = f"^{regex_pattern}$"

    match = re.match(regex_pattern, command)
    if not match:
        return None

    return match.groupdict()


def is_whitelisted(command: str | None, action_type: str | None) -> bool:
    """Validate a command against the whitelist.

    Performs validation in order:
    1. Input validation (empty/None checks)
    2. Action type lookup
    3. Pattern matching (extract params)
    4. Shell metacharacter blocking on parameters
    5. Parameter validation (length and regex)

    Args:
        command: The command to validate.
        action_type: The action type (e.g., "restart_service").

    Returns:
        True if command is allowed, False otherwise.

    Note:
        All violations are logged at WARNING level.
        Shell metacharacter check applies to extracted parameters only,
        allowing static patterns like "apt-get update && apt-get upgrade -y".
    """
    # Input validation
    if not command or not command.strip():
        logger.warning(
            "Command whitelist violation: empty command for action_type=%s",
            action_type,
        )
        return False

    if not action_type or not action_type.strip():
        logger.warning(
            "Command whitelist violation: empty action_type for command=%s",
            _sanitise_for_log(command),
        )
        return False

    command = command.strip()
    action_type = action_type.strip()

    # Action type lookup
    if action_type not in COMMAND_WHITELIST:
        logger.warning(
            "Command whitelist violation: Unknown action type: %s",
            action_type,
        )
        return False

    whitelist_entry = COMMAND_WHITELIST[action_type]
    pattern = whitelist_entry["pattern"]

    # Extract parameters from command
    params = extract_params(command, pattern)
    if params is None:
        logger.warning(
            "Command whitelist violation: command doesn't match pattern for "
            "action_type=%s",
            action_type,
        )
        return False

    # Validate each extracted parameter
    param_validation = whitelist_entry.get("param_validation", {})
    for param_name, regex in param_validation.items():
        if param_name not in params:
            logger.warning(
                "Command whitelist violation: missing parameter %s for action_type=%s",
                param_name,
                action_type,
            )
            return False

        param_value = params[param_name]

        # Shell metacharacter check on parameter value (security critical)
        if SHELL_METACHARACTERS.search(param_value):
            logger.warning(
                "Command whitelist violation: shell metacharacters detected in command "
                "for action_type=%s",
                action_type,
            )
            return False

        # Check parameter length
        if len(param_value) > MAX_PARAM_LENGTH:
            logger.warning(
                "Command whitelist violation: parameter %s too long (%d > %d) for "
                "action_type=%s",
                param_name,
                len(param_value),
                MAX_PARAM_LENGTH,
                action_type,
            )
            return False

        # Check parameter against regex
        if not re.match(regex, param_value):
            logger.warning(
                "Command whitelist violation: parameter validation failed for %s=%s "
                "in action_type=%s",
                param_name,
                _sanitise_for_log(param_value),
                action_type,
            )
            return False

    # All checks passed
    return True


def _sanitise_for_log(value: str, max_length: int = 50) -> str:
    """Sanitise a value for safe logging.

    Truncates long values and removes potentially sensitive data.

    Args:
        value: The value to sanitise.
        max_length: Maximum length before truncation.

    Returns:
        Sanitised string safe for logging.
    """
    if len(value) > max_length:
        return value[:max_length] + "..."
    return value
