# PL0051: Service Discovery During Agent Installation - Implementation Plan

> **Status:** Complete
> **Story:** [US0069: Service Discovery During Agent Installation](../stories/US0069-service-discovery-during-install.md)
> **Epic:** [EP0003: Service Monitoring](../epics/EP0003-service-monitoring.md)
> **Created:** 2026-01-22
> **Language:** Python / TypeScript

## Overview

Add service discovery during agent installation to let users select running services from a list rather than typing them manually. Discovered services can be classified as Core (critical alerts) or Standard (warning alerts).

## Relationship with US0070 (GUID-Based Server Identity)

**These stories are INDEPENDENT.** While both involve agent installation, they operate at different lifecycle stages:

- **US0069 (this story):** Pre-install discovery via SSH - queries services on target system BEFORE agent exists
- **US0070:** Post-install identity - GUID is generated when agent starts AFTER installation

US0069 uses the target IP/hostname for SSH, which is appropriate since:
1. Discovery is a single-session operation (no persistence needed)
2. The target device doesn't have an agent yet (no GUID to query)
3. IP is known at discovery time from the modal context

**No GUID integration needed** - service discovery operates independently.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Service Discovery Endpoint | API returns list of running systemd services via SSH |
| AC2 | Service List in Install Modal | "Discover Services" button fetches available services |
| AC3 | Service Selection UI | Checkboxes to select/deselect services |
| AC4 | Service Classification | Mark services as Core or Standard |
| AC5 | Selected Services in Install Request | Agent config includes services with classification |

## Technical Context

### Language & Framework

- **Backend:** Python 3.11+ with FastAPI
- **Frontend:** TypeScript with React
- **Test Framework:** pytest (backend), Vitest (frontend)

### Relevant Best Practices

From `~/.claude/best-practices/python.md`:
- Type hints on all new functions
- Specific exception handling (SSHError, TimeoutError)
- Use Pydantic for request/response validation

From `~/.claude/best-practices/typescript.md`:
- Interface types for API responses
- Proper loading/error state handling

### Library Documentation (Context7)

Query Context7 for each library before implementation:

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| FastAPI | /tiangolo/fastapi | POST endpoint with Pydantic | Request body validation |
| Pydantic | /pydantic/pydantic | Optional fields, validators | Default values |

### Existing Patterns

**AgentInstallModal** (`frontend/src/components/devices/AgentInstallModal.tsx`):
- Already has hostname, SSH credentials in context
- Supports manual service list input
- Uses `agentApi.installAgent()` for installation

**SSH Service** (`backend/src/homelab_cmd/services/ssh.py`):
- `execute_command(hostname, command, timeout)` pattern
- Returns structured result with stdout/stderr

**Agent Config Generation** (`backend/src/homelab_cmd/services/agent_deploy.py`):
- Generates YAML config for agent
- Currently accepts `monitored_services` as string list

**ExpectedService Model** (`backend/src/homelab_cmd/db/models/expected_service.py`):
- Already has `is_critical` field for Core/Standard distinction
- Used by alert system to determine severity

## Recommended Approach

**Strategy:** Test-After (Hybrid)
**Rationale:** SSH command execution needs integration testing. Frontend changes need visual verification. Core logic (service parsing) will have unit tests.

### Test Priority

1. Service parsing from systemctl output (unit tests)
2. Discovery endpoint returns correct structure (integration tests)
3. Frontend displays services correctly (manual + E2E)
4. Agent config includes selected services (integration tests)

### Documentation Updates Required

- [ ] API docs - new POST `/api/v1/discovery/services` endpoint
- [ ] Agent config docs - `core_services` list addition

## Implementation Steps

### Phase 1: Backend Schemas

**Goal:** Define request/response schemas for service discovery

#### Step 1.1: Create Discovery Schemas

- [ ] Create ServiceDiscoveryRequest schema
- [ ] Create DiscoveredService schema
- [ ] Create ServiceDiscoveryResponse schema

**Files to create:**
- `backend/src/homelab_cmd/api/schemas/discovery.py`

**Code:**
```python
from pydantic import BaseModel, Field


class ServiceDiscoveryRequest(BaseModel):
    """Request to discover services on a remote host."""
    hostname: str = Field(..., description="Target hostname or IP")
    port: int = Field(22, ge=1, le=65535, description="SSH port")
    username: str = Field("root", description="SSH username")


class DiscoveredService(BaseModel):
    """A discovered systemd service."""
    name: str = Field(..., description="Service name without .service suffix")
    status: str = Field(..., description="Service status (active, inactive, etc)")
    description: str = Field("", description="Service description")


class ServiceDiscoveryResponse(BaseModel):
    """Response from service discovery."""
    services: list[DiscoveredService] = Field(default_factory=list)
    total: int = Field(..., description="Total services discovered")
    filtered: int = Field(0, description="Services filtered out (system services)")
```

