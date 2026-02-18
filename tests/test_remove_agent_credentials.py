"""TS0020: Remove Agent SSH Credentials Tests.

Tests verify that agent removal correctly handles SSH credentials:
- Password authentication for uninstall
- Fallback from password to key-based authentication
- Post-removal verification warnings
- Credential transience (not persisted)
- Response sanitisation (passwords omitted)

Spec Reference: TS0020 - Remove Agent SSH Credentials
"""

from unittest.mock import AsyncMock, MagicMock

import pytest

from homelab_cmd.services.agent_deploy import AgentDeploymentService, DeploymentResult


# =============================================================================
# Helper: Create a server in the test database
# =============================================================================


async def _create_server(db_session, server_id: str, hostname: str, ip_address: str = "192.168.1.100"):
    """Create a server record for testing.

    Args:
        db_session: Async database session.
        server_id: Unique server identifier.
        hostname: Server hostname.
        ip_address: Server IP address.

    Returns:
        The created Server model instance.
    """
    from homelab_cmd.db.models.server import Server

    server = Server(
        id=server_id,
        hostname=hostname,
        ip_address=ip_address,
    )
    db_session.add(server)
    await db_session.commit()
    return server


# =============================================================================
# TC2001: Remove agent with password authentication succeeds
# =============================================================================


class TestTC2001PasswordAuthSucceeds:
    """TC2001: Remove agent with password authentication succeeds.

    When ssh_username and ssh_password are provided to remove_agent,
    the SSH command should be executed using password authentication.
    """

    @pytest.mark.asyncio
    async def test_remove_agent_password_auth_calls_ssh_with_credentials(
        self, db_session
    ) -> None:
        """Password auth credentials are passed through to SSH execute_command."""
        await _create_server(db_session, "tc2001-server", "tc2001.local")

        service = AgentDeploymentService(db_session)

        captured_calls: list[dict] = []

        async def mock_execute(
            hostname,
            command,
            command_timeout,
            username=None,
            password=None,
            key_usernames=None,
        ):
            captured_calls.append(
                {
                    "hostname": hostname,
                    "username": username,
                    "password": password,
                    "key_usernames": key_usernames,
                }
            )
            result = MagicMock()
            result.success = True
            result.stdout = ""
            result.stderr = ""
            result.error = None
            return result

        with pytest.MonkeyPatch.context() as m:
            m.setattr(service.ssh, "execute_command", mock_execute)
            deploy_result = await service.remove_agent(
                "tc2001-server",
                delete_completely=False,
                ssh_username="deploy-user",
                ssh_password="deploy-pass",
            )

        assert deploy_result.success is True
        # First call should use password authentication
        assert captured_calls[0]["username"] == "deploy-user"
        assert captured_calls[0]["password"] == "deploy-pass"

    @pytest.mark.asyncio
    async def test_remove_agent_password_auth_marks_server_inactive(
        self, db_session
    ) -> None:
        """Server is correctly marked inactive after password-authenticated removal."""
        from homelab_cmd.db.models.server import Server

        server = await _create_server(db_session, "tc2001-inactive", "tc2001-inactive.local")
        service = AgentDeploymentService(db_session)

        mock_result = MagicMock()
        mock_result.success = True
        mock_result.stdout = ""
        mock_result.stderr = ""
        mock_result.error = None

        with pytest.MonkeyPatch.context() as m:
            m.setattr(service.ssh, "execute_command", AsyncMock(return_value=mock_result))
            deploy_result = await service.remove_agent(
                "tc2001-inactive",
                delete_completely=False,
                ssh_username="admin",
                ssh_password="secret123",
            )

        assert deploy_result.success is True

        await db_session.refresh(server)
        assert server.is_inactive is True


# =============================================================================
# TC2002: Remove agent falls back to key-based auth when password missing
# =============================================================================


