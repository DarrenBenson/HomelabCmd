/**
 * Action types for remediation actions (US0030).
 */

export type ActionStatus =
  | 'pending'
  | 'approved'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'rejected'
  | 'timed_out'; // US0186: Command timeout configuration

export type ActionType =
  | 'restart_service'
  | 'clear_logs'
  | 'apt_update'
  | 'apt_upgrade_all'
  | 'apt_upgrade_security';

export interface Action {
  id: number;
  server_id: string;
  action_type: ActionType;
  status: ActionStatus;
  service_name: string | null;
  command: string;
  alert_id: number | null;
  created_at: string;
  created_by: string;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  executed_at: string | null;
  completed_at: string | null;
  exit_code: number | null;
  stdout: string | null;
  stderr: string | null;
  // US0186: Command timeout configuration
  timeout_seconds: number | null;
  timed_out_at: string | null;
}

export interface ActionsResponse {
  actions: Action[];
  total: number;
  limit: number;
  offset: number;
}

export interface RejectActionRequest {
  reason: string;
}

export interface CreateActionRequest {
  server_id: string;
  action_type: ActionType;
  service_name?: string;
  alert_id?: number;
  timeout_seconds?: number; // US0186: Optional timeout override
}

// US0186: Action timeout configuration
export interface ActionTimeoutConfig {
  default_timeout: number;
  service_restart_timeout: number;
  package_update_timeout: number;
  updated_at: string | null;
}

// US0156: Real-time command output streaming
export type OutputLineType = 'stdout' | 'stderr' | 'error';

export interface OutputLine {
  type: OutputLineType;
  text: string;
  timestamp: string;
}

export interface StreamProgress {
  percent: number;
  stage: string;
}

export interface StreamExitInfo {
  code: number;
  duration_ms: number;
}

export interface StreamingState {
  isStreaming: boolean;
  output: OutputLine[];
  progress: StreamProgress | null;
  exitInfo: StreamExitInfo | null;
  error: string | null;
}
