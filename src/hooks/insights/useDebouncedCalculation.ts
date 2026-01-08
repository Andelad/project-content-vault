/**
 * useDebouncedCalculation Hook
 * 
 * Debounces expensive calculations to prevent blocking UI during rapid state changes.
 * 
 * **Use Cases**:
 * - Insights card calculations that filter/reduce large datasets
 * - Chart data transformations triggered by user input
 * - Any calculation that takes >100ms and responds to frequent changes
 * 
 * **How it Works**:
 * - Calculates immediately on first render (no loading state on mount)
 * - Debounces subsequent calculations when dependencies change
 * - Cancels pending calculations if dependencies change again
 * - Preserves last result while new calculation is pending
 * 
 * @param calculate - Function that performs the expensive calculation
 * @param dependencies - Array of values that trigger recalculation
 * @param delay - Debounce delay in milliseconds (default: 300ms)
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
 *   300
 * );
 * 
 * return <Chart data={chartData} />;
 * ```
 */

import { useState, useEffect, useRef } from 'react';

export function useDebouncedCalculation<T>(
  calculate: () => T,
  dependencies: unknown[],
  delay: number = 300
): T | null {
  const [result, setResult] = useState<T | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);
  
  useEffect(() => {
    // Clear any pending calculation
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // On first render, calculate immediately (no debounce)
    // This prevents loading spinner when navigating back to the page
    if (isFirstRender.current) {
      isFirstRender.current = false;
      try {
        const newResult = calculate();
        setResult(newResult);
      } catch (error) {
        console.error('Initial calculation failed:', error);
        setResult(null);
      }
      return;
    }
    
    // On subsequent changes, debounce the calculation
    timeoutRef.current = setTimeout(() => {
      console.time('Debounced Calculation');
      try {
        const newResult = calculate();
        setResult(newResult);
      } catch (error) {
        console.error('Debounced calculation failed:', error);
        setResult(null);
      } finally {
        console.timeEnd('Debounced Calculation');
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
