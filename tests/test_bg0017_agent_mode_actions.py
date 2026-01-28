"""BG0017: Tests for agent mode action rejection.

This bug fix ensures that servers with readonly agents cannot have
actions created against them. These tests verify the API guard in the
actions endpoint rejects action creation with 409 Conflict.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.db.models.server import Server


@pytest.fixture
def anyio_backend():
    """Use asyncio backend for anyio."""
    return "asyncio"


class TestBG0017ReadonlyAgentActionsGuard:
    """BG0017: Verify readonly agents reject action creation."""

    @pytest.mark.asyncio
    async def test_action_on_readonly_agent_returns_409(self, db_session: AsyncSession) -> None:
        """BG0017: Creating action on readonly agent returns 409 Conflict."""
        # Create a server with readonly agent
        server = Server(
            id="bg0017-readonly-test",
            hostname="readonly.local",
            agent_mode="readonly",
        )
        db_session.add(server)
        await db_session.commit()

        from fastapi import HTTPException

        from homelab_cmd.api.routes.actions import create_action
        from homelab_cmd.api.schemas.actions import ActionCreate, ActionType

        action_data = ActionCreate(
            server_id="bg0017-readonly-test",
            action_type=ActionType.RESTART_SERVICE,
            service_name="test-service",
        )

        with pytest.raises(HTTPException) as exc_info:
            await create_action(action_data, db_session, "test-key")

        assert exc_info.value.status_code == 409
        assert "readonly" in exc_info.value.detail["message"].lower()

    @pytest.mark.asyncio
    async def test_action_on_readonly_agent_error_mentions_reinstall(
        self, db_session: AsyncSession
    ) -> None:
        """BG0017: Error message indicates need to reinstall with readwrite mode."""
        server = Server(
            id="bg0017-msg-test",
            hostname="readonly-msg.local",
            agent_mode="readonly",
        )
        db_session.add(server)
        await db_session.commit()

        from fastapi import HTTPException

        from homelab_cmd.api.routes.actions import create_action
        from homelab_cmd.api.schemas.actions import ActionCreate, ActionType

        action_data = ActionCreate(
            server_id="bg0017-msg-test",
            action_type=ActionType.CLEAR_LOGS,
        )

        with pytest.raises(HTTPException) as exc_info:
            await create_action(action_data, db_session, "test-key")

        assert exc_info.value.status_code == 409
        # Verify message mentions how to enable management
        assert "readwrite" in exc_info.value.detail["message"].lower()

    @pytest.mark.asyncio
    async def test_apt_action_on_readonly_agent_returns_409(
        self, db_session: AsyncSession
    ) -> None:
        """BG0017: APT actions also rejected on readonly agents."""
        server = Server(
            id="bg0017-apt-test",
            hostname="readonly-apt.local",
            agent_mode="readonly",
        )
        db_session.add(server)
        await db_session.commit()

        from fastapi import HTTPException

        from homelab_cmd.api.routes.actions import create_action
        from homelab_cmd.api.schemas.actions import ActionCreate, ActionType

        action_data = ActionCreate(
            server_id="bg0017-apt-test",
            action_type=ActionType.APT_UPDATE,
        )

        with pytest.raises(HTTPException) as exc_info:
            await create_action(action_data, db_session, "test-key")

        assert exc_info.value.status_code == 409

    @pytest.mark.asyncio
    async def test_action_on_readwrite_agent_succeeds(self, db_session: AsyncSession) -> None:
        """BG0017: Readwrite agent allows action creation."""
        # Create a server with readwrite agent
        server = Server(
            id="bg0017-readwrite-test",
            hostname="readwrite.local",
            agent_mode="readwrite",
        )
        db_session.add(server)
        await db_session.commit()

        from homelab_cmd.api.routes.actions import create_action
        from homelab_cmd.api.schemas.actions import ActionCreate, ActionType

        action_data = ActionCreate(
            server_id="bg0017-readwrite-test",
            action_type=ActionType.RESTART_SERVICE,
            service_name="test-service",
        )

        # Should not raise - action creation succeeds
        result = await create_action(action_data, db_session, "test-key")

        assert result.server_id == "bg0017-readwrite-test"
        assert result.status == "approved"  # Auto-approved for non-paused server

    @pytest.mark.asyncio
    async def test_action_on_null_agent_mode_succeeds(self, db_session: AsyncSession) -> None:
        """BG0017: Server with no agent_mode (legacy) allows action creation."""
        # Create a server with no agent_mode (legacy server)
        server = Server(
            id="bg0017-legacy-test",
            hostname="legacy.local",
            agent_mode=None,  # Legacy server, no mode set
        )
        db_session.add(server)
        await db_session.commit()

        from homelab_cmd.api.routes.actions import create_action
        from homelab_cmd.api.schemas.actions import ActionCreate, ActionType

        action_data = ActionCreate(
            server_id="bg0017-legacy-test",
            action_type=ActionType.RESTART_SERVICE,
            service_name="test-service",
        )

        # Should not raise - action creation succeeds for legacy servers
        result = await create_action(action_data, db_session, "test-key")

        assert result.server_id == "bg0017-legacy-test"
        assert result.status == "approved"


class TestBG0017HeartbeatAgentMode:
    """BG0017: Verify heartbeat stores agent_mode."""

    @pytest.mark.asyncio
    async def test_heartbeat_stores_agent_mode_readonly(self, db_session: AsyncSession) -> None:
        """BG0017: Heartbeat with agent_mode=readonly stores correctly."""
        from datetime import UTC, datetime

        from homelab_cmd.api.routes.agents import receive_heartbeat
        from homelab_cmd.api.schemas.heartbeat import HeartbeatRequest

        # Create heartbeat request with readonly mode
        heartbeat = HeartbeatRequest(
            server_id="bg0017-hb-readonly",
            hostname="heartbeat-readonly.local",
            timestamp=datetime.now(UTC),
            agent_mode="readonly",
        )

        # Mock request object
        class MockRequest:
            client = None

        result = await receive_heartbeat(heartbeat, MockRequest(), db_session, "test-key")

        # Verify response
        assert result.status == "ok"
        assert result.server_registered is True

        # Verify server was created with correct mode
        server = await db_session.get(Server, "bg0017-hb-readonly")
        assert server is not None
        assert server.agent_mode == "readonly"

    @pytest.mark.asyncio
    async def test_heartbeat_stores_agent_mode_readwrite(self, db_session: AsyncSession) -> None:
        """BG0017: Heartbeat with agent_mode=readwrite stores correctly."""
        from datetime import UTC, datetime

        from homelab_cmd.api.routes.agents import receive_heartbeat
        from homelab_cmd.api.schemas.heartbeat import HeartbeatRequest

        heartbeat = HeartbeatRequest(
            server_id="bg0017-hb-readwrite",
            hostname="heartbeat-readwrite.local",
            timestamp=datetime.now(UTC),
            agent_mode="readwrite",
        )

        class MockRequest:
            client = None

        result = await receive_heartbeat(heartbeat, MockRequest(), db_session, "test-key")

        assert result.status == "ok"

        server = await db_session.get(Server, "bg0017-hb-readwrite")
        assert server is not None
        assert server.agent_mode == "readwrite"

    @pytest.mark.asyncio
    async def test_heartbeat_updates_agent_mode(self, db_session: AsyncSession) -> None:
        """BG0017: Heartbeat updates existing server's agent_mode."""
        from datetime import UTC, datetime

        # Create existing server with no mode
        server = Server(
            id="bg0017-update-test",
            hostname="update-test.local",
            agent_mode=None,
        )
        db_session.add(server)
        await db_session.commit()

        from homelab_cmd.api.routes.agents import receive_heartbeat
        from homelab_cmd.api.schemas.heartbeat import HeartbeatRequest

        # Send heartbeat with mode set
        heartbeat = HeartbeatRequest(
            server_id="bg0017-update-test",
            hostname="update-test.local",
            timestamp=datetime.now(UTC),
            agent_mode="readwrite",
        )

        class MockRequest:
            client = None

        await receive_heartbeat(heartbeat, MockRequest(), db_session, "test-key")

        # Refresh server from db
        await db_session.refresh(server)
        assert server.agent_mode == "readwrite"
