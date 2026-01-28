/**
 * Service types for Expected Services API.
 */

/** Possible service status values from heartbeat */
export type ServiceStatus = 'running' | 'stopped' | 'failed' | 'unknown';

/** Current status of a service from the latest heartbeat */
export interface ServiceCurrentStatus {
  status: ServiceStatus;
  status_reason: string | null;
  pid: number | null;
  memory_mb: number | null;
  cpu_percent: number | null;
  last_seen: string;
}

/** Expected service configuration with current status */
export interface ExpectedService {
  service_name: string;
  display_name: string | null;
  is_critical: boolean;
  enabled: boolean;
  current_status: ServiceCurrentStatus | null;
}

/** Response from GET /servers/{server_id}/services */
export interface ServicesResponse {
  services: ExpectedService[];
  total: number;
}

/** Response from POST /servers/{server_id}/services/{service_name}/restart */
export interface RestartActionResponse {
  action_id: number;
  action_type: string;
  server_id: string;
  service_name: string;
  command: string;
  status: string;
  created_at: string;
}

// =============================================================================
// Service Discovery Types (US0069)
// =============================================================================

/** Request to discover services on a remote host via SSH */
export interface ServiceDiscoveryRequest {
  hostname: string;
  port?: number;
  username?: string;
  key_id?: string | null;
}

/** A discovered systemd service from SSH scan */
export interface DiscoveredService {
  name: string;
  status: string;
  description: string;
}

/** Response from POST /api/v1/discovery/services */
export interface ServiceDiscoveryResponse {
  services: DiscoveredService[];
  total: number;
  filtered: number;
}

// =============================================================================
// Service Management Types
// =============================================================================

/** Request to create an expected service */
export interface ExpectedServiceCreate {
  service_name: string;
  display_name?: string | null;
  is_critical: boolean;
}

/** Request to update an expected service */
export interface ExpectedServiceUpdate {
  display_name?: string | null;
  is_critical?: boolean;
  enabled?: boolean;
}
