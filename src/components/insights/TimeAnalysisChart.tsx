import React, { useState, useMemo } from 'react';
import { useProjectContext } from '../../contexts/ProjectContext';
import { usePlannerContext } from '../../contexts/PlannerContext';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { calculateWorkHourCapacity, getWorkHoursCapacityForPeriod } from '@/services/work-hours/workHourCapacityService';
import { WeeklyCapacityCalculationService } from '@/services/timeline/TimelineBusinessLogicService';
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

interface TimeAnalysisChartProps {
  timeAnalysisTimeFrame: TimeFrame;
  setTimeAnalysisTimeFrame: (timeFrame: TimeFrame) => void;
  timeOffset: number;
  setTimeOffset: React.Dispatch<React.SetStateAction<number>>;
}

export function TimeAnalysisChart({
  timeAnalysisTimeFrame,
  setTimeAnalysisTimeFrame,
  timeOffset,
  setTimeOffset
}: TimeAnalysisChartProps) {
  const { projects } = useProjectContext();
  const { events } = usePlannerContext();
  const { settings } = useSettingsContext();

  // Calculate weekly work hours total
  const weeklyCapacity = useMemo(() => {
    return WeeklyCapacityCalculationService.calculateWeeklyCapacity(settings.weeklyWorkHours);
  }, [settings.weeklyWorkHours]);

  // Format timeframe for display
  const formatTimeFrame = (timeFrame: TimeFrame) => {
    switch (timeFrame) {
      case 'week': return 'Weekly';
      case 'month': return 'Monthly';
      case 'year': return 'Yearly';
    }
  };

  // Calculate time analysis data
  const { timeAnalysisData, headerData } = useMemo(() => {
    const today = new Date();
    const periods: { start: Date; end: Date; period: string }[] = [];

    // Generate periods based on timeframe and offset
    if (timeAnalysisTimeFrame === 'week') {
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - today.getDay() + 1 + (timeOffset * 7)); // Start of week (Monday)

      for (let i = 0; i < 12; i++) {
        const weekStart = new Date(startDate);
        weekStart.setDate(startDate.getDate() + (i * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        periods.push({
          start: weekStart,
          end: weekEnd,
          period: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`
        });
      }
    } else if (timeAnalysisTimeFrame === 'month') {
      const startDate = new Date(today.getFullYear(), today.getMonth() + timeOffset, 1);

      for (let i = 0; i < 12; i++) {
        const monthStart = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        const monthEnd = new Date(startDate.getFullYear(), startDate.getMonth() + i + 1, 0);

        periods.push({
          start: monthStart,
          end: monthEnd,
          period: monthStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        });
      }
    } else { // year
      const startYear = today.getFullYear() + timeOffset;

      for (let i = 0; i < 5; i++) {
        const yearStart = new Date(startYear + i, 0, 1);
        const yearEnd = new Date(startYear + i, 11, 31);

        periods.push({
          start: yearStart,
          end: yearEnd,
          period: (startYear + i).toString()
        });
      }
    }

    const data = periods.map(period => {
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
          const projectStart = new Date(project.startDate);
          const projectEnd = new Date(project.endDate);
          return projectStart <= period.end && projectEnd >= period.start;
        })
        .reduce((sum, project) => sum + project.estimatedHours, 0);

      // Calculate utilized hours from events
      const utilizedHours = events
        .filter(event => {
          const eventDate = new Date(event.startTime);
          return eventDate >= period.start && eventDate <= period.end && event.completed;
        })
        .reduce((sum, event) => {
          const duration = (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / (1000 * 60 * 60);
          return sum + duration;
        }, 0);

      const overbooked = Math.max(0, utilizedHours + committedHours - availableHours);

      return {
        period: period.period,
        available: availableHours,
        utilized: utilizedHours,
        committed: committedHours,
        overbooked: overbooked
      };
    });

    // Generate header data for sticky headers
    const headers: { year: number; monthYear?: string; startIndex: number }[] = [];
    if (timeAnalysisTimeFrame !== 'year') {
      let currentYear = -1;
      let currentMonth = -1;

      data.forEach((item, index) => {
        const periodDate = periods[index].start;
        const year = periodDate.getFullYear();
        const month = periodDate.getMonth();

        if (year !== currentYear || (timeAnalysisTimeFrame === 'week' && month !== currentMonth)) {
          headers.push({
            year,
            monthYear: timeAnalysisTimeFrame === 'week' ? periodDate.toLocaleDateString('en-US', { month: 'short' }) : undefined,
            startIndex: index
          });
          currentYear = year;
          currentMonth = month;
        }
      });
    }

    return { timeAnalysisData: data, headerData: headers };
  }, [timeAnalysisTimeFrame, timeOffset, projects, events, weeklyCapacity]);

  return (
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
  );
}
