# PL0019: OpenAPI 3.1 Production Compliance - Implementation Plan

> **Status:** Complete
> **Story:** [US0050: OpenAPI 3.1 Production Compliance](../stories/US0050-openapi-compliance.md)
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Created:** 2026-01-19
> **Language:** Python

## Overview

This plan addresses a critical NFR gap: the API lacks OpenAPI 3.1 production best practices compliance. The implementation adds comprehensive OpenAPI metadata, operation IDs, response documentation, and field descriptions across the entire API surface, validated by a new compliance test suite.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | OpenAPI Version | `openapi` field starts with "3.1" |
| AC2 | Operation IDs | All operations have unique operationId following `{verb}_{resource}` convention |
| AC3 | Metadata Complete | contact, license, and servers arrays populated |
| AC4 | Security Scheme | API key auth defined with header location and X-API-Key name |
| AC5 | Tag Descriptions | All tags have non-empty descriptions |
| AC6 | Response Codes | Authenticated endpoints document 401; path param endpoints document 404 |
| AC7 | Schema Descriptions | Request body schemas have field descriptions |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.11+
- **Framework:** FastAPI 0.109+
- **Test Framework:** pytest 8.0+

### Relevant Best Practices

- Use `Field(description=...)` for all Pydantic schema fields
- Use `operation_id` parameter in route decorators
- Define `openapi_tags` with descriptions in FastAPI app configuration
- Create shared response definitions for consistent error documentation
- Follow `{verb}_{resource}` naming convention for operation IDs

### Library Documentation (Context7)

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| FastAPI | /tiangolo/fastapi | OpenAPI customisation | `openapi_tags`, `contact`, `license_info`, `servers` |
| Pydantic | /pydantic/pydantic | Field descriptions | `Field(description=..., examples=[...])` |

### Existing Patterns

- Routes already use `response_model` for type hints
- Pydantic models use `ConfigDict(from_attributes=True)` for ORM mapping
- Error responses already use `{"code": "...", "message": "..."}` format
- Security dependency `verify_api_key` already defined in `api/deps.py`

## Recommended Approach

**Strategy:** Test-After
**Rationale:** This is a documentation/metadata enhancement with no functional changes. The compliance tests validate the OpenAPI spec structure, which can only be tested after the metadata is added.

### Test Priority

1. OpenAPI version validation (AC1)
2. Operation ID presence and convention (AC2)
3. Metadata completeness - contact, license, servers (AC3)
4. Tag descriptions (AC5)
5. Response code documentation (AC6)
6. Schema field descriptions (AC7)

### Documentation Updates Required

- [x] TRD Section 4.1 - OpenAPI 3.1 Requirements
- [x] Test Strategy - OpenAPI Specification Testing section
- [x] Definition of Done - API Endpoints Checklist

## Implementation Steps

### Phase 1: Documentation Updates

**Goal:** Establish requirements and tracking before implementation

#### Step 1.1: Update TRD

- [x] Add Section 4.1 OpenAPI 3.1 Requirements
- [x] Document operation ID conventions
- [x] Document tag descriptions
- [x] Document error response schema

**Files to modify:**
- `sdlc-studio/trd.md` - Add Section 4.1

#### Step 1.2: Update Test Strategy

- [x] Add OpenAPI Specification Testing section
- [x] Add schemathesis to automation framework stack
- [x] Add OpenAPI compliance to quality gates

**Files to modify:**
- `sdlc-studio/tsd.md` - Add testing section

#### Step 1.3: Update Definition of Done

- [x] Add API Endpoints Checklist

**Files to modify:**

### Phase 2: Foundation

**Goal:** Create reusable error schemas and response definitions

#### Step 2.1: Create Error Schemas

