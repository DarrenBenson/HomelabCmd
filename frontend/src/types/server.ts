export type ServerStatus = 'online' | 'offline' | 'unknown';

export interface LatestMetrics {
  // CPU
  cpu_percent: number | null;

  // Memory
  memory_percent: number | null;
  memory_total_mb: number | null;
  memory_used_mb: number | null;

  // Disk
  disk_percent: number | null;
  disk_total_gb: number | null;
  disk_used_gb: number | null;

  // Network I/O
  network_rx_bytes: number | null;
  network_tx_bytes: number | null;

  // Load averages
  load_1m: number | null;
  load_5m: number | null;
  load_15m: number | null;

  // Uptime
  uptime_seconds: number | null;
}

export type AgentMode = 'readonly' | 'readwrite';

export type MachineType = 'server' | 'workstation';

export interface Server {
  id: string;
  hostname: string;
  display_name: string | null;
  status: ServerStatus;
  is_paused: boolean;
  agent_version: string | null;
  agent_mode: AgentMode | null;
  is_inactive: boolean;
  inactive_since: string | null;
  updates_available: number | null;
  security_updates: number | null;
  latest_metrics: LatestMetrics | null;
  // US0090: Workstation management
  machine_type?: MachineType;
  last_seen: string | null;
  // US0110: Warning state visual treatment
  active_alert_count: number;
  active_alert_summaries?: string[];
  // US0111: Connectivity badge
  tailscale_hostname?: string | null;
}

export interface ServersResponse {
  servers: Server[];
  total: number;
}

// Extended types for Server Detail view

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

export interface ServerDetail {
  id: string;
  guid: string | null; // Permanent agent identity (US0070)
  hostname: string;
  display_name: string | null;
  ip_address: string | null;
  status: ServerStatus;
  is_paused: boolean;
  paused_at: string | null;
  // Agent management (EP0007, BG0017)
  agent_version: string | null;
  agent_mode: AgentMode | null;
  is_inactive: boolean;
  inactive_since: string | null;
  last_seen: string | null;
  os_distribution: string | null;
  os_version: string | null;
  kernel_version: string | null;
  architecture: string | null;
  // CPU information
  cpu_model: string | null;
  cpu_cores: number | null;
  // Power configuration
  machine_category: MachineCategory | null;
  machine_category_source: 'auto' | 'user' | null;
  idle_watts: number | null;
  tdp_watts: number | null;
  // Package updates
  updates_available: number | null;
  security_updates: number | null;
  // Tailscale integration (EP0008)
  tailscale_hostname: string | null;
  // Per-server credential settings (US0088)
  ssh_username: string | null;
  sudo_mode: SudoMode;
  created_at: string;
  updated_at: string;
  latest_metrics: LatestMetrics | null;
}

// Types for Historical Metrics

export type TimeRange = '24h' | '7d' | '30d' | '12m';

export interface MetricPoint {
  timestamp: string;
  cpu_percent: number | null;
  memory_percent: number | null;
  disk_percent: number | null;
}

export interface MetricsHistoryResponse {
  server_id: string;
  range: TimeRange;
  resolution: string;
  data_points: MetricPoint[];
  total_points: number;
}

// Types for Package Update List (US0051)

export interface Package {
  name: string;
  current_version: string;
  new_version: string;
  repository: string;
  is_security: boolean;
  detected_at: string;
  updated_at: string;
}

export interface PackagesResponse {
  server_id: string;
  last_checked: string | null;
  total_count: number;
  security_count: number;
  packages: Package[];
}

// ===========================================================================
// Per-Server Credential Types (US0088)
// ===========================================================================

export type CredentialScope = 'per_server' | 'global' | 'none';
export type SudoMode = 'passwordless' | 'password';

export interface ServerCredentialStatus {
  credential_type: string;
  configured: boolean;
  scope: CredentialScope;
}

export interface ServerCredentialsResponse {
  server_id: string;
  ssh_username: string | null;
  sudo_mode: SudoMode;
  credentials: ServerCredentialStatus[];
}
