/**
 * Performance Utilities
 * 
 * Reusable throttle, debounce, and cleanup utilities for performance optimization.
 * Extracted from DragPositioning.ts to make these utilities available across the application.
 */

/**
 * Storage for debounced update timeouts with cleanup support
 */
const debouncedUpdateTimeouts = new Map<string, NodeJS.Timeout>();

/**
 * Storage for throttled callbacks
 */
const throttledCallbacks = new Map<string, NodeJS.Timeout>();

/**
 * Debounce a function call - delays execution until after a period of inactivity
 * Useful for expensive operations that shouldn't run on every event (e.g., API calls)
 * 
 * @param callback - Function to debounce
 * @param delay - Milliseconds to wait before executing
 * @param key - Unique identifier for this debounced operation (enables cleanup)
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number = 16, // ~60fps default
  key: string = 'default'
): (...args: Parameters<T>) => void {
  return (...args: Parameters<T>) => {
    const timeoutId = debouncedUpdateTimeouts.get(key);
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    const newTimeoutId = setTimeout(() => {
      callback(...args);
      debouncedUpdateTimeouts.delete(key);
    }, delay);
    
    debouncedUpdateTimeouts.set(key, newTimeoutId);
  };
}

/**
 * Throttle a function call - limits execution to once per time period
 * Useful for rate-limiting frequent events (e.g., scroll, mousemove)
 * 
 * @param callback - Function to throttle
 * @param delay - Minimum milliseconds between executions
 * @param key - Unique identifier for this throttled operation (enables cleanup)
 * @returns Throttled function
 */
export function throttle<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number = 16, // ~60fps default
  key: string = 'default'
): (...args: Parameters<T>) => void {
  let lastCallTime = 0;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;
    
    if (timeSinceLastCall >= delay) {
      lastCallTime = now;
      callback(...args);
    } else {
      const timeoutId = throttledCallbacks.get(key);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      const newTimeoutId = setTimeout(() => {
        lastCallTime = Date.now();
        callback(...args);
        throttledCallbacks.delete(key);
      }, delay - timeSinceLastCall);
      
      throttledCallbacks.set(key, newTimeoutId);
    }
  };
}

/**
 * Clean up all pending debounced/throttled operations
 * Call this when unmounting components or canceling operations
 * 
 * @param key - Optional key to clean up specific operation, or omit to clean all
 */
export function cleanupPerformanceTimers(key?: string): void {
  if (key) {
    // Clean up specific key
    const debouncedTimeout = debouncedUpdateTimeouts.get(key);
    if (debouncedTimeout) {
      clearTimeout(debouncedTimeout);
      debouncedUpdateTimeouts.delete(key);
    }
    
    const throttledTimeout = throttledCallbacks.get(key);
    if (throttledTimeout) {
      clearTimeout(throttledTimeout);
      throttledCallbacks.delete(key);
    }
  } else {
    // Clean up all
    debouncedUpdateTimeouts.forEach(timeout => clearTimeout(timeout));
    debouncedUpdateTimeouts.clear();
    
    throttledCallbacks.forEach(timeout => clearTimeout(timeout));
    throttledCallbacks.clear();
  }
}

/**
 * Get count of active performance timers (useful for debugging)
 */
export function getActiveTimerCount(): { debounced: number; throttled: number } {
  return {
    debounced: debouncedUpdateTimeouts.size,
    throttled: throttledCallbacks.size
  };
}
