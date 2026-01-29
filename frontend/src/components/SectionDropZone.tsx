/**
 * SectionDropZone component for US0137: Cross-Section Machine Type Change
 *
 * Wraps a MachineSection to enable cross-section drops that trigger machine type changes.
 * When a card from a different section is dragged over, displays a visual indicator
 * showing the card can be dropped to change its type.
 */

import { useDroppable } from '@dnd-kit/core';
import { cn } from '../lib/utils';

export interface SectionDropZoneProps {
  sectionType: 'server' | 'workstation';
  /** Whether the active drag originated from this section */
  isActiveSection: boolean;
  /** Whether the section is collapsed (no drops allowed when collapsed) */
  isCollapsed: boolean;
  children: React.ReactNode;
}

export function SectionDropZone({
  sectionType,
  isActiveSection,
  isCollapsed,
  children,
}: SectionDropZoneProps): React.ReactElement {
  const { setNodeRef, isOver, active } = useDroppable({
    id: `section-drop-${sectionType}`,
    data: { section: sectionType, isDropZone: true },
    disabled: isCollapsed,
  });

  // Only show drop indicator if:
  // 1. Dragging over this zone
  // 2. NOT from this section (cross-section drag)
  // 3. There is an active drag
  // 4. Section is not collapsed
  const showDropIndicator = isOver && !isActiveSection && active && !isCollapsed;
  const targetType = sectionType === 'server' ? 'Server' : 'Workstation';

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'transition-all duration-200 rounded-lg',
        showDropIndicator && 'ring-2 ring-status-info bg-status-info/5'
      )}
      data-testid={`section-drop-zone-${sectionType}`}
    >
      {showDropIndicator && (
        <div
          className="text-sm text-status-info text-center py-2 font-medium"
          data-testid={`drop-indicator-${sectionType}`}
        >
          Drop to change to {targetType}
        </div>
      )}
      {children}
    </div>
  );
}
