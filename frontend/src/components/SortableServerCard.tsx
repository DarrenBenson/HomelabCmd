import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { ServerCard } from './ServerCard';
import type { Server } from '../types/server';

interface SortableServerCardProps {
  server: Server;
  onClick?: () => void;
  onPauseToggle?: () => void;
  onMessage?: (msg: { type: 'success' | 'error' | 'info'; text: string }) => void;
}

/**
 * US0130: Wrapper component that adds drag-and-drop capability to ServerCard.
 * Shows a drag handle on hover that allows reordering cards in the dashboard grid.
 * US0133 AC6: Touch target minimum 44x44px for mobile accessibility.
 */
export function SortableServerCard({
  server,
  onClick,
  onPauseToggle,
  onMessage,
}: SortableServerCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: server.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group"
      {...attributes}
      data-testid="sortable-server-card"
    >
      {/* AC1: Drag handle - visible on hover, keyboard focusable */}
      {/* US0133 AC6: min-h-11 min-w-11 (44px) for touch target accessibility */}
      <button
        type="button"
        className="absolute left-0 top-1/2 -translate-y-1/2 -ml-4 min-h-11 min-w-11 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity z-10 focus:opacity-100 focus:ring-2 focus:ring-status-info focus:outline-none rounded bg-bg-secondary/80 hover:bg-bg-tertiary touch-manipulation"
        aria-label={`Drag to reorder ${server.display_name || server.hostname}`}
        data-testid="drag-handle"
        {...listeners}
      >
        <GripVertical className="w-5 h-5 text-text-tertiary" aria-hidden="true" />
      </button>

      <ServerCard
        server={server}
        onClick={onClick}
        onPauseToggle={onPauseToggle}
        onMessage={onMessage}
      />
    </div>
  );
}
