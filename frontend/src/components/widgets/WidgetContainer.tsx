import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { WidgetContainerProps } from './types';

/**
 * Widget container component
 *
 * Provides consistent card styling, draggable header, and content area
 * for widgets in the grid layout.
 */
export function WidgetContainer({
  title,
  icon,
  isEditMode = false,
  onRemove,
  children,
  className,
}: WidgetContainerProps) {
  return (
    <div
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-lg border border-border-default bg-bg-secondary',
        isEditMode && 'ring-2 ring-status-info/30',
        className
      )}
      data-testid={`widget-container-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {/* Widget Header - Draggable handle */}
      <div
        className={cn(
          'widget-header flex items-center gap-2 border-b border-border-default px-4 py-3',
          isEditMode && 'cursor-move bg-bg-tertiary'
        )}
        data-testid="widget-header"
      >
        {icon && (
          <span className="text-text-secondary" data-testid="widget-icon">
            {icon}
          </span>
        )}
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        <div className="ml-auto flex items-center gap-2">
          {isEditMode && (
            <span className="text-xs text-text-tertiary">Drag to move</span>
          )}
          {/* Remove button - US0176 AC3 */}
          {isEditMode && onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent drag
                onRemove();
              }}
              className="rounded p-1 text-text-muted hover:bg-status-error/20 hover:text-status-error"
              title="Remove widget"
              data-testid="widget-remove-button"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Widget Content */}
      <div
        className="flex-1 overflow-auto p-4"
        data-testid="widget-content"
      >
        {children}
      </div>
    </div>
  );
}
