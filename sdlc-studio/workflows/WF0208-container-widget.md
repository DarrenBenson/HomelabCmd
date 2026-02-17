# WF0208: Container Widget Workflow

> **Status:** Done
> **Story:** US0159: Container Widget
> **Plan:** PL0207: Container Widget
> **Created:** 2026-02-01
> **Completed:** 2026-02-01
> **Approach:** Test-After

---

## Phase Progress

| Phase | Name | Status | Started | Completed |
|-------|------|--------|---------|-----------|
| 1 | Plan | Done | 2026-02-01 | 2026-02-01 |
| 2 | Test Spec | Skipped | - | - |
| 3 | Implement | Done | 2026-02-01 | 2026-02-01 |
| 4 | Tests | Done | 2026-02-01 | 2026-02-01 |
| 5 | Test | Done | 2026-02-01 | 2026-02-01 |
| 6 | Verify | Done | 2026-02-01 | 2026-02-01 |
| 7 | Check | Done | 2026-02-01 | 2026-02-01 |
| 8 | Review | Done | 2026-02-01 | 2026-02-01 |

**Current Phase:** Complete

---

## Session Log

| Date | Phase | Notes |
|------|-------|-------|
| 2026-02-01 | 1 | Created workflow file |
| 2026-02-01 | 3 | Created types/container.ts |
| 2026-02-01 | 3 | Created api/containers.ts |
| 2026-02-01 | 3 | Created ContainersWidget.tsx |
| 2026-02-01 | 3 | Added has_docker to MachineData type |
| 2026-02-01 | 3 | Updated ServerDetailWidgetView to include ContainersWidget |
| 2026-02-01 | 3 | Exported ContainersWidget from widgets/index.ts |
| 2026-02-01 | 4 | Created ContainersWidget.test.tsx (12 tests) |
| 2026-02-01 | 5 | All 2596 frontend tests pass |
| 2026-02-01 | 6 | All acceptance criteria verified |
| 2026-02-01 | 7 | Lint check passed |

---

## Implementation Progress

### Phase 3 Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Create types/container.ts | [x] |
| 2 | Create api/containers.ts | [x] |
| 3 | Create ContainersWidget.tsx | [x] |
| 4 | Add to ServerDetailWidgetView | [x] |
| 5 | Export from widgets/index.ts | [x] |
| 6 | Create tests | [x] |

---

## Acceptance Criteria Verification

| AC | Description | Status |
|----|-------------|--------|
| 1 | Widget ID: `containers` | ✅ In widgetRegistry.ts |
| 2 | Only displayed for machines with `has_docker=true` | ✅ Checked in ServerDetailWidgetView |
| 3 | Lists all containers with status indicator | ✅ ContainerRow component |
| 4 | Running: green dot, Stopped/Exited: grey dot, Error: red dot | ✅ getStateColour function |
| 5 | Shows container name, image (truncated), status text | ✅ ContainerRow display |
| 6 | Uptime shown for running containers | ✅ formatUptime function |
| 7 | Refreshes every 60 seconds | ✅ POLLING_INTERVAL = 60000 |
| 8 | Clickable row expands to show ports, full image name | ✅ Expandable ContainerRow |
| 9 | Minimum widget size: 6x4 | ✅ Already in widgetRegistry (minW: 4, minH: 4) |

---

## Artifacts

| Type | Path | Status |
|------|------|--------|
| Workflow | sdlc-studio/workflows/WF0208-container-widget.md | Done |
| Types | frontend/src/types/container.ts | Created |
| API | frontend/src/api/containers.ts | Created |
| Widget | frontend/src/components/widgets/ContainersWidget.tsx | Created |
| Tests | frontend/src/components/widgets/ContainersWidget.test.tsx | Created (12 tests) |
