import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardFilters } from './DashboardFilters';
import type { StatusFilter, TypeFilter } from './DashboardFilters';

describe('DashboardFilters', () => {
  const defaultProps = {
    searchQuery: '',
    onSearchChange: vi.fn(),
    statusFilter: 'all' as StatusFilter,
    onStatusChange: vi.fn(),
    typeFilter: 'all' as TypeFilter,
    onTypeChange: vi.fn(),
    onClear: vi.fn(),
    hasActiveFilters: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Search box (AC1)', () => {
    it('renders search input with placeholder', () => {
      render(<DashboardFilters {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');
      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toHaveAttribute('placeholder', 'Search servers...');
    });

    it('renders search icon', () => {
      render(<DashboardFilters {...defaultProps} />);

      // Search icon is rendered with aria-hidden
      const container = screen.getByTestId('dashboard-filters');
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('displays current search query', () => {
      render(<DashboardFilters {...defaultProps} searchQuery="media" />);

      const searchInput = screen.getByTestId('search-input');
      expect(searchInput).toHaveValue('media');
    });

    it('calls onSearchChange when typing', () => {
      const onSearchChange = vi.fn();
      render(<DashboardFilters {...defaultProps} onSearchChange={onSearchChange} />);

      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'plex' } });

      expect(onSearchChange).toHaveBeenCalledWith('plex');
    });

    it('clears search on Escape key', () => {
      const onSearchChange = vi.fn();
      render(
        <DashboardFilters {...defaultProps} searchQuery="test" onSearchChange={onSearchChange} />
      );

      const searchInput = screen.getByTestId('search-input');
      fireEvent.keyDown(searchInput, { key: 'Escape' });

      expect(onSearchChange).toHaveBeenCalledWith('');
    });

    it('shows clear button when search has text', () => {
      render(<DashboardFilters {...defaultProps} searchQuery="test" />);

      expect(screen.getByTestId('clear-search-button')).toBeInTheDocument();
    });

    it('does not show clear button when search is empty', () => {
      render(<DashboardFilters {...defaultProps} searchQuery="" />);

      expect(screen.queryByTestId('clear-search-button')).not.toBeInTheDocument();
    });

    it('clears search when clear button clicked', () => {
      const onSearchChange = vi.fn();
      render(
        <DashboardFilters {...defaultProps} searchQuery="test" onSearchChange={onSearchChange} />
      );

      fireEvent.click(screen.getByTestId('clear-search-button'));

      expect(onSearchChange).toHaveBeenCalledWith('');
    });
  });

  describe('Status filter chips (AC3)', () => {
    it('renders all status filter chips', () => {
      render(<DashboardFilters {...defaultProps} />);

      expect(screen.getByTestId('status-filter-all')).toBeInTheDocument();
      expect(screen.getByTestId('status-filter-online')).toBeInTheDocument();
      expect(screen.getByTestId('status-filter-offline')).toBeInTheDocument();
      expect(screen.getByTestId('status-filter-warning')).toBeInTheDocument();
      expect(screen.getByTestId('status-filter-paused')).toBeInTheDocument();
    });

    it('shows "All" as active by default', () => {
      render(<DashboardFilters {...defaultProps} statusFilter="all" />);

      const allChip = screen.getByTestId('status-filter-all');
      expect(allChip).toHaveAttribute('aria-pressed', 'true');
    });

    it('calls onStatusChange when chip clicked', () => {
      const onStatusChange = vi.fn();
      render(<DashboardFilters {...defaultProps} onStatusChange={onStatusChange} />);

      fireEvent.click(screen.getByTestId('status-filter-online'));

      expect(onStatusChange).toHaveBeenCalledWith('online');
    });

    it('shows correct chip as active', () => {
      render(<DashboardFilters {...defaultProps} statusFilter="warning" />);

      expect(screen.getByTestId('status-filter-all')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByTestId('status-filter-warning')).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('Type filter chips (AC4)', () => {
    it('renders all type filter chips', () => {
      render(<DashboardFilters {...defaultProps} />);

      expect(screen.getByTestId('type-filter-all')).toBeInTheDocument();
      expect(screen.getByTestId('type-filter-server')).toBeInTheDocument();
      expect(screen.getByTestId('type-filter-workstation')).toBeInTheDocument();
    });

    it('shows "All Types" as active by default', () => {
      render(<DashboardFilters {...defaultProps} typeFilter="all" />);

      const allChip = screen.getByTestId('type-filter-all');
      expect(allChip).toHaveAttribute('aria-pressed', 'true');
    });

    it('calls onTypeChange when chip clicked', () => {
      const onTypeChange = vi.fn();
      render(<DashboardFilters {...defaultProps} onTypeChange={onTypeChange} />);

      fireEvent.click(screen.getByTestId('type-filter-server'));

      expect(onTypeChange).toHaveBeenCalledWith('server');
    });
  });

  describe('Clear filters (AC6)', () => {
    it('does not show clear button when no filters active', () => {
      render(<DashboardFilters {...defaultProps} hasActiveFilters={false} />);

      expect(screen.queryByTestId('clear-filters-button')).not.toBeInTheDocument();
    });

    it('shows clear button when filters are active', () => {
      render(<DashboardFilters {...defaultProps} hasActiveFilters={true} />);

      expect(screen.getByTestId('clear-filters-button')).toBeInTheDocument();
    });

    it('calls onClear when clear button clicked', () => {
      const onClear = vi.fn();
      render(<DashboardFilters {...defaultProps} hasActiveFilters={true} onClear={onClear} />);

      fireEvent.click(screen.getByTestId('clear-filters-button'));

      expect(onClear).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has accessible search input label', () => {
      render(<DashboardFilters {...defaultProps} />);

      const searchInput = screen.getByLabelText('Search servers');
      expect(searchInput).toBeInTheDocument();
    });

    it('has accessible clear search button', () => {
      render(<DashboardFilters {...defaultProps} searchQuery="test" />);

      const clearButton = screen.getByLabelText('Clear search');
      expect(clearButton).toBeInTheDocument();
    });

    it('has role="group" for filter sections', () => {
      render(<DashboardFilters {...defaultProps} />);

      const groups = screen.getAllByRole('group');
      expect(groups.length).toBeGreaterThanOrEqual(2);
    });
  });
});
