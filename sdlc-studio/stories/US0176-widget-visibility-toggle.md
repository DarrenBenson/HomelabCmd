# US0176: Widget Visibility Toggle

> **Status:** Done
> **Epic:** [EP0012: Widget-Based Detail View](../epics/EP0012-widget-based-detail-view.md)
> **Owner:** Darren
> **Created:** 2026-01-28
> **Implemented:** 2026-01-28
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** to show/hide widgets
**So that** I only see relevant information for each machine

## Context

### Persona Reference
**Darren** - Technical professional managing a homelab. Wants decluttered, relevant views.
[Full persona details](../personas.md#darren-homelab-operator)

---

## Acceptance Criteria

### AC1: Add widget menu
- **Given** I am in edit mode
- **When** I click "Add Widget"
- **Then** a menu shows available widgets not currently in the layout

### AC2: Add widget to layout
- **Given** the Add Widget menu is open
- **When** I click a widget
- **Then** it is added to the layout at a default position

### AC3: Remove widget
- **Given** I am in edit mode
- **When** I click the remove button on a widget
- **Then** the widget is removed from the layout (hidden, not deleted)

### AC4: Hidden widgets available
- **Given** I have hidden a widget
- **When** I open the Add Widget menu
- **Then** the hidden widget appears and can be re-added

### AC5: Non-applicable widgets
- **Given** a widget is not applicable (e.g., containers without Docker)
- **When** I view the Add Widget menu
- **Then** the widget is greyed out with explanation

### AC6: Auto-save on visibility change
- **Given** I add or remove a widget
- **When** the change is made
- **Then** the layout is saved automatically

---

## Scope

### In Scope
- Add Widget button and menu
- Widget removal from layout
- Hidden widgets in Add menu
- Non-applicable widget indication
- Auto-save on visibility change

### Out of Scope
- Widget configuration/settings
- Custom widget creation

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | All widgets hidden | Show empty state, Add Widget prominent |
| 2 | Add widget fails | Show error toast |
| 3 | Widget becomes non-applicable | Remove from layout, show in grey |

---

## Test Scenarios

- [x] Add Widget menu shows available widgets
- [x] Adding widget places it in layout
- [x] Removing widget hides it
- [x] Hidden widgets reappear in Add menu
- [x] Non-applicable widgets greyed out

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0175](US0175-edit-layout-mode.md) | Requires | Edit mode | Implemented |

---

## Estimation

**Story Points:** 3
**Complexity:** Medium - Widget registry, menu management

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation (renumbered from US0149) |
| 2026-01-28 | Claude | Implemented: Widget registry, WidgetPicker component, visibility-based rendering, onRemove support |
