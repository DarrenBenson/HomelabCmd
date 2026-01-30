// Widget Grid System - EP0012 Foundation
export { WidgetGrid } from './WidgetGrid';
export { getDefaultLayout, getDefaultResponsiveLayouts, serverDefaultLayout, workstationDefaultLayout } from './defaultLayouts';
export { WidgetContainer } from './WidgetContainer';
export { PlaceholderWidget } from './PlaceholderWidget';

// Widget implementations
export { ServerInfoWidget } from './ServerInfoWidget';
export { SystemInfoWidget } from './SystemInfoWidget';
export { ResourceUtilisationWidget } from './ResourceUtilisationWidget';
export { NetworkIOWidget } from './NetworkIOWidget';
export { LoadAverageWidget } from './LoadAverageWidget';
export { CpuWidget } from './CpuWidget';
export { MemoryWidget } from './MemoryWidget';
export { DiskWidget } from './DiskWidget';
export { ServicesWidget } from './ServicesWidget';
export { ComplianceWidget } from './ComplianceWidget';

// Composite views
export { ServerDetailWidgetView } from './ServerDetailWidgetView';

// Types
export type {
  WidgetId,
  WidgetDefinition,
  WidgetProps,
  WidgetGridProps,
  WidgetContainerProps,
  MachineData,
  MachineMetrics,
  MachineType,
  MachineFeature,
  FilesystemMetric,
  NetworkInterfaceMetric,
  GridConfig,
  Breakpoint,
  Breakpoints,
  WidgetLayoutItem,
  WidgetLayouts,
  Layout,
  LayoutItem,
} from './types';

export { DEFAULT_GRID_CONFIG } from './types';
