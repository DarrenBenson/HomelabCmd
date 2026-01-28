# US0050: OpenAPI 3.1 Production Compliance

> **Status:** Done
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Plan:** [PL0019: OpenAPI 3.1 Production Compliance](../plans/PL0019-openapi-compliance.md)
> **Owner:** Darren
> **Created:** 2026-01-19
> **Story Points:** 5
> **Completed:** 2026-01-19

## User Story

**As a** developer integrating with HomelabCmd
**I want** a complete, standards-compliant OpenAPI 3.1 specification
**So that** I can generate client SDKs and understand the API contract

## Context

This is an NFR (Non-Functional Requirement) addressing API quality standards. The API must follow OpenAPI 3.1 best practices for production readiness.

## Acceptance Criteria

### AC1: OpenAPI version is 3.1.x
- **Given** the API is running
- **When** fetching `/api/openapi.json`
- **Then** the `openapi` field starts with "3.1"

### AC2: All operations have operationId
- **Given** the OpenAPI spec
- **When** inspecting all operations
- **Then** every operation has a unique operationId following `{verb}_{resource}` convention

### AC3: Metadata complete
- **Given** the OpenAPI spec
- **When** inspecting the info section
- **Then** contact, license, and servers arrays are populated

### AC4: Security scheme defined
- **Given** the OpenAPI spec
- **When** inspecting securitySchemes
- **Then** API key auth is defined with header location and X-API-Key name

### AC5: Tags have descriptions
- **Given** the OpenAPI spec
- **When** inspecting tags
- **Then** all tags have non-empty descriptions

### AC6: Response codes documented
- **Given** any authenticated endpoint
- **When** inspecting its responses
- **Then** 401 is documented
- **And** endpoints with path params document 404

### AC7: Schema fields have descriptions
- **Given** request body schemas (ServerCreate, HeartbeatRequest, etc.)
- **When** inspecting their fields
- **Then** all fields have descriptions

## Scope

### In Scope
- OpenAPI metadata (contact, license, servers)
- Operation IDs for all 16 endpoints
- Tag descriptions
- Response code documentation
- Error response schemas
- Field descriptions in Pydantic models
- OpenAPI compliance test suite

### Out of Scope
- API versioning changes
- New endpoints
- Functional changes

## Technical Notes

See TRD Section 4.1 for detailed requirements.

**Files to modify:**
- `backend/src/homelab_cmd/main.py` - App metadata
- `backend/src/homelab_cmd/api/routes/*.py` - All 6 route files
- `backend/src/homelab_cmd/api/schemas/*.py` - All schema files
- New: `backend/src/homelab_cmd/api/schemas/errors.py`
- New: `backend/src/homelab_cmd/api/responses.py`
- New: `tests/test_openapi_compliance.py`

## Estimation

**Story Points:** 5
**Complexity:** Medium - many files but repetitive changes

## Dependencies

None - infrastructure improvement

## Definition of Done

- [x] All ACs verified by automated tests
- [x] No linting errors
- [x] TRD Section 4.1 requirements met
- [x] OpenAPI spec passes validation

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
