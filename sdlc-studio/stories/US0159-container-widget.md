# US0159: Container Widget

> **Status:** Done
> **Epic:** [EP0014: Docker Container Monitoring](../epics/EP0014-docker-container-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-02-01
> **Story Points:** 5
> **Priority:** P0

---

## User Story

**As a** homelab operator (Darren)
**I want** a containers widget on the server detail page
**So that** I can see container status at a glance

## Context

### Persona Reference
**Darren** - Primary homelab operator with 11+ servers. Many run Docker containers for services like Plex, Sonarr, Radarr.
[Full persona details](../personas.md#darren-homelab-operator)

### Background
With container listing (US0158) providing API access to Docker containers, this story adds the frontend widget to display them. The widget appears automatically on detail pages for machines with `has_docker=true` and refreshes every 60 seconds.

---

## Acceptance Criteria

### AC1: Widget Registration
- [x] Widget ID: `containers` registered in widgetRegistry

### AC2: Conditional Display
- [x] Only displayed for machines with `has_docker=true`

### AC3: Container List Display
- [x] Lists all containers with status indicator
- [x] Running: green dot, Stopped/Exited: grey dot, Error: red dot

### AC4: Container Details
- [x] Shows container name, image (truncated), status text

### AC5: Uptime Display
- [x] Uptime shown for running containers

### AC6: Auto-Refresh
- [x] Refreshes every 60 seconds

### AC7: Expandable Rows
- [x] Clickable row expands to show ports, full image name

### AC8: Minimum Widget Size
- [x] Minimum widget size: 6x4

---

## Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| US0158 | Prerequisite | Container listing API | Done |
| EP0012 | Prerequisite | Widget system | Done |

---

## Implementation

See [WF0208: Container Widget Workflow](../workflows/WF0208-container-widget.md) for implementation details.

### Artifacts

| Type | Path |
|------|------|
| Types | frontend/src/types/container.ts |
| API | frontend/src/api/containers.ts |
| Widget | frontend/src/components/widgets/ContainersWidget.tsx |
| Tests | frontend/src/components/widgets/ContainersWidget.test.tsx (12 tests) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-02-01 | Claude | Implemented as part of EP0014 batch |
| 2026-02-18 | Claude | Retroactive story file created from epic specification |
