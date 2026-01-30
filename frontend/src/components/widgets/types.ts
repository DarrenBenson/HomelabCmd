import type { Layout, LayoutItem, ResponsiveLayouts, Breakpoint, Breakpoints } from 'react-grid-layout';
import type { ReactNode, ComponentType } from 'react';

/**
 * Widget identifier - matches widget registry keys
 */
export type WidgetId =
  | 'cpu_chart'
  | 'memory_gauge'
  | 'load_average'
  | 'disk_usage'
  | 'services'
  | 'containers'
  | 'network'
  | 'system_info'
  | 'server_info'
  | 'compliance_dashboard';

/**
 * Machine types that widgets can apply to
 */
export type MachineType = 'server' | 'workstation';

/**
 * Features that a machine may or may not have
 */
export type MachineFeature = 'docker' | 'systemd';

/**
 * Widget definition in the registry
 */
export interface WidgetDefinition {
  /** Unique widget identifier */
  id: WidgetId;
  /** Display title for the widget header */
  title: string;
  /** Lucide icon component */
  icon?: ComponentType<{ className?: string }>;
  /** Minimum width in grid columns */
  minW: number;
  /** Minimum height in grid rows */
  minH: number;
  /** Default width in grid columns */
  defaultW: number;
  /** Default height in grid rows */
  defaultH: number;
  /** Machine types this widget applies to */
  applicableTo: MachineType[];
  /** Optional feature requirement (e.g., 'docker' for containers widget) */
  requiresFeature?: MachineFeature;
  /** Widget component to render */
  component: ComponentType<WidgetProps>;
}

/**
 * Props passed to all widget components
 */
export interface WidgetProps {
  /** Machine data from server */
  machine: MachineData;
  /** Current widget width in pixels (from grid) */
  width?: number;
  /** Current widget height in pixels (from grid) */
  height?: number;
}

/**
 * Per-filesystem disk metric (US0178)
 */
export interface FilesystemMetric {
  mount_point: string;
  device: string;
  fs_type: string;
  total_bytes: number;
  used_bytes: number;
  available_bytes: number;
  percent: number;
}

/**
 * Per-interface network metric (US0179)
 */
export interface NetworkInterfaceMetric {
  name: string;
  rx_bytes: number;
  tx_bytes: number;
  rx_packets: number;
  tx_packets: number;
  is_up: boolean;
}

/**
 * Machine data passed to widgets
 * Subset of ServerDetail relevant for widgets
 */
export interface MachineData {
  id: string;
  hostname: string;
  display_name?: string | null;
  status: 'online' | 'offline' | 'unknown';
  machine_type?: 'server' | 'workstation';
  ip_address?: string | null;
  tailscale_hostname?: string | null;
  os_distribution?: string | null;
  os_version?: string | null;
  kernel_version?: string | null;
  architecture?: string | null;
  cpu_model?: string | null;
  cpu_cores?: number | null;
  last_seen?: string | null;
  is_paused?: boolean;
  agent_version?: string | null;
  latest_metrics?: MachineMetrics | null;
  /** Per-filesystem disk metrics (US0178) */
  filesystems?: FilesystemMetric[] | null;
  /** Per-interface network metrics (US0179) */
  network_interfaces?: NetworkInterfaceMetric[] | null;
}

/**
 * Machine metrics for widgets
 */
export interface MachineMetrics {
  cpu_percent?: number | null;
  memory_percent?: number | null;
  memory_used_mb?: number | null;
  memory_total_mb?: number | null;
  disk_percent?: number | null;
  disk_used_gb?: number | null;
  disk_total_gb?: number | null;
  load_1m?: number | null;
  load_5m?: number | null;
  load_15m?: number | null;
  network_rx_bytes?: number | null;
  network_tx_bytes?: number | null;
  uptime_seconds?: number | null;
}

/**
 * Re-export types from react-grid-layout for convenience
 */
export type { Layout, LayoutItem, ResponsiveLayouts, Breakpoint, Breakpoints };

/**
 * Alias for compatibility - WidgetLayouts is ResponsiveLayouts
 */
export type WidgetLayouts = ResponsiveLayouts<string>;

/**
 * Alias for compatibility
 */
export type WidgetLayoutItem = LayoutItem;

/**
 * Grid configuration
 */
export interface GridConfig {
  /** Breakpoint pixel values */
  breakpoints: Breakpoints<string>;
  /** Columns per breakpoint */
  cols: Breakpoints<string>;
  /** Row height in pixels */
  rowHeight: number;
  /** Margin between widgets [horizontal, vertical] */
  margin: [number, number];
  /** Container padding [horizontal, vertical] */
  containerPadding: [number, number];
}

/**
 * Default grid configuration
 */
export const DEFAULT_GRID_CONFIG: GridConfig = {
  breakpoints: { lg: 1200, md: 996, sm: 768, xs: 480 },
  cols: { lg: 12, md: 6, sm: 6, xs: 1 },
  rowHeight: 100,
  margin: [16, 16],
  containerPadding: [0, 0],
};

/**
 * Props for WidgetGrid component
 */
export interface WidgetGridProps {
  /** Machine data to pass to widgets */
  machine: MachineData;
  /** Current layout (controlled) */
  layouts?: WidgetLayouts;
  /** Layout change callback */
  onLayoutChange?: (currentLayout: Layout, allLayouts: WidgetLayouts) => void;
  /** Whether widgets can be dragged */
  isDraggable?: boolean;
  /** Whether widgets can be resized */
  isResizable?: boolean;
  /** Whether edit mode is active (shows grid lines, handles) */
  isEditMode?: boolean;
  /** Custom grid configuration */
  config?: Partial<GridConfig>;
  /** Children to render as widgets */
  children?: ReactNode;
}

/**
 * Props for WidgetContainer component
 */
export interface WidgetContainerProps {
  /** Widget title for header */
  title: string;
  /** Optional icon component */
  icon?: ReactNode;
  /** Whether in edit mode (shows resize handles) */
  isEditMode?: boolean;
  /** Callback when remove button clicked (US0176 AC3) */
  onRemove?: () => void;
  /** Children content */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
}
