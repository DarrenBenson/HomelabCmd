# US0132: Server and Workstation Grouping

> **Status:** Done
> **Epic:** [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md)
> **Owner:** Darren
> **Created:** 2026-01-28
> **Story Points:** 5
> **Plan:** [PL0132](../plans/PL0132-server-workstation-grouping.md)
> **Test Spec:** [TS0132](../test-specs/TS0132-server-workstation-grouping.md)
> **Workflow:** [WF0018](../workflows/WF0018-server-workstation-grouping.md)

## User Story

**As a** Darren (Homelab Operator)
**I want** servers and workstations grouped separately on the dashboard
**So that** I can quickly identify machine types

## Context

### Persona Reference

**Darren** - Technical professional running a homelab with 11+ servers plus workstations. Needs to distinguish always-on servers (critical if offline) from workstations (expected to be offline when not in use).

[Full persona details](../personas.md#darren-homelab-operator)

### Background

With EP0009 (Workstation Management), HomelabCmd now supports two machine types: servers and workstations. Workstations have different alerting behaviour (offline is normal). The dashboard should visually separate these to help Darren quickly focus on what matters - typically the servers.

---

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | Consistency | Same drag-and-drop UX | Reordering works within sections |
| PRD | UX | Quick visual identification | Section headers must be clear |
| EP0009 | Data | machine_type field exists | Use existing "server"/"workstation" values |

---

## Acceptance Criteria

### AC1: Section headers displayed

- **Given** the dashboard has machines of different types
- **When** the dashboard renders
- **Then** a "Servers" section header appears above server cards
- **And** a "Workstations" section header appears above workstation cards
- **And** headers are styled consistently with the design system

### AC2: Section counts in headers

- **Given** the dashboard has 8 servers (7 online, 1 offline) and 3 workstations (1 online)
- **When** the dashboard renders
- **Then** the Servers header shows "Servers (7 online, 1 offline)"
- **And** the Workstations header shows "Workstations (1 online, 2 offline)"
- **And** counts update in real-time as status changes

### AC3: Reorder within section only

- **Given** the user drags a server card
- **When** the card is dragged towards the Workstations section
- **Then** the card cannot be dropped in the Workstations section
- **And** visual feedback indicates invalid drop zone (red border or no highlight)
- **And** releasing the card returns it to its original position

### AC4: Collapsible sections

- **Given** a section header is displayed
- **When** the user clicks the section header (or chevron icon)
- **Then** the section collapses, hiding all cards within
- **And** the header shows a "collapsed" indicator (chevron pointing right)
- **When** the user clicks again
- **Then** the section expands, showing all cards

### AC5: Collapse state persisted

- **Given** the user has collapsed the "Workstations" section
- **When** the user refreshes the page
- **Then** the "Workstations" section remains collapsed
- **And** the "Servers" section state is also preserved

### AC6: Empty section message

- **Given** no workstations are registered
- **When** the dashboard renders
- **Then** the Workstations section shows "No workstations registered"
- **And** an "Add workstation" link/button is displayed

### AC7: Section order fixed

- **Given** the dashboard has both sections
- **When** the dashboard renders
- **Then** the "Servers" section always appears first
- **And** the "Workstations" section always appears second
- **And** section order is not user-configurable (cards within are)

---

## Scope

### In Scope

- Section headers with counts
- Cards grouped by machine_type
- Drag-and-drop restricted to same section
- Collapsible sections with click toggle
- Collapse state persistence (extends US0131 preferences)
- Empty section messaging
- Fixed section order (Servers, then Workstations)

### Out of Scope

- Custom section names
- User-defined sections/groups
- Section reordering
- Hiding sections entirely
- Sub-groups within sections

---

## Technical Notes

### Implementation Approach

1. **MachineSection component:**
   ```tsx
   interface MachineSectionProps {
     title: string;
     type: 'server' | 'workstation';
     machines: Machine[];
     collapsed: boolean;
     onToggleCollapse: () => void;
   }

   function MachineSection({ title, type, machines, collapsed, onToggleCollapse }: MachineSectionProps) {
     const sectionMachines = machines.filter(m => m.machine_type === type);
     const online = sectionMachines.filter(m => m.status === 'online').length;
     const offline = sectionMachines.length - online;

     return (
       <section className="mb-8">
         <button
           className="flex items-center gap-2 w-full text-left py-2"
           onClick={onToggleCollapse}
         >
           <ChevronRight className={cn("h-4 w-4 transition-transform", !collapsed && "rotate-90")} />
           <h2 className="text-lg font-semibold">
             {title} ({online} online, {offline} offline)
           </h2>
         </button>
         {!collapsed && (
           <DndContext /* ... */>
             <SortableContext items={sectionMachines.map(m => m.id)}>
               <div className="grid grid-cols-4 gap-4 mt-4">
                 {sectionMachines.map(m => <SortableCard key={m.id} machine={m} />)}
               </div>
             </SortableContext>
           </DndContext>
         )}
         {!collapsed && sectionMachines.length === 0 && (
           <p className="text-muted-foreground mt-4">
             No {type}s registered. <Link to="/discovery">Discover devices</Link>
           </p>
         )}
       </section>
     );
   }
   ```

2. **Separate DndContext per section:**
   - Each section has its own `DndContext` and `SortableContext`
   - This naturally prevents cross-section dragging

3. **Preference storage extension:**
   ```json
   {
     "card_order": {
       "servers": ["server-guid-1", "server-guid-2"],
       "workstations": ["workstation-guid-1"]
     },
     "collapsed_sections": ["workstations"]
   }
   ```

### API Changes

Extend PUT/GET `/api/v1/preferences/card-order`:

**PUT /api/v1/preferences/card-order**
```json
{
  "servers": ["guid-1", "guid-2"],
  "workstations": ["guid-3"]
}
```

**PUT /api/v1/preferences/collapsed-sections**
```json
{
  "collapsed": ["workstations"]
}
```

Or combined in US0136 (Dashboard Preferences Sync).

### Files to Create/Modify

- `frontend/src/components/MachineSection.tsx` - New component
- `frontend/src/pages/Dashboard.tsx` - Use MachineSection
- `backend/src/homelab_cmd/api/routes/preferences.py` - Extend for section orders
- `frontend/src/api/preferences.ts` - Extend API client

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | All machines are servers | Workstations section shows empty message |
| 2 | All machines are workstations | Servers section shows empty message |
| 3 | Machine type changed (server→workstation) | Card moves to correct section on refresh |
| 4 | Section collapsed, new machine added | Count in header updates, card appears when expanded |
| 5 | Drag card to collapsed section | No drop allowed (section not visible) |
| 6 | Both sections collapsed | Dashboard shows just the two headers |
| 7 | Click header while dragging | Drag cancelled, then toggle occurs |
| 8 | 0 online, 0 offline | Header shows "(0 online, 0 offline)" |

---

## Test Scenarios

- [ ] Servers section appears before Workstations section
- [ ] Section headers show correct counts
- [ ] Counts update when machine status changes
- [ ] Cards grouped correctly by machine_type
- [ ] Drag within server section works
- [ ] Drag within workstation section works
- [ ] Drag from server to workstation section blocked
- [ ] Section collapses on header click
- [ ] Section expands on second header click
- [ ] Chevron rotates on collapse/expand
- [ ] Collapse state persists after refresh
- [ ] Empty section shows appropriate message
- [ ] Empty section shows link to discovery page

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0130](US0130-drag-drop-card-reordering.md) | Requires | Drag-and-drop base functionality | Draft |
| [US0131](US0131-card-order-persistence.md) | Requires | Preference storage infrastructure | Draft |
| EP0009 | Requires | machine_type field on servers | Done |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| machine_type field | Data model | Done (EP0009) |
| lucide-react ChevronRight | Icon | Available |

---

## Estimation

**Story Points:** 5
**Complexity:** Medium - Section logic, preference extension, DnD scoping

---

## Open Questions

None.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation from EP0011 |
| 2026-01-28 | Claude | Status: Draft -> Planned (PL0132, TS0132 created) |
| 2026-01-28 | Claude | Status: Planned -> In Progress (WF0018 created) |
| 2026-01-28 | Claude | Status: In Progress -> Done (all ACs verified) |
