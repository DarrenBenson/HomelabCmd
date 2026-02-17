# US0197: Testing and Cleanup

> **Status:** Done
> **Epic:** [EP0019: Unified Device Discovery](../epics/EP0019-unified-device-discovery.md)
> **Owner:** Darren
> **Created:** 2026-01-31
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** comprehensive tests and cleanup of legacy code
**So that** the unified discovery is reliable and maintainable

## Context

### Persona Reference

**Darren** - Technical professional managing a homelab. Benefits from well-tested, maintainable code.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

After implementing the unified discovery features, comprehensive testing ensures reliability. Legacy tabbed UI code and any orphaned components should be removed to keep the codebase clean.

---

## Acceptance Criteria

### AC1: Unit tests for deviceMatcher

- **Given** the device matching utility
- **When** tests run
- **Then** all matching scenarios are covered:
  - Exact hostname match
  - Hostname prefix match
  - Partial overlap match
  - No match scenarios
  - Edge cases (empty strings, special characters)

### AC2: Integration tests for useUnifiedDiscovery

- **Given** the unified discovery hook
- **When** tests run
- **Then** scenarios are covered:
  - Both sources return data
  - Network only returns data
  - Tailscale only returns data
  - Both sources error
  - Progressive loading

### AC3: E2E tests for unified discovery flow

- **Given** the unified discovery page
- **When** E2E tests run
- **Then** user flows are verified:
  - Page loads with unified view
  - "Discover All" triggers discovery
  - Filters work correctly
  - Import flow completes

### AC4: Legacy code removal

- **Given** the unified discovery is complete
- **When** legacy code is reviewed
- **Then** removed/cleaned up:
  - Tab navigation components (if any)
  - Unused imports
  - Dead code paths
  - Orphaned test files

### AC5: All tests pass

- **Given** the complete test suite
- **When** `npm test` and `npm run test:e2e` run
- **Then** all tests pass
- **And** no regressions in existing functionality

---

## Scope

### In Scope

- Unit tests for deviceMatcher.ts
- Unit tests for useUnifiedDiscovery hook
- E2E tests for discovery flow
- Legacy code cleanup
- Test coverage verification

### Out of Scope

- Backend tests (no backend changes)
- Visual regression tests
- Performance benchmarks

---

## Technical Notes

### Test Coverage Targets

| Module | Target Coverage |
|--------|-----------------|
| deviceMatcher.ts | 100% |
| useUnifiedDiscovery.ts | 90% |
| DiscoveryPage.tsx | 80% |
| SourceBadge.tsx | 100% |

### Device Matcher Test Cases

```typescript
describe('deviceMatcher', () => {
  describe('normaliseHostname', () => {
    it('converts to lowercase');
    it('removes .local suffix');
    it('removes .tail*.ts.net suffix');
    it('trims whitespace');
    it('handles empty string');
  });

  describe('matchDevices', () => {
    it('matches exact hostname');
    it('matches hostname prefix');
    it('matches partial overlap (4+ chars)');
    it('returns no match for unrelated hostnames');
    it('handles empty device lists');
    it('handles devices with no hostname');
  });
});
```

### E2E Test Scenarios

```typescript
test.describe('Unified Discovery', () => {
  test('shows unified device list');
  test('Discover All triggers both sources');
  test('source filter works');
  test('hide imported toggle works');
  test('import merged device shows path selection');
});
```

### Legacy Code to Review

| File | Review Action |
|------|---------------|
| `DiscoveryPage.tsx` | Remove tab state/components if present |
| `NetworkDiscovery.tsx` | Verify not imported elsewhere |
| `TailscaleDiscovery.tsx` | Verify not imported elsewhere |
| Navigation routes | Update /tailscale-devices redirect |

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/lib/deviceMatcher.test.ts` | Create | Unit tests |
| `frontend/src/hooks/useUnifiedDiscovery.test.ts` | Create | Hook tests |
| `frontend/e2e/discovery.spec.ts` | Modify | E2E tests |
| Various | Modify | Legacy cleanup |

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | Test mocking fails | Use proper test isolation |
| 2 | E2E backend not running | Skip or use MSW mocks |
| 3 | Flaky async tests | Add proper waitFor/act wrappers |
| 4 | Legacy code still referenced | Find all imports before removal |

---

## Test Scenarios

- [ ] deviceMatcher unit tests pass
- [ ] useUnifiedDiscovery unit tests pass
- [ ] E2E discovery tests pass
- [ ] No console errors in tests
- [ ] Coverage targets met
- [ ] Legacy code removed
- [ ] No unused imports
- [ ] TypeScript compiles without errors
- [ ] Lint passes

---

## Dependencies

### Story Dependencies

| Story | Relationship | Status |
|-------|--------------|--------|
| US0193 | Core implementation | Planned |
| US0194 | Source panel | Planned |
| US0195 | Card enhancements | Planned |
| US0196 | Import flow | Planned |

---

## Estimation

**Story Points:** 3
**Complexity:** Medium - comprehensive testing, careful cleanup

---

## Open Questions

None.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-31 | Claude | Initial story creation from plan |
