# US0157: Docker Detection

> **Status:** Done
> **Epic:** [EP0014: Docker Container Monitoring](../epics/EP0014-docker-container-monitoring.md)
> **Owner:** Darren
> **Reviewer:** TBD
> **Created:** 2026-02-01
> **Story Points:** 3
> **Priority:** P0

---

## User Story

**As a** homelab operator (Darren)
**I want** HomelabCmd to detect if Docker is installed on my servers
**So that** Docker features are only shown for Docker hosts

## Context

### Persona Reference
**Darren** - Primary homelab operator with 11+ servers including OpenMediaVault NAS boxes, Raspberry Pis, and mini PCs. Some run Docker, others don't.
[Full persona details](../personas.md#darren-homelab-operator)

### Background
EP0014 introduces Docker container monitoring capabilities. Before showing any Docker-related UI or executing container commands, the system must first detect whether Docker is installed on each machine. This detection happens during the agent heartbeat cycle.

---

## Acceptance Criteria

### AC1: Agent Heartbeat Includes Docker Status
- **Given** the HomelabCmd agent is running on a server
- **When** the agent sends a heartbeat to the hub
- **Then** the heartbeat payload includes `docker_installed: boolean` field

### AC2: Docker Detection via CLI
- **Given** a server with Docker installed (docker.io or Docker CE)
- **When** the agent runs `docker --version`
- **Then** `docker_installed` is set to `true` if command succeeds (exit code 0)
- **And** `docker_installed` is set to `false` if command fails or times out

### AC3: Server Model Stores Docker Status
- **Given** the hub receives a heartbeat with `docker_installed: true`
- **When** the heartbeat is processed
- **Then** the Server model's `has_docker` field is updated to `true`
- **And** the `has_docker` field persists across heartbeats

### AC4: API Returns Docker Status
- **Given** a server with `has_docker: true` in the database
- **When** the API returns server data (GET /api/v1/servers/{id})
- **Then** the response includes `has_docker: true`

### AC5: Dashboard Shows Docker Indicator
- **Given** a server card on the dashboard
- **When** the server has `has_docker: true`
- **Then** a Docker icon/badge is displayed on the server card

### AC6: Both Docker Variants Detected
- **Given** a server with docker.io package installed (Debian/Ubuntu)
- **When** the agent performs detection
- **Then** Docker is detected correctly
- **And** Docker CE installations are also detected correctly

### AC7: Detection Timeout Handling
- **Given** the agent attempts Docker detection
- **When** the `docker --version` command takes longer than 5 seconds
- **Then** the command is terminated
- **And** `docker_installed` is set to `false`
- **And** no agent hang occurs

---

## Scope

### In Scope
- Agent detection of Docker installation via CLI
- Heartbeat payload extension with `docker_installed` field
- Server model `has_docker` field and migration
- API schema updates to include `has_docker`
- Dashboard Docker badge on server cards

### Out of Scope
- Container listing (US0158)
- Container management actions (US0160-US0162)
- Docker Compose detection
- Rootless Docker detection
- Docker Swarm detection

---

## Technical Notes

### Agent Implementation

```python
# In agent/collectors.py
def detect_docker() -> bool:
    """Detect if Docker is installed and accessible."""
    try:
        result = subprocess.run(
            ['docker', '--version'],
            capture_output=True,
            timeout=5
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False

# In heartbeat payload
heartbeat = {
    # ... existing fields
    "docker_installed": detect_docker(),
}
```

### Backend Implementation

```python
# In backend/src/homelab_cmd/db/models/server.py
class Server(Base):
    # ... existing fields
    has_docker = Column(Boolean, default=False)

# In backend/src/homelab_cmd/api/schemas/heartbeat.py
class HeartbeatRequest(BaseModel):
    # ... existing fields
    docker_installed: Optional[bool] = None

# In backend/src/homelab_cmd/api/schemas/server.py
class ServerResponse(BaseModel):
    # ... existing fields
    has_docker: bool = False
```

### Database Migration

```python
# migrations/versions/xxx_add_has_docker_to_server.py
def upgrade():
    op.add_column('servers', sa.Column('has_docker', sa.Boolean(), nullable=False, server_default='0'))

def downgrade():
    op.drop_column('servers', 'has_docker')
```

### Frontend Implementation

```tsx
// In ServerCard.tsx - add Docker badge
{server.has_docker && (
  <span className="inline-flex items-center gap-1 text-xs text-blue-500" title="Docker installed">
    <Container className="w-3 h-3" />
  </span>
)}
```

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Docker not installed | `docker_installed: false`, no error logged |
| Docker installed but daemon not running | `docker --version` still succeeds, `docker_installed: true` |
| Docker command times out (>5s) | `docker_installed: false`, agent continues normally |
| Docker binary exists but not executable | `docker_installed: false` |
| Rootless Docker only | `docker_installed: true` if user can run `docker --version` |
| Docker installed after agent start | Detected on next heartbeat cycle |
| Docker removed after detection | Updated to `false` on next heartbeat |
| Agent running in Docker container | Detection still works for host Docker socket if mounted |
| Permission denied for docker command | `docker_installed: false` |
| Podman installed (docker alias) | May return `true` - acceptable for this story |

---

## Test Scenarios

- [x] Agent detects Docker when docker.io is installed
- [x] Agent detects Docker when Docker CE is installed
- [x] Agent returns false when Docker is not installed
- [x] Agent handles command timeout gracefully
- [x] Heartbeat includes docker_installed field
- [x] Server model has_docker field is created by migration
- [x] API returns has_docker in server response
- [x] Dashboard shows Docker badge for Docker-enabled servers
- [x] Dashboard hides Docker badge for non-Docker servers
- [x] Detection updates correctly when Docker is installed/removed
- [x] Agent doesn't crash when docker command fails

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| EP0013 | Prerequisite | SSH Executor (for future container commands) | Done |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| Agent heartbeat infrastructure | System | Available |
| Server model | Database | Available |
| ServerCard component | Frontend | Available |

---

## Estimation

**Story Points:** 3
**Complexity:** Low-Medium

| Component | Effort |
|-----------|--------|
| Agent detection function | Small |
| Heartbeat schema update | Small |
| Server model + migration | Small |
| API schema update | Small |
| Frontend badge | Small |
| Tests | Medium |

---

## Open Questions

None - requirements are clear from epic specification.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-02-01 | Claude | Initial story creation from EP0014 specification |
| 2026-02-01 | Claude | Implementation complete - all ACs verified |
