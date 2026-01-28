# AGENTS.md

Instructions for AI coding agents working with the HomelabCmd project.

## Project Overview

Self-hosted homelab monitoring and management platform with FastAPI backend, React SPA frontend, and Python monitoring agents. Supports real-time server status tracking, automated remediation workflows, cost monitoring based on TDP values, ad-hoc network scanning, and Slack notifications.

## Commands

### Docker (Recommended)

```bash
# Start entire application (backend, frontend, test agents)
docker compose up -d

# Rebuild after code changes
docker compose up -d --build

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Stop and remove containers
docker compose down -v
```

Application runs at:
- Frontend: http://localhost:8081
- Backend API: http://localhost:8080
- API Documentation: http://localhost:8080/api/docs

### Local Development

**Backend:**
```bash
# Setup virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -e ".[dev]"

# Set API key (or use default dev key)
export HOMELAB_CMD_API_KEY="your-secure-api-key"

# Run the application
homelab-cmd

# Or run directly with uvicorn
uvicorn homelab_cmd.main:app --reload --host 0.0.0.0 --port 8080
```

**Frontend:**
```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

Frontend: http://localhost:5173, Backend: http://localhost:8080

**Agent (for testing):**
```bash
cd agent
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Configure environment variables
export HOMELAB_AGENT_HUB_URL=http://localhost:8080
export HOMELAB_AGENT_API_KEY=dev-key-change-me
export HOMELAB_AGENT_SERVER_ID=test-server
export HOMELAB_AGENT_SERVER_GUID=$(uuidgen)

# Run agent
python agent.py
```

### Testing

**Backend tests (pytest with coverage):**

This project uses `coverage.py` directly, NOT the `pytest-cov` plugin.

```bash
source .venv/bin/activate

# Run tests with coverage
coverage run -m pytest -q && coverage report

# Run specific test file
pytest backend/tests/test_api_servers.py -v

# Run tests by name pattern
pytest backend/tests/ -k "test_heartbeat" -v

# Generate HTML coverage report
coverage html
```

**Frontend unit tests (Vitest):**
```bash
cd frontend
npm test              # Run unit tests
npm run test:coverage # With coverage report
```

**Frontend E2E tests (Playwright):**
```bash
cd frontend
npm run test:e2e           # Requires docker compose up
npm run test:e2e:headed    # With browser visible
npm run test:e2e:ui        # Playwright UI mode
```

## Architecture

### Project Structure

```
HomelabCmd/
├── backend/src/homelab_cmd/
│   ├── main.py              # FastAPI app, CORS, lifespan
│   ├── config.py            # Configuration from environment
│   ├── api/
│   │   ├── routes/          # API endpoint routers
│   │   │   ├── servers.py   # Server management
│   │   │   ├── alerts.py    # Alert handling
│   │   │   ├── services.py  # Service monitoring
│   │   │   ├── metrics.py   # Metrics collection
│   │   │   ├── costs.py     # Power cost tracking
│   │   │   ├── scan.py      # Network scanning
│   │   │   ├── discovery.py # Device discovery
│   │   │   ├── config.py    # Configuration management
│   │   │   ├── actions.py   # Remediation actions
│   │   │   ├── tailscale.py # Tailscale API integration (EP0008)
│   │   │   ├── ssh_settings.py  # SSH key/username management (US0079)
│   │   │   └── agent_*.py   # Agent registration/deployment
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   └── deps.py          # Dependency injection (auth, DB)
│   ├── db/
│   │   ├── models/          # SQLAlchemy models
│   │   ├── session.py       # Database session management
│   │   └── base.py          # Base model and imports
│   └── services/            # Business logic
│       ├── alerting.py      # Alert generation and tracking
│       ├── notifier.py      # Slack notifications
│       ├── power.py         # Power cost calculations
│       ├── scan.py          # Network scanning (nmap)
│       ├── discovery.py     # Device discovery
│       ├── scheduler.py     # Background task scheduling
│       ├── ssh.py           # SSH operations for agents
│       ├── ssh_executor.py  # Pooled SSH connections with retry (US0079)
│       ├── host_key_service.py   # SSH host key TOFU management (US0079)
│       ├── credential_service.py  # Encrypted credential storage (EP0008)
│       ├── tailscale_service.py   # Tailscale API client (EP0008)
│       └── connectivity_service.py  # Connectivity mode management (US0080)
├── frontend/src/
│   ├── App.tsx              # Main component, routing
│   ├── pages/               # Page components
│   ├── components/          # Reusable UI components
│   ├── api/                 # API client functions
│   ├── lib/                 # Utilities and helpers
│   └── types/               # TypeScript type definitions
├── agent/
│   └── agent.py             # Python agent for monitored servers
├── migrations/              # Alembic database migrations
└── tests/                   # Backend integration tests
```

### Backend

- **Framework:** FastAPI with Uvicorn ASGI server
- **Database:** SQLite with SQLAlchemy ORM and Alembic migrations
- **Authentication:** API key via `X-API-Key` header
- **API prefix:** `/api/v1`
- **Database location:** `sqlite:///./data/homelab.db` (Docker: `/app/data/homelab.db`)
- **Background tasks:** APScheduler for periodic monitoring and cleanup

