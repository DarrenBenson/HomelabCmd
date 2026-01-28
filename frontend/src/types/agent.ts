/**
 * TypeScript types for Agent Deployment API.
 *
 * EP0007: Agent Management
 * US0069: Service Discovery During Agent Installation
 */

import type { ServiceConfig } from './discovery';

export interface AgentVersionResponse {
  version: string;
}

export interface AgentInstallRequest {
  hostname: string;
  port?: number;
  username?: string;
  server_id?: string;
  display_name?: string;
  /** Simple list of services (backward compat) */
  monitored_services?: string[];
  /** Services with core/standard classification (US0069) */
  service_config?: ServiceConfig[];
  command_execution_enabled?: boolean;
  use_sudo?: boolean;
  /** Sudo password for installation (required if user needs password for sudo) */
  sudo_password?: string;
}

export interface AgentInstallResponse {
  success: boolean;
  server_id: string | null;
  message: string;
  error: string | null;
  agent_version: string | null;
}

export interface AgentUpgradeResponse {
  success: boolean;
  server_id: string;
  message: string;
  error: string | null;
  agent_version: string | null;
}

export interface AgentRemoveRequest {
  delete_completely?: boolean;
}

export interface AgentRemoveResponse {
  success: boolean;
  server_id: string;
  message: string;
  error: string | null;
}

export interface ServerActivateResponse {
  success: boolean;
  server_id: string;
  message: string;
  error: string | null;
}
