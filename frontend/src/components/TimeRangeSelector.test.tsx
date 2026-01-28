import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimeRangeSelector } from './TimeRangeSelector';

/**
 * TimeRangeSelector tests covering TSP0006 test specification.
 *
 * Test Cases: TC074 (US0007 Time range selection)
 * Spec Reference: sdlc-studio/testing/specs/TSP0006-server-detail-charts.md
 */

describe('TimeRangeSelector', () => {
  describe('Time range buttons visible (TC074)', () => {
    it('displays all four time range buttons', () => {
      const onChange = vi.fn();
      render(<TimeRangeSelector value="24h" onChange={onChange} />);

      expect(screen.getByTestId('range-24h')).toBeInTheDocument();
      expect(screen.getByTestId('range-7d')).toBeInTheDocument();
      expect(screen.getByTestId('range-30d')).toBeInTheDocument();
      expect(screen.getByTestId('range-12m')).toBeInTheDocument();
    });

    it('shows correct labels for time ranges', () => {
      const onChange = vi.fn();
      render(<TimeRangeSelector value="24h" onChange={onChange} />);

      expect(screen.getByText('24h')).toBeInTheDocument();
      expect(screen.getByText('7d')).toBeInTheDocument();
      expect(screen.getByText('30d')).toBeInTheDocument();
      expect(screen.getByText('12m')).toBeInTheDocument();
    });
  });

  describe('Click updates active button (TC074)', () => {
    it('highlights selected range (24h)', () => {
      const onChange = vi.fn();
      render(<TimeRangeSelector value="24h" onChange={onChange} />);

      const button24h = screen.getByTestId('range-24h');
      expect(button24h).toHaveAttribute('aria-pressed', 'true');
      expect(button24h).toHaveClass('bg-status-info');
    });

    it('highlights selected range (7d)', () => {
      const onChange = vi.fn();
      render(<TimeRangeSelector value="7d" onChange={onChange} />);

      const button7d = screen.getByTestId('range-7d');
      expect(button7d).toHaveAttribute('aria-pressed', 'true');
      expect(button7d).toHaveClass('bg-status-info');
    });

    it('highlights selected range (30d)', () => {
      const onChange = vi.fn();
      render(<TimeRangeSelector value="30d" onChange={onChange} />);

      const button30d = screen.getByTestId('range-30d');
      expect(button30d).toHaveAttribute('aria-pressed', 'true');
      expect(button30d).toHaveClass('bg-status-info');
    });

    it('calls onChange when clicking different range', () => {
      const onChange = vi.fn();
      render(<TimeRangeSelector value="24h" onChange={onChange} />);

      fireEvent.click(screen.getByTestId('range-7d'));

      expect(onChange).toHaveBeenCalledWith('7d');
    });

    it('calls onChange with 30d when clicking 30d button', () => {
      const onChange = vi.fn();
      render(<TimeRangeSelector value="24h" onChange={onChange} />);

      fireEvent.click(screen.getByTestId('range-30d'));

      expect(onChange).toHaveBeenCalledWith('30d');
    });

    it('highlights selected range (12m)', () => {
      const onChange = vi.fn();
      render(<TimeRangeSelector value="12m" onChange={onChange} />);

      const button12m = screen.getByTestId('range-12m');
      expect(button12m).toHaveAttribute('aria-pressed', 'true');
      expect(button12m).toHaveClass('bg-status-info');
    });

    it('calls onChange with 12m when clicking 12m button', () => {
      const onChange = vi.fn();
      render(<TimeRangeSelector value="24h" onChange={onChange} />);

      fireEvent.click(screen.getByTestId('range-12m'));

      expect(onChange).toHaveBeenCalledWith('12m');
    });
  });

  describe('Disabled state', () => {
    it('disables all buttons when disabled prop is true', () => {
      const onChange = vi.fn();
      render(<TimeRangeSelector value="24h" onChange={onChange} disabled />);

      expect(screen.getByTestId('range-24h')).toBeDisabled();
      expect(screen.getByTestId('range-7d')).toBeDisabled();
      expect(screen.getByTestId('range-30d')).toBeDisabled();
      expect(screen.getByTestId('range-12m')).toBeDisabled();
    });

    it('does not call onChange when disabled', () => {
      const onChange = vi.fn();
      render(<TimeRangeSelector value="24h" onChange={onChange} disabled />);

      fireEvent.click(screen.getByTestId('range-7d'));

      expect(onChange).not.toHaveBeenCalled();
    });

    it('applies opacity styling when disabled', () => {
      const onChange = vi.fn();
      render(<TimeRangeSelector value="24h" onChange={onChange} disabled />);

      const button = screen.getByTestId('range-24h');
      expect(button).toHaveClass('opacity-50');
    });
  });

  describe('Selector container', () => {
    it('renders with test id', () => {
      const onChange = vi.fn();
      render(<TimeRangeSelector value="24h" onChange={onChange} />);

      expect(screen.getByTestId('time-range-selector')).toBeInTheDocument();
    });
  });
});