- [x] Create `ErrorDetail` model with code and message fields
- [x] Create `ErrorResponse` wrapper model
- [x] Add field descriptions and examples

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/errors.py` - New file

#### Step 2.2: Create Shared Responses

- [x] Define `AUTH_RESPONSES` (401)
- [x] Define `NOT_FOUND_RESPONSE` (404)
- [x] Define `CONFLICT_RESPONSE` (409)
- [x] Define `BAD_REQUEST_RESPONSE` (400)

**Files to modify:**
- `backend/src/homelab_cmd/api/responses.py` - New file

### Phase 3: OpenAPI Metadata

**Goal:** Add app-level OpenAPI configuration

#### Step 3.1: Update FastAPI App Configuration

- [x] Add `OPENAPI_TAGS` with descriptions for all 6 tags
- [x] Add `contact` with project name and GitHub URL
- [x] Add `license_info` with MIT license
- [x] Add `servers` array
- [x] Add `summary` and enhanced `description`

**Files to modify:**
- `backend/src/homelab_cmd/main.py` - Add OpenAPI configuration

### Phase 4: Route Updates

**Goal:** Add operation IDs and response documentation to all endpoints

#### Step 4.1: System Routes

- [x] Add `operation_id="get_health"` to health endpoint
- [x] Add field descriptions to `HealthResponse`

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/system.py`

#### Step 4.2: Server Routes

- [x] Add operation IDs: `list_servers`, `create_server`, `get_server`, `update_server`, `delete_server`
- [x] Add `responses={**AUTH_RESPONSES}` to all endpoints
- [x] Add `**NOT_FOUND_RESPONSE` to single-resource endpoints
- [x] Add `**CONFLICT_RESPONSE` to create endpoint

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/servers.py`

#### Step 4.3: Agent Routes

- [x] Add `operation_id="create_heartbeat"`
- [x] Add `responses={**AUTH_RESPONSES}`

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/agents.py`

#### Step 4.4: Metrics Routes

- [x] Add `operation_id="get_server_metrics"`
- [x] Add `responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE}`

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/metrics.py`

#### Step 4.5: Config Routes

- [x] Add operation IDs: `get_config`, `update_thresholds`, `update_notifications`, `test_webhook`
- [x] Add `responses={**AUTH_RESPONSES}` to all endpoints

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/config.py`

#### Step 4.6: Alert Routes

- [x] Add operation IDs: `list_alerts`, `get_alert`, `acknowledge_alert`, `resolve_alert`
- [x] Add appropriate response definitions
- [x] Add `**BAD_REQUEST_RESPONSE` to acknowledge endpoint

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/alerts.py`

### Phase 5: Schema Updates

**Goal:** Add field descriptions and examples to all request/response schemas

#### Step 5.1: Server Schemas

- [x] Add descriptions to all `ServerCreate` fields
- [x] Add `json_schema_extra` with examples
- [x] Add descriptions to `ServerUpdate`, `ServerResponse`, `LatestMetrics`

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/server.py`

#### Step 5.2: Heartbeat Schemas

- [x] Add descriptions to `OSInfo`, `MetricsPayload` fields
- [x] Add `json_schema_extra` with example to `HeartbeatRequest`
- [x] Add descriptions to `HeartbeatResponse` fields

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/heartbeat.py`

#### Step 5.3: Alert Schemas

- [x] Add descriptions to all `AlertResponse` fields
- [x] Add descriptions to `AlertListResponse`, `AlertAcknowledgeResponse`, `AlertResolveResponse`

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/alerts.py`

### Phase 6: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 6.1: Create Compliance Test Suite

- [x] Create `tests/test_openapi_compliance.py`
- [x] Test OpenAPI version (AC1)
- [x] Test operation IDs presence and convention (AC2)
- [x] Test metadata completeness (AC3)
- [x] Test security scheme (AC4)
- [x] Test tag descriptions (AC5)
- [x] Test response code documentation (AC6)
- [x] Test schema field descriptions (AC7)

**Files to modify:**
- `tests/test_openapi_compliance.py` - New file (15 tests)

