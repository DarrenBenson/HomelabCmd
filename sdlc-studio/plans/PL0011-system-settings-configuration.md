# PL0011: System Settings Configuration - Implementation Plan

> **Status:** Complete
> **Story:** [US0043: System Settings Configuration](../stories/US0043-system-settings-configuration.md)
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Created:** 2026-01-19
> **Language:** Python (Backend), TypeScript (Frontend)

## Overview

Implement a Settings page and API endpoints to allow users to configure alert thresholds and notification preferences through the web UI. Changes persist to a new Config database table and survive application restarts.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Settings page accessible | Settings button in header navigates to Settings page |
| AC2 | Thresholds configurable | Can view/edit disk, memory, CPU thresholds and offline timeout |
| AC3 | Threshold changes saved | PUT /api/v1/config/thresholds persists changes |
| AC4 | Slack webhook configurable | Can enter/update Slack webhook URL |
| AC5 | Persist across restarts | Config loaded from database on startup |
| AC6 | Validation | Invalid values (>100%, <0%) rejected with error |

## Technical Context

### Language & Framework

- **Backend:** Python 3.12 with FastAPI, SQLAlchemy 2.0 (async)
- **Frontend:** TypeScript with React 18, Vite, TailwindCSS
- **Test Framework:** pytest (backend), Vitest (frontend)

### Relevant Best Practices

- Follow existing SQLAlchemy model patterns (Server, Metrics)
- Use Pydantic v2 for request/response validation
- FastAPI dependency injection for auth and db session
- React hooks for state management
- Toast notifications for user feedback

### Existing Patterns

**Backend:**
- Models at `backend/src/homelab_cmd/db/models/` with `Base` and `TimestampMixin`
- Routes at `backend/src/homelab_cmd/api/routes/` with `verify_api_key` dependency
- Schemas at `backend/src/homelab_cmd/api/schemas/` using Pydantic BaseModel

**Frontend:**
- Pages at `frontend/src/pages/` (Dashboard, ServerDetail)
- API clients at `frontend/src/api/` with apiClient wrapper
- Types at `frontend/src/types/`
- Routing in `App.tsx` with React Router

## Recommended Approach

**Strategy:** Test-After
**Rationale:** This is a straightforward CRUD feature with well-defined schemas. The API contract is clear from the TRD, and existing patterns provide strong guidance. Write implementation first, then comprehensive tests.

### Test Priority

1. API endpoint validation (invalid thresholds rejected)
2. Config persistence (values survive restart)
3. Frontend form validation and save flow

### Documentation Updates Required

- [ ] Update story status to Planned
- [ ] No README changes needed (internal feature)

## Implementation Steps

### Phase 1: Backend - Database Model

**Goal:** Create Config model and migration

#### Step 1.1: Create Config Model

- [ ] Create `backend/src/homelab_cmd/db/models/config.py`
- [ ] Define Config class with key (PK), value (JSON), updated_at
- [ ] Register in `backend/src/homelab_cmd/db/models/__init__.py`

**Files to create/modify:**
- `backend/src/homelab_cmd/db/models/config.py` - New Config model
- `backend/src/homelab_cmd/db/models/__init__.py` - Add Config import

**Model Structure:**
```python
class Config(Base):
    __tablename__ = "config"
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), ...)
```

### Phase 2: Backend - API Endpoints

**Goal:** Implement config API routes and schemas

#### Step 2.1: Create Config Schemas

- [ ] Create `backend/src/homelab_cmd/api/schemas/config.py`
- [ ] Define ThresholdsConfig, NotificationsConfig, ConfigResponse
- [ ] Add validation (0-100 for percentages, URL format for webhook)

**Files to create:**
- `backend/src/homelab_cmd/api/schemas/config.py` - Pydantic schemas

**Schema Structure:**
```python
class ThresholdsConfig(BaseModel):
    disk_warning_percent: int = Field(ge=0, le=100, default=80)
    disk_critical_percent: int = Field(ge=0, le=100, default=90)
    memory_warning_percent: int = Field(ge=0, le=100, default=85)
    cpu_warning_percent: int = Field(ge=0, le=100, default=90)
    server_offline_seconds: int = Field(ge=30, default=180)

class NotificationsConfig(BaseModel):
    slack_webhook_url: str = ""
    notify_on_critical: bool = True
    notify_on_high: bool = True
    notify_on_medium: bool = False
    notify_on_low: bool = False
    notify_on_remediation: bool = True
```

