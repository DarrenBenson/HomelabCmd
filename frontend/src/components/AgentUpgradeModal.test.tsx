import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AgentUpgradeModal } from './AgentUpgradeModal';
import { upgradeAgent } from '../api/agents';

vi.mock('../api/agents', () => ({
  upgradeAgent: vi.fn(),
}));

describe('AgentUpgradeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderModal(overrides: Partial<Parameters<typeof AgentUpgradeModal>[0]> = {}) {
    return render(
      <AgentUpgradeModal
        isOpen={true}
        serverId="server-1"
        serverName="Test Server"
        currentVersion="1.0.0"
        latestVersion="1.2.0"
        onClose={vi.fn()}
        {...overrides}
      />
    );
  }

  it('does not render when closed', () => {
    const { queryByTestId } = render(
      <AgentUpgradeModal
        isOpen={false}
        serverId="server-1"
        serverName="Test Server"
        currentVersion="1.0.0"
        latestVersion="1.2.0"
        onClose={vi.fn()}
      />
    );

    expect(queryByTestId('agent-upgrade-modal')).not.toBeInTheDocument();
  });

  it('renders upgrade details', () => {
    renderModal();

    expect(screen.getByText('Upgrade Agent')).toBeInTheDocument();
    expect(screen.getByText('Test Server')).toBeInTheDocument();
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
    expect(screen.getByText('1.2.0')).toBeInTheDocument();
  });

  it('calls upgrade API and shows success', async () => {
    (upgradeAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      message: 'Upgraded',
      agent_version: '1.2.0',
    });
    const onSuccess = vi.fn();
    renderModal({ onSuccess });

    fireEvent.click(screen.getByTestId('confirm-upgrade-button'));

    await waitFor(() => {
      expect(upgradeAgent).toHaveBeenCalledWith('server-1');
    });

    await waitFor(() => {
      expect(screen.getByText('Agent upgraded successfully')).toBeInTheDocument();
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it('shows error message on failed upgrade', async () => {
    (upgradeAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      message: 'Failed',
      error: 'Upgrade failed',
    });
    renderModal();

    fireEvent.click(screen.getByTestId('confirm-upgrade-button'));

    await waitFor(() => {
      expect(screen.getByText('Upgrade failed')).toBeInTheDocument();
    });
  });

  it('calls onClose when clicking backdrop', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.click(screen.getByTestId('agent-upgrade-modal'));

    expect(onClose).toHaveBeenCalled();
  });
});
