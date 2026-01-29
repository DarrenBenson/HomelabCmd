/**
 * Widget Picker component for US0176: Widget Visibility Toggle
 *
 * Shows a dropdown menu of available widgets that can be added to the layout.
 */

import { useState, useRef, useEffect } from 'react';
import { Plus, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { WIDGET_REGISTRY, isWidgetAvailable } from './widgetRegistry';
import type { WidgetId, MachineType, MachineFeature } from './types';

interface WidgetPickerProps {
  /** IDs of widgets currently visible in layout */
  visibleWidgets: WidgetId[];
  /** Machine type to filter widgets */
  machineType: MachineType;
  /** Features the machine has (e.g., docker, systemd) */
  machineFeatures?: MachineFeature[];
  /** Callback when a widget is selected to add */
  onAddWidget: (widgetId: WidgetId) => void;
}

/**
 * Widget Picker dropdown
 */
export function WidgetPicker({
  visibleWidgets,
  machineType,
  machineFeatures = [],
  onAddWidget,
}: WidgetPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Get available and hidden widgets
  const hiddenWidgets = WIDGET_REGISTRY.filter(
    widget => !visibleWidgets.includes(widget.id)
  );

  const hasHiddenWidgets = hiddenWidgets.length > 0;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={!hasHiddenWidgets}
        className={cn(
          'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
          hasHiddenWidgets
            ? 'bg-bg-tertiary text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
            : 'cursor-not-allowed bg-bg-tertiary/50 text-text-muted'
        )}
        data-testid="add-widget-button"
      >
        <Plus className="h-4 w-4" />
        Add Widget
      </button>

      {/* Dropdown menu */}
      {isOpen && hasHiddenWidgets && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border border-border-default bg-bg-secondary shadow-lg"
          data-testid="widget-picker-menu"
        >
          <div className="p-2">
            <h4 className="px-2 py-1 text-xs font-semibold uppercase text-text-muted">
              Available Widgets
            </h4>
            <ul className="mt-1 space-y-1">
              {hiddenWidgets.map(widget => {
                const availability = isWidgetAvailable(
                  widget,
                  machineType,
                  machineFeatures
                );
                const isVisible = visibleWidgets.includes(widget.id);

                return (
                  <li key={widget.id}>
                    <button
                      onClick={() => {
                        if (availability.available && !isVisible) {
                          onAddWidget(widget.id);
                          setIsOpen(false);
                        }
                      }}
                      disabled={!availability.available || isVisible}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-md px-2 py-2 text-left transition-colors',
                        availability.available && !isVisible
                          ? 'hover:bg-bg-tertiary'
                          : 'cursor-not-allowed opacity-50'
                      )}
                      data-testid={`widget-picker-item-${widget.id}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-text-primary">
                            {widget.title}
                          </span>
                          {isVisible && (
                            <Check className="h-4 w-4 text-status-success" />
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-text-secondary">
                          {widget.description}
                        </p>
                        {!availability.available && availability.reason && (
                          <p className="mt-1 text-xs text-status-warning">
                            {availability.reason}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
