import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServerDetailWidgetView } from './ServerDetailWidgetView';
import * as widgetLayoutApi from '../../api/widget-layout';
import type { ServerDetail } from '../../types/server';

// Mock the API
vi.mock('../../api/widget-layout', () => ({
  getWidgetLayout: vi.fn(),
  saveWidgetLayout: vi.fn(),
  deleteWidgetLayout: vi.fn(),
}));

const mockServer: ServerDetail = {
  id: 'test-server',
  hostname: 'test-server.local',
  display_name: 'Test Server',
  status: 'online',
  ip_address: '192.168.1.100',
  tailscale_hostname: 'test-server.ts.net',
  os_distribution: 'Ubuntu',
  os_version: '22.04',
  kernel_version: '5.15.0',
  architecture: 'x86_64',
  cpu_model: 'Intel Core i7',
  cpu_cores: 8,
  tdp_watts: 65,
  idle_watts: 25,
  machine_category: 'mini_pc',
  machine_category_source: 'user',
  is_paused: false,
  is_inactive: false,
  last_seen: new Date().toISOString(),
  agent_version: '1.0.0',
  agent_mode: 'readwrite',
  latest_metrics: {
    cpu_percent: 45,
    memory_percent: 60,
    memory_used_mb: 8000,
    memory_total_mb: 16000,
    disk_percent: 50,
    disk_used_gb: 500,
    disk_total_gb: 1000,
    load_1m: 1.5,
    load_5m: 1.2,
    load_15m: 1.0,
    network_rx_bytes: 1073741824,
    network_tx_bytes: 536870912,
    uptime_seconds: 86400,
  },
};

