import React, { useState, useMemo, useEffect } from 'react';
import { useProjectContext } from '../../contexts/ProjectContext';
import { usePlannerContext } from '../../contexts/PlannerContext';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { calculateWorkHourCapacity, getWorkHoursCapacityForPeriod } from '../../services';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  Calendar, 
  Clock, 
  AlertTriangle, 
  Target,
  ChevronLeft,
  ChevronRight,
  Sun
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { AverageDayHeatmapCard } from '../insights/AverageDayHeatmapCard';
import { formatMonthYear, formatMonthLongYear, formatMonth, formatDateShort, APP_LOCALE } from '@/utils/dateFormatUtils';
import { 
  calculateFutureCommitments,
  calculateWeeklyCapacity
} from '../../services';

type TimeFrame = 'week' | 'month' | 'year';

// Custom shape component for overlaying bars
const OverlaidBars = (props: any) => {
  const { fill, payload, x, y, width, height } = props;
  
  if (!payload) return null;
  
  const { available, utilized, overbooked } = payload;
  const cornerRadius = 3;
  
  return (
    <g>
      {/* Available capacity background bar - no animation, full height with top corners rounded */}
      <path
        d={`M ${x} ${y + height} L ${x} ${y + cornerRadius} Q ${x} ${y} ${x + cornerRadius} ${y} L ${x + width - cornerRadius} ${y} Q ${x + width} ${y} ${x + width} ${y + cornerRadius} L ${x + width} ${y + height} Z`}
        fill="#e7e5e4"
      />
      
      {/* Utilized bar overlaid on top - positioned at bottom, grows from 0 height */}
      {utilized > 0 && (
        <g className="utilized-overlay">
          <path
            d={`M ${x} ${y + height} L ${x} ${y + height - (height * utilized / available) + cornerRadius} Q ${x} ${y + height - (height * utilized / available)} ${x + cornerRadius} ${y + height - (height * utilized / available)} L ${x + width - cornerRadius} ${y + height - (height * utilized / available)} Q ${x + width} ${y + height - (height * utilized / available)} ${x + width} ${y + height - (height * utilized / available) + cornerRadius} L ${x + width} ${y + height} Z`}
            fill="#02c0b7"
          />
        </g>
      )}
      
      {/* Overbooked bar - same width as main bars, positioned separately */}
      {overbooked > 0 && (
        <g className="overbooked-bar">
          <path
            d={`M ${x + width + 8} ${y + height} L ${x + width + 8} ${y + height - (height * overbooked / Math.max(available, overbooked)) + cornerRadius} Q ${x + width + 8} ${y + height - (height * overbooked / Math.max(available, overbooked))} ${x + width + 8 + cornerRadius} ${y + height - (height * overbooked / Math.max(available, overbooked))} L ${x + width + 8 + width - cornerRadius} ${y + height - (height * overbooked / Math.max(available, overbooked))} Q ${x + width + 8 + width} ${y + height - (height * overbooked / Math.max(available, overbooked))} ${x + width + 8 + width} ${y + height - (height * overbooked / Math.max(available, overbooked)) + cornerRadius} L ${x + width + 8 + width} ${y + height} Z`}
            fill="#dc2626"
          />
        </g>
      )}
    </g>
  );
};



