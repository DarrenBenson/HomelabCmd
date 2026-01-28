# BG0002: Export Button Missing Authentication Header

> **Status:** Closed
> **Severity:** High
> **Priority:** High
> **Reporter:** User
> **Assignee:** Claude
> **Created:** 2026-01-21
> **Updated:** 2026-01-21

## Summary

The ExportButton component used raw `fetch()` without the `X-API-Key` header, causing all export requests to fail with 401 Unauthorized. Other API calls in the frontend correctly use the authenticated API client, but the export functionality bypassed it.

## Affected Area

- **Epic:** [EP0007: Metrics and Reporting](../epics/EP0007-metrics-and-reporting.md)
- **Story:** [US0048: Metrics Data Export](../stories/US0048-metrics-data-export.md)
- **Component:** Frontend - ExportButton

## Environment

- **Version:** 1.0.0
- **Platform:** Docker (local deployment)
- **Browser:** All browsers

## Reproduction Steps

1. Start the application with `docker compose up`
2. Navigate to a server detail page
3. Click the Export button and select CSV or JSON
4. Observe 401 Unauthorized error in browser console

## Expected Behaviour

Export should download a CSV or JSON file containing the server's metrics data.

## Actual Behaviour

```
GET http://studypc:8081/api/v1/servers/study-pc/metrics/export?range=24h&format=csv 401 (Unauthorized)
Export failed: Error: Export failed
```

## Screenshots/Evidence

Browser console error:
```
index-BtmhFmGF.js:11 GET http://studypc:8081/api/v1/servers/study-pc/metrics/export?range=24h&format=csv 401 (Unauthorized)
index-BtmhFmGF.js:11 Export failed: Error: Export failed
```

## Root Cause Analysis

The `ExportButton` component used raw `fetch()` instead of the authenticated API client:

```typescript
// Bug: No authentication header
const response = await fetch(
  `/api/v1/servers/${serverId}/metrics/export?range=${timeRange}&format=${format}`,
);
```

The API client (`src/api/client.ts`) adds `X-API-Key` header to all requests, but ExportButton bypassed it because it needed access to the response blob for file download, which the standard API client doesn't support.

## Fix Description

Added the `X-API-Key` header directly to the fetch call in ExportButton:

```typescript
const API_KEY = import.meta.env.VITE_API_KEY || 'dev-key-change-me';

const response = await fetch(
  `/api/v1/servers/${serverId}/metrics/export?range=${timeRange}&format=${format}`,
  {
    headers: {
      'X-API-Key': API_KEY,
    },
  },
);
```

### Files Modified

| File | Change |
|------|--------|
| `frontend/src/components/ExportButton.tsx` | Added API_KEY import and X-API-Key header to fetch call |
| `frontend/src/components/ExportButton.test.tsx` | Updated 5 tests to verify authentication header is included |

### Tests Added

| Test ID | Description | File |
|---------|-------------|------|
| TC0048-104 | Verify CSV export includes X-API-Key header | ExportButton.test.tsx |
| TC0048-105 | Verify JSON export includes X-API-Key header | ExportButton.test.tsx |
| TC0048-108a | Verify time range export includes X-API-Key header | ExportButton.test.tsx |
| TC0048-108b | Verify 12m export includes X-API-Key header | ExportButton.test.tsx |
| - | Verify server ID export includes X-API-Key header | ExportButton.test.tsx |

## Verification

- [x] Fix verified in development
- [x] Regression tests pass
- [x] No side effects observed
- [x] Documentation updated (if applicable)

**Verified by:** Claude
**Verification date:** 2026-01-21

## Related Items

| Type | ID | Description |
|------|-----|-------------|
| Story | US0048 | Metrics Data Export |
| Epic | EP0007 | Metrics and Reporting |

## Notes

### Why Tests Didn't Catch This

This bug illustrates the **E2E mocking blindspot** documented in the project's lessons learned:

1. **Unit tests mocked `fetch` globally** - The mock always returned `ok: true` regardless of whether authentication was included
2. **Tests only verified URL** - Assertions checked `expect.stringContaining('/metrics/export')` but not the request headers
3. **No contract tests** - No tests verified the frontend request matched the backend's expected format

### Lesson Learned

When testing API calls, always verify the **complete request**, not just the endpoint:

```typescript
// Before: Only checked URL (insufficient)
expect(mockFetch).toHaveBeenCalledWith(
  expect.stringContaining('/metrics/export'),
);

// After: Also checks headers (correct)
expect(mockFetch).toHaveBeenCalledWith(
  expect.stringContaining('/metrics/export'),
  expect.objectContaining({
    headers: expect.objectContaining({
      'X-API-Key': expect.any(String),
    }),
  }),
);
```

This pattern should be applied to all frontend API call tests.

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-21 | User | Bug reported |
| 2026-01-21 | Claude | Root cause identified |
| 2026-01-21 | Claude | Fix implemented and verified |
| 2026-01-21 | Claude | Bug closed |
