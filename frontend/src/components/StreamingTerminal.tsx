/**
 * Terminal-style streaming output display (US0156).
 *
 * Shows real-time command output with auto-scroll, streaming indicator,
 * and progress bar for apt commands.
 */

import { Loader2, Terminal, XCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { OutputLine, StreamExitInfo, StreamProgress } from '../types/action';

interface StreamingTerminalProps {
  /** Array of output lines to display */
  output: OutputLine[];
  /** Whether streaming is currently active */
  isStreaming: boolean;
  /** Progress info for apt commands (optional) */
  progress: StreamProgress | null;
  /** Exit info when command completes */
  exitInfo: StreamExitInfo | null;
  /** Error message if streaming failed */
  error: string | null;
  /** Maximum height in pixels (default 384 = 24rem) */
  maxHeight?: number;
  /** Whether to auto-scroll to bottom (default true) */
  autoScroll?: boolean;
}

export function StreamingTerminal({
  output,
  isStreaming,
  progress,
  exitInfo,
  error,
  maxHeight = 384,
  autoScroll = true,
}: StreamingTerminalProps) {
  const outputRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (autoScroll && bottomRef.current && bottomRef.current.scrollIntoView) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [output, autoScroll]);

  const hasOutput = output.length > 0;
  const isComplete = exitInfo !== null;
  const isSuccess = exitInfo?.code === 0;

  return (
    <div
      className="bg-bg-tertiary border border-border-default rounded-md font-mono text-sm"
      data-testid="streaming-terminal"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-default bg-bg-secondary/50">
        <div className="flex items-center gap-2 text-text-secondary">
          <Terminal className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wide">Output</span>
        </div>
        <div className="flex items-center gap-2">
          {isStreaming && (
            <div className="flex items-center gap-1.5 text-status-info" data-testid="streaming-indicator">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-xs">Streaming</span>
            </div>
          )}
          {isComplete && (
            <div
              className={`flex items-center gap-1.5 ${isSuccess ? 'text-status-success' : 'text-status-error'}`}
              data-testid="completion-indicator"
            >
              <span className="text-xs">
                Exit code: {exitInfo.code}
                {exitInfo.duration_ms && ` (${(exitInfo.duration_ms / 1000).toFixed(1)}s)`}
              </span>
            </div>
          )}
          {error && !isComplete && (
            <div className="flex items-center gap-1.5 text-status-error" data-testid="error-indicator">
              <XCircle className="w-3.5 h-3.5" />
              <span className="text-xs">Error</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar (for apt commands) */}
      {progress && isStreaming && (
        <div className="px-3 py-2 border-b border-border-default" data-testid="progress-bar">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-text-secondary">{progress.stage}</span>
            <span className="text-xs text-text-tertiary">{progress.percent}%</span>
          </div>
          <div className="h-1.5 bg-bg-primary rounded-full overflow-hidden">
            <div
              className="h-full bg-status-info transition-all duration-300 rounded-full"
              style={{ width: `${progress.percent}%` }}
              data-testid="progress-fill"
            />
          </div>
        </div>
      )}

      {/* Output area */}
      <div
        ref={outputRef}
        className="p-3 overflow-auto"
        style={{ maxHeight }}
        data-testid="output-area"
      >
        {!hasOutput && isStreaming && (
          <div className="text-text-tertiary text-xs" data-testid="waiting-message">
            Waiting for output...
          </div>
        )}
        {!hasOutput && !isStreaming && !error && (
          <div className="text-text-tertiary text-xs" data-testid="empty-message">
            No output
          </div>
        )}
        {output.map((line, index) => (
          <OutputLineDisplay key={index} line={line} />
        ))}
        {error && (
          <div className="text-status-error text-xs mt-2" data-testid="error-message">
            Error: {error}
          </div>
        )}
        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

interface OutputLineDisplayProps {
  line: OutputLine;
}

function OutputLineDisplay({ line }: OutputLineDisplayProps) {
  // Split text into lines for proper formatting
  const lines = line.text.split('\n');

  return (
    <>
      {lines.map((text, idx) => {
        if (!text) return null; // Skip empty lines from split
        return (
          <div
            key={idx}
            className={`text-xs whitespace-pre-wrap break-all ${getLineClassName(line.type)}`}
            data-testid={`output-line-${line.type}`}
          >
            {text}
          </div>
        );
      })}
    </>
  );
}

function getLineClassName(type: OutputLine['type']): string {
  switch (type) {
    case 'stdout':
      return 'text-text-primary';
    case 'stderr':
      return 'text-status-warning';
    case 'error':
      return 'text-status-error';
    default:
      return 'text-text-secondary';
  }
}
