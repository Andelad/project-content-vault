import React, { memo, useState, useMemo, useEffect, useCallback } from 'react';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../ui/tooltip';
import { Card } from '../ui/card';
import { usePlannerContext } from '../../contexts/PlannerContext';
import { UnifiedTimelineService, formatDuration } from '@/services';
import { formatWeekdayDate, formatDateShort, formatWeekRange } from '@/utils/dateFormatUtils';
import { NEUTRAL_COLORS } from '@/constants/colors';
import type { Project, Settings, PhaseDTO } from '@/types/core';
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
  const [activeTab, setActiveTab] = useState<'time-spent' | 'availability-graph' | 'availability-graph-2'>('availability-graph');
  const [hoveredColumnIndex, setHoveredColumnIndex] = useState<number | null>(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  
  const { holidays, events } = usePlannerContext();

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

  const isGraphTab = activeTab === 'availability-graph' || activeTab === 'availability-graph-2';

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
        const workHoursForDate = UnifiedTimelineService.generateWorkHoursForDate(d, settings, holidays);
        totalWorkHours += UnifiedTimelineService.calculateWorkHoursTotal(workHoursForDate);
        
        // Calculate habit time within work slots (excluding portion covered by planned events)
        totalHabitTime += UnifiedTimelineService.calculateHabitTimeWithinWorkSlots(d, events, workHoursForDate);
        
        // Calculate ALL planned/completed project event time (even outside work hours)
        totalPlannedTime += UnifiedTimelineService.calculatePlannedTimeNotOverlappingHabits(d, events, workHoursForDate);
        
        // Calculate total project hours (includes both planned events and auto-estimates)
        const totalProjectHours = UnifiedTimelineService.calculateDailyProjectHours(
          d, 
          projects, 
          settings, 
          holidays, 
          phases,
          events
        );
        
        // Get ONLY auto-estimate hours (total project hours minus planned event hours for this day)
        const dailyPlannedTime = UnifiedTimelineService.calculatePlannedTimeNotOverlappingHabits(d, events, workHoursForDate);
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
        const workHoursForDate = UnifiedTimelineService.generateWorkHoursForDate(d, settings, holidays);
        capacity += UnifiedTimelineService.calculateWorkHoursTotal(workHoursForDate);
        
        // Committed = habit time + planned time + estimated time
        const habitTime = UnifiedTimelineService.calculateHabitTimeWithinWorkSlots(d, events, workHoursForDate);
        const plannedTime = UnifiedTimelineService.calculatePlannedTimeNotOverlappingHabits(d, events, workHoursForDate);
        
        const totalProjectHours = UnifiedTimelineService.calculateDailyProjectHours(
          d, 
          projects, 
          settings, 
          holidays, 
          phases,
          events
        );
        const dailyPlannedTime = UnifiedTimelineService.calculatePlannedTimeNotOverlappingHabits(d, events, workHoursForDate);
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
  const maxGraph2Value = useMemo(() => {
    const maxValues = graphData2.map(d => Math.max(d.capacity, d.committed));
    return Math.ceil(Math.max(...maxValues, 1));
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
      return type === 'total-planned'
        ? UnifiedTimelineService.calculateTotalPlannedHours(d, events)
        : UnifiedTimelineService.calculateOtherTime(d, events);
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

    return (
      <TooltipProvider delayDuration={100}>
        <div className="relative flex items-center" style={{ width: context === 'planner' ? '100%' : `${dates.length * columnWidth}px`, height: '96px' }}>
          <svg width={(dates.length + 2) * columnWidth} height={graphHeight} className="absolute top-0" style={{ overflow: 'visible', pointerEvents: 'none', zIndex: 20, left: `-${columnWidth}px` }}>
            <g transform={`translate(0, ${graphPadding.top})`}>
              <line x1={0} y1={plotHeight / 2} x2={(dates.length + 2) * columnWidth} y2={plotHeight / 2} stroke={NEUTRAL_COLORS.gray400} strokeWidth={1} />
              <path d={generatePath((v) => v >= 0)} fill="rgb(34, 197, 94)" fillOpacity={0.3} />
              <path d={generatePath((v) => v <= 0)} fill="rgb(239, 68, 68)" fillOpacity={0.4} />
              <path d={`M ${columnWidth / 2},${netAvailabilityToY(graphData[0]?.netAvailability || 0)} ${graphData.map((d, i) => `L ${i * columnWidth + columnWidth / 2},${netAvailabilityToY(d.netAvailability)}`).join(' ')}`} fill="none" stroke={NEUTRAL_COLORS.gray400} strokeWidth={2} />
            </g>
          </svg>
          
          {/* Data point circles */}
          <div className="absolute top-0 left-0 pointer-events-none" style={{ zIndex: 22 }}>
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

  // ===== CAPACITY VS COMMITTED GRAPH (Availability 2) =====
  const renderCapacityVsCommittedGraph = () => {
    if (context === 'planner' && plannerColumnWidth === 0) {
      return <div style={{ height: '96px' }} />;
    }

    // Y-axis conversion: 0 at bottom, maxGraph2Value at top
    const valueToY = (value: number) => {
      if (maxGraph2Value === 0) return plotHeight;
      return plotHeight - (value / maxGraph2Value) * plotHeight;
    };

    // Generate fill paths for areas between committed and capacity lines
    const generateCapacityFillPaths = () => {
      if (graphData2.length < 2) return { greenPath: '', redPath: '' };
      
      const points = graphData2.map((d, i) => ({
        x: i * columnWidth + columnWidth / 2,
        yCommitted: valueToY(d.committed),
        yCapacity: valueToY(d.capacity),
        committed: d.committed,
        capacity: d.capacity
      }));

      const greenSegments: string[] = [];
      const redSegments: string[] = [];

      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        
        // In SVG Y coordinates: lower Y = higher on screen
        // committed > capacity means overcommitted (red) - committed line is ABOVE capacity line (lower Y)
        // committed < capacity means available (green) - committed line is BELOW capacity line (higher Y)
        const isP1Over = p1.committed > p1.capacity;
        const isP2Over = p2.committed > p2.capacity;
        
        if (!isP1Over && !isP2Over) {
          // Both points: committed under/at capacity - green zone between lines
          greenSegments.push(`M ${p1.x},${p1.yCommitted} L ${p2.x},${p2.yCommitted} L ${p2.x},${p2.yCapacity} L ${p1.x},${p1.yCapacity} Z`);
        } else if (isP1Over && isP2Over) {
          // Both points: committed over capacity - red zone between lines
          redSegments.push(`M ${p1.x},${p1.yCommitted} L ${p2.x},${p2.yCommitted} L ${p2.x},${p2.yCapacity} L ${p1.x},${p1.yCapacity} Z`);
        } else {
          // Lines cross - find intersection and create two triangular segments
          const diff1 = p1.committed - p1.capacity;
          const diff2 = p2.committed - p2.capacity;
          const t = Math.abs(diff1) / (Math.abs(diff1) + Math.abs(diff2));
          
          const intersectX = p1.x + t * (p2.x - p1.x);
          const intersectY = p1.yCommitted + t * (p2.yCommitted - p1.yCommitted); // Same point on both lines at intersection
          
          if (isP1Over) {
            // P1 is over (red), P2 is under (green)
            // Red triangle: p1 committed -> intersection -> p1 capacity
            redSegments.push(`M ${p1.x},${p1.yCommitted} L ${intersectX},${intersectY} L ${p1.x},${p1.yCapacity} Z`);
            // Green triangle: intersection -> p2 committed -> p2 capacity
            greenSegments.push(`M ${intersectX},${intersectY} L ${p2.x},${p2.yCommitted} L ${p2.x},${p2.yCapacity} Z`);
          } else {
            // P1 is under (green), P2 is over (red)
            // Green triangle: p1 committed -> intersection -> p1 capacity
            greenSegments.push(`M ${p1.x},${p1.yCommitted} L ${intersectX},${intersectY} L ${p1.x},${p1.yCapacity} Z`);
            // Red triangle: intersection -> p2 committed -> p2 capacity
            redSegments.push(`M ${intersectX},${intersectY} L ${p2.x},${p2.yCommitted} L ${p2.x},${p2.yCapacity} Z`);
          }
        }
      }

      return { 
        greenPath: greenSegments.join(' '), 
        redPath: redSegments.join(' ') 
      };
    };

    // Generate stone fill path (between baseline and committed line, but only up to capacity when overcommitted)
    // This excludes the red area (committed above capacity)
    const generateStoneFillPath = () => {
      if (graphData2.length < 2) return '';
      
      const baselineY = valueToY(0); // Y position for 0 hours (bottom)
      const stoneSegments: string[] = [];
      
      const points = graphData2.map((d, i) => ({
        x: i * columnWidth + columnWidth / 2,
        yCommitted: valueToY(d.committed),
        yCapacity: valueToY(d.capacity),
        committed: d.committed,
        capacity: d.capacity
      }));

      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        
        const isP1Over = p1.committed > p1.capacity;
        const isP2Over = p2.committed > p2.capacity;
        
        // Determine the top Y for stone fill (capacity line when over, committed line when under)
        const p1TopY = isP1Over ? p1.yCapacity : p1.yCommitted;
        const p2TopY = isP2Over ? p2.yCapacity : p2.yCommitted;
        
        if (!isP1Over && !isP2Over) {
          // Both under capacity - stone goes from baseline to committed
          stoneSegments.push(`M ${p1.x},${baselineY} L ${p1.x},${p1.yCommitted} L ${p2.x},${p2.yCommitted} L ${p2.x},${baselineY} Z`);
        } else if (isP1Over && isP2Over) {
          // Both over capacity - stone goes from baseline to capacity (excluding red area)
          stoneSegments.push(`M ${p1.x},${baselineY} L ${p1.x},${p1.yCapacity} L ${p2.x},${p2.yCapacity} L ${p2.x},${baselineY} Z`);
        } else {
          // Lines cross - find intersection and create appropriate segments
          const diff1 = p1.committed - p1.capacity;
          const diff2 = p2.committed - p2.capacity;
          const t = Math.abs(diff1) / (Math.abs(diff1) + Math.abs(diff2));
          
          const intersectX = p1.x + t * (p2.x - p1.x);
          const intersectY = p1.yCommitted + t * (p2.yCommitted - p1.yCommitted);
          
          if (isP1Over) {
            // P1 is over (stone to capacity), P2 is under (stone to committed)
            stoneSegments.push(`M ${p1.x},${baselineY} L ${p1.x},${p1.yCapacity} L ${intersectX},${intersectY} L ${p2.x},${p2.yCommitted} L ${p2.x},${baselineY} Z`);
          } else {
            // P1 is under (stone to committed), P2 is over (stone to capacity)
            stoneSegments.push(`M ${p1.x},${baselineY} L ${p1.x},${p1.yCommitted} L ${intersectX},${intersectY} L ${p2.x},${p2.yCapacity} L ${p2.x},${baselineY} Z`);
          }
        }
      }
      
      return stoneSegments.join(' ');
    };

    // Generate capacity line path (dotted)
    const generateCapacityLinePath = () => {
      if (graphData2.length === 0) return '';
      return graphData2.map((d, i) => {
        const x = i * columnWidth + columnWidth / 2;
        const y = valueToY(d.capacity);
        return i === 0 ? `M ${x},${y}` : `L ${x},${y}`;
      }).join(' ');
    };

    // Generate committed line path
    const generateCommittedLinePath = () => {
      if (graphData2.length === 0) return '';
      return graphData2.map((d, i) => {
        const x = i * columnWidth + columnWidth / 2;
        const y = valueToY(d.committed);
        return i === 0 ? `M ${x},${y}` : `L ${x},${y}`;
      }).join(' ');
    };

    const { greenPath, redPath } = generateCapacityFillPaths();

    return (
      <TooltipProvider delayDuration={100}>
        <div className="relative flex items-center" style={{ width: context === 'planner' ? '100%' : `${dates.length * columnWidth}px`, height: '96px' }}>
          <svg width={(dates.length + 2) * columnWidth} height={graphHeight} className="absolute top-0" style={{ overflow: 'visible', pointerEvents: 'none', zIndex: 20, left: `-${columnWidth}px` }}>
            <g transform={`translate(0, ${graphPadding.top})`}>
              {/* Baseline at 0 hours (bottom) */}
              <line x1={0} y1={plotHeight} x2={(dates.length + 2) * columnWidth} y2={plotHeight} stroke={NEUTRAL_COLORS.gray400} strokeWidth={1} />
              
              {/* Stone fill: between baseline and committed/capacity line (excluding red areas) */}
              <path d={generateStoneFillPath()} fill="oklch(0.91 0.008 90)" fillOpacity={0.65} />
              
              {/* Green fill: committed under capacity */}
              <path d={greenPath} fill="rgb(34, 197, 94)" fillOpacity={0.3} />
              
              {/* Red fill: committed over capacity */}
              <path d={redPath} fill="rgb(239, 68, 68)" fillOpacity={0.4} />
              
              {/* Capacity line (dotted) */}
              <path 
                d={generateCapacityLinePath()} 
                fill="none" 
                stroke={NEUTRAL_COLORS.gray500} 
                strokeWidth={2} 
                strokeDasharray="4 4"
              />
              
              {/* Committed line (solid) */}
              <path 
                d={generateCommittedLinePath()} 
                fill="none" 
                stroke={NEUTRAL_COLORS.gray400} 
                strokeWidth={2} 
              />
            </g>
          </svg>
          
          {/* Data point circles on committed line */}
          <div className="absolute top-0 left-0 pointer-events-none" style={{ zIndex: 22 }}>
            {dates.map((_, dateIndex) => {
              const graphDataIndex = dateIndex + 1;
              const d = graphData2[graphDataIndex];
              if (!d) return null;
              
              const x = dateIndex * columnWidth + columnWidth / 2;
              const y = valueToY(d.committed) + graphPadding.top;
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
          isActive={activeTab === 'availability-graph'}
          onClick={() => setActiveTab('availability-graph')}
        />
        <TabComponent
          label="Availability 2"
          isActive={activeTab === 'availability-graph-2'}
          onClick={() => setActiveTab('availability-graph-2')}
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
      <Card className="overflow-hidden shadow-sm border-x border-b border-t border-gray-200 relative bg-gray-50" style={{ borderTopLeftRadius: 0, borderTopRightRadius: '0.5rem' }}>
        {/* Column Markers Overlay - positioned inside card */}
        {columnMarkersOverlay && (
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 1 }}
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
              {activeTab === 'availability-graph' && renderWorkloadGraph()}
              {activeTab === 'availability-graph-2' && renderCapacityVsCommittedGraph()}
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
                ? `${dates.length * 77}px`
                : `${dates.length * 52 + 52}px`, // Match timeline column width: 52px per day + buffer (unchanged)
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
            }}
          >
            {activeTab === 'availability-graph' && renderWorkloadGraph()}
            {activeTab === 'availability-graph-2' && renderCapacityVsCommittedGraph()}
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
