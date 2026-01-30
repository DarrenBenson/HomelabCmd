# TS0182: Configuration Diff View

> **Status:** Complete
> **Epic:** [EP0010: Configuration Management](../epics/EP0010-configuration-management.md)
> **Created:** 2026-01-29
> **Last Updated:** 2026-01-29

## Overview

Test specification for the configuration diff view feature that displays differences between expected and actual configuration states. Covers the backend diff endpoint and frontend diff display components.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0118](../stories/US0118-configuration-diff-view.md) | Configuration Diff View | High |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0118 | AC1 | Diff endpoint returns structured data | TC001, TC002, TC003 | Pending |
| US0118 | AC2 | File content diff in unified format | TC004 | Pending |
| US0118 | AC3 | Package version diff shows both versions | TC005 | Pending |
| US0118 | AC4 | Missing item shows expected vs actual | TC006 | Pending |
| US0118 | AC5 | Frontend colour-coded diff display | TC007, TC008 | Pending |
| US0118 | AC6 | Check Again button triggers refresh | TC009 | Pending |
| US0118 | AC7 | Apply Pack button visible with mismatches | TC010 | Pending |

**Coverage:** 7/7 ACs covered

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Validate diff endpoint response structure and edge cases |
| Integration | Yes | Validate frontend-backend integration |
| E2E | No | Visual testing sufficient for UI rendering |

---

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | US0117 compliance check implementation, test database |
| External Services | None (uses mock SSH responses) |
| Test Data | Server with compliance check results, various mismatch types |

---

## Test Cases

### TC001: Diff endpoint returns structured data for server with mismatches

**Type:** Unit | **Priority:** High | **Story:** US0118

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A server "test-server" with compliance check results containing mismatches | Server and check data exist in database |
| When | GET /api/v1/servers/test-server/config/diff?pack=base | Request is processed |
| Then | Response contains server_id, pack_name, is_compliant, summary, mismatches | 200 OK with structured diff data |

**Assertions:**
- [ ] Response status is 200
- [ ] Response contains server_id matching request
- [ ] Response contains pack_name matching query parameter
- [ ] Response contains summary with total_items, compliant, mismatched counts
- [ ] Response contains mismatches array

---

### TC002: Diff endpoint returns 404 for non-existent server

**Type:** Unit | **Priority:** High | **Story:** US0118

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | No server with ID "nonexistent-server" exists | Server does not exist |
| When | GET /api/v1/servers/nonexistent-server/config/diff?pack=base | Request is processed |
| Then | Response is 404 with error message | 404 Not Found |

**Assertions:**
- [ ] Response status is 404
- [ ] Response contains "Server not found" in detail

---

### TC003: Diff endpoint returns empty mismatches for compliant server

**Type:** Unit | **Priority:** Medium | **Story:** US0118

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A server "compliant-server" with is_compliant=true check results | Compliance check shows no mismatches |
| When | GET /api/v1/servers/compliant-server/config/diff?pack=base | Request is processed |
| Then | Response shows is_compliant=true and empty mismatches | Success message, no diff sections |

**Assertions:**
- [ ] Response status is 200
- [ ] is_compliant is true
- [ ] mismatches array is empty
- [ ] summary.mismatched is 0

---

### TC004: File content diff shows unified format

**Type:** Unit | **Priority:** High | **Story:** US0118

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A mismatch of type "wrong_content" for file "~/.config/test" | Mismatch exists with content difference |
| When | Diff is generated | Unified diff format produced |
| Then | Diff contains "---", "+++", "@@ ... @@" format with context lines | Unified diff format |

**Assertions:**
- [ ] Diff string starts with "--- expected"
- [ ] Diff string contains "+++ actual"
- [ ] Diff string contains @@ line numbers @@
- [ ] Added lines prefixed with "+"
- [ ] Removed lines prefixed with "-"
- [ ] Context lines have no prefix

---

### TC005: Package version diff shows expected and actual

**Type:** Unit | **Priority:** High | **Story:** US0118

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A mismatch of type "wrong_version" for package "curl" | Expected >= 8.5.0, actual 8.2.0 |
| When | Diff is returned | Version info included |
| Then | Response shows package name, expected version, actual version | Clear version comparison |

**Assertions:**
- [ ] mismatch.type is "wrong_version"
- [ ] mismatch.category is "packages"
- [ ] mismatch.item or mismatch.package is "curl"
- [ ] mismatch.expected.min_version is "8.5.0" (or similar)
- [ ] mismatch.actual.version is "8.2.0"

