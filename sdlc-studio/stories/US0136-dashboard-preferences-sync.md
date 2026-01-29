# US0136: Dashboard Preferences Sync

> **Status:** Done
> **Epic:** [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md)
> **Owner:** Darren
> **Created:** 2026-01-28
> **Story Points:** 3
> **Plan:** [PL0136](../plans/PL0136-dashboard-preferences-sync.md)
> **Test Spec:** [TS0136](../test-specs/TS0136-dashboard-preferences-sync.md)
> **Workflow:** [WF0022](../workflows/WF0022-dashboard-preferences-sync.md)

## User Story

**As a** Darren (Homelab Operator)
**I want** my dashboard preferences to sync across devices
**So that** I see the same layout on my phone and laptop

## Context

### Persona Reference

**Darren** - Technical professional who primarily uses desktop but occasionally checks status on tablet or phone. Expects consistent experience across devices.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

With card ordering (US0131) and section collapsing (US0132) being persisted, all dashboard preferences should be consolidated into a single sync mechanism. This ensures Darren's carefully configured dashboard looks the same whether he's at his desk or glancing at his phone.

---

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | Consistency | Single source of truth | Backend storage, not localStorage |
| PRD | Data | Single user system | No conflict resolution needed |
| Epic | Performance | Reorder <2s including save | Batch preference saves |

---

## Acceptance Criteria

### AC1: Unified preference storage

- **Given** dashboard preferences (card order, collapsed sections, view mode)
- **When** any preference changes
- **Then** all preferences are stored in the same backend table
- **And** preferences are keyed by preference_key

### AC2: Preferences loaded on page load

- **Given** saved preferences exist in the database
- **When** the dashboard page loads
- **Then** all preferences are fetched in a single API call
- **And** card order, collapsed sections, and other settings are applied
- **And** loading completes in <500ms after data fetch

### AC3: Changes saved immediately

- **Given** the user changes a preference (reorders cards, collapses section)
- **When** the change is made
- **Then** the preference is saved to the backend within 500ms (debounced)
- **And** a subtle "Saved" indicator appears briefly

### AC4: Preference structure

- **Given** the preferences API endpoint
- **When** preferences are retrieved
- **Then** the response contains:
  ```json
  {
    "card_order": {
      "servers": ["guid-1", "guid-2"],
      "workstations": ["guid-3"]
    },
    "collapsed_sections": ["workstations"],
    "view_mode": "grid"
  }
  ```

### AC5: Conflict resolution (last-write-wins)

- **Given** preferences are modified on two devices simultaneously
- **When** both saves reach the server
- **Then** the last save wins (by timestamp)
- **And** no error is shown to the user
- **And** the next load shows the latest saved preferences

### AC6: Loading state

- **Given** preferences are being loaded
- **When** the dashboard renders
- **Then** a skeleton/loading state is shown for the card grid
- **And** the loading state clears when preferences load
- **And** the loading state shows for a maximum of 2 seconds before fallback

### AC7: Fallback to defaults

- **Given** preferences fail to load (network error, server error)
- **When** the dashboard renders
- **Then** default preferences are used (alphabetical order, all sections expanded)
- **And** a toast notification shows "Preferences unavailable, using defaults"
- **And** user changes still attempt to save (retry on next success)

---

## Scope

### In Scope

- Consolidated preferences API endpoint
- Card order per section
- Collapsed sections list
- View mode preference (grid for now)
- Single-call load, debounced save
- Default fallback on error
- Loading state during fetch

### Out of Scope

- Multi-user support / user-specific preferences
- Preference history / undo
- Selective sync (all or nothing)
- Real-time sync between open tabs
- Offline mode / local caching

---

## Technical Notes

### API Design

**GET /api/v1/preferences/dashboard**

Response (200):
```json
{
  "card_order": {
    "servers": ["server-guid-1", "server-guid-2"],
    "workstations": ["workstation-guid-1"]
  },
  "collapsed_sections": ["workstations"],
  "view_mode": "grid",
  "updated_at": "2026-01-28T10:30:00Z"
}
```

Response (200, no preferences):
```json
{
  "card_order": { "servers": [], "workstations": [] },
  "collapsed_sections": [],
  "view_mode": "grid",
  "updated_at": null
}
```

**PUT /api/v1/preferences/dashboard**

Request:
```json
{
  "card_order": {
    "servers": ["server-guid-1", "server-guid-2"],
    "workstations": ["workstation-guid-1"]
  },
  "collapsed_sections": ["workstations"],
  "view_mode": "grid"
}
```

Response (200):
```json
{
  "status": "saved",
  "updated_at": "2026-01-28T10:35:00Z"
}
```

### Database Schema

Extends the `dashboard_preferences` table from US0131:

```sql
-- Preference keys:
-- 'dashboard' - consolidated dashboard preferences (JSON)
-- Legacy: 'card_order' - to be migrated into 'dashboard'
```

### Backend Implementation

