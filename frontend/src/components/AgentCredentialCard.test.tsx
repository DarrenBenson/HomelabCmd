import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AgentCredentialCard } from './AgentCredentialCard';
import { getAgentCredential, rotateAgentToken, revokeAgentToken } from '../api/agent-register';

vi.mock('../api/agent-register', () => ({
  getAgentCredential: vi.fn(),
  rotateAgentToken: vi.fn(),
  revokeAgentToken: vi.fn(),
}));

vi.mock('../lib/formatters', () => ({
  formatRelativeTime: vi.fn(() => '2 hours ago'),
}));

describe('AgentCredentialCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders legacy message when serverGuid is null', () => {
    render(<AgentCredentialCard serverGuid={null} />);

    expect(screen.getByText('Legacy Authentication')).toBeInTheDocument();
  });

  it('renders shared API key message when no credential found', async () => {
    (getAgentCredential as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('404 Not Found'));
    render(<AgentCredentialCard serverGuid="guid-1" />);

    await waitFor(() => {
      expect(screen.getByText('Shared API Key')).toBeInTheDocument();
    });
  });

  it('shows credential details and actions', async () => {
    (getAgentCredential as ReturnType<typeof vi.fn>).mockResolvedValue({
      server_guid: 'guid-1',
      api_token_prefix: 'tok123',
      created_at: '2026-01-20T10:00:00Z',
      last_used_at: '2026-01-20T12:00:00Z',
      is_legacy: false,
      is_revoked: false,
    });
    render(<AgentCredentialCard serverGuid="guid-1" />);

    await waitFor(() => {
      expect(screen.getByText('Per-Agent Token')).toBeInTheDocument();
    });
    expect(screen.getAllByText('tok123...')).not.toHaveLength(0);
    expect(screen.getByText('Rotate Token')).toBeInTheDocument();
  });

  it('rotates token and displays new token', async () => {
    (getAgentCredential as ReturnType<typeof vi.fn>).mockResolvedValue({
      server_guid: 'guid-1',
      api_token_prefix: 'tok123',
      created_at: '2026-01-20T10:00:00Z',
      last_used_at: null,
      is_legacy: false,
      is_revoked: false,
    });
    (rotateAgentToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      message: 'Rotated',
      api_token: 'new-token',
    });
    render(<AgentCredentialCard serverGuid="guid-1" />);

    await waitFor(() => {
      expect(screen.getByText('Rotate Token')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Rotate Token'));

    await waitFor(() => {
      expect(screen.getByText('Token rotated successfully. Copy the new token:')).toBeInTheDocument();
    });
    expect(rotateAgentToken).toHaveBeenCalledWith('guid-1');
  });

  it('revokes token on confirm', async () => {
    (getAgentCredential as ReturnType<typeof vi.fn>).mockResolvedValue({
      server_guid: 'guid-1',
      api_token_prefix: 'tok123',
      created_at: '2026-01-20T10:00:00Z',
      last_used_at: null,
      is_legacy: false,
      is_revoked: false,
    });
    (revokeAgentToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      message: 'Revoked',
    });
    const onRevoked = vi.fn();
    render(<AgentCredentialCard serverGuid="guid-1" onRevoked={onRevoked} />);

    await waitFor(() => {
      expect(screen.getByText('Revoke Token')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Revoke Token'));
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(revokeAgentToken).toHaveBeenCalledWith('guid-1');
    });
    expect(onRevoked).toHaveBeenCalled();
  });
});
