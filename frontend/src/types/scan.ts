/**
 * TypeScript types for Scan API responses.
 * Matches backend Pydantic schemas from homelab_cmd/api/schemas/scan.py
 *
 * US0039: Scan Results Display
 */

export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ScanType = 'quick' | 'full';

export interface OSInfo {
  name: string | null;
  version: string | null;
  kernel: string | null;
  pretty_name: string | null;
  id: string | null;
}

export interface DiskInfo {
  mount: string;
  total_gb: number;
  used_gb: number;
  percent: number;
}

export interface MemoryInfo {
  total_mb: number;
  used_mb: number;
  percent: number;
}

export interface ProcessInfo {
  user: string;
  pid: number;
  cpu_percent: number;
  mem_percent: number;
  command: string;
}

export interface NetworkAddress {
  type: string;
  address: string;
}

export interface NetworkInterface {
  name: string;
  state: string;
  addresses: NetworkAddress[];
}

export interface PackageInfo {
  count: number;
  recent: string[];
}

export interface ScanResults {
  os: OSInfo | null;
  hostname: string | null;
  uptime_seconds: number | null;
  disk: DiskInfo[];
  memory: MemoryInfo | null;
  packages: PackageInfo | null;
  processes: ProcessInfo[];
  network_interfaces: NetworkInterface[];
  errors: string[] | null;
}

export interface ScanStatusResponse {
  scan_id: number;
  status: ScanStatus;
  hostname: string;
  scan_type: ScanType;
  progress: number;
  current_step: string | null;
  started_at: string | null;
  completed_at: string | null;
  results: ScanResults | null;
  error: string | null;
}

/**
 * Scan list item - includes results for displaying discovered hostname.
 * US0040: Scan History View
 * BG0007: Display discovered hostname alongside target IP
 */
export interface ScanListItem {
  scan_id: number;
  hostname: string;
  scan_type: ScanType;
  status: ScanStatus;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  /** Scan results - used to extract discovered hostname */
  results: ScanResults | null;
}

/**
 * Filters for listing scans.
 * US0040: Scan History View
 */
export interface ScanListFilters {
  hostname?: string;
  status?: 'completed' | 'failed' | 'pending' | 'running';
  scan_type?: 'quick' | 'full';
  limit?: number;
  offset?: number;
}

/**
 * Response from GET /api/v1/scans.
 * US0040: Scan History View
 */
export interface ScanListResponse {
  scans: ScanListItem[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * SSH configuration from the backend.
 * US0037: SSH Key Configuration
 */
export interface SSHConfig {
  /** Path to SSH keys directory */
  key_path: string;
  /** List of SSH key files found */
  keys_found: string[];
  /** Default SSH username */
  default_username: string;
  /** Default SSH port */
  default_port: number;
}

/**
 * Request to update SSH configuration.
 */
export interface SSHConfigUpdate {
  /** Default SSH username */
  default_username?: string;
  /** Default SSH port */
  default_port?: number;
}

/**
 * Response from updating SSH configuration.
 */
export interface SSHConfigResponse {
  /** List of fields that were updated */
  updated: string[];
  /** Current SSH configuration */
  config: SSHConfig;
}

/**
 * SSH key metadata (without private key content).
 * US0071: SSH Key Manager UI
 * US0072: SSH Key Username Association
 * US0093: Unified SSH Key Management - added is_default field
 */
export interface SSHKeyMetadata {
  /** Key identifier (filename) */
  id: string;
  /** Key name (filename) */
  name: string;
  /** Key type (ED25519, RSA-4096, ECDSA) */
  type: string;
  /** SHA256 fingerprint of the key */
  fingerprint: string;
  /** When the key file was created */
  created_at: string;
  /** SSH username associated with this key (null means use default) */
  username?: string | null;
  /** Whether this key is the default key for SSH operations (US0093) */
  is_default?: boolean;
}

/**
 * Response from setting default SSH key.
 * US0093: Unified SSH Key Management
 */
export interface SetDefaultKeyResponse {
  success: boolean;
  message: string;
}

/**
 * Response from listing SSH keys.
 * US0071: SSH Key Manager UI
 */
export interface SSHKeyListResponse {
  keys: SSHKeyMetadata[];
}

/**
 * Request to upload an SSH key.
 * US0071: SSH Key Manager UI
 * US0072: SSH Key Username Association
 */
export interface SSHKeyUploadRequest {
  /** Key name (will be sanitised to safe characters) */
  name: string;
  /** SSH private key content (PEM format) */
  private_key: string;
  /** SSH username to use with this key (optional, uses default if not set) */
  username?: string;
}
