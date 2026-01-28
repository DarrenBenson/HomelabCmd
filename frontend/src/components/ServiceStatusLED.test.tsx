import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ServiceStatusLED } from './ServiceStatusLED';

describe('ServiceStatusLED', () => {
  it('renders green with pulse animation for running status', () => {
    render(<ServiceStatusLED status="running" />);
    const led = screen.getByRole('status');
    expect(led).toHaveClass('bg-status-success');
    expect(led).toHaveClass('animate-pulse-green');
  });

  it('renders red with glow for stopped status', () => {
    render(<ServiceStatusLED status="stopped" />);
    const led = screen.getByRole('status');
    expect(led).toHaveClass('bg-status-error');
  });

  it('renders red with glow for failed status', () => {
    render(<ServiceStatusLED status="failed" />);
    const led = screen.getByRole('status');
    expect(led).toHaveClass('bg-status-error');
  });

  it('renders muted for unknown status', () => {
    render(<ServiceStatusLED status="unknown" />);
    const led = screen.getByRole('status');
    expect(led).toHaveClass('bg-text-muted');
  });

  it('has accessible label', () => {
    render(<ServiceStatusLED status="running" />);
    const led = screen.getByRole('status');
    expect(led).toHaveAttribute('aria-label', 'Service status: running');
  });

  it('applies custom className', () => {
    render(<ServiceStatusLED status="running" className="test-class" />);
    const led = screen.getByRole('status');
    expect(led).toHaveClass('test-class');
  });
});
