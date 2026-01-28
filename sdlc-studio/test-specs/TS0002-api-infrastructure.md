# TS0002: API Infrastructure Tests

> **Status:** Complete
> **Epic:** [EP0001: Core Monitoring](../../epics/EP0001-core-monitoring.md)
> **Created:** 2026-01-18
> **Last Updated:** 2026-01-18

## Overview

Test specification for API infrastructure including authentication, health check, CORS, and OpenAPI documentation. This spec documents the tests implemented as part of US0045 (API Infrastructure and Authentication).

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0045](../../stories/US0045-api-infrastructure.md) | API Infrastructure and Authentication | High |

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | No | No complex business logic |
| Integration | Yes | FastAPI middleware, CORS |
| API | Yes | Authentication, health check, docs |
| E2E | No | API tests sufficient |

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Python 3.11+, pytest, httpx |
| External Services | None |
| Test Data | Test API key fixture |

---

## Test Cases

### TC001: Missing API key returns 401

**Type:** API
**Priority:** High
**Story:** US0045 AC1
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given no X-API-Key header | Request without auth |
| 2 | When GET /api/v1/protected | Request sent |
| 3 | Then 401 Unauthorized returned | Auth rejected |

#### Assertions

- [x] Status code is 401
- [x] Error code is "UNAUTHORIZED"
- [x] Message is "Invalid or missing API key"

---

### TC002: Empty API key returns 401

**Type:** API
**Priority:** High
**Story:** US0045 AC1
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given X-API-Key header is empty string | Empty key |
| 2 | When GET /api/v1/protected | Request sent |
| 3 | Then 401 Unauthorized returned | Auth rejected |

#### Assertions

- [x] Status code is 401
- [x] Error code is "UNAUTHORIZED"

---

### TC003: Invalid API key returns 401

**Type:** API
**Priority:** High
**Story:** US0045 AC1
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given X-API-Key is "wrong-key" | Invalid key |
| 2 | When GET /api/v1/protected | Request sent |
| 3 | Then 401 Unauthorized returned | Auth rejected |

#### Assertions

- [x] Status code is 401
- [x] Error code is "UNAUTHORIZED"

---

### TC004: Valid API key allows access

**Type:** API
**Priority:** High
**Story:** US0045 AC1
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given valid X-API-Key header | Correct key |
| 2 | When GET /api/v1/protected | Request sent |
| 3 | Then 200 OK with response | Access granted |

#### Assertions

- [x] Status code is 200
- [x] Response body present

---

### TC005: API key with whitespace trimmed

**Type:** API
**Priority:** Medium
**Story:** US0045 (edge case)
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given X-API-Key has leading/trailing spaces | "  key  " |
| 2 | When GET /api/v1/protected | Request sent |
| 3 | Then key trimmed and access granted | 200 OK |

#### Assertions

- [x] Status code is 200

---

### TC006: Health check without auth

**Type:** API
**Priority:** High
**Story:** US0045 AC2
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given no API key header | Unauthenticated |
| 2 | When GET /api/v1/system/health | Request sent |
| 3 | Then 200 OK with health status | No auth required |

#### Assertions

- [x] Status code is 200
- [x] Response has "status" = "healthy"

---

### TC007: Health check with auth still works

**Type:** API
**Priority:** Low
**Story:** US0045 AC2
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given valid API key provided | Authenticated |
| 2 | When GET /api/v1/system/health | Request sent |
| 3 | Then 200 OK (key ignored) | Works either way |

#### Assertions

- [x] Status code is 200

---

### TC008: Health response schema correct

**Type:** API
**Priority:** High
**Story:** US0045 AC2
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given application is running | Healthy state |
| 2 | When GET /api/v1/system/health | Request sent |
| 3 | Then response has all required fields | Schema valid |

#### Assertions

- [x] "status" field is "healthy"
- [x] "version" field is string
- [x] "uptime_seconds" field is number >= 0
- [x] "database" field present
- [x] "timestamp" field is ISO8601 format

---

### TC009: Health uptime increments

**Type:** API
**Priority:** Medium
**Story:** US0045 AC2
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given first health check | Get uptime1 |
| 2 | When second health check after delay | Get uptime2 |
| 3 | Then uptime2 >= uptime1 | Uptime increasing |

#### Assertions

- [x] Second uptime >= first uptime

---

### TC010: CORS headers on response

**Type:** API
**Priority:** High
**Story:** US0045 AC5
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given request with Origin header | Cross-origin request |
| 2 | When GET /api/v1/system/health | Request sent |
| 3 | Then access-control-allow-origin present | CORS enabled |

#### Assertions

- [x] access-control-allow-origin header present

---

### TC011: CORS preflight request works

**Type:** API
**Priority:** High
**Story:** US0045 AC5
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given OPTIONS request with CORS headers | Preflight |
| 2 | When OPTIONS /api/v1/protected | Preflight sent |
| 3 | Then 200 OK with CORS headers | Preflight allowed |

#### Assertions

