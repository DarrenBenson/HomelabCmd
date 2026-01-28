import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusLED } from './StatusLED';

describe('StatusLED', () => {
  it('renders green with pulse animation for online status', () => {
    render(<StatusLED status="online" />);
    const led = screen.getByRole('status');
    expect(led).toHaveClass('bg-status-success');
    expect(led).toHaveClass('animate-pulse-green');
  });

  it('renders red with glow for offline status', () => {
    render(<StatusLED status="offline" />);
    const led = screen.getByRole('status');
    expect(led).toHaveClass('bg-status-error');
  });

  it('renders muted for unknown status', () => {
    render(<StatusLED status="unknown" />);
    const led = screen.getByRole('status');
    expect(led).toHaveClass('bg-text-muted');
  });

  it('has accessible label', () => {
    render(<StatusLED status="online" />);
    const led = screen.getByRole('status');
    expect(led).toHaveAttribute('aria-label', 'Server status: online');
  });

  it('applies custom className', () => {
    render(<StatusLED status="online" className="test-class" />);
    const led = screen.getByRole('status');
    expect(led).toHaveClass('test-class');
  });
});