export function InsightsView() {
  const { projects, groups } = useProjectContext();
  const { events } = usePlannerContext();
  const { settings } = useSettingsContext();
  const [timeAnalysisTimeFrame, setTimeAnalysisTimeFrame] = useState<TimeFrame>('month');
  const [showActiveProjects, setShowActiveProjects] = useState(true);
  const [animationKey, setAnimationKey] = useState(0);
  const [timeOffset, setTimeOffset] = useState(0); // For navigating through time
  
  const today = new Date();

  // Trigger animation when data changes
  useEffect(() => {
    setAnimationKey(prev => prev + 1);
  }, [projects, events, timeAnalysisTimeFrame, timeOffset]);

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



  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="h-20 border-b border-[#e2e2e2] flex items-center px-8">
        <h1 className="text-lg font-semibold text-[#595956]">Insights</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-gray-50 light-scrollbar">
        <div className="p-[21px] space-y-[21px]">


          {/* Charts Row */}
          <div className="grid grid-cols-1 gap-[21px]">
            {/* Time Analysis Chart */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Time Analysis - {formatTimeFrame(timeAnalysisTimeFrame)}</CardTitle>
                    <CardDescription>
                      Available time vs. committed and overbooked hours
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-4">
                    <Select value={timeAnalysisTimeFrame} onValueChange={(value: TimeFrame) => {
                      setTimeAnalysisTimeFrame(value);
                      setTimeOffset(0); // Reset offset when changing timeframe
                    }}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="week">Weekly</SelectItem>
                        <SelectItem value="month">Monthly</SelectItem>
                        <SelectItem value="year">Yearly</SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Limit backwards navigation: -5 years worth of periods
                          const maxBackward = timeAnalysisTimeFrame === 'week' ? -260 : timeAnalysisTimeFrame === 'month' ? -60 : -5;
                          setTimeOffset(prev => Math.max(maxBackward, prev - 1));
                        }}
                        className="p-2"
                        disabled={timeOffset <= (timeAnalysisTimeFrame === 'week' ? -260 : timeAnalysisTimeFrame === 'month' ? -60 : -5)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTimeOffset(0)}
                        className="px-3"
                      >
                        Today
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Limit forward navigation: +5 years worth of periods
                          const maxForward = timeAnalysisTimeFrame === 'week' ? 260 : timeAnalysisTimeFrame === 'month' ? 60 : 5;
                          setTimeOffset(prev => Math.min(maxForward, prev + 1));
                        }}
                        className="p-2"
                        disabled={timeOffset >= (timeAnalysisTimeFrame === 'week' ? 260 : timeAnalysisTimeFrame === 'month' ? 60 : 5)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
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
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={timeAnalysisData} 
                      maxBarSize={50} 
                      barCategoryGap="20%" 
                      margin={{ 
                        top: timeAnalysisTimeFrame !== 'year' ? 10 : 20, 
                        right: 60, 
                        left: 20, 
                        bottom: 5 
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="period" 
                        tick={{ fontSize: 11 }}
                        height={40}
                      />
                      <YAxis />
                      <Tooltip 
                        formatter={(value, name) => {
                          return [`${value}h`, name];
                        }}
                        labelFormatter={(label) => `Period: ${label}`}
                        cursor={false}
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
                                <p className="font-medium">{`Period: ${label}`}</p>
                                <div className="mt-2 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-[#e7e5e4] rounded"></div>
                                    <span className="text-sm">{`Available: ${data.available}h`}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-[#02c0b7] rounded"></div>
                                    <span className="text-sm">{`Utilized: ${data.utilized}h`}</span>
                                  </div>
                                  {data.overbooked > 0 && (
                                    <div className="flex items-center gap-2">
                                      <div className="w-3 h-3 bg-[#dc2626] rounded"></div>
                                      <span className="text-sm">{`Overbooked: ${data.overbooked}h`}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      {/* Single bar with custom shape for overlaying */}
                      <Bar 
                        dataKey="available" 
                        shape={OverlaidBars}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Projects and Commitments Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-[21px]">
            {/* Projects Detail */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-[#02c0b7]" />
                    <CardTitle>
                      {showActiveProjects ? 'Active Projects' : 'Future Projects'}
                    </CardTitle>
                    <Badge variant="secondary">
                      {showActiveProjects ? currentProjects.length : futureProjects.length}
                    </Badge>
                  </div>
                  <Select value={showActiveProjects ? 'active' : 'future'} onValueChange={(value) => setShowActiveProjects(value === 'active')}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="future">Future</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <CardDescription>
                  {showActiveProjects 
                    ? 'Projects currently active and their estimated hours'
                    : 'Upcoming projects and their estimated hours'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {showActiveProjects ? (
                  // Active Projects View
                  currentProjects.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No active projects today</p>
                      <p className="text-sm">Create a new project to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {currentProjects.map(project => {
                        const progress = Math.round(
                          ((today.getTime() - new Date(project.startDate).getTime()) / 
                           (new Date(project.endDate).getTime() - new Date(project.startDate).getTime())) * 100
                        );
                        
                        return (
                          <div key={project.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                            <div className="flex items-center gap-4">
                              <div 
                                className="w-4 h-4 rounded-full"
                                style={{ backgroundColor: project.color }}
                              />
                              <div>
                                <div className="font-medium">{project.name}</div>
                                <div className="text-sm text-gray-500">{project.client}</div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-6 text-sm">
                              <div className="text-center">
                                <div className="font-medium">{project.estimatedHours}h</div>
                                <div className="text-gray-500">Estimated</div>
                              </div>
                              
                              <div className="text-center">
                                <div className="font-medium">{Math.max(0, Math.min(100, progress))}%</div>
                                <div className="text-gray-500">Progress</div>
                              </div>
                              
                              <div className="text-center">
                                <div className="font-medium">
                                  {Math.ceil((new Date(project.endDate).getTime() - today.getTime()) / (24 * 60 * 60 * 1000))}d
                                </div>
                                <div className="text-gray-500">Remaining</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  // Future Projects View
                  futureProjects.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No upcoming projects scheduled</p>
                      <p className="text-sm">Future projects will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {futureProjects
                        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                        .map(project => {
                          const daysUntilStart = Math.ceil((new Date(project.startDate).getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
                          
                          return (
                            <div key={project.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                              <div className="flex items-center gap-4">
                                <div 
                                  className="w-4 h-4 rounded-full"
                                  style={{ backgroundColor: project.color }}
                                />
                                <div>
                                  <div className="font-medium">{project.name}</div>
                                  <div className="text-sm text-gray-500">{project.client}</div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-6 text-sm">
                                <div className="text-center">
                                  <div className="font-medium">{project.estimatedHours}h</div>
                                  <div className="text-gray-500">Estimated</div>
                                </div>
                                
                                <div className="text-center">
                                  <div className="font-medium">
                                    {formatDateShort(new Date(project.startDate))}
                                  </div>
                                  <div className="text-gray-500">Start Date</div>
                                </div>
                                
                                <div className="text-center">
                                  <div className="font-medium">{daysUntilStart}d</div>
                                  <div className="text-gray-500">Until Start</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )
                )}
              </CardContent>
            </Card>

            {/* Future Commitments Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                  Future Commitments
                </CardTitle>
                <CardDescription>
                  Total hours in upcoming projects
                </CardDescription>
              </CardHeader>
              <CardContent>
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
            </Card>

            {/* Average Day Heatmap Card */}
            <AverageDayHeatmapCard 
              events={events}
              groups={groups || []}
              projects={projects || []}
            />
          </div>


        </div>
      </div>
    </div>
  );
}

export default InsightsView;