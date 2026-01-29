# TS0131: Card Order Persistence

> **Status:** Complete
> **Epic:** [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md)
> **Created:** 2026-01-28
> **Last Updated:** 2026-01-28

## Overview

Test specification for card order persistence. Covers backend API endpoints (PUT/GET), frontend API client, debounced save behaviour, order reconciliation with new/deleted servers, and error handling with retry.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0131](../stories/US0131-card-order-persistence.md) | Card Order Persistence | P0 |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0131 | AC1 | Save card order on reorder | TC01, TC02, TC03 | Pending |
| US0131 | AC2 | Load card order on page load | TC04, TC05 | Pending |
| US0131 | AC3 | New machines added to end | TC06 | Pending |
| US0131 | AC4 | Deleted machines removed from order | TC07 | Pending |
| US0131 | AC5 | API endpoint for saving order | TC08, TC09 | Pending |
| US0131 | AC6 | API endpoint for loading order | TC10, TC11 | Pending |
| US0131 | AC7 | Save failure handling | TC12, TC13 | Pending |

**Coverage:** 7/7 ACs covered

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | API client, debounce hook, reconciliation logic |
| Integration | Yes | Backend API with database, Dashboard with API |
| E2E | Optional | Full drag-reorder-persist flow |

---

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Node.js 18+, Python 3.11+, npm/pip install completed |
| External Services | None |
| Test Data | Mock Server objects array |
| Database | SQLite test database (backend) |

---

## Test Cases

### TC01: Debounced save triggers after 500ms

**Type:** Unit | **Priority:** High | **Story:** US0131 AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | useDebouncedSave hook with 500ms delay | Hook initialised |
| When | debouncedSave called with order array | Timer started |
| And | 500ms elapses | Timer fires |
| Then | saveFn is called once with the order | API call made |

**Assertions:**
- [ ] saveFn not called before 500ms
- [ ] saveFn called exactly once after 500ms
- [ ] saveFn receives the order array

---

### TC02: Rapid calls only save final value

**Type:** Unit | **Priority:** High | **Story:** US0131 AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | useDebouncedSave hook with 500ms delay | Hook initialised |
| When | debouncedSave called 5 times in 200ms | Multiple calls |
| And | 500ms elapses after last call | Timer fires |
| Then | saveFn called once with last value | Single API call |

**Assertions:**
- [ ] saveFn called exactly once
- [ ] saveFn receives final order array (not intermediate)
- [ ] No memory leak from cancelled timers

---

### TC03: Saving indicator shown during save

**Type:** Integration | **Priority:** Medium | **Story:** US0131 AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Dashboard with servers loaded | Dashboard rendered |
| When | Card is drag-dropped to new position | Reorder occurs |
| And | Save operation is in progress | API call pending |
| Then | "Saving..." indicator is visible | Indicator shown |
| When | Save completes | API returns |
| Then | Indicator disappears | Indicator hidden |

**Assertions:**
- [ ] Loader2 spinner visible during save
- [ ] "Saving..." text displayed
- [ ] Indicator hidden after success
- [ ] Indicator hidden after error (replaced by error toast)

---

### TC04: Cards load in saved order

**Type:** Integration | **Priority:** High | **Story:** US0131 AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Saved order exists: ["c", "a", "b"] | Order in database |
| And | Servers fetched: [a, b, c] | Data available |
| When | Dashboard mounts | Component initialises |
| Then | Cards displayed in order: [c, a, b] | Saved order applied |

**Assertions:**
- [ ] First card is server "c"
- [ ] Second card is server "a"
- [ ] Third card is server "b"
- [ ] Load completes within 500ms

---

### TC05: Empty saved order uses default order

**Type:** Integration | **Priority:** Medium | **Story:** US0131 AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | No saved order exists | Empty order returned |
| And | Servers fetched: [a, b, c] | Data available |
| When | Dashboard mounts | Component initialises |
| Then | Cards in default order (alphabetical) | Default sort applied |

**Assertions:**
- [ ] API returns { order: [] }
- [ ] sortServers() default applied
- [ ] No error shown

---

### TC06: New server appended to end

