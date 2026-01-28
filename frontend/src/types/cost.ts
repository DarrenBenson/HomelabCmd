/**
 * Cost tracking types for EP0005
 */

/**
 * Machine category enum values.
 */
export type MachineCategory =
  | 'sbc'
  | 'mini_pc'
  | 'nas'
  | 'office_desktop'
  | 'gaming_desktop'
  | 'workstation'
  | 'office_laptop'
  | 'gaming_laptop'
  | 'rack_server';

/**
 * Machine category option for dropdown.
 */
export interface MachineCategoryOption {
  value: MachineCategory;
  label: string;
  idleWatts: number;
  maxWatts: number;
}

/**
 * All machine categories with power profiles.
 */
export const MACHINE_CATEGORIES: MachineCategoryOption[] = [
  { value: 'sbc', label: 'Single Board Computer', idleWatts: 2, maxWatts: 6 },
  { value: 'mini_pc', label: 'Mini PC', idleWatts: 10, maxWatts: 25 },
  { value: 'nas', label: 'NAS/Home Server', idleWatts: 15, maxWatts: 35 },
  { value: 'office_desktop', label: 'Office Desktop', idleWatts: 40, maxWatts: 100 },
  { value: 'gaming_desktop', label: 'Gaming Desktop', idleWatts: 75, maxWatts: 300 },
  { value: 'workstation', label: 'Workstation', idleWatts: 100, maxWatts: 350 },
  { value: 'office_laptop', label: 'Office Laptop', idleWatts: 10, maxWatts: 30 },
  { value: 'gaming_laptop', label: 'Gaming Laptop', idleWatts: 30, maxWatts: 100 },
  { value: 'rack_server', label: 'Rack Server', idleWatts: 100, maxWatts: 300 },
];

/**
 * Cost configuration settings.
 */
export interface CostConfig {
  electricity_rate: number;
  currency_symbol: string;
  updated_at: string | null;
}

/**
 * Request payload for updating cost config.
 */
export interface CostConfigUpdate {
  electricity_rate?: number;
  currency_symbol?: string;
}

/**
 * Cost summary response from /api/v1/costs/summary
 */
export interface CostSummary {
  daily_cost: number;
  monthly_cost: number;
  currency_symbol: string;
  servers_included: number;
  servers_missing_config: number;
  total_estimated_watts: number;
  electricity_rate: number;
  // Deprecated fields for backwards compatibility
  servers_missing_tdp: number;
  total_tdp_watts: number;
}

/**
 * Per-server cost item in breakdown response.
 */
export interface ServerCostItem {
  server_id: string;
  hostname: string;
  // Power configuration
  machine_category: MachineCategory | null;
  machine_category_label: string | null;
  machine_category_source: 'auto' | 'user' | null;
  cpu_model: string | null;
  // Power values
  idle_watts: number | null;
  tdp_watts: number | null;
  estimated_watts: number | null;
  avg_cpu_percent: number | null;
  // Cost values
  daily_cost: number | null;
  monthly_cost: number | null;
}

/**
 * Aggregated cost totals.
 */
export interface CostTotals {
  servers_configured: number;
  servers_unconfigured: number;
  total_estimated_watts: number;
  daily_cost: number;
  monthly_cost: number;
  // Deprecated fields for backwards compatibility
  servers_with_tdp: number;
  servers_without_tdp: number;
  total_tdp_watts: number;
}

/**
 * Cost settings in breakdown response.
 */
export interface CostSettings {
  electricity_rate: number;
  currency_symbol: string;
}

/**
 * Cost breakdown response from /api/v1/costs/breakdown
 */
export interface CostBreakdown {
  servers: ServerCostItem[];
  totals: CostTotals;
  settings: CostSettings;
}

/**
 * Power configuration update payload.
 */
export interface PowerConfigUpdate {
  machine_category: MachineCategory | null;
  idle_watts: number | null;
  tdp_watts: number | null;
}

/**
 * Common TDP presets for quick selection (deprecated, use MACHINE_CATEGORIES).
 */
export const TDP_PRESETS = [
  { label: 'Raspberry Pi 4', watts: 5 },
  { label: 'Raspberry Pi 5', watts: 8 },
  { label: 'Mini PC', watts: 15 },
  { label: 'Intel NUC', watts: 28 },
  { label: 'NAS', watts: 25 },
  { label: 'Desktop', watts: 65 },
  { label: 'Server', watts: 125 },
] as const;
