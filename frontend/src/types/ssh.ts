/**
 * SSH settings API types.
 *
 * Part of EP0008: Tailscale Integration (US0079).
 *
 * These types match the backend Pydantic schemas in:
 * backend/src/homelab_cmd/api/schemas/ssh.py
 */

/**
 * Response after uploading SSH private key.
 *
 * AC2: SSH key encrypted storage.
 */
export interface SSHKeyUploadResponse {
  success: boolean;
  message: string;
  /** SSH key type (e.g., ssh-ed25519, RSA-4096) */
  key_type: string;
  /** SHA256 fingerprint of the key */
  fingerprint: string;
}

/**
 * Response for SSH configuration status.
 *
 * GET /api/v1/settings/ssh/status
 */
export interface SSHKeyStatusResponse {
  /** Whether an SSH key is configured */
  configured: boolean;
  /** SSH key type if configured */
  key_type: string | null;
  /** SHA256 fingerprint if configured */
  fingerprint: string | null;
  /** When the key was uploaded (ISO string) */
  uploaded_at: string | null;
  /** Default SSH username */
  username: string;
}

/**
 * Request to update default SSH username.
 */
export interface SSHUsernameRequest {
  /** Default SSH username (1-100 chars) */
  username: string;
}

/**
 * Response after updating SSH username.
 */
export interface SSHUsernameResponse {
  success: boolean;
  message: string;
}

/**
 * Response after deleting SSH key.
 */
export interface SSHKeyDeleteResponse {
  success: boolean;
  message: string;
}

/**
 * Response from test-ssh endpoint.
 *
 * AC5: Connection health check endpoint.
 */
export interface SSHTestResponse {
  success: boolean;
  hostname: string;
  /** Connection latency in milliseconds */
  latency_ms: number | null;
  /** SHA256 fingerprint of host key */
  host_key_fingerprint: string | null;
  /** Error message if connection failed */
  error: string | null;
  /** Number of connection attempts made */
  attempts: number;
}

/**
 * Request to accept a changed host key.
 */
export interface SSHHostKeyAcceptRequest {
  /** Whether to accept the new host key */
  accept: boolean;
}

/**
 * Response after accepting/rejecting a changed host key.
 */
export interface SSHHostKeyAcceptResponse {
  success: boolean;
  message: string;
}
