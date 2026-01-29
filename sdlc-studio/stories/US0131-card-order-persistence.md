# US0131: Card Order Persistence

> **Status:** Done
> **Epic:** [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md)
> **Owner:** Darren
> **Created:** 2026-01-28
> **Story Points:** 5
> **Plan:** [PL0131](../plans/PL0131-card-order-persistence.md)
> **Test Spec:** [TS0131](../test-specs/TS0131-card-order-persistence.md)

## User Story

**As a** Darren (Homelab Operator)
**I want** my card order to be saved
**So that** it persists after refreshing the page

## Context

### Persona Reference

**Darren** - Technical professional running a homelab with 11+ servers. Expects his carefully arranged dashboard to remain consistent across sessions and devices.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Once Darren has arranged his dashboard cards (US0130), the order must persist. Without persistence, every page refresh would reset to the default order, making the drag-and-drop feature frustrating rather than useful.

---

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | Performance | Reorder takes <2 seconds including save | Debounced save, optimistic UI |
| PRD | Data | Single user system | No multi-user conflict handling needed |
| TRD | Architecture | SQLite backend | JSON column for preference storage |

---

## Acceptance Criteria

### AC1: Save card order on reorder

- **Given** the user has reordered cards via drag-and-drop
- **When** the card is dropped in its new position
- **Then** the new order is saved to the backend automatically
- **And** the save is debounced (500ms) to handle rapid reorders
- **And** a subtle "Saving..." indicator appears briefly

### AC2: Load card order on page load

- **Given** a saved card order exists in the database
- **When** the dashboard page loads
- **Then** cards are displayed in the saved order
- **And** cards load in <500ms after data fetch

### AC3: New machines added to end

- **Given** a saved card order exists with machines [A, B, C]
- **When** a new machine D is registered
- **Then** machine D appears at the end of the list
- **And** the saved order becomes [A, B, C, D]

### AC4: Deleted machines removed from order

- **Given** a saved card order exists with machines [A, B, C, D]
- **When** machine B is deleted from the system
- **Then** the order automatically becomes [A, C, D]
- **And** no error or gap occurs in the display

### AC5: API endpoint for saving order

- **Given** the frontend needs to save card order
- **When** `PUT /api/v1/preferences/card-order` is called
- **Then** the request body contains `{ "order": ["machine-id-1", "machine-id-2", ...] }`
- **And** the response is `{ "status": "saved", "timestamp": "..." }`
- **And** HTTP 200 is returned on success

### AC6: API endpoint for loading order

- **Given** the frontend needs to load card order
- **When** `GET /api/v1/preferences/card-order` is called
- **Then** the response contains `{ "order": ["machine-id-1", "machine-id-2", ...] }`
- **And** if no order exists, returns `{ "order": [] }`
- **And** HTTP 200 is returned

### AC7: Save failure handling

- **Given** the order save fails (network error, server error)
- **When** the save request returns an error
- **Then** the UI shows "Failed to save order" toast notification
- **And** the UI order remains as the user arranged it
- **And** a retry button appears in the toast

---

## Scope

### In Scope

- Backend API endpoints for save/load card order
- Database table for dashboard preferences
- Frontend integration with debounced save
- Handling of new/deleted machines
- Error handling with retry option
- Loading indicator during save

### Out of Scope

- Multi-user conflict resolution
- Order history/undo
- Separate orders per section (handled in US0132)
- Cloud sync across multiple HomelabCmd instances

---

## Technical Notes

### API Design

**PUT /api/v1/preferences/card-order**

Request:
```json
{
  "order": ["server-guid-1", "server-guid-2", "server-guid-3"]
}
```

Response (200):
```json
{
  "status": "saved",
  "timestamp": "2026-01-28T10:30:00Z"
}
```

**GET /api/v1/preferences/card-order**

Response (200):
```json
{
  "order": ["server-guid-1", "server-guid-2", "server-guid-3"]
}
```

Response (200, no order saved):
```json
{
  "order": []
}
```

