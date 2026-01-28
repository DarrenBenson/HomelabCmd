import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterChip } from './FilterChip';

describe('FilterChip', () => {
  const defaultProps = {
    label: 'Test',
    active: false,
    onClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders label text', () => {
    render(<FilterChip {...defaultProps} label="Online" />);

    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<FilterChip {...defaultProps} onClick={onClick} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('calls onClick on Enter key', () => {
    const onClick = vi.fn();
    render(<FilterChip {...defaultProps} onClick={onClick} />);

    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('calls onClick on Space key', () => {
    const onClick = vi.fn();
    render(<FilterChip {...defaultProps} onClick={onClick} />);

    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick on other keys', () => {
    const onClick = vi.fn();
    render(<FilterChip {...defaultProps} onClick={onClick} />);

    fireEvent.keyDown(screen.getByRole('button'), { key: 'Tab' });

    expect(onClick).not.toHaveBeenCalled();
  });

  it('shows aria-pressed=true when active', () => {
    render(<FilterChip {...defaultProps} active={true} />);

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows aria-pressed=false when inactive', () => {
    render(<FilterChip {...defaultProps} active={false} />);

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('applies active styling when active', () => {
    render(<FilterChip {...defaultProps} active={true} />);

    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-status-info');
  });

  it('applies inactive styling when not active', () => {
    render(<FilterChip {...defaultProps} active={false} />);

    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-bg-secondary');
  });

  it('renders with test ID when provided', () => {
    render(<FilterChip {...defaultProps} testId="test-chip" />);

    expect(screen.getByTestId('test-chip')).toBeInTheDocument();
  });

  describe('Count badge', () => {
    it('shows count when provided and > 0', () => {
      render(<FilterChip {...defaultProps} count={5} />);

      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('does not show count when 0', () => {
      render(<FilterChip {...defaultProps} count={0} />);

      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('does not show count when undefined', () => {
      render(<FilterChip {...defaultProps} />);

      // Only the label should be present
      const button = screen.getByRole('button');
      expect(button.textContent).toBe('Test');
    });
  });
});