Key patterns:
- Dependency injection for authentication and database sessions
- Pydantic schemas for request/response validation
- Service layer for business logic separation
- Repository pattern via SQLAlchemy models

### Frontend

- **Framework:** React 18 with TypeScript
- **Build tool:** Vite
- **State management:** Redux Toolkit
- **Routing:** React Router v6
- **Styling:** Tailwind CSS
- **Charts:** Recharts for visualisations
- **Icons:** Lucide React

Key patterns:
- Feature-based organisation (pages + components)
- API client layer abstracts fetch calls
- Custom hooks for data fetching and state management
- Type-safe Redux slices

### Agent

- **Language:** Python 3.11+
- **Purpose:** Runs on monitored servers to send heartbeats and metrics
- **Communication:** HTTP POST to hub backend
- **Configuration:** Environment variables

Agent monitors:
- Server uptime and status
- Service health (systemd services)
- System metrics (CPU, memory, disk)
- Network connectivity

## API Endpoints

### System
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/system/health` | Health check (no auth) |

### Servers
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/servers` | List all servers |
| GET | `/api/v1/servers/{id}` | Get server details |
| POST | `/api/v1/servers` | Create server |
| PATCH | `/api/v1/servers/{id}` | Update server |
| DELETE | `/api/v1/servers/{id}` | Delete server |
| POST | `/api/v1/servers/heartbeat` | Agent heartbeat (from agents) |

### Alerts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/alerts` | List alerts (with filters) |
| GET | `/api/v1/alerts/{id}` | Get alert details |
| POST | `/api/v1/alerts/{id}/acknowledge` | Acknowledge alert |
| POST | `/api/v1/alerts/{id}/resolve` | Resolve alert |

### Services
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/services` | List monitored services |
| GET | `/api/v1/services/{id}` | Get service details |
| POST | `/api/v1/services` | Create service |

### Metrics
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/metrics` | Get metrics (filtered by server/timeframe) |
| POST | `/api/v1/metrics` | Submit metrics (from agents) |

### Costs
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/costs` | Get power cost estimates |
| GET | `/api/v1/costs/summary` | Get cost summary |

### Scanning
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/scan` | Trigger network scan |
| GET | `/api/v1/scan/{id}` | Get scan results |
| GET | `/api/v1/scan` | List scans |

### Discovery
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/discovery/devices` | List discovered devices |
| POST | `/api/v1/discovery/devices/{id}/register` | Register device as server |

### Actions
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/actions/remediate` | Trigger remediation action |
| POST | `/api/v1/actions/approve` | Approve pending action |
| POST | `/api/v1/actions/reject` | Reject pending action |

### Configuration
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/config` | Get configuration |
| PATCH | `/api/v1/config` | Update configuration |

### Tailscale Integration (EP0008)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/settings/tailscale/status` | Get Tailscale configuration status |
| POST | `/api/v1/settings/tailscale/token` | Save Tailscale API token |
| DELETE | `/api/v1/settings/tailscale/token` | Remove Tailscale API token |
| POST | `/api/v1/settings/tailscale/test` | Test Tailscale API connection |
| GET | `/api/v1/tailscale/devices` | List Tailscale devices (filter: online, os, refresh) |
| POST | `/api/v1/tailscale/import` | Import Tailscale device as server (US0078) |
| GET | `/api/v1/tailscale/import/check` | Check if device already imported (US0078) |

### SSH Settings (US0079)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/settings/ssh/status` | Get SSH configuration status (key configured, fingerprint, username) |
| POST | `/api/v1/settings/ssh/key` | Upload SSH private key (multipart/form-data) |
| DELETE | `/api/v1/settings/ssh/key` | Remove SSH private key |
| PUT | `/api/v1/settings/ssh/username` | Update default SSH username |
| POST | `/api/v1/servers/{id}/test-ssh` | Test SSH connection to server via Tailscale hostname |

