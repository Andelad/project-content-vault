import React from 'react';
import { useProjectContext } from '../../contexts/ProjectContext';
import { usePlannerContext } from '../../contexts/PlannerContext';
import { 
  analyzePerformance, 
  getPerformanceLimits,
  type PerformanceAnalysis 
} from '@/services';

interface PerformanceStatusProps {
  className?: string;
}

export function PerformanceStatus({ className = '' }: PerformanceStatusProps) {
  const { projects, groups } = useProjectContext();
  const { events, holidays } = usePlannerContext();
  
  // Get comprehensive performance analysis
  const analysis: PerformanceAnalysis = analyzePerformance(
    projects, 
    groups, 
    events, 
    holidays
  );
  
  const limits = getPerformanceLimits();

  // Don't show if no performance concerns
  if (!analysis.shouldShowStatus) return null;

  return (
    <div className={`text-xs text-muted-foreground space-y-1 ${className}`}>
      <div className="flex gap-4">
        <span>
          Projects: {analysis.maxProjectsInGroup}/{limits.maxProjectsPerGroup} per group
        </span>
        <span>
          Groups: {analysis.usage.groups}/{limits.maxGroups}
        </span>
        {analysis.memoryUsage && (
          <span>
            Memory: {analysis.memoryUsage.used}MB/{analysis.memoryUsage.limit}MB
          </span>
        )}
      </div>
      {/* Show performance warnings */}
      {analysis.warnings.map((warning, index) => (
        <div key={index} className="text-amber-600">
          {warning.message}
        </div>
      ))}
    </div>
  );
}