class TestTC2002FallbackToKeyAuth:
    """TC2002: Remove agent falls back to key-based auth when password missing.

    When ssh_username and ssh_password are not provided, the service should
    use key-based authentication with default username and key_usernames.
    """

    @pytest.mark.asyncio
    async def test_remove_agent_no_password_uses_key_auth(self, db_session) -> None:
        """Without credentials, SSH uses key-based auth with default username."""
        await _create_server(db_session, "tc2002-server", "tc2002.local")

        service = AgentDeploymentService(db_session)

        captured_calls: list[dict] = []

        async def mock_execute(
            hostname,
            command,
            command_timeout,
            username=None,
            password=None,
            key_usernames=None,
        ):
            captured_calls.append(
                {
                    "hostname": hostname,
                    "username": username,
                    "password": password,
                    "key_usernames": key_usernames,
                }
            )
            result = MagicMock()
            result.success = True
            result.stdout = ""
            result.stderr = ""
            result.error = None
            return result

        with pytest.MonkeyPatch.context() as m:
            m.setattr(service.ssh, "execute_command", mock_execute)
            deploy_result = await service.remove_agent(
                "tc2002-server",
                delete_completely=False,
            )

        assert deploy_result.success is True
        # Only one call should be made (key auth), not two (password then key)
        # First call should NOT have password set
        assert captured_calls[0]["password"] is None

    @pytest.mark.asyncio
    async def test_remove_agent_password_without_username_warns_and_uses_keys(
        self, db_session
    ) -> None:
        """Password without username triggers warning and falls back to keys."""
        await _create_server(db_session, "tc2002-no-user", "tc2002-no-user.local")

        service = AgentDeploymentService(db_session)

        mock_result = MagicMock()
        mock_result.success = True
        mock_result.stdout = ""
        mock_result.stderr = ""
        mock_result.error = None

        with pytest.MonkeyPatch.context() as m:
            m.setattr(service.ssh, "execute_command", AsyncMock(return_value=mock_result))
            deploy_result = await service.remove_agent(
                "tc2002-no-user",
                delete_completely=False,
                ssh_username=None,
                ssh_password="orphan-password",
            )

        assert deploy_result.success is True
        assert "ssh_password provided without ssh_username" in deploy_result.message


# =============================================================================
# TC2003: Password auth fails, falls back to key auth with warning
# =============================================================================


class TestTC2003PasswordFailsFallbackToKeys:
    """TC2003: Password auth fails, falls back to key auth with warning.

    When password authentication fails for the uninstall, the service should
    retry with key-based authentication and include a warning in the response.
    """

    @pytest.mark.asyncio
    async def test_password_auth_fails_retries_with_keys(self, db_session) -> None:
        """Failed password auth retries with key-based auth."""
        await _create_server(db_session, "tc2003-server", "tc2003.local")

        service = AgentDeploymentService(db_session)

        call_count = [0]

        async def mock_execute(
            hostname,
            command,
            command_timeout,
            username=None,
            password=None,
            key_usernames=None,
        ):
            call_count[0] += 1
            result = MagicMock()
            result.stdout = ""
            result.stderr = ""
            # First call (password auth) fails, subsequent calls succeed
            if call_count[0] == 1:
                result.success = False
                result.error = "Authentication failed"
            else:
                result.success = True
                result.error = None
            return result

        with pytest.MonkeyPatch.context() as m:
            m.setattr(service.ssh, "execute_command", mock_execute)
            deploy_result = await service.remove_agent(
                "tc2003-server",
                delete_completely=False,
                ssh_username="baduser",
                ssh_password="badpass",
            )

        assert deploy_result.success is True
        # At least 2 SSH calls: failed password auth, then key auth
        assert call_count[0] >= 2

    @pytest.mark.asyncio
    async def test_password_auth_failure_includes_warning(self, db_session) -> None:
        """Warning message mentions password authentication failure and fallback."""
        await _create_server(db_session, "tc2003-warn", "tc2003-warn.local")

        service = AgentDeploymentService(db_session)

        call_count = [0]

        async def mock_execute(
            hostname,
            command,
            command_timeout,
            username=None,
            password=None,
            key_usernames=None,
        ):
            call_count[0] += 1
            result = MagicMock()
            result.stdout = ""
            result.stderr = ""
            if call_count[0] == 1:
                result.success = False
                result.error = "Authentication failed"
            else:
                result.success = True
                result.error = None
            return result

        with pytest.MonkeyPatch.context() as m:
            m.setattr(service.ssh, "execute_command", mock_execute)
            deploy_result = await service.remove_agent(
                "tc2003-warn",
                delete_completely=False,
                ssh_username="wronguser",
                ssh_password="wrongpass",
            )

        assert deploy_result.success is True
        assert "Password authentication failed" in deploy_result.message
        assert "Falling back to SSH keys" in deploy_result.message