describe('ServerDetailWidgetView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no saved layout
    vi.mocked(widgetLayoutApi.getWidgetLayout).mockResolvedValue({
      layouts: null,
      updated_at: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows loading state initially', async () => {
    // Make the API call hang
    vi.mocked(widgetLayoutApi.getWidgetLayout).mockReturnValue(new Promise(() => {}));

    render(<ServerDetailWidgetView server={mockServer} />);

    expect(screen.getByTestId('layout-loading')).toBeInTheDocument();
  });

  it('loads and renders widgets after layout fetch', async () => {
    render(<ServerDetailWidgetView server={mockServer} />);

    // Should call API to load layout
    await waitFor(() => {
      expect(widgetLayoutApi.getWidgetLayout).toHaveBeenCalledWith('test-server');
    });

    // Should render widget grid
    await waitFor(() => {
      expect(screen.getByTestId('widget-grid')).toBeInTheDocument();
    });
  });

  it('renders all widgets', async () => {
    render(<ServerDetailWidgetView server={mockServer} />);

    await waitFor(() => {
      expect(screen.getByTestId('widget-server-info')).toBeInTheDocument();
      expect(screen.getByTestId('widget-system-info')).toBeInTheDocument();
      expect(screen.getByTestId('widget-cpu-chart')).toBeInTheDocument();
      expect(screen.getByTestId('widget-memory-gauge')).toBeInTheDocument();
      expect(screen.getByTestId('widget-disk-usage')).toBeInTheDocument();
      expect(screen.getByTestId('widget-load-average')).toBeInTheDocument();
      expect(screen.getByTestId('widget-network')).toBeInTheDocument();
      expect(screen.getByTestId('widget-services')).toBeInTheDocument();
    });
  });

  it('loads saved layout from API', async () => {
    const savedLayout = {
      lg: [{ i: 'cpu_chart', x: 0, y: 0, w: 6, h: 3 }],
      md: [{ i: 'cpu_chart', x: 0, y: 0, w: 6, h: 3 }],
      sm: [{ i: 'cpu_chart', x: 0, y: 0, w: 6, h: 3 }],
      xs: [{ i: 'cpu_chart', x: 0, y: 0, w: 1, h: 3 }],
    };

    vi.mocked(widgetLayoutApi.getWidgetLayout).mockResolvedValue({
      layouts: savedLayout,
      updated_at: new Date().toISOString(),
    });

    render(<ServerDetailWidgetView server={mockServer} />);

    await waitFor(() => {
      expect(widgetLayoutApi.getWidgetLayout).toHaveBeenCalledWith('test-server');
    });

    // Widget grid should render
    await waitFor(() => {
      expect(screen.getByTestId('widget-grid')).toBeInTheDocument();
    });
  });

  it('shows edit mode controls when isEditMode is true', async () => {
    render(<ServerDetailWidgetView server={mockServer} isEditMode={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('edit-mode-banner')).toBeInTheDocument();
    });
  });

  it('shows reset button when custom layout exists in edit mode', async () => {
    vi.mocked(widgetLayoutApi.getWidgetLayout).mockResolvedValue({
      layouts: {
        lg: [{ i: 'cpu_chart', x: 0, y: 0, w: 6, h: 3 }],
        md: [],
        sm: [],
        xs: [],
      },
      updated_at: new Date().toISOString(),
    });

    render(<ServerDetailWidgetView server={mockServer} isEditMode={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('reset-layout-button')).toBeInTheDocument();
    });
  });

  it('does not show reset button when using default layout', async () => {
    render(<ServerDetailWidgetView server={mockServer} isEditMode={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('edit-mode-banner')).toBeInTheDocument();
    });

    // No reset button without custom layout
    expect(screen.queryByTestId('reset-layout-button')).not.toBeInTheDocument();
  });

  it('handles layout load error gracefully', async () => {
    vi.mocked(widgetLayoutApi.getWidgetLayout).mockRejectedValue(
      new Error('Network error')
    );

    render(<ServerDetailWidgetView server={mockServer} />);

    // Should still render widgets with default layout
    await waitFor(() => {
      expect(screen.getByTestId('widget-grid')).toBeInTheDocument();
    });
  });

  it('passes power props to SystemInfoWidget', async () => {
    render(
      <ServerDetailWidgetView
        server={mockServer}
        estimatedPower={45}
        dailyCost={0.26}
        currencySymbol="$"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('widget-system-info')).toBeInTheDocument();
    });
  });

  // US0174: Default Widget Layout tests

  describe('US0174: Default Widget Layout', () => {
    it('renders services widget for servers (AC2)', async () => {
      const serverMachine = { ...mockServer, machine_type: 'server' as const };
      render(<ServerDetailWidgetView server={serverMachine} />);

      await waitFor(() => {
        expect(screen.getByTestId('widget-services')).toBeInTheDocument();
        expect(screen.getByTestId('widget-load-average')).toBeInTheDocument();
      });
    });

    it('does not render services widget for workstations (AC3)', async () => {
      const workstationMachine = { ...mockServer, machine_type: 'workstation' as const };
      render(<ServerDetailWidgetView server={workstationMachine} />);

      await waitFor(() => {
        expect(screen.getByTestId('widget-grid')).toBeInTheDocument();
      });

      // Workstations should not have services or load_average widgets
      expect(screen.queryByTestId('widget-services')).not.toBeInTheDocument();
      expect(screen.queryByTestId('widget-load-average')).not.toBeInTheDocument();
    });

    it('workstations still have core widgets (AC3)', async () => {
      const workstationMachine = { ...mockServer, machine_type: 'workstation' as const };
      render(<ServerDetailWidgetView server={workstationMachine} />);

      await waitFor(() => {
        expect(screen.getByTestId('widget-cpu-chart')).toBeInTheDocument();
        expect(screen.getByTestId('widget-memory-gauge')).toBeInTheDocument();
        expect(screen.getByTestId('widget-disk-usage')).toBeInTheDocument();
        expect(screen.getByTestId('widget-system-info')).toBeInTheDocument();
        expect(screen.getByTestId('widget-network')).toBeInTheDocument();
      });
    });

    it('defaults to server layout when machine_type is undefined (edge case)', async () => {
      const unknownMachine = { ...mockServer, machine_type: undefined };
      render(<ServerDetailWidgetView server={unknownMachine} />);

      await waitFor(() => {
        // Should include server-specific widgets
        expect(screen.getByTestId('widget-services')).toBeInTheDocument();
        expect(screen.getByTestId('widget-load-average')).toBeInTheDocument();
      });
    });
  });

  // US0175: Edit Layout Mode tests

  describe('US0175: Edit Layout Mode', () => {
    it('shows edit mode banner with EDITING badge when in edit mode (AC6)', async () => {
      render(<ServerDetailWidgetView server={mockServer} isEditMode={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-banner')).toBeInTheDocument();
        expect(screen.getByText('EDITING')).toBeInTheDocument();
      });
    });

    it('shows instructions in edit mode (AC4)', async () => {
      render(<ServerDetailWidgetView server={mockServer} isEditMode={true} />);

      await waitFor(() => {
        expect(screen.getByText(/Drag widgets to rearrange/)).toBeInTheDocument();
        expect(screen.getByText(/Resize from corners/)).toBeInTheDocument();
      });
    });

    it('shows Save and Cancel buttons in edit mode (AC5)', async () => {
      render(<ServerDetailWidgetView server={mockServer} isEditMode={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('save-layout-button')).toBeInTheDocument();
        expect(screen.getByTestId('cancel-edit-button')).toBeInTheDocument();
      });
    });

    it('does not show edit mode banner when not in edit mode (AC3)', async () => {
      render(<ServerDetailWidgetView server={mockServer} isEditMode={false} />);

      await waitFor(() => {
        expect(screen.getByTestId('widget-grid')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('edit-mode-banner')).not.toBeInTheDocument();
    });

    it('calls onExitEditMode when Cancel is clicked (AC5)', async () => {
      const onExitEditMode = vi.fn();
      render(
        <ServerDetailWidgetView
          server={mockServer}
          isEditMode={true}
          onExitEditMode={onExitEditMode}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('cancel-edit-button')).toBeInTheDocument();
      });

      screen.getByTestId('cancel-edit-button').click();

      expect(onExitEditMode).toHaveBeenCalled();
    });

    it('calls onExitEditMode when Save is clicked (AC5)', async () => {
      const onExitEditMode = vi.fn();
      render(
        <ServerDetailWidgetView
          server={mockServer}
          isEditMode={true}
          onExitEditMode={onExitEditMode}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('save-layout-button')).toBeInTheDocument();
      });

      screen.getByTestId('save-layout-button').click();

      await waitFor(() => {
        expect(onExitEditMode).toHaveBeenCalled();
      });
    });
  });

  // US0176: Widget Visibility Toggle tests

  describe('US0176: Widget Visibility Toggle', () => {
    it('shows Add Widget button in edit mode (AC1)', async () => {
      render(<ServerDetailWidgetView server={mockServer} isEditMode={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('add-widget-button')).toBeInTheDocument();
      });
    });

    it('does not show Add Widget button when not in edit mode', async () => {
      render(<ServerDetailWidgetView server={mockServer} isEditMode={false} />);

      await waitFor(() => {
        expect(screen.getByTestId('widget-grid')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('add-widget-button')).not.toBeInTheDocument();
    });

    it('shows remove button on widgets in edit mode (AC3)', async () => {
      render(<ServerDetailWidgetView server={mockServer} isEditMode={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('widget-grid')).toBeInTheDocument();
      });

      // Check that widget containers have remove buttons
      const removeButtons = screen.getAllByTestId('widget-remove-button');
      expect(removeButtons.length).toBeGreaterThan(0);
    });

    it('does not show remove button on widgets when not in edit mode', async () => {
      render(<ServerDetailWidgetView server={mockServer} isEditMode={false} />);

      await waitFor(() => {
        expect(screen.getByTestId('widget-grid')).toBeInTheDocument();
      });

      expect(screen.queryAllByTestId('widget-remove-button')).toHaveLength(0);
    });

    it('removes widget when remove button is clicked (AC3)', async () => {
      render(<ServerDetailWidgetView server={mockServer} isEditMode={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('widget-cpu-chart')).toBeInTheDocument();
      });

      // Get the CPU widget's container and find its remove button
      const cpuWidget = screen.getByTestId('widget-cpu-chart');
      const removeButton = cpuWidget.querySelector('[data-testid="widget-remove-button"]');
      expect(removeButton).toBeInTheDocument();

      // Click remove
      if (removeButton) {
        removeButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }

      // Wait for widget to be removed
      await waitFor(() => {
        expect(screen.queryByTestId('widget-cpu-chart')).not.toBeInTheDocument();
      });

      // Should save the layout (AC6)
      expect(widgetLayoutApi.saveWidgetLayout).toHaveBeenCalled();
    });

    it('only renders visible widgets from saved layout (AC4)', async () => {
      // Layout with only cpu_chart visible
      const savedLayout = {
        lg: [{ i: 'cpu_chart', x: 0, y: 0, w: 4, h: 3, minW: 4, minH: 3 }],
        md: [{ i: 'cpu_chart', x: 0, y: 0, w: 4, h: 3 }],
        sm: [{ i: 'cpu_chart', x: 0, y: 0, w: 4, h: 3 }],
        xs: [{ i: 'cpu_chart', x: 0, y: 0, w: 1, h: 3 }],
      };

      vi.mocked(widgetLayoutApi.getWidgetLayout).mockResolvedValue({
        layouts: savedLayout,
        updated_at: new Date().toISOString(),
      });

      render(<ServerDetailWidgetView server={mockServer} />);

      await waitFor(() => {
        expect(screen.getByTestId('widget-grid')).toBeInTheDocument();
      });

      // Only cpu_chart should be visible
      expect(screen.getByTestId('widget-cpu-chart')).toBeInTheDocument();
      expect(screen.queryByTestId('widget-memory-gauge')).not.toBeInTheDocument();
      expect(screen.queryByTestId('widget-disk-usage')).not.toBeInTheDocument();
      expect(screen.queryByTestId('widget-server-info')).not.toBeInTheDocument();
    });

    it('shows all default widgets when using default layout (AC5)', async () => {
      // No saved layout means default layout
      vi.mocked(widgetLayoutApi.getWidgetLayout).mockResolvedValue({
        layouts: null,
        updated_at: null,
      });

      render(<ServerDetailWidgetView server={mockServer} />);

      await waitFor(() => {
        // All default widgets should be visible
        expect(screen.getByTestId('widget-server-info')).toBeInTheDocument();
        expect(screen.getByTestId('widget-system-info')).toBeInTheDocument();
        expect(screen.getByTestId('widget-cpu-chart')).toBeInTheDocument();
        expect(screen.getByTestId('widget-memory-gauge')).toBeInTheDocument();
        expect(screen.getByTestId('widget-disk-usage')).toBeInTheDocument();
        expect(screen.getByTestId('widget-network')).toBeInTheDocument();
      });
    });

    it('auto-saves when widget is removed (AC6)', async () => {
      render(<ServerDetailWidgetView server={mockServer} isEditMode={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('widget-cpu-chart')).toBeInTheDocument();
      });

      // Get the CPU widget's remove button
      const cpuWidget = screen.getByTestId('widget-cpu-chart');
      const removeButton = cpuWidget.querySelector('[data-testid="widget-remove-button"]');

      if (removeButton) {
        removeButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }

      // Should trigger save
      await waitFor(() => {
        expect(widgetLayoutApi.saveWidgetLayout).toHaveBeenCalled();
      });
    });
  });
});
