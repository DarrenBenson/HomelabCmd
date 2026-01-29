# US0175: Edit Layout Mode

> **Status:** Done
> **Epic:** [EP0012: Widget-Based Detail View](../epics/EP0012-widget-based-detail-view.md)
> **Owner:** Darren
> **Created:** 2026-01-28
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** an explicit "Edit Layout" mode
**So that** I don't accidentally move widgets during normal use

## Context

### Persona Reference
**Darren** - Technical professional managing a homelab. Wants intentional layout changes only.
[Full persona details](../personas.md#darren-homelab-operator)

---

## Acceptance Criteria

### AC1: Edit mode toggle
- **Given** I am viewing the machine detail page
- **When** I click "Edit Layout"
- **Then** the page enters edit mode

### AC2: Edit mode behaviour
- **Given** I am in edit mode
- **When** I interact with widgets
- **Then** widgets are draggable and resizable

### AC3: View mode behaviour
- **Given** I am in view mode (default)
- **When** I interact with widgets
- **Then** widgets are locked in place

### AC4: Visual indicators
- **Given** I am in edit mode
- **When** I view the layout
- **Then** resize handles appear on widgets
- **And** grid lines are visible as guides

### AC5: Save and cancel
- **Given** I am in edit mode
- **When** I click "Save"
- **Then** the layout is saved and edit mode exits
- **When** I click "Cancel"
- **Then** changes are reverted to last saved state

### AC6: Edit mode indicator
- **Given** I am in edit mode
- **When** I view the page
- **Then** a visual indicator shows edit mode is active (border, overlay, badge)

---

## Scope

### In Scope
- Edit mode toggle button
- Drag/resize only in edit mode
- Grid lines in edit mode
- Resize handles in edit mode
- Save/Cancel buttons
- Visual edit mode indicator
- Cancel reverts to last save

### Out of Scope
- Undo/redo within edit mode

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | Navigate away during edit | Prompt to save or discard |
| 2 | Save fails | Show error, stay in edit mode |
| 3 | Cancel with no changes | Exit edit mode immediately |
| 4 | Browser refresh during edit | Changes lost (expected) |

---

## Test Scenarios

- [x] Edit mode toggle works
- [x] Widgets draggable only in edit mode
- [x] Widgets resizable only in edit mode
- [x] Grid lines visible in edit mode
- [x] Save persists changes
- [x] Cancel reverts changes

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0173](US0173-widget-layout-persistence.md) | Requires | Layout persistence | Implemented |

---

## Estimation

**Story Points:** 3
**Complexity:** Medium - Mode state management, visual indicators

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation (renumbered from US0148) |
| 2026-01-28 | Claude | Implementation complete: Edit mode toggle in header, EDITING banner, Save/Cancel buttons, cancel reverts layout, visual indicators |
