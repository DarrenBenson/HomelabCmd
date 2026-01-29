/**
 * Tests for SectionDropZone component (US0137)
 *
 * TC01: Drop zone highlights on cross-section drag
 * TC02: Drop zone tooltip shows target type
 * TC19: Collapsed section prevented
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { SectionDropZone } from './SectionDropZone';

// Mock useDroppable to control isOver state
vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual('@dnd-kit/core');
  return {
    ...actual,
    useDroppable: vi.fn().mockReturnValue({
      setNodeRef: vi.fn(),
      isOver: false,
      active: null,
    }),
  };
});

import { useDroppable } from '@dnd-kit/core';

describe('SectionDropZone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TC01: Drop zone highlights on cross-section drag', () => {
    it('shows highlight when dragging over from different section', () => {
      vi.mocked(useDroppable).mockReturnValue({
        setNodeRef: vi.fn(),
        isOver: true,
        active: { id: 'test-server' },
        over: null,
        rect: null as unknown as React.MutableRefObject<{ width: number; height: number } | null>,
        node: { current: null },
        isDisabled: false,
      });

      render(
        <DndContext>
          <SectionDropZone
            sectionType="workstation"
            isActiveSection={false}
            isCollapsed={false}
          >
            <div>Section content</div>
          </SectionDropZone>
        </DndContext>
      );

      const dropZone = screen.getByTestId('section-drop-zone-workstation');
      expect(dropZone).toHaveClass('ring-2');
      expect(dropZone).toHaveClass('ring-status-info');
    });

    it('does not show highlight when dragging within same section', () => {
      vi.mocked(useDroppable).mockReturnValue({
        setNodeRef: vi.fn(),
        isOver: true,
        active: { id: 'test-server' },
        over: null,
        rect: null as unknown as React.MutableRefObject<{ width: number; height: number } | null>,
        node: { current: null },
        isDisabled: false,
      });

      render(
        <DndContext>
          <SectionDropZone
            sectionType="server"
            isActiveSection={true}
            isCollapsed={false}
          >
            <div>Section content</div>
          </SectionDropZone>
        </DndContext>
      );

      const dropZone = screen.getByTestId('section-drop-zone-server');
      expect(dropZone).not.toHaveClass('ring-2');
    });

    it('does not show highlight when no active drag', () => {
      vi.mocked(useDroppable).mockReturnValue({
        setNodeRef: vi.fn(),
        isOver: true,
        active: null,
        over: null,
        rect: null as unknown as React.MutableRefObject<{ width: number; height: number } | null>,
        node: { current: null },
        isDisabled: false,
      });

      render(
        <DndContext>
          <SectionDropZone
            sectionType="workstation"
            isActiveSection={false}
            isCollapsed={false}
          >
            <div>Section content</div>
          </SectionDropZone>
        </DndContext>
      );

      const dropZone = screen.getByTestId('section-drop-zone-workstation');
      expect(dropZone).not.toHaveClass('ring-2');
    });
  });

  describe('TC02: Drop zone tooltip shows target type', () => {
    it('shows "Drop to change to Workstation" when dropping on workstations section', () => {
      vi.mocked(useDroppable).mockReturnValue({
        setNodeRef: vi.fn(),
        isOver: true,
        active: { id: 'test-server' },
        over: null,
        rect: null as unknown as React.MutableRefObject<{ width: number; height: number } | null>,
        node: { current: null },
        isDisabled: false,
      });

      render(
        <DndContext>
          <SectionDropZone
            sectionType="workstation"
            isActiveSection={false}
            isCollapsed={false}
          >
            <div>Section content</div>
          </SectionDropZone>
        </DndContext>
      );

      expect(screen.getByTestId('drop-indicator-workstation')).toHaveTextContent(
        'Drop to change to Workstation'
      );
    });

    it('shows "Drop to change to Server" when dropping on servers section', () => {
      vi.mocked(useDroppable).mockReturnValue({
        setNodeRef: vi.fn(),
        isOver: true,
        active: { id: 'test-workstation' },
        over: null,
        rect: null as unknown as React.MutableRefObject<{ width: number; height: number } | null>,
        node: { current: null },
        isDisabled: false,
      });

      render(
        <DndContext>
          <SectionDropZone
            sectionType="server"
            isActiveSection={false}
            isCollapsed={false}
          >
            <div>Section content</div>
          </SectionDropZone>
        </DndContext>
      );

      expect(screen.getByTestId('drop-indicator-server')).toHaveTextContent(
        'Drop to change to Server'
      );
    });
  });

  describe('TC19: Collapsed section prevents drop', () => {
    it('does not show indicator when section is collapsed', () => {
      vi.mocked(useDroppable).mockReturnValue({
        setNodeRef: vi.fn(),
        isOver: true,
        active: { id: 'test-server' },
        over: null,
        rect: null as unknown as React.MutableRefObject<{ width: number; height: number } | null>,
        node: { current: null },
        isDisabled: false,
      });

      render(
        <DndContext>
          <SectionDropZone
            sectionType="workstation"
            isActiveSection={false}
            isCollapsed={true}
          >
            <div>Section content</div>
          </SectionDropZone>
        </DndContext>
      );

      // Should not show drop indicator when collapsed
      expect(screen.queryByTestId('drop-indicator-workstation')).not.toBeInTheDocument();
    });

    it('passes disabled=true to useDroppable when collapsed', () => {
      render(
        <DndContext>
          <SectionDropZone
            sectionType="workstation"
            isActiveSection={false}
            isCollapsed={true}
          >
            <div>Section content</div>
          </SectionDropZone>
        </DndContext>
      );

      expect(useDroppable).toHaveBeenCalledWith(
        expect.objectContaining({
          disabled: true,
        })
      );
    });
  });

  describe('rendering', () => {
    it('renders children', () => {
      vi.mocked(useDroppable).mockReturnValue({
        setNodeRef: vi.fn(),
        isOver: false,
        active: null,
        over: null,
        rect: null as unknown as React.MutableRefObject<{ width: number; height: number } | null>,
        node: { current: null },
        isDisabled: false,
      });

      render(
        <DndContext>
          <SectionDropZone
            sectionType="server"
            isActiveSection={false}
            isCollapsed={false}
          >
            <div data-testid="child-content">Child content</div>
          </SectionDropZone>
        </DndContext>
      );

      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });
  });
});
