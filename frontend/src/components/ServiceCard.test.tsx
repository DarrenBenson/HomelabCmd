import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ServiceCard } from './ServiceCard';
import type { ExpectedService } from '../types/service';

const mockRunningService: ExpectedService = {
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
};

const mockStoppedService: ExpectedService = {
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
};

const mockServiceNoStatus: ExpectedService = {
  service_name: 'plex',
  display_name: null,
  is_critical: false,
  enabled: true,
  current_status: null,
};

const mockDisabledService: ExpectedService = {
  service_name: 'radarr',
  display_name: 'Radarr',
  is_critical: false,
  enabled: false,
  current_status: null,
};

describe('ServiceCard', () => {
  describe('display name', () => {
    it('shows display_name when available', () => {
      render(<ServiceCard service={mockRunningService} />);
      expect(screen.getByText('Docker Engine')).toBeInTheDocument();
    });

    it('falls back to service_name when display_name is null', () => {
      render(<ServiceCard service={mockServiceNoStatus} />);
      expect(screen.getByText('plex')).toBeInTheDocument();
    });
  });

  describe('status indicator', () => {
    it('shows status LED', () => {
      render(<ServiceCard service={mockRunningService} />);
      expect(screen.getByTestId('service-status-led')).toBeInTheDocument();
    });

    it('displays status text', () => {
      render(<ServiceCard service={mockRunningService} />);
      expect(screen.getByTestId('service-status')).toHaveTextContent('running');
    });

    it('shows unknown status when current_status is null', () => {
      render(<ServiceCard service={mockServiceNoStatus} />);
      expect(screen.getByTestId('service-status')).toHaveTextContent('unknown');
    });
  });

  describe('criticality badges', () => {
    it('shows Core badge when is_critical is true', () => {
      render(<ServiceCard service={mockRunningService} />);
      expect(screen.getByTestId('critical-badge')).toBeInTheDocument();
      expect(screen.getByText('Core')).toBeInTheDocument();
    });

    it('shows Standard badge when is_critical is false', () => {
      render(<ServiceCard service={mockStoppedService} />);
      expect(screen.getByTestId('standard-badge')).toBeInTheDocument();
      expect(screen.getByText('Standard')).toBeInTheDocument();
    });
  });

  describe('resource usage for running services', () => {
    it('shows PID when running', () => {
      render(<ServiceCard service={mockRunningService} />);
      expect(screen.getByTestId('service-pid')).toHaveTextContent('12345');
    });

    it('shows memory when running', () => {
      render(<ServiceCard service={mockRunningService} />);
      expect(screen.getByTestId('service-memory')).toHaveTextContent('513 MB'); // 512.5 rounds to 513
    });

    it('shows CPU when running', () => {
      render(<ServiceCard service={mockRunningService} />);
      expect(screen.getByTestId('service-cpu')).toHaveTextContent('2.5%');
    });

    it('does not show resources when stopped', () => {
      render(<ServiceCard service={mockStoppedService} />);
      expect(screen.queryByTestId('service-pid')).not.toBeInTheDocument();
      expect(screen.queryByTestId('service-memory')).not.toBeInTheDocument();
      expect(screen.queryByTestId('service-cpu')).not.toBeInTheDocument();
    });
  });

  describe('restart button', () => {
    it('shows restart button for stopped services', () => {
      render(<ServiceCard service={mockStoppedService} />);
      expect(screen.getByTestId('restart-button')).toBeInTheDocument();
    });

    it('does not show restart button for running services', () => {
      render(<ServiceCard service={mockRunningService} />);
      expect(screen.queryByTestId('restart-button')).not.toBeInTheDocument();
    });

    it('restart button is enabled by default', () => {
      render(<ServiceCard service={mockStoppedService} />);
      expect(screen.getByTestId('restart-button')).not.toBeDisabled();
    });

    it('restart button is disabled when isRestarting is true', () => {
      render(<ServiceCard service={mockStoppedService} isRestarting={true} />);
      expect(screen.getByTestId('restart-button')).toBeDisabled();
      expect(screen.getByTestId('restart-button')).toHaveTextContent('Restarting...');
    });

    it('calls onRestart when clicked', () => {
      const onRestart = vi.fn();
      render(<ServiceCard service={mockStoppedService} onRestart={onRestart} />);
      fireEvent.click(screen.getByTestId('restart-button'));
      expect(onRestart).toHaveBeenCalledTimes(1);
    });
  });

  describe('last seen timestamp', () => {
    it('shows last seen when current_status has last_seen', () => {
      render(<ServiceCard service={mockRunningService} />);
      expect(screen.getByTestId('service-last-seen')).toBeInTheDocument();
    });

    it('does not show last seen when current_status is null', () => {
      render(<ServiceCard service={mockServiceNoStatus} />);
      expect(screen.queryByTestId('service-last-seen')).not.toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('has red left border when stopped', () => {
      render(<ServiceCard service={mockStoppedService} />);
      const card = screen.getByTestId('service-card');
      expect(card).toHaveClass('border-l-4');
      expect(card).toHaveClass('border-l-status-error');
    });

    it('does not have red border when running', () => {
      render(<ServiceCard service={mockRunningService} />);
      const card = screen.getByTestId('service-card');
      expect(card).not.toHaveClass('border-l-4');
    });

    it('has reduced opacity when disabled', () => {
      render(<ServiceCard service={mockDisabledService} />);
      const card = screen.getByTestId('service-card');
      expect(card).toHaveClass('opacity-50');
    });
  });
});
