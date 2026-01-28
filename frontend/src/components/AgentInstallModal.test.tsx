import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AgentInstallModal } from './AgentInstallModal';
import { installAgent } from '../api/agents';
import { discoverServices } from '../api/discovery';

vi.mock('../api/agents', () => ({
  installAgent: vi.fn(),
}));

vi.mock('../api/discovery', () => ({
  discoverServices: vi.fn(),
}));

describe('AgentInstallModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderModal(overrides: Partial<Parameters<typeof AgentInstallModal>[0]> = {}) {
    return render(
      <AgentInstallModal
        isOpen={true}
        ipAddress="192.168.1.10"
        hostname="media-server"
        onClose={vi.fn()}
        {...overrides}
      />
    );
  }

  it('renders header and target host', () => {
    renderModal();

    expect(screen.getAllByText('Install Agent')).not.toHaveLength(0);
    expect(screen.getByText('192.168.1.10 (media-server)')).toBeInTheDocument();
  });

  it('discovers services when button clicked', async () => {
    (discoverServices as ReturnType<typeof vi.fn>).mockResolvedValue({
      services: [{ name: 'nginx', description: 'Web server' }],
    });
    renderModal();

    fireEvent.click(screen.getByTestId('discover-services-button'));

    await waitFor(() => {
      expect(discoverServices).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('nginx')).toBeInTheDocument();
    });
  });

  it('installs agent successfully', async () => {
    (installAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      message: 'Installed',
      server_id: 'server-1',
      agent_version: '1.2.0',
    });
    const onSuccess = vi.fn();
    renderModal({ onSuccess });

    fireEvent.click(screen.getByTestId('install-button'));

    await waitFor(() => {
      expect(installAgent).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('Agent installed successfully')).toBeInTheDocument();
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it('shows error on install failure', async () => {
    (installAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      message: 'Failed',
      error: 'Installation failed',
    });
    renderModal();

    fireEvent.click(screen.getByTestId('install-button'));

    await waitFor(() => {
      expect(screen.getByText('Installation failed')).toBeInTheDocument();
    });
  });

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.click(screen.getByTestId('agent-install-modal'));

    expect(onClose).toHaveBeenCalled();
  });
});
