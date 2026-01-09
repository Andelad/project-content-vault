import { useCallback, useRef, useMemo } from 'react';
import { PERFORMANCE_LIMITS } from '@/constants';
// Debounce hook for performance optimization
export function useDebounce<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]) as T;
}
// Throttle hook for performance optimization
export function useThrottle<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCallRef.current >= delay) {
      lastCallRef.current = now;
      callback(...args);
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        lastCallRef.current = Date.now();
        callback(...args);
      }, delay - (now - lastCallRef.current));
    }
  }, [callback, delay]) as T;
}
// Memoized computation hook with cache invalidation
export function useMemoizedComputation<T>(
  computeFn: () => T,
  deps: React.DependencyList,
  maxCacheSize: number = PERFORMANCE_LIMITS.MAX_CACHED_CALCULATIONS
): T {
  const cacheRef = useRef<Map<string, { value: T; timestamp: number }>>(new Map());
  const depsKey = useMemo(() => JSON.stringify(deps), [deps]);

  return useMemo(() => {
    const cached = cacheRef.current.get(depsKey);
    if (cached && Date.now() - cached.timestamp < 5000) { // 5 second cache
      return cached.value;
    }
    const result = computeFn();
    // Clean cache if too large
    if (cacheRef.current.size >= maxCacheSize) {
      const oldestKey = Array.from(cacheRef.current.keys())[0];
      cacheRef.current.delete(oldestKey);
    }
    cacheRef.current.set(depsKey, {
      value: result,
      timestamp: Date.now()
    });
    return result;
  }, [computeFn, depsKey, maxCacheSize]);
}
// Performance monitoring hook
export function usePerformanceMonitor(componentName: string) {
  const renderCountRef = useRef(0);
  const lastRenderTime = useRef(Date.now());
  const logRender = useCallback(() => {
    renderCountRef.current += 1;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    lastRenderTime.current = now;
    if (process.env.NODE_ENV === 'development') {
      // Lightweight dev-only logging to monitor render frequency
      console.debug(`[Perf] ${componentName} render`, {
        renderCount: renderCountRef.current,
        timeSinceLastRender
      });
    }
  }, [componentName]);
  // Log render in development
  if (process.env.NODE_ENV === 'development') {
    logRender();
  }
  return {
    renderCount: renderCountRef.current,
    logRender
  };
}