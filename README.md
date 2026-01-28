# HomelabCmd

Self-hosted homelab monitoring and management platform.

## Features

- Real-time server status monitoring
- Automated remediation with approval workflow
- Cost tracking based on TDP values
- Ad-hoc device scanning
- Slack notifications

## Quick Start

### Prerequisites

- Python 3.11+
- Docker (optional, recommended)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/DarrenBenson/HomelabCmd.git
cd HomelabCmd

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -e ".[dev]"

# Set API key (or use default dev key)
export HOMELAB_CMD_API_KEY="your-secure-api-key"

# Run the application
homelab-cmd
```

The API will be available at `http://localhost:8080`.

### Docker

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f
```

## API Documentation

- **Swagger UI:** http://localhost:8080/api/docs
- **ReDoc:** http://localhost:8080/api/redoc
- **OpenAPI Spec:** http://localhost:8080/api/openapi.json

## Configuration

Environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `HOMELAB_CMD_API_KEY` | API key for authentication | `dev-key-change-me` |
| `HOMELAB_CMD_HOST` | Server bind address | `0.0.0.0` |
| `HOMELAB_CMD_PORT` | Server port | `8080` |
| `HOMELAB_CMD_DEBUG` | Enable debug mode | `false` |
| `HOMELAB_CMD_DATABASE_URL` | SQLite database path | `sqlite:///./data/homelab.db` |

**Important:** Change the default API key in production!

## API Authentication

All API endpoints (except `/api/v1/system/health`) require authentication via the `X-API-Key` header:

```bash
curl -H "X-API-Key: your-api-key" http://localhost:8080/api/v1/servers
```

## Development

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=homelab_cmd

# Run specific test file
pytest tests/test_auth.py -v
```

### Code Quality

```bash
# Run linter
ruff check backend/src/ tests/

# Fix auto-fixable issues
ruff check --fix backend/src/ tests/

# Format code
ruff format backend/src/ tests/
```

## Project Structure

```
HomelabCmd/
├── backend/
│   └── src/
│       └── homelab_cmd/
│           ├── __init__.py
│           ├── main.py          # FastAPI application
│           ├── config.py        # Settings/configuration
│           └── api/
│               ├── deps.py      # Dependencies (auth)
│               └── routes/
│                   └── system.py    # Health check
├── frontend/
│   └── src/                     # React frontend
├── tests/
│   ├── conftest.py              # Test fixtures
│   ├── test_auth.py
│   ├── test_health.py
│   └── test_docs.py
├── pyproject.toml
├── Dockerfile
└── docker-compose.yml
```

## Licence

MIT
