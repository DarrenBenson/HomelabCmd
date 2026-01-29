import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import type { LayoutItem, Layout } from 'react-grid-layout';
import { WidgetGrid } from './WidgetGrid';
import { getDefaultResponsiveLayouts } from './defaultLayouts';
import { ServerInfoWidget } from './ServerInfoWidget';
import { SystemInfoWidget } from './SystemInfoWidget';
import { CpuWidget } from './CpuWidget';
import { MemoryWidget } from './MemoryWidget';
import { DiskWidget } from './DiskWidget';
import { ServicesWidget } from './ServicesWidget';
import { NetworkIOWidget } from './NetworkIOWidget';
import { LoadAverageWidget } from './LoadAverageWidget';
import { WidgetPicker } from './WidgetPicker';
import { getWidgetMeta } from './widgetRegistry';
import { getWidgetLayout, saveWidgetLayout, deleteWidgetLayout } from '../../api/widget-layout';
import type { MachineData, WidgetLayouts, WidgetId } from './types';
import type { SSHTestResponse } from '../../types/ssh';
import type { ServerDetail } from '../../types/server';
import type { WidgetLayouts as ApiWidgetLayouts } from '../../types/widget-layout';

const DEBOUNCE_DELAY = 1000; // 1 second debounce for layout save

/**
 * Convert API layout format to grid layout format.
 */
function apiLayoutToGridLayout(apiLayout: ApiWidgetLayouts): WidgetLayouts {
  return {
    lg: apiLayout.lg,
    md: apiLayout.md,
    sm: apiLayout.sm,
    xs: apiLayout.xs,
  };
}

/**
 * Convert grid layout format to API format.
 */
function gridLayoutToApiLayout(gridLayout: WidgetLayouts): ApiWidgetLayouts {
  return {
    lg: (gridLayout.lg as LayoutItem[]) || [],
    md: (gridLayout.md as LayoutItem[]) || [],
    sm: (gridLayout.sm as LayoutItem[]) || [],
    xs: (gridLayout.xs as LayoutItem[]) || [],
  };
}

interface ServerDetailWidgetViewProps {
  /** Server data */
  server: ServerDetail;
  /** Whether edit mode is enabled (US0175) */
  isEditMode?: boolean;
  /** Callback when edit mode should exit (US0175) */
  onExitEditMode?: () => void;
  /** Estimated power in watts */
  estimatedPower?: number | null;
  /** Daily cost estimate */
  dailyCost?: number | null;
  /** Currency symbol */
  currencySymbol?: string;
  /** Maintenance toggle handler */
  onToggleMaintenance?: () => void;
  /** SSH test handler */
  onTestSSH?: () => void;
  /** Power edit handler */
  onPowerEdit?: () => void;
  /** Pause loading state */
  pauseLoading?: boolean;
  /** SSH testing state */
  sshTesting?: boolean;
  /** SSH test result */
  sshTestResult?: SSHTestResponse | null;
}

/**
 * Widget-based view for server detail page
 *
 * Renders server information in a customisable widget grid layout.
 * Supports layout persistence per machine (US0173).
 */
