/**
 * useDebouncedCalculation Hook
 * 
 * Debounces expensive calculations to prevent blocking UI during rapid state changes.
 * Includes module-level caching to prevent recalculation when navigating back to a page.
 * 
 * **Use Cases**:
 * - Insights card calculations that filter/reduce large datasets
 * - Chart data transformations triggered by user input
 * - Any calculation that takes >100ms and responds to frequent changes
 * 
 * **How it Works**:
 * - Calculates immediately on first render (no loading state on mount)
 * - Caches results with a stable key to avoid recalc on remount
 * - Debounces subsequent calculations when dependencies change
 * - Cancels pending calculations if dependencies change again
 * - Preserves last result while new calculation is pending
 * 
 * @param calculate - Function that performs the expensive calculation
 * @param dependencies - Array of values that trigger recalculation
 * @param delay - Debounce delay in milliseconds (default: 300ms)
 * @param cacheKey - Optional stable key for cross-mount caching
 * @returns Calculated result (never null after first calculation)
 * 
 * @example
 * ```tsx
 * const chartData = useDebouncedCalculation(
 *   () => {
 *     const filtered = events.filter(e => e.date >= startDate);
 *     return filtered.map(e => ({ x: e.date, y: e.hours }));
 *   },
 *   [events, startDate],
 *   300,
 *   'time-distribution-chart' // Optional cache key
 * );
 * 
 * return <Chart data={chartData} />;
 * ```
 */

import { useState, useEffect, useRef, useMemo } from 'react';

// Module-level cache for persisting results across component unmounts
// Cache entries expire after 30 seconds to ensure data freshness
const calculationCache = new Map<string, { value: unknown; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

function getCachedValue<T>(key: string): T | null {
  const entry = calculationCache.get(key);
  if (!entry) return null;
  
  // Check if cache is still valid
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    calculationCache.delete(key);
    return null;
  }
  
  return entry.value as T;
}

function setCachedValue<T>(key: string, value: T): void {
  calculationCache.set(key, { value, timestamp: Date.now() });
}

export function useDebouncedCalculation<T>(
  calculate: () => T,
  dependencies: unknown[],
  delay: number = 300,
  cacheKey?: string
): T | null {
  // Try to get cached value first (for instant load on remount)
  const cachedValue = cacheKey ? getCachedValue<T>(cacheKey) : null;
  
  // Calculate initial value synchronously to avoid loading flash
  const initialValue = useMemo(() => {
    // Use cache if available
    if (cachedValue !== null) {
      return cachedValue;
    }
    
    try {
      const result = calculate();
      // Cache the result if we have a key
      if (cacheKey) {
        setCachedValue(cacheKey, result);
      }
      return result;
    } catch (error) {
      console.error('Initial calculation failed:', error);
      return null;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // ^ Empty deps - only run once on mount
  
  const [result, setResult] = useState<T | null>(initialValue);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);
  
  useEffect(() => {
    // Skip first render since we already calculated in useMemo
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    // Clear any pending calculation
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // On subsequent changes, debounce the calculation
    timeoutRef.current = setTimeout(() => {
      try {
        const newResult = calculate();
        setResult(newResult);
        // Update cache
        if (cacheKey) {
          setCachedValue(cacheKey, newResult);
        }
      } catch (error) {
        console.error('Debounced calculation failed:', error);
        setResult(null);
      }
    }, delay);
    
    // Cleanup timeout on unmount or dependency change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps
  // ^ Intentionally using dependencies array as-is
  
  return result;
}
