import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusLED } from './StatusLED';

describe('StatusLED (US0114: Accessible Status Indicators)', () => {
  describe('AC1: Online status indicator', () => {
    it('renders green filled circle with checkmark for online status', () => {
      render(<StatusLED status="online" />);
      const led = screen.getByRole('status');
      expect(led).toHaveClass('bg-green-500');
      expect(led).toHaveClass('rounded-full');
      expect(led).toHaveClass('animate-pulse-green');
    });

    it('has accessible label for online status', () => {
      render(<StatusLED status="online" />);
      const led = screen.getByRole('status');
      expect(led).toHaveAttribute('aria-label', 'Server status: online');
    });

    it('contains a checkmark icon', () => {
      render(<StatusLED status="online" />);
      const led = screen.getByRole('status');
      // Icon should be present as a child SVG
      const svg = led.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('AC2: Offline status indicator', () => {
    it('renders grey hollow circle for offline status (consistent for all devices)', () => {
      render(<StatusLED status="offline" />);
      const led = screen.getByRole('status');
      expect(led).toHaveClass('border-2');
      expect(led).toHaveClass('border-gray-400');
      expect(led).toHaveClass('bg-transparent');
      expect(led).toHaveClass('rounded-full');
    });

    it('has accessible label for offline status', () => {
      render(<StatusLED status="offline" />);
      const led = screen.getByRole('status');
      expect(led).toHaveAttribute('aria-label', 'Server status: offline');
    });

    it('offline servers and workstations have same styling', () => {
      const { rerender } = render(<StatusLED status="offline" isWorkstation={false} />);
      let led = screen.getByRole('status');
      expect(led).toHaveClass('border-gray-400');

      rerender(<StatusLED status="offline" isWorkstation={true} />);
      led = screen.getByRole('status');
      expect(led).toHaveClass('border-gray-400');
    });
  });

  describe('AC3: Critical status indicator', () => {
    it('renders red filled circle for critical state (online with alerts)', () => {
      render(<StatusLED status="online" activeAlertCount={2} />);
      const led = screen.getByRole('status');
      expect(led).toHaveClass('bg-red-500');
      expect(led).toHaveClass('rounded-full');
    });

    it('has accessible label showing alert count', () => {
      render(<StatusLED status="online" activeAlertCount={3} />);
      const led = screen.getByRole('status');
      expect(led).toHaveAttribute('aria-label', 'Server status: critical - 3 active alerts');
    });

    it('uses singular "alert" for count of 1', () => {
      render(<StatusLED status="online" activeAlertCount={1} />);
      const led = screen.getByRole('status');
      expect(led).toHaveAttribute('aria-label', 'Server status: critical - 1 active alert');
    });
  });

  describe('AC4: Paused status indicator', () => {
    it('renders hollow amber circle for paused status', () => {
      render(<StatusLED status="online" isPaused={true} />);
      const led = screen.getByRole('status');
      expect(led).toHaveClass('border-2');
      expect(led).toHaveClass('border-amber-500');
      expect(led).toHaveClass('bg-transparent');
    });

    it('has accessible label for paused status', () => {
      render(<StatusLED status="online" isPaused={true} />);
      const led = screen.getByRole('status');
      expect(led).toHaveAttribute('aria-label', 'Server status: paused');
    });

    it('paused takes precedence over online status', () => {
      render(<StatusLED status="online" isPaused={true} />);
      const led = screen.getByRole('status');
      expect(led).toHaveClass('border-amber-500');
      expect(led).not.toHaveClass('bg-green-500');
    });

    it('paused takes precedence over offline status', () => {
      render(<StatusLED status="offline" isPaused={true} />);
      const led = screen.getByRole('status');
      expect(led).toHaveClass('border-amber-500');
      expect(led).not.toHaveClass('border-gray-400');
    });

    it('paused takes precedence over critical state', () => {
      render(<StatusLED status="online" isPaused={true} activeAlertCount={5} />);
      const led = screen.getByRole('status');
      expect(led).toHaveClass('border-amber-500');
      expect(led).not.toHaveClass('bg-red-500');
      expect(led).toHaveAttribute('aria-label', 'Server status: paused');
    });
  });

  describe('AC5: Screen reader accessibility', () => {
    it('has role="status" for screen readers', () => {
      render(<StatusLED status="online" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('icon is hidden from screen readers', () => {
      render(<StatusLED status="online" />);
      const led = screen.getByRole('status');
      const svg = led.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    it('displays title prop when provided', () => {
      render(<StatusLED status="online" title="Server is healthy" />);
      const led = screen.getByRole('status');
      expect(led).toHaveAttribute('title', 'Server is healthy');
    });
  });

  describe('AC6: High contrast support', () => {
    it('uses sufficient contrast colours', () => {
      // Online: white icon on green background
      const { rerender } = render(<StatusLED status="online" />);
      let led = screen.getByRole('status');
      expect(led).toHaveClass('bg-green-500');
      expect(led.querySelector('svg')).toHaveClass('text-white');

      // Offline: grey border (hollow circle)
      rerender(<StatusLED status="offline" />);
      led = screen.getByRole('status');
      expect(led).toHaveClass('border-gray-400');
      expect(led.querySelector('svg')).toHaveClass('text-gray-400');
    });

    it('paused uses border instead of background for visibility', () => {
      render(<StatusLED status="online" isPaused={true} />);
      const led = screen.getByRole('status');
      expect(led).toHaveClass('border-2');
      expect(led).toHaveClass('bg-transparent');
    });
  });

  describe('Edge cases', () => {
    it('renders grey circle with help icon for unknown status', () => {
      render(<StatusLED status="unknown" />);
      const led = screen.getByRole('status');
      expect(led).toHaveClass('bg-gray-400');
      expect(led).toHaveAttribute('aria-label', 'Server status: unknown');
    });

    it('renders grey hollow circle for offline regardless of machine type', () => {
      // Both workstations and servers show the same offline indicator
      render(<StatusLED status="offline" isWorkstation={true} />);
      const led = screen.getByRole('status');
      expect(led).toHaveClass('border-2');
      expect(led).toHaveClass('border-gray-400');
      expect(led).toHaveClass('bg-transparent');
    });

    it('applies custom className', () => {
      render(<StatusLED status="online" className="custom-class" />);
      const led = screen.getByRole('status');
      expect(led).toHaveClass('custom-class');
    });

    it('has data-testid for testing', () => {
      render(<StatusLED status="online" />);
      expect(screen.getByTestId('status-led')).toBeInTheDocument();
    });
  });

  describe('Size requirements', () => {
    it('has 20px dimensions for icon visibility', () => {
      render(<StatusLED status="online" />);
      const led = screen.getByRole('status');
      expect(led).toHaveClass('w-5');
      expect(led).toHaveClass('h-5');
    });

    it('icon has 12px dimensions', () => {
      render(<StatusLED status="online" />);
      const led = screen.getByRole('status');
      const svg = led.querySelector('svg');
      expect(svg).toHaveClass('w-3');
      expect(svg).toHaveClass('h-3');
    });
  });
});
