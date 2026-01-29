import { useMemo } from 'react';
import { GridLayout, useContainerWidth, useResponsiveLayout } from 'react-grid-layout';
import { cn } from '../../lib/utils';
import { DEFAULT_GRID_CONFIG } from './types';
import type { WidgetGridProps, GridConfig, WidgetLayouts } from './types';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

/**
 * Widget Grid component
 *
 * Provides a responsive grid layout for machine detail widgets using react-grid-layout v2.
 * Supports drag-and-drop repositioning and resizing (when edit mode is enabled).
 */
export function WidgetGrid({
  machine,
  layouts: controlledLayouts,
  onLayoutChange,
  isDraggable = false,
  isResizable = false,
  isEditMode = false,
  config: customConfig,
  children,
}: WidgetGridProps) {
  // Merge custom config with defaults
  const config: GridConfig = useMemo(
    () => ({
      ...DEFAULT_GRID_CONFIG,
      ...customConfig,
    }),
    [customConfig]
  );

  // Get container width using hook
  const { width, containerRef, mounted } = useContainerWidth();

  // Use responsive layout hook
  const {
    layout,
    layouts: responsiveLayouts,
    breakpoint,
    cols,
  } = useResponsiveLayout({
    width,
    breakpoints: config.breakpoints,
    cols: config.cols,
    layouts: controlledLayouts ?? {},
    onLayoutChange: (currentLayout, allLayouts) => {
      onLayoutChange?.(currentLayout, allLayouts as WidgetLayouts);
    },
  });

  // Handle layout changes from GridLayout and propagate to parent
  const handleGridLayoutChange = useMemo(() => {
    return (newLayout: typeof layout) => {
      // Update the responsive layouts for the current breakpoint
      const updatedLayouts = {
        ...responsiveLayouts,
        [breakpoint]: newLayout,
      };
      onLayoutChange?.(newLayout, updatedLayouts as WidgetLayouts);
    };
  }, [responsiveLayouts, breakpoint, onLayoutChange]);

  // Build grid config for v2 API
  const gridConfig = useMemo(() => ({
    cols,
    rowHeight: config.rowHeight,
    margin: config.margin as readonly [number, number],
    containerPadding: config.containerPadding as readonly [number, number],
    maxRows: Infinity,
  }), [cols, config.rowHeight, config.margin, config.containerPadding]);

  // Build drag config for v2 API
  const dragConfig = useMemo(() => ({
    enabled: isDraggable && isEditMode,
    handle: '.widget-header',
  }), [isDraggable, isEditMode]);

  // Build resize config for v2 API
  const resizeConfig = useMemo(() => ({
    enabled: isResizable && isEditMode,
  }), [isResizable, isEditMode]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'widget-grid relative min-h-[calc(100vh-12rem)]',
        isEditMode && 'widget-grid--edit-mode'
      )}
      data-testid="widget-grid"
      data-machine-id={machine.id}
      data-breakpoint={breakpoint}
    >
      {/* Edit mode overlay - shows grid lines */}
      {isEditMode && mounted && (
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, var(--color-border-default) 1px, transparent 1px),
              linear-gradient(to bottom, var(--color-border-default) 1px, transparent 1px)
            `,
            backgroundSize: `calc(100% / ${cols}) ${config.rowHeight}px`,
            opacity: 0.3,
          }}
          data-testid="grid-lines"
        />
      )}

      {mounted && (
        <GridLayout
          className="layout"
          layout={layout}
          width={width}
          gridConfig={gridConfig}
          dragConfig={dragConfig}
          resizeConfig={resizeConfig}
          onLayoutChange={handleGridLayoutChange}
        >
          {children}
        </GridLayout>
      )}
    </div>
  );
}
