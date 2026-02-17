# US0158: Container Listing via SSH

> **Status:** Ready
> **Epic:** [EP0014: Docker Container Monitoring](../epics/EP0014-docker-container-monitoring.md)
> **Owner:** Darren
> **Reviewer:** TBD
> **Created:** 2026-02-01
> **Story Points:** 5
> **Priority:** P0

---

## User Story

**As a** homelab operator (Darren)
**I want** to see all Docker containers on a machine
**So that** I know what's running

## Context

### Persona Reference
**Darren** - Primary homelab operator with 11+ servers including OpenMediaVault NAS boxes, Raspberry Pis, and mini PCs. Many run Docker containers for services like Plex, Sonarr, Radarr.
[Full persona details](../personas.md#darren-homelab-operator)

### Background
With Docker detection (US0157) complete, users can now see which servers have Docker installed. The next step is to list the containers running on those servers. This uses the SSH executor infrastructure (EP0013) to run `docker ps` and parse the results.

---

## Acceptance Criteria

### AC1: API Endpoint Returns Container List
- **Given** a server with `has_docker: true`
- **When** calling `GET /api/v1/servers/{id}/containers`
- **Then** the API returns a list of containers with: id, name, image, state, status, ports

### AC2: Retrieves Containers via SSH
- **Given** a server with Tailscale hostname configured
- **When** the API endpoint is called
- **Then** the backend executes `docker ps -a --format '{{json .}}'` via SSH
- **And** parses the JSON output into container objects

### AC3: Includes Both Running and Stopped Containers
- **Given** a server with running and stopped containers
- **When** calling the containers endpoint
- **Then** both running and stopped/exited containers are included
- **And** containers are sorted: running first, then by name

### AC4: Response Caching
- **Given** multiple API calls within 60 seconds
- **When** the container list is requested
- **Then** cached results are returned (avoid excessive SSH calls)
- **And** cache is per-server

### AC5: Graceful Handling for Non-Docker Servers
- **Given** a server with `has_docker: false` or `null`
- **When** calling the containers endpoint
- **Then** return empty array with appropriate message
- **And** do not attempt SSH connection

### AC6: Error Handling
- **Given** SSH connection fails or times out
- **When** calling the containers endpoint
- **Then** return appropriate error response with details
- **And** do not crash the API

### AC7: Uptime Calculation
- **Given** a running container
- **When** the container list is returned
- **Then** include `uptime_seconds` calculated from container start time

---

## Scope

### In Scope
- API endpoint `GET /api/v1/servers/{id}/containers`
- SSH execution using existing SSHPooledExecutor
- JSON parsing of `docker ps` output
- In-memory caching with 60-second TTL
- Response schema for container data

### Out of Scope
- Container widget (US0159)
- Container actions (start/stop/restart - US0160-US0162)
- Container logs
- Docker Compose detection

---

## Technical Notes

### SSH Command

```bash
docker ps -a --format '{{json .}}'
```

Outputs one JSON object per line:
```json
{"Command":"...","CreatedAt":"...","ID":"abc123","Image":"plex","Names":"plex","Ports":"32400/tcp","State":"running","Status":"Up 12 days"}
```

### Response Schema

```python
class ContainerInfo(BaseModel):
    id: str  # Short container ID
    name: str  # Container name (without leading /)
    image: str  # Image name with tag
    state: str  # running, exited, created, paused, restarting
    status: str  # Human-readable status from Docker
    ports: str | None  # Port mappings
    created_at: str  # ISO timestamp
    uptime_seconds: int | None  # Only for running containers

class ContainerListResponse(BaseModel):
    server_id: str
    containers: list[ContainerInfo]
    total: int
    cached: bool  # Whether this was served from cache
    fetched_at: datetime
```

### Caching Strategy

```python
# In-memory cache with TTL
_container_cache: dict[str, tuple[list[ContainerInfo], datetime]] = {}
CACHE_TTL_SECONDS = 60

def get_cached_containers(server_id: str) -> list[ContainerInfo] | None:
    if server_id in _container_cache:
        containers, timestamp = _container_cache[server_id]
        if (datetime.now(UTC) - timestamp).total_seconds() < CACHE_TTL_SECONDS:
            return containers
    return None
```

### Uptime Calculation

Parse Docker's `CreatedAt` timestamp and calculate difference from now for running containers.

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Server not found | 404 Not Found |
| Server has no Tailscale hostname | 400 Bad Request with clear message |
| Docker not installed (has_docker=false) | 200 with empty containers array |
| SSH connection fails | 503 Service Unavailable with error details |
| SSH timeout | 408 Request Timeout |
| Docker command fails (non-zero exit) | 200 with empty array + error in response |
| No containers running | 200 with empty containers array |
| Container with no ports | ports field is empty string or null |
| Very long container name | Truncate in response (max 64 chars) |

---

## Test Scenarios

- [ ] API returns container list for Docker server
- [ ] API returns empty list for non-Docker server
- [ ] Response includes all required fields
- [ ] Containers sorted by state (running first) then name
- [ ] Cached response returned within TTL
- [ ] Fresh data fetched after TTL expires
- [ ] Error response for SSH failure
- [ ] Error response for server not found
- [ ] Uptime calculated correctly for running containers
- [ ] Stopped containers have null uptime

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| US0157 | Prerequisite | Docker detection (has_docker field) | Done |
| EP0013 | Prerequisite | SSH Executor service | Done |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| SSHPooledExecutor | Service | Available |
| Server model with has_docker | Database | Available |
| Tailscale connectivity | Infrastructure | Available |

---

## Estimation

**Story Points:** 5
**Complexity:** Medium

| Component | Effort |
|-----------|--------|
| API route + endpoint | Small |
| Pydantic schemas | Small |
| SSH command execution | Small |
| JSON parsing logic | Medium |
| Caching implementation | Small |
| Error handling | Small |
| Tests | Medium |

---

## Open Questions

None - requirements are clear from epic specification.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-02-01 | Claude | Initial story creation from EP0014 specification |
