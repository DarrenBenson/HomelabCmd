# PL0131: Card Order Persistence - Implementation Plan

> **Status:** Complete
> **Story:** [US0131: Card Order Persistence](../stories/US0131-card-order-persistence.md)
> **Epic:** [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md)
> **Created:** 2026-01-28
> **Language:** TypeScript (Frontend), Python (Backend)

## Overview

Implement persistence for the dashboard card order established in US0130. Uses the existing `Config` key-value model (no new database table needed) to store server ID order. Frontend integrates debounced save with error handling and toast notifications.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Save card order on reorder | Debounced (500ms) save after drag-drop, "Saving..." indicator |
| AC2 | Load card order on page load | Cards displayed in saved order within 500ms |
| AC3 | New machines added to end | New servers appended to existing order |
| AC4 | Deleted machines removed | Invalid IDs filtered out on load |
| AC5 | API endpoint for saving | PUT /api/v1/preferences/card-order |
| AC6 | API endpoint for loading | GET /api/v1/preferences/card-order |
| AC7 | Save failure handling | Error toast with retry button |

---

## Technical Context

### Language & Framework
- **Backend:** Python 3.11+ with FastAPI, SQLAlchemy (async)
- **Frontend:** React 19, TypeScript
- **Test Framework:** pytest (backend), Vitest (frontend)
- **Existing Model:** `Config` table with key-value JSON storage (no migration needed)

### Existing Patterns

**Backend - Config model (config.py:15-45):**
```python
class Config(Base):
    __tablename__ = "config"
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), ...)
```

**Backend - Config routes pattern (config.py:42-60):**
```python
async def get_config_value(session: AsyncSession, key: str) -> dict | None:
    result = await session.execute(select(Config).where(Config.key == key))
    config = result.scalar_one_or_none()
    return config.value if config else None

async def set_config_value(session: AsyncSession, key: str, value: dict) -> None:
    # Upsert pattern
```

**Frontend - API client pattern (config.ts):**
```typescript
import { api } from './client';
export async function getConfig(): Promise<ConfigResponse> {
  return api.get<ConfigResponse>('/api/v1/config');
}
```

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Create preferences schemas | `api/schemas/preferences.py` | - | [ ] |
| 2 | Create preferences route | `api/routes/preferences.py` | 1 | [ ] |
| 3 | Register router in main.py | `main.py` | 2 | [ ] |
| 4 | Write backend unit tests | `tests/test_api_preferences.py` | 2 | [ ] |
| 5 | Create frontend API client | `api/preferences.ts` | 3 | [ ] |
| 6 | Create frontend types | `types/preferences.ts` | 5 | [ ] |
| 7 | Add debounce hook | `hooks/useDebouncedSave.ts` | - | [ ] |
| 8 | Integrate with Dashboard | `pages/Dashboard.tsx` | 5, 7 | [ ] |
| 9 | Add toast notifications | `pages/Dashboard.tsx` | 8 | [ ] |
| 10 | Write frontend unit tests | `api/preferences.test.ts` | 5 | [ ] |
| 11 | Write Dashboard integration tests | `pages/Dashboard.test.tsx` | 8 | [ ] |

---

## Implementation Details

### Task 1: Preferences Schemas

**File:** `backend/src/homelab_cmd/api/schemas/preferences.py`

```python
"""Schemas for dashboard preferences API."""

from datetime import datetime

from pydantic import BaseModel, Field


class CardOrderRequest(BaseModel):
    """Request schema for saving card order."""

    order: list[str] = Field(
        ...,
        description="Ordered list of server IDs",
        examples=[["server-1", "server-2", "server-3"]],
    )


class CardOrderSaveResponse(BaseModel):
    """Response schema for save operation."""

    status: str = Field(default="saved", description="Operation status")
    timestamp: datetime = Field(..., description="Save timestamp")


class CardOrderLoadResponse(BaseModel):
    """Response schema for load operation."""

    order: list[str] = Field(
        default_factory=list,
        description="Ordered list of server IDs (empty if none saved)",
    )
```

### Task 2: Preferences Route

**File:** `backend/src/homelab_cmd/api/routes/preferences.py`

