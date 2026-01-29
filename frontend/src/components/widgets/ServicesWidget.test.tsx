import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServicesWidget } from './ServicesWidget';
import type { MachineData } from './types';

// Mock the API functions
vi.mock('../../api/services', () => ({
  getServerServices: vi.fn(),
  restartService: vi.fn(),
}));

vi.mock('../../api/actions', () => ({
  getActions: vi.fn(),
}));

import { getServerServices, restartService } from '../../api/services';
import { getActions } from '../../api/actions';

const mockMachine: MachineData = {
  id: 'server-1',
  hostname: 'test-server',
  status: 'online',
};

const mockServicesResponse = {
  services: [
    {
      service_name: 'nginx',
      display_name: 'Nginx Web Server',
      is_critical: true,
      enabled: true,
      current_status: {
        status: 'running',
        status_reason: null,
        pid: 1234,
        memory_mb: 50,
        cpu_percent: 1.5,
        last_seen: '2026-01-28T11:00:00Z',
      },
    },
    {
      service_name: 'postgresql',
      display_name: 'PostgreSQL Database',
      is_critical: true,
      enabled: true,
      current_status: {
        status: 'stopped',
        status_reason: 'Failed to start',
        pid: null,
        memory_mb: null,
        cpu_percent: null,
        last_seen: '2026-01-28T11:00:00Z',
      },
    },
    {
      service_name: 'redis',
      display_name: null,
      is_critical: false,
      enabled: true,
      current_status: {
        status: 'running',
        status_reason: null,
        pid: 5678,
        memory_mb: 30,
        cpu_percent: 0.5,
        last_seen: '2026-01-28T11:00:00Z',
      },
    },
  ],
  total: 3,
};

const mockActionsResponse = {
  actions: [],
  total: 0,
};

describe('ServicesWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerServices).mockResolvedValue(mockServicesResponse);
    vi.mocked(getActions).mockResolvedValue(mockActionsResponse);
  });

  it('displays service list', async () => {
    render(<ServicesWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('services-list')).toBeInTheDocument();
    });
    expect(screen.getByTestId('service-nginx')).toBeInTheDocument();
    expect(screen.getByTestId('service-postgresql')).toBeInTheDocument();
  });

  it('displays running and stopped counts', async () => {
    render(<ServicesWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('services-running-count')).toHaveTextContent('2 running');
    });
    expect(screen.getByTestId('services-stopped-count')).toHaveTextContent('1 stopped');
  });

  it('shows loading state initially', () => {
    render(<ServicesWidget machine={mockMachine} />);

    expect(screen.getByTestId('services-loading')).toBeInTheDocument();
  });

  it('shows service display name when available', async () => {
    render(<ServicesWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(screen.getByText('Nginx Web Server')).toBeInTheDocument();
    });
  });

  it('shows service name when display name is null', async () => {
    render(<ServicesWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(screen.getByText('redis')).toBeInTheDocument();
    });
  });

  it('shows restart button for stopped services', async () => {
    render(<ServicesWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('restart-postgresql')).toBeInTheDocument();
    });
    // Running services should not have restart button
    expect(screen.queryByTestId('restart-nginx')).not.toBeInTheDocument();
  });

  it('triggers restart when button clicked', async () => {
    vi.mocked(restartService).mockResolvedValue({
      action_id: 1,
      action_type: 'restart_service',
      server_id: 'server-1',
      service_name: 'postgresql',
      command: 'systemctl restart postgresql',
      status: 'executing',
      created_at: '2026-01-28T11:00:00Z',
    });

    render(<ServicesWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('restart-postgresql')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('restart-postgresql'));

    await waitFor(() => {
      expect(restartService).toHaveBeenCalledWith('server-1', 'postgresql');
    });
  });

  it('hides restart buttons in readonly mode', async () => {
    render(<ServicesWidget machine={mockMachine} agentMode="readonly" />);

    await waitFor(() => {
      expect(screen.getByTestId('service-postgresql')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('restart-postgresql')).not.toBeInTheDocument();
  });

  it('shows inactive message when server is inactive', async () => {
    render(<ServicesWidget machine={mockMachine} isInactive={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('services-inactive')).toHaveTextContent('Agent Inactive');
    });
  });

  it('shows empty message when no services', async () => {
    vi.mocked(getServerServices).mockResolvedValue({ services: [], total: 0 });

    render(<ServicesWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('services-empty')).toHaveTextContent('No services configured');
    });
  });

  it('shows error when API fails', async () => {
    vi.mocked(getServerServices).mockRejectedValue(new Error('Network error'));

    render(<ServicesWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('services-error')).toHaveTextContent('Network error');
    });
  });

  it('shows edit mode indicator when isEditMode is true', async () => {
    render(<ServicesWidget machine={mockMachine} isEditMode={true} />);

    await waitFor(() => {
      expect(screen.getByText('Drag to move')).toBeInTheDocument();
    });
  });
});
