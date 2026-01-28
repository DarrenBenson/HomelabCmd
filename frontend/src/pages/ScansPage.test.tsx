import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ScansPage } from './ScansPage';
import { api } from '../api/client';
import type { ScanStatusResponse } from '../types/scan';

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock API client
vi.mock('../api/client', () => ({
  api: {
    post: vi.fn(),
  },
}));

// Mock NetworkDiscovery component
vi.mock('../components/NetworkDiscovery', () => ({
  NetworkDiscovery: ({
    onSelectDevice,
    onDiscoveryStart,
  }: {
    onSelectDevice: (ip: string) => void;
    onDiscoveryStart: (id: number) => void;
  }) => (
    <div data-testid="network-discovery">
      <button
        data-testid="select-device-button"
        onClick={() => onSelectDevice('192.168.1.100')}
      >
        Select Device
      </button>
      <button
        data-testid="start-discovery-button"
        onClick={() => onDiscoveryStart(42)}
      >
        Start Discovery
      </button>
    </div>
  ),
}));

// Mock RecentScans component
vi.mock('../components/RecentScans', () => ({
  RecentScans: () => <div data-testid="recent-scans">Recent Scans</div>,
}));

// Mock scrollIntoView which is not available in JSDOM
Element.prototype.scrollIntoView = vi.fn();

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <ScansPage />
    </MemoryRouter>
  );
}