```python
"""Dashboard preferences API endpoints.

Provides endpoints for managing user dashboard preferences such as card order.
Uses the existing Config model for storage (no new table required).
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.deps import verify_api_key
from homelab_cmd.api.responses import AUTH_RESPONSES
from homelab_cmd.api.schemas.preferences import (
    CardOrderRequest,
    CardOrderLoadResponse,
    CardOrderSaveResponse,
)
from homelab_cmd.db.models.config import Config
from homelab_cmd.db.session import get_async_session

router = APIRouter(prefix="/preferences", tags=["Preferences"])

CONFIG_KEY_CARD_ORDER = "dashboard_card_order"


@router.put(
    "/card-order",
    response_model=CardOrderSaveResponse,
    operation_id="save_card_order",
    summary="Save dashboard card order",
    responses={**AUTH_RESPONSES},
)
async def save_card_order(
    request: CardOrderRequest,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> CardOrderSaveResponse:
    """Save the dashboard card order preference.

    Stores the ordered list of server IDs to persist card arrangement
    across page refreshes. Uses upsert pattern - creates if not exists,
    updates if exists.
    """
    result = await session.execute(
        select(Config).where(Config.key == CONFIG_KEY_CARD_ORDER)
    )
    config = result.scalar_one_or_none()

    now = datetime.now(UTC)

    if config:
        config.value = {"order": request.order}
        config.updated_at = now
    else:
        config = Config(
            key=CONFIG_KEY_CARD_ORDER,
            value={"order": request.order},
            updated_at=now,
        )
        session.add(config)

    await session.flush()

    return CardOrderSaveResponse(status="saved", timestamp=now)


@router.get(
    "/card-order",
    response_model=CardOrderLoadResponse,
    operation_id="get_card_order",
    summary="Get dashboard card order",
    responses={**AUTH_RESPONSES},
)
async def get_card_order(
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> CardOrderLoadResponse:
    """Get the saved dashboard card order preference.

    Returns the ordered list of server IDs for card arrangement.
    Returns empty list if no order has been saved yet.
    """
    result = await session.execute(
        select(Config).where(Config.key == CONFIG_KEY_CARD_ORDER)
    )
    config = result.scalar_one_or_none()

    if config and isinstance(config.value, dict):
        order = config.value.get("order", [])
        return CardOrderLoadResponse(order=order)

    return CardOrderLoadResponse(order=[])
```

### Task 3: Register Router

**File:** `backend/src/homelab_cmd/main.py`

Add import:
```python
from homelab_cmd.api.routes import (
    # ... existing imports
    preferences,
)
```

Add router registration (after other routers):
```python
app.include_router(preferences.router, prefix="/api/v1")
```

### Task 5: Frontend API Client

**File:** `frontend/src/api/preferences.ts`

```typescript
import { api } from './client';
import type {
  CardOrderSaveResponse,
  CardOrderLoadResponse,
} from '../types/preferences';

export async function saveCardOrder(order: string[]): Promise<CardOrderSaveResponse> {
  return api.put<CardOrderSaveResponse>('/api/v1/preferences/card-order', { order });
}

export async function getCardOrder(): Promise<CardOrderLoadResponse> {
  return api.get<CardOrderLoadResponse>('/api/v1/preferences/card-order');
}
```

### Task 6: Frontend Types

**File:** `frontend/src/types/preferences.ts`

```typescript
export interface CardOrderSaveResponse {
  status: string;
  timestamp: string;
}

export interface CardOrderLoadResponse {
  order: string[];
}
```

### Task 7: Debounce Hook

**File:** `frontend/src/hooks/useDebouncedSave.ts`

```typescript
import { useRef, useCallback, useEffect } from 'react';

export function useDebouncedSave<T>(
  saveFn: (value: T) => Promise<void>,
  delay: number = 500
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValueRef = useRef<T | null>(null);

  const debouncedSave = useCallback(
    (value: T) => {
      latestValueRef.current = value;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(async () => {
        if (latestValueRef.current !== null) {
          await saveFn(latestValueRef.current);
        }
      }, delay);
    },
    [saveFn, delay]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedSave;
}
```

### Task 8: Dashboard Integration

**File:** `frontend/src/pages/Dashboard.tsx`

Add imports:
```typescript
import { saveCardOrder, getCardOrder } from '../api/preferences';
import { useDebouncedSave } from '../hooks/useDebouncedSave';
```

Add state for save status:
```typescript
const [isSaving, setIsSaving] = useState(false);
const [saveError, setSaveError] = useState<string | null>(null);
```

Create save handler:
```typescript
const handleSaveOrder = useCallback(async (order: string[]) => {
  setIsSaving(true);
  setSaveError(null);
  try {
    await saveCardOrder(order);
  } catch (error) {
    const message = error instanceof ApiError ? error.message : 'Failed to save order';
    setSaveError(message);
    throw error; // Re-throw for toast handling
  } finally {
    setIsSaving(false);
  }
}, []);

const debouncedSaveOrder = useDebouncedSave(handleSaveOrder, 500);
```

Modify handleDragEnd to call save:
```typescript
function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  setActiveDragId(null);

  if (over && active.id !== over.id) {
    setServers((items) => {
      const oldIndex = items.findIndex(s => s.id === active.id);
      const newIndex = items.findIndex(s => s.id === over.id);
      const newOrder = arrayMove(items, oldIndex, newIndex);

      // US0131: Debounced save of new order
      debouncedSaveOrder(newOrder.map(s => s.id));

      return newOrder;
    });
  }
}
```