# =============================================================================
# TC2004: Verification warns when service still active
# =============================================================================


class TestTC2004VerificationServiceStillActive:
    """TC2004: Verification warns when service still active.

    After a successful uninstall, the verification step checks whether
    the homelab-agent systemd service is still running. If it is, a
    warning should be included in the response.
    """

    @pytest.mark.asyncio
    async def test_service_still_active_after_uninstall_warns(self, db_session) -> None:
        """Verification detects service still running and warns."""
        await _create_server(db_session, "tc2004-server", "tc2004.local")

        service = AgentDeploymentService(db_session)

        async def mock_execute(
            hostname,
            command,
            command_timeout,
            username=None,
            password=None,
            key_usernames=None,
        ):
            result = MagicMock()
            result.error = None
            result.stderr = ""

            if "systemctl is-active" in command:
                # Service is still running after uninstall
                result.success = True
                result.stdout = "active"
            elif "for path in" in command:
                # No files remain
                result.success = True
                result.stdout = ""
            else:
                # Uninstall command itself succeeds
                result.success = True
                result.stdout = ""
            return result

        with pytest.MonkeyPatch.context() as m:
            m.setattr(service.ssh, "execute_command", mock_execute)
            deploy_result = await service.remove_agent(
                "tc2004-server",
                delete_completely=False,
            )

        assert deploy_result.success is True
        assert "Verification warning" in deploy_result.message
        assert "service still running" in deploy_result.message


# =============================================================================
# TC2005: Verification warns when files remain
# =============================================================================


class TestTC2005VerificationFilesRemain:
    """TC2005: Verification warns when files remain.

    After a successful uninstall, the verification step checks whether
    agent files still exist on the remote host. If they do, a warning
    listing the remaining paths should be included in the response.
    """

    @pytest.mark.asyncio
    async def test_remaining_files_after_uninstall_warns(self, db_session) -> None:
        """Verification detects remaining files and lists them in warning."""
        await _create_server(db_session, "tc2005-server", "tc2005.local")

        service = AgentDeploymentService(db_session)

        async def mock_execute(
            hostname,
            command,
            command_timeout,
            username=None,
            password=None,
            key_usernames=None,
        ):
            result = MagicMock()
            result.error = None
            result.stderr = ""

            if "systemctl is-active" in command:
                # Service is stopped
                result.success = True
                result.stdout = "inactive"
            elif "for path in" in command:
                # Files still remain on the remote host
                result.success = True
                result.stdout = "/opt/homelab-agent\n/etc/homelab-agent"
            else:
                # Uninstall command succeeds
                result.success = True
                result.stdout = ""
            return result

        with pytest.MonkeyPatch.context() as m:
            m.setattr(service.ssh, "execute_command", mock_execute)
            deploy_result = await service.remove_agent(
                "tc2005-server",
                delete_completely=False,
            )

        assert deploy_result.success is True
        assert "Verification warning" in deploy_result.message
        assert "agent files remain" in deploy_result.message
        assert "/opt/homelab-agent" in deploy_result.message
        assert "/etc/homelab-agent" in deploy_result.message


# =============================================================================
# TC2006: Verification timeout returns warning
# =============================================================================


