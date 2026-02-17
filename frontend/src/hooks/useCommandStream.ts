/**
 * Hook for streaming command output via Server-Sent Events (US0156).
 *
 * Connects to the SSE endpoint to receive real-time command output,
 * with polling fallback for browsers that don't support EventSource.
 */

import { useCallback, useRef, useState } from 'react';
import type {
  OutputLine,
  StreamExitInfo,
  StreamProgress,
  StreamingState,
} from '../types/action';

interface UseCommandStreamOptions {
  /** Called when streaming completes (exit event received) */
  onComplete?: (exitInfo: StreamExitInfo) => void;
  /** Called on error */
  onError?: (error: string) => void;
  /** Maximum number of output lines to keep (default 1000) */
  maxLines?: number;
}

interface UseCommandStreamReturn extends StreamingState {
  /** Start streaming command output */
  startStream: (serverId: string, command: string, actionType: string, timeout?: number) => void;
  /** Stop the current stream */
  stopStream: () => void;
  /** Clear accumulated output */
  clearOutput: () => void;
}

const API_BASE = '/api/v1';

export function useCommandStream(options: UseCommandStreamOptions = {}): UseCommandStreamReturn {
  const { onComplete, onError, maxLines = 1000 } = options;

  const [output, setOutput] = useState<OutputLine[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [progress, setProgress] = useState<StreamProgress | null>(null);
  const [exitInfo, setExitInfo] = useState<StreamExitInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<number | null>(null);

  const addOutputLine = useCallback(
    (line: OutputLine) => {
      setOutput((prev) => {
        const newOutput = [...prev, line];
        // Limit output lines to prevent memory issues
        if (newOutput.length > maxLines) {
          return newOutput.slice(-maxLines);
        }
        return newOutput;
      });
    },
    [maxLines]
  );

  const stopStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (pollIntervalRef.current) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const clearOutput = useCallback(() => {
    setOutput([]);
    setProgress(null);
    setExitInfo(null);
    setError(null);
  }, []);

  // Polling fallback for browsers without EventSource (AC3)
  // Defined before startStream since it's called from there
  const startPollingFallback = useCallback(
    async (serverId: string, command: string, actionType: string) => {
      // For polling fallback, we use the synchronous execute endpoint
      // and poll for action status
      const executeUrl = `${API_BASE}/servers/${serverId}/commands/execute`;

      try {
        const response = await fetch(executeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            command,
            action_type: actionType,
          }),
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData.detail || 'Command execution failed';
          setError(errorMsg);
          onError?.(errorMsg);
          setIsStreaming(false);
          return;
        }

        const result = await response.json();

        // Add output as single chunk
        if (result.stdout) {
          addOutputLine({
            type: 'stdout',
            text: result.stdout,
            timestamp: new Date().toISOString(),
          });
        }
        if (result.stderr) {
          addOutputLine({
            type: 'stderr',
            text: result.stderr,
            timestamp: new Date().toISOString(),
          });
        }

        const info: StreamExitInfo = {
          code: result.exit_code,
          duration_ms: result.duration_ms,
        };
        setExitInfo(info);
        setIsStreaming(false);
        onComplete?.(info);
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'Network error';
        setError(errorMsg);
        onError?.(errorMsg);
        setIsStreaming(false);
      }
    },
    [addOutputLine, onComplete, onError]
  );

  const startStream = useCallback(
    (serverId: string, command: string, actionType: string, timeout = 300) => {
      // Stop any existing stream
      stopStream();

      // Reset state
      clearOutput();
      setIsStreaming(true);

      // Build SSE URL with query parameters
      const params = new URLSearchParams({
        command,
        action_type: actionType,
        timeout: timeout.toString(),
      });
      const url = `${API_BASE}/servers/${serverId}/commands/stream?${params}`;

      // Check for EventSource support
      if (typeof EventSource === 'undefined') {
        // Fallback to polling (AC3)
        startPollingFallback(serverId, command, actionType);
        return;
      }

      const eventSource = new EventSource(url, { withCredentials: true });
      eventSourceRef.current = eventSource;

      eventSource.addEventListener('stdout', (event) => {
        try {
          const data = JSON.parse(event.data);
          addOutputLine({
            type: 'stdout',
            text: data.text,
            timestamp: data.ts,
          });
        } catch (e) {
          console.error('Failed to parse stdout event:', e);
        }
      });

      eventSource.addEventListener('stderr', (event) => {
        try {
          const data = JSON.parse(event.data);
          addOutputLine({
            type: 'stderr',
            text: data.text,
            timestamp: data.ts,
          });
        } catch (e) {
          console.error('Failed to parse stderr event:', e);
        }
      });

      eventSource.addEventListener('progress', (event) => {
        try {
          const data = JSON.parse(event.data);
          setProgress({
            percent: data.percent,
            stage: data.stage,
          });
        } catch (e) {
          console.error('Failed to parse progress event:', e);
        }
      });

      eventSource.addEventListener('exit', (event) => {
        try {
          const data = JSON.parse(event.data);
          const info: StreamExitInfo = {
            code: data.code,
            duration_ms: data.duration_ms,
          };
          setExitInfo(info);
          setIsStreaming(false);
          eventSource.close();
          eventSourceRef.current = null;
          onComplete?.(info);
        } catch (e) {
          console.error('Failed to parse exit event:', e);
        }
      });

      eventSource.addEventListener('error', (event) => {
        // Try to parse error data if available
        if (event instanceof MessageEvent && event.data) {
          try {
            const data = JSON.parse(event.data);
            const errorMsg = data.message || 'Stream error';
            setError(errorMsg);
            addOutputLine({
              type: 'error',
              text: errorMsg,
              timestamp: data.ts || new Date().toISOString(),
            });
            onError?.(errorMsg);
          } catch {
            // Not a JSON error, handle as connection error
            handleConnectionError();
          }
        } else {
          handleConnectionError();
        }
      });

      eventSource.onerror = () => {
        // EventSource will automatically try to reconnect
        // Only handle as error if readyState is CLOSED
        if (eventSource.readyState === EventSource.CLOSED) {
          handleConnectionError();
        }
      };

      function handleConnectionError() {
        const errorMsg = 'Connection to server lost';
        setError(errorMsg);
        setIsStreaming(false);
        eventSource.close();
        eventSourceRef.current = null;
        onError?.(errorMsg);
      }
    },
    [addOutputLine, clearOutput, onComplete, onError, startPollingFallback, stopStream]
  );

  return {
    output,
    isStreaming,
    progress,
    exitInfo,
    error,
    startStream,
    stopStream,
    clearOutput,
  };
}
