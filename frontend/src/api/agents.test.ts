import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAgentVersion,
  installAgent,
  upgradeAgent,
  removeAgent,
  activateServer,
} from './agents';
import { api } from './client';
import type {
  AgentInstallRequest,
  AgentInstallResponse,
  AgentUpgradeResponse,
  AgentRemoveResponse,
  AgentVersionResponse,
  ServerActivateResponse,
} from '../types/agent';

vi.mock('./client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

describe('Agents API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gets agent version', async () => {
    const response: AgentVersionResponse = {
      version: '1.2.3',
      build_date: '2026-01-20T10:00:00Z',
      commit_hash: 'abc123',
    };
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(response);

    const result = await getAgentVersion();

    expect(api.get).toHaveBeenCalledWith('/api/v1/agents/version');
    expect(result.version).toBe('1.2.3');
  });

  it('installs agent with request payload', async () => {
    const request: AgentInstallRequest = {
      hostname: '192.168.1.10',
      display_name: 'Media Server',
    };
    const response: AgentInstallResponse = {
      success: true,
      message: 'Installed',
      server_id: 'server-1',
      agent_version: '1.2.3',
    };
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue(response);

    const result = await installAgent(request);

    expect(api.post).toHaveBeenCalledWith('/api/v1/agents/install', request);
    expect(result.success).toBe(true);
  });

  it('upgrades agent with server id', async () => {
    const response: AgentUpgradeResponse = {
      success: true,
      message: 'Upgraded',
      agent_version: '1.2.4',
    };
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue(response);

    const result = await upgradeAgent('server-1');

    expect(api.post).toHaveBeenCalledWith('/api/v1/agents/server-1/upgrade', {});
    expect(result.agent_version).toBe('1.2.4');
  });

  it('removes agent with delete flag', async () => {
    const response: AgentRemoveResponse = {
      success: true,
      message: 'Removed',
    };
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue(response);

    const result = await removeAgent('server-1', { delete_completely: true });

    expect(api.post).toHaveBeenCalledWith('/api/v1/agents/server-1/remove', {
      delete_completely: true,
    });
    expect(result.success).toBe(true);
  });

  it('activates server', async () => {
    const response: ServerActivateResponse = {
      success: true,
      message: 'Activated',
    };
    (api.put as ReturnType<typeof vi.fn>).mockResolvedValue(response);

    const result = await activateServer('server-1');

    expect(api.put).toHaveBeenCalledWith('/api/v1/agents/server-1/activate', {});
    expect(result.message).toBe('Activated');
  });

  it('propagates errors from api', async () => {
    const error = new Error('Network error');
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(error);

    await expect(getAgentVersion()).rejects.toThrow('Network error');
  });
});
