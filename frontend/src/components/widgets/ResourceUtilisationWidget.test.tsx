/**
 * Tests for ResourceUtilisationWidget component.
 *
 * EP0012: Widget-Based Detail View
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResourceUtilisationWidget } from './ResourceUtilisationWidget';
import type { Server } from '../../types/server';

const createMockMachine = (overrides: Partial<Server> = {}): Server => ({
  id: 'server-1',
  hostname: 'test-server',
  display_name: 'Test Server',
  status: 'online',
  is_paused: false,
  agent_version: '1.0.0',
  agent_mode: 'readonly',
  is_inactive: false,
  inactive_since: null,
  updates_available: 0,
  security_updates: 0,
  latest_metrics: {
    cpu_percent: 45,
    memory_percent: 60,
    memory_total_mb: 16384,
    memory_used_mb: 9830,
    disk_percent: 55,
    disk_total_gb: 500,
    disk_used_gb: 275,
    network_rx_bytes: 1000000,
    network_tx_bytes: 500000,
    load_1m: 1.5,
    load_5m: 1.2,
    load_15m: 1.0,
    uptime_seconds: 86400,
  },
  machine_type: 'server',
  last_seen: '2026-01-29T10:00:00Z',
  active_alert_count: 0,
  active_alert_summaries: [],
  tailscale_hostname: null,
  filesystems: null,
  network_interfaces: null,
  ...overrides,
});

describe('ResourceUtilisationWidget', () => {
  it('renders the widget with title', () => {
    render(<ResourceUtilisationWidget machine={createMockMachine()} />);

    expect(screen.getByText('Resource Utilisation')).toBeInTheDocument();
  });

  it('renders CPU gauge with correct value', () => {
    render(<ResourceUtilisationWidget machine={createMockMachine()} />);

    expect(screen.getByText('CPU')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('renders RAM gauge with correct value', () => {
    render(<ResourceUtilisationWidget machine={createMockMachine()} />);

    expect(screen.getByText('RAM')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('renders Disk gauge with correct value', () => {
    render(<ResourceUtilisationWidget machine={createMockMachine()} />);

    expect(screen.getByText('Disk')).toBeInTheDocument();
    expect(screen.getByText('55%')).toBeInTheDocument();
  });

  it('handles null metrics gracefully', () => {
    render(
      <ResourceUtilisationWidget
        machine={createMockMachine({ latest_metrics: null })}
      />
    );

    expect(screen.getByText('Resource Utilisation')).toBeInTheDocument();
    expect(screen.getByText('CPU')).toBeInTheDocument();
    expect(screen.getByText('RAM')).toBeInTheDocument();
    expect(screen.getByText('Disk')).toBeInTheDocument();
  });

  it('accepts isEditMode prop', () => {
    render(
      <ResourceUtilisationWidget machine={createMockMachine()} isEditMode={true} />
    );

    expect(screen.getByText('Resource Utilisation')).toBeInTheDocument();
  });

  it('renders three gauges', () => {
    render(<ResourceUtilisationWidget machine={createMockMachine()} />);

    const labels = ['CPU', 'RAM', 'Disk'];
    labels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });
});