export function ServerDetailWidgetView({
  server,
  isEditMode = false,
  onExitEditMode,
  estimatedPower,
  dailyCost,
  currencySymbol = '£',
  onToggleMaintenance,
  onTestSSH,
  onPowerEdit,
  pauseLoading = false,
  sshTesting = false,
  sshTestResult,
}: ServerDetailWidgetViewProps) {
  // Determine machine type - default to 'server' if not specified (AC1 edge case)
  const machineType = server.machine_type ?? 'server';

  // Convert server to MachineData format
  const machineData: MachineData = useMemo(() => ({
    id: server.id,
    hostname: server.hostname,
    display_name: server.display_name,
    status: server.status,
    machine_type: machineType,
    ip_address: server.ip_address,
    tailscale_hostname: server.tailscale_hostname,
    os_distribution: server.os_distribution,
    os_version: server.os_version,
    kernel_version: server.kernel_version,
    architecture: server.architecture,
    cpu_model: server.cpu_model,
    cpu_cores: server.cpu_cores,
    last_seen: server.last_seen,
    is_paused: server.is_paused,
    agent_version: server.agent_version,
    latest_metrics: server.latest_metrics,
    filesystems: server.filesystems,
    network_interfaces: server.network_interfaces,
  }), [server, machineType]);

  // Get default responsive layouts based on machine type (US0174: AC2, AC3)
  // Servers get full layout with services, workstations get simplified layout
  const defaultLayouts = useMemo(
    () => getDefaultResponsiveLayouts(machineType) as WidgetLayouts,
    [machineType]
  );

  // Layout state - starts with default, updated when loaded from API
  const [layouts, setLayouts] = useState<WidgetLayouts>(defaultLayouts);
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const [hasCustomLayout, setHasCustomLayout] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  // Debounce timer ref
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLayoutRef = useRef<WidgetLayouts | null>(null);

  // Store layout at edit mode start for cancel functionality (US0175 AC5)
  const layoutAtEditStartRef = useRef<WidgetLayouts | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load saved layout on mount
  useEffect(() => {
    let ignore = false;

    async function loadLayout() {
      try {
        const response = await getWidgetLayout(server.id);
        if (!ignore && response.layouts) {
          setLayouts(apiLayoutToGridLayout(response.layouts));
          setHasCustomLayout(true);
        }
      } catch {
        // Use default layout if load fails
      } finally {
        if (!ignore) {
          setLayoutLoaded(true);
        }
      }
    }

    loadLayout();

    return () => {
      ignore = true;
    };
  }, [server.id]);

  // Save layout to API (debounced)
  const saveLayout = useCallback(async (layoutsToSave: WidgetLayouts) => {
    try {
      setSaveError(null);
      await saveWidgetLayout(server.id, { layouts: gridLayoutToApiLayout(layoutsToSave) });
      setHasCustomLayout(true);
    } catch (err) {
      setSaveError('Failed to save layout');
      console.error('Failed to save widget layout:', err);
    }
  }, [server.id]);

  // Handle layout change from grid
  const handleLayoutChange = useCallback((_currentLayout: Layout, allLayouts: WidgetLayouts) => {
    // Update local state immediately
    setLayouts(allLayouts);
    setHasUnsavedChanges(true);

    // Clear any pending save
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Store the latest layout
    pendingLayoutRef.current = allLayouts;

    // Debounce the save
    saveTimerRef.current = setTimeout(() => {
      if (pendingLayoutRef.current) {
        saveLayout(pendingLayoutRef.current);
        pendingLayoutRef.current = null;
        setHasUnsavedChanges(false);
      }
    }, DEBOUNCE_DELAY);
  }, [saveLayout]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        // Save any pending layout before unmount
        if (pendingLayoutRef.current) {
          saveLayout(pendingLayoutRef.current);
        }
      }
    };
  }, [saveLayout]);

  // Reset to default layout
  const handleResetLayout = useCallback(async () => {
    setResetting(true);
    try {
      await deleteWidgetLayout(server.id);
      setLayouts(defaultLayouts);
      setHasCustomLayout(false);
      setSaveError(null);
    } catch (err) {
      console.error('Failed to reset layout:', err);
    } finally {
      setResetting(false);
    }
  }, [server.id, defaultLayouts]);

  // Capture layout when entering edit mode (US0175 AC5)
  useEffect(() => {
    if (isEditMode) {
      // Store current layout for cancel
      layoutAtEditStartRef.current = layouts;
      setHasUnsavedChanges(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only capture on edit mode entry
  }, [isEditMode]);

  // Cancel edit mode - revert to layout at start (US0175 AC5)
  const handleCancelEdit = useCallback(() => {
    // Clear any pending save
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    pendingLayoutRef.current = null;

    // Revert to layout at edit start
    if (layoutAtEditStartRef.current) {
      setLayouts(layoutAtEditStartRef.current);
    }

    setHasUnsavedChanges(false);
    setSaveError(null);
    onExitEditMode?.();
  }, [onExitEditMode]);

  // Save and exit edit mode (US0175 AC5)
  const handleSaveAndExit = useCallback(async () => {
    // Flush any pending save immediately
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    // Save current layout
    if (pendingLayoutRef.current || hasUnsavedChanges) {
      await saveLayout(pendingLayoutRef.current || layouts);
      pendingLayoutRef.current = null;
    }

    setHasUnsavedChanges(false);
    onExitEditMode?.();
  }, [saveLayout, layouts, hasUnsavedChanges, onExitEditMode]);

  // Get visible widgets from current layout (US0176)
  const visibleWidgets = useMemo(() => {
    return (layouts.lg || []).map(item => item.i as WidgetId);
  }, [layouts]);

  // Add a widget to the layout (US0176 AC2)
  const handleAddWidget = useCallback((widgetId: WidgetId) => {
    const meta = getWidgetMeta(widgetId);
    if (!meta) return;

    // Find the lowest y position in the current layout to add below
    const maxY = Math.max(0, ...(layouts.lg || []).map(item => item.y + item.h));

    const newItem: LayoutItem = {
      i: widgetId,
      x: 0,
      y: maxY,
      w: meta.defaultW,
      h: meta.defaultH,
      minW: meta.minW,
      minH: meta.minH,
    };

    // Add to all breakpoints
    const newLayouts: WidgetLayouts = {
      lg: [...(layouts.lg || []), newItem],
      md: [...(layouts.md || []), { ...newItem, w: Math.min(newItem.w, 6), x: 0 }],
      sm: [...(layouts.sm || []), { ...newItem, w: Math.min(newItem.w, 6), x: 0 }],
      xs: [...(layouts.xs || []), { ...newItem, w: 1, x: 0 }],
    };

    setLayouts(newLayouts);
    setHasUnsavedChanges(true);

    // Auto-save (US0176 AC6)
    saveLayout(newLayouts);
  }, [layouts, saveLayout]);

  // Remove a widget from the layout (US0176 AC3)
  const handleRemoveWidget = useCallback((widgetId: WidgetId) => {
    const newLayouts: WidgetLayouts = {
      lg: (layouts.lg || []).filter(item => item.i !== widgetId),
      md: (layouts.md || []).filter(item => item.i !== widgetId),
      sm: (layouts.sm || []).filter(item => item.i !== widgetId),
      xs: (layouts.xs || []).filter(item => item.i !== widgetId),
    };

    setLayouts(newLayouts);
    setHasUnsavedChanges(true);

    // Auto-save (US0176 AC6)
    saveLayout(newLayouts);
  }, [layouts, saveLayout]);

  // Show loading state until layout is loaded
  if (!layoutLoaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-text-muted border-t-status-info"
          data-testid="layout-loading"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Edit mode controls (US0175: AC4, AC5, AC6) */}
      {isEditMode && (
        <div
          className="flex items-center justify-between rounded-lg border-2 border-status-info bg-status-info/10 p-3"
          data-testid="edit-mode-banner"
        >
          <div className="flex items-center gap-3">
            {/* Edit mode indicator badge (AC6) */}
            <span className="rounded-md bg-status-info px-2 py-1 text-xs font-medium text-white">
              EDITING
            </span>
            <span className="text-sm text-text-secondary">
              Drag widgets to rearrange • Resize from corners
            </span>
            {saveError && (
              <span className="text-sm text-status-error" data-testid="save-error">
                {saveError}
              </span>
            )}
            {hasUnsavedChanges && (
              <span className="text-sm text-status-warning" data-testid="unsaved-indicator">
                Unsaved changes
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Add Widget button (US0176 AC1) */}
            <WidgetPicker
              visibleWidgets={visibleWidgets}
              machineType={machineType}
              onAddWidget={handleAddWidget}
            />
            {/* Reset to default button */}
            {hasCustomLayout && (
              <button
                onClick={handleResetLayout}
                disabled={resetting}
                className="rounded-md bg-bg-tertiary px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-secondary hover:text-text-primary disabled:opacity-50"
                data-testid="reset-layout-button"
              >
                {resetting ? 'Resetting...' : 'Reset to Default'}
              </button>
            )}
            {/* Cancel button (AC5) */}
            <button
              onClick={handleCancelEdit}
              className="rounded-md bg-bg-tertiary px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
              data-testid="cancel-edit-button"
            >
              Cancel
            </button>
            {/* Save button (AC5) */}
            <button
              onClick={handleSaveAndExit}
              className="rounded-md bg-status-success px-3 py-1.5 text-sm text-white hover:bg-status-success/80"
              data-testid="save-layout-button"
            >
              Save
            </button>
          </div>
        </div>
      )}

      <WidgetGrid
        machine={machineData}
        layouts={layouts}
        onLayoutChange={handleLayoutChange}
        isDraggable={isEditMode}
        isResizable={isEditMode}
        isEditMode={isEditMode}
      >
        {/* Server Information Widget (US0176: conditionally visible) */}
        {visibleWidgets.includes('server_info') && (
          <div key="server_info" data-testid="widget-server-info">
            <ServerInfoWidget
              machine={machineData}
              isEditMode={isEditMode}
              onRemove={isEditMode ? () => handleRemoveWidget('server_info') : undefined}
              onToggleMaintenance={onToggleMaintenance}
              onTestSSH={onTestSSH}
              pauseLoading={pauseLoading}
              sshTesting={sshTesting}
              sshTestResult={sshTestResult}
            />
          </div>
        )}

        {/* System Info Widget (US0176: conditionally visible) */}
        {visibleWidgets.includes('system_info') && (
          <div key="system_info" data-testid="widget-system-info">
            <SystemInfoWidget
              machine={machineData}
              isEditMode={isEditMode}
              onRemove={isEditMode ? () => handleRemoveWidget('system_info') : undefined}
              tdpWatts={server.tdp_watts}
              idleWatts={server.idle_watts}
              machineCategory={server.machine_category}
              machineCategorySource={server.machine_category_source}
              estimatedPower={estimatedPower}
              dailyCost={dailyCost}
              currencySymbol={currencySymbol}
              onPowerEdit={onPowerEdit}
            />
          </div>
        )}

        {/* CPU Usage Widget (US0176: conditionally visible) */}
        {visibleWidgets.includes('cpu_chart') && (
          <div key="cpu_chart" data-testid="widget-cpu-chart">
            <CpuWidget
              machine={machineData}
              isEditMode={isEditMode}
              onRemove={isEditMode ? () => handleRemoveWidget('cpu_chart') : undefined}
            />
          </div>
        )}

        {/* Memory Usage Widget (US0176: conditionally visible) */}
        {visibleWidgets.includes('memory_gauge') && (
          <div key="memory_gauge" data-testid="widget-memory-gauge">
            <MemoryWidget
              machine={machineData}
              isEditMode={isEditMode}
              onRemove={isEditMode ? () => handleRemoveWidget('memory_gauge') : undefined}
            />
          </div>
        )}

        {/* Disk Usage Widget (US0176: conditionally visible) */}
        {visibleWidgets.includes('disk_usage') && (
          <div key="disk_usage" data-testid="widget-disk-usage">
            <DiskWidget
              machine={machineData}
              isEditMode={isEditMode}
              onRemove={isEditMode ? () => handleRemoveWidget('disk_usage') : undefined}
            />
          </div>
        )}

        {/* Load Average Widget - servers only (US0174 AC2, US0176: conditionally visible) */}
        {machineType === 'server' && visibleWidgets.includes('load_average') && (
          <div key="load_average" data-testid="widget-load-average">
            <LoadAverageWidget
              machine={machineData}
              isEditMode={isEditMode}
              onRemove={isEditMode ? () => handleRemoveWidget('load_average') : undefined}
            />
          </div>
        )}

        {/* Network I/O Widget (US0176: conditionally visible) */}
        {visibleWidgets.includes('network') && (
          <div key="network" data-testid="widget-network">
            <NetworkIOWidget
              machine={machineData}
              isEditMode={isEditMode}
              onRemove={isEditMode ? () => handleRemoveWidget('network') : undefined}
            />
          </div>
        )}

        {/* Services Widget - servers only (US0174 AC2, AC3, US0176: conditionally visible) */}
        {machineType === 'server' && visibleWidgets.includes('services') && (
          <div key="services" data-testid="widget-services">
            <ServicesWidget
              machine={machineData}
              isEditMode={isEditMode}
              onRemove={isEditMode ? () => handleRemoveWidget('services') : undefined}
              isInactive={server.is_inactive}
              agentMode={server.agent_mode}
            />
          </div>
        )}
      </WidgetGrid>
    </div>
  );
}
