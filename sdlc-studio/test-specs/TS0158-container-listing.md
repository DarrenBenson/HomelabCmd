# TS0158: Container Listing via SSH

> **Status:** Done
> **Story:** [US0158: Container Listing via SSH](../stories/US0158-container-listing.md)
> **Epic:** [EP0014: Docker Container Monitoring](../epics/EP0014-docker-container-monitoring.md)
> **Created:** 2026-02-18
> **Last Updated:** 2026-02-18

## Overview

Test specification for the container listing API endpoint that retrieves Docker container information via SSH and returns it with caching, sorting, and error handling.

## Coverage Summary

| Area | Unit Tests | Integration Tests | Status |
|------|------------|-------------------|--------|
| API endpoint | 4 | 3 | Done |
| SSH parsing | 3 | - | Done |
| Caching | 3 | - | Done |
| Error handling | 4 | - | Done |
| **Total** | **14** | **3** | **Done** |

---

## Test Cases

### AC1: API Endpoint Returns Container List

| TC ID | Description | Priority | Type |
|-------|-------------|----------|------|
| TC01 | GET /api/v1/servers/{id}/containers returns 200 with container list | High | Integration |
| TC02 | Response includes id, name, image, state, status, ports for each container | High | Unit |
| TC03 | Response includes server_id, total count, cached flag, fetched_at | Medium | Unit |
| TC04 | Returns 404 for non-existent server | Medium | Unit |

### AC2: Retrieves Containers via SSH

| TC ID | Description | Priority | Type |
|-------|-------------|----------|------|
| TC05 | Executes `docker ps -a --format '{{json .}}'` via SSH executor | High | Integration |
| TC06 | Parses multi-line JSON output into container objects | High | Unit |
| TC07 | Handles empty output (no containers) | Medium | Unit |

### AC3: Includes Both Running and Stopped Containers

| TC ID | Description | Priority | Type |
|-------|-------------|----------|------|
| TC08 | Response includes both running and exited containers | High | Integration |
| TC09 | Containers sorted: running first, then alphabetically by name | Medium | Unit |

### AC4: Response Caching

| TC ID | Description | Priority | Type |
|-------|-------------|----------|------|
| TC10 | Second request within 60s returns cached=true | High | Unit |
| TC11 | Request after 60s fetches fresh data (cached=false) | Medium | Unit |
| TC12 | Cache is per-server (different servers don't share cache) | Medium | Unit |

### AC5: Graceful Handling for Non-Docker Servers

| TC ID | Description | Priority | Type |
|-------|-------------|----------|------|
| TC13 | Server with has_docker=false returns empty containers array | High | Unit |
| TC14 | No SSH connection attempted for non-Docker servers | Medium | Unit |

### AC6: Error Handling

| TC ID | Description | Priority | Type |
|-------|-------------|----------|------|
| TC15 | SSH connection failure returns 503 with error details | High | Unit |
| TC16 | SSH timeout returns 408 | Medium | Unit |

### AC7: Uptime Calculation

| TC ID | Description | Priority | Type |
|-------|-------------|----------|------|
| TC17 | Running containers include uptime_seconds > 0 | Medium | Unit |

---

## Test Files

| File | Framework | Tests |
|------|-----------|-------|
| tests/test_container_listing.py | pytest | Backend API and service tests |
| frontend/src/__tests__/scan-results-display.test.tsx | Vitest | Frontend container display tests |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-02-18 | Claude | Retroactive test-spec created from US0158 acceptance criteria |
