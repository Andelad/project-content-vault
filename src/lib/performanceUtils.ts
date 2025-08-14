import { useMemo } from 'react';

// Performance monitoring utilities
interface PerformanceMetrics {
  renderTime: number;
  componentName: string;
  timestamp: number;
  memoryUsage?: number;
}

const performanceLog: PerformanceMetrics[] = [];

export const performanceMonitor = {
  measureRender: (componentName: string) => {
    const startTime = performance.now();
    const startMemory = (performance as any).memory?.usedJSHeapSize;
    
    return () => {
      const endTime = performance.now();
      const endMemory = (performance as any).memory?.usedJSHeapSize;
      
      const metrics: PerformanceMetrics = {
        renderTime: endTime - startTime,
        componentName,
        timestamp: Date.now(),
        memoryUsage: endMemory ? endMemory - startMemory : undefined
      };
      
      performanceLog.push(metrics);
      
      // Keep only last 100 measurements
      if (performanceLog.length > 100) {
        performanceLog.shift();
      }
      
      // Log slow renders in development
      if (process.env.NODE_ENV === 'development' && metrics.renderTime > 16) {
        console.warn(`Slow render detected: ${componentName} took ${metrics.renderTime.toFixed(2)}ms`);
      }
    };
  },
  
  getMetrics: () => [...performanceLog],
  
  clearMetrics: () => {
    performanceLog.length = 0;
  },
  
  getAverageRenderTime: (componentName?: string) => {
    const relevantMetrics = componentName 
      ? performanceLog.filter(m => m.componentName === componentName)
      : performanceLog;
    
    if (relevantMetrics.length === 0) return 0;
    
    const totalTime = relevantMetrics.reduce((sum, m) => sum + m.renderTime, 0);
    return totalTime / relevantMetrics.length;
  }
};

// Memoized date string comparison to avoid repeated toString calls
export const useDateComparison = (dates: Date[], projectDays: Date[]) => {
  return useMemo(() => {
    const projectDayStrings = new Set(projectDays.map(d => d.toDateString()));
    return dates.map(date => ({
      date,
      dateString: date.toDateString(),
      isProjectDay: projectDayStrings.has(date.toDateString())
    }));
  }, [dates, projectDays]);
};

// Memoized working day calculations
export const useWorkingDayCalculator = (settings: any) => {
  return useMemo(() => {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    return (date: Date) => {
      const dayName = dayNames[date.getDay()] as keyof typeof settings.weeklyWorkHours;
      return settings.weeklyWorkHours[dayName] > 0;
    };
  }, [settings.weeklyWorkHours]);
};

// Optimize date range calculations
export const getDateRange = (startDate: Date, endDate: Date, filterFn?: (date: Date) => boolean) => {
  const dates = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const currentDate = new Date(d);
    if (!filterFn || filterFn(currentDate)) {
      dates.push(currentDate);
    }
  }
  return dates;
};

// Debounced viewport calculations for smooth scrolling  
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Memory usage tracking
export const trackMemoryUsage = () => {
  if (typeof window !== 'undefined' && (performance as any).memory) {
    const memory = (performance as any).memory;
    return {
      used: Math.round(memory.usedJSHeapSize / 1024 / 1024), // MB
      total: Math.round(memory.totalJSHeapSize / 1024 / 1024), // MB
      limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024) // MB
    };
  }
  return null;
};