**Type:** Integration | **Priority:** High | **Story:** US0131 AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Saved order: ["a", "b"] | Order in database |
| And | Servers fetched: [a, b, c] | New server "c" |
| When | Dashboard loads | Order reconciled |
| Then | Cards displayed: [a, b, c] | New server at end |

**Assertions:**
- [ ] Server "c" appears at position 3
- [ ] Saved order preserved for existing servers
- [ ] No automatic save triggered for appended server

---

### TC07: Deleted server filtered from order

**Type:** Integration | **Priority:** High | **Story:** US0131 AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Saved order: ["a", "b", "c"] | Order in database |
| And | Servers fetched: [a, c] | Server "b" deleted |
| When | Dashboard loads | Order reconciled |
| Then | Cards displayed: [a, c] | Deleted server skipped |

**Assertions:**
- [ ] Only 2 cards rendered
- [ ] Server "b" not in DOM
- [ ] No error or gap in display
- [ ] Relative order of a, c preserved

---

### TC08: PUT /api/v1/preferences/card-order saves order

**Type:** Unit (Backend) | **Priority:** High | **Story:** US0131 AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Valid API key | Authenticated |
| When | PUT /api/v1/preferences/card-order called | Request sent |
| And | Body: { "order": ["s1", "s2", "s3"] } | Order provided |
| Then | Response status 200 | Success |
| And | Response body: { "status": "saved", "timestamp": "..." } | Confirmation |

**Assertions:**
- [ ] HTTP 200 returned
- [ ] Response contains "status": "saved"
- [ ] Response contains valid ISO timestamp
- [ ] Config table updated with order

---

### TC09: PUT updates existing order (upsert)

**Type:** Unit (Backend) | **Priority:** Medium | **Story:** US0131 AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Existing saved order: ["a", "b"] | Order exists |
| When | PUT with new order: ["b", "a", "c"] | Update request |
| Then | Order is replaced entirely | New order saved |
| And | Only one Config row exists | No duplicates |

**Assertions:**
- [ ] Old order completely replaced
- [ ] New order retrieved on GET
- [ ] Single row in Config table for key
- [ ] updated_at timestamp changed

---

### TC10: GET /api/v1/preferences/card-order returns order

**Type:** Unit (Backend) | **Priority:** High | **Story:** US0131 AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Saved order: ["s1", "s2"] | Order in database |
| When | GET /api/v1/preferences/card-order | Request sent |
| Then | Response status 200 | Success |
| And | Response body: { "order": ["s1", "s2"] } | Order returned |

**Assertions:**
- [ ] HTTP 200 returned
- [ ] Response contains "order" array
- [ ] Order matches saved value
- [ ] Array elements are strings

---

### TC11: GET returns empty array when no order saved

**Type:** Unit (Backend) | **Priority:** Medium | **Story:** US0131 AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | No saved order exists | Config row absent |
| When | GET /api/v1/preferences/card-order | Request sent |
| Then | Response status 200 | Success (not 404) |
| And | Response body: { "order": [] } | Empty array |

**Assertions:**
- [ ] HTTP 200 returned (not 404)
- [ ] Response contains "order": []
- [ ] No error in response

---

### TC12: Error toast shown on save failure

**Type:** Integration | **Priority:** High | **Story:** US0131 AC7

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Dashboard with servers | Dashboard rendered |
| And | API configured to fail | Network error mocked |
| When | Card is reordered | Drag-drop completes |
| And | Save fails | API returns error |
| Then | Error toast is displayed | Toast visible |
| And | Toast contains error message | Message shown |

**Assertions:**
- [ ] Toast has error styling (red border)
- [ ] AlertCircle icon displayed
- [ ] Error message visible
- [ ] UI order unchanged (optimistic update preserved)

---

### TC13: Retry button triggers new save

**Type:** Integration | **Priority:** High | **Story:** US0131 AC7

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Error toast displayed | Save failed |
| When | User clicks "Retry" button | Button clicked |
| Then | New save request made | API called again |
| And | Error toast dismissed | Toast hidden |

**Assertions:**
- [ ] saveCardOrder called with current order
- [ ] Toast dismissed on click
- [ ] If retry succeeds, no new error
- [ ] If retry fails, new error toast shown

---

### TC14: Auth required for PUT endpoint

