"""Tests for Command Whitelist Enforcement (US0154).

TDD tests for the command whitelist service that prevents command injection
by validating commands against approved patterns.
"""

import logging

import pytest

# Import will fail until implementation exists - this is expected in TDD
from homelab_cmd.services.command_whitelist import (
    COMMAND_WHITELIST,
    SHELL_METACHARACTERS,
    WhitelistViolationError,
    extract_params,
    is_whitelisted,
)


class TestWhitelistConfiguration:
    """Tests for AC1: Whitelist Configuration."""

    def test_valid_restart_service_passes(self):
        """TC01: Valid restart_service command passes whitelist."""
        result = is_whitelisted("systemctl restart nginx", "restart_service")
        assert result is True

    def test_unknown_action_type_rejected(self, caplog):
        """TC02: Unknown action_type rejected with warning."""
        with caplog.at_level(logging.WARNING):
            result = is_whitelisted("reboot", "reboot_server")

        assert result is False
        assert any("Unknown action type" in record.message for record in caplog.records)
        assert any("reboot_server" in record.message for record in caplog.records)

    def test_command_not_matching_pattern_rejected(self, caplog):
        """TC03: Command not matching pattern rejected."""
        with caplog.at_level(logging.WARNING):
            result = is_whitelisted("service nginx restart", "restart_service")

        assert result is False
        assert any(
            "doesn't match" in record.message.lower() or "pattern" in record.message.lower()
            for record in caplog.records
        )

    def test_valid_apply_updates_passes(self):
        """TC12: Valid apply_updates command passes (exact match, no params)."""
        result = is_whitelisted("apt-get update && apt-get upgrade -y", "apply_updates")
        assert result is True

    def test_valid_clear_logs_passes(self):
        """Valid clear_logs command passes."""
        result = is_whitelisted("journalctl --vacuum-time=7d", "clear_logs")
        assert result is True

    def test_modified_apply_updates_rejected(self):
        """Modified apply_updates command rejected (must match exactly)."""
        result = is_whitelisted("apt-get update", "apply_updates")
        assert result is False


class TestParameterValidation:
    """Tests for AC2: Parameter Validation."""

    def test_valid_service_name_passes(self):
        """TC04: Valid service name parameter passes."""
        result = is_whitelisted("systemctl restart docker", "restart_service")
        assert result is True

    def test_service_name_with_hyphen_passes(self):
        """Service name with hyphen passes validation."""
        result = is_whitelisted("systemctl restart docker-compose", "restart_service")
        assert result is True

    def test_service_name_with_underscore_passes(self):
        """Service name with underscore passes validation."""
        result = is_whitelisted("systemctl restart my_service", "restart_service")
        assert result is True

    def test_service_name_with_spaces_rejected(self, caplog):
        """TC05: Service name with spaces rejected."""
        with caplog.at_level(logging.WARNING):
            result = is_whitelisted("systemctl restart my service", "restart_service")

        assert result is False

    def test_service_name_exceeding_64_chars_rejected(self, caplog):
        """TC06: Service name exceeding 64 characters rejected."""
        long_service = "a" * 65
        with caplog.at_level(logging.WARNING):
            result = is_whitelisted(f"systemctl restart {long_service}", "restart_service")

        assert result is False

    def test_service_name_exactly_64_chars_passes(self):
        """Service name exactly 64 characters passes."""
        service_64 = "a" * 64
        result = is_whitelisted(f"systemctl restart {service_64}", "restart_service")
        assert result is True

    def test_empty_service_name_rejected(self):
        """Empty service name rejected."""
        result = is_whitelisted("systemctl restart ", "restart_service")
        assert result is False


