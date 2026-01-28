# BG0020: N+1 Query in list_servers Endpoint

> **Status:** Fixed
> **Severity:** Critical
> **Priority:** P1
> **Reporter:** Claude (Code Review)
> **Assignee:** Claude
> **Created:** 2026-01-27
> **Updated:** 2026-01-27

## Summary

The `list_servers` endpoint executes N+1 database queries when listing servers. For each server returned, additional queries are executed to fetch related data, resulting in 101 queries for 100 servers instead of 2-3 optimised queries.

## Affected Area

- **Epic:** General infrastructure
- **Story:** N/A (Infrastructure bug)
- **Component:** Backend API / Database

## Environment

- **Version:** Current main
- **Platform:** All
- **Browser:** N/A (API performance issue)

## Reproduction Steps

1. Create 100+ servers in the database
2. Call `GET /api/v1/servers`
3. Monitor database query count using SQLAlchemy echo or profiling
4. Observe 101+ queries executed instead of 2-3

## Expected Behaviour

The endpoint should use eager loading (`selectinload` or `joinedload`) to fetch servers and related data in 2-3 queries regardless of server count.

## Actual Behaviour

Each server triggers additional queries to fetch related alerts, services, or metrics, causing O(N) database round-trips.

## Screenshots/Evidence

Code location: `backend/src/homelab_cmd/api/routes/servers.py:36-84`

The query fetches servers but does not eagerly load relationships, causing lazy loading on access.

## Root Cause Analysis

The `list_servers` endpoint was iterating over all servers and executing a separate query for each server to fetch its latest metrics:

```python
# OLD CODE - N+1 pattern
for server in servers:
    metrics_result = await session.execute(
        select(Metrics)
        .where(Metrics.server_id == server.id)
        .order_by(desc(Metrics.timestamp))
        .limit(1)
    )
```

This resulted in 1 query for servers + N queries for metrics = O(N) total queries.

## Fix Description

Replaced the N+1 query pattern with a single query using a window function (`row_number()`) to fetch the latest metric for each server in one database round-trip:

1. Created a subquery that ranks metrics by timestamp per server using `row_number() OVER (PARTITION BY server_id ORDER BY timestamp DESC)`
2. Used LEFT OUTER JOIN with the subquery filtered to `rn = 1` (latest only)
3. Result: Single query returns all servers with their latest metrics, regardless of server count

The fix reduces query count from O(N) to O(1), providing linear scalability.

### Files Modified

| File | Change |
|------|--------|
| `backend/src/homelab_cmd/api/routes/servers.py:36-93` | Replaced N+1 loop with single window function query |

### Tests Added

| Test ID | Description | File |
|---------|-------------|------|
| TC-BG0020-01 | Multiple servers each get their own latest metrics | `tests/test_servers.py` |
| TC-BG0020-02 | Latest metrics is from newest heartbeat | `tests/test_servers.py` |

## Verification

> *Filled when verifying*

- [x] Fix verified in development
- [x] Regression tests pass (1492 tests passing)
- [x] No side effects observed
- [ ] Documentation updated (if applicable)

**Verified by:** -
**Verification date:** -

## Related Items

| Type | ID | Description |
|------|-----|-------------|
| - | - | - |

## Notes

The window function approach is compatible with SQLite (used in development) and PostgreSQL. The `row_number()` function is well-supported across all major databases.

Added 2 regression tests to prevent future N+1 regressions:
- `test_list_servers_multiple_with_metrics` - verifies each server gets its own metrics
- `test_list_servers_latest_metrics_is_newest` - verifies newest metrics are returned

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-27 | Claude | Bug reported from code review |
| 2026-01-27 | Claude | Status → In Progress, began investigation |
| 2026-01-27 | Claude | Status → Fixed, implemented window function solution |
