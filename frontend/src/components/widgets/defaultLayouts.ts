import type { LayoutItem, ResponsiveLayouts } from 'react-grid-layout';

/**
 * Default layout for server machines - large breakpoint (lg: 12 cols)
 * Based on KNOWLEDGESERVER optimised layout
 */
export const serverDefaultLayout: LayoutItem[] = [
  { i: 'server_info', x: 0, y: 0, w: 6, h: 4, minW: 2, minH: 2 },
  { i: 'system_info', x: 6, y: 0, w: 6, h: 4, minW: 2, minH: 2 },
  { i: 'cpu_chart', x: 0, y: 4, w: 4, h: 3, minW: 2, minH: 2 },
  { i: 'memory_gauge', x: 4, y: 4, w: 4, h: 3, minW: 2, minH: 2 },
  { i: 'load_average', x: 8, y: 4, w: 4, h: 3, minW: 2, minH: 2 },
  { i: 'disk_usage', x: 0, y: 7, w: 4, h: 3, minW: 2, minH: 2 },
  { i: 'network', x: 4, y: 7, w: 4, h: 3, minW: 2, minH: 2 },
  { i: 'services', x: 0, y: 10, w: 8, h: 4, minW: 2, minH: 2 },
];

/**
 * Default layout for server machines - medium breakpoint (md: 6 cols)
 */
export const serverDefaultLayoutMd: LayoutItem[] = [
  { i: 'server_info', x: 0, y: 0, w: 2, h: 4, minW: 2, minH: 2 },
  { i: 'system_info', x: 2, y: 0, w: 4, h: 4, minW: 2, minH: 2 },
  { i: 'cpu_chart', x: 0, y: 4, w: 3, h: 3, minW: 2, minH: 2 },
  { i: 'memory_gauge', x: 3, y: 4, w: 3, h: 3, minW: 2, minH: 2 },
  { i: 'load_average', x: 3, y: 7, w: 3, h: 3, minW: 2, minH: 2 },
  { i: 'disk_usage', x: 0, y: 7, w: 3, h: 3, minW: 2, minH: 2 },
  { i: 'network', x: 0, y: 10, w: 2, h: 2, minW: 2, minH: 2 },
  { i: 'services', x: 2, y: 10, w: 4, h: 2, minW: 2, minH: 2 },
];

/**
 * Default layout for server machines - small breakpoint (sm: 6 cols)
 */
export const serverDefaultLayoutSm: LayoutItem[] = [
  { i: 'server_info', x: 0, y: 0, w: 6, h: 4, minW: 2, minH: 2 },
  { i: 'system_info', x: 0, y: 4, w: 6, h: 4, minW: 2, minH: 2 },
  { i: 'cpu_chart', x: 0, y: 8, w: 3, h: 3, minW: 2, minH: 2 },
  { i: 'memory_gauge', x: 3, y: 8, w: 3, h: 3, minW: 2, minH: 2 },
  { i: 'load_average', x: 0, y: 11, w: 3, h: 3, minW: 2, minH: 2 },
  { i: 'disk_usage', x: 3, y: 11, w: 3, h: 3, minW: 2, minH: 2 },
  { i: 'network', x: 0, y: 14, w: 3, h: 3, minW: 2, minH: 2 },
  { i: 'services', x: 0, y: 17, w: 6, h: 4, minW: 2, minH: 2 },
];

/**
 * Default layout for server machines - extra small breakpoint (xs: 1 col)
 */
export const serverDefaultLayoutXs: LayoutItem[] = [
  { i: 'server_info', x: 0, y: 0, w: 1, h: 4, minW: 1, minH: 2 },
  { i: 'system_info', x: 0, y: 4, w: 1, h: 4, minW: 1, minH: 2 },
  { i: 'cpu_chart', x: 0, y: 8, w: 1, h: 3, minW: 1, minH: 2 },
  { i: 'memory_gauge', x: 0, y: 11, w: 1, h: 3, minW: 1, minH: 2 },
  { i: 'load_average', x: 0, y: 14, w: 1, h: 3, minW: 1, minH: 2 },
  { i: 'disk_usage', x: 0, y: 17, w: 1, h: 3, minW: 1, minH: 2 },
  { i: 'network', x: 0, y: 20, w: 1, h: 3, minW: 1, minH: 2 },
  { i: 'services', x: 0, y: 23, w: 1, h: 4, minW: 1, minH: 2 },
];

/**
 * Complete responsive layouts for server machines
 */
export const serverResponsiveLayouts: ResponsiveLayouts<string> = {
  lg: serverDefaultLayout,
  md: serverDefaultLayoutMd,
  sm: serverDefaultLayoutSm,
  xs: serverDefaultLayoutXs,
};

/**
 * Default layout for workstation machines (US0174 AC3)
 */
export const workstationDefaultLayout: LayoutItem[] = [
  { i: 'server_info', x: 0, y: 0, w: 6, h: 4, minW: 2, minH: 2 },
  { i: 'system_info', x: 6, y: 0, w: 6, h: 4, minW: 2, minH: 2 },
  { i: 'cpu_chart', x: 0, y: 4, w: 6, h: 3, minW: 2, minH: 2 },
  { i: 'memory_gauge', x: 6, y: 4, w: 6, h: 3, minW: 2, minH: 2 },
  { i: 'disk_usage', x: 0, y: 7, w: 6, h: 3, minW: 2, minH: 2 },
  { i: 'network', x: 6, y: 7, w: 6, h: 3, minW: 2, minH: 2 },
];

/**
 * Get default layout for a machine type (lg breakpoint only - for backwards compat)
 */
export function getDefaultLayout(machineType?: 'server' | 'workstation'): LayoutItem[] {
  return machineType === 'workstation' ? workstationDefaultLayout : serverDefaultLayout;
}

/**
 * Get complete responsive layouts for a machine type
 */
export function getDefaultResponsiveLayouts(machineType?: 'server' | 'workstation'): ResponsiveLayouts<string> {
  if (machineType === 'workstation') {
    // Workstation uses auto-generated responsive layouts for now
    return {
      lg: workstationDefaultLayout,
      md: workstationDefaultLayout.map(item => ({ ...item, w: Math.min(item.w, 6), x: item.x % 6 })),
      sm: workstationDefaultLayout.map(item => ({ ...item, w: Math.min(item.w, 6), x: item.x % 6 })),
      xs: workstationDefaultLayout.map(item => ({ ...item, w: 1, x: 0 })),
    };
  }
  return serverResponsiveLayouts;
}