```python
# backend/src/homelab_cmd/api/schemas/preferences.py
from pydantic import BaseModel
from typing import Optional

class CardOrder(BaseModel):
    servers: list[str] = []
    workstations: list[str] = []

class DashboardPreferences(BaseModel):
    card_order: CardOrder = CardOrder()
    collapsed_sections: list[str] = []
    view_mode: str = "grid"

# backend/src/homelab_cmd/api/routes/preferences.py
@router.get("/dashboard")
async def get_dashboard_preferences(db: Session = Depends(get_db)):
    pref = db.query(DashboardPreference).filter_by(preference_key="dashboard").first()
    if pref:
        return {**pref.preference_value, "updated_at": pref.updated_at.isoformat()}
    return DashboardPreferences().dict() | {"updated_at": None}

@router.put("/dashboard")
async def save_dashboard_preferences(prefs: DashboardPreferences, db: Session = Depends(get_db)):
    pref = db.query(DashboardPreference).filter_by(preference_key="dashboard").first()
    if pref:
        pref.preference_value = prefs.dict()
        pref.updated_at = datetime.utcnow()
    else:
        pref = DashboardPreference(
            preference_key="dashboard",
            preference_value=prefs.dict()
        )
        db.add(pref)
    db.commit()
    return {"status": "saved", "updated_at": pref.updated_at.isoformat()}
```

### Frontend Implementation

```typescript
// frontend/src/hooks/useDashboardPreferences.ts
import { useQuery, useMutation } from '@tanstack/react-query';
import { useDebouncedCallback } from 'use-debounce';

export function useDashboardPreferences() {
  const { data: preferences, isLoading, error } = useQuery({
    queryKey: ['dashboard-preferences'],
    queryFn: fetchDashboardPreferences,
    staleTime: 30000,
  });

  const mutation = useMutation({
    mutationFn: saveDashboardPreferences,
  });

  const debouncedSave = useDebouncedCallback(
    (prefs: DashboardPreferences) => mutation.mutate(prefs),
    500
  );

  return {
    preferences: preferences ?? DEFAULT_PREFERENCES,
    isLoading,
    error,
    savePreferences: debouncedSave,
    isSaving: mutation.isPending,
  };
}
```

### Files to Create/Modify

- `backend/src/homelab_cmd/api/routes/preferences.py` - Add/update endpoints
- `backend/src/homelab_cmd/api/schemas/preferences.py` - Add schemas
- `frontend/src/api/preferences.ts` - Update API client
- `frontend/src/hooks/useDashboardPreferences.ts` - New hook
- `frontend/src/pages/Dashboard.tsx` - Use hook, handle loading state

### Migration

If US0131 is implemented first with separate `card_order` key, add migration:
```python
# Migrate old card_order to new dashboard preferences structure
old_pref = db.query(DashboardPreference).filter_by(preference_key="card_order").first()
if old_pref:
    new_prefs = DashboardPreferences(card_order=CardOrder(servers=old_pref.preference_value))
    # ... create new dashboard preference, delete old
```

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | First time user (no preferences) | Use defaults, first save creates record |
| 2 | Network error on load | Toast warning, use defaults |
| 3 | Network error on save | Toast error with retry button |
| 4 | Rapid changes (10+ in 2 seconds) | Only save final state (debounce) |
| 5 | Page closed during debounce | Preference may not save (acceptable) |
| 6 | Invalid preference data from server | Log error, use defaults |
| 7 | Server returns 500 on save | Retry up to 3 times with backoff |
| 8 | Very large preference object | API validates max size (reject if >10KB) |

---

## Test Scenarios

- [x] GET /api/v1/preferences/dashboard returns saved preferences
- [x] GET returns defaults when no preferences exist
- [x] PUT /api/v1/preferences/dashboard saves preferences
- [x] Preferences persist across page refresh
- [x] Preferences sync across browser tabs (on refresh)
- [x] Debounce prevents rapid API calls
- [x] Loading skeleton shows while fetching
- [x] Error toast shown on load failure
- [x] Error toast with retry on save failure
- [x] "Saved" indicator appears after successful save
- [x] Defaults used when fetch fails

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0131](US0131-card-order-persistence.md) | Extends | Database table, basic API | Draft |
| [US0132](US0132-server-workstation-grouping.md) | Integrates | Collapsed sections preference | Draft |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| @tanstack/react-query | Library | Check if installed |
| use-debounce | Library | Check if installed |

---

## Estimation

**Story Points:** 3
**Complexity:** Low-Medium - Consolidates existing work, adds loading states

---

## Open Questions

None.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation from EP0011 |
| 2026-01-28 | Claude | Status: Draft -> Planned (PL0136, TS0136 created) |
| 2026-01-28 | Claude | Status: In Progress -> Done. Implemented unified preferences endpoint, useDashboardPreferences hook, Dashboard refactor. Backend tests (14 passed), frontend hook tests (11 passed). |
