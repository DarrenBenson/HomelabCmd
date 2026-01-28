/**
 * SSH settings API client functions.
 *
 * Part of EP0008: Tailscale Integration (US0079).
 */

import { api } from './client';
import type {
  SSHKeyDeleteResponse,
  SSHKeyStatusResponse,
  SSHKeyUploadResponse,
  SSHTestResponse,
  SSHUsernameResponse,
} from '../types/ssh';

// =============================================================================
// SSH Settings Endpoints (US0079)
// =============================================================================

/**
 * Get current SSH configuration status.
 *
 * Returns whether a key is configured, key type, fingerprint, and default username.
 */
export async function getSSHStatus(): Promise<SSHKeyStatusResponse> {
  return api.get<SSHKeyStatusResponse>('/api/v1/settings/ssh/status');
}

/**
 * Upload an SSH private key.
 *
 * The key is encrypted and stored in the database via CredentialService.
 * Supported formats: RSA, Ed25519, ECDSA (PEM format, not password-protected).
 *
 * AC2: SSH key encrypted storage.
 *
 * @param keyFile - The SSH private key file to upload
 */
export async function uploadSSHKey(keyFile: File): Promise<SSHKeyUploadResponse> {
  const API_BASE_URL = import.meta.env.VITE_API_URL || '';
  const API_KEY = import.meta.env.VITE_API_KEY || 'dev-key-change-me';

  const formData = new FormData();
  formData.append('key', keyFile);

  const response = await fetch(`${API_BASE_URL}/api/v1/settings/ssh/key`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    let message = `API error: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.detail?.message) {
        message = errorData.detail.message;
      } else if (typeof errorData.detail === 'string') {
        message = errorData.detail;
      }
    } catch {
      // Ignore JSON parse errors, use default message
    }
    throw new Error(message);
  }

  return response.json();
}

/**
 * Remove the stored SSH private key.
 *
 * Also clears any cached connections in the SSH executor pool.
 */
export async function removeSSHKey(): Promise<SSHKeyDeleteResponse> {
  const API_BASE_URL = import.meta.env.VITE_API_URL || '';
  const API_KEY = import.meta.env.VITE_API_KEY || 'dev-key-change-me';

  const response = await fetch(`${API_BASE_URL}/api/v1/settings/ssh/key`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
  });

  if (!response.ok) {
    let message = `API error: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.detail?.message) {
        message = errorData.detail.message;
      } else if (typeof errorData.detail === 'string') {
        message = errorData.detail;
      }
    } catch {
      // Ignore JSON parse errors, use default message
    }
    throw new Error(message);
  }

  return response.json();
}

/**
 * Update the default SSH username.
 *
 * @param username - The new default username for SSH connections
 */
export async function updateSSHUsername(
  username: string
): Promise<SSHUsernameResponse> {
  return api.put<SSHUsernameResponse>('/api/v1/settings/ssh/username', {
    username,
  });
}

// =============================================================================
// Test SSH Connection (AC5)
// =============================================================================

/**
 * Test SSH connection to a server via Tailscale hostname.
 *
 * AC5: Connection health check endpoint.
 *
 * @param serverId - The server ID to test connection to
 * @returns Test result with success status, latency, and host key info
 */
export async function testSSHConnection(serverId: string): Promise<SSHTestResponse> {
  return api.post<SSHTestResponse>(`/api/v1/servers/${serverId}/test-ssh`, {});
}
