import React, { useState, useMemo, useEffect } from 'react';
import { useProjectContext } from '../../contexts/ProjectContext';
import { usePlannerContext } from '../../contexts/PlannerContext';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { calculateWorkHourCapacity, getWorkHoursCapacityForPeriod } from '@/services/work-hours/workHourCapacityService';
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
import { ProjectsDetailView } from './ProjectsDetailView';

type TimeFrame = 'week' | 'month' | 'year';
type AveragePeriod = 'week' | 'month' | '6months';

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
  
  // Average Day card state
  const [averagePeriod, setAveragePeriod] = useState<AveragePeriod>('month');
  const [includedDays, setIncludedDays] = useState({
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false
  });
  
  const today = new Date();

  // Early return if essential data is not loaded
  if (!projects || !events || !settings) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

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
    return Object.values(settings.weeklyWorkHours).reduce((sum: number, dayData: any) => {
      // Handle both old (number) and new (WorkSlot[]) formats
      if (Array.isArray(dayData)) {
        return sum + dayData.reduce((daySum: number, slot: any) => daySum + (slot.duration || 0), 0);
      }
      return sum + (dayData || 0);
    }, 0);
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

  // Helper function to calculate valid days in period
  const calculateValidDays = (startDate: Date, endDate: Date) => {
    let count = 0;
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[current.getDay()] as keyof typeof includedDays;
      
      if (includedDays[dayName]) {
        count++;
      }
      
      current.setDate(current.getDate() + 1);
    }
    
    return count;
  };

  // Average Day calculation
  const averageDayData = useMemo(() => {
    // Early return if groups is not available yet
    if (!groups || !Array.isArray(groups)) {
      return {
        timeline: [],
        totalAverageHours: 0,
        validDays: 0
      };
    }

    // Calculate date range based on selected period
    const endDate = new Date();
    const startDate = new Date();
    
    switch (averagePeriod) {
      case 'week':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case '6months':
        startDate.setMonth(endDate.getMonth() - 6);
        break;
    }

    // Get events within the date range that are completed or tracked
    const relevantEvents = events.filter(event => {
      try {
        const eventDate = new Date(event.startTime);
        const isInRange = eventDate >= startDate && eventDate <= endDate;
        const isCompleted = event.completed === true || event.type === 'tracked';
        
        // Check if the event's day of week is included
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[eventDate.getDay()] as keyof typeof includedDays;
        const isDayIncluded = includedDays[dayName];
        
        return isInRange && isCompleted && isDayIncluded;
      } catch (error) {
        console.warn('Error processing event:', event, error);
        return false;
      }
    });

    // Group events by hour of day and group
    const hourlyData: { [hour: number]: { [groupId: string]: number } } = {};
    const totalValidDays = calculateValidDays(startDate, endDate);

    relevantEvents.forEach(event => {
      try {
        const startTime = new Date(event.startTime);
        const endTime = new Date(event.endTime);
        
        // Find the project group for this event
        const project = event.projectId ? projects.find(p => p.id === event.projectId) : null;
        const groupId = project?.groupId || 'ungrouped';

        const startHour = startTime.getHours();
        const endHour = endTime.getHours();
        
        // Handle events that span multiple hours
        for (let hour = startHour; hour <= endHour; hour++) {
          if (!hourlyData[hour]) hourlyData[hour] = {};
          if (!hourlyData[hour][groupId]) hourlyData[hour][groupId] = 0;
          
          // Create hour boundaries
          const hourStart = new Date(startTime);
          hourStart.setHours(hour, 0, 0, 0);
          const hourEnd = new Date(startTime);
          hourEnd.setHours(hour + 1, 0, 0, 0);
          
          // Find overlap between event and this hour
          const overlapStart = new Date(Math.max(startTime.getTime(), hourStart.getTime()));
          const overlapEnd = new Date(Math.min(endTime.getTime(), hourEnd.getTime()));
          
          if (overlapEnd > overlapStart) {
            const hourPortion = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60);
            hourlyData[hour][groupId] += hourPortion;
          }
        }
      } catch (error) {
        console.warn('Error processing event times:', event, error);
      }
    });

    // Calculate averages and create 24-hour timeline
    const timelineData = [];
    for (let hour = 0; hour < 24; hour++) {
      const hourData = hourlyData[hour] || {};
      const groupTotals: { [groupId: string]: number } = {};
      
      Object.keys(hourData).forEach(groupId => {
        groupTotals[groupId] = totalValidDays > 0 ? hourData[groupId] / totalValidDays : 0;
      });

      timelineData.push({
        hour,
        time: `${hour.toString().padStart(2, '0')}:00`,
        groups: groupTotals,
        totalHours: Object.values(groupTotals).reduce((sum, hours) => sum + hours, 0)
      });
    }

    return {
      timeline: timelineData,
      totalAverageHours: timelineData.reduce((sum, hour) => sum + hour.totalHours, 0),
      validDays: totalValidDays
    };
  }, [events, projects, groups, averagePeriod, includedDays]);

  // Future projects
  const futureProjects = useMemo(() => {
    return projects.filter(project => new Date(project.startDate) > today);
  }, [projects, today]);







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
            <ProjectsDetailView
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

            {/* Average Day Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sun className="h-5 w-5 text-orange-500" />
                  Average Day
                </CardTitle>
                <CardDescription>
                  Your typical day based on completed activities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Period Selection */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Period:</span>
                    <Select value={averagePeriod} onValueChange={(value: AveragePeriod) => setAveragePeriod(value)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="week">Last Week</SelectItem>
                        <SelectItem value="month">Last Month</SelectItem>
                        <SelectItem value="6months">Last 6 Months</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Day Filter */}
                  <div className="space-y-2">
                    <span className="text-sm text-gray-600">Include days:</span>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {Object.entries(includedDays).map(([day, checked]) => (
                        <label key={day} className="flex items-center space-x-2 cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(isChecked) => 
                              setIncludedDays(prev => ({ ...prev, [day]: !!isChecked }))
                            }
                          />
                          <span className="capitalize">{day.substring(0, 3)}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Summary Stats */}
                  <div className="text-center py-2 border-t border-gray-100">
                    <div className="text-2xl font-bold text-foreground mb-1">
                      {averageDayData.totalAverageHours.toFixed(1)}h
                    </div>
                    <div className="text-sm text-gray-600">Average daily hours</div>
                  </div>

                  {/* 24-Hour Timeline */}
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {averageDayData.timeline
                      .filter(hourData => hourData.totalHours > 0.1) // Only show hours with meaningful activity
                      .map((hourData) => (
                        <div key={hourData.hour} className="flex items-center gap-2">
                          <div className="text-xs text-gray-500 w-10">{hourData.time}</div>
                          <div className="flex-1 flex gap-1">
                            {Object.entries(hourData.groups).map(([groupId, hours]) => {
                              const hoursNum = Number(hours);
                              if (hoursNum < 0.1) return null;
                              
                              const group = groups?.find(g => g.id === groupId);
                              const groupName = group?.name || 'Other';
                              const groupColor = group?.color || '#6b7280';
                              
                              return (
                                <div
                                  key={groupId}
                                  className="h-4 rounded-sm relative group"
                                  style={{
                                    backgroundColor: groupColor,
                                    width: `${Math.max(hoursNum * 20, 8)}px`, // Min width of 8px for visibility
                                    opacity: 0.8
                                  }}
                                  title={`${groupName}: ${hoursNum.toFixed(1)}h`}
                                />
                              );
                            })}
                          </div>
                          <div className="text-xs text-gray-600 w-8">
                            {hourData.totalHours.toFixed(1)}h
                          </div>
                        </div>
                      ))
                    }
                    
                    {averageDayData.timeline.every(hourData => hourData.totalHours <= 0.1) && (
                      <div className="text-center py-4 text-gray-500">
                        <p className="text-sm">No activity data for this period</p>
                        <p className="text-xs">Try a different time period or include more days</p>
                      </div>
                    )}
                  </div>

                  {averageDayData.validDays > 0 && (
                    <div className="text-center pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-500">
                        Based on {averageDayData.validDays} days
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>


        </div>
      </div>
    </div>
  );
}

export default InsightsView;