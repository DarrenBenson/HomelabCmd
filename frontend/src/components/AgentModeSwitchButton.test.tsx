/**
 * Tests for AgentModeSwitchButton component.
 *
 * US0188: Remote Agent Mode Switch
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AgentModeSwitchButton } from './AgentModeSwitchButton';
import { switchAgentMode } from '../api/agents';

vi.mock('../api/agents', () => ({
  switchAgentMode: vi.fn(),
}));

describe('AgentModeSwitchButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    serverId: 'server-1',
    currentMode: 'readonly' as const,
    sshConfigured: true,
    onSuccess: vi.fn(),
    onError: vi.fn(),
  };

  function renderButton(overrides: Partial<typeof defaultProps> = {}) {
    return render(<AgentModeSwitchButton {...defaultProps} {...overrides} />);
  }

  describe('when SSH is not configured', () => {
    it('shows disabled notice instead of button', () => {
      renderButton({ sshConfigured: false });

      expect(screen.getByTestId('mode-switch-disabled-notice')).toBeInTheDocument();
      expect(screen.getByText('SSH not configured')).toBeInTheDocument();
      expect(screen.queryByTestId('mode-switch-button')).not.toBeInTheDocument();
    });
  });

  describe('when SSH is configured', () => {
    it('shows upgrade button when in readonly mode', () => {
      renderButton({ currentMode: 'readonly' });

      const button = screen.getByTestId('mode-switch-button');
      expect(button).toBeInTheDocument();
      expect(screen.getByText('Enable Read/Write')).toBeInTheDocument();
    });

    it('shows downgrade button when in readwrite mode', () => {
      renderButton({ currentMode: 'readwrite' });

      const button = screen.getByTestId('mode-switch-button');
      expect(button).toBeInTheDocument();
      expect(screen.getByText('Switch to Read Only')).toBeInTheDocument();
    });

    it('shows password prompt when button is clicked', () => {
      renderButton();

      fireEvent.click(screen.getByTestId('mode-switch-button'));

      expect(screen.getByTestId('mode-switch-password-prompt')).toBeInTheDocument();
      expect(screen.getByTestId('mode-switch-password-input')).toBeInTheDocument();
      expect(screen.getByTestId('mode-switch-confirm')).toBeInTheDocument();
      expect(screen.getByTestId('mode-switch-cancel')).toBeInTheDocument();
    });

    it('cancels and resets state when cancel is clicked', () => {
      renderButton();

      // Open prompt
      fireEvent.click(screen.getByTestId('mode-switch-button'));
      expect(screen.getByTestId('mode-switch-password-prompt')).toBeInTheDocument();

      // Cancel
      fireEvent.click(screen.getByTestId('mode-switch-cancel'));

      // Should show button again
      expect(screen.getByTestId('mode-switch-button')).toBeInTheDocument();
      expect(screen.queryByTestId('mode-switch-password-prompt')).not.toBeInTheDocument();
    });

    it('calls API without password when password field is empty', async () => {
      (switchAgentMode as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        server_id: 'server-1',
        new_mode: 'readwrite',
        message: 'Mode switched successfully',
        error: null,
      });

      const onSuccess = vi.fn();
      renderButton({ onSuccess });

      // Open prompt and confirm without entering password
      fireEvent.click(screen.getByTestId('mode-switch-button'));
      fireEvent.click(screen.getByTestId('mode-switch-confirm'));

      await waitFor(() => {
        expect(switchAgentMode).toHaveBeenCalledWith('server-1', {
          mode: 'readwrite',
          sudo_password: undefined,
        });
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('calls API with password when password is provided', async () => {
      (switchAgentMode as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        server_id: 'server-1',
        new_mode: 'readwrite',
        message: 'Mode switched successfully',
        error: null,
      });

      const onSuccess = vi.fn();
      renderButton({ onSuccess });

      // Open prompt, enter password, and confirm
      fireEvent.click(screen.getByTestId('mode-switch-button'));
      fireEvent.change(screen.getByTestId('mode-switch-password-input'), {
        target: { value: 'mysudopassword' },
      });
      fireEvent.click(screen.getByTestId('mode-switch-confirm'));

      await waitFor(() => {
        expect(switchAgentMode).toHaveBeenCalledWith('server-1', {
          mode: 'readwrite',
          sudo_password: 'mysudopassword',
        });
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('calls onError when API returns failure', async () => {
      (switchAgentMode as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        server_id: 'server-1',
        new_mode: null,
        message: 'Failed',
        error: 'Permission denied',
      });

      const onError = vi.fn();
      renderButton({ onError });

      fireEvent.click(screen.getByTestId('mode-switch-button'));
      fireEvent.click(screen.getByTestId('mode-switch-confirm'));

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('Permission denied');
      });
    });

    it('calls onError when API throws exception', async () => {
      (switchAgentMode as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );

      const onError = vi.fn();
      renderButton({ onError });

      fireEvent.click(screen.getByTestId('mode-switch-button'));
      fireEvent.click(screen.getByTestId('mode-switch-confirm'));

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('Network error');
      });
    });

    it('switches to readonly when current mode is readwrite', async () => {
      (switchAgentMode as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        server_id: 'server-1',
        new_mode: 'readonly',
        message: 'Mode switched successfully',
        error: null,
      });

      renderButton({ currentMode: 'readwrite' });

      fireEvent.click(screen.getByTestId('mode-switch-button'));
      fireEvent.click(screen.getByTestId('mode-switch-confirm'));

      await waitFor(() => {
        expect(switchAgentMode).toHaveBeenCalledWith('server-1', {
          mode: 'readonly',
          sudo_password: undefined,
        });
      });
    });

    it('clears password field after switch completes', async () => {
      (switchAgentMode as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        server_id: 'server-1',
        new_mode: 'readwrite',
        message: 'Mode switched successfully',
        error: null,
      });

      renderButton();

      // Enter password and submit
      fireEvent.click(screen.getByTestId('mode-switch-button'));
      fireEvent.change(screen.getByTestId('mode-switch-password-input'), {
        target: { value: 'mysudopassword' },
      });
      fireEvent.click(screen.getByTestId('mode-switch-confirm'));

      // Wait for completion
      await waitFor(() => {
        expect(switchAgentMode).toHaveBeenCalled();
      });

      // Password should be cleared (button reappears)
      await waitFor(() => {
        expect(screen.getByTestId('mode-switch-button')).toBeInTheDocument();
      });
    });
  });
});
