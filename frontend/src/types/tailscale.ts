/**
 * Tailscale API integration types.
 *
 * Part of EP0008: Tailscale Integration (US0076).
 *
 * These types match the backend Pydantic schemas in:
 * src/homelab_cmd/api/schemas/tailscale.py
 */

/**
 * Request to save a Tailscale API token.
 */
export interface TailscaleTokenRequest {
  token: string;
}

/**
 * Response after saving or removing a Tailscale token.
 */
export interface TailscaleTokenResponse {
  success: boolean;
  message: string;
}

/**
 * Response from testing Tailscale API connection.
 *
 * On success: success=true, tailnet and device_count populated.
 * On failure: success=false, error and code populated.
 */
export interface TailscaleTestResponse {
  success: boolean;
  tailnet?: string | null;
  device_count?: number | null;
  message?: string | null;
  error?: string | null;
  code?: string | null;
}

/**
 * Response showing current Tailscale configuration status.
 *
 * If configured, shows masked token (first 8 chars + "...").
 */
export interface TailscaleStatusResponse {
  configured: boolean;
  masked_token?: string | null;
}

// =============================================================================
// Device Discovery Types (US0077)
// =============================================================================

/**
 * A single Tailscale device.
 *
 * Part of US0077: Tailscale Device Discovery.
 */
export interface TailscaleDevice {
  id: string;
  name: string;
  hostname: string;
  tailscale_ip: string;
  os: string;
  os_version: string | null;
  last_seen: string;
  online: boolean;
  authorized: boolean;
  already_imported: boolean;
}

/**
 * Response from the device list endpoint.
 *
 * Part of US0077: Tailscale Device Discovery.
 */
export interface TailscaleDeviceListResponse {
  devices: TailscaleDevice[];
  count: number;
  cache_hit: boolean;
  cached_at: string | null;
}

/**
 * Query parameters for device list endpoint.
 */
export interface TailscaleDeviceListParams {
  online?: boolean;
  os?: string;
  refresh?: boolean;
}

// =============================================================================
// Device Import Types (US0078)
// =============================================================================

/**
 * Request to import a Tailscale device as a server.
 *
 * Part of US0078: Machine Registration via Tailscale.
 */
export interface TailscaleImportRequest {
  tailscale_device_id: string;
  tailscale_hostname: string;
  tailscale_ip: string;
  os: string;
  display_name: string;
  machine_type: 'server' | 'workstation';
  tdp?: number | null;
  category_id?: string | null;
}

/**
 * Imported machine details returned after successful import.
 *
 * Part of US0078: Machine Registration via Tailscale.
 */
export interface TailscaleImportedMachine {
  id: string;
  server_id: string;
  display_name: string;
  tailscale_hostname: string;
  tailscale_device_id: string;
  machine_type: string;
  status: string;
  created_at: string;
}

/**
 * Response after successfully importing a Tailscale device.
 *
 * Part of US0078: Machine Registration via Tailscale.
 */
export interface TailscaleImportResponse {
  success: boolean;
  machine: TailscaleImportedMachine;
  message: string;
}

/**
 * Response for import check endpoint.
 *
 * Part of US0078: Machine Registration via Tailscale.
 */
export interface TailscaleImportCheckResponse {
  imported: boolean;
  machine_id?: string | null;
  display_name?: string | null;
  imported_at?: string | null;
}
