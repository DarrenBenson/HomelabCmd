import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { SortableServerCard } from './SortableServerCard';
import type { Server } from '../types/server';

// Mock server data
const mockServer: Server = {
  id: 'server-1',
  hostname: 'test-server',
  display_name: 'Test Server',
  status: 'online',
  is_paused: false,
  is_inactive: false,
  machine_type: 'server',
  last_seen: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  latest_metrics: {
    cpu_percent: 25,
    memory_percent: 50,
    disk_percent: 30,
    uptime_seconds: 86400,
  },
};

// Helper to render with DnD context
function renderWithDnd(ui: React.ReactElement, items: string[] = ['server-1']) {
  return render(
    <DndContext>
      <SortableContext items={items}>{ui}</SortableContext>
    </DndContext>
  );
}

describe('SortableServerCard', () => {
  describe('TC01: Drag handle exists in DOM', () => {
    it('renders the drag handle button', () => {
      renderWithDnd(<SortableServerCard server={mockServer} />);

      const dragHandle = screen.getByTestId('drag-handle');
      expect(dragHandle).toBeInTheDocument();
    });

    it('drag handle has accessible label', () => {
      renderWithDnd(<SortableServerCard server={mockServer} />);

      const dragHandle = screen.getByTestId('drag-handle');
      expect(dragHandle).toHaveAttribute(
        'aria-label',
        'Drag to reorder Test Server'
      );
    });
  });

  describe('TC02: Drag handle visibility styling', () => {
    it('drag handle has opacity-0 class (hidden by default)', () => {
      renderWithDnd(<SortableServerCard server={mockServer} />);

      const dragHandle = screen.getByTestId('drag-handle');
      expect(dragHandle).toHaveClass('opacity-0');
    });

    it('drag handle has group-hover:opacity-100 class (visible on hover)', () => {
      renderWithDnd(<SortableServerCard server={mockServer} />);

      const dragHandle = screen.getByTestId('drag-handle');
      expect(dragHandle).toHaveClass('group-hover:opacity-100');
    });

    it('container has group class for hover styling', () => {
      renderWithDnd(<SortableServerCard server={mockServer} />);

      const container = screen.getByTestId('sortable-server-card');
      expect(container).toHaveClass('group');
    });
  });

  describe('TC03: SortableServerCard has useSortable attributes', () => {
    it('renders with data-testid', () => {
      renderWithDnd(<SortableServerCard server={mockServer} />);

      const container = screen.getByTestId('sortable-server-card');
      expect(container).toBeInTheDocument();
    });

    it('wraps ServerCard component', () => {
      renderWithDnd(<SortableServerCard server={mockServer} />);

      // ServerCard renders with data-testid="server-card"
      const serverCard = screen.getByTestId('server-card');
      expect(serverCard).toBeInTheDocument();
    });
  });

  describe('TC14: Single card shows drag handle', () => {
    it('drag handle is rendered even for a single card', () => {
      renderWithDnd(<SortableServerCard server={mockServer} />, ['server-1']);

      const dragHandle = screen.getByTestId('drag-handle');
      expect(dragHandle).toBeInTheDocument();
    });
  });

  describe('TC15: Existing card click navigation works', () => {
    it('calls onClick when card is clicked', async () => {
      const onClick = vi.fn();
      renderWithDnd(<SortableServerCard server={mockServer} onClick={onClick} />);

      // Click on the server card (not the drag handle)
      const serverCard = screen.getByTestId('server-card');
      serverCard.click();

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not trigger onClick when drag handle is clicked', () => {
      const onClick = vi.fn();
      renderWithDnd(<SortableServerCard server={mockServer} onClick={onClick} />);

      // Click on the drag handle
      const dragHandle = screen.getByTestId('drag-handle');
      dragHandle.click();

      // onClick should not be called for drag handle clicks
      // (drag handle has separate listeners)
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('Cursor styling', () => {
    it('drag handle has cursor-grab class', () => {
      renderWithDnd(<SortableServerCard server={mockServer} />);

      const dragHandle = screen.getByTestId('drag-handle');
      expect(dragHandle).toHaveClass('cursor-grab');
    });

    it('drag handle has active:cursor-grabbing class', () => {
      renderWithDnd(<SortableServerCard server={mockServer} />);

      const dragHandle = screen.getByTestId('drag-handle');
      expect(dragHandle).toHaveClass('active:cursor-grabbing');
    });
  });

  describe('Keyboard accessibility', () => {
    it('drag handle has focus:opacity-100 for keyboard visibility', () => {
      renderWithDnd(<SortableServerCard server={mockServer} />);

      const dragHandle = screen.getByTestId('drag-handle');
      expect(dragHandle).toHaveClass('focus:opacity-100');
    });

    it('drag handle has focus ring styling', () => {
      renderWithDnd(<SortableServerCard server={mockServer} />);

      const dragHandle = screen.getByTestId('drag-handle');
      expect(dragHandle).toHaveClass('focus:ring-2');
      expect(dragHandle).toHaveClass('focus:ring-status-info');
    });
  });

  describe('Props forwarding', () => {
    it('forwards onPauseToggle prop to ServerCard', () => {
      const onPauseToggle = vi.fn();
      renderWithDnd(
        <SortableServerCard server={mockServer} onPauseToggle={onPauseToggle} />
      );

      // ServerCard should receive the prop (tested via toggle button existence)
      const toggleButton = screen.getByTestId('toggle-pause-button');
      expect(toggleButton).toBeInTheDocument();
    });

    it('forwards onMessage prop to ServerCard', () => {
      const onMessage = vi.fn();
      renderWithDnd(
        <SortableServerCard server={mockServer} onMessage={onMessage} />
      );

      // Component renders without error with onMessage prop
      const serverCard = screen.getByTestId('server-card');
      expect(serverCard).toBeInTheDocument();
    });
  });

  /**
   * US0133 AC6: Touch target minimum size (44x44px)
   */
  describe('Touch target accessibility (US0133 AC6)', () => {
    it('drag handle has minimum height for touch targets (TC09)', () => {
      renderWithDnd(<SortableServerCard server={mockServer} />);

      const dragHandle = screen.getByTestId('drag-handle');
      // min-h-11 = 44px (2.75rem) for WCAG touch target compliance
      expect(dragHandle).toHaveClass('min-h-11');
    });

    it('drag handle has minimum width for touch targets (TC09)', () => {
      renderWithDnd(<SortableServerCard server={mockServer} />);

      const dragHandle = screen.getByTestId('drag-handle');
      // min-w-11 = 44px (2.75rem) for WCAG touch target compliance
      expect(dragHandle).toHaveClass('min-w-11');
    });

    it('drag handle has touch-manipulation for mobile optimization', () => {
      renderWithDnd(<SortableServerCard server={mockServer} />);

      const dragHandle = screen.getByTestId('drag-handle');
      expect(dragHandle).toHaveClass('touch-manipulation');
    });

    it('drag handle uses flex centering for icon', () => {
      renderWithDnd(<SortableServerCard server={mockServer} />);

      const dragHandle = screen.getByTestId('drag-handle');
      expect(dragHandle).toHaveClass('flex');
      expect(dragHandle).toHaveClass('items-center');
      expect(dragHandle).toHaveClass('justify-center');
    });
  });
});
