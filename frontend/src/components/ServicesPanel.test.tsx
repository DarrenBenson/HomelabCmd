import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { ServicesPanel } from './ServicesPanel';
import { getServerServices, restartService } from '../api/services';
import { getActions } from '../api/actions';
import { ApiError } from '../api/client';
import type { ServicesResponse } from '../types/service';

vi.mock('../api/services', () => ({
  getServerServices: vi.fn(),
  restartService: vi.fn(),
}));

vi.mock('../api/actions', () => ({
  getActions: vi.fn(),
}));

const mockServicesResponse: ServicesResponse = {
  services: [
    {
      service_name: 'docker',
      display_name: 'Docker Engine',
      is_critical: true,
      enabled: true,
      current_status: {
        status: 'running',
        pid: 12345,
        memory_mb: 512.5,
        cpu_percent: 2.5,
        last_seen: '2026-01-19T10:00:00Z',
      },
    },
    {
      service_name: 'sonarr',
      display_name: 'Sonarr',
      is_critical: false,
      enabled: true,
      current_status: {
        status: 'stopped',
        pid: null,
        memory_mb: null,
        cpu_percent: null,
        last_seen: '2026-01-19T10:00:00Z',
      },
    },
  ],
  total: 2,
};

const emptyServicesResponse: ServicesResponse = {
  services: [],
  total: 0,
};

describe('ServicesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getActions as Mock).mockResolvedValue({ actions: [], total: 0 });
  });

  describe('loading state', () => {
    it('shows loading spinner initially', () => {
      (getServerServices as Mock).mockReturnValue(new Promise(() => {}));
      render(<ServicesPanel serverId="test-server" />);

      expect(screen.getByTestId('services-loading')).toBeInTheDocument();
    });
  });

  describe('services display', () => {
    it('renders services after loading', async () => {
      (getServerServices as Mock).mockResolvedValue(mockServicesResponse);
      render(<ServicesPanel serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('services-list')).toBeInTheDocument();
      });

      expect(screen.getAllByTestId('service-card')).toHaveLength(2);
    });

    it('shows service names', async () => {
      (getServerServices as Mock).mockResolvedValue(mockServicesResponse);
      render(<ServicesPanel serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByText('Docker Engine')).toBeInTheDocument();
        expect(screen.getByText('Sonarr')).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('shows empty message when no services configured', async () => {
      (getServerServices as Mock).mockResolvedValue(emptyServicesResponse);
      render(<ServicesPanel serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('services-empty')).toBeInTheDocument();
      });

      expect(screen.getByText('No services configured for this server.')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message on API failure', async () => {
      (getServerServices as Mock).mockRejectedValue(new Error('API error'));
      render(<ServicesPanel serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('services-error')).toBeInTheDocument();
      });

      expect(screen.getByText('API error')).toBeInTheDocument();
    });
  });

  describe('API calls', () => {
    it('calls getServerServices with serverId', async () => {
      (getServerServices as Mock).mockResolvedValue(mockServicesResponse);
      render(<ServicesPanel serverId="my-server-id" />);

      await waitFor(() => {
        expect(getServerServices).toHaveBeenCalledWith('my-server-id');
      });
    });
  });

  describe('panel header', () => {
    it('shows Services heading', async () => {
      (getServerServices as Mock).mockResolvedValue(mockServicesResponse);
      render(<ServicesPanel serverId="test-server" />);

      // Wait for async operations to complete to avoid act() warning
      await waitFor(() => {
        expect(screen.getByTestId('services-list')).toBeInTheDocument();
      });

      expect(screen.getByText('Services')).toBeInTheDocument();
    });
  });

  describe('restart service', () => {
    it('calls restartService API when restart button clicked', async () => {
      (getServerServices as Mock).mockResolvedValue(mockServicesResponse);
      (restartService as Mock).mockResolvedValue({
        action_id: 'action-123',
        status: 'queued',
        message: 'Service restart queued',
      });

      render(<ServicesPanel serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('services-list')).toBeInTheDocument();
      });

      const restartButtons = screen.getAllByTestId('restart-button');
      await act(async () => {
        fireEvent.click(restartButtons[0]);
      });

      // Should have called restartService with the server ID
      expect(restartService).toHaveBeenCalledWith('test-server', expect.any(String));
    });

    it('shows success message after restart', async () => {
      (getServerServices as Mock).mockResolvedValue(mockServicesResponse);
      (restartService as Mock).mockResolvedValue({
        action_id: 'action-123',
        status: 'queued',
        message: 'Service restart queued',
      });

      render(<ServicesPanel serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('services-list')).toBeInTheDocument();
      });

      const restartButtons = screen.getAllByTestId('restart-button');
      await act(async () => {
        fireEvent.click(restartButtons[0]);
      });

      await waitFor(() => {
        expect(screen.getByTestId('restart-message')).toBeInTheDocument();
      });
      // The first restart button might be for either service
      expect(screen.getByTestId('restart-message')).toHaveTextContent(/Restarting/);
    });

    it('shows pending message when server is in maintenance mode', async () => {
      (getServerServices as Mock).mockResolvedValue(mockServicesResponse);
      (restartService as Mock).mockResolvedValue({
        action_id: 'action-123',
        status: 'pending',
        message: 'Service restart pending approval',
      });

      render(<ServicesPanel serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('services-list')).toBeInTheDocument();
      });

      const restartButtons = screen.getAllByTestId('restart-button');
      await act(async () => {
        fireEvent.click(restartButtons[0]);
      });

      await waitFor(() => {
        expect(screen.getByTestId('restart-message')).toHaveTextContent(/pending approval/);
      });
    });

    it('shows info message for 409 conflict (already pending)', async () => {
      (getServerServices as Mock).mockResolvedValue(mockServicesResponse);
      (restartService as Mock).mockRejectedValue(new ApiError(409, 'Conflict'));

      render(<ServicesPanel serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('services-list')).toBeInTheDocument();
      });

      const restartButtons = screen.getAllByTestId('restart-button');
      await act(async () => {
        fireEvent.click(restartButtons[0]);
      });

      await waitFor(() => {
        expect(screen.getByTestId('restart-message')).toHaveTextContent(/already pending/);
      });
    });

    it('shows error message on restart failure', async () => {
      (getServerServices as Mock).mockResolvedValue(mockServicesResponse);
      (restartService as Mock).mockRejectedValue(new Error('Connection failed'));

      render(<ServicesPanel serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('services-list')).toBeInTheDocument();
      });

      const restartButtons = screen.getAllByTestId('restart-button');
      await act(async () => {
        fireEvent.click(restartButtons[0]);
      });

      await waitFor(() => {
        expect(screen.getByTestId('restart-message')).toHaveTextContent(/Connection failed/);
      });
    });

  });

  describe('queued services tracking', () => {
    it('tracks services with in-progress actions', async () => {
      (getServerServices as Mock).mockResolvedValue(mockServicesResponse);
      (getActions as Mock).mockResolvedValue({
        actions: [
          {
            id: 1,
            action_type: 'restart_service',
            service_name: 'docker',
            status: 'pending',
            server_id: 'test-server',
          },
        ],
        total: 1,
      });

      render(<ServicesPanel serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('services-list')).toBeInTheDocument();
      });

      // Verify actions were fetched
      expect(getActions).toHaveBeenCalled();
    });
  });
});
