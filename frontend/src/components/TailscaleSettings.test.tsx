/**
 * Tests for TailscaleSettings component.
 *
 * Part of EP0008: Tailscale Integration (US0076).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TailscaleSettings } from './TailscaleSettings';
import {
  getTailscaleStatus,
  saveTailscaleToken,
  removeTailscaleToken,
  testTailscaleConnection,
} from '../api/tailscale';
import type { TailscaleStatusResponse, TailscaleTestResponse } from '../types/tailscale';

vi.mock('../api/tailscale', () => ({
  getTailscaleStatus: vi.fn(),
  saveTailscaleToken: vi.fn(),
  removeTailscaleToken: vi.fn(),
  testTailscaleConnection: vi.fn(),
}));

const mockStatusConfigured: TailscaleStatusResponse = {
  configured: true,
  masked_token: 'tskey-ap...',
};

const mockStatusUnconfigured: TailscaleStatusResponse = {
  configured: false,
  masked_token: null,
};

const mockTestSuccess: TailscaleTestResponse = {
  success: true,
  tailnet: 'example.ts.net',
  device_count: 5,
};

const mockTestFailure: TailscaleTestResponse = {
  success: false,
  error: 'Invalid API token',
  code: 'TAILSCALE_AUTH_ERROR',
};

describe('TailscaleSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('shows loading spinner while fetching status', async () => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {})
      );

      const { container } = render(<TailscaleSettings />);
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Unconfigured State', () => {
    it('shows unconfigured message when no token', async () => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusUnconfigured);

      render(<TailscaleSettings />);

      await waitFor(() => {
        expect(screen.getByText('No API token configured')).toBeInTheDocument();
      });
    });

    it('shows guidance when unconfigured', async () => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusUnconfigured);

      render(<TailscaleSettings />);

      await waitFor(() => {
        expect(screen.getByText(/Configure a Tailscale API token/)).toBeInTheDocument();
      });
    });

    it('does not show test or remove buttons when unconfigured', async () => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusUnconfigured);

      render(<TailscaleSettings />);

      await waitFor(() => {
        expect(screen.getByTestId('token-input')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('test-connection-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('remove-token-button')).not.toBeInTheDocument();
    });
  });

  describe('Configured State', () => {
    it('shows masked token when configured', async () => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusConfigured);

      render(<TailscaleSettings />);

      await waitFor(() => {
        expect(screen.getByText('Token configured: tskey-ap...')).toBeInTheDocument();
      });
    });

    it('shows test connection button', async () => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusConfigured);

      render(<TailscaleSettings />);

      await waitFor(() => {
        expect(screen.getByTestId('test-connection-button')).toBeInTheDocument();
      });
    });

    it('shows remove token button', async () => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusConfigured);

      render(<TailscaleSettings />);

      await waitFor(() => {
        expect(screen.getByTestId('remove-token-button')).toBeInTheDocument();
      });
    });
  });

  describe('Token Input', () => {
    it('shows token input field', async () => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusUnconfigured);

      render(<TailscaleSettings />);

      await waitFor(() => {
        expect(screen.getByTestId('token-input')).toBeInTheDocument();
      });
    });

    it('shows correct placeholder when unconfigured', async () => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusUnconfigured);

      render(<TailscaleSettings />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('tskey-api-...')).toBeInTheDocument();
      });
    });

    it('shows correct placeholder when configured', async () => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusConfigured);

      render(<TailscaleSettings />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter new token to replace')).toBeInTheDocument();
      });
    });

    it('disables save button when input is empty', async () => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusUnconfigured);

      render(<TailscaleSettings />);

      await waitFor(() => {
        expect(screen.getByTestId('save-token-button')).toBeDisabled();
      });
    });

    it('enables save button when input has value', async () => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusUnconfigured);

      render(<TailscaleSettings />);

      await waitFor(() => {
        expect(screen.getByTestId('token-input')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('token-input'), {
        target: { value: 'tskey-api-test123' },
      });

      expect(screen.getByTestId('save-token-button')).not.toBeDisabled();
    });

    it('saves token successfully', async () => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockStatusUnconfigured)
        .mockResolvedValueOnce(mockStatusConfigured);
      (saveTailscaleToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        message: 'Token saved',
      });

      render(<TailscaleSettings />);

      await waitFor(() => {
        expect(screen.getByTestId('token-input')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('token-input'), {
        target: { value: 'tskey-api-newtoken123' },
      });

      fireEvent.click(screen.getByTestId('save-token-button'));

      await waitFor(() => {
        expect(saveTailscaleToken).toHaveBeenCalledWith('tskey-api-newtoken123');
      });

      await waitFor(() => {
        expect(screen.getByTestId('success-message')).toBeInTheDocument();
      });
      expect(screen.getByText('Tailscale token saved')).toBeInTheDocument();
    });

    it('shows error when save fails', async () => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusUnconfigured);
      (saveTailscaleToken as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Invalid token format')
      );

      render(<TailscaleSettings />);

      await waitFor(() => {
        expect(screen.getByTestId('token-input')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('token-input'), {
        target: { value: 'invalid' },
      });

      fireEvent.click(screen.getByTestId('save-token-button'));

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });
      expect(screen.getByText('Invalid token format')).toBeInTheDocument();
    });
  });

  describe('Test Connection', () => {
    it('tests connection successfully', async () => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusConfigured);
      (testTailscaleConnection as ReturnType<typeof vi.fn>).mockResolvedValue(mockTestSuccess);

      render(<TailscaleSettings />);

      await waitFor(() => {
        expect(screen.getByTestId('test-connection-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('test-connection-button'));

      await waitFor(() => {
        expect(screen.getByTestId('test-result')).toBeInTheDocument();
      });
      expect(screen.getByText(/Connected to tailnet: example.ts.net/)).toBeInTheDocument();
      expect(screen.getByText('5 devices discovered')).toBeInTheDocument();
    });

    it('shows error when connection fails', async () => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusConfigured);
      (testTailscaleConnection as ReturnType<typeof vi.fn>).mockResolvedValue(mockTestFailure);

      render(<TailscaleSettings />);

      await waitFor(() => {
        expect(screen.getByTestId('test-connection-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('test-connection-button'));

      await waitFor(() => {
        expect(screen.getByTestId('test-result')).toBeInTheDocument();
      });
      expect(screen.getByText('Invalid API token')).toBeInTheDocument();
    });

    it('handles test connection exception', async () => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusConfigured);
      (testTailscaleConnection as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );

      render(<TailscaleSettings />);

      await waitFor(() => {
        expect(screen.getByTestId('test-connection-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('test-connection-button'));

      await waitFor(() => {
        expect(screen.getByTestId('test-result')).toBeInTheDocument();
      });
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  describe('Remove Token', () => {
    it('opens remove confirmation modal', async () => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusConfigured);

      render(<TailscaleSettings />);

      await waitFor(() => {
        expect(screen.getByTestId('remove-token-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('remove-token-button'));

      expect(screen.getByText('Remove Tailscale Token')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to remove the Tailscale API token/)).toBeInTheDocument();
    });

    it('closes modal when clicking Cancel', async () => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusConfigured);

      render(<TailscaleSettings />);

      await waitFor(() => {
        expect(screen.getByTestId('remove-token-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('remove-token-button'));
      expect(screen.getByText('Remove Tailscale Token')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByText('Remove Tailscale Token')).not.toBeInTheDocument();
      });
    });

    it('removes token successfully', async () => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockStatusConfigured)
        .mockResolvedValueOnce(mockStatusUnconfigured);
      (removeTailscaleToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        message: 'Token removed',
      });

      render(<TailscaleSettings />);

      await waitFor(() => {
        expect(screen.getByTestId('remove-token-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('remove-token-button'));
      fireEvent.click(screen.getByTestId('confirm-remove-token-button'));

      await waitFor(() => {
        expect(removeTailscaleToken).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByTestId('success-message')).toBeInTheDocument();
      });
      expect(screen.getByText('Tailscale token removed')).toBeInTheDocument();
    });

    it('shows error when removal fails', async () => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusConfigured);
      (removeTailscaleToken as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Permission denied')
      );

      render(<TailscaleSettings />);

      await waitFor(() => {
        expect(screen.getByTestId('remove-token-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('remove-token-button'));
      fireEvent.click(screen.getByTestId('confirm-remove-token-button'));

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });
      expect(screen.getByText('Permission denied')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('shows error when status fetch fails', async () => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );

      render(<TailscaleSettings />);

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('handles non-Error exceptions gracefully', async () => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockRejectedValue('string error');

      render(<TailscaleSettings />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load Tailscale status')).toBeInTheDocument();
      });
    });
  });
});