---

### TC006: Missing file shows expected state and "not found"

**Type:** Unit | **Priority:** High | **Story:** US0118

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A mismatch of type "missing_file" for "~/.bashrc.d/aliases.sh" | File does not exist on server |
| When | Diff is returned | Missing file info included |
| Then | Response shows item path, expected.exists=true, actual.exists=false | Clear missing indication |

**Assertions:**
- [ ] mismatch.type is "missing_file"
- [ ] mismatch.category is "files"
- [ ] mismatch.item or mismatch.path contains "aliases.sh"
- [ ] mismatch.expected.exists is true
- [ ] mismatch.actual.exists is false

---

### TC007: Frontend renders colour-coded diff sections

**Type:** Integration | **Priority:** Medium | **Story:** US0118

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Diff data with mismatches of different types | Multiple mismatch types present |
| When | ConfigDiffView component renders | UI displays diff |
| Then | Missing files show red styling, version mismatches show orange/warning | Colour coding applied |

**Assertions:**
- [ ] Missing file items have error/red styling class
- [ ] Version mismatch items have warning styling class
- [ ] Content diff lines use green for additions, red for removals

---

### TC008: Frontend sections are collapsible

**Type:** Integration | **Priority:** Medium | **Story:** US0118

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Diff data with mismatches | Multiple mismatch sections |
| When | Section header is clicked | Section toggles expand/collapse |
| Then | Section content shows/hides, chevron rotates | Smooth toggle animation |

**Assertions:**
- [ ] Each section has a clickable header
- [ ] Clicking expands collapsed section
- [ ] Clicking collapses expanded section
- [ ] Chevron icon rotates on state change

---

### TC009: Check Again button triggers new compliance check

**Type:** Integration | **Priority:** Medium | **Story:** US0118

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Diff view is displayed for a server | User viewing diff |
| When | "Check Again" button is clicked | New check triggered |
| Then | New compliance check runs and diff refreshes | Updated diff displayed |

**Assertions:**
- [ ] Button click triggers POST to /config/check endpoint
- [ ] Loading state shows during check
- [ ] Diff view updates with new results
- [ ] Timestamp reflects new check time

---

### TC010: Apply Pack button visible when mismatches exist

**Type:** Integration | **Priority:** Low | **Story:** US0118

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Diff data with mismatches present | is_compliant is false |
| When | Component renders | Apply Pack button visible |
| Then | Button is visible and styled as primary action | Button present |

**Assertions:**
- [ ] Apply Pack button is rendered
- [ ] Button is disabled or shows "Coming soon" (US0119 not implemented)
- [ ] Button is not visible when is_compliant is true

---

## Fixtures

```yaml
servers:
  - id: test-server
    hostname: test.local

  - id: compliant-server
    hostname: compliant.local

config_checks:
  - id: 1
    server_id: test-server
    pack_name: base
    is_compliant: false
    mismatches:
      - type: missing_file
        item: "~/.bashrc.d/aliases.sh"
        expected: { exists: true, mode: "0644" }
        actual: { exists: false }
      - type: wrong_version
        item: curl
        expected: { installed: true, min_version: "8.5.0" }
        actual: { installed: true, version: "8.2.0" }
      - type: wrong_content
        item: "~/.config/ghostty/config"
        expected: { exists: true, hash: "sha256:abc123" }
        actual: { exists: true, hash: "sha256:def456" }
    check_duration_ms: 1234

  - id: 2
    server_id: compliant-server
    pack_name: base
    is_compliant: true
    mismatches: []
    check_duration_ms: 567
```

---

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC001 | Diff endpoint returns structured data | Pending | - |
| TC002 | Diff endpoint returns 404 for non-existent server | Pending | - |
| TC003 | Diff endpoint returns empty mismatches for compliant server | Pending | - |
| TC004 | File content diff shows unified format | Pending | - |
| TC005 | Package version diff shows expected and actual | Pending | - |
| TC006 | Missing file shows expected state | Pending | - |
| TC007 | Frontend renders colour-coded diff sections | Pending | - |
| TC008 | Frontend sections are collapsible | Pending | - |
| TC009 | Check Again button triggers refresh | Pending | - |
| TC010 | Apply Pack button visible with mismatches | Pending | - |

---

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0010](../epics/EP0010-configuration-management.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial spec from US0118 story plan |
