import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Gauge } from './Gauge';

describe('Gauge', () => {
  it('renders with a value and label', () => {
    render(<Gauge value={50} label="CPU" />);

    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('CPU')).toBeInTheDocument();
  });

  it('renders "--" when value is null', () => {
    render(<Gauge value={null} label="RAM" />);

    expect(screen.getByTestId('gauge-ram-value')).toHaveTextContent('--');
  });

  it('displays absoluteValue when provided', () => {
    render(<Gauge value={67} label="RAM" absoluteValue="11/16 GB" />);

    expect(screen.getByText('11/16 GB')).toBeInTheDocument();
  });

  it('has correct aria attributes', () => {
    render(<Gauge value={75} label="Disk" />);

    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuenow', '75');
    expect(meter).toHaveAttribute('aria-valuemin', '0');
    expect(meter).toHaveAttribute('aria-valuemax', '100');
    expect(meter).toHaveAttribute('aria-label', 'Disk: 75%');
  });

  it('has correct aria-label for null value', () => {
    render(<Gauge value={null} label="CPU" />);

    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-label', 'CPU: No data');
  });

  it('clamps values to 0-100 range', () => {
    const { rerender } = render(<Gauge value={-10} label="Test" />);
    expect(screen.getByTestId('gauge-test-value')).toHaveTextContent('0%');

    rerender(<Gauge value={150} label="Test" />);
    expect(screen.getByTestId('gauge-test-value')).toHaveTextContent('100%');
  });

  it('applies green colour class at low values', () => {
    render(<Gauge value={50} label="CPU" />);

    const value = screen.getByTestId('gauge-cpu-value');
    expect(value).toHaveClass('text-status-success');
  });

  it('applies amber colour class at warning threshold (70-85%)', () => {
    render(<Gauge value={75} label="CPU" />);

    const value = screen.getByTestId('gauge-cpu-value');
    expect(value).toHaveClass('text-status-warning');
  });

  it('applies red colour class at critical threshold (85%+)', () => {
    render(<Gauge value={90} label="CPU" />);

    const value = screen.getByTestId('gauge-cpu-value');
    expect(value).toHaveClass('text-status-error');
  });

  it('applies muted colour class for null value', () => {
    render(<Gauge value={null} label="CPU" />);

    const value = screen.getByTestId('gauge-cpu-value');
    expect(value).toHaveClass('text-text-muted');
  });

  it('applies green at boundary (69%)', () => {
    render(<Gauge value={69} label="Test" />);
    expect(screen.getByTestId('gauge-test-value')).toHaveClass('text-status-success');
  });

  it('applies amber at boundary (70%)', () => {
    render(<Gauge value={70} label="Test" />);
    expect(screen.getByTestId('gauge-test-value')).toHaveClass('text-status-warning');
  });

  it('applies amber at boundary (84%)', () => {
    render(<Gauge value={84} label="Test" />);
    expect(screen.getByTestId('gauge-test-value')).toHaveClass('text-status-warning');
  });

  it('applies red at boundary (85%)', () => {
    render(<Gauge value={85} label="Test" />);
    expect(screen.getByTestId('gauge-test-value')).toHaveClass('text-status-error');
  });

  it('renders with custom className', () => {
    render(<Gauge value={50} label="CPU" className="custom-class" />);

    const meter = screen.getByRole('meter');
    expect(meter).toHaveClass('custom-class');
  });

  it('renders SVG elements', () => {
    render(<Gauge value={50} label="CPU" />);

    // Check that the SVG container exists
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();

    // Check that circles exist (background track and value arc)
    const circles = document.querySelectorAll('circle');
    expect(circles.length).toBe(2);
  });
});
