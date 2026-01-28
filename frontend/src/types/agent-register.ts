/**
 * TypeScript types for Agent Registration API.
 *
 * Secure Agent Architecture: Pull-based installation with per-agent tokens.
 */

export type AgentMode = 'readonly' | 'readwrite';

// --- Registration Token Types ---

export interface CreateRegistrationTokenRequest {
  mode?: AgentMode;
  display_name?: string;
  monitored_services?: string[];
  expiry_minutes?: number;
}

export interface CreateRegistrationTokenResponse {
  token: string;
  token_prefix: string;
  expires_at: string;
  install_command: string;
}

export interface RegistrationToken {
  id: number;
  token_prefix: string;
  mode: AgentMode;
  display_name: string | null;
  monitored_services: string[] | null;
  expires_at: string;
  created_at: string;
  is_expired: boolean;
  is_claimed: boolean;
}

export interface RegistrationTokenListResponse {
  tokens: RegistrationToken[];
  total: number;
}

// --- Agent Credential Types ---

export interface AgentCredential {
  server_guid: string;
  api_token_prefix: string;
  is_legacy: boolean;
  last_used_at: string | null;
  is_revoked: boolean;
  created_at: string;
}

export interface RotateTokenResponse {
  success: boolean;
  server_guid: string;
  api_token: string | null;
  api_token_prefix: string | null;
  error: string | null;
}

export interface RevokeTokenResponse {
  success: boolean;
  server_guid: string;
  error: string | null;
}
