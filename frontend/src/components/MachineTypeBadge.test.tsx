import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MachineTypeBadge } from './MachineTypeBadge';

/**
 * MachineTypeBadge component tests (US0091, US0135)
 * Spec Reference: sdlc-studio/stories/US0091-visual-distinction-workstations.md
 * Spec Reference: sdlc-studio/stories/US0135-card-visual-enhancements.md
 *
 * AC2: Type badges - "Server" or "Workstation" badge on each card
 * AC5: Hover tooltip - Full machine type description on hover
 * US0135 AC7: Dark mode support with accessible colours
 */
describe('MachineTypeBadge (US0091, US0135)', () => {
  describe('AC2: Type badges', () => {
    it('displays "Server" text for server type (TC-US0091-03)', () => {
      render(<MachineTypeBadge type="server" />);

      const badge = screen.getByTestId('machine-type-badge');
      expect(badge).toHaveTextContent('Server');
    });

    it('displays "Workstation" text for workstation type (TC-US0091-04)', () => {
      render(<MachineTypeBadge type="workstation" />);

      const badge = screen.getByTestId('machine-type-badge');
      expect(badge).toHaveTextContent('Workstation');
    });

    it('applies blue styling for server badge (TC-US0091-03)', () => {
      render(<MachineTypeBadge type="server" />);

      const badge = screen.getByTestId('machine-type-badge');
      expect(badge).toHaveClass('bg-blue-100');
      expect(badge).toHaveClass('text-blue-800');
      expect(badge).toHaveClass('border-blue-200');
    });

    it('applies purple styling for workstation badge (TC-US0091-04)', () => {
      render(<MachineTypeBadge type="workstation" />);

      const badge = screen.getByTestId('machine-type-badge');
      expect(badge).toHaveClass('bg-purple-100');
      expect(badge).toHaveClass('text-purple-800');
      expect(badge).toHaveClass('border-purple-200');
    });

    it('has pill-shaped styling with rounded-full', () => {
      render(<MachineTypeBadge type="server" />);

      const badge = screen.getByTestId('machine-type-badge');
      expect(badge).toHaveClass('rounded-full');
      expect(badge).toHaveClass('text-xs');
      expect(badge).toHaveClass('border');
    });
  });

  describe('AC5: Hover tooltip', () => {
    it('shows tooltip title for server badge (TC-US0091-08)', () => {
      render(
        <MachineTypeBadge type="server" title="Server - 24/7 uptime expected" />
      );

      const badge = screen.getByTestId('machine-type-badge');
      expect(badge).toHaveAttribute('title', 'Server - 24/7 uptime expected');
    });

    it('shows tooltip title for workstation badge (TC-US0091-08)', () => {
      render(
        <MachineTypeBadge
          type="workstation"
          title="Workstation - intermittent availability expected"
        />
      );

      const badge = screen.getByTestId('machine-type-badge');
      expect(badge).toHaveAttribute(
        'title',
        'Workstation - intermittent availability expected'
      );
    });

    it('does not have title attribute when not provided', () => {
      render(<MachineTypeBadge type="server" />);

      const badge = screen.getByTestId('machine-type-badge');
      expect(badge).not.toHaveAttribute('title');
    });
  });

  describe('US0135 AC7: Dark mode support', () => {
    it('server badge has dark mode colour classes (TC09)', () => {
      render(<MachineTypeBadge type="server" />);

      const badge = screen.getByTestId('machine-type-badge');
      expect(badge).toHaveClass('dark:bg-blue-900/30');
      expect(badge).toHaveClass('dark:text-blue-300');
      expect(badge).toHaveClass('dark:border-blue-700');
    });

    it('workstation badge has dark mode colour classes (TC10)', () => {
      render(<MachineTypeBadge type="workstation" />);

      const badge = screen.getByTestId('machine-type-badge');
      expect(badge).toHaveClass('dark:bg-purple-900/30');
      expect(badge).toHaveClass('dark:text-purple-300');
      expect(badge).toHaveClass('dark:border-purple-700');
    });
  });
});