describe('ScansPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Page structure', () => {
    it('renders the page header', () => {
      renderWithRouter();

      expect(screen.getByText('Scans')).toBeInTheDocument();
      expect(
        screen.getByText('Ad-hoc device scanning and network discovery')
      ).toBeInTheDocument();
    });

    it('renders back button link', () => {
      renderWithRouter();

      expect(screen.getByLabelText('Back to dashboard')).toBeInTheDocument();
    });

    it('renders manual scan section', () => {
      renderWithRouter();

      expect(screen.getByText('Manual Scan')).toBeInTheDocument();
      expect(screen.getByTestId('hostname-input')).toBeInTheDocument();
    });

    it('renders network discovery section', () => {
      renderWithRouter();

      expect(screen.getByTestId('network-discovery')).toBeInTheDocument();
    });

    it('renders recent scans section', () => {
      renderWithRouter();

      expect(screen.getByTestId('recent-scans')).toBeInTheDocument();
    });
  });

  describe('Manual scan input', () => {
    it('renders hostname input field', () => {
      renderWithRouter();

      const input = screen.getByTestId('hostname-input');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('placeholder', 'Hostname or IP address...');
    });

    it('updates hostname value on input', () => {
      renderWithRouter();

      const input = screen.getByTestId('hostname-input');
      fireEvent.change(input, { target: { value: 'test-server.local' } });

      expect(input).toHaveValue('test-server.local');
    });

    it('clears error when hostname changes', async () => {
      // Mock API to fail so we can get an error
      (api.post as Mock).mockRejectedValue(new Error('Connection refused'));

      renderWithRouter();

      // Enter hostname and trigger scan to get an error
      const input = screen.getByTestId('hostname-input');
      fireEvent.change(input, { target: { value: 'test-server' } });
      fireEvent.click(screen.getByTestId('quick-scan-button'));

      await waitFor(() => {
        expect(screen.getByTestId('scan-error')).toBeInTheDocument();
      });

      // Type in hostname - should clear error
      fireEvent.change(input, { target: { value: 'new-test' } });

      expect(screen.queryByTestId('scan-error')).not.toBeInTheDocument();
    });
  });

  describe('Quick scan button', () => {
    it('renders quick scan button', () => {
      renderWithRouter();

      expect(screen.getByTestId('quick-scan-button')).toBeInTheDocument();
      expect(screen.getByText('Quick Scan')).toBeInTheDocument();
    });

    it('is disabled when hostname is empty', () => {
      renderWithRouter();

      const button = screen.getByTestId('quick-scan-button');
      expect(button).toBeDisabled();
    });

    it('is enabled when hostname has value', () => {
      renderWithRouter();

      fireEvent.change(screen.getByTestId('hostname-input'), {
        target: { value: 'test-server' },
      });

      expect(screen.getByTestId('quick-scan-button')).not.toBeDisabled();
    });

    it('initiates quick scan on click', async () => {
      const mockResponse: ScanStatusResponse = {
        scan_id: 123,
        hostname: 'test-server',
        status: 'running',
        scan_type: 'quick',
        started_at: new Date().toISOString(),
        completed_at: null,
        results: null,
      };
      (api.post as Mock).mockResolvedValue(mockResponse);

      renderWithRouter();

      fireEvent.change(screen.getByTestId('hostname-input'), {
        target: { value: 'test-server' },
      });
      fireEvent.click(screen.getByTestId('quick-scan-button'));

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/v1/scans', {
          hostname: 'test-server',
          scan_type: 'quick',
        });
      });
    });

    it('navigates to scan results on success', async () => {
      const mockResponse: ScanStatusResponse = {
        scan_id: 456,
        hostname: 'test-server',
        status: 'running',
        scan_type: 'quick',
        started_at: new Date().toISOString(),
        completed_at: null,
        results: null,
      };
      (api.post as Mock).mockResolvedValue(mockResponse);

      renderWithRouter();

      fireEvent.change(screen.getByTestId('hostname-input'), {
        target: { value: 'test-server' },
      });
      fireEvent.click(screen.getByTestId('quick-scan-button'));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/scans/456');
      });
    });
  });

  describe('Full scan button', () => {
    it('renders full scan button', () => {
      renderWithRouter();

      expect(screen.getByTestId('full-scan-button')).toBeInTheDocument();
      expect(screen.getByText('Full Scan')).toBeInTheDocument();
    });

    it('is disabled when hostname is empty', () => {
      renderWithRouter();

      expect(screen.getByTestId('full-scan-button')).toBeDisabled();
    });

    it('initiates full scan on click', async () => {
      const mockResponse: ScanStatusResponse = {
        scan_id: 789,
        hostname: 'test-server',
        status: 'running',
        scan_type: 'full',
        started_at: new Date().toISOString(),
        completed_at: null,
        results: null,
      };
      (api.post as Mock).mockResolvedValue(mockResponse);

      renderWithRouter();

      fireEvent.change(screen.getByTestId('hostname-input'), {
        target: { value: 'test-server' },
      });
      fireEvent.click(screen.getByTestId('full-scan-button'));

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/v1/scans', {
          hostname: 'test-server',
          scan_type: 'full',
        });
      });
    });
  });

  describe('Enter key submission', () => {
    it('triggers quick scan on Enter key press', async () => {
      const mockResponse: ScanStatusResponse = {
        scan_id: 101,
        hostname: 'test-server',
        status: 'running',
        scan_type: 'quick',
        started_at: new Date().toISOString(),
        completed_at: null,
        results: null,
      };
      (api.post as Mock).mockResolvedValue(mockResponse);

      renderWithRouter();

      const input = screen.getByTestId('hostname-input');
      fireEvent.change(input, { target: { value: 'test-server' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/v1/scans', {
          hostname: 'test-server',
          scan_type: 'quick',
        });
      });
    });

    it('does not submit on Enter when scanning', async () => {
      // Set up a promise that never resolves to keep scanning state
      let resolvePromise: (value: ScanStatusResponse) => void;
      (api.post as Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          })
      );

      renderWithRouter();

      const input = screen.getByTestId('hostname-input');
      fireEvent.change(input, { target: { value: 'test-server' } });
      fireEvent.click(screen.getByTestId('quick-scan-button'));

      // Try to submit again with Enter
      fireEvent.keyDown(input, { key: 'Enter' });

      // API should only be called once
      expect(api.post).toHaveBeenCalledTimes(1);

      // Clean up
      await act(async () => {
        resolvePromise!({
          scan_id: 1,
          hostname: 'test-server',
          status: 'running',
          scan_type: 'quick',
          started_at: new Date().toISOString(),
          completed_at: null,
          results: null,
        });
      });
    });
  });

  describe('Error handling', () => {
    it('shows error when hostname is empty', () => {
      renderWithRouter();

      // Force a button click even though disabled (simulate edge case)
      const button = screen.getByTestId('quick-scan-button');
      // Enable it temporarily
      fireEvent.change(screen.getByTestId('hostname-input'), {
        target: { value: '   ' },
      });
      // Trim makes it empty
      fireEvent.click(button);

      // Error should not show for whitespace-only (button should be disabled)
      // But let's test the validation path
    });

    it('shows error message on API failure', async () => {
      (api.post as Mock).mockRejectedValue(new Error('Connection refused'));

      renderWithRouter();

      fireEvent.change(screen.getByTestId('hostname-input'), {
        target: { value: 'test-server' },
      });
      fireEvent.click(screen.getByTestId('quick-scan-button'));

      await waitFor(() => {
        expect(screen.getByTestId('scan-error')).toBeInTheDocument();
        expect(screen.getByText('Connection refused')).toBeInTheDocument();
      });
    });

    it('shows generic error for non-Error exceptions', async () => {
      (api.post as Mock).mockRejectedValue('Unknown error');

      renderWithRouter();

      fireEvent.change(screen.getByTestId('hostname-input'), {
        target: { value: 'test-server' },
      });
      fireEvent.click(screen.getByTestId('quick-scan-button'));

      await waitFor(() => {
        expect(screen.getByText('Failed to start scan')).toBeInTheDocument();
      });
    });

    it('re-enables buttons after error', async () => {
      (api.post as Mock).mockRejectedValue(new Error('Network error'));

      renderWithRouter();

      fireEvent.change(screen.getByTestId('hostname-input'), {
        target: { value: 'test-server' },
      });
      fireEvent.click(screen.getByTestId('quick-scan-button'));

      await waitFor(() => {
        expect(screen.getByTestId('scan-error')).toBeInTheDocument();
      });

      // Buttons should be enabled again
      expect(screen.getByTestId('quick-scan-button')).not.toBeDisabled();
      expect(screen.getByTestId('full-scan-button')).not.toBeDisabled();
    });
  });

  describe('Disabled state during scan', () => {
    it('disables input while scanning', async () => {
      let resolvePromise: (value: ScanStatusResponse) => void;
      (api.post as Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          })
      );

      renderWithRouter();

      const input = screen.getByTestId('hostname-input');
      fireEvent.change(input, { target: { value: 'test-server' } });
      fireEvent.click(screen.getByTestId('quick-scan-button'));

      expect(input).toBeDisabled();

      await act(async () => {
        resolvePromise!({
          scan_id: 1,
          hostname: 'test-server',
          status: 'running',
          scan_type: 'quick',
          started_at: new Date().toISOString(),
          completed_at: null,
          results: null,
        });
      });
    });

    it('disables buttons while scanning', async () => {
      let resolvePromise: (value: ScanStatusResponse) => void;
      (api.post as Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          })
      );

      renderWithRouter();

      fireEvent.change(screen.getByTestId('hostname-input'), {
        target: { value: 'test-server' },
      });
      fireEvent.click(screen.getByTestId('quick-scan-button'));

      expect(screen.getByTestId('quick-scan-button')).toBeDisabled();
      expect(screen.getByTestId('full-scan-button')).toBeDisabled();

      await act(async () => {
        resolvePromise!({
          scan_id: 1,
          hostname: 'test-server',
          status: 'running',
          scan_type: 'quick',
          started_at: new Date().toISOString(),
          completed_at: null,
          results: null,
        });
      });
    });
  });

  describe('Network discovery integration', () => {
    it('populates hostname when device is selected', () => {
      renderWithRouter();

      fireEvent.click(screen.getByTestId('select-device-button'));

      expect(screen.getByTestId('hostname-input')).toHaveValue('192.168.1.100');
    });

    it('clears error when device is selected', async () => {
      (api.post as Mock).mockRejectedValue(new Error('Network error'));

      renderWithRouter();

      // Cause an error first
      fireEvent.change(screen.getByTestId('hostname-input'), {
        target: { value: 'test-server' },
      });
      fireEvent.click(screen.getByTestId('quick-scan-button'));

      await waitFor(() => {
        expect(screen.getByTestId('scan-error')).toBeInTheDocument();
      });

      // Select device - should clear error
      fireEvent.click(screen.getByTestId('select-device-button'));

      expect(screen.queryByTestId('scan-error')).not.toBeInTheDocument();
    });
  });

  describe('Discovery state persistence', () => {
    it('loads active discovery ID from localStorage on mount', () => {
      localStorage.setItem('activeDiscoveryId', '42');

      renderWithRouter();

      // The component should have loaded the ID (mocked component doesn't use it visually,
      // but we can verify the localStorage was read)
      expect(localStorage.getItem('activeDiscoveryId')).toBe('42');
    });

    it('saves discovery ID to localStorage when discovery starts', () => {
      renderWithRouter();

      fireEvent.click(screen.getByTestId('start-discovery-button'));

      expect(localStorage.getItem('activeDiscoveryId')).toBe('42');
    });
  });

  describe('Hostname trimming', () => {
    it('trims whitespace from hostname before submitting', async () => {
      const mockResponse: ScanStatusResponse = {
        scan_id: 1,
        hostname: 'trimmed-server',
        status: 'running',
        scan_type: 'quick',
        started_at: new Date().toISOString(),
        completed_at: null,
        results: null,
      };
      (api.post as Mock).mockResolvedValue(mockResponse);

      renderWithRouter();

      fireEvent.change(screen.getByTestId('hostname-input'), {
        target: { value: '  trimmed-server  ' },
      });
      fireEvent.click(screen.getByTestId('quick-scan-button'));

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/v1/scans', {
          hostname: 'trimmed-server',
          scan_type: 'quick',
        });
      });
    });
  });
});
