"""BG0011: Tests for inactive server action rejection.

This bug fix ensures that inactive servers (agent removed) cannot have
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


@pytest.fixture
async def async_app():
    """Create async test app."""
    from datetime import UTC, datetime

    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    from homelab_cmd.api.routes import (
        actions,
        agents,
        servers,
    )
    from homelab_cmd.api.routes.system import router as system_router
    from homelab_cmd.db.database import dispose_engine, init_database
    from homelab_cmd.services.system import system

    @asynccontextmanager
    async def test_lifespan(_app: FastAPI):
        """Test lifespan."""
        system.set_start_time(datetime.now(UTC))
        await init_database()
        yield
        await dispose_engine()


    app = FastAPI(lifespan=test_lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(system_router, prefix="/api/v1")
    app.include_router(servers.router, prefix="/api/v1")
    app.include_router(agents.router, prefix="/api/v1")
    app.include_router(actions.router, prefix="/api/v1")

    return app


class TestBG0011InactiveServerActionsGuard:
    """BG0011: Verify inactive servers reject action creation."""

    @pytest.mark.asyncio
    async def test_action_on_inactive_server_returns_409(self, db_session: AsyncSession) -> None:
        """BG0011: Creating action on inactive server returns 409 Conflict."""
        # Create an inactive server directly in the database
        server = Server(
            id="bg0011-inactive-test",
            hostname="inactive.local",
            is_inactive=True,
        )
        db_session.add(server)
        await db_session.commit()

        # Import the route function directly to test the guard

        from fastapi import HTTPException

        from homelab_cmd.api.routes.actions import create_action
        from homelab_cmd.api.schemas.actions import ActionCreate, ActionType

        action_data = ActionCreate(
            server_id="bg0011-inactive-test",
            action_type=ActionType.RESTART_SERVICE,
            service_name="test-service",
        )

        with pytest.raises(HTTPException) as exc_info:
            await create_action(action_data, db_session, "test-key")

        assert exc_info.value.status_code == 409
        assert "inactive" in exc_info.value.detail["message"].lower()

    @pytest.mark.asyncio
    async def test_action_on_inactive_server_error_mentions_agent_removed(
        self, db_session: AsyncSession
    ) -> None:
        """BG0011: Error message indicates agent was removed."""
        server = Server(
            id="bg0011-msg-test",
            hostname="inactive-msg.local",
            is_inactive=True,
        )
        db_session.add(server)
        await db_session.commit()

        from fastapi import HTTPException

        from homelab_cmd.api.routes.actions import create_action
        from homelab_cmd.api.schemas.actions import ActionCreate, ActionType

        action_data = ActionCreate(
            server_id="bg0011-msg-test",
            action_type=ActionType.CLEAR_LOGS,
        )

        with pytest.raises(HTTPException) as exc_info:
            await create_action(action_data, db_session, "test-key")

        assert exc_info.value.status_code == 409
        assert "agent removed" in exc_info.value.detail["message"].lower()

    @pytest.mark.asyncio
    async def test_apt_action_on_inactive_server_returns_409(
        self, db_session: AsyncSession
    ) -> None:
        """BG0011: APT actions also rejected on inactive servers."""
        server = Server(
            id="bg0011-apt-test",
            hostname="inactive-apt.local",
            is_inactive=True,
        )
        db_session.add(server)
        await db_session.commit()

        from fastapi import HTTPException

        from homelab_cmd.api.routes.actions import create_action
        from homelab_cmd.api.schemas.actions import ActionCreate, ActionType

        action_data = ActionCreate(
            server_id="bg0011-apt-test",
            action_type=ActionType.APT_UPDATE,
        )

        with pytest.raises(HTTPException) as exc_info:
            await create_action(action_data, db_session, "test-key")

        assert exc_info.value.status_code == 409

    @pytest.mark.asyncio
    async def test_action_on_active_server_succeeds(self, db_session: AsyncSession) -> None:
        """BG0011: Active server allows action creation."""
        # Create an active server
        server = Server(
            id="bg0011-active-test",
            hostname="active.local",
            is_inactive=False,  # Active
        )
        db_session.add(server)
        await db_session.commit()

        from homelab_cmd.api.routes.actions import create_action
        from homelab_cmd.api.schemas.actions import ActionCreate, ActionType

        action_data = ActionCreate(
            server_id="bg0011-active-test",
            action_type=ActionType.RESTART_SERVICE,
            service_name="test-service",
        )

        # Should not raise - action creation succeeds
        result = await create_action(action_data, db_session, "test-key")

        assert result.server_id == "bg0011-active-test"
        assert result.status == "approved"  # Auto-approved for active server
