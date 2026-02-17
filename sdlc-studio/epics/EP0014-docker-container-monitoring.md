# EP0014: Docker Container Monitoring

> **Status:** Done
> **Owner:** Darren
> **Created:** 2026-01-26
> **Target Release:** Phase 2 (Beta)
> **Story Points:** 24

---

## Overview

Add basic Docker container monitoring to HomelabCmd. Detect Docker installation on machines, list running and stopped containers, show container status in a dedicated widget, and provide quick actions to start/stop/restart containers via SSH.

**Key Concept:** Simple container visibility. Not full Docker orchestration - just enough to see what's running and control it.

---

## Goals

### Primary Goals
- Detect Docker installation on machines
- List containers with status (running, stopped, exited)
- Display containers in detail page widget
- Provide quick actions (start, stop, restart)
- Track container uptime

### Success Criteria
- Docker machines show container widget automatically
- Container list updates every 60 seconds
- Container actions execute in <5 seconds
- Container status reflected immediately after action
- Non-Docker machines don't show container features

---

## User Stories

### US0157: Docker Detection
**Story Points:** 3
**Priority:** P0
**Dependencies:** EP0013 (SSH Executor)

**As a** system administrator
**I want** HomelabCmd to detect if Docker is installed
**So that** Docker features are only shown for Docker hosts

**Acceptance Criteria:**
- [x] Agent heartbeat includes `docker_installed` boolean
- [x] Detection via `which docker` or `docker --version`
- [x] Machine model has `has_docker` field
- [x] Field updated on each heartbeat
- [x] API includes `has_docker` in machine response
- [x] Dashboard card shows Docker icon if Docker installed
- [x] Detection works for both docker.io and Docker CE

**Technical Notes:**
- Agent detection:
  ```python
  def detect_docker():
      try:
          result = subprocess.run(['docker', '--version'], capture_output=True, timeout=5)
          return result.returncode == 0
      except (FileNotFoundError, subprocess.TimeoutExpired):
          return False

  heartbeat = {
      # ... existing fields
      "docker_installed": detect_docker(),
  }
  ```

- Machine model update:
  ```python
  class Machine(Base):
      # ... existing fields
      has_docker = Column(Boolean, default=False)
  ```

---

### US0158: Container Listing via SSH
**Story Points:** 5
**Priority:** P0
**Dependencies:** US0157, EP0013 (SSH Executor)

**As a** system administrator
**I want** to see all Docker containers on a machine
**So that** I know what's running

**Acceptance Criteria:**
- [x] API endpoint: `GET /api/v1/machines/{id}/containers`
- [x] Retrieves container list via SSH
- [x] Returns: container ID, name, image, status, uptime, ports
- [x] Includes both running and stopped containers
- [x] Sorted by status (running first) then name
- [x] Cached for 60 seconds (avoid excessive SSH calls)
- [x] Returns empty array if Docker not installed

**Technical Notes:**
- SSH command to list containers:
  ```bash
  docker ps -a --format '{{json .}}'
  ```

- Parsing response:
  ```python
  async def list_containers(machine_id: UUID) -> List[Container]:
      result = await ssh_executor.execute(
          machine_id,
          "docker ps -a --format '{{json .}}'"
      )

      containers = []
      for line in result.stdout.strip().split('\n'):
          if line:
              data = json.loads(line)
              containers.append(Container(
                  id=data['ID'],
                  name=data['Names'],
                  image=data['Image'],
                  status=data['Status'],
                  state=data['State'],  # running, exited, created
                  ports=data['Ports'],
                  created=data['CreatedAt'],
              ))
      return containers
  ```

- Response format:
  ```json
  {
    "machine_id": "mediaserver",
    "containers": [
      {
        "id": "abc123",
        "name": "plex",
        "image": "plexinc/pms-docker:latest",
        "state": "running",
        "status": "Up 12 days",
        "ports": "32400/tcp",
        "uptime_seconds": 1036800
      },
      {
        "id": "def456",
        "name": "radarr",
        "image": "linuxserver/radarr:latest",
        "state": "exited",
        "status": "Exited (0) 2 hours ago",
        "ports": "",
        "uptime_seconds": 0
      }
    ]
  }
  ```

---

### US0159: Container Widget
**Story Points:** 5
**Priority:** P0
**Dependencies:** US0158, EP0012 (Widget System)