### Phase 2: Backend Discovery Endpoint

**Goal:** Create API endpoint that discovers services via SSH

#### Step 2.1: Create Discovery Router

- [ ] Create new discovery router
- [ ] Implement POST /discovery/services endpoint
- [ ] Use SSH service to run systemctl command
- [ ] Parse output into DiscoveredService objects
- [ ] Filter system services by default

**Files to create:**
- `backend/src/homelab_cmd/api/routes/discovery.py`

**Code:**
```python
import re
from fastapi import APIRouter, HTTPException, Depends
from ..schemas.discovery import (
    ServiceDiscoveryRequest,
    ServiceDiscoveryResponse,
    DiscoveredService,
)
from ...services.ssh import SSHService, get_ssh_service

router = APIRouter(prefix="/discovery", tags=["discovery"])

# System services to filter out by default
SYSTEM_SERVICE_PATTERNS = [
    r"^systemd-",
    r"^dbus",
    r"^getty@",
    r"^ssh\.service$",
    r"^user@",
    r"^polkit",
    r"^ModemManager",
    r"^NetworkManager",
    r"^accounts-daemon",
    r"^udisks",
    r"^upower",
    r"^avahi",
    r"^colord",
    r"^packagekit",
    r"^rsyslog",
    r"^cron",
]


def is_system_service(name: str) -> bool:
    """Check if service is a system service that should be filtered."""
    for pattern in SYSTEM_SERVICE_PATTERNS:
        if re.match(pattern, name, re.IGNORECASE):
            return True
    return False


@router.post("/services", response_model=ServiceDiscoveryResponse)
async def discover_services(
    request: ServiceDiscoveryRequest,
    include_system: bool = False,
    ssh_service: SSHService = Depends(get_ssh_service),
) -> ServiceDiscoveryResponse:
    """Discover running systemd services on a remote host."""
    # Command to list running services with descriptions
    command = (
        "systemctl list-units --type=service --state=running "
        "--no-legend --no-pager --plain | "
        "while read -r unit load active sub desc; do "
        'echo "$unit|$sub|$desc"; '
        "done"
    )

    try:
        result = await ssh_service.execute_command(
            hostname=request.hostname,
            port=request.port,
            username=request.username,
            command=command,
            timeout=30,
        )
    except TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="Service discovery timed out after 30 seconds"
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"SSH connection failed: {str(e)}"
        )

    if not result.success:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to list services: {result.stderr}"
        )

    services = []
    filtered_count = 0

    for line in result.stdout.strip().split("\n"):
        if not line or "|" not in line:
            continue

        parts = line.split("|", 2)
        if len(parts) < 2:
            continue

        # Remove .service suffix from unit name
        name = parts[0].replace(".service", "").strip()
        status = parts[1].strip()
        description = parts[2].strip() if len(parts) > 2 else ""

        # Filter system services unless requested
        if not include_system and is_system_service(name):
            filtered_count += 1
            continue

        services.append(DiscoveredService(
            name=name,
            status=status,
            description=description,
        ))

    # Sort by name for consistent display
    services.sort(key=lambda s: s.name.lower())

    return ServiceDiscoveryResponse(
        services=services,
        total=len(services),
        filtered=filtered_count,
    )
```

#### Step 2.2: Register Discovery Router

- [ ] Add discovery router to main API router

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/__init__.py` or main router file

**Code addition:**
```python
from .discovery import router as discovery_router

api_router.include_router(discovery_router)
```

### Phase 3: Backend Install Request Changes

**Goal:** Accept service classification in agent install request

#### Step 3.1: Update Agent Install Schema

- [ ] Add service_config to install request
- [ ] Support both simple list and classified services

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/agent.py` (or equivalent)

**Code changes:**
```python
class ServiceConfig(BaseModel):
    """Service configuration for monitoring."""
    name: str
    core: bool = False  # True = critical alerts, False = warning alerts


class AgentInstallRequest(BaseModel):
    # ... existing fields ...
    monitored_services: list[str] = Field(default_factory=list)  # Keep for backward compat
    service_config: list[ServiceConfig] | None = None  # New structured format
```

#### Step 3.2: Update Agent Config Generation

- [ ] Generate config with core_services list
- [ ] Extract core services from service_config

