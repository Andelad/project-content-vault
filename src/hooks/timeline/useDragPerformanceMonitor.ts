import { useEffect, useRef } from 'react';

/**
 * Enhanced performance monitoring for timeline drag operations
 */
export function useDragPerformanceMonitor(
  isDragging: boolean,
  timelineMode: 'days' | 'weeks',
  projectCount: number
) {
  const dragStartTime = useRef<number>(0);
  const updateCount = useRef<number>(0);
  const lagMeasurements = useRef<number[]>([]);

  useEffect(() => {
    if (isDragging) {
      dragStartTime.current = performance.now();
      updateCount.current = 0;
      lagMeasurements.current = [];
      
      console.log(`🐭 Drag started in ${timelineMode} mode with ${projectCount} projects`);
    } else if (dragStartTime.current > 0) {
      const totalDragTime = performance.now() - dragStartTime.current;
      const avgLag = lagMeasurements.current.length > 0 
        ? lagMeasurements.current.reduce((a, b) => a + b, 0) / lagMeasurements.current.length 
        : 0;

      console.log(`🏁 Drag completed:`, {
        mode: timelineMode,
        projects: projectCount,
        totalTime: `${totalDragTime.toFixed(2)}ms`,
        updates: updateCount.current,
        avgLag: `${avgLag.toFixed(2)}ms`,
        performance: avgLag > 16 ? '⚠️ SLOW' : '✅ SMOOTH'
      });

      // Performance warnings
      if (timelineMode === 'weeks' && avgLag > 50) {
        console.warn(`⚠️ Weeks mode performance degraded with ${projectCount} projects. Consider switching to Days mode.`);
      }

      if (avgLag > 100) {
        console.warn(`🚨 Severe performance degradation detected. Consider reducing project count or optimizing further.`);
      }

      dragStartTime.current = 0;
    }
  }, [isDragging, timelineMode, projectCount]);

  const measureUpdate = (updateTime: number) => {
    if (isDragging) {
      updateCount.current++;
      lagMeasurements.current.push(updateTime);
      
      // Real-time performance feedback in development
      if (process.env.NODE_ENV === 'development' && updateTime > 16) {
        console.warn(`🐌 Slow drag update: ${updateTime.toFixed(2)}ms (target: <16ms)`);
      }
    }
  };

  return { measureUpdate };
}

/**
 * Performance recommendations based on usage patterns
 */
export function getPerformanceRecommendations(
  timelineMode: 'days' | 'weeks',
  projectCount: number,
  avgRenderTime: number
): string[] {
  const recommendations: string[] = [];

  if (timelineMode === 'weeks' && projectCount > 20) {
    recommendations.push('Consider switching to Days mode for better performance with many projects');
  }

  if (avgRenderTime > 50) {
    recommendations.push('Timeline performance is degraded. Consider reducing the number of visible projects');
  }

  if (timelineMode === 'weeks' && avgRenderTime > 16) {
    recommendations.push('Weeks mode is experiencing lag. Try collapsing project groups or using filters');
  }

  if (projectCount > 50) {
    recommendations.push('High project count detected. Consider using project groups and filters for better performance');
  }

  return recommendations;
}