**Type:** Unit (Backend) | **Priority:** High | **Story:** US0131 AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | No API key provided | Missing auth |
| When | PUT /api/v1/preferences/card-order | Request sent |
| Then | Response status 401 | Unauthorised |

**Assertions:**
- [ ] HTTP 401 returned
- [ ] No data modified
- [ ] Error message indicates auth required

---

### TC15: Auth required for GET endpoint

**Type:** Unit (Backend) | **Priority:** High | **Story:** US0131 AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | No API key provided | Missing auth |
| When | GET /api/v1/preferences/card-order | Request sent |
| Then | Response status 401 | Unauthorised |

**Assertions:**
- [ ] HTTP 401 returned
- [ ] Error message indicates auth required

---

### TC16: Frontend API client handles network error

**Type:** Unit | **Priority:** Medium | **Story:** US0131 AC7

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Network unavailable | fetch throws |
| When | saveCardOrder() called | Function invoked |
| Then | Promise rejects with ApiError | Error thrown |

**Assertions:**
- [ ] ApiError instance thrown
- [ ] Error message indicates network failure
- [ ] No unhandled promise rejection

---

## Fixtures

```yaml
mockServers:
  - id: "server-a"
    hostname: "alpha"
    display_name: "Alpha Server"
    status: "online"
    is_inactive: false

  - id: "server-b"
    hostname: "beta"
    display_name: "Beta Server"
    status: "online"
    is_inactive: false

  - id: "server-c"
    hostname: "gamma"
    display_name: "Gamma Server"
    status: "offline"
    is_inactive: false

savedOrders:
  standard: ["server-a", "server-b", "server-c"]
  reversed: ["server-c", "server-b", "server-a"]
  partial: ["server-a", "server-c"]
  withDeleted: ["server-a", "deleted-id", "server-c"]
  empty: []
```

---

## Mock Setup

### Backend Test Setup

```python
import pytest
from httpx import AsyncClient, ASGITransport
from homelab_cmd.main import app

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

@pytest.fixture
def auth_headers():
    return {"X-API-Key": "test-api-key"}
```

### Frontend API Mock

```typescript
import { vi } from 'vitest';
import * as preferencesApi from '../api/preferences';

vi.mock('../api/preferences', () => ({
  saveCardOrder: vi.fn(),
  getCardOrder: vi.fn(),
}));

// Setup for success
vi.mocked(preferencesApi.getCardOrder).mockResolvedValue({ order: ['a', 'b'] });
vi.mocked(preferencesApi.saveCardOrder).mockResolvedValue({ status: 'saved', timestamp: '2026-01-28T10:00:00Z' });

// Setup for failure
vi.mocked(preferencesApi.saveCardOrder).mockRejectedValue(new ApiError('Network error', 0));
```

### Debounce Timer Mock

```typescript
import { vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// In test:
debouncedSave(['a', 'b']);
vi.advanceTimersByTime(500);
expect(saveFn).toHaveBeenCalledWith(['a', 'b']);
```

---

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC01 | Debounced save triggers after 500ms | Pending | - |
| TC02 | Rapid calls only save final value | Pending | - |
| TC03 | Saving indicator shown during save | Pending | - |
| TC04 | Cards load in saved order | Pending | - |
| TC05 | Empty saved order uses default order | Pending | - |
| TC06 | New server appended to end | Pending | - |
| TC07 | Deleted server filtered from order | Pending | - |
| TC08 | PUT /api/v1/preferences/card-order saves order | Pending | - |
| TC09 | PUT updates existing order (upsert) | Pending | - |
| TC10 | GET /api/v1/preferences/card-order returns order | Pending | - |
| TC11 | GET returns empty array when no order saved | Pending | - |
| TC12 | Error toast shown on save failure | Pending | - |
| TC13 | Retry button triggers new save | Pending | - |
| TC14 | Auth required for PUT endpoint | Pending | - |
| TC15 | Auth required for GET endpoint | Pending | - |
| TC16 | Frontend API client handles network error | Pending | - |

---

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0011](../epics/EP0011-advanced-dashboard-ui.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |
| Plan | [PL0131](../plans/PL0131-card-order-persistence.md) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial spec |
