# PL0206: Container Listing Implementation Plan

> **Status:** Complete
> **Story:** [US0158: Container Listing via SSH](../stories/US0158-container-listing.md)
> **Created:** 2026-02-01
> **Approach:** Test-After

---

## Overview

Implement API endpoint to list Docker containers on a server via SSH execution.

---

## Implementation Phases

### Phase 1: Backend Schema (Small)

**Files:**
- `backend/src/homelab_cmd/api/schemas/containers.py` (NEW)

**Tasks:**
1. Create `ContainerInfo` Pydantic model
2. Create `ContainerListResponse` Pydantic model
3. Add container state enum if needed

### Phase 2: Container Service (Medium)

**Files:**
- `backend/src/homelab_cmd/services/container_service.py` (NEW)

**Tasks:**
1. Create `ContainerService` class
2. Implement `list_containers()` method with SSH execution
3. Implement JSON parsing of `docker ps` output
4. Implement in-memory caching with 60s TTL
5. Implement uptime calculation for running containers
6. Handle edge cases (no containers, docker errors)

### Phase 3: API Route (Small)

**Files:**
- `backend/src/homelab_cmd/api/routes/containers.py` (NEW)
- `backend/src/homelab_cmd/main.py` (MODIFY - add router)

**Tasks:**
1. Create containers router
2. Implement `GET /servers/{server_id}/containers` endpoint
3. Validate server exists and has Docker
4. Call container service
5. Return properly formatted response

### Phase 4: Testing (Medium)

**Files:**
- `tests/test_container_listing.py` (NEW)

**Tasks:**
1. Test container list parsing
2. Test caching behaviour
3. Test error handling (no docker, SSH fail)
4. Test sorting (running first)
5. Test uptime calculation

---

## Detailed Implementation

### Schema Design

```python
# backend/src/homelab_cmd/api/schemas/containers.py

from datetime import datetime
from pydantic import BaseModel, Field

class ContainerInfo(BaseModel):
    """Individual container information."""
    id: str = Field(..., description="Short container ID")
    name: str = Field(..., description="Container name")
    image: str = Field(..., description="Image name with tag")
    state: str = Field(..., description="Container state: running, exited, created, paused")
    status: str = Field(..., description="Human-readable status from Docker")
    ports: str | None = Field(None, description="Port mappings")
    created_at: str | None = Field(None, description="Container creation timestamp")
    uptime_seconds: int | None = Field(None, description="Uptime in seconds (running only)")

class ContainerListResponse(BaseModel):
    """Response for container listing endpoint."""
    server_id: str = Field(..., description="Server identifier")
    containers: list[ContainerInfo] = Field(default_factory=list)
    total: int = Field(..., description="Total container count")
    cached: bool = Field(False, description="Whether served from cache")
    fetched_at: datetime = Field(..., description="When data was fetched")
    error: str | None = Field(None, description="Error message if fetch failed")
```

### Service Design

```python
# backend/src/homelab_cmd/services/container_service.py

import json
import logging
from datetime import UTC, datetime
from typing import NamedTuple

from homelab_cmd.db.models.server import Server
from homelab_cmd.services.ssh_executor import SSHPooledExecutor

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 60

class CachedContainers(NamedTuple):
    containers: list[dict]
    fetched_at: datetime

# Module-level cache
_container_cache: dict[str, CachedContainers] = {}

class ContainerService:
    def __init__(self, ssh_executor: SSHPooledExecutor):
        self.ssh_executor = ssh_executor

    async def list_containers(
        self, server: Server, force_refresh: bool = False
    ) -> tuple[list[dict], bool, datetime]:
        """List containers on server. Returns (containers, cached, fetched_at)."""
        # Check cache first
        if not force_refresh and server.id in _container_cache:
            cached = _container_cache[server.id]
            age = (datetime.now(UTC) - cached.fetched_at).total_seconds()
            if age < CACHE_TTL_SECONDS:
                return cached.containers, True, cached.fetched_at

        # Execute docker ps via SSH
        result = await self.ssh_executor.execute(
            server=server,
            command="docker ps -a --format '{{json .}}'",
            timeout=30,
        )

        containers = []
        if result.exit_code == 0 and result.stdout:
            containers = self._parse_docker_output(result.stdout)

        # Sort: running first, then by name
        containers.sort(key=lambda c: (c["state"] != "running", c["name"].lower()))

        # Cache result
        fetched_at = datetime.now(UTC)
        _container_cache[server.id] = CachedContainers(containers, fetched_at)

        return containers, False, fetched_at

    def _parse_docker_output(self, output: str) -> list[dict]:
        """Parse docker ps JSON output."""
        containers = []
        for line in output.strip().split("\n"):
            if not line:
                continue
            try:
                data = json.loads(line)
                container = {
                    "id": data.get("ID", "")[:12],
                    "name": data.get("Names", "").lstrip("/"),
                    "image": data.get("Image", ""),
                    "state": data.get("State", "unknown").lower(),
                    "status": data.get("Status", ""),
                    "ports": data.get("Ports") or None,
                    "created_at": data.get("CreatedAt"),
                    "uptime_seconds": self._calc_uptime(data) if data.get("State") == "running" else None,
                }
                containers.append(container)
            except json.JSONDecodeError:
                logger.warning("Failed to parse container JSON: %s", line[:100])
        return containers

    def _calc_uptime(self, data: dict) -> int | None:
        """Calculate uptime from RunningFor or CreatedAt."""
        # Docker provides "RunningFor" in some formats
        # For simplicity, parse Status like "Up 12 days" or use CreatedAt
        status = data.get("Status", "")
        if status.startswith("Up "):
            return self._parse_uptime_string(status[3:])
        return None

    def _parse_uptime_string(self, uptime_str: str) -> int:
        """Parse Docker uptime string like '12 days' or '3 hours'."""
        # Simplified parsing - Docker uses various formats
        parts = uptime_str.split()
        if len(parts) >= 2:
            try:
                value = int(parts[0])
                unit = parts[1].lower()
                if "second" in unit:
                    return value
                elif "minute" in unit:
                    return value * 60
                elif "hour" in unit:
                    return value * 3600
                elif "day" in unit:
                    return value * 86400
                elif "week" in unit:
                    return value * 604800
                elif "month" in unit:
                    return value * 2592000  # ~30 days
            except ValueError:
                pass
        return 0
```

