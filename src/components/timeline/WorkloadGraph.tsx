import React, { memo, useMemo, useState, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../ui/tooltip';
import { UnifiedTimelineService, formatDuration } from '@/services';
import { formatWeekdayDate, formatDateShort } from '@/utils/dateFormatUtils';
import { usePlannerContext } from '../../contexts/PlannerContext';
import { useProjectContext } from '../../contexts/ProjectContext';
import { NEUTRAL_COLORS } from '@/constants/colors';

interface WorkloadGraphProps {
  dates: Date[];
  projects: any[];
  settings: any;
  mode: 'days' | 'weeks';
  context?: 'timeline' | 'planner';
}

export const WorkloadGraph = memo(function WorkloadGraph({
  dates,
  projects,
  settings,
  mode,
  context = 'timeline'
}: WorkloadGraphProps) {
  const { holidays, events } = usePlannerContext();
  const { milestones } = useProjectContext();
  
  // For timeline: fixed column widths. For planner: will be calculated dynamically
  const timelineColumnWidth = mode === 'weeks' ? 153 : 52;
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);
  const [plannerColumnWidth, setPlannerColumnWidth] = useState<number>(0);
  
  // Measure planner column widths from flex layout
  useEffect(() => {
    if (context !== 'planner' || !containerRef) return;
    
    const updateWidth = () => {
      const container = containerRef;
      if (!container) return;
      const width = container.getBoundingClientRect().width;
      const columnWidth = width / dates.length;
      setPlannerColumnWidth(columnWidth);
    };
    
    updateWidth();
    
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(containerRef);
    
    return () => resizeObserver.disconnect();
  }, [context, containerRef, dates.length]);
  
  const columnWidth = context === 'planner' ? plannerColumnWidth : timelineColumnWidth;

  // Calculate data for each date, plus one additional date on each end to extend to edges
  const graphData = useMemo(() => {
    // Create extended dates array with one additional date at beginning and end
    const extendedDates = [];
    
    if (dates.length > 0) {
      // Add date before first visible date
      const firstDate = dates[0];
      const prevDate = new Date(firstDate);
      if (mode === 'weeks') {
        prevDate.setDate(prevDate.getDate() - 7);
      } else {
        prevDate.setDate(prevDate.getDate() - 1);
      }
      extendedDates.push(prevDate);
      
      // Add all visible dates
      extendedDates.push(...dates);
      
      // Add date after last visible date
      const lastDate = dates[dates.length - 1];
      const nextDate = new Date(lastDate);
      if (mode === 'weeks') {
        nextDate.setDate(nextDate.getDate() + 7);
      } else {
        nextDate.setDate(nextDate.getDate() + 1);
      }
      extendedDates.push(nextDate);
    }
    
    return extendedDates.map(date => {
      const workHours = UnifiedTimelineService.getWorkHoursForDay(date, holidays, settings);
      const plannedAndCompletedHours = UnifiedTimelineService.calculateTotalPlannedHours(date, events);
      // Net availability: positive = available time, negative = overcommitted
      const netAvailability = workHours - plannedAndCompletedHours;
      
      return {
        date,
        workHours,
        plannedAndCompletedHours,
        netAvailability
      };
    });
  }, [dates, holidays, settings, events, mode]);

  // Calculate max absolute value for Y-axis (symmetric scale around 0)
  const maxAbsValue = useMemo(() => {
    const absValues = graphData.map(d => Math.abs(d.netAvailability));
    const max = Math.max(...absValues, 1); // Minimum of 1 to avoid division by zero
    // Round up to nearest hour for cleaner scale
    return Math.ceil(max);
  }, [graphData]);

  // Height of graph area (2 rows × 52px = 104px, minus padding)
  const graphHeight = 104;
  const graphPadding = { top: 12, bottom: 12, left: 0, right: 0 };
  const plotHeight = graphHeight - graphPadding.top - graphPadding.bottom;

  // Convert net availability to Y coordinate (center at 0)
  const netAvailabilityToY = (netAvailability: number) => {
    if (maxAbsValue === 0) return plotHeight / 2;
    // Map from [-maxAbsValue, +maxAbsValue] to [plotHeight, 0]
    // 0 should be at center (plotHeight / 2)
    const centerY = plotHeight / 2;
    return centerY - (netAvailability / maxAbsValue) * (plotHeight / 2);
  };

  // Calculate intersection point where line crosses center (0)
  const calculateIntersection = (x1: number, y1: number, val1: number, x2: number, y2: number, val2: number) => {
    // Linear interpolation to find where value crosses 0
    const t = Math.abs(val1) / (Math.abs(val1) + Math.abs(val2));
    const intersectX = x1 + t * (x2 - x1);
    const intersectY = y1 + t * (y2 - y1);
    return { x: intersectX, y: intersectY };
  };

  // Generate available capacity area (green above 0 line)
  const generateAvailableCapacityPath = () => {
    if (graphData.length === 0) return '';
    
    const centerY = plotHeight / 2;
    const points = graphData.map((d, i) => {
      const x = i * columnWidth + columnWidth / 2;
      const y = netAvailabilityToY(d.netAvailability);
      return { x, y, value: d.netAvailability };
    });

    let forwardPath = '';
    let backwardPath = '';
    
    // Build the forward path along the line
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      
      if (i === 0) {
        // Start at appropriate position
        if (point.value >= 0) {
          forwardPath = `M ${point.x},${point.y} `;
          backwardPath = `L ${point.x},${centerY} `;
        } else {
          forwardPath = `M ${point.x},${centerY} `;
          backwardPath = `L ${point.x},${centerY} `;
        }
      } else {
        const prevPoint = points[i - 1];
        
        // Check if line crosses center between previous and current point
        if ((prevPoint.value > 0 && point.value < 0) || (prevPoint.value < 0 && point.value > 0)) {
          const intersection = calculateIntersection(
            prevPoint.x, prevPoint.y, prevPoint.value,
            point.x, point.y, point.value
          );
          
          if (prevPoint.value > 0) {
            // Going from positive to negative
            forwardPath += `L ${intersection.x},${centerY} `;
            backwardPath = `L ${intersection.x},${centerY} ` + backwardPath;
          } else {
            // Going from negative to positive
            forwardPath += `L ${intersection.x},${centerY} L ${point.x},${point.y} `;
            backwardPath = `L ${point.x},${centerY} L ${intersection.x},${centerY} ` + backwardPath;
          }
        } else if (point.value >= 0) {
          // Both points positive
          forwardPath += `L ${point.x},${point.y} `;
          backwardPath = `L ${point.x},${centerY} ` + backwardPath;
        } else {
          // Both points negative - stay on center line
          forwardPath += `L ${point.x},${centerY} `;
          backwardPath = `L ${point.x},${centerY} ` + backwardPath;
        }
      }
    }
    
    return forwardPath + backwardPath + 'Z';
  };

  // Generate overcommitted area (red below 0 line)
  const generateOvercommittedPath = () => {
    if (graphData.length === 0) return '';
    
    const centerY = plotHeight / 2;
    const points = graphData.map((d, i) => {
      const x = i * columnWidth + columnWidth / 2;
      const y = netAvailabilityToY(d.netAvailability);
      return { x, y, value: d.netAvailability };
    });

    let forwardPath = '';
    let backwardPath = '';
    
    // Build the forward path along the line
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      
      if (i === 0) {
        // Start at appropriate position
        if (point.value <= 0) {
          forwardPath = `M ${point.x},${point.y} `;
          backwardPath = `L ${point.x},${centerY} `;
        } else {
          forwardPath = `M ${point.x},${centerY} `;
          backwardPath = `L ${point.x},${centerY} `;
        }
      } else {
        const prevPoint = points[i - 1];
        
        // Check if line crosses center between previous and current point
        if ((prevPoint.value > 0 && point.value < 0) || (prevPoint.value < 0 && point.value > 0)) {
          const intersection = calculateIntersection(
            prevPoint.x, prevPoint.y, prevPoint.value,
            point.x, point.y, point.value
          );
          
          if (prevPoint.value < 0) {
            // Going from negative to positive
            forwardPath += `L ${intersection.x},${centerY} `;
            backwardPath = `L ${intersection.x},${centerY} ` + backwardPath;
          } else {
            // Going from positive to negative
            forwardPath += `L ${intersection.x},${centerY} L ${point.x},${point.y} `;
            backwardPath = `L ${point.x},${centerY} L ${intersection.x},${centerY} ` + backwardPath;
          }
        } else if (point.value <= 0) {
          // Both points negative
          forwardPath += `L ${point.x},${point.y} `;
          backwardPath = `L ${point.x},${centerY} ` + backwardPath;
        } else {
          // Both points positive - stay on center line
          forwardPath += `L ${point.x},${centerY} `;
          backwardPath = `L ${point.x},${centerY} ` + backwardPath;
        }
      }
    }
    
    return forwardPath + backwardPath + 'Z';
  };

  // Don't render until we have column width in planner context
  if (context === 'planner' && plannerColumnWidth === 0) {
    return <div ref={setContainerRef} className="relative flex items-center w-full" style={{ height: '104px' }} />;
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div 
        ref={context === 'planner' ? setContainerRef : undefined}
        className="relative flex items-center" 
        style={{ 
          minWidth: context === 'timeline' ? `${dates.length * columnWidth}px` : undefined,
          width: context === 'planner' ? '100%' : undefined,
          height: '104px' 
        }}
      >
      <svg
        width={(dates.length + 2) * columnWidth}
        height={graphHeight}
        className="absolute top-0"
        style={{ 
          overflow: 'visible', 
          pointerEvents: 'none', 
          zIndex: 20,
          left: `-${columnWidth}px`
        }}
      >
        <g transform={`translate(0, ${graphPadding.top})`}>
          {/* Center line at 0 */}
          <line
            x1={0}
            y1={plotHeight / 2}
            x2={(dates.length + 2) * columnWidth}
            y2={plotHeight / 2}
            stroke={NEUTRAL_COLORS.gray400}
            strokeWidth={1}
          />
          
          {/* Available capacity (green area above 0 line) */}
          <path
            d={generateAvailableCapacityPath()}
            fill="rgb(34, 197, 94)"
            fillOpacity={0.3}
          />
          
          {/* Overcommitted area (red below 0 line) */}
          <path
            d={generateOvercommittedPath()}
            fill="rgb(239, 68, 68)"
            fillOpacity={0.4}
          />
          
          {/* Net availability line */}
          <path
            d={`M ${columnWidth / 2},${netAvailabilityToY(graphData[0]?.netAvailability || 0)} ${graphData.map((d, i) => {
              const x = i * columnWidth + columnWidth / 2;
              const y = netAvailabilityToY(d.netAvailability);
              return `L ${x},${y}`;
            }).join(' ')}`}
            fill="none"
            stroke={NEUTRAL_COLORS.gray400}
            strokeWidth={1.5}
          />
        </g>
      </svg>
      
      {/* Column borders for planner view */}
      {context === 'planner' && (
        <div className="absolute top-0 left-0 w-full h-full flex" style={{ pointerEvents: 'none', zIndex: 25 }}>
          {dates.map((_, i) => (
            <div 
              key={i} 
              className="flex-1 border-r border-gray-200"
              style={{ height: '100%' }}
            />
          ))}
        </div>
      )}
      
      {/* Data points for tooltips - separate layer with pointer events */}
      <div className="absolute top-0 left-0 w-full h-full" style={{ pointerEvents: 'none', zIndex: 30 }}>
        {graphData.map((d, i) => {
          // Skip the first and last points (extended dates outside visible range)
          if (i === 0 || i === graphData.length - 1) return null;
          
          const x = (i - 1) * columnWidth + columnWidth / 2;
          const y = netAvailabilityToY(d.netAvailability) + graphPadding.top;
          
          // Determine circle color based on net availability
          const isPositive = d.netAvailability > 0;
          const isNegative = d.netAvailability < 0;
          const isNeutral = d.netAvailability === 0;
          
          // Using OKLCH for perceptually uniform colors
          const fillColor = isPositive 
            ? 'oklch(0.75 0.15 145)'  // green - matched chroma
            : isNegative 
            ? 'oklch(0.68 0.15 25)'   // red - matched chroma
            : 'rgb(168, 162, 158)';   // stone-400
            
          const hoverColor = isPositive 
            ? 'oklch(0.85 0.12 145)'  // lighter green
            : isNegative 
            ? 'oklch(0.80 0.12 25)'   // lighter red
            : 'rgb(214, 211, 209)';   // stone-300
          
          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <div
                  className="absolute cursor-pointer group"
                  style={{
                    left: `${x}px`,
                    top: `${y}px`,
                    transform: 'translate(-50%, -50%)',
                    width: '22px',
                    height: '22px',
                    pointerEvents: 'auto',
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 22 22" className="overflow-visible">
                    {/* Outer circle - grows on hover with lighter shade */}
                    <circle
                      cx="11"
                      cy="11"
                      r="5"
                      fill={hoverColor}
                      className="transition-all duration-300 ease-out opacity-0 group-hover:opacity-100"
                      style={{ 
                        transformOrigin: 'center',
                        transform: 'scale(1)',
                      }}
                    />
                    <circle
                      cx="11"
                      cy="11"
                      r="5"
                      fill={hoverColor}
                      className="transition-all duration-300 ease-out opacity-0 group-hover:opacity-100 group-hover:scale-[2.2]"
                      style={{ 
                        transformOrigin: 'center',
                      }}
                    />
                    {/* Main circle */}
                    <circle
                      cx="11"
                      cy="11"
                      r="5"
                      fill={fillColor}
                      className="transition-all duration-200 opacity-0 group-hover:opacity-100"
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
                    Work Hours: {formatDuration(d.workHours)}
                  </div>
                  <div className="text-gray-600">
                    Planned/Completed: {formatDuration(d.plannedAndCompletedHours)}
                  </div>
                  {isPositive && (
                    <div className="text-green-600 font-medium mt-1">
                      Available: {formatDuration(d.netAvailability)}
                    </div>
                  )}
                  {isNegative && (
                    <div className="text-red-600 font-medium mt-1">
                      Overcommitted: {formatDuration(Math.abs(d.netAvailability))}
                    </div>
                  )}
                  {isNeutral && (
                    <div className="text-stone-600 font-medium mt-1">
                      Perfectly Balanced
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
    </TooltipProvider>
  );
});
