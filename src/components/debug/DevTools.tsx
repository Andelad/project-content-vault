import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { getCacheStats, cleanupMemoizationCaches, UsageMetrics, performanceMonitor, calculateCacheHitRate, analyzeCachePerformance, generateCacheRecommendations } from '@/services';
import { useProjectContext } from '../../contexts/ProjectContext';
import { usePlannerContext } from '../../contexts/PlannerContext';
import { PERFORMANCE_LIMITS } from '@/constants';
import { Eye, EyeOff, Trash2, Activity, Database } from 'lucide-react';
interface PerformanceMetrics {
  renderCount: number;
  memoryUsage: number;
  cacheHitRate: number;
  avgRenderTime: number;
}
export function DevTools() {
  const [isVisible, setIsVisible] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderCount: 0,
    memoryUsage: 0,
    cacheHitRate: 0,
    avgRenderTime: 0
  });
  const { projects, groups } = useProjectContext();
  const { events, holidays } = usePlannerContext();
  // Toggle visibility with keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setIsVisible(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  // Update metrics periodically
  useEffect(() => {
    if (!isVisible) return;
    const interval = setInterval(() => {
      const cacheStats = getCacheStats();
      const performanceMetrics = performanceMonitor.getMetrics();
      setMetrics({
        renderCount: performanceMetrics.length || 0,
        memoryUsage: (window.performance as any)?.memory?.usedJSHeapSize || 0,
        cacheHitRate: calculateCacheHitRate(cacheStats),
        avgRenderTime: performanceMonitor.getAverageRenderTime() || 0
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isVisible]);
  const handleClearCache = () => {
    cleanupMemoizationCaches();
    if (process.env.NODE_ENV === 'development') {
    }
  };
  const getDataSummary = () => ({
    projects: projects.length,
    groups: groups.length,
    events: events.length,
    holidays: holidays.length,
    totalEntities: projects.length + groups.length + events.length + holidays.length
  });
  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-[1000]">
        <Button
          onClick={() => setIsVisible(true)}
          size="sm"
          variant="outline"
          className="bg-background/80 backdrop-blur-sm"
        >
          <Activity className="w-4 h-4" />
        </Button>
      </div>
    );
  }
  const cacheStats = getCacheStats();
  const dataSummary = getDataSummary();
  return (
    <div className="fixed bottom-4 right-4 z-[1000] w-80">
      <Card className="p-4 bg-background/95 backdrop-blur-sm border shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Dev Tools
          </h3>
          <Button
            onClick={() => setIsVisible(false)}
            size="sm"
            variant="ghost"
          >
            <EyeOff className="w-4 h-4" />
          </Button>
        </div>
        <div className="space-y-3 text-sm">
          {/* Performance Metrics */}
          <div>
            <h4 className="font-medium mb-2">Performance</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-muted-foreground">Renders:</span>
                <Badge variant="outline" className="ml-1">
                  {metrics.renderCount}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Avg Time:</span>
                <Badge variant="outline" className="ml-1">
                  {metrics.avgRenderTime}ms
                </Badge>
              </div>
            </div>
          </div>
          <Separator />
          {/* Data Summary */}
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Database className="w-3 h-3" />
              Data Summary
            </h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Projects:</span>
                <Badge variant={dataSummary.projects > 30 ? 'destructive' : 'outline'}>
                  {dataSummary.projects}/{PERFORMANCE_LIMITS.MAX_PROJECTS_PER_GROUP}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Groups:</span>
                <Badge variant={dataSummary.groups > 15 ? 'destructive' : 'outline'}>
                  {dataSummary.groups}/{PERFORMANCE_LIMITS.MAX_GROUPS}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Events:</span>
                <Badge variant={dataSummary.events > 500 ? 'destructive' : 'outline'}>
                  {dataSummary.events}/{PERFORMANCE_LIMITS.MAX_EVENTS}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Total:</span>
                <Badge variant="secondary">
                  {dataSummary.totalEntities}
                </Badge>
              </div>
            </div>
          </div>
          <Separator />
          {/* Cache Stats */}
          <div>
            <h4 className="font-medium mb-2">Cache Status</h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Timeline:</span>
                <Badge variant="outline">
                  {cacheStats.timeline.size}/{cacheStats.timeline.maxSize}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Dates:</span>
                <Badge variant="outline">
                  {cacheStats.dates.size}/{cacheStats.dates.maxSize}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Metrics:</span>
                <Badge variant="outline">
                  {cacheStats.projectMetrics.size}/{cacheStats.projectMetrics.maxSize}
                </Badge>
              </div>
            </div>
            <Button
              onClick={handleClearCache}
              size="sm"
              variant="outline"
              className="w-full mt-2"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Clear Cache
            </Button>
          </div>
          <Separator />
          {/* Data Maintenance Section Removed - Milestones use date-based ordering */}
          {/* Quick Actions */}
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground">
              Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+Shift+D</kbd> to toggle
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
// Development-only wrapper
export function DevToolsWrapper({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV !== 'development') {
    return <>{children}</>;
  }
  return (
    <>
      {children}
      <DevTools />
    </>
  );
}