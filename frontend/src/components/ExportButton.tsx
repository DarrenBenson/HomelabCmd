import { useState, useRef, useEffect } from 'react';
import type { TimeRange } from '../types/server';

const API_KEY = import.meta.env.VITE_API_KEY || 'dev-key-change-me';

interface ExportButtonProps {
  serverId: string;
  timeRange: TimeRange;
  disabled?: boolean;
}

/**
 * ExportButton with dropdown for CSV/JSON export (US0048).
 *
 * Allows users to export metrics data for the current time range
 * in either CSV or JSON format.
 */
export function ExportButton({
  serverId,
  timeRange,
  disabled = false,
}: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = async (format: 'csv' | 'json') => {
    setIsOpen(false);
    setIsExporting(true);

    try {
      const response = await fetch(
        `/api/v1/servers/${serverId}/metrics/export?range=${timeRange}&format=${format}`,
        {
          headers: {
            'X-API-Key': API_KEY,
          },
        },
      );

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename =
        contentDisposition?.split('filename=')[1]?.replace(/"/g, '') ||
        `${serverId}-metrics-${timeRange}.${format}`;

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      // Toast notification would go here in production
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className="relative"
      ref={dropdownRef}
      data-testid="export-button-container"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || isExporting}
        className={`flex items-center gap-1 rounded px-3 py-1 text-sm font-medium transition-colors
          bg-bg-tertiary text-text-secondary hover:bg-bg-secondary hover:text-text-primary
          ${disabled || isExporting ? 'cursor-not-allowed opacity-50' : ''}`}
        data-testid="export-button"
      >
        {isExporting ? (
          <>
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-text-muted border-t-status-info"
              data-testid="export-spinner"
            />
            Exporting...
          </>
        ) : (
          <>
            Export
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </>
        )}
      </button>

      {isOpen && !isExporting && (
        <div
          className="absolute right-0 z-10 mt-1 w-24 rounded border border-border-default bg-bg-primary shadow-lg"
          data-testid="export-dropdown"
        >
          <button
            onClick={() => handleExport('csv')}
            className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary"
            data-testid="export-csv"
          >
            CSV
          </button>
          <button
            onClick={() => handleExport('json')}
            className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary"
            data-testid="export-json"
          >
            JSON
          </button>
        </div>
      )}
    </div>
  );
}