class TestTC2006VerificationTimeout:
    """TC2006: Verification timeout returns warning.

    When the post-uninstall verification SSH commands fail or time out,
    the response should include a warning about the verification failure
    rather than treating it as a hard error.
    """

    @pytest.mark.asyncio
    async def test_verification_timeout_still_succeeds_with_warning(
        self, db_session
    ) -> None:
        """Verification timeout produces warning, removal still succeeds."""
        await _create_server(db_session, "tc2006-server", "tc2006.local")

        service = AgentDeploymentService(db_session)

        async def mock_execute(
            hostname,
            command,
            command_timeout,
            username=None,
            password=None,
            key_usernames=None,
        ):
            result = MagicMock()
            result.stderr = ""
            result.stdout = ""

            if "systemctl is-active" in command:
                # Service check times out
                result.success = False
                result.error = "Connection timed out"
            elif "for path in" in command:
                # File check also times out
                result.success = False
                result.error = "Connection timed out"
            else:
                # Uninstall command succeeds
                result.success = True
                result.error = None
            return result

        with pytest.MonkeyPatch.context() as m:
            m.setattr(service.ssh, "execute_command", mock_execute)
            deploy_result = await service.remove_agent(
                "tc2006-server",
                delete_completely=False,
            )

        assert deploy_result.success is True
        assert "Verification warning" in deploy_result.message
        assert "failed or timed out" in deploy_result.message

    @pytest.mark.asyncio
    async def test_verification_timeout_server_still_marked_inactive(
        self, db_session
    ) -> None:
        """Server is marked inactive even when verification times out."""
        server = await _create_server(db_session, "tc2006-inactive", "tc2006-inactive.local")

        service = AgentDeploymentService(db_session)

        async def mock_execute(
            hostname,
            command,
            command_timeout,
            username=None,
            password=None,
            key_usernames=None,
        ):
            result = MagicMock()
            result.stderr = ""
            result.stdout = ""

            if "systemctl is-active" in command or "for path in" in command:
                result.success = False
                result.error = "Connection timed out"
            else:
                result.success = True
                result.error = None
            return result

        with pytest.MonkeyPatch.context() as m:
            m.setattr(service.ssh, "execute_command", mock_execute)
            await service.remove_agent(
                "tc2006-inactive",
                delete_completely=False,
            )

        await db_session.refresh(server)
        assert server.is_inactive is True


# =============================================================================
# TC2007: SSH timeout during uninstall returns warning
# =============================================================================


class TestTC2007SSHTimeoutDuringUninstall:
    """TC2007: SSH timeout during uninstall returns warning.

    When the SSH connection times out during the actual uninstall command
    (not verification), the service should still mark the server as
    inactive but include a warning about the failed uninstall.
    """

    @pytest.mark.asyncio
    async def test_ssh_timeout_during_uninstall_warns(self, db_session) -> None:
        """SSH timeout during uninstall produces warning in response."""
        await _create_server(db_session, "tc2007-server", "tc2007.local")

        service = AgentDeploymentService(db_session)

        mock_result = MagicMock()
        mock_result.success = False
        mock_result.error = "Connection timed out after 30s"
        mock_result.stdout = ""
        mock_result.stderr = ""

        with pytest.MonkeyPatch.context() as m:
            m.setattr(service.ssh, "execute_command", AsyncMock(return_value=mock_result))
            deploy_result = await service.remove_agent(
                "tc2007-server",
                delete_completely=False,
            )

        # Removal still succeeds (server marked inactive) but with warning
        assert deploy_result.success is True
        assert "Warning" in deploy_result.message
        assert "Could not uninstall" in deploy_result.message

    @pytest.mark.asyncio
    async def test_ssh_timeout_during_uninstall_still_marks_inactive(
        self, db_session
    ) -> None:
        """Server is marked inactive even when SSH uninstall times out."""
        server = await _create_server(db_session, "tc2007-inactive", "tc2007-inactive.local")

        service = AgentDeploymentService(db_session)

        mock_result = MagicMock()
        mock_result.success = False
        mock_result.error = "Connection timed out after 30s"
        mock_result.stdout = ""
        mock_result.stderr = ""

        with pytest.MonkeyPatch.context() as m:
            m.setattr(service.ssh, "execute_command", AsyncMock(return_value=mock_result))
            await service.remove_agent(
                "tc2007-inactive",
                delete_completely=False,
            )

        await db_session.refresh(server)
        assert server.is_inactive is True

    @pytest.mark.asyncio
    async def test_ssh_timeout_warns_agent_may_still_be_running(
        self, db_session
    ) -> None:
        """Warning explicitly mentions the agent may still be running."""
        await _create_server(db_session, "tc2007-running", "tc2007-running.local")

        service = AgentDeploymentService(db_session)

        mock_result = MagicMock()
        mock_result.success = False
        mock_result.error = "Connection timed out after 30s"
        mock_result.stdout = ""
        mock_result.stderr = ""

        with pytest.MonkeyPatch.context() as m:
            m.setattr(service.ssh, "execute_command", AsyncMock(return_value=mock_result))
            deploy_result = await service.remove_agent(
                "tc2007-running",
                delete_completely=False,
            )

        assert "agent may still be running" in deploy_result.message.lower()


