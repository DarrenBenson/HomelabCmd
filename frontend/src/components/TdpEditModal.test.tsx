import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TdpEditModal } from './TdpEditModal';

/**
 * TdpEditModal component tests for US0033/US0036.
 */

describe('TdpEditModal', () => {
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderModal(props: Partial<Parameters<typeof TdpEditModal>[0]> = {}) {
    return render(
      <TdpEditModal
        serverName="test-server"
        currentTdp={null}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        {...props}
      />
    );
  }

  describe('Rendering', () => {
    it('renders modal with server name', () => {
      renderModal();

      expect(screen.getByText('Set TDP for test-server')).toBeInTheDocument();
    });

    it('displays TDP input field', () => {
      renderModal();

      expect(screen.getByTestId('tdp-modal-input')).toBeInTheDocument();
    });

    it('displays preset buttons', () => {
      renderModal();

      expect(screen.getByTestId('tdp-modal-preset-5')).toBeInTheDocument();
      expect(screen.getByTestId('tdp-modal-preset-15')).toBeInTheDocument();
      expect(screen.getByTestId('tdp-modal-preset-25')).toBeInTheDocument();
      expect(screen.getByTestId('tdp-modal-preset-65')).toBeInTheDocument();
    });

    it('displays Save and Cancel buttons', () => {
      renderModal();

      expect(screen.getByTestId('tdp-modal-save')).toBeInTheDocument();
      expect(screen.getByTestId('tdp-modal-cancel')).toBeInTheDocument();
    });
  });

  describe('Initial value', () => {
    it('starts with empty input when currentTdp is null', () => {
      renderModal({ currentTdp: null });

      const input = screen.getByTestId('tdp-modal-input') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('starts with current value when currentTdp is set', () => {
      renderModal({ currentTdp: 65 });

      const input = screen.getByTestId('tdp-modal-input') as HTMLInputElement;
      expect(input.value).toBe('65');
    });
  });

  describe('Input handling', () => {
    it('updates input value on change', () => {
      renderModal();

      const input = screen.getByTestId('tdp-modal-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '125' } });

      expect(input.value).toBe('125');
    });

    it('sets value from preset button', () => {
      renderModal();

      fireEvent.click(screen.getByTestId('tdp-modal-preset-65'));

      const input = screen.getByTestId('tdp-modal-input') as HTMLInputElement;
      expect(input.value).toBe('65');
    });
  });

  describe('Save action', () => {
    it('calls onSave with integer value', async () => {
      mockOnSave.mockResolvedValue(undefined);
      renderModal();

      const input = screen.getByTestId('tdp-modal-input');
      fireEvent.change(input, { target: { value: '75' } });
      fireEvent.click(screen.getByTestId('tdp-modal-save'));

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(75);
      });
    });

    it('calls onSave with null for empty input', async () => {
      mockOnSave.mockResolvedValue(undefined);
      renderModal();

      fireEvent.click(screen.getByTestId('tdp-modal-save'));

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(null);
      });
    });

    it('shows saving state', async () => {
      mockOnSave.mockImplementation(() => new Promise(() => {}));
      renderModal();

      const input = screen.getByTestId('tdp-modal-input');
      fireEvent.change(input, { target: { value: '65' } });
      fireEvent.click(screen.getByTestId('tdp-modal-save'));

      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument();
      });
    });

    it('disables inputs during save', async () => {
      mockOnSave.mockImplementation(() => new Promise(() => {}));
      renderModal();

      fireEvent.click(screen.getByTestId('tdp-modal-save'));

      await waitFor(() => {
        expect(screen.getByTestId('tdp-modal-input')).toBeDisabled();
      });
    });
  });

  describe('Cancel action', () => {
    it('calls onCancel when Cancel button clicked', () => {
      renderModal();

      fireEvent.click(screen.getByTestId('tdp-modal-cancel'));

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('calls onCancel when backdrop clicked', () => {
      renderModal();

      fireEvent.click(screen.getByTestId('tdp-modal-backdrop'));

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('calls onCancel on Escape key press', () => {
      renderModal();

      fireEvent.keyDown(screen.getByTestId('tdp-modal-input'), { key: 'Escape' });

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('does not close when clicking modal content', () => {
      renderModal();

      fireEvent.click(screen.getByTestId('tdp-modal'));

      expect(mockOnCancel).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard shortcuts', () => {
    it('saves on Enter key press', async () => {
      mockOnSave.mockResolvedValue(undefined);
      renderModal();

      const input = screen.getByTestId('tdp-modal-input');
      fireEvent.change(input, { target: { value: '65' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(65);
      });
    });
  });

  describe('Preset buttons', () => {
    it('sets Raspberry Pi preset (5W)', () => {
      renderModal();

      fireEvent.click(screen.getByTestId('tdp-modal-preset-5'));

      const input = screen.getByTestId('tdp-modal-input') as HTMLInputElement;
      expect(input.value).toBe('5');
    });

    it('sets Mini PC preset (15W)', () => {
      renderModal();

      fireEvent.click(screen.getByTestId('tdp-modal-preset-15'));

      const input = screen.getByTestId('tdp-modal-input') as HTMLInputElement;
      expect(input.value).toBe('15');
    });

    it('sets NAS preset (25W)', () => {
      renderModal();

      fireEvent.click(screen.getByTestId('tdp-modal-preset-25'));

      const input = screen.getByTestId('tdp-modal-input') as HTMLInputElement;
      expect(input.value).toBe('25');
    });

    it('sets Desktop preset (65W)', () => {
      renderModal();

      fireEvent.click(screen.getByTestId('tdp-modal-preset-65'));

      const input = screen.getByTestId('tdp-modal-input') as HTMLInputElement;
      expect(input.value).toBe('65');
    });
  });
});
