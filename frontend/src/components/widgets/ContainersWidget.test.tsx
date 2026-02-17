import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ContainersWidget } from './ContainersWidget';
import * as containersApi from '../../api/containers';
import type { MachineData } from './types';
import type { ContainerActionResponse, ContainerListResponse } from '../../types/container';

vi.mock('../../api/containers');

const mockMachine: MachineData = {
  id: 'test-server',
  hostname: 'test.local',
  status: 'online',
  machine_type: 'server',
  has_docker: true,
};

const mockContainerResponse: ContainerListResponse = {
  server_id: 'test-server',
  containers: [
    {
      id: 'abc123def456',
      name: 'plex',
      image: 'plexinc/pms-docker:latest',
      state: 'running',
      status: 'Up 12 days',
      ports: '32400/tcp',
      created_at: '2026-01-15T00:00:00Z',
      uptime_seconds: 12 * 86400,
    },
    {
      id: 'def456ghi789',
      name: 'sonarr',
      image: 'linuxserver/sonarr:latest',
      state: 'exited',
      status: 'Exited (0) 2 hours ago',
      ports: '8989/tcp',
      created_at: '2026-01-10T00:00:00Z',
      uptime_seconds: null,
    },
  ],
  total: 2,
  cached: false,
  fetched_at: new Date().toISOString(),
  error: null,
};

