import React, { memo, useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { UnifiedTimelineService, formatDuration } from '@/services';
import { formatWeekdayDate, formatDateShort } from '@/utils/dateFormatUtils';
import { usePlannerContext } from '../../contexts/PlannerContext';
import { useProjectContext } from '../../contexts/ProjectContext';

interface WorkloadGraphProps {
  dates: Date[];
  projects: any[];
  settings: any;
  mode: 'days' | 'weeks';
}

export const WorkloadGraph = memo(function WorkloadGraph({
  dates,
  projects,
  settings,
  mode
}: WorkloadGraphProps) {
  const { holidays, events } = usePlannerContext();
  const { milestones } = useProjectContext();
  
  // Match TimelineView's column width: 154px for weeks, 52px for days
  const columnWidth = mode === 'weeks' ? 153 : 52;

  // Calculate data for each date
  const graphData = useMemo(() => {
    return dates.map(date => {
      const workHours = UnifiedTimelineService.getWorkHoursForDay(date, holidays, settings);
      const plannedAndCompletedHours = UnifiedTimelineService.calculateTotalPlannedHours(date, events);
      
      return {
        date,
        workHours,
        plannedAndCompletedHours
      };
    });
  }, [dates, holidays, settings, events]);

  // Calculate max value for Y-axis (auto-scale)
  const maxYValue = useMemo(() => {
    const maxPlanned = Math.max(...graphData.map(d => d.plannedAndCompletedHours));
    const maxWork = Math.max(...graphData.map(d => d.workHours));
    const max = Math.max(maxPlanned, maxWork);
    // Round up to nearest hour for cleaner scale
    return Math.ceil(max);
  }, [graphData]);

  // Height of graph area (2 rows × 48px = 96px, minus padding)
  const graphHeight = 88;
  const graphPadding = { top: 8, bottom: 8, left: 0, right: 0 };
  const plotHeight = graphHeight - graphPadding.top - graphPadding.bottom;

  // Convert hours to Y coordinate
  const hoursToY = (hours: number) => {
    if (maxYValue === 0) return plotHeight;
    return plotHeight - (hours / maxYValue) * plotHeight;
  };

  // Generate available capacity area (green) below work hours line
  const generateAvailableCapacityPath = () => {
    if (graphData.length === 0) return '';
    
    const points = graphData.map((d, i) => {
      const x = i * columnWidth + columnWidth / 2;
      const plannedY = hoursToY(d.plannedAndCompletedHours);
      const workY = hoursToY(d.workHours);
      // Only show green when planned is below work hours
      const y = d.plannedAndCompletedHours < d.workHours ? plannedY : workY;
      return { x, y, isUnder: d.plannedAndCompletedHours < d.workHours };
    });

    let path = `M 0,${hoursToY(graphData[0]?.workHours || 0)} `;
    
    for (let i = 0; i < points.length; i++) {
      const workY = hoursToY(graphData[i].workHours);
      path += `L ${points[i].x},${workY} `;
    }
    
    for (let i = points.length - 1; i >= 0; i--) {
      path += `L ${points[i].x},${points[i].y} `;
    }
    
    path += 'Z';
    return path;
  };

  // Generate overcommitted area (red) above work hours line
  const generateOvercommittedPath = () => {
    if (graphData.length === 0) return '';
    
    const points = graphData.map((d, i) => {
      const x = i * columnWidth + columnWidth / 2;
      const plannedY = hoursToY(d.plannedAndCompletedHours);
      const workY = hoursToY(d.workHours);
      return { x, plannedY, workY, isOver: d.plannedAndCompletedHours > d.workHours };
    });

    // Build separate paths for overcommitted segments
    let paths: string[] = [];
    let currentPath = '';
    let inOvercommitted = false;

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      
      if (point.isOver) {
        if (!inOvercommitted) {
          // Start new overcommitted segment
          currentPath = `M ${point.x},${point.workY} `;
          inOvercommitted = true;
        }
        currentPath += `L ${point.x},${point.plannedY} `;
      } else {
        if (inOvercommitted) {
          // Close current segment
          currentPath += `L ${points[i-1].x},${points[i-1].workY} Z`;
          paths.push(currentPath);
          currentPath = '';
          inOvercommitted = false;
        }
      }
    }
    
    // Close final segment if still in overcommitted
    if (inOvercommitted && points.length > 0) {
      const lastPoint = points[points.length - 1];
      currentPath += `L ${lastPoint.x},${lastPoint.workY} Z`;
      paths.push(currentPath);
    }

    return paths.join(' ');
  };

  return (
    <div className="h-24 relative flex items-center" style={{ minWidth: `${dates.length * columnWidth}px` }}>
      <svg
        width={dates.length * columnWidth}
        height={graphHeight}
        className="absolute top-0 left-0"
        style={{ overflow: 'visible', pointerEvents: 'none', zIndex: 20 }}
      >
        <g transform={`translate(0, ${graphPadding.top})`}>
          {/* Baseline at 0 hours */}
          <line
            x1={0}
            y1={plotHeight}
            x2={dates.length * columnWidth}
            y2={plotHeight}
            stroke="rgb(209, 213, 219)"
            strokeWidth={1}
          />
          
          {/* Available capacity (green area below work hours) */}
          <path
            d={generateAvailableCapacityPath()}
            fill="rgb(34, 197, 94)"
            fillOpacity={0.3}
          />
          
          {/* Overcommitted area (red above work hours) */}
          <path
            d={generateOvercommittedPath()}
            fill="rgb(239, 68, 68)"
            fillOpacity={0.4}
          />
          
          {/* Work hours line (dashed) */}
          <path
            d={`M 0,${hoursToY(graphData[0]?.workHours || 0)} ${graphData.map((d, i) => {
              const x = i * columnWidth + columnWidth / 2;
              const y = hoursToY(d.workHours);
              return `L ${x},${y}`;
            }).join(' ')}`}
            fill="none"
            stroke="rgb(75, 85, 99)"
            strokeWidth={1.5}
            strokeDasharray="4,4"
          />
          
          {/* Planned/Completed time line (no fill, just stroke) */}
          <path
            d={`M ${0 * columnWidth + columnWidth / 2},${hoursToY(graphData[0]?.plannedAndCompletedHours || 0)} ${graphData.map((d, i) => {
              const x = i * columnWidth + columnWidth / 2;
              const y = hoursToY(d.plannedAndCompletedHours);
              return `L ${x},${y}`;
            }).join(' ')}`}
            fill="none"
            stroke="rgb(107, 114, 128)"
            strokeWidth={2}
          />
        </g>
      </svg>
      
      {/* Data points for tooltips - separate layer with pointer events */}
      <div className="absolute top-0 left-0 w-full h-full" style={{ pointerEvents: 'none', zIndex: 30 }}>
        {graphData.map((d, i) => {
          const x = i * columnWidth + columnWidth / 2;
          const y = hoursToY(d.plannedAndCompletedHours) + graphPadding.top;
          
          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <div
                  className="absolute cursor-pointer"
                  style={{
                    left: `${x}px`,
                    top: `${y}px`,
                    transform: 'translate(-50%, -50%)',
                    width: '16px',
                    height: '16px',
                    pointerEvents: 'auto',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16">
                    <circle
                      cx="8"
                      cy="8"
                      r="4"
                      fill="rgb(107, 114, 128)"
                      stroke="white"
                      strokeWidth="2"
                      className="hover:r-6 transition-all"
                    />
                  </svg>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  <div className="font-medium text-gray-800">
                    {mode === 'days' ? formatWeekdayDate(d.date) : `Week of ${formatDateShort(d.date)}`}
                  </div>
                  <div className="text-gray-600 mt-1">
                    Planned/Completed: {formatDuration(d.plannedAndCompletedHours)}
                  </div>
                  <div className="text-gray-600">
                    Work Hours: {formatDuration(d.workHours)}
                  </div>
                  {d.plannedAndCompletedHours > d.workHours && (
                    <div className="text-red-600 font-medium mt-1">
                      Overcommitted by {formatDuration(d.plannedAndCompletedHours - d.workHours)}
                    </div>
                  )}
                  {d.plannedAndCompletedHours < d.workHours && (
                    <div className="text-green-600 font-medium mt-1">
                      Available: {formatDuration(d.workHours - d.plannedAndCompletedHours)}
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
});
