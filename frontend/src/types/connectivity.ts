/**
 * Connectivity Mode Management types for US0080.
 */

/** Valid connectivity modes */
export type ConnectivityMode = 'tailscale' | 'direct_ssh';

/** Tailscale connection information */
export interface TailscaleInfo {
  /** Whether Tailscale API token is configured */
  configured: boolean;
  /** Whether connected to Tailscale API */
  connected: boolean;
  /** Tailnet name if connected */
  tailnet: string | null;
  /** Number of devices in tailnet */
  device_count: number;
}

/** SSH configuration information */
export interface SSHInfo {
  /** Default SSH username */
  username: string;
  /** Whether SSH private key is uploaded */
  key_configured: boolean;
  /** When SSH key was uploaded */
  key_uploaded_at: string | null;
}

/** Response for GET /api/v1/settings/connectivity */
export interface ConnectivityStatusResponse {
  /** Current connectivity mode */
  mode: ConnectivityMode;
  /** Whether mode was auto-detected vs explicitly set */
  mode_auto_detected: boolean;
  /** Tailscale connection status */
  tailscale: TailscaleInfo;
  /** SSH configuration status */
  ssh: SSHInfo;
}

/** Request for PUT /api/v1/settings/connectivity */
export interface ConnectivityUpdateRequest {
  /** Connectivity mode to set */
  mode: ConnectivityMode;
  /** SSH username to set (optional) */
  ssh_username?: string;
}

/** Response for PUT /api/v1/settings/connectivity */
export interface ConnectivityUpdateResponse {
  /** Whether update succeeded */
  success: boolean;
  /** Current mode after update */
  mode: ConnectivityMode;
  /** Status message */
  message: string;
}

/** Response for GET /api/v1/settings/connectivity/status (dashboard) */
export interface ConnectivityStatusBarResponse {
  /** Current connectivity mode */
  mode: ConnectivityMode;
  /** Display text for status bar */
  display: string;
  /** Whether connectivity is healthy */
  healthy: boolean;
}
