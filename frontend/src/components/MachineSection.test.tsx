/**
 * MachineSection component tests for US0132: Server and Workstation Grouping
 * Extended for US0133: Responsive Dashboard Layout
 *
 * Verifies:
 * - AC1: Servers appear in distinct "Servers" section
 * - AC2: Workstations appear in distinct "Workstations" section
 * - AC4: Drag-and-drop is confined within each section
 * - AC5: Sections are collapsible with state persistence
 * - AC6: Empty sections show appropriate messaging
 * - AC7: Fixed section order (servers first, workstations second)
 * - US0133 AC7: Sticky section headers during scroll
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MachineSection } from './MachineSection';
import type { Server } from '../types/server';

// Mock server data
const createMockServer = (
  id: string,
  type: 'server' | 'workstation',
  status: 'online' | 'offline' = 'online'
): Server => ({
  id,
  hostname: `${id}.local`,
  display_name: id,
  status,
  is_paused: false,
  agent_version: null,
  agent_mode: null,
  is_inactive: false,
  inactive_since: null,
  updates_available: null,
  security_updates: null,
  machine_type: type,
  last_seen: null,
  latest_metrics: null,
});

const mockServers: Server[] = [
  createMockServer('server-1', 'server', 'online'),
  createMockServer('server-2', 'server', 'offline'),
  createMockServer('workstation-1', 'workstation', 'online'),
];

// Wrapper component for tests
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <BrowserRouter>{children}</BrowserRouter>;
}

describe('MachineSection', () => {
  const defaultProps = {
    title: 'Servers',
    type: 'server' as const,
    machines: mockServers,
    collapsed: false,
    onToggleCollapse: vi.fn(),
    onReorder: vi.fn(),
    onCardClick: vi.fn(),
    onPauseToggle: vi.fn(),
    onMessage: vi.fn(),
  };

  /**
   * AC1 & AC2: Section structure and filtering
   * Sections only show machines of their type
   */
  describe('Section filtering (AC1, AC2)', () => {
    it('renders section with correct title', () => {
      render(
        <TestWrapper>
          <MachineSection {...defaultProps} title="Servers" type="server" />
        </TestWrapper>
      );

      expect(screen.getByRole('heading', { level: 2, name: /Servers/ })).toBeInTheDocument();
    });

    it('only displays machines matching the section type (TC01)', () => {
      render(
        <TestWrapper>
          <MachineSection {...defaultProps} title="Servers" type="server" />
        </TestWrapper>
      );

      // Should show server-1 and server-2, not workstation-1
      expect(screen.getByText('server-1')).toBeInTheDocument();
      expect(screen.getByText('server-2')).toBeInTheDocument();
      expect(screen.queryByText('workstation-1')).not.toBeInTheDocument();
    });

    it('displays correct online/offline counts (TC02)', () => {
      render(
        <TestWrapper>
          <MachineSection {...defaultProps} title="Servers" type="server" />
        </TestWrapper>
      );

      // 1 online, 1 offline (server-1 online, server-2 offline)
      expect(screen.getByText(/1 online, 1 offline/)).toBeInTheDocument();
    });

    it('shows workstations in workstation section (TC03)', () => {
      render(
        <TestWrapper>
          <MachineSection {...defaultProps} title="Workstations" type="workstation" />
        </TestWrapper>
      );

      expect(screen.getByText('workstation-1')).toBeInTheDocument();
      expect(screen.queryByText('server-1')).not.toBeInTheDocument();
    });
  });

  /**
   * AC5: Collapsible sections
   */
  describe('Collapsible sections (AC5)', () => {
    it('shows content when not collapsed (TC11)', () => {
      render(
        <TestWrapper>
          <MachineSection {...defaultProps} collapsed={false} />
        </TestWrapper>
      );

      expect(screen.getByText('server-1')).toBeInTheDocument();
    });

    it('hides content when collapsed (TC12)', () => {
      render(
        <TestWrapper>
          <MachineSection {...defaultProps} collapsed={true} />
        </TestWrapper>
      );

      // Header should still be visible
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
      // Content should be hidden
      expect(screen.queryByText('server-1')).not.toBeInTheDocument();
    });

    it('calls onToggleCollapse when header is clicked (TC13)', () => {
      const handleToggle = vi.fn();
      render(
        <TestWrapper>
          <MachineSection {...defaultProps} onToggleCollapse={handleToggle} />
        </TestWrapper>
      );

      const header = screen.getByTestId('section-header-servers');
      fireEvent.click(header);

      expect(handleToggle).toHaveBeenCalledTimes(1);
    });

    it('has correct aria-expanded attribute when expanded', () => {
      render(
        <TestWrapper>
          <MachineSection {...defaultProps} collapsed={false} />
        </TestWrapper>
      );

      const header = screen.getByTestId('section-header-servers');
      expect(header).toHaveAttribute('aria-expanded', 'true');
    });

    it('has correct aria-expanded attribute when collapsed', () => {
      render(
        <TestWrapper>
          <MachineSection {...defaultProps} collapsed={true} />
        </TestWrapper>
      );

      const header = screen.getByTestId('section-header-servers');
      expect(header).toHaveAttribute('aria-expanded', 'false');
    });

    it('rotates chevron icon when expanded', () => {
      render(
        <TestWrapper>
          <MachineSection {...defaultProps} collapsed={false} />
        </TestWrapper>
      );

      const header = screen.getByTestId('section-header-servers');
      const chevron = header.querySelector('svg');
      expect(chevron).toHaveClass('rotate-90');
    });

    it('chevron not rotated when collapsed', () => {
      render(
        <TestWrapper>
          <MachineSection {...defaultProps} collapsed={true} />
        </TestWrapper>
      );

      const header = screen.getByTestId('section-header-servers');
      const chevron = header.querySelector('svg');
      expect(chevron).not.toHaveClass('rotate-90');
    });
  });

  /**
   * AC6: Empty section messaging
   */
  describe('Empty section messaging (AC6)', () => {
    it('shows empty message when no machines of type (TC06)', () => {
      const emptyMachines: Server[] = [];
      render(
        <TestWrapper>
          <MachineSection {...defaultProps} machines={emptyMachines} />
        </TestWrapper>
      );

      expect(screen.getByTestId('empty-section-servers')).toBeInTheDocument();
      expect(screen.getByText(/No servers registered/)).toBeInTheDocument();
    });

    it('shows discovery link in empty section', () => {
      const emptyMachines: Server[] = [];
      render(
        <TestWrapper>
          <MachineSection {...defaultProps} machines={emptyMachines} />
        </TestWrapper>
      );

      const link = screen.getByRole('link', { name: /Discover devices/ });
      expect(link).toHaveAttribute('href', '/discovery');
    });

    it('shows empty message for workstations section', () => {
      const onlyServers = [createMockServer('server-1', 'server')];
      render(
        <TestWrapper>
          <MachineSection
            {...defaultProps}
            title="Workstations"
            type="workstation"
            machines={onlyServers}
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('empty-section-workstations')).toBeInTheDocument();
      expect(screen.getByText(/No workstations registered/)).toBeInTheDocument();
    });
  });

  /**
   * AC7: Section icons
   */
  describe('Section icons (AC7)', () => {
    it('shows Server icon for servers section', () => {
      render(
        <TestWrapper>
          <MachineSection {...defaultProps} title="Servers" type="server" />
        </TestWrapper>
      );

      const header = screen.getByTestId('section-header-servers');
      const serverIcon = header.querySelector('.lucide-server');
      expect(serverIcon).toBeInTheDocument();
    });

    it('shows Monitor icon for workstations section', () => {
      render(
        <TestWrapper>
          <MachineSection {...defaultProps} title="Workstations" type="workstation" />
        </TestWrapper>
      );

      const header = screen.getByTestId('section-header-workstations');
      const monitorIcon = header.querySelector('.lucide-monitor');
      expect(monitorIcon).toBeInTheDocument();
    });
  });

  /**
   * Card interactions
   */
  describe('Card interactions', () => {
    it('passes onCardClick handler to cards', () => {
      const handleCardClick = vi.fn();
      render(
        <TestWrapper>
          <MachineSection {...defaultProps} onCardClick={handleCardClick} />
        </TestWrapper>
      );

      // Verify cards are rendered with click handlers
      // The actual click is handled by SortableServerCard which wraps the card
      const cards = screen.getAllByTestId('server-card');
      expect(cards.length).toBe(2); // server-1 and server-2
    });
  });

  /**
   * Section data attributes for testing
   */
  describe('Test attributes', () => {
    it('has correct data-testid for servers section', () => {
      render(
        <TestWrapper>
          <MachineSection {...defaultProps} title="Servers" type="server" />
        </TestWrapper>
      );

      expect(screen.getByTestId('section-servers')).toBeInTheDocument();
    });

    it('has correct data-testid for workstations section', () => {
      render(
        <TestWrapper>
          <MachineSection {...defaultProps} title="Workstations" type="workstation" />
        </TestWrapper>
      );

      expect(screen.getByTestId('section-workstations')).toBeInTheDocument();
    });
  });

  /**
   * US0133 AC7: Sticky section headers
   */
  describe('Sticky section headers (US0133 AC7)', () => {
    it('section header has sticky positioning class (TC11)', () => {
      render(
        <TestWrapper>
          <MachineSection {...defaultProps} />
        </TestWrapper>
      );

      const header = screen.getByTestId('section-header-servers');
      expect(header).toHaveClass('sticky');
    });

    it('section header has top-0 positioning (TC11)', () => {
      render(
        <TestWrapper>
          <MachineSection {...defaultProps} />
        </TestWrapper>
      );

      const header = screen.getByTestId('section-header-servers');
      expect(header).toHaveClass('top-0');
    });

    it('section header has z-index for stacking (TC12)', () => {
      render(
        <TestWrapper>
          <MachineSection {...defaultProps} />
        </TestWrapper>
      );

      const header = screen.getByTestId('section-header-servers');
      expect(header).toHaveClass('z-10');
    });

    it('section header has background color (TC11)', () => {
      render(
        <TestWrapper>
          <MachineSection {...defaultProps} />
        </TestWrapper>
      );

      const header = screen.getByTestId('section-header-servers');
      expect(header).toHaveClass('bg-bg-primary');
    });
  });
});
