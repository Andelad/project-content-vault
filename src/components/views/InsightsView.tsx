import React, { useState, useMemo, useEffect } from 'react';
import { useProjectContext } from '../../contexts/ProjectContext';
import { usePlannerContext } from '../../contexts/PlannerContext';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { calculateWorkHourCapacity, getWorkHoursCapacityForPeriod } from '../../services';
import { ResponsivePie } from '@nivo/pie';
import { ResponsiveBar, BarDatum } from '@nivo/bar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { 
  Calendar, 
  AlertTriangle, 
  Target,
  ChevronLeft,
  ChevronRight,
  GraduationCap
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { HelpModal } from '../modals/HelpModal';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { NEUTRAL_COLORS } from '@/constants/colors';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { AverageDayHeatmapCard } from '../insights/AverageDayHeatmapCard';
import { formatMonthYear, formatMonthLongYear, formatMonth, formatDateShort, APP_LOCALE } from '@/utils/dateFormatUtils';
import { 
  calculateFutureCommitments,
  calculateWeeklyCapacity
} from '../../services';
import type { Project, CalendarEvent } from '@/types/core';

const buildProjectsSignature = (projects: Project[]) => {
  return projects
    .map(project => `${project.id}:${project.estimatedHours}:${project.name}:${project.color}:${project.icon}`)
    .sort()
    .join('|');
};

const buildEventsSignature = (events: CalendarEvent[]) => {
  return events
    .map(event => `${event.id}:${event.projectId ?? ''}:${event.title}:${event.description || ''}`)
    .sort()
    .join('|');
};

type TimeFrame = 'week' | 'month' | 'year';

