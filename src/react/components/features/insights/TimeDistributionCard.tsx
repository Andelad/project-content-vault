import React, { useState, useMemo, useEffect } from 'react';
import { ResponsivePie } from '@nivo/pie';
import { TooltipProvider } from '@/components/shadcn/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shadcn/card';
import { Button } from '@/components/shadcn/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/shadcn/select';
import { GraduationCap } from 'lucide-react';
import { useDebouncedCalculation } from '@/hooks/insights/useDebouncedCalculation';
import type { Project, CalendarEvent } from '@/types/core';

interface TimeDistributionCardProps {
  events: CalendarEvent[];
  projects: Project[];
  onHelpClick?: () => void;
}

type TimeFrame = 'last-week' | 'last-month' | 'custom';

export const TimeDistributionCard: React.FC<TimeDistributionCardProps> = ({
  events,
  projects,
  onHelpClick
}) => {
  const [projectDistributionTimeFrame, setProjectDistributionTimeFrame] = useState<TimeFrame>('last-week');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [shouldAnimatePie, setShouldAnimatePie] = useState(true);

  // PERFORMANCE: Debounce expensive calculation to prevent blocking UI
  // Cache key for instant load on remount
  const cacheKey = `time-distribution-${projectDistributionTimeFrame}-${customStartDate}-${customEndDate}`;
  
  // Calculate project time distribution for donut chart
  const projectDistributionData = useDebouncedCalculation(() => {
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
  }, [events, projects, projectDistributionTimeFrame, customStartDate, customEndDate], 300, cacheKey);

  const projectDistributionAnimationSignature = useMemo(() => {
    if (!projectDistributionData || projectDistributionData.length === 0) return 'empty';
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
    <Card className="relative">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Time Distribution</CardTitle>
          </div>
          <Select value={projectDistributionTimeFrame} onValueChange={(value) => setProjectDistributionTimeFrame(value as TimeFrame)}>
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
        {/* Show skeleton while calculation is debouncing */}
        {!projectDistributionData ? (
          <div className="h-80 flex items-center justify-center">
            <div className="w-64 h-64 rounded-full border-4 border-gray-200 border-t-primary animate-spin" />
          </div>
        ) : projectDistributionData.length === 0 ? (
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
      {onHelpClick && (
        <div className="absolute bottom-6 right-6">
          <Button
            variant="outline"
            size="icon"
            aria-label="About Time Distribution"
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
