/**
 * SSH API types.
 *
 * US0093: Unified SSH Key Management - cleaned up deprecated types.
 * Key management types now in types/scan.ts (SSHKeyMetadata, etc.).
 */

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
