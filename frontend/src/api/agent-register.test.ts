import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createRegistrationToken,
  listRegistrationTokens,
  cancelRegistrationToken,
  getAgentCredential,
  rotateAgentToken,
  revokeAgentToken,
} from './agent-register';
import { api } from './client';
import type {
  AgentCredential,
  CreateRegistrationTokenRequest,
  CreateRegistrationTokenResponse,
  RegistrationTokenListResponse,
  RotateTokenResponse,
  RevokeTokenResponse,
} from '../types/agent-register';

vi.mock('./client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Agent registration API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates registration token', async () => {
    const request: CreateRegistrationTokenRequest = {
      mode: 'readonly',
      expiry_minutes: 15,
    };
    const response: CreateRegistrationTokenResponse = {
      id: 1,
      token_prefix: 'abc123',
      expires_at: '2026-01-20T10:00:00Z',
      install_command: 'curl -sSL https://example/install | bash',
    };
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue(response);

    const result = await createRegistrationToken(request);

    expect(api.post).toHaveBeenCalledWith('/api/v1/agents/register/tokens', request);
    expect(result.id).toBe(1);
  });

  it('lists registration tokens', async () => {
    const response: RegistrationTokenListResponse = {
      tokens: [
        {
          id: 2,
          token_prefix: 'def456',
          expires_at: '2026-01-20T11:00:00Z',
          created_at: '2026-01-20T10:00:00Z',
          mode: 'readwrite',
        },
      ],
    };
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(response);

    const result = await listRegistrationTokens();

    expect(api.get).toHaveBeenCalledWith('/api/v1/agents/register/tokens');
    expect(result.tokens).toHaveLength(1);
  });

  it('cancels registration token', async () => {
    (api.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await cancelRegistrationToken(10);

    expect(api.delete).toHaveBeenCalledWith('/api/v1/agents/register/tokens/10');
  });

  it('gets agent credential', async () => {
    const credential: AgentCredential = {
      server_guid: 'server-guid',
      api_token_prefix: 'tok123',
      created_at: '2026-01-20T10:00:00Z',
      last_used_at: null,
      is_legacy: false,
      is_revoked: false,
    };
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(credential);

    const result = await getAgentCredential('server-guid');

    expect(api.get).toHaveBeenCalledWith('/api/v1/agents/register/credentials/server-guid');
    expect(result.api_token_prefix).toBe('tok123');
  });

  it('rotates agent token', async () => {
    const response: RotateTokenResponse = {
      success: true,
      message: 'Rotated',
      api_token: 'new-token',
    };
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue(response);

    const result = await rotateAgentToken('server-guid');

    expect(api.post).toHaveBeenCalledWith(
      '/api/v1/agents/register/credentials/server-guid/rotate',
      {}
    );
    expect(result.api_token).toBe('new-token');
  });

  it('revokes agent token', async () => {
    const response: RevokeTokenResponse = {
      success: true,
      message: 'Revoked',
    };
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue(response);

    const result = await revokeAgentToken('server-guid');

    expect(api.post).toHaveBeenCalledWith(
      '/api/v1/agents/register/credentials/server-guid/revoke',
      {}
    );
    expect(result.success).toBe(true);
  });

  it('propagates api errors', async () => {
    const error = new Error('Network error');
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(error);

    await expect(listRegistrationTokens()).rejects.toThrow('Network error');
  });
});