class TestShellMetacharacterBlocking:
    """Tests for AC3: Shell Metacharacter Blocking."""

    def test_semicolon_rejected(self, caplog):
        """TC07: Semicolon in command rejected."""
        with caplog.at_level(logging.WARNING):
            result = is_whitelisted(
                "systemctl restart nginx; rm -rf /", "restart_service"
            )

        assert result is False
        assert any("metacharacter" in record.message.lower() for record in caplog.records)

    def test_pipe_rejected(self, caplog):
        """TC08: Pipe character in command rejected."""
        with caplog.at_level(logging.WARNING):
            result = is_whitelisted(
                "systemctl restart nginx|cat /etc/passwd", "restart_service"
            )

        assert result is False
        assert any("metacharacter" in record.message.lower() for record in caplog.records)

    def test_command_substitution_rejected(self, caplog):
        """TC09: Command substitution $() rejected."""
        with caplog.at_level(logging.WARNING):
            result = is_whitelisted(
                "systemctl restart $(whoami)", "restart_service"
            )

        assert result is False
        assert any("metacharacter" in record.message.lower() for record in caplog.records)

    def test_backtick_substitution_rejected(self, caplog):
        """TC10: Backtick command substitution rejected."""
        with caplog.at_level(logging.WARNING):
            result = is_whitelisted(
                "systemctl restart `whoami`", "restart_service"
            )

        assert result is False
        assert any("metacharacter" in record.message.lower() for record in caplog.records)

    def test_ampersand_rejected(self, caplog):
        """Ampersand in command rejected."""
        with caplog.at_level(logging.WARNING):
            result = is_whitelisted(
                "systemctl restart nginx & echo pwned", "restart_service"
            )

        assert result is False

    def test_redirect_output_rejected(self, caplog):
        """Output redirect > rejected."""
        with caplog.at_level(logging.WARNING):
            result = is_whitelisted(
                "systemctl restart nginx > /tmp/out", "restart_service"
            )

        assert result is False

    def test_redirect_input_rejected(self, caplog):
        """Input redirect < rejected."""
        with caplog.at_level(logging.WARNING):
            result = is_whitelisted(
                "systemctl restart nginx < /tmp/in", "restart_service"
            )

        assert result is False

    def test_metacharacter_in_parameter_rejected(self, caplog):
        """Shell metacharacter in parameter value is rejected."""
        # Semicolon in service name should be caught by metacharacter check
        with caplog.at_level(logging.WARNING):
            result = is_whitelisted("systemctl restart nginx;evil", "restart_service")

        assert result is False
        # Should mention metacharacter since it's in the parameter value
        assert any("metacharacter" in record.message.lower() for record in caplog.records)


class TestViolationLogging:
    """Tests for AC4: Violation Logging."""

    def test_violation_logs_command(self, caplog):
        """TC11: Violation logged with command details."""
        with caplog.at_level(logging.WARNING):
            is_whitelisted("systemctl restart nginx; rm -rf /", "restart_service")

        # Should log something about the violation
        assert len(caplog.records) > 0
        log_text = " ".join(record.message for record in caplog.records)
        # Should contain some reference to the command or action
        assert "restart_service" in log_text or "metacharacter" in log_text.lower()

    def test_violation_logs_action_type(self, caplog):
        """Violation log includes action_type for unknown types."""
        with caplog.at_level(logging.WARNING):
            is_whitelisted("reboot", "unknown_action")

        log_text = " ".join(record.message for record in caplog.records)
        assert "unknown_action" in log_text

    def test_valid_command_does_not_log_warning(self, caplog):
        """Valid commands should not produce warning logs."""
        with caplog.at_level(logging.WARNING):
            result = is_whitelisted("systemctl restart nginx", "restart_service")

        assert result is True
        # No warning logs for valid commands
        warning_logs = [r for r in caplog.records if r.levelno >= logging.WARNING]
        assert len(warning_logs) == 0


class TestExtractParams:
    """Tests for extract_params() function."""

    def test_extracts_single_param(self):
        """Extract single parameter from pattern."""
        params = extract_params(
            "systemctl restart nginx",
            "systemctl restart {service_name}"
        )
        assert params is not None
        assert params["service_name"] == "nginx"

    def test_extracts_multiple_params(self):
        """Extract multiple parameters from pattern."""
        params = extract_params(
            "cp /src/file.txt /dst/file.txt",
            "cp {source} {destination}"
        )
        assert params is not None
        assert params["source"] == "/src/file.txt"
        assert params["destination"] == "/dst/file.txt"

    def test_returns_none_for_no_match(self):
        """Returns None when command doesn't match pattern."""
        params = extract_params(
            "service nginx restart",
            "systemctl restart {service_name}"
        )
        assert params is None

    def test_exact_match_no_params(self):
        """Exact match pattern with no parameters."""
        params = extract_params(
            "apt-get update && apt-get upgrade -y",
            "apt-get update && apt-get upgrade -y"
        )
        assert params is not None
        assert len(params) == 0


