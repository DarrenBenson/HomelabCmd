import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AgentRemoveModal } from './AgentRemoveModal';
import { removeAgent } from '../api/agents';

vi.mock('../api/agents', () => ({
  removeAgent: vi.fn(),
}));

describe('AgentRemoveModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderModal(overrides: Partial<Parameters<typeof AgentRemoveModal>[0]> = {}) {
    return render(
      <AgentRemoveModal
        isOpen={true}
        serverId="server-1"
        serverName="Test Server"
        onClose={vi.fn()}
        {...overrides}
      />
    );
  }

  it('renders confirmation content', () => {
    renderModal();

    expect(screen.getAllByText('Remove Agent')).not.toHaveLength(0);
    expect(screen.getByText('Test Server')).toBeInTheDocument();
  });

  it('removes agent without delete flag', async () => {
    (removeAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      message: 'Removed',
    });
    const onSuccess = vi.fn();
    renderModal({ onSuccess });

    fireEvent.click(screen.getByTestId('confirm-remove-button'));

    await waitFor(() => {
      expect(removeAgent).toHaveBeenCalledWith('server-1', { delete_completely: false });
    });

    await waitFor(() => {
      expect(screen.getByText('Agent removed')).toBeInTheDocument();
    });
    expect(onSuccess).toHaveBeenCalledWith(
      { success: true, message: 'Removed' },
      false
    );
  });

  it('removes agent with delete flag', async () => {
    (removeAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      message: 'Deleted',
    });
    renderModal();

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByTestId('confirm-remove-button'));

    await waitFor(() => {
      expect(removeAgent).toHaveBeenCalledWith('server-1', { delete_completely: true });
    });
  });

  it('shows error on failure', async () => {
    (removeAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      message: 'Failed',
      error: 'Removal failed',
    });
    renderModal();

    fireEvent.click(screen.getByTestId('confirm-remove-button'));

    await waitFor(() => {
      expect(screen.getByText('Removal failed')).toBeInTheDocument();
    });
  });

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.click(screen.getByTestId('agent-remove-modal'));

    expect(onClose).toHaveBeenCalled();
  });
});
