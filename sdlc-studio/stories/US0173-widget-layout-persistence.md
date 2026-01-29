# US0173: Widget Layout Persistence

> **Status:** Done
> **Epic:** [EP0012: Widget-Based Detail View](../epics/EP0012-widget-based-detail-view.md)
> **Owner:** Darren
> **Created:** 2026-01-28
> **Story Points:** 5

## User Story

**As a** Darren (Homelab Operator)
**I want** my widget layout saved per machine
**So that** each machine can have a different arrangement

## Context

### Persona Reference
**Darren** - Technical professional managing a homelab. Wants customised views per machine.
[Full persona details](../personas.md#darren-homelab-operator)

---

## Acceptance Criteria

### AC1: Load layout API
- **Given** I navigate to a machine's detail page
- **When** the page loads
- **Then** the saved layout is fetched via `GET /api/v1/machines/{id}/layout`

### AC2: Save layout API
- **Given** I rearrange widgets
- **When** the layout changes
- **Then** it is saved via `PUT /api/v1/machines/{id}/layout` (debounced)

### AC3: Per-machine layouts
- **Given** I have multiple machines
- **When** I customise layouts differently
- **Then** each machine retains its own layout

### AC4: Layout format
- **Given** layout is saved
- **When** stored in database
- **Then** it uses react-grid-layout JSON format

### AC5: Reset to default
- **Given** I am viewing a custom layout
- **When** I click "Reset to Default"
- **Then** the layout reverts to the default for that machine type

---

## Scope

### In Scope
- API endpoints: GET/PUT `/api/v1/machines/{id}/layout`
- Layout stored as JSON in database
- Debounced save on layout change
- Per-machine independent layouts
- Reset to default button
- Backend: WidgetLayout model

### Out of Scope
- Layout templates (future)
- Layout sharing between machines

---

## Technical Notes

```python
class WidgetLayout(Base):
    __tablename__ = 'widget_layout'

    id = Column(Integer, primary_key=True)
    machine_id = Column(String, ForeignKey('server.id'), unique=True)
    layout_data = Column(JSON)  # react-grid-layout format
    updated_at = Column(DateTime, default=datetime.utcnow)
```

Layout format:
```json
{
  "lg": [
    {"i": "cpu_chart", "x": 0, "y": 0, "w": 4, "h": 3},
    {"i": "memory_gauge", "x": 4, "y": 0, "w": 4, "h": 3}
  ],
  "md": [...],
  "sm": [...]
}
```

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | No saved layout | Use default layout |
| 2 | Save fails | Retry, show error after 3 failures |
| 3 | Corrupted layout JSON | Fall back to default |
| 4 | Machine deleted | Layout orphaned, cleanup job removes |
| 5 | Concurrent edits | Last write wins |

---

## Test Scenarios

- [x] Layout loads on page mount
- [x] Layout saves on change (debounced)
- [x] Each machine has independent layout
- [x] Reset button restores default
- [x] Corrupted layout falls back to default

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0164](US0164-widget-grid-system.md) | Requires | Grid system | Draft |

---

## Estimation

**Story Points:** 5
**Complexity:** Medium - Backend API, database model, debounced save

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation (renumbered from US0146) |
| 2026-01-28 | Claude | Implementation complete: Backend API (GET/PUT/DELETE layout), frontend load/save with debounce, reset to default |
