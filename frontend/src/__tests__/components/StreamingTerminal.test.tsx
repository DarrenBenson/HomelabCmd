/**
 * Tests for StreamingTerminal component (US0156).
 *
 * Tests output rendering, auto-scroll, progress bar, and status indicators.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StreamingTerminal } from '../../components/StreamingTerminal';
import type { OutputLine, StreamProgress, StreamExitInfo } from '../../types/action';

describe('StreamingTerminal', () => {
  const defaultProps = {
    output: [] as OutputLine[],
    isStreaming: false,
    progress: null as StreamProgress | null,
    exitInfo: null as StreamExitInfo | null,
    error: null as string | null,
  };

  describe('empty state', () => {
    it('should render empty message when no output and not streaming', () => {
      render(<StreamingTerminal {...defaultProps} />);

      expect(screen.getByTestId('empty-message')).toHaveTextContent('No output');
    });

    it('should render waiting message when streaming with no output', () => {
      render(<StreamingTerminal {...defaultProps} isStreaming={true} />);

      expect(screen.getByTestId('waiting-message')).toHaveTextContent('Waiting for output');
    });
  });

  describe('header', () => {
    it('should show streaming indicator when streaming', () => {
      render(<StreamingTerminal {...defaultProps} isStreaming={true} />);

      expect(screen.getByTestId('streaming-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('streaming-indicator')).toHaveTextContent('Streaming');
    });

    it('should not show streaming indicator when not streaming', () => {
      render(<StreamingTerminal {...defaultProps} isStreaming={false} />);

      expect(screen.queryByTestId('streaming-indicator')).not.toBeInTheDocument();
    });

    it('should show completion indicator with exit code 0', () => {
      render(
        <StreamingTerminal
          {...defaultProps}
          exitInfo={{ code: 0, duration_ms: 5432 }}
        />
      );

      const indicator = screen.getByTestId('completion-indicator');
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveTextContent('Exit code: 0');
      expect(indicator).toHaveTextContent('5.4s');
      expect(indicator).toHaveClass('text-status-success');
    });

    it('should show completion indicator with non-zero exit code', () => {
      render(
        <StreamingTerminal
          {...defaultProps}
          exitInfo={{ code: 1, duration_ms: 1234 }}
        />
      );

      const indicator = screen.getByTestId('completion-indicator');
      expect(indicator).toHaveClass('text-status-error');
      expect(indicator).toHaveTextContent('Exit code: 1');
    });

    it('should show error indicator when error occurs', () => {
      render(
        <StreamingTerminal
          {...defaultProps}
          error="Connection lost"
        />
      );

      expect(screen.getByTestId('error-indicator')).toBeInTheDocument();
    });
  });

  describe('output rendering', () => {
    it('should render stdout lines', () => {
      const output: OutputLine[] = [
        { type: 'stdout', text: 'Line 1', timestamp: '2026-01-31T12:00:00Z' },
        { type: 'stdout', text: 'Line 2', timestamp: '2026-01-31T12:00:01Z' },
      ];

      render(<StreamingTerminal {...defaultProps} output={output} />);

      const lines = screen.getAllByTestId('output-line-stdout');
      expect(lines).toHaveLength(2);
      expect(lines[0]).toHaveTextContent('Line 1');
      expect(lines[1]).toHaveTextContent('Line 2');
    });

    it('should render stderr lines with warning styling', () => {
      const output: OutputLine[] = [
        { type: 'stderr', text: 'Warning message', timestamp: '2026-01-31T12:00:00Z' },
      ];

      render(<StreamingTerminal {...defaultProps} output={output} />);

      const line = screen.getByTestId('output-line-stderr');
      expect(line).toHaveTextContent('Warning message');
      expect(line).toHaveClass('text-status-warning');
    });

    it('should render error lines with error styling', () => {
      const output: OutputLine[] = [
        { type: 'error', text: 'Error occurred', timestamp: '2026-01-31T12:00:00Z' },
      ];

      render(<StreamingTerminal {...defaultProps} output={output} />);

      const line = screen.getByTestId('output-line-error');
      expect(line).toHaveTextContent('Error occurred');
      expect(line).toHaveClass('text-status-error');
    });

    it('should render mixed output types', () => {
      const output: OutputLine[] = [
        { type: 'stdout', text: 'Starting...', timestamp: '2026-01-31T12:00:00Z' },
        { type: 'stderr', text: 'Warning: deprecated', timestamp: '2026-01-31T12:00:01Z' },
        { type: 'stdout', text: 'Done', timestamp: '2026-01-31T12:00:02Z' },
      ];

      render(<StreamingTerminal {...defaultProps} output={output} />);

      expect(screen.getAllByTestId('output-line-stdout')).toHaveLength(2);
      expect(screen.getAllByTestId('output-line-stderr')).toHaveLength(1);
    });

    it('should split multi-line text into separate lines', () => {
      const output: OutputLine[] = [
        { type: 'stdout', text: 'Line 1\nLine 2\nLine 3', timestamp: '2026-01-31T12:00:00Z' },
      ];

      render(<StreamingTerminal {...defaultProps} output={output} />);

      const lines = screen.getAllByTestId('output-line-stdout');
      expect(lines).toHaveLength(3);
    });
  });

  describe('progress bar', () => {
    it('should show progress bar when progress is provided and streaming', () => {
      render(
        <StreamingTerminal
          {...defaultProps}
          isStreaming={true}
          progress={{ percent: 45, stage: 'Downloading packages' }}
        />
      );

      expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
      expect(screen.getByText('Downloading packages')).toBeInTheDocument();
      expect(screen.getByText('45%')).toBeInTheDocument();
    });

    it('should update progress fill width', () => {
      render(
        <StreamingTerminal
          {...defaultProps}
          isStreaming={true}
          progress={{ percent: 75, stage: 'Installing' }}
        />
      );

      const fill = screen.getByTestId('progress-fill');
      expect(fill).toHaveStyle({ width: '75%' });
    });

    it('should not show progress bar when not streaming', () => {
      render(
        <StreamingTerminal
          {...defaultProps}
          isStreaming={false}
          progress={{ percent: 100, stage: 'Done' }}
        />
      );

      expect(screen.queryByTestId('progress-bar')).not.toBeInTheDocument();
    });

    it('should not show progress bar when progress is null', () => {
      render(
        <StreamingTerminal
          {...defaultProps}
          isStreaming={true}
          progress={null}
        />
      );

      expect(screen.queryByTestId('progress-bar')).not.toBeInTheDocument();
    });
  });

  describe('error message', () => {
    it('should display error message at bottom of output', () => {
      render(
        <StreamingTerminal
          {...defaultProps}
          error="Connection to server lost"
        />
      );

      expect(screen.getByTestId('error-message')).toHaveTextContent('Error: Connection to server lost');
    });

    it('should show error message with output', () => {
      const output: OutputLine[] = [
        { type: 'stdout', text: 'Some output', timestamp: '2026-01-31T12:00:00Z' },
      ];

      render(
        <StreamingTerminal
          {...defaultProps}
          output={output}
          error="Connection lost"
        />
      );

      expect(screen.getByTestId('output-line-stdout')).toBeInTheDocument();
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });
  });

  describe('maxHeight', () => {
    it('should apply maxHeight to output area', () => {
      render(
        <StreamingTerminal
          {...defaultProps}
          maxHeight={500}
        />
      );

      const outputArea = screen.getByTestId('output-area');
      expect(outputArea).toHaveStyle({ maxHeight: '500px' });
    });

    it('should use default maxHeight when not specified', () => {
      render(<StreamingTerminal {...defaultProps} />);

      const outputArea = screen.getByTestId('output-area');
      expect(outputArea).toHaveStyle({ maxHeight: '384px' });
    });
  });

  describe('accessibility', () => {
    it('should have correct test IDs for key elements', () => {
      render(
        <StreamingTerminal
          {...defaultProps}
          isStreaming={true}
          progress={{ percent: 50, stage: 'Test' }}
        />
      );

      expect(screen.getByTestId('streaming-terminal')).toBeInTheDocument();
      expect(screen.getByTestId('streaming-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
      expect(screen.getByTestId('output-area')).toBeInTheDocument();
    });
  });
});
