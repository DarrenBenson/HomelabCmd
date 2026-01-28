import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MachineTypeIcon } from './MachineTypeIcon';

/**
 * MachineTypeIcon component tests (US0091)
 * Spec Reference: sdlc-studio/stories/US0091-visual-distinction-workstations.md
 *
 * AC1: Machine type icons - Server icon for servers, Monitor icon for workstations
 * AC5: Hover tooltip - Full machine type description on hover
 */
describe('MachineTypeIcon (US0091)', () => {
  describe('AC1: Machine type icons', () => {
    it('renders Server icon for server type (TC-US0091-01)', () => {
      render(<MachineTypeIcon type="server" />);

      // Server icon from lucide-react has class "lucide-server"
      const icon = screen.getByTestId('machine-type-icon');
      expect(icon).toBeInTheDocument();
      expect(icon.querySelector('.lucide-server')).toBeInTheDocument();
    });

    it('renders Monitor icon for workstation type (TC-US0091-02)', () => {
      render(<MachineTypeIcon type="workstation" />);

      // Monitor icon from lucide-react has class "lucide-monitor"
      const icon = screen.getByTestId('machine-type-icon');
      expect(icon).toBeInTheDocument();
      expect(icon.querySelector('.lucide-monitor')).toBeInTheDocument();
    });

    it('applies default size class h-4 w-4', () => {
      render(<MachineTypeIcon type="server" />);

      const icon = screen.getByTestId('machine-type-icon');
      const svg = icon.querySelector('svg');
      expect(svg).toHaveClass('h-4');
      expect(svg).toHaveClass('w-4');
    });

    it('applies custom className when provided', () => {
      render(<MachineTypeIcon type="server" className="h-6 w-6 text-blue-500" />);

      const icon = screen.getByTestId('machine-type-icon');
      const svg = icon.querySelector('svg');
      expect(svg).toHaveClass('h-6');
      expect(svg).toHaveClass('w-6');
      expect(svg).toHaveClass('text-blue-500');
    });
  });

  describe('AC5: Hover tooltip', () => {
    it('shows tooltip title for server icon (TC-US0091-08)', () => {
      render(
        <MachineTypeIcon type="server" title="Server - 24/7 uptime expected" />
      );

      const icon = screen.getByTestId('machine-type-icon');
      expect(icon).toHaveAttribute('title', 'Server - 24/7 uptime expected');
    });

    it('shows tooltip title for workstation icon (TC-US0091-08)', () => {
      render(
        <MachineTypeIcon
          type="workstation"
          title="Workstation - intermittent availability expected"
        />
      );

      const icon = screen.getByTestId('machine-type-icon');
      expect(icon).toHaveAttribute(
        'title',
        'Workstation - intermittent availability expected'
      );
    });

    it('does not have title attribute when not provided', () => {
      render(<MachineTypeIcon type="server" />);

      const icon = screen.getByTestId('machine-type-icon');
      expect(icon).not.toHaveAttribute('title');
    });
  });
});
