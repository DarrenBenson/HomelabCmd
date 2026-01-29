import { useState, useEffect } from 'react';

/**
 * Mobile breakpoint threshold in pixels.
 * Viewports below this width are considered mobile.
 * Matches the 'sm' breakpoint from react-grid-layout config.
 */
export const MOBILE_BREAKPOINT = 768;

/**
 * Debounce delay for resize events in milliseconds.
 */
const RESIZE_DEBOUNCE_MS = 100;

/**
 * Hook to detect if the current viewport is mobile-sized.
 *
 * @returns true if viewport width is below MOBILE_BREAKPOINT (768px)
 *
 * @example
 * ```tsx
 * const isMobile = useIsMobile();
 * if (isMobile) {
 *   // Hide edit controls on mobile
 * }
 * ```
 */
export function useIsMobile(): boolean {
  // SSR-safe: default to false on server
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  useEffect(() => {
    // SSR guard
    if (typeof window === 'undefined') {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const handleResize = (): void => {
      // Debounce resize events for performance
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
      }, RESIZE_DEBOUNCE_MS);
    };

    // Add resize listener (initial value set by useState initialiser)
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  return isMobile;
}