**As a** system administrator
**I want** a containers widget on the detail page
**So that** I can see container status at a glance

**Acceptance Criteria:**
- [x] Widget ID: `containers`
- [x] Only displayed for machines with `has_docker=true`
- [x] Lists all containers with status indicator
- [x] Running: green dot, Stopped/Exited: grey dot, Error: red dot
- [x] Shows container name, image (truncated), status text
- [x] Uptime shown for running containers
- [x] Refreshes every 60 seconds
- [x] Clickable row expands to show ports, full image name
- [x] Minimum widget size: 6x4

**Technical Notes:**
- Widget component:
  ```tsx
  function ContainersWidget({ machine }) {
    const { data: containers, isLoading } = useQuery(
      ['containers', machine.id],
      () => fetchContainers(machine.id),
      { refetchInterval: 60000 }
    );

    if (!machine.has_docker) return null;

    return (
      <Widget title="Docker Containers" icon={<ContainerIcon />}>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th>Status</th>
                <th>Name</th>
                <th>Image</th>
                <th>Uptime</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {containers.map(c => (
                <ContainerRow key={c.id} container={c} machineId={machine.id} />
              ))}
            </tbody>
          </table>
        )}
      </Widget>
    );
  }
  ```

**Widget UI:**
```
┌────────────────────────────────────────────────────────────┐
│ 🐳 Docker Containers                          [Refresh]    │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ Status │ Name       │ Image                │ Uptime        │
│ ───────┼────────────┼──────────────────────┼───────────────│
│  🟢    │ plex       │ plexinc/pms-docker   │ 12 days       │ [⏹️]
│  🟢    │ sonarr     │ linuxserver/sonarr   │ 12 days       │ [⏹️]
│  🟢    │ radarr     │ linuxserver/radarr   │ 12 days       │ [⏹️]
│  ⚪    │ jackett    │ linuxserver/jackett  │ Stopped       │ [▶️]
│  🔴    │ prowlarr   │ linuxserver/prowlarr │ Exited (137)  │ [▶️]
│                                                            │
│ 4 running, 2 stopped                                       │
└────────────────────────────────────────────────────────────┘
```

---

### US0160: Container Start Action
**Story Points:** 3
**Priority:** P0
**Dependencies:** US0158

**As a** system administrator
**I want** to start a stopped container
**So that** I can bring services back online

**Acceptance Criteria:**
- [x] API endpoint: `POST /api/v1/machines/{id}/containers/{container_id}/start`
- [x] Executes `docker start {container_name}` via SSH
- [x] Returns success/failure with docker output
- [x] Container list refreshed after action
- [x] Button disabled while action in progress
- [x] Toast notification on success/failure
- [x] Audit log entry created

**Technical Notes:**
- API implementation:
  ```python
  @router.post("/machines/{machine_id}/containers/{container_id}/start")
  async def start_container(machine_id: str, container_id: str):
      result = await ssh_executor.execute(
          machine_id,
          f"docker start {container_id}"
      )

      await create_audit_log(
          machine_id=machine_id,
          command=f"docker start {container_id}",
          exit_code=result.exit_code,
          executed_by="dashboard"
      )

      return {
          "success": result.exit_code == 0,
          "output": result.stdout or result.stderr
      }
  ```

---

### US0161: Container Stop Action
**Story Points:** 3
**Priority:** P0
**Dependencies:** US0158

**As a** system administrator
**I want** to stop a running container
**So that** I can gracefully shut down services

**Acceptance Criteria:**
- [x] API endpoint: `POST /api/v1/machines/{id}/containers/{container_id}/stop`
- [x] Executes `docker stop {container_name}` via SSH
- [x] Default timeout: 10 seconds (graceful shutdown)
- [x] Returns success/failure with docker output
- [x] Container list refreshed after action
- [x] Confirmation dialog before stopping
- [x] Audit log entry created

---

### US0162: Container Restart Action
**Story Points:** 2
**Priority:** P1
**Dependencies:** US0160, US0161

**As a** system administrator
**I want** to restart a container
**So that** I can quickly recover from issues

**Acceptance Criteria:**
- [x] API endpoint: `POST /api/v1/machines/{id}/containers/{container_id}/restart`
- [x] Executes `docker restart {container_name}` via SSH
- [x] Returns success/failure with docker output
- [x] Container list refreshed after action
- [x] Audit log entry created

