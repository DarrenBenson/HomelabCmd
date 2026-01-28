import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AddServerModal } from './AddServerModal';
import { createRegistrationToken, listRegistrationTokens, cancelRegistrationToken } from '../api/agent-register';

vi.mock('../api/agent-register', () => ({
  createRegistrationToken: vi.fn(),
  listRegistrationTokens: vi.fn(),
  cancelRegistrationToken: vi.fn(),
}));

const baseResponse = {
  id: 1,
  token_prefix: 'abc123',
  expires_at: '2026-01-20T10:00:00Z',
  install_command: 'curl -sSL https://example/install | bash',
};

describe('AddServerModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderModal(overrides: Partial<Parameters<typeof AddServerModal>[0]> = {}) {
    return render(<AddServerModal onClose={vi.fn()} {...overrides} />);
  }

  it('renders token generation form', () => {
    renderModal();

    expect(screen.getByText('Add Server')).toBeInTheDocument();
    expect(screen.getByText('Generate Token')).toBeInTheDocument();
  });

  it('creates registration token', async () => {
    (createRegistrationToken as ReturnType<typeof vi.fn>).mockResolvedValue(baseResponse);
    const onTokenCreated = vi.fn();
    renderModal({ onTokenCreated });

    fireEvent.click(screen.getByTestId('generate-token-button'));

    await waitFor(() => {
      expect(createRegistrationToken).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('Registration token created')).toBeInTheDocument();
    });
    expect(onTokenCreated).toHaveBeenCalled();
  });

  it('shows pending tokens list', async () => {
    (listRegistrationTokens as ReturnType<typeof vi.fn>).mockResolvedValue({
      tokens: [
        {
          id: 2,
          token_prefix: 'def456',
          expires_at: '2026-01-20T11:00:00Z',
          created_at: '2026-01-20T10:00:00Z',
          mode: 'readonly',
        },
      ],
    });
    renderModal();

    fireEvent.click(screen.getByText('View pending tokens'));

    await waitFor(() => {
      expect(listRegistrationTokens).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('Pending Tokens')).toBeInTheDocument();
    });
  });

  it('cancels token from pending list', async () => {
    (listRegistrationTokens as ReturnType<typeof vi.fn>).mockResolvedValue({
      tokens: [
        {
          id: 3,
          token_prefix: 'ghi789',
          expires_at: '2026-01-20T11:00:00Z',
          created_at: '2026-01-20T10:00:00Z',
          mode: 'readonly',
        },
      ],
    });
    (cancelRegistrationToken as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    renderModal();

    fireEvent.click(screen.getByText('View pending tokens'));

    await waitFor(() => {
      expect(screen.getByText('Pending Tokens')).toBeInTheDocument();
    });

    const cancelButton = screen.getByTitle('Cancel token');
    await act(async () => {
      fireEvent.click(cancelButton);
    });

    await waitFor(() => {
      expect(cancelRegistrationToken).toHaveBeenCalledWith(3);
    });
  });
});