### Route Design

```python
# backend/src/homelab_cmd/api/routes/containers.py

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.deps import verify_api_key
from homelab_cmd.api.responses import AUTH_RESPONSES, NOT_FOUND_RESPONSE
from homelab_cmd.api.schemas.containers import ContainerInfo, ContainerListResponse
from homelab_cmd.db.models.server import Server
from homelab_cmd.db.session import get_async_session
from homelab_cmd.services.container_service import ContainerService
from homelab_cmd.services.credential_service import CredentialService
from homelab_cmd.services.host_key_service import HostKeyService
from homelab_cmd.services.ssh_executor import SSHPooledExecutor

router = APIRouter(prefix="/servers", tags=["Containers"])

# Lazy-init singleton
_ssh_executor: SSHPooledExecutor | None = None
_container_service: ContainerService | None = None

def get_container_service(session: AsyncSession) -> ContainerService:
    global _ssh_executor, _container_service
    if _ssh_executor is None:
        credential_service = CredentialService()
        host_key_service = HostKeyService(session)
        _ssh_executor = SSHPooledExecutor(credential_service, host_key_service)
        _container_service = ContainerService(_ssh_executor)
    return _container_service

@router.get(
    "/{server_id}/containers",
    response_model=ContainerListResponse,
    operation_id="list_server_containers",
    summary="List Docker containers on a server",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE},
)
async def list_containers(
    server_id: str,
    refresh: bool = False,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ContainerListResponse:
    """List Docker containers on a server via SSH (US0158)."""
    # Verify server exists
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Server '{server_id}' not found"},
        )

    # Check if Docker is installed
    if not server.has_docker:
        return ContainerListResponse(
            server_id=server_id,
            containers=[],
            total=0,
            cached=False,
            fetched_at=datetime.now(UTC),
            error="Docker not installed on this server" if server.has_docker is False else None,
        )

    # Check Tailscale hostname
    if not server.tailscale_hostname:
        raise HTTPException(
            status_code=400,
            detail={"code": "NO_TAILSCALE_HOSTNAME", "message": "Server has no Tailscale hostname configured"},
        )

    # Get containers
    service = get_container_service(session)
    try:
        containers, cached, fetched_at = await service.list_containers(server, force_refresh=refresh)
        return ContainerListResponse(
            server_id=server_id,
            containers=[ContainerInfo(**c) for c in containers],
            total=len(containers),
            cached=cached,
            fetched_at=fetched_at,
        )
    except Exception as e:
        # Return error response rather than raising
        return ContainerListResponse(
            server_id=server_id,
            containers=[],
            total=0,
            cached=False,
            fetched_at=datetime.now(UTC),
            error=str(e),
        )
```

---

## Test Plan

### Unit Tests
1. `test_parse_docker_output_valid` - Parse valid JSON output
2. `test_parse_docker_output_empty` - Handle empty output
3. `test_parse_docker_output_malformed` - Skip malformed lines
4. `test_container_sorting` - Running first, then alphabetical
5. `test_uptime_parsing` - Various uptime formats

### Integration Tests
1. `test_list_containers_success` - Full endpoint with mocked SSH
2. `test_list_containers_no_docker` - Server without Docker
3. `test_list_containers_server_not_found` - 404 response
4. `test_list_containers_no_tailscale` - 400 response
5. `test_list_containers_cached` - Verify caching behaviour
6. `test_list_containers_ssh_error` - Handle SSH failures

---

## Risks

| Risk | Mitigation |
|------|------------|
| SSH timeout on slow servers | 30s timeout, return error gracefully |
| Large container list | Pagination in future if needed |
| Docker format changes | Use JSON format, handle missing fields |

---

## Checklist

- [x] Create schemas/containers.py
- [x] Create services/container_service.py
- [x] Create routes/containers.py
- [x] Register router in main.py
- [x] Write unit tests
- [x] Write integration tests
- [x] Update story status to Done

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-02-01 | Claude | Initial plan creation |
| 2026-02-01 | Claude | Implementation complete, all tests pass |
