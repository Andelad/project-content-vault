import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';

interface DragPerformanceMonitorProps {
  isDragging: boolean;
  timelineMode: 'days' | 'weeks';
  projectCount: number;
}

export function DragPerformanceMonitor({ 
  isDragging, 
  timelineMode, 
  projectCount 
}: DragPerformanceMonitorProps) {
  const [metrics, setMetrics] = useState({
    dragStartTime: 0,
    updateCount: 0,
    throttledCount: 0,
    avgResponseTime: 0
  });

  useEffect(() => {
    if (isDragging) {
      setMetrics(prev => ({
        ...prev,
        dragStartTime: performance.now(),
        updateCount: 0,
        throttledCount: 0
      }));
    } else if (metrics.dragStartTime > 0) {
      const totalTime = performance.now() - metrics.dragStartTime;
      const efficiency = metrics.throttledCount > 0 
        ? ((metrics.throttledCount / metrics.updateCount) * 100).toFixed(1)
        : '0';
      
      // Performance metrics calculated but not logged in production
    }
  }, [isDragging, timelineMode, projectCount, metrics.dragStartTime, metrics.updateCount, metrics.throttledCount]);

  // Only show in development mode
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  if (!isDragging || metrics.updateCount === 0) {
    return null;
  }

  const efficiency = metrics.throttledCount > 0 
    ? ((metrics.throttledCount / metrics.updateCount) * 100).toFixed(0)
    : '0';

  return (
    <Card className="fixed top-4 right-4 p-3 bg-black/80 text-white text-xs z-50 min-w-[200px]">
      <div className="space-y-1">
        <div className="font-semibold text-green-400">🎯 Drag Performance</div>
        <div>Mode: {timelineMode}</div>
        <div>Projects: {projectCount}</div>
        <div>Updates: {metrics.updateCount}</div>
        <div>Throttled: {efficiency}%</div>
        <div className="text-green-400">
          {efficiency === '0' ? '⚠️ No optimization' : '✅ Optimized'}
        </div>
      </div>
    </Card>
  );
}
