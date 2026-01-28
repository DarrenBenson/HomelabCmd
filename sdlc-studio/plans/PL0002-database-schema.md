# PL0002: Database Schema and Migrations - Implementation Plan

> **Status:** Complete
> **Story:** [US0001: Database Schema and Migrations](../stories/US0001-database-schema.md)
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Created:** 2026-01-18
> **Language:** Python

## Overview

This plan implements the foundational database layer for HomelabCmd using SQLAlchemy ORM and Alembic migrations. As the first data story in EP0001, it establishes the Server and Metrics entities that all subsequent monitoring features depend on. The database file is stored in a persistent volume at `/app/data/homelab.db`.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Database file creation | SQLite database created at `/app/data/homelab.db` on startup |
| AC2 | Server entity exists | `servers` table with all required columns |
| AC3 | Metrics entity exists | `metrics` table with foreign key to servers |
| AC4 | Alembic migrations work | `alembic upgrade head` applies cleanly |
| AC5 | Data persists | Data survives container restarts |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.11+
- **ORM:** SQLAlchemy 2.0+ (async support)
- **Migrations:** Alembic 1.13+
- **Test Framework:** pytest + pytest-asyncio

### Relevant Best Practices

From `~/.claude/best-practices/python.md`:
- Type hints on all public functions
- Specific exception handling
- Logging module instead of print
- Use pathlib for file paths
- Context managers for resources

### Existing Patterns

From US0045 implementation:
- Settings via pydantic-settings (`config.py`)
- Database URL already in Settings: `database_url: str = "sqlite:///./data/homelab.db"`
- Async FastAPI patterns established
- Logging configured in `main.py`

## Recommended Approach

**Strategy:** TDD (Test-Driven Development)
**Rationale:** Database models and migrations are critical infrastructure. Writing tests first ensures:
1. Schema matches TRD specification exactly
2. Foreign key relationships work correctly
3. Indices are created for performance
4. Migration upgrade/downgrade paths function

### Test Priority

1. Database session creation works
2. Server model can be created and retrieved
3. Metrics model can be created with server relationship
4. Foreign key prevents orphan metrics
5. Index exists on metrics(server_id, timestamp)

### Documentation Updates Required

- [ ] README.md - Add database section
- [ ] Update `.env.example` if database path changes

## Implementation Steps

### Phase 1: Dependencies and Configuration

**Goal:** Add SQLAlchemy and Alembic dependencies, configure database connection

#### Step 1.1: Add dependencies

- [ ] Add SQLAlchemy 2.0+ to pyproject.toml
- [ ] Add aiosqlite for async SQLite support
- [ ] Add Alembic for migrations

**Files to modify:**
- `pyproject.toml` - Add dependencies

**Dependencies:**
```toml
"sqlalchemy[asyncio]>=2.0.0",
"aiosqlite>=0.19.0",
"alembic>=1.13.0",
```

#### Step 1.2: Database session management

- [ ] Create `backend/src/homelab_cmd/db/session.py`
- [ ] Implement async session factory
- [ ] Create dependency for FastAPI routes

**Files to create:**
- `backend/src/homelab_cmd/db/__init__.py`
- `backend/src/homelab_cmd/db/session.py` - Async engine and session

**Considerations:**
- Use `async_sessionmaker` for async support
- Configure SQLite with `check_same_thread=False` for async
- Create data directory if it doesn't exist

### Phase 2: SQLAlchemy Models

**Goal:** Define Server and Metrics models matching TRD schema

#### Step 2.1: Base model

- [ ] Create `backend/src/homelab_cmd/db/base.py`
- [ ] Define declarative base with common columns
- [ ] Add timestamp mixin for created_at/updated_at

**Files to create:**
- `backend/src/homelab_cmd/db/base.py` - Base model class

**Pattern:**
```python
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from datetime import datetime

class Base(DeclarativeBase):
    pass

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow
    )
```

