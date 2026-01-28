# PL0047: Scan History View Implementation Plan

> **Story:** [US0040: Scan History View](../stories/US0040-scan-history.md)
> **Status:** Ready
> **Created:** 2026-01-21
> **Complexity:** Low-Medium

## Overview

Implement a scan history page that displays all scans with filtering, pagination, and delete functionality. Reuses existing patterns from AlertsPage.tsx and existing scan API infrastructure.

## Dependencies

| Component | Status | Notes |
|-----------|--------|-------|
| US0038: Scan Initiation | Done | Provides scan creation and list endpoint |
| US0039: Scan Results Display | Done | Provides scan detail view |
| Backend GET /scans | Exists | Already supports hostname filter, pagination |
| Backend DELETE /scans/{id} | Missing | Needs implementation |
| ScanResultsPage | Done | For viewing scan details |
| Pagination component | Done | Reusable component |

## Implementation Phases

### Phase 1: Backend API Extensions

**Files:**
- `backend/src/homelab_cmd/api/routes/scan.py`
- `backend/src/homelab_cmd/api/schemas/scan.py`

**Changes:**

1.1. Add DELETE endpoint for scan deletion:
```python
@router.delete(
    "/scans/{scan_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="delete_scan",
    summary="Delete a scan",
    responses={**AUTH_RESPONSES, 404: {"description": "Scan not found"}},
)
async def delete_scan(scan_id: int, ...) -> None:
```

1.2. Extend GET /scans with additional filters:
- Add `status` query parameter (completed, failed)
- Add `scan_type` query parameter (quick, full)
- Schema update: Add `limit` and `offset` to response

**Acceptance Criteria Coverage:** AC5 (Delete)

---

### Phase 2: Frontend API Client

**Files:**
- `frontend/src/api/scans.ts`
- `frontend/src/types/scan.ts`

**Changes:**

2.1. Add list scans function:
```typescript
export interface ScanListFilters {
  hostname?: string;
  status?: 'completed' | 'failed';
  scan_type?: 'quick' | 'full';
  limit?: number;
  offset?: number;
}

export interface ScanListResponse {
  scans: ScanListItem[];
  total: number;
  limit: number;
  offset: number;
}

export async function getScans(filters?: ScanListFilters): Promise<ScanListResponse>
```

2.2. Add delete scan function:
```typescript
export async function deleteScan(scanId: number): Promise<void>
```

2.3. Add ScanListItem type (subset of ScanStatusResponse without results):
```typescript
export interface ScanListItem {
  scan_id: number;
  hostname: string;
  scan_type: ScanType;
  status: ScanStatus;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
}
```

**Acceptance Criteria Coverage:** AC2, AC3, AC5

---

### Phase 3: Scan History Page

**Files:**
- `frontend/src/pages/ScanHistoryPage.tsx` (new)
- `frontend/src/App.tsx`

**Changes:**

3.1. Create ScanHistoryPage component:
- Header with back button and title
- Filter bar (hostname input, status dropdown, type dropdown)
- Scan table with columns: Hostname, Type, Status, Date, Actions
- Pagination using existing Pagination component
- Empty state: "No scans yet" with CTA
- Delete confirmation modal

3.2. Table row features:
- Click row → navigate to /scans/:scanId
- Status badge: green checkmark (completed), red X (failed), yellow spinner (pending/running)
- Delete button (trash icon) with confirmation

3.3. Add route to App.tsx:
```typescript
<Route path="/scans/history" element={<ScanHistoryPage />} />
```

**Acceptance Criteria Coverage:** AC1, AC2, AC3, AC4, AC5

---

### Phase 4: Delete Confirmation Modal

**Files:**
- `frontend/src/components/DeleteConfirmModal.tsx` (new, or inline in page)

**Changes:**

4.1. Simple modal component:
```typescript
interface DeleteConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  hostname: string;
  scanDate: string;
  isDeleting: boolean;
}
```

4.2. Modal content:
- Warning icon
- "Delete scan for {hostname}?"
- "This action cannot be undone."
- Cancel and Delete buttons

**Acceptance Criteria Coverage:** AC5

---

### Phase 5: Navigation Integration

**Files:**
- `frontend/src/pages/Dashboard.tsx` (optional sidebar/menu update)

**Changes:**

5.1. Ensure scan history is accessible via navigation
- Could be a link from Dashboard or Settings
- For now: Direct URL access /scans/history

**Acceptance Criteria Coverage:** AC1

## File Summary

| File | Action | Phase |
|------|--------|-------|
| backend/src/homelab_cmd/api/routes/scan.py | Modify | 1 |
| backend/src/homelab_cmd/api/schemas/scan.py | Modify | 1 |
| frontend/src/api/scans.ts | Modify | 2 |
| frontend/src/types/scan.ts | Modify | 2 |
| frontend/src/pages/ScanHistoryPage.tsx | Create | 3 |
| frontend/src/App.tsx | Modify | 3 |
| frontend/src/components/DeleteConfirmModal.tsx | Create | 4 |

## Test Considerations

### Backend Tests
- DELETE /scans/{id} returns 204 on success
- DELETE /scans/{id} returns 404 for non-existent scan
- GET /scans with status filter returns only matching scans
- GET /scans with scan_type filter returns only matching scans

### Frontend Tests
- ScanHistoryPage renders table with scans
- Filtering by hostname updates URL and filters results
- Filtering by status updates URL and filters results
- Clicking row navigates to scan detail
- Delete button shows confirmation modal
- Confirming delete removes scan from list
- Empty state shown when no scans
- Pagination works correctly

## Edge Cases

| Scenario | Handling |
|----------|----------|
| No scans | Show "No scans yet" message with link to scan page (US0042) |
| Filter returns empty | Show "No matching scans" with clear filters button |
| Delete in-progress scan | Allow - scan will be cancelled |
| Delete while loading | Disable delete button during operation |
| Navigate to deleted scan | 404 handled by ScanResultsPage |

## Rollback Plan

If issues arise:
1. Remove /scans/history route from App.tsx
2. Backend DELETE endpoint is additive, can remain

## Out of Scope

Per story definition:
- Comparing two scans
- Bulk delete
- Export history
- Automatic retention (30-day prune is separate task)

## Estimation

- Phase 1: Backend - Simple
- Phase 2: Frontend API - Simple
- Phase 3: History Page - Medium (main work)
- Phase 4: Delete Modal - Simple
- Phase 5: Navigation - Trivial

Total: ~3 story points (as estimated in story)