#### Step 2.2: Create Config Routes

- [ ] Create `backend/src/homelab_cmd/api/routes/config.py`
- [ ] Implement GET /api/v1/config
- [ ] Implement PUT /api/v1/config/thresholds
- [ ] Implement PUT /api/v1/config/notifications
- [ ] Register router in `main.py`

**Files to create/modify:**
- `backend/src/homelab_cmd/api/routes/config.py` - New routes file
- `backend/src/homelab_cmd/main.py` - Register config router

**Default Values Handling:**
- If config keys don't exist in DB, return defaults
- On first save, create the keys
- Partial updates supported (only changed fields)

### Phase 3: Frontend - Settings Page

**Goal:** Create Settings UI with forms

#### Step 3.1: Create Config API Client

- [ ] Create `frontend/src/api/config.ts`
- [ ] Add getConfig(), updateThresholds(), updateNotifications()
- [ ] Add PUT method to `client.ts` if missing

**Files to create/modify:**
- `frontend/src/api/config.ts` - Config API functions
- `frontend/src/api/client.ts` - Add .put() method

#### Step 3.2: Create Settings Page

- [ ] Create `frontend/src/pages/Settings.tsx`
- [ ] Implement Thresholds section with 5 inputs
- [ ] Implement Notifications section with webhook URL + checkboxes
- [ ] Handle form state, validation, save/cancel
- [ ] Show success/error toasts

**Files to create:**
- `frontend/src/pages/Settings.tsx` - Settings page component
- `frontend/src/types/config.ts` - TypeScript types

**UI Sections:**
1. Alert Thresholds (5 numeric inputs with % suffix)
2. Notifications (1 URL input + 5 checkboxes)
3. Action buttons (Cancel, Save Settings)

#### Step 3.3: Add Route and Navigation

- [ ] Add `/settings` route in `App.tsx`
- [ ] Add Settings button/link in Dashboard header

**Files to modify:**
- `frontend/src/App.tsx` - Add route
- `frontend/src/pages/Dashboard.tsx` - Add Settings button in header

### Phase 4: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 4.1: Backend Tests

- [ ] Create `tests/test_config.py`
- [ ] Test GET /api/v1/config returns defaults
- [ ] Test PUT thresholds saves correctly
- [ ] Test PUT notifications saves correctly
- [ ] Test validation rejects invalid values
- [ ] Test persistence (query DB directly)

#### Step 4.2: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Manual: Click Settings in header, page loads | Pending |
| AC2 | Manual: View thresholds section, all 5 fields present | Pending |
| AC3 | Test: PUT /api/v1/config/thresholds returns 200 | Pending |
| AC4 | Manual: Enter webhook URL, save, verify persisted | Pending |
| AC5 | Test: Restart app, GET config returns saved values | Pending |
| AC6 | Test: PUT with value=150 returns 422 | Pending |

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| First run (no config in DB) | Return hardcoded defaults |
| Invalid percentage (>100 or <0) | Pydantic validation returns 422 |
| Invalid webhook URL format | Pydantic HttpUrl validation |
| Partial update (only some fields) | Merge with existing, save all |
| Empty webhook URL | Allow empty string (disables Slack) |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Config not loading on startup | Thresholds ignored | Test restart scenario explicitly |
| Concurrent updates | Data inconsistency | Last-write-wins (acceptable for single-user) |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0001: Database Schema | Story | Done - provides Base model |
| US0005: Dashboard | Story | Done - provides header for Settings link |

## Open Questions

None - requirements are clear from story and TRD.

## Definition of Done Checklist

- [ ] All 6 acceptance criteria implemented
- [ ] Backend unit tests written and passing
- [ ] Config model created with migration
- [ ] API endpoints return correct responses
- [ ] Frontend Settings page functional
- [ ] Validation working (rejects invalid values)
- [ ] No linting errors (ruff, eslint)
- [ ] Ready for code review

## Notes

**File Count:** ~8 new files, ~4 modified files

**Estimated Effort:**
- Phase 1 (Model): 15 min
- Phase 2 (API): 30 min
- Phase 3 (Frontend): 45 min
- Phase 4 (Tests): 30 min
