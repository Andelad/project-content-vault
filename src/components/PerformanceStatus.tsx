import React from 'react';
import { useAppDataOnly } from '../contexts/AppContext';
import { trackMemoryUsage } from '@/lib/performanceUtils';

// Temporary inline constants to fix import issue
const PERFORMANCE_LIMITS = {
  MAX_PROJECTS_PER_GROUP: 50,
  MAX_GROUPS: 20,
  MAX_EVENTS: 1000,
  MAX_HOLIDAYS: 100
} as const;

interface PerformanceStatusProps {
  className?: string;
}

export function PerformanceStatus({ className = '' }: PerformanceStatusProps) {
  const { projects, groups, events, holidays } = useAppDataOnly();
  
  // Calculate current usage
  const currentUsage = {
    projects: projects.length,
    groups: groups.length,
    events: events.length,
    holidays: holidays.length
  };

  // Calculate max projects in any group
  const maxProjectsInGroup = Math.max(
    ...groups.map(group => 
      projects.filter(p => p.groupId === group.id).length
    ),
    0
  );

  const memoryUsage = trackMemoryUsage();

  // Only show if approaching limits or in development
  const shouldShow = process.env.NODE_ENV === 'development' || 
    maxProjectsInGroup > PERFORMANCE_LIMITS.MAX_PROJECTS_PER_GROUP * 0.8 ||
    currentUsage.groups > PERFORMANCE_LIMITS.MAX_GROUPS * 0.8;

  if (!shouldShow) return null;

  return (
    <div className={`text-xs text-muted-foreground space-y-1 ${className}`}>
      <div className="flex gap-4">
        <span>
          Projects: {maxProjectsInGroup}/{PERFORMANCE_LIMITS.MAX_PROJECTS_PER_GROUP} per group
        </span>
        <span>
          Groups: {currentUsage.groups}/{PERFORMANCE_LIMITS.MAX_GROUPS}
        </span>
        {memoryUsage && (
          <span>
            Memory: {memoryUsage.used}MB/{memoryUsage.limit}MB
          </span>
        )}
      </div>
      {maxProjectsInGroup > PERFORMANCE_LIMITS.MAX_PROJECTS_PER_GROUP * 0.9 && (
        <div className="text-amber-600">
          ⚠ Approaching project limit - consider organizing into more groups
        </div>
      )}
    </div>
  );
}