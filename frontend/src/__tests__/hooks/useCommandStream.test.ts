/**
 * Tests for useCommandStream hook (US0156).
 *
 * Tests EventSource connection, event parsing, and polling fallback.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCommandStream } from '../../hooks/useCommandStream';

// Mock EventSource
class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  readyState = MockEventSource.OPEN;
  url: string;
  withCredentials: boolean;
  onopen: ((ev: Event) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;

  private listeners: Map<string, ((ev: MessageEvent) => void)[]> = new Map();
  private closeCallbacks: (() => void)[] = [];

  constructor(url: string, config?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = config?.withCredentials ?? false;
    // Simulate async connection
    setTimeout(() => {
      if (this.onopen) this.onopen(new Event('open'));
    }, 0);
  }

  addEventListener(event: string, callback: (ev: MessageEvent) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  removeEventListener(event: string, callback: (ev: MessageEvent) => void) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index >= 0) callbacks.splice(index, 1);
    }
  }

  dispatchEvent(event: MessageEvent): boolean {
    const callbacks = this.listeners.get(event.type);
    if (callbacks) {
      callbacks.forEach(cb => cb(event));
    }
    return true;
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
    this.closeCallbacks.forEach(cb => cb());
  }

  // Helper for tests
  simulateEvent(type: string, data: string) {
    const event = new MessageEvent(type, { data });
    this.dispatchEvent(event);
  }
}

// Store reference to mock for tests
let mockEventSourceInstance: MockEventSource | null = null;

describe('useCommandStream', () => {
  beforeEach(() => {
    class TestEventSource extends MockEventSource {
      constructor(url: string, config?: { withCredentials?: boolean }) {
        super(url, config);
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        mockEventSourceInstance = this;
      }
    }
    vi.stubGlobal('EventSource', TestEventSource);
  });

  afterEach(() => {
    mockEventSourceInstance = null;
    vi.unstubAllGlobals();
  });

  describe('initial state', () => {
    it('should start with empty state', () => {
      const { result } = renderHook(() => useCommandStream());

      expect(result.current.output).toEqual([]);
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.progress).toBeNull();
      expect(result.current.exitInfo).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('startStream', () => {
    it('should set isStreaming to true when starting', async () => {
      const { result } = renderHook(() => useCommandStream());

      act(() => {
        result.current.startStream('server-1', 'apt-get update', 'apt_update');
      });

      expect(result.current.isStreaming).toBe(true);
    });

    it('should create EventSource with correct URL', async () => {
      const { result } = renderHook(() => useCommandStream());

      act(() => {
        result.current.startStream('server-1', 'apt-get update', 'apt_update', 300);
      });

      expect(mockEventSourceInstance).not.toBeNull();
      expect(mockEventSourceInstance!.url).toContain('/api/v1/servers/server-1/commands/stream');
      expect(mockEventSourceInstance!.url).toContain('command=apt-get+update');
      expect(mockEventSourceInstance!.url).toContain('action_type=apt_update');
      expect(mockEventSourceInstance!.url).toContain('timeout=300');
    });

    it('should clear previous output when starting new stream', async () => {
      const { result } = renderHook(() => useCommandStream());

      // Start first stream and add output
      act(() => {
        result.current.startStream('server-1', 'cmd1', 'apt_update');
      });

      act(() => {
        mockEventSourceInstance!.simulateEvent('stdout', JSON.stringify({
          text: 'first output',
          ts: new Date().toISOString(),
        }));
      });

      expect(result.current.output).toHaveLength(1);

      // Start second stream
      act(() => {
        result.current.startStream('server-2', 'cmd2', 'apt_update');
      });

      expect(result.current.output).toEqual([]);
    });
  });

  describe('stdout events', () => {
    it('should add stdout lines to output', async () => {
      const { result } = renderHook(() => useCommandStream());

      act(() => {
        result.current.startStream('server-1', 'apt-get update', 'apt_update');
      });

      const timestamp = new Date().toISOString();
      act(() => {
        mockEventSourceInstance!.simulateEvent('stdout', JSON.stringify({
          text: 'Reading package lists...',
          ts: timestamp,
        }));
      });

      expect(result.current.output).toHaveLength(1);
      expect(result.current.output[0]).toEqual({
        type: 'stdout',
        text: 'Reading package lists...',
        timestamp,
      });
    });

    it('should accumulate multiple stdout lines', async () => {
      const { result } = renderHook(() => useCommandStream());

      act(() => {
        result.current.startStream('server-1', 'apt-get update', 'apt_update');
      });

      act(() => {
        mockEventSourceInstance!.simulateEvent('stdout', JSON.stringify({
          text: 'Line 1',
          ts: new Date().toISOString(),
        }));
      });

      act(() => {
        mockEventSourceInstance!.simulateEvent('stdout', JSON.stringify({
          text: 'Line 2',
          ts: new Date().toISOString(),
        }));
      });

      expect(result.current.output).toHaveLength(2);
      expect(result.current.output[0].text).toBe('Line 1');
      expect(result.current.output[1].text).toBe('Line 2');
    });
  });

  describe('stderr events', () => {
    it('should add stderr lines to output', async () => {
      const { result } = renderHook(() => useCommandStream());

      act(() => {
        result.current.startStream('server-1', 'apt-get update', 'apt_update');
      });

      act(() => {
        mockEventSourceInstance!.simulateEvent('stderr', JSON.stringify({
          text: 'Warning: something',
          ts: new Date().toISOString(),
        }));
      });

      expect(result.current.output).toHaveLength(1);
      expect(result.current.output[0].type).toBe('stderr');
      expect(result.current.output[0].text).toBe('Warning: something');
    });
  });

  describe('progress events', () => {
    it('should update progress state', async () => {
      const { result } = renderHook(() => useCommandStream());

      act(() => {
        result.current.startStream('server-1', 'apt-get update', 'apt_update');
      });

      act(() => {
        mockEventSourceInstance!.simulateEvent('progress', JSON.stringify({
          percent: 45,
          stage: 'Downloading packages',
        }));
      });

      expect(result.current.progress).toEqual({
        percent: 45,
        stage: 'Downloading packages',
      });
    });

    it('should update progress multiple times', async () => {
      const { result } = renderHook(() => useCommandStream());

      act(() => {
        result.current.startStream('server-1', 'apt-get update', 'apt_update');
      });

      act(() => {
        mockEventSourceInstance!.simulateEvent('progress', JSON.stringify({
          percent: 25,
          stage: 'Stage 1',
        }));
      });

      act(() => {
        mockEventSourceInstance!.simulateEvent('progress', JSON.stringify({
          percent: 75,
          stage: 'Stage 2',
        }));
      });

      expect(result.current.progress?.percent).toBe(75);
      expect(result.current.progress?.stage).toBe('Stage 2');
    });
  });

  describe('exit events', () => {
    it('should set exitInfo and stop streaming on exit', async () => {
      const onComplete = vi.fn();
      const { result } = renderHook(() => useCommandStream({ onComplete }));

      act(() => {
        result.current.startStream('server-1', 'apt-get update', 'apt_update');
      });

      act(() => {
        mockEventSourceInstance!.simulateEvent('exit', JSON.stringify({
          code: 0,
          duration_ms: 5432,
        }));
      });

      expect(result.current.exitInfo).toEqual({
        code: 0,
        duration_ms: 5432,
      });
      expect(result.current.isStreaming).toBe(false);
      expect(onComplete).toHaveBeenCalledWith({
        code: 0,
        duration_ms: 5432,
      });
    });

    it('should handle non-zero exit code', async () => {
      const { result } = renderHook(() => useCommandStream());

      act(() => {
        result.current.startStream('server-1', 'apt-get update', 'apt_update');
      });

      act(() => {
        mockEventSourceInstance!.simulateEvent('exit', JSON.stringify({
          code: 1,
          duration_ms: 1234,
        }));
      });

      expect(result.current.exitInfo?.code).toBe(1);
      expect(result.current.isStreaming).toBe(false);
    });
  });

  describe('stopStream', () => {
    it('should close EventSource and set isStreaming to false', async () => {
      const { result } = renderHook(() => useCommandStream());

      act(() => {
        result.current.startStream('server-1', 'apt-get update', 'apt_update');
      });

      expect(result.current.isStreaming).toBe(true);

      act(() => {
        result.current.stopStream();
      });

      expect(result.current.isStreaming).toBe(false);
      expect(mockEventSourceInstance!.readyState).toBe(MockEventSource.CLOSED);
    });
  });

  describe('clearOutput', () => {
    it('should reset all state', async () => {
      const { result } = renderHook(() => useCommandStream());

      act(() => {
        result.current.startStream('server-1', 'apt-get update', 'apt_update');
      });

      act(() => {
        mockEventSourceInstance!.simulateEvent('stdout', JSON.stringify({
          text: 'some output',
          ts: new Date().toISOString(),
        }));
        mockEventSourceInstance!.simulateEvent('progress', JSON.stringify({
          percent: 50,
          stage: 'test',
        }));
      });

      act(() => {
        result.current.stopStream();
      });

      act(() => {
        result.current.clearOutput();
      });

      expect(result.current.output).toEqual([]);
      expect(result.current.progress).toBeNull();
      expect(result.current.exitInfo).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('maxLines option', () => {
    it('should limit output lines to maxLines', async () => {
      const { result } = renderHook(() => useCommandStream({ maxLines: 3 }));

      act(() => {
        result.current.startStream('server-1', 'apt-get update', 'apt_update');
      });

      // Add 5 lines
      for (let i = 1; i <= 5; i++) {
        act(() => {
          mockEventSourceInstance!.simulateEvent('stdout', JSON.stringify({
            text: `Line ${i}`,
            ts: new Date().toISOString(),
          }));
        });
      }

      // Should only have last 3 lines
      expect(result.current.output).toHaveLength(3);
      expect(result.current.output[0].text).toBe('Line 3');
      expect(result.current.output[1].text).toBe('Line 4');
      expect(result.current.output[2].text).toBe('Line 5');
    });
  });

  describe('onError callback', () => {
    it('should call onError when error event received', async () => {
      const onError = vi.fn();
      const { result } = renderHook(() => useCommandStream({ onError }));

      act(() => {
        result.current.startStream('server-1', 'apt-get update', 'apt_update');
      });

      // Simulate error event with data
      act(() => {
        const event = new MessageEvent('error', {
          data: JSON.stringify({
            message: 'Connection lost',
            ts: new Date().toISOString(),
          }),
        });
        mockEventSourceInstance!.dispatchEvent(event);
      });

      expect(result.current.error).toBe('Connection lost');
      expect(onError).toHaveBeenCalledWith('Connection lost');
    });
  });
});
