/**
 * Tests for DiscoveryFilters component.
 *
 * EP0016: Unified Discovery Experience (US0098)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DiscoveryFilters } from './DiscoveryFilters';
import type { SSHKeyMetadata } from '../types/scan';

const mockSshKeys: SSHKeyMetadata[] = [
  {
    id: 'key-1',
    name: 'default',
    fingerprint: 'SHA256:abc123',
    created_at: '2026-01-01T00:00:00Z',
    is_default: true,
    username: 'root',
  },
  {
    id: 'key-2',
    name: 'secondary',
    fingerprint: 'SHA256:def456',
    created_at: '2026-01-02T00:00:00Z',
    is_default: false,
    username: null,
  },
];

const defaultProps = {
  statusFilter: 'all' as const,
  onStatusFilterChange: vi.fn(),
  osFilter: 'all' as const,
  onOsFilterChange: vi.fn(),
  selectedKeyId: '',
  onKeyIdChange: vi.fn(),
  sshKeys: mockSshKeys,
  sshKeysLoading: false,
  showKeySelector: true,
  totalCount: 10,
  filteredCount: 10,
  availableCount: 5,
};

describe('DiscoveryFilters', () => {
  describe('status filter', () => {
    it('renders status filter dropdown', () => {
      render(<DiscoveryFilters {...defaultProps} />);

      expect(screen.getByLabelText('Status:')).toBeInTheDocument();
    });

    it('has all status options', () => {
      render(<DiscoveryFilters {...defaultProps} />);

      const select = screen.getByLabelText('Status:');
      expect(select).toHaveValue('all');

      // Check options
      const options = select.querySelectorAll('option');
      expect(options).toHaveLength(3);
      expect(options[0]).toHaveValue('all');
      expect(options[1]).toHaveValue('available');
      expect(options[2]).toHaveValue('unavailable');
    });

    it('calls onStatusFilterChange when changed', () => {
      const onStatusFilterChange = vi.fn();
      render(<DiscoveryFilters {...defaultProps} onStatusFilterChange={onStatusFilterChange} />);

      const select = screen.getByLabelText('Status:');
      fireEvent.change(select, { target: { value: 'available' } });

      expect(onStatusFilterChange).toHaveBeenCalledWith('available');
    });

    it('shows correct selected value', () => {
      render(<DiscoveryFilters {...defaultProps} statusFilter="unavailable" />);

      const select = screen.getByLabelText('Status:');
      expect(select).toHaveValue('unavailable');
    });
  });

  describe('OS filter', () => {
    it('renders OS filter dropdown', () => {
      render(<DiscoveryFilters {...defaultProps} />);

      expect(screen.getByLabelText('OS:')).toBeInTheDocument();
    });

    it('has all OS options', () => {
      render(<DiscoveryFilters {...defaultProps} />);

      const select = screen.getByLabelText('OS:');
      expect(select).toHaveValue('all');

      // Check options
      const options = select.querySelectorAll('option');
      expect(options).toHaveLength(5);
      expect(options[0]).toHaveValue('all');
      expect(options[1]).toHaveValue('linux');
      expect(options[2]).toHaveValue('windows');
      expect(options[3]).toHaveValue('macos');
      expect(options[4]).toHaveValue('other');
    });

    it('calls onOsFilterChange when changed', () => {
      const onOsFilterChange = vi.fn();
      render(<DiscoveryFilters {...defaultProps} onOsFilterChange={onOsFilterChange} />);

      const select = screen.getByLabelText('OS:');
      fireEvent.change(select, { target: { value: 'linux' } });

      expect(onOsFilterChange).toHaveBeenCalledWith('linux');
    });

    it('shows correct selected value', () => {
      render(<DiscoveryFilters {...defaultProps} osFilter="windows" />);

      const select = screen.getByLabelText('OS:');
      expect(select).toHaveValue('windows');
    });
  });

  describe('SSH key selector', () => {
    it('renders SSH key selector when showKeySelector is true', () => {
      render(<DiscoveryFilters {...defaultProps} showKeySelector={true} />);

      expect(screen.getByLabelText('SSH Key')).toBeInTheDocument();
    });

    it('hides SSH key selector when showKeySelector is false', () => {
      render(<DiscoveryFilters {...defaultProps} showKeySelector={false} />);

      expect(screen.queryByLabelText('SSH Key')).not.toBeInTheDocument();
    });

    it('shows SSH keys in dropdown', () => {
      render(<DiscoveryFilters {...defaultProps} />);

      const select = screen.getByLabelText('SSH Key');
      const options = select.querySelectorAll('option');

      // First option is "Attempt all keys", plus 2 keys
      expect(options).toHaveLength(3);
      expect(options[0]).toHaveTextContent('Attempt all keys');
      expect(options[1]).toHaveTextContent('default (root)');
      expect(options[2]).toHaveTextContent('secondary (Default)');
    });

    it('calls onKeyIdChange when changed', () => {
      const onKeyIdChange = vi.fn();
      render(<DiscoveryFilters {...defaultProps} onKeyIdChange={onKeyIdChange} />);

      const select = screen.getByLabelText('SSH Key');
      fireEvent.change(select, { target: { value: 'key-1' } });

      expect(onKeyIdChange).toHaveBeenCalledWith('key-1');
    });

    it('disables selector when loading', () => {
      render(<DiscoveryFilters {...defaultProps} sshKeysLoading={true} />);

      const select = screen.getByLabelText('SSH Key');
      expect(select).toBeDisabled();
    });

    it('disables selector when no keys available', () => {
      render(<DiscoveryFilters {...defaultProps} sshKeys={[]} />);

      const select = screen.getByLabelText('SSH Key');
      expect(select).toBeDisabled();
    });

    it('shows no keys message when empty', () => {
      render(<DiscoveryFilters {...defaultProps} sshKeys={[]} />);

      expect(screen.getByText('No keys configured')).toBeInTheDocument();
    });

    it('does not show no keys message when loading', () => {
      render(<DiscoveryFilters {...defaultProps} sshKeys={[]} sshKeysLoading={true} />);

      expect(screen.queryByText('No keys configured')).not.toBeInTheDocument();
    });
  });

  describe('device count display', () => {
    it('shows total count when not filtered', () => {
      render(<DiscoveryFilters {...defaultProps} />);

      expect(screen.getByText(/10 devices found/)).toBeInTheDocument();
    });

    it('shows available count when not filtered', () => {
      render(<DiscoveryFilters {...defaultProps} />);

      expect(screen.getByText(/5 available/)).toBeInTheDocument();
    });

    it('shows filtered count when status filter active', () => {
      render(
        <DiscoveryFilters
          {...defaultProps}
          statusFilter="available"
          totalCount={10}
          filteredCount={5}
        />
      );

      expect(screen.getByText(/Showing 5 of 10 devices/)).toBeInTheDocument();
    });

    it('shows filtered count when OS filter active', () => {
      render(
        <DiscoveryFilters
          {...defaultProps}
          osFilter="linux"
          totalCount={10}
          filteredCount={7}
        />
      );

      expect(screen.getByText(/Showing 7 of 10 devices/)).toBeInTheDocument();
    });

    it('handles singular device correctly', () => {
      render(<DiscoveryFilters {...defaultProps} totalCount={1} filteredCount={1} />);

      expect(screen.getByText(/1 device found/)).toBeInTheDocument();
    });

    it('does not show available count indicator when zero', () => {
      render(<DiscoveryFilters {...defaultProps} availableCount={0} />);

      // Should not show "(X available)" text when availableCount is 0
      expect(screen.queryByText(/\(\d+ available\)/)).not.toBeInTheDocument();
    });
  });
});