#### Step 6.2: Update Existing Tests

- [x] Update `tests/test_docs.py` with completeness tests
- [x] Update `tests/conftest.py` to use same OpenAPI metadata as production

**Files to modify:**
- `tests/test_docs.py`
- `tests/conftest.py`

#### Step 6.3: Add Dependencies

- [x] Add schemathesis to dev dependencies

**Files to modify:**
- `pyproject.toml`

#### Step 6.4: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | `test_openapi_version_is_3_1` | Passed |
| AC2 | `test_all_operations_have_operation_id`, `test_operation_ids_follow_convention` | Passed |
| AC3 | `test_info_contact_present`, `test_info_license_present`, `test_servers_present` | Passed |
| AC4 | `test_api_key_security_scheme_defined`, `test_api_key_in_header` | Passed |
| AC5 | `test_all_tags_have_descriptions` | Passed |
| AC6 | `test_authenticated_endpoints_document_401`, `test_path_param_endpoints_document_404` | Passed |
| AC7 | `test_request_schemas_have_field_descriptions` | Passed |

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| Health endpoint (no auth) | Excluded from 401 response requirement |
| Endpoints without path params | Excluded from 404 response requirement |
| Response-only schemas | Only request schemas require examples |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Test fixture divergence | Tests pass but production differs | Import `OPENAPI_TAGS` from main.py in conftest |
| Breaking existing tests | Regressions | Run full test suite after each phase |
| Missing endpoints | Incomplete compliance | Explicit endpoint list in test assertions |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| FastAPI 0.109+ | Runtime | Supports OpenAPI 3.1 |
| Pydantic 2.0+ | Runtime | Field descriptions via `Field()` |
| schemathesis 3.28+ | Dev | Property-based API testing (optional) |

## Open Questions

None - all requirements clearly defined in TRD Section 4.1.

## Definition of Done Checklist

- [x] All acceptance criteria implemented
- [x] Unit tests written and passing (15 new tests)
- [x] Edge cases handled
- [x] Code follows best practices
- [x] No linting errors
- [x] Documentation updated (TRD, Test Strategy, DoD)
- [x] Ready for code review

## Files Changed Summary

| Action | File |
|--------|------|
| UPDATE | `sdlc-studio/tsd.md` |
| UPDATE | `sdlc-studio/trd.md` |
| CREATE | `sdlc-studio/stories/US0050-openapi-compliance.md` |
| UPDATE | `sdlc-studio/stories/_index.md` |
| CREATE | `backend/src/homelab_cmd/api/schemas/errors.py` |
| CREATE | `backend/src/homelab_cmd/api/responses.py` |
| UPDATE | `backend/src/homelab_cmd/main.py` |
| UPDATE | `backend/src/homelab_cmd/api/routes/system.py` |
| UPDATE | `backend/src/homelab_cmd/api/routes/servers.py` |
| UPDATE | `backend/src/homelab_cmd/api/routes/agents.py` |
| UPDATE | `backend/src/homelab_cmd/api/routes/metrics.py` |
| UPDATE | `backend/src/homelab_cmd/api/routes/config.py` |
| UPDATE | `backend/src/homelab_cmd/api/routes/alerts.py` |
| UPDATE | `backend/src/homelab_cmd/api/schemas/server.py` |
| UPDATE | `backend/src/homelab_cmd/api/schemas/heartbeat.py` |
| UPDATE | `backend/src/homelab_cmd/api/schemas/alerts.py` |
| UPDATE | `pyproject.toml` |
| CREATE | `tests/test_openapi_compliance.py` |
| UPDATE | `tests/test_docs.py` |
| UPDATE | `tests/conftest.py` |

## Notes

- Implementation completed on 2026-01-19
- All 315 tests pass including 15 new OpenAPI compliance tests
- OpenAPI spec now includes full metadata, operation IDs, and response documentation
- Test fixture updated to mirror production OpenAPI configuration
