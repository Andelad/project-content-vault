import React, { memo, useState, useMemo, useEffect } from 'react';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../ui/tooltip';
import { Card } from '../ui/card';
import { usePlannerContext } from '../../contexts/PlannerContext';
import { UnifiedTimelineService, formatDuration } from '@/services';
import { formatWeekdayDate, formatDateShort } from '@/utils/dateFormatUtils';
import { NEUTRAL_COLORS } from '@/constants/colors';
import type { Project, Settings } from '@/types/core';

interface TabProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const ChromeTab = ({ label, isActive, onClick }: TabProps) => {
  return (
    <button
      onClick={onClick}
      className={`
        relative px-6 text-sm font-medium transition-all duration-200 flex items-center justify-center
        ${isActive 
          ? 'text-gray-800 z-10' 
          : 'text-gray-500 hover:text-gray-600 z-0'
        }
      `}
      style={{
        height: '40px',
        backgroundColor: isActive ? 'white' : NEUTRAL_COLORS.gray200,
        borderTopLeftRadius: '8px',
        borderTopRightRadius: '8px',
        marginRight: '-2px',
        borderTop: isActive ? `1px solid ${NEUTRAL_COLORS.gray200}` : '1px solid transparent',
        borderLeft: isActive ? `1px solid ${NEUTRAL_COLORS.gray200}` : '1px solid transparent',
        borderRight: isActive ? `1px solid ${NEUTRAL_COLORS.gray200}` : '1px solid transparent',
        borderBottom: isActive ? '1px solid white' : 'none',
        marginBottom: isActive ? '-1px' : '0',
      }}
    >
      {label}
      {/* Chrome-style curves at bottom corners of active tab */}
      {isActive && (
        <>
          {/* Left curve */}
          <div
            className="absolute -left-2 bottom-0 w-2 h-2 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at 0 0, transparent 8px, white 8px)',
            }}
          />
          {/* Right curve */}
          <div
            className="absolute -right-2 bottom-0 w-2 h-2 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at 100% 0, transparent 8px, white 8px)',
            }}
          />
        </>
      )}
    </button>
  );
};

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
  scrollbarWidth = 0
}: AvailabilityCardProps) {
  const [activeTab, setActiveTab] = useState<'time-spent' | 'availability-graph'>('availability-graph');
  const [hoveredColumnIndex, setHoveredColumnIndex] = useState<number | null>(null);
  
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
      label: 'Total Project Time'
    },
    {
      type: 'other-time' as const,
      label: 'Other Time'
    }
  ];

  const isGraphTab = activeTab === 'availability-graph';

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
      const workHours = UnifiedTimelineService.getWorkHoursForDay(date, holidays, settings);
      const plannedHours = UnifiedTimelineService.calculateTotalPlannedHours(date, events);
      return {
        date,
        workHours,
        plannedHours,
        netAvailability: workHours - plannedHours
      };
    });
  }, [dates, holidays, settings, events, mode]);

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
  const getWeekDates = (weekStart: Date) => {
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      weekDates.push(date);
    }
    return weekDates;
  };

  const getHours = (date: Date, type: 'total-planned' | 'other-time') => {
    const getDailyHours = (d: Date) => {
      return type === 'total-planned'
        ? UnifiedTimelineService.calculateTotalPlannedHours(d, events)
        : UnifiedTimelineService.calculateOtherTime(d, events);
    };

    if (mode === 'weeks') {
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
              <path d={`M ${columnWidth / 2},${netAvailabilityToY(graphData[0]?.netAvailability || 0)} ${graphData.map((d, i) => `L ${i * columnWidth + columnWidth / 2},${netAvailabilityToY(d.netAvailability)}`).join(' ')}`} fill="none" stroke={NEUTRAL_COLORS.gray400} strokeWidth={1.5} />
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
                      <div className="text-gray-600">Planned: {formatDuration(columnData.plannedHours)}</div>
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

  const renderTimeSpentRows = () => {
    return (
      <TooltipProvider delayDuration={100}>
        {timeSpentRows.map((row, index) => (
          <div key={row.type} className={`h-full relative flex items-center ${index < timeSpentRows.length - 1 ? 'border-b border-gray-100' : ''}`} style={{ height: '48px' }}>
            <div className="flex w-full" style={context === 'timeline' ? { minWidth: `${dates.length * columnWidth + (mode === 'days' ? columnWidth : 0)}px` } : undefined}>
              {dates.map((date: Date, dateIndex: number) => {
                const targetHours = getHours(date, row.type);
                const columnElement = (
                  <div className={`flex justify-center items-center relative ${context === 'planner' ? 'flex-1 border-r border-gray-200' : ''}`} style={context === 'timeline' ? { width: `${columnWidth}px` } : undefined} onMouseEnter={() => setHoveredColumnIndex(dateIndex)} onMouseLeave={() => setHoveredColumnIndex(null)}>
                    <div className={`absolute inset-0 bg-black transition-opacity duration-200 pointer-events-none ${hoveredColumnIndex === dateIndex ? 'opacity-[0.04]' : 'opacity-0'}`} />
                    <div className="relative flex items-center justify-center min-h-[20px]">
                      {targetHours > 0 && <span className="text-xs font-medium text-gray-600">{formatDuration(targetHours)}</span>}
                    </div>
                  </div>
                );

                if (targetHours > 0) {
                  return (
                    <Tooltip key={dateIndex} open={hoveredColumnIndex === dateIndex}>
                      <TooltipTrigger asChild>{columnElement}</TooltipTrigger>
                      <TooltipContent>
                        <div className="text-xs">
                          <div className="font-medium text-gray-600">{row.label}</div>
                          <div className="text-gray-500">{formatDuration(targetHours)}</div>
                          <div className="text-xs text-gray-400">{mode === 'weeks' ? getWeekDates(date).map(d => formatDateShort(d)).join(', ') : formatWeekdayDate(date)}</div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return React.cloneElement(columnElement, { key: dateIndex });
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
      <div 
        className="flex items-end border-b border-gray-200"
        style={{
          backgroundColor: 'rgb(249, 250, 251)', // bg-gray-50 to match page background
          paddingTop: '4px',
        }}
      >
        <ChromeTab
          label="Availability"
          isActive={activeTab === 'availability-graph'}
          onClick={() => setActiveTab('availability-graph')}
        />
        <ChromeTab
          label="Time Spent"
          isActive={activeTab === 'time-spent'}
          onClick={() => setActiveTab('time-spent')}
        />
        {/* Fill remaining space with background */}
        <div className="flex-1 border-b border-gray-200" style={{ marginBottom: '-1px' }} />
      </div>

      {/* Card Content */}
      <Card className="overflow-hidden shadow-sm border-x border-b border-t-0 border-gray-200 rounded-t-none relative bg-gray-50">
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
              {isGraphTab ? renderWorkloadGraph() : renderTimeSpentRows()}
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
            {isGraphTab ? renderWorkloadGraph() : renderTimeSpentRows()}
          </div>
        )}
      </Card>
    </div>
  );
});
