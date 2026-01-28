import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ExportButton } from './ExportButton';

/**
 * ExportButton tests covering US0048 test specification.
 *
 * Test Cases: TC0048-101 to TC0048-108
 * Spec Reference: sdlc-studio/testing/specs/TSP0048-metrics-data-export.md
 */

describe('ExportButton', () => {
  const originalFetch = global.fetch;
  const mockFetch = vi.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Rendering (TC0048-101)', () => {
    it('renders export button', () => {
      render(<ExportButton serverId="mediaserver" timeRange="24h" />);

      expect(screen.getByTestId('export-button')).toBeInTheDocument();
      expect(screen.getByText('Export')).toBeInTheDocument();
    });

    it('renders dropdown arrow icon', () => {
      render(<ExportButton serverId="mediaserver" timeRange="24h" />);

      const button = screen.getByTestId('export-button');
      expect(button.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Dropdown behaviour (TC0048-102)', () => {
    it('opens dropdown when clicked', () => {
      render(<ExportButton serverId="mediaserver" timeRange="24h" />);

      fireEvent.click(screen.getByTestId('export-button'));

      expect(screen.getByTestId('export-dropdown')).toBeInTheDocument();
      expect(screen.getByTestId('export-csv')).toBeInTheDocument();
      expect(screen.getByTestId('export-json')).toBeInTheDocument();
    });

    it('closes dropdown on second click', () => {
      render(<ExportButton serverId="mediaserver" timeRange="24h" />);

      fireEvent.click(screen.getByTestId('export-button'));
      expect(screen.getByTestId('export-dropdown')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('export-button'));
      expect(screen.queryByTestId('export-dropdown')).not.toBeInTheDocument();
    });

    it('closes dropdown when clicking outside (TC0048-103)', () => {
      render(
        <div>
          <div data-testid="outside">Outside</div>
          <ExportButton serverId="mediaserver" timeRange="24h" />
        </div>,
      );

      fireEvent.click(screen.getByTestId('export-button'));
      expect(screen.getByTestId('export-dropdown')).toBeInTheDocument();

      fireEvent.mouseDown(screen.getByTestId('outside'));
      expect(screen.queryByTestId('export-dropdown')).not.toBeInTheDocument();
    });
  });

  describe('CSV export (TC0048-104)', () => {
    it('triggers CSV download when selected', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['csv,data'])),
        headers: new Headers({
          'Content-Disposition': 'attachment; filename="test.csv"',
        }),
      });

      render(<ExportButton serverId="mediaserver" timeRange="24h" />);

      fireEvent.click(screen.getByTestId('export-button'));
      fireEvent.click(screen.getByTestId('export-csv'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/metrics/export?range=24h&format=csv'),
          expect.objectContaining({
            headers: expect.objectContaining({
              'X-API-Key': expect.any(String),
            }),
          }),
        );
      });
    });

    it('closes dropdown after selecting CSV', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['csv,data'])),
        headers: new Headers(),
      });

      render(<ExportButton serverId="mediaserver" timeRange="24h" />);

      fireEvent.click(screen.getByTestId('export-button'));
      fireEvent.click(screen.getByTestId('export-csv'));

      await waitFor(() => {
        expect(screen.queryByTestId('export-dropdown')).not.toBeInTheDocument();
      });
    });
  });

  describe('JSON export (TC0048-105)', () => {
    it('triggers JSON download when selected', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['{"data": []}'])),
        headers: new Headers({
          'Content-Disposition': 'attachment; filename="test.json"',
        }),
      });

      render(<ExportButton serverId="mediaserver" timeRange="24h" />);

      fireEvent.click(screen.getByTestId('export-button'));
      fireEvent.click(screen.getByTestId('export-json'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/metrics/export?range=24h&format=json'),
          expect.objectContaining({
            headers: expect.objectContaining({
              'X-API-Key': expect.any(String),
            }),
          }),
        );
      });
    });
  });

  describe('Loading state (TC0048-106)', () => {
    it('shows loading state during export', async () => {
      let resolvePromise: (value: unknown) => void;
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          }),
      );

      render(<ExportButton serverId="mediaserver" timeRange="24h" />);

      fireEvent.click(screen.getByTestId('export-button'));
      fireEvent.click(screen.getByTestId('export-csv'));

      await waitFor(() => {
        expect(screen.getByText('Exporting...')).toBeInTheDocument();
      });
      expect(screen.getByTestId('export-spinner')).toBeInTheDocument();
      expect(screen.getByTestId('export-button')).toBeDisabled();

      // Resolve the fetch to complete the test
      await act(async () => {
        resolvePromise!({
          ok: true,
          blob: () => Promise.resolve(new Blob()),
          headers: new Headers(),
        });
      });
    });

    it('removes loading state after export completes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob()),
        headers: new Headers(),
      });

      render(<ExportButton serverId="mediaserver" timeRange="24h" />);

      fireEvent.click(screen.getByTestId('export-button'));
      fireEvent.click(screen.getByTestId('export-csv'));

      await waitFor(() => {
        expect(screen.queryByText('Exporting...')).not.toBeInTheDocument();
      });
      expect(screen.getByText('Export')).toBeInTheDocument();
    });
  });

  describe('Disabled state (TC0048-107)', () => {
    it('disables button when disabled prop is true', () => {
      render(
        <ExportButton serverId="mediaserver" timeRange="24h" disabled />,
      );

      expect(screen.getByTestId('export-button')).toBeDisabled();
      expect(screen.getByTestId('export-button')).toHaveClass('opacity-50');
    });

    it('does not open dropdown when disabled', () => {
      render(
        <ExportButton serverId="mediaserver" timeRange="24h" disabled />,
      );

      fireEvent.click(screen.getByTestId('export-button'));

      expect(screen.queryByTestId('export-dropdown')).not.toBeInTheDocument();
    });
  });

  describe('Time range handling (TC0048-108)', () => {
    it('uses current time range in export request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob()),
        headers: new Headers(),
      });

      render(<ExportButton serverId="mediaserver" timeRange="30d" />);

      fireEvent.click(screen.getByTestId('export-button'));
      fireEvent.click(screen.getByTestId('export-csv'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('range=30d'),
          expect.objectContaining({
            headers: expect.objectContaining({
              'X-API-Key': expect.any(String),
            }),
          }),
        );
      });
    });

    it('uses 12m time range when specified', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob()),
        headers: new Headers(),
      });

      render(<ExportButton serverId="mediaserver" timeRange="12m" />);

      fireEvent.click(screen.getByTestId('export-button'));
      fireEvent.click(screen.getByTestId('export-json'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('range=12m&format=json'),
          expect.objectContaining({
            headers: expect.objectContaining({
              'X-API-Key': expect.any(String),
            }),
          }),
        );
      });
    });
  });

  describe('Server ID handling', () => {
    it('uses correct server ID in export request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob()),
        headers: new Headers(),
      });

      render(<ExportButton serverId="my-nas-server" timeRange="24h" />);

      fireEvent.click(screen.getByTestId('export-button'));
      fireEvent.click(screen.getByTestId('export-csv'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/servers/my-nas-server/metrics/export'),
          expect.objectContaining({
            headers: expect.objectContaining({
              'X-API-Key': expect.any(String),
            }),
          }),
        );
      });
    });
  });

  describe('Error handling', () => {
    it('handles fetch error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValue(new Error('Network error'));

      render(<ExportButton serverId="mediaserver" timeRange="24h" />);

      fireEvent.click(screen.getByTestId('export-button'));
      fireEvent.click(screen.getByTestId('export-csv'));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Export failed:', expect.any(Error));
      });

      // Button should return to normal state
      expect(screen.getByText('Export')).toBeInTheDocument();
      consoleSpy.mockRestore();
    });

    it('handles non-ok response gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      render(<ExportButton serverId="mediaserver" timeRange="24h" />);

      fireEvent.click(screen.getByTestId('export-button'));
      fireEvent.click(screen.getByTestId('export-csv'));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      expect(screen.getByText('Export')).toBeInTheDocument();
      consoleSpy.mockRestore();
    });
  });

  describe('Filename handling', () => {
    it('uses filename from Content-Disposition header', async () => {
      // Create a spy for createObjectURL and revokeObjectURL
      const mockUrl = 'blob:test-url';
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockUrl);
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['test'])),
        headers: new Headers({
          'Content-Disposition': 'attachment; filename="mediaserver-metrics-24h-2026-01-21.csv"',
        }),
      });

      render(<ExportButton serverId="mediaserver" timeRange="24h" />);

      fireEvent.click(screen.getByTestId('export-button'));
      fireEvent.click(screen.getByTestId('export-csv'));

      await waitFor(() => {
        expect(createObjectURLSpy).toHaveBeenCalled();
      });

      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });

    it('uses fallback filename when header is missing', async () => {
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['test'])),
        headers: new Headers(), // No Content-Disposition
      });

      render(<ExportButton serverId="testserver" timeRange="7d" />);

      fireEvent.click(screen.getByTestId('export-button'));
      fireEvent.click(screen.getByTestId('export-json'));

      await waitFor(() => {
        expect(createObjectURLSpy).toHaveBeenCalled();
      });

      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });
  });
});