### Database Schema

```sql
CREATE TABLE dashboard_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  preference_key TEXT UNIQUE NOT NULL,
  preference_value JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Backend Implementation

```python
# backend/src/homelab_cmd/api/routes/preferences.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from homelab_cmd.api.deps import get_db

router = APIRouter(prefix="/preferences", tags=["preferences"])

@router.put("/card-order")
async def save_card_order(order: CardOrderRequest, db: Session = Depends(get_db)):
    pref = db.query(DashboardPreference).filter_by(preference_key="card_order").first()
    if pref:
        pref.preference_value = order.order
        pref.updated_at = datetime.utcnow()
    else:
        pref = DashboardPreference(preference_key="card_order", preference_value=order.order)
        db.add(pref)
    db.commit()
    return {"status": "saved", "timestamp": pref.updated_at.isoformat()}

@router.get("/card-order")
async def get_card_order(db: Session = Depends(get_db)):
    pref = db.query(DashboardPreference).filter_by(preference_key="card_order").first()
    return {"order": pref.preference_value if pref else []}
```

### Frontend Implementation

```typescript
// frontend/src/api/preferences.ts
export async function saveCardOrder(order: string[]): Promise<void> {
  await api.put('/preferences/card-order', { order });
}

export async function getCardOrder(): Promise<string[]> {
  const response = await api.get('/preferences/card-order');
  return response.data.order;
}

// Debounced save hook
const debouncedSave = useDebouncedCallback(
  async (order: string[]) => {
    try {
      await saveCardOrder(order);
    } catch (error) {
      toast.error('Failed to save order', { action: { label: 'Retry', onClick: () => debouncedSave(order) } });
    }
  },
  500
);
```

### Files to Create/Modify

- `backend/src/homelab_cmd/db/models/preferences.py` - New model
- `backend/src/homelab_cmd/api/routes/preferences.py` - New router
- `backend/src/homelab_cmd/api/schemas/preferences.py` - New schemas
- `backend/src/homelab_cmd/main.py` - Register router
- `migrations/versions/xxxx_add_dashboard_preferences.py` - Alembic migration
- `frontend/src/api/preferences.ts` - New API client
- `frontend/src/pages/Dashboard.tsx` - Integration

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | No saved order exists | Return empty array, use default order |
| 2 | Saved order contains deleted machine IDs | Filter out invalid IDs, display remaining |
| 3 | Network timeout during save | Show error toast, keep UI order, offer retry |
| 4 | Rapid reorders (5+ in 2 seconds) | Only save final order (debounce) |
| 5 | Page refresh during save | Order may not persist, load shows previous order |
| 6 | Invalid machine ID in request | API returns 400 with validation error |
| 7 | Empty order array submitted | Valid - resets to default order |
| 8 | Concurrent saves from multiple tabs | Last write wins (single user system) |

---

## Test Scenarios

- [ ] PUT /api/v1/preferences/card-order saves order
- [ ] GET /api/v1/preferences/card-order returns saved order
- [ ] GET returns empty array when no order saved
- [ ] Order persists after page refresh
- [ ] New machine appears at end of order
- [ ] Deleted machine removed from order
- [ ] Debounce prevents rapid API calls
- [ ] Error toast shown on save failure
- [ ] Retry button in toast works
- [ ] "Saving..." indicator appears during save
- [ ] Invalid machine IDs filtered on load

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0130](US0130-drag-drop-card-reordering.md) | Requires | Drag-and-drop functionality | Draft |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| Alembic migrations | Framework | Available |
| SQLAlchemy JSON column | Framework | Available |
| useDebouncedCallback hook | Library | May need install |

---

## Estimation

**Story Points:** 5
**Complexity:** Medium - New API endpoints, database table, frontend integration

---

## Open Questions

None.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation from EP0011 |
| 2026-01-28 | Claude | Status: Draft -> Planned (PL0131, TS0131 created) |
| 2026-01-28 | Claude | Status: Planned -> In Progress -> Done (WF0017 complete) |