#### Step 2.2: Server model

- [ ] Create `backend/src/homelab_cmd/db/models/server.py`
- [ ] Define all columns per TRD specification
- [ ] Add relationship to metrics

**Files to create:**
- `backend/src/homelab_cmd/db/models/__init__.py`
- `backend/src/homelab_cmd/db/models/server.py` - Server model

**Schema (from TRD):**
| Field | Type | Constraints |
|-------|------|-------------|
| id | string | PK, unique (slug format) |
| hostname | string | Required |
| display_name | string | Nullable |
| ip_address | string | Nullable |
| status | enum | online/offline/unknown, default: unknown |
| os_distribution | string | Nullable |
| os_version | string | Nullable |
| kernel_version | string | Nullable |
| architecture | string | Nullable |
| tdp_watts | integer | Nullable |
| last_seen | datetime | Nullable |
| created_at | datetime | Auto |
| updated_at | datetime | Auto |

#### Step 2.3: Metrics model

- [ ] Create `backend/src/homelab_cmd/db/models/metrics.py`
- [ ] Define all columns per TRD specification
- [ ] Add foreign key to servers
- [ ] Add composite index on (server_id, timestamp)

**Files to create:**
- `backend/src/homelab_cmd/db/models/metrics.py` - Metrics model

**Schema (from TRD):**
| Field | Type | Constraints |
|-------|------|-------------|
| id | integer | PK, auto |
| server_id | string | FK → servers, indexed |
| timestamp | datetime | Indexed |
| cpu_percent | float | Nullable |
| memory_percent | float | Nullable |
| memory_total_mb | integer | Nullable |
| memory_used_mb | integer | Nullable |
| disk_percent | float | Nullable |
| disk_total_gb | float | Nullable |
| disk_used_gb | float | Nullable |
| network_rx_bytes | bigint | Nullable |
| network_tx_bytes | bigint | Nullable |
| load_1m | float | Nullable |
| load_5m | float | Nullable |
| load_15m | float | Nullable |
| uptime_seconds | integer | Nullable |

**Index:**
```python
__table_args__ = (
    Index('idx_metrics_server_timestamp', 'server_id', 'timestamp'),
)
```

### Phase 3: Alembic Setup

**Goal:** Configure Alembic and create initial migration

#### Step 3.1: Initialise Alembic

- [ ] Run `alembic init migrations`
- [ ] Configure `alembic.ini` for async
- [ ] Update `migrations/env.py` for async support

**Files to create/modify:**
- `alembic.ini` - Alembic configuration
- `migrations/env.py` - Migration environment

**Considerations:**
- Use async migration support
- Configure to read DATABASE_URL from settings
- Import all models in env.py for autogenerate

#### Step 3.2: Create initial migration

- [ ] Generate migration: `alembic revision --autogenerate -m "Initial schema"`
- [ ] Review generated migration
- [ ] Test upgrade and downgrade

**Files to create:**
- `migrations/versions/001_initial_schema.py` - Initial migration

### Phase 4: Application Integration

**Goal:** Integrate database with FastAPI application lifecycle

#### Step 4.1: Startup initialisation

- [ ] Create database tables on startup (if not using migrations)
- [ ] Or run migrations automatically
- [ ] Create data directory if missing
- [ ] Log database connection status

**Files to modify:**
- `backend/src/homelab_cmd/main.py` - Add database init to lifespan

**Approach:**
```python
async def lifespan(app: FastAPI):
    # Ensure data directory exists
    Path("./data").mkdir(exist_ok=True)

    # Run migrations or create tables
    await init_database()

    yield

    # Cleanup
    await dispose_engine()
```

#### Step 4.2: Health check integration