**Files to modify:**
- `backend/src/homelab_cmd/services/agent_deploy.py`

**Code changes:**
```python
def generate_agent_config(
    server_id: str,
    hub_url: str,
    api_key: str,
    monitored_services: list[str],
    service_config: list[ServiceConfig] | None = None,
) -> str:
    """Generate agent configuration YAML."""
    # Determine services and core classification
    all_services = monitored_services.copy()
    core_services = []

    if service_config:
        for svc in service_config:
            if svc.name not in all_services:
                all_services.append(svc.name)
            if svc.core:
                core_services.append(svc.name)

    config = {
        "server_id": server_id,
        "hub_url": hub_url,
        "api_key": api_key,
        "monitored_services": all_services,
    }

    # Only add core_services if any are designated
    if core_services:
        config["core_services"] = core_services

    return yaml.dump(config, default_flow_style=False)
```

### Phase 4: Frontend API Client

**Goal:** Add TypeScript functions for service discovery

#### Step 4.1: Add Discovery Types

- [ ] Create TypeScript interfaces for discovery

**Files to modify:**
- `frontend/src/types/index.ts` or `frontend/src/api/types.ts`

**Code:**
```typescript
export interface DiscoveredService {
  name: string;
  status: string;
  description: string;
}

export interface ServiceDiscoveryResponse {
  services: DiscoveredService[];
  total: number;
  filtered: number;
}

export interface ServiceConfig {
  name: string;
  core: boolean;
}
```

#### Step 4.2: Add Discovery API Function

- [ ] Create discoverServices function

**Files to modify:**
- `frontend/src/api/agents.ts` or `frontend/src/api/discovery.ts`

**Code:**
```typescript
export async function discoverServices(
  hostname: string,
  port: number = 22,
  username: string = 'root',
  includeSystem: boolean = false
): Promise<ServiceDiscoveryResponse> {
  const response = await fetch(
    `/api/v1/discovery/services?include_system=${includeSystem}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostname, port, username }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Service discovery failed');
  }

  return response.json();
}
```

### Phase 5: Frontend UI Changes

**Goal:** Add service discovery UI to AgentInstallModal

#### Step 5.1: Add Discovery State

- [ ] Add state for discovered services
- [ ] Add state for selected services with classification
- [ ] Add loading/error states

**Files to modify:**
- `frontend/src/components/devices/AgentInstallModal.tsx`

**State additions:**
```typescript
const [discoveredServices, setDiscoveredServices] = useState<DiscoveredService[]>([]);
const [selectedServices, setSelectedServices] = useState<Map<string, boolean>>(new Map());
// Map<serviceName, isCore>
const [isDiscovering, setIsDiscovering] = useState(false);
const [discoveryError, setDiscoveryError] = useState<string | null>(null);
const [showSystemServices, setShowSystemServices] = useState(false);
```

#### Step 5.2: Add Discovery Button and Handler

- [ ] Add "Discover Services" button
- [ ] Implement discovery click handler
- [ ] Show loading spinner during discovery

**UI component:**
```tsx
<Button
  onClick={handleDiscoverServices}
  disabled={isDiscovering || !sshSuccess}
  loading={isDiscovering}
>
  {isDiscovering ? 'Discovering...' : 'Discover Services'}