describe('ContainersWidget', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(containersApi.getContainers).mockResolvedValue(mockContainerResponse);
  });

  it('renders loading state initially', async () => {
    // Create a promise that won't resolve immediately
    let resolvePromise: (value: ContainerListResponse) => void;
    const pendingPromise = new Promise<ContainerListResponse>((resolve) => {
      resolvePromise = resolve;
    });
    vi.mocked(containersApi.getContainers).mockReturnValue(pendingPromise);

    render(<ContainersWidget machine={mockMachine} />);

    expect(screen.getByTestId('containers-loading')).toBeInTheDocument();

    // Cleanup
    resolvePromise!(mockContainerResponse);
  });

  it('renders container list after loading', async () => {
    render(<ContainersWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('containers-list')).toBeInTheDocument();
    });

    expect(screen.getByTestId('container-plex')).toBeInTheDocument();
    expect(screen.getByTestId('container-sonarr')).toBeInTheDocument();
  });

  it('shows running and stopped counts (AC summary)', async () => {
    render(<ContainersWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('containers-running-count')).toHaveTextContent('1 running');
      expect(screen.getByTestId('containers-stopped-count')).toHaveTextContent('1 stopped');
    });
  });

  it('expands container row to show details when clicked (AC8)', async () => {
    render(<ContainersWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('container-plex')).toBeInTheDocument();
    });

    // Click to expand
    fireEvent.click(screen.getByTestId('container-plex'));

    // Check the details panel is visible
    const details = screen.getByTestId('container-details-plex');
    expect(details).toBeInTheDocument();
    // Check that details contain the expected content
    expect(details).toHaveTextContent('plexinc/pms-docker:latest');
    expect(details).toHaveTextContent('32400/tcp');
    expect(details).toHaveTextContent('abc123def456');
  });

  it('shows refresh button and refreshes on click', async () => {
    render(<ContainersWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('containers-list')).toBeInTheDocument();
    });

    const refreshButton = screen.getByTestId('containers-refresh');
    expect(refreshButton).toBeInTheDocument();

    // Clear mock calls
    vi.mocked(containersApi.getContainers).mockClear();

    // Click refresh
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(containersApi.getContainers).toHaveBeenCalledWith('test-server', true);
    });
  });

  it('displays error state when fetch fails', async () => {
    const errorResponse: ContainerListResponse = {
      server_id: 'test-server',
      containers: [],
      total: 0,
      cached: false,
      fetched_at: new Date().toISOString(),
      error: 'SSH connection failed',
    };
    vi.mocked(containersApi.getContainers).mockResolvedValue(errorResponse);

    render(<ContainersWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('containers-error')).toHaveTextContent('SSH connection failed');
    });
  });

  it('displays empty state when no containers', async () => {
    const emptyResponse: ContainerListResponse = {
      server_id: 'test-server',
      containers: [],
      total: 0,
      cached: false,
      fetched_at: new Date().toISOString(),
      error: null,
    };
    vi.mocked(containersApi.getContainers).mockResolvedValue(emptyResponse);

    render(<ContainersWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('containers-empty')).toHaveTextContent('No containers found');
    });
  });

  it('shows status indicator with correct colour for running containers (AC4)', async () => {
    render(<ContainersWidget machine={mockMachine} />);

    await waitFor(() => {
      const statusIndicator = screen.getByTestId('container-status-plex');
      expect(statusIndicator).toHaveClass('bg-status-success');
    });
  });

  it('shows status indicator with muted colour for stopped containers (AC4)', async () => {
    render(<ContainersWidget machine={mockMachine} />);

    await waitFor(() => {
      const statusIndicator = screen.getByTestId('container-status-sonarr');
      expect(statusIndicator).toHaveClass('bg-text-muted');
    });
  });

  it('shows "Show all" toggle when more than 5 containers', async () => {
    const manyContainers: ContainerListResponse = {
      ...mockContainerResponse,
      containers: Array.from({ length: 8 }, (_, i) => ({
        id: `container-${i}`,
        name: `container-${i}`,
        image: `image-${i}:latest`,
        state: 'running' as const,
        status: 'Up 1 day',
        ports: null,
        created_at: null,
        uptime_seconds: 86400,
      })),
      total: 8,
    };
    vi.mocked(containersApi.getContainers).mockResolvedValue(manyContainers);

    render(<ContainersWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('containers-toggle')).toHaveTextContent('Show all (8)');
    });

    // Click to show all
    fireEvent.click(screen.getByTestId('containers-toggle'));

    expect(screen.getByTestId('containers-toggle')).toHaveTextContent('Show less');
  });

  it('calls API with machine id', async () => {
    render(<ContainersWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(containersApi.getContainers).toHaveBeenCalledWith('test-server', false);
    });
  });

  it('shows remove button in edit mode', async () => {
    const onRemove = vi.fn();
    render(<ContainersWidget machine={mockMachine} isEditMode={true} onRemove={onRemove} />);

    await waitFor(() => {
      expect(screen.getByTestId('widget-remove-button')).toBeInTheDocument();
    });
  });

  // US0160: Container Start Action tests
  describe('Container Start Action (US0160)', () => {
    it('shows start button for stopped containers', async () => {
      render(<ContainersWidget machine={mockMachine} />);

      await waitFor(() => {
        expect(screen.getByTestId('containers-list')).toBeInTheDocument();
      });

      // Stopped container (sonarr) should have start button
      expect(screen.getByTestId('container-start-sonarr')).toBeInTheDocument();

      // Running container (plex) should NOT have start button
      expect(screen.queryByTestId('container-start-plex')).not.toBeInTheDocument();
    });

    it('calls startContainer API when start button clicked', async () => {
      const mockStartResponse: ContainerActionResponse = {
        success: true,
        output: 'sonarr\n',
        container_id: 'sonarr',
        action: 'start',
      };
      vi.mocked(containersApi.startContainer).mockResolvedValue(mockStartResponse);

      render(<ContainersWidget machine={mockMachine} />);

      await waitFor(() => {
        expect(screen.getByTestId('containers-list')).toBeInTheDocument();
      });

      // Click start button on stopped container
      fireEvent.click(screen.getByTestId('container-start-sonarr'));

      await waitFor(() => {
        expect(containersApi.startContainer).toHaveBeenCalledWith('test-server', 'sonarr');
      });
    });

    it('shows success message after starting container (AC6)', async () => {
      const mockStartResponse: ContainerActionResponse = {
        success: true,
        output: 'sonarr\n',
        container_id: 'sonarr',
        action: 'start',
      };
      vi.mocked(containersApi.startContainer).mockResolvedValue(mockStartResponse);

      render(<ContainersWidget machine={mockMachine} />);

      await waitFor(() => {
        expect(screen.getByTestId('containers-list')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('container-start-sonarr'));

      await waitFor(() => {
        expect(screen.getByTestId('container-action-message')).toHaveTextContent('Started sonarr');
      });
    });

    it('shows error message when start fails (AC6)', async () => {
      const mockStartResponse: ContainerActionResponse = {
        success: false,
        output: 'Error: Container already running',
        container_id: 'sonarr',
        action: 'start',
      };
      vi.mocked(containersApi.startContainer).mockResolvedValue(mockStartResponse);

      render(<ContainersWidget machine={mockMachine} />);

      await waitFor(() => {
        expect(screen.getByTestId('containers-list')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('container-start-sonarr'));

      await waitFor(() => {
        expect(screen.getByTestId('container-action-message')).toHaveTextContent('Error: Container already running');
      });
    });

    it('refreshes container list after successful start (AC4)', async () => {
      const mockStartResponse: ContainerActionResponse = {
        success: true,
        output: 'sonarr\n',
        container_id: 'sonarr',
        action: 'start',
      };
      vi.mocked(containersApi.startContainer).mockResolvedValue(mockStartResponse);

      render(<ContainersWidget machine={mockMachine} />);

      await waitFor(() => {
        expect(screen.getByTestId('containers-list')).toBeInTheDocument();
      });

      // Clear mock calls from initial load
      vi.mocked(containersApi.getContainers).mockClear();

      fireEvent.click(screen.getByTestId('container-start-sonarr'));

      // Should refresh container list after action
      await waitFor(() => {
        expect(containersApi.getContainers).toHaveBeenCalledWith('test-server', true);
      });
    });

    it('disables start button while action in progress (AC5)', async () => {
      // Create a promise that doesn't resolve immediately
      let resolveStart: (value: ContainerActionResponse) => void;
      const pendingPromise = new Promise<ContainerActionResponse>((resolve) => {
        resolveStart = resolve;
      });
      vi.mocked(containersApi.startContainer).mockReturnValue(pendingPromise);

      render(<ContainersWidget machine={mockMachine} />);

      await waitFor(() => {
        expect(screen.getByTestId('containers-list')).toBeInTheDocument();
      });

      const startButton = screen.getByTestId('container-start-sonarr');
      fireEvent.click(startButton);

      // Button should be disabled while action is in progress
      await waitFor(() => {
        expect(startButton).toBeDisabled();
      });

      // Resolve the promise
      resolveStart!({
        success: true,
        output: 'sonarr\n',
        container_id: 'sonarr',
        action: 'start',
      });
    });
  });
});