Load saved order on mount:
```typescript
useEffect(() => {
  async function loadSavedOrder() {
    try {
      const { order } = await getCardOrder();
      if (order.length > 0) {
        setServers((currentServers) => {
          // Create map for O(1) lookup
          const serverMap = new Map(currentServers.map(s => [s.id, s]));

          // Build ordered list from saved order
          const ordered: Server[] = [];
          const seen = new Set<string>();

          for (const id of order) {
            const server = serverMap.get(id);
            if (server) {
              ordered.push(server);
              seen.add(id);
            }
          }

          // Append any new servers not in saved order (AC3)
          for (const server of currentServers) {
            if (!seen.has(server.id)) {
              ordered.push(server);
            }
          }

          return ordered;
        });
      }
    } catch (error) {
      // Silent fail - use default order if load fails
      console.error('Failed to load card order:', error);
    }
  }

  loadSavedOrder();
}, []);
```

### Task 9: Toast Notifications

Add saving indicator and error toast in Dashboard:
```typescript
// In render, near other status messages:
{isSaving && (
  <div className="fixed bottom-4 right-4 bg-bg-secondary px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm text-text-secondary">
    <Loader2 className="w-4 h-4 animate-spin" />
    Saving...
  </div>
)}

{saveError && (
  <div className="fixed bottom-4 right-4 bg-status-critical/10 border border-status-critical px-4 py-3 rounded-lg shadow-lg">
    <div className="flex items-center gap-3">
      <AlertCircle className="w-5 h-5 text-status-critical" />
      <span className="text-text-primary">{saveError}</span>
      <button
        onClick={() => {
          setSaveError(null);
          debouncedSaveOrder(servers.map(s => s.id));
        }}
        className="ml-2 px-2 py-1 bg-status-critical text-white rounded text-sm hover:bg-status-critical/90"
      >
        Retry
      </button>
    </div>
  </div>
)}
```

---

## Reordering Algorithm

The order reconciliation algorithm handles AC3 (new machines) and AC4 (deleted machines):

```typescript
function reconcileOrder(savedOrder: string[], currentServers: Server[]): Server[] {
  const serverMap = new Map(currentServers.map(s => [s.id, s]));
  const result: Server[] = [];
  const seen = new Set<string>();

  // 1. Add servers in saved order (if they still exist) - AC4 handled
  for (const id of savedOrder) {
    const server = serverMap.get(id);
    if (server) {
      result.push(server);
      seen.add(id);
    }
    // Deleted servers silently skipped (AC4)
  }

  // 2. Append new servers not in saved order - AC3 handled
  for (const server of currentServers) {
    if (!seen.has(server.id)) {
      result.push(server);
    }
  }

  return result;
}
```

---

## Edge Case Handling

| # | Edge Case | Strategy |
|---|-----------|----------|
| 1 | No saved order exists | Return empty array, use default server order |
| 2 | Saved order contains deleted IDs | Filter out invalid IDs silently (AC4) |
| 3 | Network timeout during save | Show error toast with retry button (AC7) |
| 4 | Rapid reorders (5+ in 2s) | Debounce ensures only final order saved |
| 5 | Page refresh during save | Previous order shown; user can re-arrange |
| 6 | Empty order array submitted | Valid - resets to default order |
| 7 | Concurrent tabs | Last write wins (single-user system) |
| 8 | Server data refreshes | Re-reconcile with saved order |

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `backend/src/homelab_cmd/api/schemas/preferences.py` | Create | Request/response schemas |
| `backend/src/homelab_cmd/api/routes/preferences.py` | Create | API endpoints |
| `backend/src/homelab_cmd/main.py` | Modify | Register preferences router |
| `backend/tests/test_api_preferences.py` | Create | Backend API tests |
| `frontend/src/types/preferences.ts` | Create | TypeScript types |
| `frontend/src/api/preferences.ts` | Create | API client functions |
| `frontend/src/api/preferences.test.ts` | Create | API client tests |
| `frontend/src/hooks/useDebouncedSave.ts` | Create | Debounce hook |
| `frontend/src/pages/Dashboard.tsx` | Modify | Integration with load/save |

---

## Definition of Done

- [ ] Backend schemas created
- [ ] Backend endpoints created and tested
- [ ] Router registered in main.py
- [ ] Frontend types created
- [ ] Frontend API client created and tested
- [ ] Debounce hook created
- [ ] Dashboard loads saved order on mount
- [ ] Dashboard saves order on reorder (debounced)
- [ ] "Saving..." indicator shown during save
- [ ] Error toast with retry on failure
- [ ] New servers appear at end of list
- [ ] Deleted servers filtered from saved order
- [ ] All existing tests still pass

---

## Test Strategy

See [TS0131: Card Order Persistence](../test-specs/TS0131-card-order-persistence.md)

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial plan creation |
