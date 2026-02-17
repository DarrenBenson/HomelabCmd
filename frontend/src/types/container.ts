/**
 * Container types for Docker container monitoring (US0159 - EP0014).
 */

/**
 * Individual Docker container information.
 */
export interface ContainerInfo {
  /** Short container ID (12 chars) */
  id: string;
  /** Container name */
  name: string;
  /** Image name with tag */
  image: string;
  /** Container state: running, exited, created, paused, restarting, dead */
  state: ContainerState;
  /** Human-readable status from Docker */
  status: string;
  /** Port mappings */
  ports: string | null;
  /** Container creation timestamp */
  created_at: string | null;
  /** Uptime in seconds (only for running containers) */
  uptime_seconds: number | null;
}

/**
 * Container state values.
 */
export type ContainerState = 'running' | 'exited' | 'created' | 'paused' | 'restarting' | 'dead' | 'unknown';

/**
 * Response from container listing endpoint.
 */
export interface ContainerListResponse {
  /** Server identifier */
  server_id: string;
  /** List of containers */
  containers: ContainerInfo[];
  /** Total container count */
  total: number;
  /** Whether response was served from cache */
  cached: boolean;
  /** When data was fetched/cached */
  fetched_at: string;
  /** Error message if fetch failed */
  error: string | null;
}

/**
 * Response from container action endpoints (US0160-US0162).
 */
export interface ContainerActionResponse {
  /** Whether the action succeeded (exit_code == 0) */
  success: boolean;
  /** Docker command output (stdout or stderr) */
  output: string | null;
  /** Container ID or name that was acted upon */
  container_id: string;
  /** Action performed: start, stop, restart */
  action: 'start' | 'stop' | 'restart';
}
