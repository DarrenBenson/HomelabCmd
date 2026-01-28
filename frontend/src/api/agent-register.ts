/**
 * API functions for Agent Registration.
 *
 * Secure Agent Architecture: Pull-based installation with per-agent tokens.
 */

import { api } from './client';
import type {
  AgentCredential,
  CreateRegistrationTokenRequest,
  CreateRegistrationTokenResponse,
  RegistrationTokenListResponse,
  RevokeTokenResponse,
  RotateTokenResponse,
} from '../types/agent-register';

const BASE_PATH = '/api/v1/agents/register';

// --- Registration Token Functions ---

/**
 * Create a registration token for pull-based agent installation.
 * Returns a one-time token that can be used with the install script.
 */
export async function createRegistrationToken(
  request: CreateRegistrationTokenRequest
): Promise<CreateRegistrationTokenResponse> {
  return api.post<CreateRegistrationTokenResponse>(`${BASE_PATH}/tokens`, request);
}

/**
 * List all pending (unclaimed, unexpired) registration tokens.
 */
export async function listRegistrationTokens(): Promise<RegistrationTokenListResponse> {
  return api.get<RegistrationTokenListResponse>(`${BASE_PATH}/tokens`);
}

/**
 * Cancel a pending registration token.
 */
export async function cancelRegistrationToken(tokenId: number): Promise<void> {
  return api.delete(`${BASE_PATH}/tokens/${tokenId}`);
}

// --- Agent Credential Functions ---

/**
 * Get credential information for an agent.
 * Does not return the token itself, only metadata.
 */
export async function getAgentCredential(serverGuid: string): Promise<AgentCredential> {
  return api.get<AgentCredential>(`${BASE_PATH}/credentials/${serverGuid}`);
}

/**
 * Rotate an agent's API token.
 * The new plaintext token is returned once and cannot be retrieved again.
 */
export async function rotateAgentToken(serverGuid: string): Promise<RotateTokenResponse> {
  return api.post<RotateTokenResponse>(`${BASE_PATH}/credentials/${serverGuid}/rotate`, {});
}

/**
 * Revoke an agent's API token.
 * The agent will no longer be able to authenticate.
 */
export async function revokeAgentToken(serverGuid: string): Promise<RevokeTokenResponse> {
  return api.post<RevokeTokenResponse>(`${BASE_PATH}/credentials/${serverGuid}/revoke`, {});
}
