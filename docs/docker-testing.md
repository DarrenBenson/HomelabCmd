# Docker Testing Guide

This guide explains how to use Docker Compose to run a complete HomelabCmd test environment with simulated agent containers.

## Overview

The Docker test environment provides:

- **Backend**: FastAPI server with SQLite database
- **Frontend**: React dashboard served via nginx
- **Test Agents**: Python containers simulating monitored servers

This allows testing the full agent-to-dashboard flow without deploying to real servers.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose v2.0+
- 2GB available RAM
- Ports 8081 available (configurable)

## Quick Start

```bash
# Clone and navigate to project
cd HomelabCmd

# Build and start all services
docker compose up -d

# Open dashboard in browser
open http://localhost:8081

# View logs
docker compose logs -f
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Docker Compose Network                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Test Agents (send heartbeats every 30s)                           │
│   ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐      │
│   │ agent-media     │ │ agent-pihole1   │ │ agent-proxmox   │      │
│   │ server          │ │                 │ │                 │      │
│   │ (omv-media      │ │ (pihole-        │ │ (proxmox-       │      │
│   │  server)        │ │  primary)       │ │  host)          │      │
│   └────────┬────────┘ └────────┬────────┘ └────────┬────────┘      │
│            │                   │                    │               │
│            └───────────────────┼────────────────────┘               │
│                                │                                     │
│                    POST /api/v1/agents/heartbeat                    │
│                                │                                     │
│                                ▼                                     │
│                    ┌─────────────────────┐                          │
│                    │      backend        │                          │
│                    │   homelab-cmd-      │                          │
│                    │     backend         │                          │
│                    │   (FastAPI :8080)   │                          │
│                    └──────────┬──────────┘                          │
│                               │                                      │
│                    ┌──────────┴──────────┐                          │
│                    │                     │                          │
│                    ▼                     ▼                          │
│           ┌──────────────┐     ┌──────────────────┐                │
│           │  SQLite DB   │     │     frontend     │                │
│           │ ./data/      │     │  homelab-cmd-    │                │
│           │ homelab.db   │     │    frontend      │                │
│           └──────────────┘     │  (nginx :80)     │                │
│                                └────────┬─────────┘                │
│                                         │                          │
└─────────────────────────────────────────┼──────────────────────────┘
                                          │
                                          ▼
                                   localhost:8081
                                   (Dashboard)
```

## Services Reference

| Service | Container | Internal Port | External Port | Purpose |
|---------|-----------|---------------|---------------|---------|
| backend | homelab-cmd-backend | 8080 | - | FastAPI server |
| frontend | homelab-cmd-frontend | 80 | 8081 | nginx + React SPA |
| agent-mediaserver | homelab-agent-mediaserver | - | - | Test agent |
| agent-pihole1 | homelab-agent-pihole1 | - | - | Test agent |
| agent-proxmox | homelab-agent-proxmox | - | - | Test agent |

## Common Operations

### Starting the Environment

```bash
# Start all services (builds images if needed)
docker compose up -d

# Start only backend and frontend (no agents)
docker compose up -d backend frontend

# Start with live logs
docker compose up
```

### Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f agent-mediaserver

# Last 50 lines
docker compose logs --tail 50 backend
```

### Checking Status

```bash
# Container status
docker compose ps

# Health checks
docker inspect homelab-cmd-backend --format='{{.State.Health.Status}}'

# API health
curl http://localhost:8081/api/v1/system/health
```

### Stopping and Cleanup

```bash
# Stop containers (preserves data)
docker compose down

# Stop and remove volumes (resets database)
docker compose down -v

# Remove all images too
docker compose down --rmi all
```

## Testing Scenarios

### 1. Agent Registration

**Test:** New agents auto-register with the hub.

```bash
# Check current servers
curl -s -H "X-API-Key: dev-key-change-me" \
  http://localhost:8081/api/v1/servers | jq '.total'

# Start a new agent
docker compose up -d agent-mediaserver

# Wait a few seconds, check again
curl -s -H "X-API-Key: dev-key-change-me" \
  http://localhost:8081/api/v1/servers | jq '.servers[].id'
```

**Expected:** Server ID appears in the list with status "online".

### 2. Metrics Collection

**Test:** Agents send CPU, RAM, and disk metrics.

```bash
# Get server details
curl -s -H "X-API-Key: dev-key-change-me" \
  http://localhost:8081/api/v1/servers/omv-mediaserver | jq
```

**Expected:** Response includes `latest_metrics` with `cpu_percent`, `memory_percent`, `disk_percent`.

### 3. Offline Detection

**Test:** Hub detects when a server goes offline.

```bash
# Stop an agent
docker compose stop agent-pihole1

# Wait for offline threshold (default 5 minutes, or trigger manually)
# Check status
curl -s -H "X-API-Key: dev-key-change-me" \
  http://localhost:8081/api/v1/servers/pihole-primary | jq '.status'
```

**Expected:** Status changes to "offline" after threshold.

### 4. Recovery

**Test:** Server returns to online after agent restart.

```bash
# Restart the agent
docker compose start agent-pihole1

# Check status (within 30s)
curl -s -H "X-API-Key: dev-key-change-me" \
  http://localhost:8081/api/v1/servers/pihole-primary | jq '.status'
```

**Expected:** Status returns to "online".

### 5. Authentication

**Test:** API rejects requests without valid API key.

```bash
# No key
curl -s http://localhost:8081/api/v1/servers