# =============================================================================
# TC2008: Credentials are not persisted
# =============================================================================


class TestTC2008CredentialsNotPersisted:
    """TC2008: Credentials are not persisted.

    The ssh_username and ssh_password provided to remove_agent should be
    used only for the duration of the SSH connection. They must not be
    stored in the database or attached to any model.
    """

    @pytest.mark.asyncio
    async def test_ssh_password_not_stored_in_server_model(self, db_session) -> None:
        """Server model has no ssh_password field; transient credentials are not persisted."""
        server = await _create_server(db_session, "tc2008-server", "tc2008.local")
        service = AgentDeploymentService(db_session)

        mock_result = MagicMock()
        mock_result.success = True
        mock_result.stdout = ""
        mock_result.stderr = ""
        mock_result.error = None

        with pytest.MonkeyPatch.context() as m:
            m.setattr(service.ssh, "execute_command", AsyncMock(return_value=mock_result))
            await service.remove_agent(
                "tc2008-server",
                delete_completely=False,
                ssh_username="transient-user",
                ssh_password="transient-pass",
            )

        # Refresh and verify no password field exists on the server model
        await db_session.refresh(server)
        assert not hasattr(server, "ssh_password")
        # Note: server.ssh_username is a persistent per-server config field (EP0015),
        # not the transient credential from the remove request. Verify the remove
        # operation did not overwrite it with the transient value.
        assert server.ssh_username != "transient-user"

    @pytest.mark.asyncio
    async def test_deployment_result_has_no_credential_fields(self, db_session) -> None:
        """DeploymentResult dataclass has no password or credential attributes."""
        await _create_server(db_session, "tc2008-result", "tc2008-result.local")
        service = AgentDeploymentService(db_session)

        mock_result = MagicMock()
        mock_result.success = True
        mock_result.stdout = ""
        mock_result.stderr = ""
        mock_result.error = None

        with pytest.MonkeyPatch.context() as m:
            m.setattr(service.ssh, "execute_command", AsyncMock(return_value=mock_result))
            deploy_result = await service.remove_agent(
                "tc2008-result",
                delete_completely=False,
                ssh_username="temp-user",
                ssh_password="temp-pass",
            )

        # DeploymentResult should not store any credential data
        assert not hasattr(deploy_result, "password")
        assert not hasattr(deploy_result, "ssh_password")
        assert not hasattr(deploy_result, "ssh_username")

    @pytest.mark.asyncio
    async def test_credentials_transient_in_remove_agent_call(self, db_session) -> None:
        """Credentials only exist for the duration of the SSH calls."""
        from sqlalchemy import text

        await _create_server(db_session, "tc2008-transient", "tc2008-transient.local")
        service = AgentDeploymentService(db_session)

        mock_result = MagicMock()
        mock_result.success = True
        mock_result.stdout = ""
        mock_result.stderr = ""
        mock_result.error = None

        with pytest.MonkeyPatch.context() as m:
            m.setattr(service.ssh, "execute_command", AsyncMock(return_value=mock_result))
            await service.remove_agent(
                "tc2008-transient",
                delete_completely=False,
                ssh_username="ephemeral-user",
                ssh_password="ephemeral-pass",
            )

        # Query config table to verify no SSH credentials were stored
        config_result = await db_session.execute(
            text("SELECT value FROM config WHERE key = 'ssh'")
        )
        config_row = config_result.scalar_one_or_none()
        if config_row is not None:
            import json

            config_data = json.loads(config_row) if isinstance(config_row, str) else config_row
            # Verify password is not stored in SSH config
            assert "ssh_password" not in config_data
            assert "ephemeral-pass" not in str(config_data)


