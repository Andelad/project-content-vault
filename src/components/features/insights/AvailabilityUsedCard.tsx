import React, { useState, useMemo, useEffect } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, GraduationCap } from 'lucide-react';
import { NEUTRAL_COLORS } from '@/constants/colors';
import { formatMonthYear, formatMonthLongYear, formatMonth, APP_LOCALE } from '@/utils/dateFormatUtils';
import { calculateWeeklyCapacity } from '@/services';
import type { Project, CalendarEvent } from '@/types/core';

interface AvailabilityUsedCardProps {
  projects: Project[];
  events: CalendarEvent[];
  weeklyWorkHours: any;
  onHelpClick?: () => void;
}

type TimeFrame = 'week' | 'month' | 'year';

export const AvailabilityUsedCard: React.FC<AvailabilityUsedCardProps> = ({
  projects,
  events,
  weeklyWorkHours,
  onHelpClick
}) => {
  const [timeAnalysisTimeFrame, setTimeAnalysisTimeFrame] = useState<TimeFrame>('month');
  const [timeOffset, setTimeOffset] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);

  // Calculate weekly work hours total
  const weeklyCapacity = useMemo(() => {
    return calculateWeeklyCapacity(weeklyWorkHours || {});
  }, [weeklyWorkHours]);

  // Generate time analysis data based on selected timeframe
  const { timeAnalysisData, headerData } = useMemo(() => {
    const data = [];
    const now = new Date();
    
    const periods: { label: string; monthYear: string; year: number; start: Date; end: Date; }[] = [];
    
    if (timeAnalysisTimeFrame === 'week') {
      const baseDate = new Date(now);
      baseDate.setDate(baseDate.getDate() + (timeOffset * 7));
      
      for (let i = 11; i >= 0; i--) {
        const weekStart = new Date(baseDate);
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
      const baseMonth = now.getMonth() + timeOffset;
      const baseYear = now.getFullYear() + Math.floor(baseMonth / 12);
      const adjustedMonth = ((baseMonth % 12) + 12) % 12;
      
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
      let availableHours = 0;
      if (timeAnalysisTimeFrame === 'week') {
        availableHours = weeklyCapacity;
      } else if (timeAnalysisTimeFrame === 'month') {
        const weeks = Math.ceil((period.end.getTime() - period.start.getTime()) / (7 * 24 * 60 * 60 * 1000));
        availableHours = weeks * weeklyCapacity;
      } else {
        availableHours = 52 * weeklyCapacity;
      }

      const committedHours = projects
        .filter(project => {
          const start = new Date(project.startDate);
          const end = new Date(project.endDate);
          return (start <= period.end && end >= period.start);
        })
        .reduce((sum, project) => {
          const overlapStart = new Date(Math.max(new Date(project.startDate).getTime(), period.start.getTime()));
          const overlapEnd = new Date(Math.min(new Date(project.endDate).getTime(), period.end.getTime()));
          const overlapDays = Math.max(0, (overlapEnd.getTime() - overlapStart.getTime()) / (24 * 60 * 60 * 1000));
          const projectDays = (new Date(project.endDate).getTime() - new Date(project.startDate).getTime()) / (24 * 60 * 60 * 1000);
          
          return sum + (project.estimatedHours * (overlapDays / projectDays));
        }, 0);

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
        availableBase: Math.round(availableHours),
        utilizedBase: Math.round(utilizedHours)
      });
    });

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

  const animationSignature = useMemo(() => {
    return `${projects.length}__${events.length}__${timeAnalysisTimeFrame}__${timeOffset}`;
  }, [projects, events, timeAnalysisTimeFrame, timeOffset]);

  useEffect(() => {
    setAnimationKey(prev => prev + 1);
  }, [animationSignature]);

  return (
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
                setTimeOffset(0);
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

      {onHelpClick && (
        <div className="absolute bottom-6 right-6">
          <Button
            variant="outline"
            size="icon"
            aria-label="About Availability Used"
            className="h-9 w-9 rounded-full"
            onClick={onHelpClick}
          >
            <GraduationCap className="w-4 h-4" />
          </Button>
        </div>
      )}
    </Card>
  );
};