# Wrong key
curl -s -H "X-API-Key: wrong-key" http://localhost:8081/api/v1/servers
```

**Expected:** 401 Unauthorized response.

### 6. Dashboard Display

**Test:** Frontend displays all registered servers.

1. Open http://localhost:8081
2. Verify all 3 test servers appear as cards
3. Check status LEDs (green pulsing = online)
4. Verify metrics display (CPU, RAM, Disk percentages)

## Automated E2E Testing with Playwright

The frontend includes Playwright tests that automate UI testing against the Docker environment.

### Prerequisites

```bash
# Install Playwright browsers (first time only)
cd frontend
npx playwright install
```

### Running E2E Tests

```bash
# Ensure Docker environment is running
docker compose up -d

# Run all E2E tests (headless)
cd frontend
npm run test:e2e

# Run with visible browser
npm run test:e2e:headed

# Run with Playwright UI (interactive mode)
npm run test:e2e:ui

# View HTML test report
npm run test:e2e:report
```

### Test Coverage

The E2E tests verify:

| Test | Description |
|------|-------------|
| Page title | Verifies "HomelabCmd" title |
| Header display | App name visible in header |
| Server cards | Cards render for registered agents |
| Status LEDs | Online/offline indicators display |
| Hostname display | Server names shown on cards |
| Metrics display | CPU/RAM/Disk values visible |
| Server count | Header shows total server count |
| Mobile responsiveness | Layout works on mobile viewports |
| Error handling | Error state shown when API fails |
| Retry functionality | Retry button appears on error |

### Running Specific Tests

```bash
# Run only dashboard tests
npm run test:e2e -- dashboard.spec.ts

# Run tests matching pattern
npm run test:e2e -- -g "server cards"

# Run in specific browser
npm run test:e2e -- --project=firefox
```

### CI Integration

For CI/CD pipelines:

```yaml
# Example GitHub Actions step
- name: Run E2E Tests
  run: |
    docker compose up -d
    sleep 10  # Wait for services
    cd frontend
    npx playwright install --with-deps
    npm run test:e2e
```

### Debugging Failed Tests

```bash
# Run with trace recording
npm run test:e2e -- --trace on

# Debug specific test
npm run test:e2e -- --debug dashboard.spec.ts

# Generate screenshots on every test
npm run test:e2e -- --screenshot on
```

Test reports are saved to `frontend/playwright-report/`.

## Adding Custom Test Agents

To simulate additional servers, add entries to `docker-compose.yml`:

```yaml
services:
  # ... existing services ...

  agent-custom:
    build:
      context: ./agent
      dockerfile: Dockerfile
    container_name: homelab-agent-custom
    hostname: my-custom-server
    environment:
      - HOMELAB_AGENT_HUB_URL=http://backend:8080
      - HOMELAB_AGENT_API_KEY=${HOMELAB_CMD_API_KEY:-dev-key-change-me}
      - HOMELAB_AGENT_SERVER_ID=my-custom-server
      - HOMELAB_AGENT_HEARTBEAT_INTERVAL=30
    depends_on:
      backend:
        condition: service_healthy
    restart: unless-stopped
```

Then rebuild:

```bash
docker compose up -d --build agent-custom
```

## Environment Variables

### Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `HOMELAB_CMD_API_KEY` | `dev-key-change-me` | API authentication key |
| `HOMELAB_CMD_DEBUG` | `false` | Enable debug logging |
| `HOMELAB_CMD_DATABASE_URL` | SQLite path | Database connection string |

### Agent

| Variable | Default | Description |
|----------|---------|-------------|
| `HOMELAB_AGENT_HUB_URL` | - | Backend URL (required) |
| `HOMELAB_AGENT_API_KEY` | - | API key (required) |
| `HOMELAB_AGENT_SERVER_ID` | hostname | Unique server identifier |
| `HOMELAB_AGENT_HEARTBEAT_INTERVAL` | `60` | Seconds between heartbeats |

## Troubleshooting

### Backend Won't Start

**Symptom:** `homelab-cmd-backend` exits immediately.

**Check:**
```bash
docker compose logs backend
```

**Common causes:**
- Database permission error: Delete `./data/` and restart
- Port conflict: Check if 8080 is in use internally

### Agents Not Registering

**Symptom:** Agents run but don't appear in API.

**Check:**
```bash
docker compose logs agent-mediaserver | grep -i error
```

**Common causes:**
- Backend not healthy yet: Wait for health check to pass
- Wrong API key: Verify `HOMELAB_AGENT_API_KEY` matches `HOMELAB_CMD_API_KEY`
- Network issue: Ensure containers are on same Docker network

### Frontend Shows "API Error"

**Symptom:** Dashboard displays error instead of servers.

**Check:**
```bash
# Verify backend is reachable from frontend
docker compose exec frontend wget -qO- http://backend:8080/api/v1/system/health
```

**Common causes:**
- Backend container not running
- nginx proxy misconfigured

### Resetting Everything

To start fresh:

```bash
# Stop all containers
docker compose down

# Remove database
rm -rf ./data

# Rebuild all images
docker compose build --no-cache

# Start fresh
docker compose up -d
```

## Performance Notes

- Each agent container uses approximately 50MB RAM
- Heartbeat interval of 30s provides responsive testing
- SQLite file is created in `./data/` and persists across restarts
- For load testing, increase agents but monitor host resources

## Related Documentation

- [Test Strategy](../sdlc-studio/testing/strategy.md) - Overall testing approach
- [Agent README](../agent/README.md) - Agent deployment guide
- [API Documentation](http://localhost:8081/api/docs) - OpenAPI spec (when running)