---

### US0163: Container Service Status in Heartbeat
**Story Points:** 3
**Priority:** P1
**Dependencies:** US0157

**As a** system administrator
**I want** the agent to report basic Docker status in heartbeat
**So that** I don't need SSH for summary info

**Acceptance Criteria:**
- [x] Heartbeat includes `docker_status` object
- [x] Reports: running_containers, stopped_containers, total_containers
- [x] Only included if Docker installed
- [x] Low overhead (single `docker ps` command)
- [x] Machine model stores latest docker status
- [x] Dashboard card shows container count badge

**Technical Notes:**
- Agent heartbeat addition:
  ```python
  def get_docker_status():
      if not detect_docker():
          return None

      result = subprocess.run(
          ['docker', 'ps', '-a', '--format', '{{.State}}'],
          capture_output=True,
          timeout=10
      )

      states = result.stdout.decode().strip().split('\n')
      running = sum(1 for s in states if s == 'running')
      stopped = len(states) - running

      return {
          "running": running,
          "stopped": stopped,
          "total": len(states)
      }

  heartbeat = {
      # ... existing fields
      "docker_status": get_docker_status(),
  }
  ```

- Dashboard card badge:
  ```
  ┌─────────────────────────────────────┐
  │ 🟢 MEDIASERVER             🐳 8/10  │  ← 8 running, 10 total containers
  │    CPU: 15%  RAM: 45%  Disk: 67%   │
  └─────────────────────────────────────┘
  ```

---

## Technical Architecture

### API Endpoints

```
GET    /api/v1/machines/{id}/containers                      # List containers
POST   /api/v1/machines/{id}/containers/{container_id}/start   # Start container
POST   /api/v1/machines/{id}/containers/{container_id}/stop    # Stop container
POST   /api/v1/machines/{id}/containers/{container_id}/restart # Restart container
```

### Machine Model Update

```python
class Machine(Base):
    # ... existing fields
    has_docker = Column(Boolean, default=False)
    docker_status = Column(JSON, nullable=True)  # {running: 8, stopped: 2, total: 10}
```

### Container Response Schema

```python
class Container(BaseModel):
    id: str
    name: str
    image: str
    state: Literal["running", "exited", "created", "paused"]
    status: str  # Human-readable status from docker
    ports: Optional[str]
    uptime_seconds: Optional[int]

class ContainerListResponse(BaseModel):
    machine_id: str
    containers: List[Container]
    fetched_at: datetime
```

---

## Dependencies

**Backend:**
- No new libraries (uses existing asyncssh)

**Frontend:**
- No new libraries

**Agent:**
- Docker CLI must be accessible to agent user

---

## Testing Strategy

### Unit Tests
- Docker detection logic
- Container list parsing
- Container action command generation

### Integration Tests
- Container list API with mocked SSH
- Container actions with mocked SSH
- Docker status in heartbeat

### E2E Tests
- Navigate to Docker machine → see container widget
- Start stopped container → verify status changes
- Stop running container → verify confirmation and status change
- Non-Docker machine → no container widget

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| SSH timeout on container action | Low | Medium | Timeout handling, retry option |
| Docker command format changes | Low | Low | Parse JSON output, not text |
| Container name vs ID confusion | Medium | Low | Use container name for actions |
| Permissions for docker commands | Low | High | Document homelabcmd user setup |

---

## Story Breakdown

| Story | Description | Points | Priority |
|-------|-------------|--------|----------|
| US0157 | Docker Detection | 3 | P0 |
| US0158 | Container Listing via SSH | 5 | P0 |
| US0159 | Container Widget | 5 | P0 |
| US0160 | Container Start Action | 3 | P0 |
| US0161 | Container Stop Action | 3 | P0 |
| US0162 | Container Restart Action | 2 | P1 |
| US0163 | Container Service Status in Heartbeat | 3 | P1 |
| **Total** | | **24** | |

---

**Created:** 2026-01-26
**Last Updated:** 2026-02-01
**Epic Owner:** Darren

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-26 | Darren | Initial epic creation |
| 2026-01-28 | Claude | Renumbered stories US0123-US0129 to US0157-US0163 to resolve conflict with EP0010 |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Standardised header format, added Story Points |
| 2026-02-01 | Claude | All 7 stories implemented (US0157-US0163), epic marked Done |