- [x] Status code is 200
- [x] access-control-allow-methods header present

---

### TC012: Swagger UI accessible

**Type:** API
**Priority:** High
**Story:** US0045 AC3
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given application running | Docs available |
| 2 | When GET /api/docs | Request sent |
| 3 | Then HTML page returned | Swagger UI |

#### Assertions

- [x] Status code is 200
- [x] Content-Type is text/html

---

### TC013: ReDoc accessible

**Type:** API
**Priority:** High
**Story:** US0045 AC4
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given application running | Docs available |
| 2 | When GET /api/redoc | Request sent |
| 3 | Then HTML page returned | ReDoc |

#### Assertions

- [x] Status code is 200
- [x] Content-Type is text/html

---

### TC014: OpenAPI spec accessible

**Type:** API
**Priority:** High
**Story:** US0045 AC3
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given application running | Spec available |
| 2 | When GET /api/openapi.json | Request sent |
| 3 | Then valid JSON returned | OpenAPI spec |

#### Assertions

- [x] Status code is 200
- [x] Valid JSON response
- [x] Has "openapi" field
- [x] Has "info" field
- [x] Has "paths" field

---

### TC015: OpenAPI spec has title and version

**Type:** API
**Priority:** Medium
**Story:** US0045 AC3
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given OpenAPI spec | Spec loaded |
| 2 | When checking info field | Info present |
| 3 | Then title and version correct | Metadata valid |

#### Assertions

- [x] info.title is "HomelabCmd API"
- [x] info.version is "1.0.0"

---

### TC016: OpenAPI documents health endpoint

**Type:** API
**Priority:** Medium
**Story:** US0045 AC3
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given OpenAPI spec paths | Paths present |
| 2 | When checking for health endpoint | Path lookup |
| 3 | Then /api/v1/system/health documented | Endpoint found |

#### Assertions

- [x] "/api/v1/system/health" in paths

---

### TC017: OpenAPI documents API key security

**Type:** API
**Priority:** Medium
**Story:** US0045 AC1
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given OpenAPI spec | Spec loaded |
| 2 | When checking security schemes | Security defined |
| 3 | Then APIKeyHeader scheme documented | Auth documented |

#### Assertions

- [x] Security scheme with type "apiKey" exists

---

### TC018: All endpoints under /api/v1

**Type:** API
**Priority:** High
**Story:** US0045 AC6
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given OpenAPI spec paths | All paths |
| 2 | When checking path prefixes | Path analysis |
| 3 | Then all start with /api/v1 | Versioning correct |

#### Assertions

- [x] All paths start with "/api/v1"

---

### TC019: 401 error format is standard

**Type:** API
**Priority:** High
**Story:** US0045 (error handling)
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given request without API key | Auth failure |
| 2 | When 401 returned | Error response |
| 3 | Then format matches standard | Standard error |

#### Assertions

- [x] Response has "detail" object
- [x] detail has "code" field
- [x] detail has "message" field

---

## Fixtures

```yaml
# Shared test data for this spec
api_key: "test-api-key-12345"
invalid_key: "wrong-key"
```

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC001 | Missing API key returns 401 | Implemented | tests/test_auth.py |
| TC002 | Empty API key returns 401 | Implemented | tests/test_auth.py |
| TC003 | Invalid API key returns 401 | Implemented | tests/test_auth.py |
| TC004 | Valid API key allows access | Implemented | tests/test_auth.py |
| TC005 | API key with whitespace trimmed | Implemented | tests/test_auth.py |
| TC006 | Health check without auth | Implemented | tests/test_auth.py |
| TC007 | Health check with auth still works | Implemented | tests/test_auth.py |
| TC008 | Health response schema correct | Implemented | tests/test_health.py |
| TC009 | Health uptime increments | Implemented | tests/test_health.py |
| TC010 | CORS headers on response | Implemented | tests/test_auth.py |
| TC011 | CORS preflight request works | Implemented | tests/test_auth.py |
| TC012 | Swagger UI accessible | Implemented | tests/test_docs.py |
| TC013 | ReDoc accessible | Implemented | tests/test_docs.py |
| TC014 | OpenAPI spec accessible | Implemented | tests/test_docs.py |
| TC015 | OpenAPI spec has title and version | Implemented | tests/test_docs.py |
| TC016 | OpenAPI documents health endpoint | Implemented | tests/test_docs.py |
| TC017 | OpenAPI documents API key security | Implemented | tests/test_docs.py |
| TC018 | All endpoints under /api/v1 | Implemented | tests/test_docs.py |
| TC019 | 401 error format is standard | Implemented | tests/test_auth.py |

**All 19 test cases implemented (32 pytest tests)**

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../../prd.md) |
| TRD | [sdlc-studio/trd.md](../../trd.md) |
| Epic | [EP0001](../../epics/EP0001-core-monitoring.md) |
| Strategy | [sdlc-studio/tsd.md](../tsd.md) |

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial spec generation - all tests implemented |