class TestWhitelistConfigurationStructure:
    """Tests for COMMAND_WHITELIST configuration structure."""

    def test_whitelist_has_restart_service(self):
        """Whitelist includes restart_service action."""
        assert "restart_service" in COMMAND_WHITELIST

    def test_whitelist_has_apply_updates(self):
        """Whitelist includes apply_updates action."""
        assert "apply_updates" in COMMAND_WHITELIST

    def test_whitelist_has_clear_logs(self):
        """Whitelist includes clear_logs action."""
        assert "clear_logs" in COMMAND_WHITELIST

    def test_restart_service_has_pattern(self):
        """restart_service has pattern defined."""
        assert "pattern" in COMMAND_WHITELIST["restart_service"]

    def test_restart_service_has_param_validation(self):
        """restart_service has param_validation defined."""
        assert "param_validation" in COMMAND_WHITELIST["restart_service"]


class TestShellMetacharactersRegex:
    """Tests for SHELL_METACHARACTERS regex pattern."""

    @pytest.mark.parametrize("char", [";", "|", "&", "`", "$(", ">", "<"])
    def test_regex_matches_metacharacters(self, char):
        """Regex pattern matches all shell metacharacters."""
        test_string = f"command {char} injection"
        assert SHELL_METACHARACTERS.search(test_string) is not None

    def test_regex_does_not_match_safe_string(self):
        """Regex pattern does not match safe strings."""
        safe_string = "systemctl restart nginx"
        assert SHELL_METACHARACTERS.search(safe_string) is None

    def test_regex_matches_dollar_paren(self):
        """Regex matches $( for command substitution."""
        assert SHELL_METACHARACTERS.search("echo $(whoami)") is not None


class TestEdgeCases:
    """Additional edge case tests."""

    def test_empty_command_rejected(self):
        """Empty command string rejected."""
        result = is_whitelisted("", "restart_service")
        assert result is False

    def test_none_command_rejected(self):
        """None command rejected (if function handles it)."""
        # This might raise an exception or return False
        try:
            result = is_whitelisted(None, "restart_service")
            assert result is False
        except (TypeError, ValueError):
            pass  # Acceptable to raise exception for None

    def test_empty_action_type_rejected(self):
        """Empty action_type rejected."""
        result = is_whitelisted("systemctl restart nginx", "")
        assert result is False

    def test_whitespace_only_command_rejected(self):
        """Whitespace-only command rejected."""
        result = is_whitelisted("   ", "restart_service")
        assert result is False

    def test_service_name_with_special_regex_chars(self):
        """Service name with regex special characters rejected."""
        # Characters that are special in regex but not shell metacharacters
        result = is_whitelisted("systemctl restart nginx.*", "restart_service")
        assert result is False

    def test_service_name_starting_with_hyphen_passes(self):
        """Service name starting with hyphen passes (valid in systemd)."""
        result = is_whitelisted("systemctl restart -nginx", "restart_service")
        # Depends on regex - might pass or fail based on pattern
        # The regex ^[a-zA-Z0-9_-]+$ allows hyphen anywhere
        assert result is True


class TestWhitelistViolationError:
    """Tests for WhitelistViolationError exception."""

    def test_exception_has_message(self):
        """Exception can be raised with message."""
        error = WhitelistViolationError("Test violation")
        assert str(error) == "Test violation"

    def test_exception_has_command_attribute(self):
        """Exception stores command attribute."""
        error = WhitelistViolationError(
            "Violation",
            command="bad command",
            action_type="restart_service",
            reason="metacharacter"
        )
        assert error.command == "bad command"
        assert error.action_type == "restart_service"
        assert error.reason == "metacharacter"
