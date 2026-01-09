import React, { memo, useState, useMemo, useEffect, useCallback } from 'react';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../shadcn/popover';
import { Button } from '../shadcn/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../shadcn/tooltip';
import { Card } from '../shadcn/card';
import { useEvents } from '@/presentation/hooks/data/useEvents';
import { useHolidays } from '@/presentation/hooks/data/useHolidays';
import { formatDuration } from '@/presentation/utils/dateCalculations';
import { generateWorkHoursForDate } from '@/domain/rules/availability/EventWorkHourIntegration';
import { calculateWorkHoursTotal } from '@/domain/rules/availability/WorkHourGeneration';
import { calculateHabitTimeWithinWorkSlots, calculatePlannedTimeNotOverlappingHabits, calculateTotalPlannedHours, calculateOtherTime } from '@/domain/rules/availability/CapacityAnalysis';
import { calculateDailyProjectHours } from '@/domain/rules/availability/DailyMetrics';;
import { formatWeekdayDate, formatDateShort, formatWeekRange } from '@/presentation/utils/dateFormatUtils';
import { NEUTRAL_COLORS } from '@/presentation/constants/colors';
import type { Project, Settings, PhaseDTO, CalendarEvent, Holiday } from '@/shared/types/core';
import { TabComponent } from './TabComponent';
import { AvailabilityCardSettingsButton } from './AvailabilityCardSettingsButton';
import { AvailabilityCardModal } from '../modals/AvailabilityCardModal';

interface InfoButtonProps {
  title: string;
  description: string;
}