export function InsightsView() {
  const { projects, groups } = useProjectContext();
  const { events } = usePlannerContext();
  const { settings } = useSettingsContext();
  const [timeAnalysisTimeFrame, setTimeAnalysisTimeFrame] = useState<TimeFrame>('month');
  const [projectDistributionTimeFrame, setProjectDistributionTimeFrame] = useState<'last-week' | 'last-month' | 'custom'>('last-week');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [helpModalInitialTopic, setHelpModalInitialTopic] = useState<string | undefined>();

  const [animationKey, setAnimationKey] = useState(0);
  const [timeOffset, setTimeOffset] = useState(0); // For navigating through time
  const [shouldAnimatePie, setShouldAnimatePie] = useState(true);
  
  const today = useMemo(() => new Date(), []);

  const animationSignature = useMemo(() => {
  const projectsSignature = buildProjectsSignature(projects);
  const eventsSignature = buildEventsSignature(events);
    return `${projectsSignature}__${eventsSignature}__${timeAnalysisTimeFrame}__${timeOffset}`;
  }, [projects, events, timeAnalysisTimeFrame, timeOffset]);

  // Trigger animation when data meaningfully changes
  useEffect(() => {
    setAnimationKey(prev => prev + 1);
  }, [animationSignature]);

  // Add CSS for bar animations - use clipPath to grow from bottom without any position changes
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .utilized-overlay {
        animation: growFromBottom-${animationKey} 0.8s ease-out 0.2s both;
      }
      .overbooked-bar {
        animation: growFromBottom-${animationKey} 0.8s ease-out 0.4s both;
      }
      @keyframes growFromBottom-${animationKey} {
        from {
          clip-path: polygon(0 100%, 100% 100%, 100% 100%, 0 100%);
        }
        to {
          clip-path: polygon(0 100%, 100% 100%, 100% 0%, 0 0%);
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, [animationKey]);

  // Calculate weekly work hours total
  const weeklyCapacity = useMemo(() => {
    return calculateWeeklyCapacity(settings.weeklyWorkHours || {});
  }, [settings.weeklyWorkHours]);

  // Current projects (active today)
  const currentProjects = useMemo(() => {
    return projects.filter(project => {
      const start = new Date(project.startDate);
      const end = new Date(project.endDate);
      return start <= today && end >= today;
    });
  }, [projects, today]);

  // Future committed hours using service
  const futureCommitments = useMemo(() => {
    return calculateFutureCommitments(projects, today);
  }, [projects, today]);

  // Generate time analysis data based on selected timeframe
  const { timeAnalysisData, headerData } = useMemo(() => {
    const data = [];
    const now = new Date();
    
    const periods: { label: string; monthYear: string; year: number; start: Date; end: Date; }[] = [];
    
    if (timeAnalysisTimeFrame === 'week') {
      // 12 weeks with time offset - each offset moves by 1 week
      const baseDate = new Date(now);
      baseDate.setDate(baseDate.getDate() + (timeOffset * 7));
      
      for (let i = 11; i >= 0; i--) {
        const weekStart = new Date(baseDate);
        // Adjust for Monday start: if day is 0 (Sunday), go back 6 days; otherwise go back (day - 1) days
        const day = baseDate.getDay();
        const daysToSubtract = day === 0 ? 6 : day - 1;
        weekStart.setDate(baseDate.getDate() - (i * 7) - daysToSubtract);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        periods.push({
          label: `${weekStart.getDate()}-${weekEnd.getDate()}`,
          monthYear: `${weekStart.toLocaleDateString(APP_LOCALE, { month: 'short' })} ${weekStart.getFullYear()}`,
          year: weekStart.getFullYear(),
          start: weekStart,
          end: weekEnd
        });
      }
    } else if (timeAnalysisTimeFrame === 'month') {
      // 12 months with time offset - each offset moves by 1 month
      const baseMonth = now.getMonth() + timeOffset;
      const baseYear = now.getFullYear() + Math.floor(baseMonth / 12);
      const adjustedMonth = ((baseMonth % 12) + 12) % 12; // Handle negative months
      
      for (let i = 11; i >= 0; i--) {
        const monthStart = new Date(baseYear, adjustedMonth - i, 1);
        const monthEnd = new Date(baseYear, adjustedMonth - i + 1, 0);
        
        periods.push({
          label: `${monthStart.toLocaleDateString(APP_LOCALE, { month: 'short' })}`,
          monthYear: `${monthStart.toLocaleDateString(APP_LOCALE, { month: 'long' })} ${monthStart.getFullYear()}`,
          year: monthStart.getFullYear(),
          start: monthStart,
          end: monthEnd
        });
      }
    } else {
      // 5 years with time offset - each offset moves by 1 year
      const baseYear = now.getFullYear() + timeOffset;
      
      for (let i = 4; i >= 0; i--) {
        const yearStart = new Date(baseYear - i, 0, 1);
        const yearEnd = new Date(baseYear - i, 11, 31);
        
        periods.push({
          label: (baseYear - i).toString(),
          monthYear: (baseYear - i).toString(),
          year: baseYear - i,
          start: yearStart,
          end: yearEnd
        });
      }
    }

    periods.forEach(period => {
      // Calculate available hours for the period
      let availableHours = 0;
      if (timeAnalysisTimeFrame === 'week') {
        availableHours = weeklyCapacity;
      } else if (timeAnalysisTimeFrame === 'month') {
        // Approximate weeks in month * weekly capacity
        const weeks = Math.ceil((period.end.getTime() - period.start.getTime()) / (7 * 24 * 60 * 60 * 1000));
        availableHours = weeks * weeklyCapacity;
      } else {
        // 52 weeks * weekly capacity
        availableHours = 52 * weeklyCapacity;
      }

      // Calculate committed hours from projects
      const committedHours = projects
        .filter(project => {
          const start = new Date(project.startDate);
          const end = new Date(project.endDate);
          return (start <= period.end && end >= period.start);
        })
        .reduce((sum, project) => {
          // Calculate overlap duration
          const overlapStart = new Date(Math.max(new Date(project.startDate).getTime(), period.start.getTime()));
          const overlapEnd = new Date(Math.min(new Date(project.endDate).getTime(), period.end.getTime()));
          const overlapDays = Math.max(0, (overlapEnd.getTime() - overlapStart.getTime()) / (24 * 60 * 60 * 1000));
          const projectDays = (new Date(project.endDate).getTime() - new Date(project.startDate).getTime()) / (24 * 60 * 60 * 1000);
          
          return sum + (project.estimatedHours * (overlapDays / projectDays));
        }, 0);

      // Calculate event hours for the period
      const eventHours = events
        .filter(event => {
          const eventDate = new Date(event.startTime);
          return eventDate >= period.start && eventDate <= period.end;
        })
        .reduce((sum, event) => {
          const duration = (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / (60 * 60 * 1000);
          return sum + duration;
        }, 0);

      const totalBooked = committedHours + eventHours;
      const overbookedHours = Math.max(0, totalBooked - availableHours);
      const utilizedHours = Math.min(totalBooked, availableHours);
      const freeHours = Math.max(0, availableHours - utilizedHours);

      data.push({
        period: period.label,
        available: Math.round(availableHours),
        utilized: Math.round(utilizedHours),
        free: Math.round(freeHours),
        overbooked: Math.round(overbookedHours),
        // For proper layering - available bars start from 0
        availableBase: Math.round(availableHours),
        utilizedBase: Math.round(utilizedHours)
      });
    });

    // Generate header data for sticky year headers
    const headerData = timeAnalysisTimeFrame !== 'year' ? 
      periods.reduce((acc, period, index) => {
        const currentYear = period.year;
        const isFirstOfYear = index === 0 || periods[index - 1].year !== currentYear;
        
        if (isFirstOfYear) {
          acc.push({
            year: currentYear,
            startIndex: index,
            monthYear: timeAnalysisTimeFrame === 'week' ? period.monthYear : undefined
          });
        }
        
        return acc;
      }, [] as { year: number; startIndex: number; monthYear?: string }[]) : [];

    return { timeAnalysisData: data, headerData };
  }, [projects, events, timeAnalysisTimeFrame, weeklyCapacity, timeOffset]);

  // Future projects
  const futureProjects = useMemo(() => {
    return projects.filter(project => new Date(project.startDate) > today);
  }, [projects, today]);

  // Early return if essential data is not loaded
  if (!projects || !events || !settings) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }



  const formatTimeFrame = (frame: TimeFrame) => {
    switch (frame) {
      case 'week': return 'Weekly View';
      case 'month': return 'Monthly View';
      case 'year': return 'Yearly View';
    }
  };

  // Calculate project time distribution for donut chart
  const projectDistributionData = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now);
    
    // Determine date range based on selection
    if (projectDistributionTimeFrame === 'last-week') {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
    } else if (projectDistributionTimeFrame === 'last-month') {
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 1);
    } else {
      // Custom date range
      if (!customStartDate || !customEndDate) return [];
      startDate = new Date(customStartDate);
      endDate = new Date(customEndDate);
    }
    
    // Normalize dates
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    // Filter events within date range that have a projectId and are completed
    const relevantEvents = events.filter(event => {
      if (!event.projectId) return false;
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      return eventStart >= startDate && eventEnd <= endDate && event.completed;
    });
    
    // Calculate total hours per project
    const projectHours: Record<string, { hours: number; project: Project }> = {};
    
    relevantEvents.forEach(event => {
      const duration = (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / (1000 * 60 * 60);
      const project = projects.find(p => p.id === event.projectId);
      
      if (project) {
        if (!projectHours[project.id]) {
          projectHours[project.id] = { hours: 0, project };
        }
        projectHours[project.id].hours += duration;
      }
    });
    
    // Convert to array format for pie chart
    const totalHours = Object.values(projectHours).reduce((sum, { hours }) => sum + hours, 0);
    
    if (totalHours === 0) return [];
    
    return Object.values(projectHours)
      .map(({ hours, project }) => {
        const roundedHours = Math.round(hours * 10) / 10;
        const percentage = parseFloat(((hours / totalHours) * 100).toFixed(1));
        const hoursDisplay = `${roundedHours % 1 === 0 ? roundedHours.toFixed(0) : roundedHours.toFixed(1)}h`;
        const percentageDisplay = `${percentage % 1 === 0 ? percentage.toFixed(0) : percentage.toFixed(1)}%`;
        const clientName = project.clientData?.name || project.client || 'No client';
        return {
          name: project.name,
          clientName,
          value: parseFloat(hours.toFixed(2)),
          percentage,
          color: project.color,
          project,
          hours,
          hoursDisplay,
          percentageDisplay
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [events, projects, projectDistributionTimeFrame, customStartDate, customEndDate]);

  const projectDistributionAnimationSignature = useMemo(() => {
    if (projectDistributionData.length === 0) return 'empty';
    return projectDistributionData
      .map(item => `${item.project.id}:${item.hours.toFixed(2)}`)
      .join('|');
  }, [projectDistributionData]);

  useEffect(() => {
    setShouldAnimatePie(true);
  }, [projectDistributionAnimationSignature]);

  useEffect(() => {
    if (!shouldAnimatePie) return;
    const timer = window.setTimeout(() => setShouldAnimatePie(false), 800);
    return () => window.clearTimeout(timer);
  }, [shouldAnimatePie]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Content */}
      <div className="flex-1 overflow-auto light-scrollbar">
        <div className="p-[21px] space-y-[21px]">


          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-[21px]">
            {/* Project Time Distribution Chart */}
            <Card className="relative">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Time Distribution</CardTitle>
                  </div>
                  <Select value={projectDistributionTimeFrame} onValueChange={(value) => setProjectDistributionTimeFrame(value as any)}>
                    <SelectTrigger className="h-9 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="last-week">Last Week</SelectItem>
                      <SelectItem value="last-month">Last Month</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {projectDistributionTimeFrame === 'custom' && (
                  <div className="flex gap-2 mt-4">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-md text-sm"
                    />
                    <span className="text-gray-500 self-center">to</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-md text-sm"
                    />
                  </div>
                )}
              </CardHeader>
              <CardContent className="relative">
                {projectDistributionData.length === 0 ? (
                  <div className="h-80 flex items-center justify-center text-gray-500">
                    No completed project time in this period
                  </div>
                ) : (
                  <div className="h-80">
                    <TooltipProvider>
                      <ResponsivePie
                        data={projectDistributionData}
                        margin={{ top: 40, right: 80, bottom: 40, left: 80 }}
                        innerRadius={0.6}
                        padAngle={2}
                        cornerRadius={3}
                        colors={{ datum: 'data.color' }}
                        borderWidth={0}
                        enableArcLinkLabels={false}
                        enableArcLabels={false}
                        animate={shouldAnimatePie}
                        motionConfig={{
                          mass: 1,
                          tension: 120,
                          friction: 14,
                          clamp: false,
                          precision: 0.01,
                          velocity: 0
                        }}
                        activeInnerRadiusOffset={0}
                        activeOuterRadiusOffset={0}
                        isInteractive={true}
                        tooltip={({ datum }) => (
                          <div
                            className="pointer-events-none relative rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-[0_8px_16px_rgba(15,23,42,0.08)]"
                            style={{ minWidth: 170 }}
                          >
                            <div className="font-semibold text-slate-900">
                              {datum.data.name}
                              <span className="text-slate-400">{' \u2022 '}</span>
                              <span className="text-slate-600">{datum.data.clientName}</span>
                            </div>
                            <div className="mt-2 space-y-1">
                              <div className="font-medium text-slate-900">{datum.data.hoursDisplay}</div>
                              <div className="font-medium text-slate-900">{datum.data.percentageDisplay}</div>
                            </div>
                            <svg
                              className="absolute -bottom-2 left-1/2 -translate-x-1/2"
                              width="16"
                              height="8"
                              viewBox="0 0 16 8"
                              aria-hidden="true"
                            >
                              <path d="M0 0L8 8L16 0" fill="rgba(148, 163, 184, 0.4)" />
                              <path d="M1 0L8 7L15 0" fill="white" />
                            </svg>
                          </div>
                        )}
                      />
                    </TooltipProvider>
                  </div>
                )}
              </CardContent>

              {/* Info button bottom-right of the card */}
              <div className="absolute bottom-6 right-6">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="About Time Distribution"
                  className="h-9 w-9 rounded-full"
                  onClick={() => {
                    setHelpModalInitialTopic('insights-time-distribution');
                    setHelpModalOpen(true);
                  }}
                >
                  <GraduationCap className="w-4 h-4" />
                </Button>
              </div>
            </Card>

            {/* Time Analysis Chart */}
            <Card className="lg:col-span-2 relative">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Availability Used</CardTitle>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Limit backwards navigation: -5 years worth of periods
                          const maxBackward = timeAnalysisTimeFrame === 'week' ? -260 : timeAnalysisTimeFrame === 'month' ? -60 : -5;
                          setTimeOffset(prev => Math.max(maxBackward, prev - 1));
                        }}
                        className="h-9 w-9 p-0"
                        disabled={timeOffset <= (timeAnalysisTimeFrame === 'week' ? -260 : timeAnalysisTimeFrame === 'month' ? -60 : -5)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      
                      <Select value={timeAnalysisTimeFrame} onValueChange={(value: TimeFrame) => {
                        setTimeAnalysisTimeFrame(value);
                        setTimeOffset(0); // Reset offset when changing timeframe
                      }}>
                        <SelectTrigger className="h-9 w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="week">Weekly</SelectItem>
                          <SelectItem value="month">Monthly</SelectItem>
                          <SelectItem value="year">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Limit forward navigation: +5 years worth of periods
                          const maxForward = timeAnalysisTimeFrame === 'week' ? 260 : timeAnalysisTimeFrame === 'month' ? 60 : 5;
                          setTimeOffset(prev => Math.min(maxForward, prev + 1));
                        }}
                        className="h-9 w-9 p-0"
                        disabled={timeOffset >= (timeAnalysisTimeFrame === 'week' ? 260 : timeAnalysisTimeFrame === 'month' ? 60 : 5)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative">
                {/* Sticky Year/Month Headers for Week and Month views */}
                {timeAnalysisTimeFrame !== 'year' && headerData.length > 0 && (
                  <div className="relative mb-4">
                    <div className="flex h-8 border-b border-gray-200">
                      {headerData.map((header, index) => {
                        const isLastHeader = index === headerData.length - 1;
                        const nextHeaderStart = isLastHeader ? timeAnalysisData.length : headerData[index + 1].startIndex;
                        const width = ((nextHeaderStart - header.startIndex) / timeAnalysisData.length) * 100;
                        
                        return (
                          <div
                            key={`${header.year}-${header.startIndex}`}
                            className="flex items-center justify-center bg-gray-50 border-r border-gray-200 text-sm font-medium text-gray-700 relative"
                            style={{ width: `${width}%` }}
                          >
                            <div className="absolute left-2 flex items-center gap-2">
                              <span className="font-semibold">{header.year}</span>
                              {timeAnalysisTimeFrame === 'week' && header.monthYear && (
                                <span className="text-xs text-gray-500">{header.monthYear}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                <div className="h-80">
                  <ResponsiveBar
                    data={timeAnalysisData}
                    keys={['available', 'utilized', 'overbooked']}
                    indexBy="period"
                    margin={{ 
                      top: timeAnalysisTimeFrame !== 'year' ? 10 : 20, 
                      right: 60, 
                      left: 60, 
                      bottom: 50 
                    }}
                    padding={0.4}
                    groupMode="grouped"
                    layout="vertical"
                    colors={({ id, data }) => {
                      if (id === 'available') return '#e7e5e4';
                      if (id === 'utilized') return '#02c0b7';
                      return '#dc2626';
                    }}
                    borderRadius={3}
                    enableLabel={false}
                    enableGridY={true}
                    gridYValues={5}
                    axisTop={null}
                    axisRight={null}
                    axisBottom={{
                      tickSize: 5,
                      tickPadding: 5,
                      tickRotation: 0,
                      legendOffset: 32
                    }}
                    axisLeft={{
                      tickSize: 5,
                      tickPadding: 5,
                      tickRotation: 0,
                      format: (value) => `${value}h`
                    }}
                    tooltip={({ indexValue, data }) => {
                      const barData = data as any;
                      return (
                        <div className="pointer-events-none relative rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-[0_8px_16px_rgba(15,23,42,0.08)]">
                          <div className="font-semibold text-slate-900">Period {indexValue}</div>
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-2 text-slate-500">
                                <span className="h-2 w-2 rounded-full bg-[#e7e5e4]" />
                                Available
                              </span>
                              <span className="font-medium text-slate-900">{`${barData.available}h`}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-2 text-slate-500">
                                <span className="h-2 w-2 rounded-full bg-[#02c0b7]" />
                                Utilized
                              </span>
                              <span className="font-medium text-slate-900">{`${barData.utilized}h`}</span>
                            </div>
                            {barData.overbooked > 0 && (
                              <div className="flex items-center justify-between gap-3">
                                <span className="flex items-center gap-2 text-slate-500">
                                  <span className="h-2 w-2 rounded-full bg-[#dc2626]" />
                                  Overbooked
                                </span>
                                <span className="font-medium text-slate-900">{`${barData.overbooked}h`}</span>
                              </div>
                            )}
                          </div>
                          <svg
                            className="absolute -bottom-2 left-1/2 -translate-x-1/2"
                            width="16"
                            height="8"
                            viewBox="0 0 16 8"
                            aria-hidden="true"
                          >
                            <path d="M0 0L8 8L16 0" fill="rgba(148, 163, 184, 0.4)" />
                            <path d="M1 0L8 7L15 0" fill="white" />
                          </svg>
                        </div>
                      );
                    }}
                    theme={{
                      axis: {
                        ticks: {
                          text: {
                            fontSize: 11
                          }
                        }
                      },
                      grid: {
                        line: {
                          stroke: NEUTRAL_COLORS.gray200,
                          strokeWidth: 1,
                          strokeDasharray: '3 3'
                        }
                      }
                    }}
                  />
                </div>
              </CardContent>

              {/* Info button bottom-right of the card */}
              <div className="absolute bottom-6 right-6">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="About Availability Used"
                  className="h-9 w-9 rounded-full"
                  onClick={() => {
                    setHelpModalInitialTopic('insights-availability-used');
                    setHelpModalOpen(true);
                  }}
                >
                  <GraduationCap className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          </div>

          {/* Average Day Heatmap and Future Commitments Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-[21px]">
            {/* Average Day Heatmap Card */}
            <div className="lg:col-span-2">
              <AverageDayHeatmapCard 
                events={events}
                groups={groups || []}
                projects={projects || []}
                onHelpClick={() => {
                  setHelpModalInitialTopic('insights-average-day');
                  setHelpModalOpen(true);
                }}
              />
            </div>

            {/* Future Commitments Summary */}
            <Card className="relative">
              <CardHeader>
                <CardTitle className="text-base">Future Commitments</CardTitle>
              </CardHeader>
              <CardContent className="relative">
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-foreground mb-2">{futureCommitments}h</div>
                    <div className="text-sm text-gray-600">Total Estimated Hours</div>
                  </div>
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Upcoming Projects</span>
                      <span className="font-medium">{futureProjects.length}</span>
                    </div>
                    
                    {futureProjects.length > 0 && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Next Project Starts</span>
                          <span className="font-medium">
                            {Math.ceil((new Date(futureProjects.sort((a, b) => 
                              new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
                            )[0].startDate).getTime() - today.getTime()) / (24 * 60 * 60 * 1000))}d
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Average Project Size</span>
                          <span className="font-medium">{Math.round(futureCommitments / futureProjects.length)}h</span>
                        </div>
                      </>
                    )}
                  </div>
                  
                  {futureProjects.length === 0 && (
                    <div className="text-center py-4 text-gray-500">
                      <p className="text-sm">No future commitments</p>
                    </div>
                  )}
                </div>
              </CardContent>

              {/* Info button bottom-right of the card */}
              <div className="absolute bottom-6 right-6">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="About Future Commitments"
                  className="h-9 w-9 rounded-full"
                  onClick={() => {
                    setHelpModalInitialTopic('insights-future-commitments');
                    setHelpModalOpen(true);
                  }}
                >
                  <GraduationCap className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          </div>


        </div>
      </div>
      
      <HelpModal 
        open={helpModalOpen} 
        onOpenChange={setHelpModalOpen} 
        initialTopicId={helpModalInitialTopic}
      />
    </div>
  );
}

export default InsightsView;