</Button>
```

**Handler:**
```typescript
const handleDiscoverServices = async () => {
  setIsDiscovering(true);
  setDiscoveryError(null);

  try {
    const response = await discoverServices(
      hostname,
      sshPort,
      sshUsername,
      showSystemServices
    );
    setDiscoveredServices(response.services);
  } catch (error) {
    setDiscoveryError(error instanceof Error ? error.message : 'Discovery failed');
  } finally {
    setIsDiscovering(false);
  }
};
```

#### Step 5.3: Add Service List with Checkboxes

- [ ] Render scrollable list of discovered services
- [ ] Each service has checkbox and Core/Standard toggle
- [ ] Show selected count summary

**UI component:**
```tsx
{discoveredServices.length > 0 && (
  <div className="service-list">
    <div className="service-list-header">
      <span>
        {selectedServices.size} services selected
        ({[...selectedServices.values()].filter(Boolean).length} core)
      </span>
      <label>
        <input
          type="checkbox"
          checked={showSystemServices}
          onChange={(e) => setShowSystemServices(e.target.checked)}
        />
        Show system services
      </label>
    </div>
    <div className="service-list-scroll">
      {discoveredServices.map((service) => (
        <ServiceRow
          key={service.name}
          service={service}
          selected={selectedServices.has(service.name)}
          isCore={selectedServices.get(service.name) ?? false}
          onToggleSelect={() => handleToggleService(service.name)}
          onToggleCore={() => handleToggleCore(service.name)}
        />
      ))}
    </div>
  </div>
)}
```

#### Step 5.4: Update Install Request

- [ ] Include service_config in install request
- [ ] Merge discovered selections with manual input

**Code:**
```typescript
const handleInstall = async () => {
  const serviceConfig: ServiceConfig[] = [];

  // Add discovered and selected services
  for (const [name, isCore] of selectedServices) {
    serviceConfig.push({ name, core: isCore });
  }

  // Add manually entered services (as standard by default)
  if (manualServices) {
    for (const name of manualServices.split(',').map(s => s.trim())) {
      if (name && !selectedServices.has(name)) {
        serviceConfig.push({ name, core: false });
      }
    }
  }

  await agentApi.installAgent({
    // ... existing fields ...
    service_config: serviceConfig,
  });
};
```

### Phase 6: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 6.1: Unit Tests - Service Parsing

- [ ] Test systemctl output parsing
- [ ] Test system service filtering
- [ ] Test empty output handling

**Files to create:**
- `backend/tests/api/test_discovery.py`

**Test cases:**
```python
def test_parse_systemctl_output():
    """Test parsing of systemctl list-units output."""
    output = "nginx.service|running|A high performance web server\n"
    # ... parsing logic test

def test_filter_system_services():
    """Test that system services are filtered by default."""
    assert is_system_service("systemd-logind") is True
    assert is_system_service("nginx") is False
    assert is_system_service("plex") is False

def test_empty_output_returns_empty_list():
    """Test handling of no running services."""
    # ... test
```

#### Step 6.2: Integration Tests - Discovery Endpoint

- [ ] Test discovery with mocked SSH
- [ ] Test timeout handling
- [ ] Test SSH failure handling

#### Step 6.3: Frontend Tests

- [ ] Test service selection state management
- [ ] Test Core/Standard toggle
- [ ] Test service count display

#### Step 6.4: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Integration test: endpoint returns services | Pending |
| AC2 | Manual test: button appears in modal | Pending |
| AC3 | Manual test: checkboxes work | Pending |
| AC4 | Manual test: Core/Standard toggle | Pending |
| AC5 | Integration test: config includes services | Pending |

## Edge Case Handling Plan

Every edge case from the Story MUST appear here with an explicit handling strategy.

### Edge Case Coverage

| # | Edge Case (from Story) | Handling Strategy | Implementation Phase | Validated |
|---|------------------------|-------------------|---------------------|-----------|
| 1 | SSH connection fails during discovery | Catch exception, return 502 with message, UI shows error with retry option | Phase 2 | [ ] |
| 2 | No services running | Return empty list with total=0, UI shows "No running services found" | Phase 2, 5 | [ ] |
| 3 | Too many services (>50) | Scrollable list handles any count, filtering reduces volume | Phase 5 | [ ] |
| 4 | Service name contains special characters | YAML safe_dump handles escaping, frontend escapes for display | Phase 3 | [ ] |
| 5 | Discovery timeout | 30s timeout in SSH call, return 504, UI shows timeout message with retry | Phase 2 | [ ] |
| 6 | User selects no services | Allow empty service_config, install proceeds without monitoring | Phase 5 | [ ] |

### Coverage Summary

- Story edge cases: 6
- Handled in plan: 6
- Unhandled: 0

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| SSH command format varies by distro | Medium | Test on Debian/Ubuntu (primary targets); document requirements |
| Large service list overwhelms UI | Low | Scrollable list, system service filtering |
| Cached services become stale | Low | Cache per modal session only, clear on close |
| Service names with spaces break parsing | Low | Pipe-delimited output format handles spaces in descriptions |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| SSH service | Runtime | Uses existing SSHService |
| systemd on target | Runtime | Required for systemctl command |
| React UI patterns | Design | Follow existing modal patterns |

## Open Questions

None - all questions resolved in story US0069.

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Manual verification: discovery returns services
- [ ] Manual verification: selection works in modal
- [ ] Manual verification: services appear in agent config

## Notes

**Session Cache Implementation:**
The frontend should cache discovered services in component state. Cache is automatically cleared when modal closes (component unmounts). No explicit cache management needed.

**Core Services in Agent:**
The agent config will have two lists:
- `monitored_services`: All services to monitor
- `core_services`: Subset of monitored_services that are critical

The agent heartbeat already reports service status. The hub's alert system uses `ExpectedService.is_critical` to determine alert severity. This story adds the UI to configure that classification during install.