# =============================================================================
# TC2009: Response omits password values
# =============================================================================


class TestTC2009ResponseOmitsPasswords:
    """TC2009: Response omits password values.

    The DeploymentResult (and by extension the API response) must never
    contain the ssh_password or any sensitive credential values, even in
    message or error strings.
    """

    @pytest.mark.asyncio
    async def test_successful_removal_omits_password_from_message(
        self, db_session
    ) -> None:
        """Successful removal response does not leak password in message."""
        await _create_server(db_session, "tc2009-success", "tc2009-success.local")
        service = AgentDeploymentService(db_session)

        mock_result = MagicMock()
        mock_result.success = True
        mock_result.stdout = ""
        mock_result.stderr = ""
        mock_result.error = None

        with pytest.MonkeyPatch.context() as m:
            m.setattr(service.ssh, "execute_command", AsyncMock(return_value=mock_result))
            deploy_result = await service.remove_agent(
                "tc2009-success",
                delete_completely=False,
                ssh_username="secretuser",
                ssh_password="supersecretpassword",
            )

        assert deploy_result.success is True
        assert "supersecretpassword" not in deploy_result.message
        assert "supersecretpassword" not in (deploy_result.error or "")

    @pytest.mark.asyncio
    async def test_failed_removal_omits_password_from_error(self, db_session) -> None:
        """Failed removal response does not leak password in error message."""
        await _create_server(db_session, "tc2009-fail", "tc2009-fail.local")
        service = AgentDeploymentService(db_session)

        call_count = [0]

        async def mock_execute(
            hostname,
            command,
            command_timeout,
            username=None,
            password=None,
            key_usernames=None,
        ):
            call_count[0] += 1
            result = MagicMock()
            result.stdout = ""
            result.stderr = ""
            # Both password auth and key auth fail
            result.success = False
            result.error = "Connection refused"
            return result

        with pytest.MonkeyPatch.context() as m:
            m.setattr(service.ssh, "execute_command", mock_execute)
            deploy_result = await service.remove_agent(
                "tc2009-fail",
                delete_completely=False,
                ssh_username="leaky-user",
                ssh_password="topsecretpass123",
            )

        # Regardless of success/failure, password must not appear anywhere
        assert "topsecretpass123" not in deploy_result.message
        assert "topsecretpass123" not in (deploy_result.error or "")

    @pytest.mark.asyncio
    async def test_response_has_no_password_attributes(self, db_session) -> None:
        """DeploymentResult has no password-related attributes at all."""
        await _create_server(db_session, "tc2009-attrs", "tc2009-attrs.local")
        service = AgentDeploymentService(db_session)

        mock_result = MagicMock()
        mock_result.success = True
        mock_result.stdout = ""
        mock_result.stderr = ""
        mock_result.error = None

        with pytest.MonkeyPatch.context() as m:
            m.setattr(service.ssh, "execute_command", AsyncMock(return_value=mock_result))
            deploy_result = await service.remove_agent(
                "tc2009-attrs",
                delete_completely=False,
                ssh_username="hidden-user",
                ssh_password="hidden-pass",
            )

        # The result object must not expose credential fields
        assert not hasattr(deploy_result, "password")
        assert not hasattr(deploy_result, "ssh_password")
        assert not hasattr(deploy_result, "ssh_username")

    @pytest.mark.asyncio
    async def test_api_response_schema_excludes_credentials(self) -> None:
        """AgentRemoveResponse schema has no credential fields."""
        from homelab_cmd.api.schemas.agent_deploy import AgentRemoveResponse

        schema_fields = set(AgentRemoveResponse.model_fields.keys())
        # Verify the response schema only contains expected fields
        assert "ssh_password" not in schema_fields
        assert "ssh_username" not in schema_fields
        assert "password" not in schema_fields
        # Verify expected fields are present
        assert "success" in schema_fields
        assert "server_id" in schema_fields
        assert "message" in schema_fields
        assert "error" in schema_fields
