/**
 * Widget Registry for US0176: Widget Visibility Toggle
 *
 * Defines all available widgets with their metadata for the widget picker.
 */

import type { WidgetId, MachineType, MachineFeature } from './types';

/**
 * Widget metadata for the registry (without component reference to avoid circular deps)
 */
export interface WidgetMeta {
  /** Unique widget identifier */
  id: WidgetId;
  /** Display title for the widget */
  title: string;
  /** Description shown in the widget picker */
  description: string;
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
  /** Optional feature requirement */
  requiresFeature?: MachineFeature;
}

/**
 * Registry of all available widgets
 */
export const WIDGET_REGISTRY: WidgetMeta[] = [
  {
    id: 'server_info',
    title: 'Server Information',
    description: 'Status, hostname, and quick actions',
    minW: 4,
    minH: 3,
    defaultW: 6,
    defaultH: 4,
    applicableTo: ['server', 'workstation'],
  },
  {
    id: 'system_info',
    title: 'System',
    description: 'OS, kernel, architecture, and power configuration',
    minW: 3,
    minH: 2,
    defaultW: 6,
    defaultH: 4,
    applicableTo: ['server', 'workstation'],
  },
  {
    id: 'cpu_chart',
    title: 'CPU Usage',
    description: 'CPU usage gauge and historical chart',
    minW: 4,
    minH: 3,
    defaultW: 4,
    defaultH: 3,
    applicableTo: ['server', 'workstation'],
  },
  {
    id: 'memory_gauge',
    title: 'Memory Usage',
    description: 'Memory usage gauge and historical chart',
    minW: 4,
    minH: 3,
    defaultW: 4,
    defaultH: 3,
    applicableTo: ['server', 'workstation'],
  },
  {
    id: 'load_average',
    title: 'Load Average',
    description: '1/5/15 minute load averages with core percentage',
    minW: 4,
    minH: 2,
    defaultW: 4,
    defaultH: 3,
    applicableTo: ['server'], // Servers only
  },
  {
    id: 'disk_usage',
    title: 'Disk Usage',
    description: 'Disk space usage across filesystems',
    minW: 4,
    minH: 3,
    defaultW: 4,
    defaultH: 3,
    applicableTo: ['server', 'workstation'],
  },
  {
    id: 'network',
    title: 'Network I/O',
    description: 'Network traffic received and transmitted',
    minW: 4,
    minH: 3,
    defaultW: 4,
    defaultH: 3,
    applicableTo: ['server', 'workstation'],
  },
  {
    id: 'services',
    title: 'Services',
    description: 'Systemd service status and management',
    minW: 4,
    minH: 4,
    defaultW: 8,
    defaultH: 4,
    applicableTo: ['server'], // Servers only
    requiresFeature: 'systemd',
  },
  {
    id: 'containers',
    title: 'Containers',
    description: 'Docker container status and management',
    minW: 4,
    minH: 4,
    defaultW: 8,
    defaultH: 4,
    applicableTo: ['server', 'workstation'],
    requiresFeature: 'docker',
  },
  {
    id: 'compliance_dashboard',
    title: 'Configuration Compliance',
    description: 'Fleet-wide configuration compliance status',
    minW: 4,
    minH: 4,
    defaultW: 6,
    defaultH: 4,
    applicableTo: ['server', 'workstation'],
  },
];

/**
 * Get widget metadata by ID
 */
export function getWidgetMeta(id: WidgetId): WidgetMeta | undefined {
  return WIDGET_REGISTRY.find(w => w.id === id);
}

/**
 * Get all widgets applicable to a machine type
 */
export function getApplicableWidgets(machineType: MachineType): WidgetMeta[] {
  return WIDGET_REGISTRY.filter(w => w.applicableTo.includes(machineType));
}

/**
 * Check if a widget is available for a machine (considering features)
 */
export function isWidgetAvailable(
  widget: WidgetMeta,
  machineType: MachineType,
  features: MachineFeature[] = []
): { available: boolean; reason?: string } {
  // Check machine type
  if (!widget.applicableTo.includes(machineType)) {
    return {
      available: false,
      reason: `Only available for ${widget.applicableTo.join(' and ')}`,
    };
  }

  // Check feature requirement
  if (widget.requiresFeature && !features.includes(widget.requiresFeature)) {
    const featureNames: Record<MachineFeature, string> = {
      docker: 'Docker',
      systemd: 'systemd',
    };
    return {
      available: false,
      reason: `Requires ${featureNames[widget.requiresFeature]}`,
    };
  }

  return { available: true };
}