### Connectivity Settings (US0080)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/settings/connectivity` | Get connectivity mode and configuration status |
| PUT | `/api/v1/settings/connectivity` | Update connectivity mode (tailscale/direct_ssh) |
| GET | `/api/v1/settings/connectivity/status` | Get minimal status for dashboard status bar |

### Agent Management
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/agents/register` | Register new agent |
| POST | `/api/v1/agents/deploy` | Deploy agent to server |
| GET | `/api/v1/agents` | List agents |

## Data Models

### Server
- `id` (UUID) - Unique identifier
- `server_id` (str) - Human-readable name
- `server_guid` (UUID) - Globally unique identifier
- `status` (enum) - online, offline, warning, critical
- `hostname` (str) - Server hostname
- `last_seen` (datetime) - Last heartbeat timestamp
- `tdp` (int, optional) - Thermal Design Power in watts
- `created_at`, `updated_at` (datetime)

### Alert
- `id` (UUID)
- `server_id` (UUID) - Associated server
- `alert_type` (str) - Type of alert
- `severity` (enum) - info, warning, critical
- `message` (str) - Alert description
- `status` (enum) - active, acknowledged, resolved
- `created_at`, `updated_at` (datetime)

### Service
- `id` (UUID)
- `server_id` (UUID)
- `name` (str) - Service name
- `status` (enum) - running, stopped, failed
- `monitored` (bool) - Whether to monitor this service
- `last_check` (datetime)

### Metric
- `id` (UUID)
- `server_id` (UUID)
- `metric_type` (str) - cpu_usage, memory_usage, disk_usage, etc.
- `value` (float) - Metric value
- `timestamp` (datetime)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HOMELAB_CMD_API_KEY` | API key for authentication | `dev-key-change-me` |
| `HOMELAB_CMD_HOST` | Server bind address | `0.0.0.0` |
| `HOMELAB_CMD_PORT` | Server port | `8080` |
| `HOMELAB_CMD_DEBUG` | Enable debug mode | `false` |
| `HOMELAB_CMD_DATABASE_URL` | SQLite database path | `sqlite:///./data/homelab.db` |
| `HOMELAB_CMD_EXTERNAL_URL` | External URL for notifications | (empty) |
| `HOMELABCMD_ENCRYPTION_KEY` | Fernet key for credential encryption | (required) |

**Important:** Change the default API key in production!

### Encryption Key Setup (Required for Tailscale Integration)

Generate an encryption key for credential storage:

```bash
# Using the CLI tool
homelabcmd-cli generate-key

# Or via Python module
python -m homelab_cmd.cli generate-key
```

Set the key in your environment:

```bash
export HOMELABCMD_ENCRYPTION_KEY="your-generated-key"
```

**Warning:** Store this key securely! If lost, stored credentials cannot be recovered.

## Testing

### Coverage Targets

Target: 80% line coverage for backend

Current coverage: Check with `coverage report`

### Test Organisation

- `backend/tests/` - Backend unit and integration tests
- `frontend/src/__tests__/` - Frontend unit tests (Vitest)
- `frontend/e2e/` - Frontend E2E tests (Playwright)
- `tests/` - Cross-component integration tests

### Running Tests

See **Commands > Testing** section above for detailed test commands.

## Common Tasks

### Adding a New API Endpoint

1. Create route handler in `backend/src/homelab_cmd/api/routes/`
2. Define Pydantic schemas in `backend/src/homelab_cmd/api/schemas/`
3. Add database model if needed in `backend/src/homelab_cmd/db/models/`
4. Create Alembic migration: `alembic revision --autogenerate -m "description"`
5. Add tests in `backend/tests/`

### Database Migrations

```bash
# Create migration
alembic revision --autogenerate -m "Add new column"

# Apply migrations
alembic upgrade head

# Rollback migration
alembic downgrade -1
```

### Adding a Frontend Page

1. Create page component in `frontend/src/pages/`
2. Add route in `frontend/src/App.tsx`
3. Create API client functions in `frontend/src/api/`
4. Add TypeScript types in `frontend/src/types/`
5. Add tests in `frontend/src/__tests__/`

### Deploying Agent to New Server

1. Use API: `POST /api/v1/agents/deploy` with server credentials
2. Or manually copy `agent/` directory and configure environment variables
3. Set up systemd service or cron job for agent startup
