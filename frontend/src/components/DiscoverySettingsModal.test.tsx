import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { DiscoverySettingsModal } from './DiscoverySettingsModal';
import { getDiscoverySettings, updateDiscoverySettings } from '../api/discovery';
import { getSSHConfig, updateSSHConfig } from '../api/scans';

vi.mock('../api/discovery', () => ({
  getDiscoverySettings: vi.fn(),
  updateDiscoverySettings: vi.fn(),
}));

vi.mock('../api/scans', () => ({
  getSSHConfig: vi.fn(),
  updateSSHConfig: vi.fn(),
}));

const mockDiscoverySettings = {
  default_subnet: '192.168.1.0/24',
  timeout_ms: 500,
};

const mockSSHConfig = {
  default_username: 'admin',
  ssh_key_path: '/home/user/.ssh/id_rsa',
  ssh_port: 22,
};

describe('DiscoverySettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getDiscoverySettings as Mock).mockResolvedValue(mockDiscoverySettings);
    (getSSHConfig as Mock).mockResolvedValue(mockSSHConfig);
  });

  describe('rendering', () => {
    it('does not render when isOpen is false', () => {
      render(<DiscoverySettingsModal isOpen={false} onClose={() => {}} />);

      expect(screen.queryByTestId('discovery-settings-modal')).not.toBeInTheDocument();
    });

    it('renders modal when isOpen is true', async () => {
      render(<DiscoverySettingsModal isOpen={true} onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByTestId('discovery-settings-modal')).toBeInTheDocument();
      });
    });

    it('shows loading spinner initially', () => {
      // Use a never-resolving promise to keep loading state
      (getDiscoverySettings as Mock).mockReturnValue(new Promise(() => {}));

      render(<DiscoverySettingsModal isOpen={true} onClose={() => {}} />);

      expect(screen.getByTestId('discovery-settings-modal')).toBeInTheDocument();
      // Loading spinner is shown before form
    });

    it('shows form after loading', async () => {
      render(<DiscoverySettingsModal isOpen={true} onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByTestId('subnet-input')).toBeInTheDocument();
      });

      expect(screen.getByTestId('username-input')).toBeInTheDocument();
      expect(screen.getByTestId('timeout-input')).toBeInTheDocument();
    });
  });

  describe('loading settings', () => {
    it('loads discovery settings when modal opens', async () => {
      render(<DiscoverySettingsModal isOpen={true} onClose={() => {}} />);

      await waitFor(() => {
        expect(getDiscoverySettings).toHaveBeenCalled();
      });
    });

    it('loads SSH config when modal opens', async () => {
      render(<DiscoverySettingsModal isOpen={true} onClose={() => {}} />);

      await waitFor(() => {
        expect(getSSHConfig).toHaveBeenCalled();
      });
    });

    it('populates form with loaded values', async () => {
      render(<DiscoverySettingsModal isOpen={true} onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByTestId('subnet-input')).toHaveValue('192.168.1.0/24');
      });

      expect(screen.getByTestId('username-input')).toHaveValue('admin');
      expect(screen.getByTestId('timeout-input')).toHaveValue(500);
    });

    it('shows error message on load failure', async () => {
      (getDiscoverySettings as Mock).mockRejectedValue(new Error('Network error'));

      render(<DiscoverySettingsModal isOpen={true} onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('form input', () => {
    it('updates subnet value on input', async () => {
      render(<DiscoverySettingsModal isOpen={true} onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByTestId('subnet-input')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('subnet-input'), {
        target: { value: '10.0.0.0/24' },
      });

      expect(screen.getByTestId('subnet-input')).toHaveValue('10.0.0.0/24');
    });

    it('updates username value on input', async () => {
      render(<DiscoverySettingsModal isOpen={true} onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByTestId('username-input')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('username-input'), {
        target: { value: 'newuser' },
      });

      expect(screen.getByTestId('username-input')).toHaveValue('newuser');
    });

    it('updates timeout value on input', async () => {
      render(<DiscoverySettingsModal isOpen={true} onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByTestId('timeout-input')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('timeout-input'), {
        target: { value: '1000' },
      });

      expect(screen.getByTestId('timeout-input')).toHaveValue(1000);
    });
  });

  describe('saving settings', () => {
    it('calls updateDiscoverySettings when subnet is changed', async () => {
      (updateDiscoverySettings as Mock).mockResolvedValue(undefined);

      render(<DiscoverySettingsModal isOpen={true} onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByTestId('subnet-input')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('subnet-input'), {
        target: { value: '10.0.0.0/24' },
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('save-settings-button'));
      });

      await waitFor(() => {
        expect(updateDiscoverySettings).toHaveBeenCalledWith({
          default_subnet: '10.0.0.0/24',
          timeout_ms: 500,
        });
      });
    });

    it('calls updateSSHConfig when username is changed', async () => {
      (updateSSHConfig as Mock).mockResolvedValue(undefined);

      render(<DiscoverySettingsModal isOpen={true} onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByTestId('username-input')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('username-input'), {
        target: { value: 'newuser' },
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('save-settings-button'));
      });

      await waitFor(() => {
        expect(updateSSHConfig).toHaveBeenCalledWith({
          default_username: 'newuser',
        });
      });
    });

    it('shows success message after save', async () => {
      (updateDiscoverySettings as Mock).mockResolvedValue(undefined);

      render(<DiscoverySettingsModal isOpen={true} onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByTestId('subnet-input')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('subnet-input'), {
        target: { value: '10.0.0.0/24' },
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('save-settings-button'));
      });

      await waitFor(() => {
        expect(screen.getByText('Settings saved successfully')).toBeInTheDocument();
      });
    });

    it('shows "No changes to save" when nothing changed', async () => {
      render(<DiscoverySettingsModal isOpen={true} onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByTestId('save-settings-button')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('save-settings-button'));
      });

      await waitFor(() => {
        expect(screen.getByText('No changes to save')).toBeInTheDocument();
      });
    });

    it('calls onSave callback on successful save', async () => {
      (updateDiscoverySettings as Mock).mockResolvedValue(undefined);
      const onSave = vi.fn();

      render(<DiscoverySettingsModal isOpen={true} onClose={() => {}} onSave={onSave} />);

      await waitFor(() => {
        expect(screen.getByTestId('subnet-input')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('subnet-input'), {
        target: { value: '10.0.0.0/24' },
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('save-settings-button'));
      });

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      });
    });

    it('shows error message on save failure', async () => {
      (updateDiscoverySettings as Mock).mockRejectedValue(new Error('Save failed'));

      render(<DiscoverySettingsModal isOpen={true} onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByTestId('subnet-input')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('subnet-input'), {
        target: { value: '10.0.0.0/24' },
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('save-settings-button'));
      });

      await waitFor(() => {
        expect(screen.getByText('Save failed')).toBeInTheDocument();
      });
    });
  });

  describe('closing modal', () => {
    it('calls onClose when Cancel button clicked', async () => {
      const onClose = vi.fn();
      render(<DiscoverySettingsModal isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Cancel'));

      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when backdrop clicked', async () => {
      const onClose = vi.fn();
      render(<DiscoverySettingsModal isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByTestId('discovery-settings-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('discovery-settings-modal'));

      expect(onClose).toHaveBeenCalled();
    });

    it('does not close when modal content clicked', async () => {
      const onClose = vi.fn();
      render(<DiscoverySettingsModal isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByTestId('subnet-input')).toBeInTheDocument();
      });

      // Click inside the modal content (not the backdrop)
      fireEvent.click(screen.getByText('Discovery Settings'));

      expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose when close button clicked', async () => {
      const onClose = vi.fn();
      render(<DiscoverySettingsModal isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Close')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('Close'));

      expect(onClose).toHaveBeenCalled();
    });
  });
});