const InfoButton = ({ title, description }: InfoButtonProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 rounded-full p-0 hover:bg-gray-50 text-gray-400 hover:text-gray-500"
        >
          <Info className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" side="top">
        <div className="space-y-2">
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface AvailabilityCardProps {
  collapsed: boolean;
  dates: Date[];
  projects: Project[];
  settings: Settings;
  mode: 'days' | 'weeks';
  columnMarkersOverlay?: React.ReactNode;
  context?: 'timeline' | 'planner';
  timeGutterWidth?: number;
  scrollbarWidth?: number;
  phases?: PhaseDTO[]; // Optional for now to maintain backward compatibility
}

export const AvailabilityCard = memo(function AvailabilityCard({
  collapsed,
  dates,
  projects,
  settings,
  mode,
  columnMarkersOverlay,
  context = 'timeline',
  timeGutterWidth = 0,
  scrollbarWidth = 0,
  phases = []
}: AvailabilityCardProps) {
  const [activeTab, setActiveTab] = useState<'time-spent' | 'availability-graph' | 'availability-graph-old' | 'availability-graph-3'>('availability-graph-3');
  const [hoveredColumnIndex, setHoveredColumnIndex] = useState<number | null>(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  
  const { holidays } = useHolidays();
  const { events: rawEvents } = useEvents();

  // Transform raw events to CalendarEvent format
  const events: CalendarEvent[] = useMemo(() => rawEvents.map(e => ({
    id: e.id,
    title: e.title,
    description: e.description || '',
    startTime: new Date(e.start_time),
    endTime: new Date(e.end_time),
    projectId: e.project_id || undefined,
    color: e.color || '',
    completed: e.completed ?? false,
    duration: e.duration,
    category: (e.category || 'event') as 'event' | 'habit' | 'task',
    type: (e.event_type || 'planned') as 'planned' | 'tracked' | 'completed',
    recurringGroupId: e.recurring_group_id || undefined
  })), [rawEvents]);

  // For timeline: fixed column widths. For planner: calculated dynamically
  const timelineColumnWidth = mode === 'weeks' ? 153 : 52;
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);
  const [plannerColumnWidth, setPlannerColumnWidth] = useState<number>(0);
  
  // Measure planner column widths from flex layout
  useEffect(() => {
    if (context !== 'planner' || !containerRef) return;
    
    const updateWidth = () => {
      if (!containerRef) return;
      const width = containerRef.getBoundingClientRect().width;
      setPlannerColumnWidth(width / dates.length);
    };
    
    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(containerRef);
    
    return () => resizeObserver.disconnect();
  }, [context, containerRef, dates.length]);
  
  const columnWidth = context === 'planner' ? plannerColumnWidth : timelineColumnWidth;

  const timeSpentRows = [
    {
      type: 'total-planned' as const,
      label: 'Completed Project Time'
    },
    {
      type: 'other-time' as const,
      label: 'Other Time'
    }
  ];

  const isGraphTab = activeTab === 'availability-graph' || activeTab === 'availability-graph-old' || activeTab === 'availability-graph-3';

  // ===== HELPER FUNCTIONS =====
  // Helper function to get week dates
  const getWeekDates = useCallback((weekStart: Date) => {
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      weekDates.push(date);
    }
    return weekDates;
  }, []);

  // ===== WORKLOAD GRAPH CALCULATION =====
  const graphData = useMemo(() => {
    const extendedDates = [];
    
    if (dates.length > 0) {
      const firstDate = dates[0];
      const prevDate = new Date(firstDate);
      prevDate.setDate(prevDate.getDate() - (mode === 'weeks' ? 7 : 1));
      extendedDates.push(prevDate);
      extendedDates.push(...dates);
      
      const lastDate = dates[dates.length - 1];
      const nextDate = new Date(lastDate);
      nextDate.setDate(nextDate.getDate() + (mode === 'weeks' ? 7 : 1));
      extendedDates.push(nextDate);
    }
    
    return extendedDates.map(date => {
      // For weeks mode in timeline, calculate totals for the entire week
      // For planner, always show daily totals (even when mode='weeks')
      const datesToProcess = (mode === 'weeks' && context === 'timeline') ? getWeekDates(date) : [date];
      
      let totalWorkHours = 0;
      let totalHabitTime = 0;
      let totalPlannedTime = 0;
      let totalEstimatedHours = 0;
      
      datesToProcess.forEach(d => {
        // Generate work hours for this date (holidays override work hours)
        const workHoursForDate = generateWorkHoursForDate(d, settings, holidays);
        totalWorkHours += calculateWorkHoursTotal(workHoursForDate);
        
        // Calculate habit time within work slots (excluding portion covered by planned events)
        totalHabitTime += calculateHabitTimeWithinWorkSlots(d, events, workHoursForDate);
        
        // Calculate ALL planned/completed project event time (even outside work hours)
        totalPlannedTime += calculatePlannedTimeNotOverlappingHabits(d, events, workHoursForDate);
        
        // Calculate total project hours (includes both planned events and auto-estimates)
        const totalProjectHours = calculateDailyProjectHours(
          d, 
          projects, 
          settings, 
          holidays, 
          phases,
          events
        );
        
        // Get ONLY auto-estimate hours (total project hours minus planned event hours for this day)
        const dailyPlannedTime = calculatePlannedTimeNotOverlappingHabits(d, events, workHoursForDate);
        totalEstimatedHours += Math.max(0, totalProjectHours - dailyPlannedTime);
      });
      
      // Net Availability = Work Hours - (Habit Time not covered + ALL Planned Time + Estimated Time)
      // - habitTime: only the portion in work hours NOT covered by planned events
      // - plannedTime: ALL planned/completed events (even outside work hours)
      // - estimatedHours: auto-estimates only (don't overlap with planned by design)
      const netAvailability = totalWorkHours - (totalHabitTime + totalPlannedTime + totalEstimatedHours);
      
      return {
        date,
        workHours: totalWorkHours,
        habitTime: totalHabitTime,
        plannedTime: totalPlannedTime,
        estimatedHours: totalEstimatedHours,
        netAvailability
      };
    });
  }, [context, dates, holidays, settings, events, projects, phases, mode, getWeekDates]);

  // ===== CAPACITY VS COMMITTED GRAPH (Availability 2) =====
  const graphData2 = useMemo(() => {
    const extendedDates = [];
    
    if (dates.length > 0) {
      const firstDate = dates[0];
      const prevDate = new Date(firstDate);
      prevDate.setDate(prevDate.getDate() - (mode === 'weeks' ? 7 : 1));
      extendedDates.push(prevDate);
      extendedDates.push(...dates);
      
      const lastDate = dates[dates.length - 1];
      const nextDate = new Date(lastDate);
      nextDate.setDate(nextDate.getDate() + (mode === 'weeks' ? 7 : 1));
      extendedDates.push(nextDate);
    }
    
    return extendedDates.map(date => {
      const datesToProcess = (mode === 'weeks' && context === 'timeline') ? getWeekDates(date) : [date];
      
      let capacity = 0; // Work hours (from work slots + overrides)
      let committed = 0; // Total committed time (habit + planned + estimated)
      
      datesToProcess.forEach(d => {
        // Capacity = work hours for this date
        const workHoursForDate = generateWorkHoursForDate(d, settings, holidays);
        capacity += calculateWorkHoursTotal(workHoursForDate);
        
        // Committed = habit time + planned time + estimated time
        const habitTime = calculateHabitTimeWithinWorkSlots(d, events, workHoursForDate);
        const plannedTime = calculatePlannedTimeNotOverlappingHabits(d, events, workHoursForDate);
        
        const totalProjectHours = calculateDailyProjectHours(
          d, 
          projects, 
          settings, 
          holidays, 
          phases,
          events
        );
        const dailyPlannedTime = calculatePlannedTimeNotOverlappingHabits(d, events, workHoursForDate);
        const estimatedHours = Math.max(0, totalProjectHours - dailyPlannedTime);
        
        committed += habitTime + plannedTime + estimatedHours;
      });
      
      return {
        date,
        capacity,
        committed,
        isOvercommitted: committed > capacity
      };
    });
  }, [context, dates, holidays, settings, events, projects, phases, mode, getWeekDates]);

  // Max value for graph 2 (capacity vs committed) - scale dynamically
  // Ensure the scale is at least capacity + 4 hours so capacity line is never at the top
  const maxGraph2Value = useMemo(() => {
    const maxCapacity = Math.max(...graphData2.map(d => d.capacity), 0);
    const maxCommitted = Math.max(...graphData2.map(d => d.committed), 0);
    const minScale = maxCapacity + 4; // Capacity + 4 hours buffer
    return Math.ceil(Math.max(maxCommitted, minScale, 1));
  }, [graphData2]);

  const maxAbsValue = useMemo(() => {
    const absValues = graphData.map(d => Math.abs(d.netAvailability));
    return Math.ceil(Math.max(...absValues, 1));
  }, [graphData]);

  const graphHeight = 96;
  const graphPadding = { top: 12, bottom: 12 };
  const plotHeight = graphHeight - graphPadding.top - graphPadding.bottom;

  const netAvailabilityToY = (netAvailability: number) => {
    if (maxAbsValue === 0) return plotHeight / 2;
    const centerY = plotHeight / 2;
    return centerY - (netAvailability / maxAbsValue) * (plotHeight / 2);
  };

  const calculateIntersection = (x1: number, y1: number, val1: number, x2: number, y2: number, val2: number) => {
    const t = Math.abs(val1) / (Math.abs(val1) + Math.abs(val2));
    return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
  };

  const generatePath = (checkValue: (val: number) => boolean) => {
    if (graphData.length === 0) return '';
    const centerY = plotHeight / 2;
    const points = graphData.map((d, i) => ({
      x: i * columnWidth + columnWidth / 2,
      y: netAvailabilityToY(d.netAvailability),
      value: d.netAvailability
    }));

    let forwardPath = '';
    let backwardPath = '';
    
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      
      if (i === 0) {
        if (checkValue(point.value)) {
          forwardPath = `M ${point.x},${point.y} `;
          backwardPath = `L ${point.x},${centerY} `;
        } else {
          forwardPath = `M ${point.x},${centerY} `;
          backwardPath = `L ${point.x},${centerY} `;
        }
      } else {
        const prevPoint = points[i - 1];
        if ((prevPoint.value > 0 && point.value < 0) || (prevPoint.value < 0 && point.value > 0)) {
          const intersection = calculateIntersection(prevPoint.x, prevPoint.y, prevPoint.value, point.x, point.y, point.value);
          if (checkValue(prevPoint.value)) {
            forwardPath += `L ${intersection.x},${centerY} `;
            backwardPath = `L ${intersection.x},${centerY} ` + backwardPath;
          } else {
            forwardPath += `L ${intersection.x},${centerY} L ${point.x},${point.y} `;
            backwardPath = `L ${point.x},${centerY} L ${intersection.x},${centerY} ` + backwardPath;
          }
        } else if (checkValue(point.value)) {
          forwardPath += `L ${point.x},${point.y} `;
          backwardPath = `L ${point.x},${centerY} ` + backwardPath;
        } else {
          forwardPath += `L ${point.x},${centerY} `;
          backwardPath = `L ${point.x},${centerY} ` + backwardPath;
        }
      }
    }
    
    return forwardPath + backwardPath + 'Z';
  };

  // ===== TIME SPENT CALCULATION =====
  const getHours = (date: Date, type: 'total-planned' | 'other-time') => {
    const getDailyHours = (d: Date) => {
      const workHoursForDate = generateWorkHoursForDate(d, settings, holidays);
      return type === 'total-planned'
        ? calculateTotalPlannedHours(d, events)
        : calculateOtherTime(d, events, workHoursForDate);
    };

    // For timeline view in weeks mode, aggregate the week
    // For planner view, always show individual days (even when mode is 'weeks')
    if (mode === 'weeks' && context === 'timeline') {
      return getWeekDates(date).reduce((total, d) => total + getDailyHours(d), 0);
    }
    return getDailyHours(date);
  };

  // ===== RENDER FUNCTIONS =====
  const renderWorkloadGraph = () => {
    if (context === 'planner' && plannerColumnWidth === 0) {
      return <div style={{ height: '96px' }} />;
    }

    const graphWidth = context === 'planner' ? '100%' : mode === 'weeks' ? `${dates.length * columnWidth}px` : `${dates.length * columnWidth + columnWidth}px`;

    return (
      <TooltipProvider delayDuration={100}>
        <div className="relative flex items-center" style={{ width: graphWidth, height: '96px', overflow: 'visible' }}>
          {/* Graph SVG layer - clipped to container */}
          <div className="absolute inset-0" style={{ overflow: 'hidden', zIndex: 20 }}>
            <svg width={(dates.length + 2) * columnWidth} height={graphHeight} className="absolute top-0" style={{ pointerEvents: 'none', left: `-${columnWidth}px` }}>
              <g transform={`translate(0, ${graphPadding.top})`}>
                <line x1={0} y1={plotHeight / 2} x2={(dates.length + 2) * columnWidth} y2={plotHeight / 2} stroke={NEUTRAL_COLORS.gray400} strokeWidth={1} />
                <path d={generatePath((v) => v >= 0)} fill="rgb(34, 197, 94)" fillOpacity={0.3} />
                <path d={generatePath((v) => v <= 0)} fill="rgb(239, 68, 68)" fillOpacity={0.4} />
                <path d={`M ${columnWidth / 2},${netAvailabilityToY(graphData[0]?.netAvailability || 0)} ${graphData.map((d, i) => `L ${i * columnWidth + columnWidth / 2},${netAvailabilityToY(d.netAvailability)}`).join(' ')}`} fill="none" stroke={NEUTRAL_COLORS.gray400} strokeWidth={2} />
              </g>
            </svg>
          </div>
          
          {/* Data point circles - overflow visible for hover effects */}
          <div className="absolute top-0 left-0 pointer-events-none" style={{ zIndex: 22, overflow: 'visible' }}>
            {dates.map((_, dateIndex) => {
              const graphDataIndex = dateIndex + 1; // graphData has 1 extra date at the start
              const d = graphData[graphDataIndex];
              if (!d) return null;
              
              const x = dateIndex * columnWidth + columnWidth / 2;
              const y = netAvailabilityToY(d.netAvailability) + graphPadding.top;
              const isPositive = d.netAvailability > 0;
              const isNegative = d.netAvailability < 0;
              
              const fillColor = isPositive ? 'rgb(34, 197, 94)' : isNegative ? 'rgb(239, 68, 68)' : 'rgb(214, 211, 209)';
              const hoverColor = isPositive ? 'oklch(0.85 0.12 145)' : isNegative ? 'oklch(0.80 0.12 25)' : 'rgb(214, 211, 209)';

              return (
                <div
                  key={dateIndex}
                  className="absolute"
                  style={{
                    left: `${x}px`,
                    top: `${y}px`,
                    transform: 'translate(-50%, -50%)',
                    width: '22px',
                    height: '22px',
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 22 22" className="overflow-visible">
                    {/* Default grey dot - always visible */}
                    <circle
                      cx="11"
                      cy="11"
                      r="3"
                      fill={NEUTRAL_COLORS.gray400}
                      className={`transition-opacity duration-200 ${hoveredColumnIndex === dateIndex ? 'opacity-0' : 'opacity-100'}`}
                    />
                    {/* Hover effects */}
                    <circle
                      cx="11"
                      cy="11"
                      r="5"
                      fill={hoverColor}
                      className={`transition-all duration-300 ease-out ${hoveredColumnIndex === dateIndex ? 'opacity-100' : 'opacity-0'}`}
                      style={{ transformOrigin: 'center', transform: 'scale(1)' }}
                    />
                    <circle
                      cx="11"
                      cy="11"
                      r="5"
                      fill={hoverColor}
                      className={`transition-all duration-300 ease-out ${hoveredColumnIndex === dateIndex ? 'opacity-100 scale-[2.2]' : 'opacity-0'}`}
                      style={{ transformOrigin: 'center' }}
                    />
                    <circle
                      cx="11"
                      cy="11"
                      r="5"
                      fill={fillColor}
                      className={`transition-all duration-200 ${hoveredColumnIndex === dateIndex ? 'opacity-100' : 'opacity-0'}`}
                    />
                  </svg>
                </div>
              );
            })}
          </div>
          
          <div className="absolute top-0 left-0 h-full flex" style={{ zIndex: 25, width: context === 'planner' ? '100%' : `${dates.length * columnWidth}px` }}>
            {dates.map((_, i) => {
              const columnData = graphData[i + 1];
              const columnElement = (
                <div className={context === 'planner' ? 'flex-1 relative' : 'relative'} style={context === 'timeline' ? { width: `${columnWidth}px`, height: '100%' } : { height: '100%' }} onMouseEnter={() => setHoveredColumnIndex(i)} onMouseLeave={() => setHoveredColumnIndex(null)}>
                  <div className={`absolute inset-0 bg-black transition-opacity duration-200 pointer-events-none ${hoveredColumnIndex === i ? 'opacity-[0.04]' : 'opacity-0'}`} />
                </div>
              );

              if (!columnData) return React.cloneElement(columnElement, { key: i });

              const isPositive = columnData.netAvailability > 0;
              const isNegative = columnData.netAvailability < 0;

              return (
                <Tooltip key={i} open={hoveredColumnIndex === i}>
                  <TooltipTrigger asChild>{columnElement}</TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      <div className="font-medium text-gray-800">{mode === 'days' ? formatWeekdayDate(columnData.date) : `Week of ${formatDateShort(columnData.date)}`}</div>
                      <div className="text-gray-600 mt-1">Work Hours: {formatDuration(columnData.workHours)}</div>
                      <div className="text-gray-600">Habit Overlap (net): {formatDuration(columnData.habitTime)}</div>
                      <div className="text-gray-600">Planned/Completed: {formatDuration(columnData.plannedTime)}</div>
                      <div className="text-gray-600">Estimated: {formatDuration(columnData.estimatedHours)}</div>
                      {isPositive && <div className="text-green-600 font-medium mt-1">Available: {formatDuration(columnData.netAvailability)}</div>}
                      {isNegative && <div className="text-red-600 font-medium mt-1">Overcommitted: {formatDuration(Math.abs(columnData.netAvailability))}</div>}
                      {!isPositive && !isNegative && <div className="text-stone-600 font-medium mt-1">Perfectly Balanced</div>}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          
          {context === 'planner' && (
            <div className="absolute top-0 left-0 w-full h-full flex" style={{ pointerEvents: 'none', zIndex: 26 }}>
              {dates.map((_, i) => <div key={i} className="flex-1 border-r border-gray-200" />)}
            </div>
          )}
        </div>
      </TooltipProvider>
    );
  };

  // ===== AVAILABILITY 3 GRAPH (baseline at very bottom, invisible, STRAIGHT lines) =====
  const renderCapacityVsCommittedGraph3 = () => {
    if (context === 'planner' && plannerColumnWidth === 0) {
      return <div style={{ height: '96px' }} />;
    }

    // Y-axis conversion: 0 at 8px from bottom, maxGraph2Value at top with 6px padding
    const graph3TopPadding = 6;
    const graph3BottomPadding = 8;
    const graph3PlotHeight = graphHeight - graph3TopPadding - graph3BottomPadding;
    const valueToY3 = (value: number) => {
      if (maxGraph2Value === 0) return graphHeight - graph3BottomPadding; // baseline at 8px from bottom
      return graph3TopPadding + graph3PlotHeight - (value / maxGraph2Value) * graph3PlotHeight;
    };

    const baselineY = graphHeight - graph3BottomPadding; // 8px up from the bottom of the card

    // Build points array
    const points = graphData2.map((d, i) => ({
      x: i * columnWidth + columnWidth / 2,
      yCommitted: valueToY3(d.committed),
      yCapacity: valueToY3(d.capacity),
      committed: d.committed,
      capacity: d.capacity
    }));

    // Generate straight line path
    const generateLinePath3 = (yKey: 'yCommitted' | 'yCapacity') => {
      if (points.length === 0) return '';
      let path = `M ${points[0].x},${points[0][yKey]}`;
      for (let i = 1; i < points.length; i++) {
        path += ` L ${points[i].x},${points[i][yKey]}`;
      }
      return path;
    };

    // Helper to find intersection point between two line segments
    const findIntersection = (i: number) => {
      const prevComm = points[i - 1].yCommitted;
      const currComm = points[i].yCommitted;
      const prevCap = points[i - 1].yCapacity;
      const currCap = points[i].yCapacity;
      
      const prevDiff = prevComm - prevCap;
      const currDiff = currComm - currCap;
      
      // Check if lines actually cross
      if (Math.sign(prevDiff) === Math.sign(currDiff) && prevDiff !== 0 && currDiff !== 0) {
        return null;
      }
      
      const t = Math.abs(prevDiff) / (Math.abs(prevDiff) + Math.abs(currDiff));
      return {
        x: points[i - 1].x + t * (points[i].x - points[i - 1].x),
        y: prevComm + t * (currComm - prevComm)
      };
    };

    // Generate stone fill (area under the minimum of committed and capacity, from baseline)
    const generateStoneFillPath3 = () => {
      if (points.length < 2) return '';
      
      // Build an array of points along the "lower" line (higher Y value = lower on screen)
      // This needs to handle intersections properly
      const lowerLinePoints: { x: number; y: number }[] = [];
      
      for (let i = 0; i < points.length; i++) {
        // Check for intersection before this point
        if (i > 0) {
          const prevCommLower = points[i - 1].yCommitted > points[i - 1].yCapacity;
          const currCommLower = points[i].yCommitted > points[i].yCapacity;
          
          if (prevCommLower !== currCommLower) {
            // Lines cross - add intersection point
            const intersection = findIntersection(i);
            if (intersection) {
              lowerLinePoints.push(intersection);
            }
          }
        }
        
        // Add the lower point at this index
        const lowerY = Math.max(points[i].yCommitted, points[i].yCapacity);
        lowerLinePoints.push({ x: points[i].x, y: lowerY });
      }
      
      // Build path from baseline, up to lower line, along it, back down to baseline
      let path = `M ${lowerLinePoints[0].x},${baselineY}`;
      path += ` L ${lowerLinePoints[0].x},${lowerLinePoints[0].y}`;
      
      for (let i = 1; i < lowerLinePoints.length; i++) {
        path += ` L ${lowerLinePoints[i].x},${lowerLinePoints[i].y}`;
      }
      
      path += ` L ${lowerLinePoints[lowerLinePoints.length - 1].x},${baselineY} Z`;
      
      return path;
    };

    // Generate fill paths for green (under capacity) and red (over capacity) regions
    const generateFillPaths3 = () => {
      if (points.length < 2) return { greenPath: '', redPath: '' };
      
      const greenRegions: string[] = [];
      const redRegions: string[] = [];
      
      // Process each segment between consecutive points
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        
        const p1Over = p1.yCommitted < p1.yCapacity; // committed higher (lower Y) = over capacity
        const p2Over = p2.yCommitted < p2.yCapacity;
        
        if (p1Over === p2Over) {
          // Same state throughout segment - simple quad
          // Skip if lines are equal (no area)
          if (p1.yCommitted === p1.yCapacity && p2.yCommitted === p2.yCapacity) continue;
          
          const path = `M ${p1.x},${p1.yCommitted} L ${p2.x},${p2.yCommitted} L ${p2.x},${p2.yCapacity} L ${p1.x},${p1.yCapacity} Z`;
          
          if (p1Over) {
            redRegions.push(path);
          } else {
            greenRegions.push(path);
          }
        } else {
          // Lines cross - find intersection and create two triangles
          const intersection = findIntersection(i + 1);
          if (!intersection) continue;
          
          // First triangle: from p1 to intersection
          const path1 = `M ${p1.x},${p1.yCommitted} L ${intersection.x},${intersection.y} L ${p1.x},${p1.yCapacity} Z`;
          if (p1Over) {
            redRegions.push(path1);
          } else {
            greenRegions.push(path1);
          }
          
          // Second triangle: from intersection to p2
          const path2 = `M ${intersection.x},${intersection.y} L ${p2.x},${p2.yCommitted} L ${p2.x},${p2.yCapacity} Z`;
          if (p2Over) {
            redRegions.push(path2);
          } else {
            greenRegions.push(path2);
          }
        }
      }
      
      return {
        greenPath: greenRegions.join(' '),
        redPath: redRegions.join(' ')
      };
    };

    const capacityLinePath3 = generateLinePath3('yCapacity');
    const committedLinePath3 = generateLinePath3('yCommitted');
    const { greenPath, redPath } = generateFillPaths3();
    const stoneFillPath3 = generateStoneFillPath3();

    const graphWidth = context === 'planner' ? '100%' : mode === 'weeks' ? `${dates.length * columnWidth}px` : `${dates.length * columnWidth + columnWidth}px`;

    return (
      <TooltipProvider delayDuration={100}>
        <div className="relative flex items-center" style={{ width: graphWidth, height: '96px', overflow: 'visible' }}>
          {/* Graph SVG layer - clipped to container */}
          <div className="absolute inset-0" style={{ overflow: 'hidden', zIndex: 20 }}>
            <svg width={(dates.length + 2) * columnWidth} height={graphHeight} className="absolute top-0" style={{ pointerEvents: 'none', left: `-${columnWidth}px` }}>
              <g>
                {/* Baseline - light gray line */}
                <line 
                  x1={0} 
                  y1={baselineY} 
                  x2={(dates.length + 2) * columnWidth} 
                  y2={baselineY} 
                  stroke={NEUTRAL_COLORS.gray200} 
                  strokeWidth={1}
                />
                
                {/* Stone fill: between baseline and committed/capacity line (excluding red areas) */}
                <path d={stoneFillPath3} fill="oklch(0.91 0.008 90)" fillOpacity={0.65} />
                
                {/* Green fill: committed under capacity */}
                <path d={greenPath} fill="rgb(34, 197, 94)" fillOpacity={0.3} />
                
                {/* Red fill: committed over capacity */}
                <path d={redPath} fill="rgb(239, 68, 68)" fillOpacity={0.4} />
                
                {/* Capacity line (dotted) */}
                <path 
                  d={capacityLinePath3} 
                  fill="none" 
                  stroke={NEUTRAL_COLORS.gray500} 
                  strokeWidth={2} 
                  strokeDasharray="4 4"
                />
                
                {/* Committed line (solid) */}
                <path 
                  d={committedLinePath3} 
                  fill="none" 
                  stroke={NEUTRAL_COLORS.gray400} 
                  strokeWidth={2} 
                />
              </g>
            </svg>
          </div>
          
          {/* Data point circles on committed line - hover effects only (no default dots) - overflow visible */}
          <div className="absolute top-0 left-0 pointer-events-none" style={{ zIndex: 22, overflow: 'visible' }}>
            {dates.map((_, dateIndex) => {
              const graphDataIndex = dateIndex + 1;
              const d = graphData2[graphDataIndex];
              if (!d) return null;
              
              const x = dateIndex * columnWidth + columnWidth / 2;
              const y = valueToY3(d.committed);
              const isOvercommitted = d.committed > d.capacity;
              const isUnderCapacity = d.committed < d.capacity;
              
              const fillColor = isOvercommitted ? 'rgb(239, 68, 68)' : isUnderCapacity ? 'rgb(34, 197, 94)' : 'rgb(214, 211, 209)';
              const hoverColor = isOvercommitted ? 'oklch(0.80 0.12 25)' : isUnderCapacity ? 'oklch(0.85 0.12 145)' : 'rgb(214, 211, 209)';

              return (
                <div
                  key={dateIndex}
                  className="absolute"
                  style={{
                    left: `${x}px`,
                    top: `${y}px`,
                    transform: 'translate(-50%, -50%)',
                    width: '22px',
                    height: '22px',
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 22 22" className="overflow-visible">
                    {/* Hover effects only - no default grey dot */}
                    <circle
                      cx="11"
                      cy="11"
                      r="5"
                      fill={hoverColor}
                      className={`transition-all duration-300 ease-out ${hoveredColumnIndex === dateIndex ? 'opacity-100' : 'opacity-0'}`}
                      style={{ transformOrigin: 'center', transform: 'scale(1)' }}
                    />
                    <circle
                      cx="11"
                      cy="11"
                      r="5"
                      fill={hoverColor}
                      className={`transition-all duration-300 ease-out ${hoveredColumnIndex === dateIndex ? 'opacity-100 scale-[2.2]' : 'opacity-0'}`}
                      style={{ transformOrigin: 'center' }}
                    />
                    <circle
                      cx="11"
                      cy="11"
                      r="5"
                      fill={fillColor}
                      className={`transition-all duration-200 ${hoveredColumnIndex === dateIndex ? 'opacity-100' : 'opacity-0'}`}
                    />
                  </svg>
                </div>
              );
            })}
          </div>
          
          {/* Hover columns with tooltips */}
          <div className="absolute top-0 left-0 h-full flex" style={{ zIndex: 25, width: context === 'planner' ? '100%' : `${dates.length * columnWidth}px` }}>
            {dates.map((_, i) => {
              const columnData = graphData2[i + 1];
              const columnElement = (
                <div className={context === 'planner' ? 'flex-1 relative' : 'relative'} style={context === 'timeline' ? { width: `${columnWidth}px`, height: '100%' } : { height: '100%' }} onMouseEnter={() => setHoveredColumnIndex(i)} onMouseLeave={() => setHoveredColumnIndex(null)}>
                  <div className={`absolute inset-0 bg-black transition-opacity duration-200 pointer-events-none ${hoveredColumnIndex === i ? 'opacity-[0.04]' : 'opacity-0'}`} />
                </div>
              );

              if (!columnData) return React.cloneElement(columnElement, { key: i });

              const isOvercommitted = columnData.committed > columnData.capacity;
              const remaining = columnData.capacity - columnData.committed;

              return (
                <Tooltip key={i} open={hoveredColumnIndex === i}>
                  <TooltipTrigger asChild>{columnElement}</TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      <div className="font-medium text-gray-800">{mode === 'days' ? formatWeekdayDate(columnData.date) : `Week of ${formatDateShort(columnData.date)}`}</div>
                      <div className="text-gray-600 mt-1">Capacity: {formatDuration(columnData.capacity)}</div>
                      <div className="text-gray-600">Committed: {formatDuration(columnData.committed)}</div>
                      {isOvercommitted && <div className="text-red-600 font-medium mt-1">Overcommitted by: {formatDuration(Math.abs(remaining))}</div>}
                      {!isOvercommitted && remaining > 0 && <div className="text-green-600 font-medium mt-1">Available: {formatDuration(remaining)}</div>}
                      {!isOvercommitted && remaining === 0 && <div className="text-stone-600 font-medium mt-1">At Capacity</div>}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          
          {context === 'planner' && (
            <div className="absolute top-0 left-0 w-full h-full flex" style={{ pointerEvents: 'none', zIndex: 26 }}>
              {dates.map((_, i) => <div key={i} className="flex-1 border-r border-gray-200" />)}
            </div>
          )}
        </div>
      </TooltipProvider>
    );
  };

  const renderTimeSpentRows = () => {
    return (
      <TooltipProvider delayDuration={100}>
        {timeSpentRows.map((row, index) => (
          <div key={row.type} className={`h-full relative flex items-center ${index < timeSpentRows.length - 1 ? 'border-b border-gray-100' : ''}`} style={{ height: '48px' }}>
            <div className="flex w-full" style={context === 'timeline' ? { minWidth: `${dates.length * columnWidth + (mode === 'days' ? columnWidth : 0)}px` } : undefined}>
              {dates.map((date: Date, dateIndex: number) => {
                const targetHours = getHours(date, row.type);
                
                return (
                  <div 
                    key={dateIndex}
                    className={`flex justify-center items-center relative ${context === 'planner' ? 'flex-1 border-r border-gray-200' : ''}`} 
                    style={context === 'timeline' ? { width: `${columnWidth}px` } : undefined}
                  >
                    <div className="relative flex items-center justify-center min-h-[20px]" style={{ zIndex: 10 }}>
                      {targetHours > 0 ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs font-medium text-gray-600 cursor-default hover:bg-gray-100 px-2 py-1 rounded transition-colors relative" style={{ zIndex: 10 }}>
                              {formatDuration(targetHours)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs">
                              <div className="font-medium text-gray-600">{row.label}</div>
                              <div className="text-gray-500">{formatDuration(targetHours)}</div>
                              <div className="text-xs text-gray-400">
                                {context === 'timeline' && mode === 'weeks' 
                                  ? formatWeekRange(date)
                                  : formatWeekdayDate(date)}
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </TooltipProvider>
    );
  };

  return (
    <div className="relative">
      {/* Tabs Container */}
      <div className="flex items-end">
        <TabComponent
          label="Availability"
          isActive={activeTab === 'availability-graph-3'}
          onClick={() => setActiveTab('availability-graph-3')}
        />
        <TabComponent
          label="Time Spent"
          isActive={activeTab === 'time-spent'}
          onClick={() => setActiveTab('time-spent')}
        />
        {/* Fill remaining space with no background */}
        <div className="flex-1 flex items-center justify-end" style={{ marginBottom: '8px', marginTop: '-4px' }}>
          <AvailabilityCardSettingsButton onClick={() => setSettingsModalOpen(true)} />
        </div>
      </div>

      {/* Card Content */}
      <Card className="shadow-sm border-x border-b border-t border-gray-200 relative bg-gray-50" style={{ borderTopLeftRadius: 0, borderTopRightRadius: '0.5rem', overflow: 'clip' }}>
        {/* Column Markers Overlay - clipped to card shape, excluding borders */}
        {columnMarkersOverlay && (
          <div 
            className="absolute pointer-events-none"
            style={{ 
              top: '1px',
              right: '1px', 
              bottom: '1px', 
              left: '1px',
              borderTopLeftRadius: 0,
              borderTopRightRadius: 'calc(0.5rem - 1px)',
              borderBottomLeftRadius: 'calc(0.5rem - 1px)',
              borderBottomRightRadius: 'calc(0.5rem - 1px)',
              zIndex: 1,
              overflow: 'hidden'
            }}
          >
            {columnMarkersOverlay}
          </div>
        )}
        
        {context === 'planner' ? (
          /* Planner Layout - flex columns with time gutter */
          <div className="flex h-full">
            {/* Time gutter */}
            <div 
              className="flex-shrink-0 border-r border-gray-100 bg-gray-50"
              style={{ width: `${timeGutterWidth}px` }}
            />
            
            {/* Content area - grows to fill space */}
            <div ref={setContainerRef} className="flex-1 flex flex-col relative">
              {activeTab === 'availability-graph-old' && renderWorkloadGraph()}
              {activeTab === 'availability-graph-3' && renderCapacityVsCommittedGraph3()}
              {activeTab === 'time-spent' && renderTimeSpentRows()}
            </div>
            
            {/* Scrollbar spacer */}
            {scrollbarWidth > 0 && (
              <div 
                className="flex-shrink-0 bg-gray-50" 
                style={{ width: `${scrollbarWidth}px` }}
              />
            )}
          </div>
        ) : (
          /* Timeline Layout - fixed width columns */
          <div 
            className="flex-1 flex flex-col bg-gray-50 relative availability-timeline-content" 
            style={{ 
              minWidth: mode === 'weeks'
                ? `${dates.length * 153}px`
                : `${dates.length * 52 + 52}px`, // Extra 52px buffer for smooth rendering at edges
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
            }}
          >
            {activeTab === 'availability-graph-old' && renderWorkloadGraph()}
            {activeTab === 'availability-graph-3' && renderCapacityVsCommittedGraph3()}
            {activeTab === 'time-spent' && renderTimeSpentRows()}
          </div>
        )}
      </Card>

      {/* Settings Modal */}
      <AvailabilityCardModal
        open={settingsModalOpen}
        onOpenChange={setSettingsModalOpen}
        initialTab={context}
      />
    </div>
  );
});