- [ ] Update health check to report database status
- [ ] Test database connectivity in health endpoint

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/system.py` - Add database status

**Health response update:**
```json
{
  "status": "healthy",
  "database": "connected"  // or "disconnected"
}
```

### Phase 5: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 5.1: Test fixtures

- [ ] Create test database fixture (in-memory SQLite)
- [ ] Create session fixture for tests
- [ ] Ensure test isolation

**Files to create:**
- `tests/test_database.py` - Database tests
- Update `tests/conftest.py` - Add database fixtures

**Test database pattern:**
```python
@pytest.fixture
async def db_session():
    """Create test database session."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as session:
        yield session

    await engine.dispose()
```

#### Step 5.2: Model tests

- [ ] Test Server creation and retrieval
- [ ] Test Metrics creation with server relationship
- [ ] Test foreign key constraint
- [ ] Test timestamp auto-population
- [ ] Test status enum values

#### Step 5.3: Migration tests

- [ ] Test upgrade to head on empty database
- [ ] Test upgrade with existing data (if applicable)
- [ ] Verify index creation with EXPLAIN

#### Step 5.4: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Test database file creation in startup | Pending |
| AC2 | Test Server model schema matches spec | Pending |
| AC3 | Test Metrics model schema with FK | Pending |
| AC4 | Run alembic upgrade head in test | Pending |
| AC5 | Integration test with restart simulation | Pending |

## Project Structure (After Implementation)

```
backend/src/homelab_cmd/
├── __init__.py
├── main.py                    # Updated with DB init
├── config.py
├── api/
│   ├── __init__.py
│   ├── deps.py
│   └── routes/
│       ├── __init__.py
│       └── system.py          # Updated health check
└── db/
    ├── __init__.py
    ├── base.py               # Base model, mixins
    ├── session.py            # Engine, session factory
    └── models/
        ├── __init__.py       # Import all models
        ├── server.py         # Server model
        └── metrics.py        # Metrics model

migrations/
├── env.py
├── script.py.mako
└── versions/
    └── 001_initial_schema.py

tests/
├── conftest.py               # Updated with DB fixtures
├── test_auth.py
├── test_health.py
├── test_docs.py
└── test_database.py          # New
```

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| Data directory doesn't exist | Create on startup with `Path.mkdir(exist_ok=True)` |
| Database file is corrupted | Log error, raise exception (manual recovery) |
| Duplicate server_id insert | SQLAlchemy IntegrityError, return 409 Conflict |
| Metrics without valid server_id | Foreign key constraint violation |
| Very large disk values | Use BigInteger for network bytes |
| Empty string for server_id | Pydantic validation (min length) |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Migration breaks existing data | Data loss | Test migrations thoroughly, backup before upgrade |
| Async SQLite issues | Connection errors | Test with realistic load, use aiosqlite |
| Index not used | Slow queries | Verify with EXPLAIN QUERY PLAN |
| Timestamp timezone issues | Data inconsistency | Use UTC throughout, store aware datetimes |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0045 | Story | Provides FastAPI app structure, config |
| SQLAlchemy | Python package | >= 2.0.0 with async support |
| aiosqlite | Python package | Async SQLite driver |
| Alembic | Python package | Database migrations |

## Open Questions

None - schema is fully specified in TRD.

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows Python best practices
- [ ] No linting errors (ruff)
- [ ] SQLAlchemy models match TRD schema
- [ ] Alembic initial migration created
- [ ] Health check reports database status
- [ ] Documentation updated

## Notes

This story establishes database patterns for subsequent stories:
- **US0002** (Server Registration) will add CRUD operations
- **US0003** (Agent Heartbeat) will add metrics insertion
- Future epics will add Alert, Service, and Scan models

The async approach is chosen to match FastAPI's async nature, even though SQLite doesn't truly benefit from async (it's single-writer). This keeps the codebase consistent and ready for potential PostgreSQL migration noted in TRD ADR-001.

## Next Steps After Completion

- **US0002**: Server Registration API (CRUD endpoints)
- **US0003**: Agent Heartbeat Endpoint (metrics insertion)
