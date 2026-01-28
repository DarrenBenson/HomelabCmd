/**
 * Types for Network Discovery feature.
 *
 * US0041: Network Discovery
 * US0069: Service Discovery During Agent Installation
 */

// =============================================================================
// Service Discovery Types (US0069)
// =============================================================================

/**
 * A discovered systemd service on a remote host.
 */
export interface DiscoveredService {
  /** Service name without .service suffix */
  name: string;
  /** Service status (running, etc) */
  status: string;
  /** Service description */
  description: string;
}

/**
 * Request to discover services on a remote host.
 *
 * US0073: Added key_id for SSH key selection.
 */
export interface ServiceDiscoveryRequest {
  /** Target hostname or IP address */
  hostname: string;
  /** SSH port (default: 22) */
  port?: number;
  /** SSH username (default: root) */
  username?: string;
  /** SSH key ID to use for authentication. If not provided, all keys are tried. */
  key_id?: string;
}

/**
 * Response from service discovery.
 */
export interface ServiceDiscoveryResponse {
  /** List of discovered services */
  services: DiscoveredService[];
  /** Total services discovered */
  total: number;
  /** Services filtered out (system services) */
  filtered: number;
}

/**
 * Service configuration for monitoring with core/standard classification.
 */
export interface ServiceConfig {
  /** Service name */
  name: string;
  /** True = critical alerts (Core), False = warning alerts (Standard) */
  core: boolean;
}

// =============================================================================
// Network Discovery Types (US0041)
// =============================================================================

/**
 * Status of a discovery scan.
 */
export type DiscoveryStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * SSH authentication status for discovered devices.
 * BG0008: Show auth status before allowing scans.
 */
export type SSHAuthStatus = 'untested' | 'success' | 'failed';

/**
 * A discovered device on the network.
 *
 * US0073: Network Discovery Key Selection - added ssh_key_used field.
 */
export interface DiscoveryDevice {
  /** IP address of the device */
  ip: string;
  /** Hostname resolved via reverse DNS, or null if not resolvable */
  hostname: string | null;
  /** Response time in milliseconds */
  response_time_ms: number;
  /** Whether this device is already registered as a monitored server */
  is_monitored: boolean;
  /** SSH authentication status: 'untested', 'success', or 'failed' */
  ssh_auth_status: SSHAuthStatus;
  /** SSH auth error message (if status is 'failed') */
  ssh_auth_error: string | null;
  /** Name of SSH key that succeeded (if ssh_auth_status is 'success') */
  ssh_key_used: string | null;
}

/**
 * Progress information for a running discovery.
 */
export interface DiscoveryProgress {
  /** Number of IPs scanned so far */
  scanned: number;
  /** Total number of IPs to scan */
  total: number;
  /** Progress as a percentage (0-100) */
  percent: number;
}

/**
 * Request to start a new discovery scan.
 *
 * US0073: Network Discovery Key Selection - added key_id field.
 */
export interface DiscoveryRequest {
  /** Subnet to scan in CIDR notation (e.g., "192.168.1.0/24"). Optional. */
  subnet?: string;
  /** SSH key ID to use for authentication. If not provided, all keys are tried. */
  key_id?: string;
}

/**
 * Response from discovery API endpoints.
 */
export interface DiscoveryResponse {
  /** Unique ID of this discovery */
  discovery_id: number;
  /** Current status of the discovery */
  status: DiscoveryStatus;
  /** Subnet being scanned */
  subnet: string;
  /** When the discovery started */
  started_at: string;
  /** When the discovery completed (null if still running) */
  completed_at: string | null;
  /** Progress information (only while running) */
  progress: DiscoveryProgress | null;
  /** Count of devices found so far */
  devices_found: number;
  /** List of discovered devices (only when completed) */
  devices: DiscoveryDevice[] | null;
  /** Error message if discovery failed */
  error: string | null;
}

/**
 * Discovery settings from the backend.
 */
export interface DiscoverySettings {
  /** Default subnet to use if not specified in request */
  default_subnet: string;
  /** Connection timeout in milliseconds */
  timeout_ms: number;
}

/**
 * Request to update discovery settings.
 */
export interface DiscoverySettingsUpdate {
  /** Default subnet to scan in CIDR notation */
  default_subnet?: string;
  /** Connection timeout in milliseconds (100-5000) */
  timeout_ms?: number;
}

// =============================================================================
// Unified Discovery Types (EP0016)
// =============================================================================

/** Source of device discovery */
export type DiscoverySource = 'network' | 'tailscale';

/** Availability status for unified device cards */
export type AvailabilityStatus = 'available' | 'unavailable' | 'untested';

/**
 * Unified device representation for both Network and Tailscale discovery.
 *
 * EP0016: Unified Discovery Experience
 */
export interface UnifiedDevice {
  /** Unique identifier (IP for network, device ID for Tailscale) */
  id: string;
  /** Device hostname */
  hostname: string;
  /** IP address (local for network, Tailscale IP for Tailscale) */
  ip: string;
  /** Operating system */
  os: string;
  /** Discovery source */
  source: DiscoverySource;
  /** Availability status based on SSH test or online status */
  availability: AvailabilityStatus;
  /** Reason for unavailability (shown in tooltip) */
  unavailableReason: string | null;
  /** Whether device is already registered as a server */
  isMonitored: boolean;
  /** Server ID if already monitored */
  serverId?: string;
  /** Response time in ms (network) or null */
  responseTimeMs: number | null;
  /** Last seen timestamp (ISO string) */
  lastSeen: string | null;
  /** SSH key that was used for successful connection */
  sshKeyUsed: string | null;

  // Tailscale-specific fields
  /** Tailscale device ID */
  tailscaleDeviceId?: string;
  /** Tailscale hostname (full FQDN) */
  tailscaleHostname?: string;
  /** Whether device is online on Tailscale */
  tailscaleOnline?: boolean;
}
