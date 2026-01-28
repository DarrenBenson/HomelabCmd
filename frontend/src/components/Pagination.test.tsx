import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  const defaultProps = {
    currentPage: 1,
    totalPages: 5,
    totalItems: 100,
    pageSize: 20,
    onPageChange: vi.fn(),
  };

  describe('Display', () => {
    it('renders pagination info', () => {
      render(<Pagination {...defaultProps} />);

      expect(screen.getByTestId('pagination-info')).toHaveTextContent('Showing 1-20 of 100 items');
    });

    it('renders correct range for middle page', () => {
      render(<Pagination {...defaultProps} currentPage={3} />);

      expect(screen.getByTestId('pagination-info')).toHaveTextContent('Showing 41-60 of 100 items');
    });

    it('renders correct range for last page with partial items', () => {
      render(<Pagination {...defaultProps} currentPage={5} totalItems={95} />);

      expect(screen.getByTestId('pagination-info')).toHaveTextContent('Showing 81-95 of 95 items');
    });

    it('renders previous button', () => {
      render(<Pagination {...defaultProps} />);

      expect(screen.getByTestId('pagination-prev')).toBeInTheDocument();
    });

    it('renders next button', () => {
      render(<Pagination {...defaultProps} />);

      expect(screen.getByTestId('pagination-next')).toBeInTheDocument();
    });

    it('renders page numbers', () => {
      render(<Pagination {...defaultProps} />);

      expect(screen.getByTestId('pagination-page-1')).toBeInTheDocument();
      expect(screen.getByTestId('pagination-page-2')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('disables previous button on first page', () => {
      render(<Pagination {...defaultProps} currentPage={1} />);

      expect(screen.getByTestId('pagination-prev')).toBeDisabled();
    });

    it('enables previous button on non-first page', () => {
      render(<Pagination {...defaultProps} currentPage={2} />);

      expect(screen.getByTestId('pagination-prev')).not.toBeDisabled();
    });

    it('disables next button on last page', () => {
      render(<Pagination {...defaultProps} currentPage={5} />);

      expect(screen.getByTestId('pagination-next')).toBeDisabled();
    });

    it('enables next button on non-last page', () => {
      render(<Pagination {...defaultProps} currentPage={1} />);

      expect(screen.getByTestId('pagination-next')).not.toBeDisabled();
    });

    it('calls onPageChange with previous page when prev clicked', () => {
      const onPageChange = vi.fn();
      render(<Pagination {...defaultProps} currentPage={3} onPageChange={onPageChange} />);

      fireEvent.click(screen.getByTestId('pagination-prev'));

      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('calls onPageChange with next page when next clicked', () => {
      const onPageChange = vi.fn();
      render(<Pagination {...defaultProps} currentPage={3} onPageChange={onPageChange} />);

      fireEvent.click(screen.getByTestId('pagination-next'));

      expect(onPageChange).toHaveBeenCalledWith(4);
    });

    it('calls onPageChange when page number clicked', () => {
      const onPageChange = vi.fn();
      render(<Pagination {...defaultProps} onPageChange={onPageChange} />);

      fireEvent.click(screen.getByTestId('pagination-page-3'));

      expect(onPageChange).toHaveBeenCalledWith(3);
    });
  });

  describe('Current page styling', () => {
    it('highlights current page', () => {
      render(<Pagination {...defaultProps} currentPage={3} />);

      const currentPageButton = screen.getByTestId('pagination-page-3');
      expect(currentPageButton).toHaveAttribute('aria-current', 'page');
    });

    it('does not highlight non-current pages', () => {
      render(<Pagination {...defaultProps} currentPage={3} />);

      const otherPageButton = screen.getByTestId('pagination-page-2');
      expect(otherPageButton).not.toHaveAttribute('aria-current');
    });
  });

  describe('Ellipsis handling', () => {
    it('shows ellipsis for many pages when on first page', () => {
      render(<Pagination {...defaultProps} totalPages={10} currentPage={1} />);

      const ellipsis = screen.getAllByText('...');
      expect(ellipsis.length).toBeGreaterThanOrEqual(1);
    });

    it('shows ellipsis on both sides when on middle page', () => {
      render(<Pagination {...defaultProps} totalPages={10} currentPage={5} />);

      const ellipsis = screen.getAllByText('...');
      expect(ellipsis.length).toBe(2);
    });

    it('always shows first and last page', () => {
      render(<Pagination {...defaultProps} totalPages={10} currentPage={5} />);

      expect(screen.getByTestId('pagination-page-1')).toBeInTheDocument();
      expect(screen.getByTestId('pagination-page-10')).toBeInTheDocument();
    });
  });

  describe('Few pages', () => {
    it('shows all pages when 5 or fewer', () => {
      render(<Pagination {...defaultProps} totalPages={5} />);

      expect(screen.getByTestId('pagination-page-1')).toBeInTheDocument();
      expect(screen.getByTestId('pagination-page-2')).toBeInTheDocument();
      expect(screen.getByTestId('pagination-page-3')).toBeInTheDocument();
      expect(screen.getByTestId('pagination-page-4')).toBeInTheDocument();
      expect(screen.getByTestId('pagination-page-5')).toBeInTheDocument();
    });

    it('does not show ellipsis for few pages', () => {
      render(<Pagination {...defaultProps} totalPages={3} />);

      expect(screen.queryByText('...')).not.toBeInTheDocument();
    });
  });

  describe('Single page', () => {
    it('disables both buttons for single page', () => {
      render(<Pagination {...defaultProps} totalPages={1} currentPage={1} />);

      expect(screen.getByTestId('pagination-prev')).toBeDisabled();
      expect(screen.getByTestId('pagination-next')).toBeDisabled();
    });
  });
});
