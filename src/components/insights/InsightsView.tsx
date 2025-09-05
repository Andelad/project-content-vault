import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useProjectContext } from '../../contexts/ProjectContext';
import { usePlannerContext } from '../../contexts/PlannerContext';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { useTimelineContext } from '../../contexts/TimelineContext';
import { calculateWorkHourCapacity, getWorkHoursCapacityForPeriod } from '../../services';
import { WeeklyCapacityCalculationService } from '../../services';
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
  Clock, 
  AlertTriangle, 
  ChevronLeft,
  ChevronRight,
  Sun
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { TimeAnalysisChart } from './TimeAnalysisChart';
import { InsightsActiveProjectsCard } from './InsightsActiveProjectsCard';
import { AverageDayHeatmapCard } from './AverageDayHeatmapCard';

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
  
  const today = useMemo(() => new Date(), []);

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
    return WeeklyCapacityCalculationService.calculateWeeklyCapacity(settings.weeklyWorkHours);
  }, [settings.weeklyWorkHours]);

  // Current projects (active today)
  const currentProjects = useMemo(() => {
    return projects.filter(project => {
      const start = new Date(project.startDate);
      const end = new Date(project.endDate);
      return start <= today && end >= today;
    });
  }, [projects, today]);

  // Future committed hours
  const futureCommitments = useMemo(() => {
    return projects
      .filter(project => new Date(project.startDate) > today)
      .reduce((sum, project) => sum + project.estimatedHours, 0);
  }, [projects, today]);

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
            <TimeAnalysisChart
              timeAnalysisTimeFrame={timeAnalysisTimeFrame}
              setTimeAnalysisTimeFrame={setTimeAnalysisTimeFrame}
              timeOffset={timeOffset}
              setTimeOffset={setTimeOffset}
            />
          </div>

          {/* Projects and Commitments Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-[21px]">
            {/* Projects Detail */}
            <InsightsActiveProjectsCard
              showActiveProjects={showActiveProjects}
              setShowActiveProjects={setShowActiveProjects}
              currentProjects={currentProjects}
              futureProjects={futureProjects}
              today={today}
            />

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