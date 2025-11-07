import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Filter, Calendar, Info, Layers } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { CalendarEvent, Group, Project } from '../../types';
import { FilterModal } from './FilterModal';
import { formatDuration, normalizeToMidnight, addDaysToDate } from '@/services';
import { ResponsiveLine } from '@nivo/line';
import { BRAND_COLORS } from '@/constants/colors';

interface FilterRule {
  id: string;
  type: 'group' | 'project';
  groupIds?: string[];
  projectIds?: string[];
}

interface HeatmapTimeSlot {
  hour: number;
  minute: number;
  timeString: string; // "09:30"
  intensity: number; // 0-1 representing frequency/duration
  totalDuration: number; // Total duration in hours for this slot
  eventCount: number; // Number of events that occurred in this slot
}

type AveragePeriod = 'week' | 'month' | '6months';
type LayerMode = 'single' | 'group' | 'project';

interface AverageDayHeatmapCardProps {
  events: CalendarEvent[];
  groups: Group[];
  projects: Project[];
}

export const AverageDayHeatmapCard: React.FC<AverageDayHeatmapCardProps> = ({
  events,
  groups,
  projects
}) => {
  const [averagePeriod, setAveragePeriod] = useState<AveragePeriod>('month');
  const [layerMode, setLayerMode] = useState<LayerMode>('single');
  const [includedDays, setIncludedDays] = useState({
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false
  });
  const [filterRules, setFilterRules] = useState<FilterRule[]>([]);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Calculate date range based on selected period
  const dateRange = useMemo(() => {
    const endDate = new Date();
    let startDate = new Date();
    
    switch (averagePeriod) {
      case 'week':
        startDate = addDaysToDate(endDate, -7);
        break;
      case 'month':
        startDate = new Date(endDate);
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case '6months':
        startDate = new Date(endDate);
        startDate.setMonth(endDate.getMonth() - 6);
        break;
    }
    
    return { startDate, endDate };
  }, [averagePeriod]);

  // Filter events based on filter rules
  const filteredEvents = useMemo(() => {
    if (filterRules.length === 0) {
      return events;
    }

    return events.filter(event => {
      return filterRules.some(rule => {
        if (rule.type === 'project' && rule.projectIds?.length) {
          return rule.projectIds.includes(event.projectId || '');
        }
        
        if (rule.type === 'group' && rule.groupIds?.length) {
          const eventProject = projects.find(p => p.id === event.projectId);
          return eventProject && rule.groupIds.includes(eventProject.groupId);
        }
        
        return false;
      });
    });
  }, [events, filterRules, projects]);

  // Calculate valid days count
  const validDaysCount = useMemo(() => {
    let count = 0;
    let current = new Date(dateRange.startDate);
    
    while (current <= dateRange.endDate) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[current.getDay()] as keyof typeof includedDays;
      
      if (includedDays[dayName]) {
        count++;
      }
      
      current = addDaysToDate(current, 1);
    }
    
    return count;
  }, [dateRange, includedDays]);

  // Calculate heatmap data
  const heatmapData = useMemo(() => {
    const slots: HeatmapTimeSlot[] = [];
    const slotData: { [key: string]: { duration: number; count: number } } = {};

    // Initialize 48 slots (30-minute intervals)
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const key = `${hour}-${minute}`;
        slotData[key] = { duration: 0, count: 0 };
        
        slots.push({
          hour,
          minute,
          timeString,
          intensity: 0,
          totalDuration: 0,
          eventCount: 0
        });
      }
    }

    // Process filtered events within date range
    const relevantEvents = filteredEvents.filter(event => {
      try {
        const eventDate = new Date(event.startTime);
        const isInRange = eventDate >= dateRange.startDate && eventDate <= dateRange.endDate;
        const isCompleted = event.completed === true || event.type === 'tracked';
        
        // Check if the event's day of week is included
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[eventDate.getDay()] as keyof typeof includedDays;
        const isDayIncluded = includedDays[dayName];
        
        return isInRange && isCompleted && isDayIncluded;
      } catch (error) {
        console.warn('Error processing event for heatmap:', event, error);
        return false;
      }
    });

    // Accumulate data for each time slot
    relevantEvents.forEach(event => {
      try {
        const startTime = new Date(event.startTime);
        const endTime = new Date(event.endTime);
        
        // Handle events that span multiple days by processing each day separately
        const eventStartOfDay = normalizeToMidnight(new Date(startTime));
        
        const eventEndOfDay = new Date(startTime);
        eventEndOfDay.setHours(23, 59, 59, 999);
        
        const effectiveStart = new Date(Math.max(startTime.getTime(), eventStartOfDay.getTime()));
        const effectiveEnd = new Date(Math.min(endTime.getTime(), eventEndOfDay.getTime()));
        
        if (effectiveEnd <= effectiveStart) return;
        
        // Process in 30-minute chunks
        const current = new Date(effectiveStart);
        while (current < effectiveEnd) {
          const hour = current.getHours();
          const minute = Math.floor(current.getMinutes() / 30) * 30; // Round to nearest 30-min
          const key = `${hour}-${minute}`;
          
          // Calculate overlap with this 30-minute slot
          const slotStart = new Date(current);
          slotStart.setHours(hour, minute, 0, 0);
          
          const slotEnd = new Date(slotStart);
          slotEnd.setMinutes(slotEnd.getMinutes() + 30);
          
          const overlapStart = new Date(Math.max(effectiveStart.getTime(), slotStart.getTime()));
          const overlapEnd = new Date(Math.min(effectiveEnd.getTime(), slotEnd.getTime()));
          
          if (overlapEnd > overlapStart) {
            const overlapDuration = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60); // hours
            
            slotData[key].duration += overlapDuration;
            slotData[key].count += 1; // Count this event occurrence in this slot
          }
          
          // Move to next 30-minute slot
          current.setTime(slotStart.getTime() + 30 * 60 * 1000);
        }
      } catch (error) {
        console.warn('Error processing event times for heatmap:', event, error);
      }
    });

    // Calculate intensities and populate slot data
    let maxIntensity = 0;
    
    slots.forEach((slot, index) => {
      const key = `${slot.hour}-${slot.minute}`;
      const data = slotData[key];
      
      slot.totalDuration = validDaysCount > 0 ? data.duration / validDaysCount : 0;
      slot.eventCount = data.count;
      
      // Intensity based on frequency (how often events occurred in this slot)
      // Normalize by valid days to get average frequency
      slot.intensity = validDaysCount > 0 ? data.count / validDaysCount : 0;
      maxIntensity = Math.max(maxIntensity, slot.intensity);
    });

    // Normalize intensities to 0-1 range
    if (maxIntensity > 0) {
      slots.forEach(slot => {
        slot.intensity = slot.intensity / maxIntensity;
      });
    }

    return slots;
  }, [filteredEvents, dateRange, includedDays, validDaysCount]);

  // Transform data for stream chart
  const streamData = useMemo(() => {
    if (layerMode === 'single') {
      // Single layer showing total work time
      return heatmapData.map(slot => ({
        time: slot.timeString,
        work: Math.min(slot.totalDuration, 1.0) // Cap at 1 hour
      }));
    } else if (layerMode === 'group') {
      // Multiple layers by group
      const groupData: { [key: string]: { [time: string]: number } } = {};
      
      // Initialize group data
      groups.forEach(group => {
        groupData[group.id] = {};
        heatmapData.forEach(slot => {
          groupData[group.id][slot.timeString] = 0;
        });
      });

      // Process events and accumulate by group
      const relevantEvents = filteredEvents.filter(event => {
        try {
          const eventDate = new Date(event.startTime);
          const isInRange = eventDate >= dateRange.startDate && eventDate <= dateRange.endDate;
          const isCompleted = event.completed === true || event.type === 'tracked';
          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const dayName = dayNames[eventDate.getDay()] as keyof typeof includedDays;
          const isDayIncluded = includedDays[dayName];
          return isInRange && isCompleted && isDayIncluded;
        } catch {
          return false;
        }
      });

      relevantEvents.forEach(event => {
        const project = projects.find(p => p.id === event.projectId);
        if (!project || !groupData[project.groupId]) return;

        try {
          const startTime = new Date(event.startTime);
          const endTime = new Date(event.endTime);
          const eventStartOfDay = normalizeToMidnight(new Date(startTime));
          const eventEndOfDay = new Date(startTime);
          eventEndOfDay.setHours(23, 59, 59, 999);
          const effectiveStart = new Date(Math.max(startTime.getTime(), eventStartOfDay.getTime()));
          const effectiveEnd = new Date(Math.min(endTime.getTime(), eventEndOfDay.getTime()));
          
          if (effectiveEnd <= effectiveStart) return;
          
          const current = new Date(effectiveStart);
          while (current < effectiveEnd) {
            const hour = current.getHours();
            const minute = Math.floor(current.getMinutes() / 30) * 30;
            const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            
            const slotStart = new Date(current);
            slotStart.setHours(hour, minute, 0, 0);
            const slotEnd = new Date(slotStart);
            slotEnd.setMinutes(slotEnd.getMinutes() + 30);
            
            const overlapStart = new Date(Math.max(effectiveStart.getTime(), slotStart.getTime()));
            const overlapEnd = new Date(Math.min(effectiveEnd.getTime(), slotEnd.getTime()));
            
            if (overlapEnd > overlapStart) {
              const overlapDuration = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60);
              groupData[project.groupId][timeString] += overlapDuration;
            }
            
            current.setTime(slotStart.getTime() + 30 * 60 * 1000);
          }
        } catch {
          // Skip on error
        }
      });

      // Convert to stream format
      return heatmapData.map(slot => {
        const dataPoint: any = { time: slot.timeString };
        groups.forEach(group => {
          const avgDuration = validDaysCount > 0 ? groupData[group.id][slot.timeString] / validDaysCount : 0;
          dataPoint[group.name] = Math.min(avgDuration, 1.0);
        });
        return dataPoint;
      });
    } else {
      // Multiple layers by project (filtered)
      const projectData: { [key: string]: { [time: string]: number } } = {};
      const relevantProjects = new Set<string>();
      
      // Get all relevant projects from filtered events
      const relevantEvents = filteredEvents.filter(event => {
        try {
          const eventDate = new Date(event.startTime);
          const isInRange = eventDate >= dateRange.startDate && eventDate <= dateRange.endDate;
          const isCompleted = event.completed === true || event.type === 'tracked';
          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const dayName = dayNames[eventDate.getDay()] as keyof typeof includedDays;
          const isDayIncluded = includedDays[dayName];
          if (isInRange && isCompleted && isDayIncluded && event.projectId) {
            relevantProjects.add(event.projectId);
          }
          return isInRange && isCompleted && isDayIncluded;
        } catch {
          return false;
        }
      });

      // Initialize project data
      relevantProjects.forEach(projectId => {
        projectData[projectId] = {};
        heatmapData.forEach(slot => {
          projectData[projectId][slot.timeString] = 0;
        });
      });

      // Process events and accumulate by project
      relevantEvents.forEach(event => {
        if (!event.projectId || !projectData[event.projectId]) return;

        try {
          const startTime = new Date(event.startTime);
          const endTime = new Date(event.endTime);
          const eventStartOfDay = new Date(startTime);
          eventStartOfDay.setHours(0, 0, 0, 0);
          const eventEndOfDay = new Date(startTime);
          eventEndOfDay.setHours(23, 59, 59, 999);
          const effectiveStart = new Date(Math.max(startTime.getTime(), eventStartOfDay.getTime()));
          const effectiveEnd = new Date(Math.min(endTime.getTime(), eventEndOfDay.getTime()));
          
          if (effectiveEnd <= effectiveStart) return;
          
          const current = new Date(effectiveStart);
          while (current < effectiveEnd) {
            const hour = current.getHours();
            const minute = Math.floor(current.getMinutes() / 30) * 30;
            const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            
            const slotStart = new Date(current);
            slotStart.setHours(hour, minute, 0, 0);
            const slotEnd = new Date(slotStart);
            slotEnd.setMinutes(slotEnd.getMinutes() + 30);
            
            const overlapStart = new Date(Math.max(effectiveStart.getTime(), slotStart.getTime()));
            const overlapEnd = new Date(Math.min(effectiveEnd.getTime(), slotEnd.getTime()));
            
            if (overlapEnd > overlapStart) {
              const overlapDuration = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60);
              projectData[event.projectId][timeString] += overlapDuration;
            }
            
            current.setTime(slotStart.getTime() + 30 * 60 * 1000);
          }
        } catch {
          // Skip on error
        }
      });

      // Convert to stream format
      return heatmapData.map(slot => {
        const dataPoint: any = { time: slot.timeString };
        relevantProjects.forEach(projectId => {
          const project = projects.find(p => p.id === projectId);
          if (project) {
            const avgDuration = validDaysCount > 0 ? projectData[projectId][slot.timeString] / validDaysCount : 0;
            dataPoint[project.name] = Math.min(avgDuration, 1.0);
          }
        });
        return dataPoint;
      });
    }
  }, [heatmapData, layerMode, groups, projects, filteredEvents, dateRange, includedDays, validDaysCount]);

  // Convert stream data to line format (30-minute slots)
  const lineData = useMemo(() => {
    if (layerMode === 'single') {
      return [{
        id: 'work',
        data: streamData.map((d: any, index) => ({
          x: index,
          y: Math.min(d.work || 0, 0.5), // Cap at 30 minutes (0.5 hours)
          time: d.time
        }))
      }];
    } else if (layerMode === 'group') {
      return groups.map(group => ({
        id: group.name,
        data: streamData.map((d: any, index) => ({
          x: index,
          y: Math.min(d[group.name] || 0, 0.5), // Cap at 30 minutes
          time: d.time
        }))
      }));
    } else {
      // Get unique project names from filtered events
      const projectIds = new Set(
        filteredEvents
          .filter(e => e.projectId && e.completed)
          .map(e => e.projectId)
      );
      const relevantProjects = projects.filter(p => projectIds.has(p.id));
      return relevantProjects.map(project => ({
        id: project.name,
        data: streamData.map((d: any, index) => ({
          x: index,
          y: Math.min(d[project.name] || 0, 0.5), // Cap at 30 minutes
          time: d.time
        }))
      }));
    }
  }, [streamData, layerMode, groups, projects, filteredEvents]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const totalDuration = heatmapData.reduce((sum, slot) => sum + slot.totalDuration, 0);
    const totalEvents = heatmapData.reduce((sum, slot) => sum + slot.eventCount, 0);
    const activeSlots = heatmapData.filter(slot => slot.intensity > 0).length;
    
    return {
      totalDuration,
      totalEvents,
      activeSlots,
      averageDailyHours: totalDuration
    };
  }, [heatmapData]);

  // Get intensity color for heatmap visualization
  const getIntensityColor = (intensity: number) => {
    if (intensity === 0) return 'rgb(243, 244, 246)'; // gray-100
    
    // Use a blue color scale - from light blue to dark blue
    const alpha = Math.max(0.1, intensity);
    return `rgba(59, 130, 246, ${alpha})`; // blue-500 with varying alpha
  };

  const getActiveFilterCount = () => {
    return filterRules.reduce((count, rule) => {
      if (rule.type === 'group') return count + (rule.groupIds?.length || 0);
      if (rule.type === 'project') return count + (rule.projectIds?.length || 0);
      return count;
    }, 0);
  };

  return (
    <>
  <Card className="lg:col-span-2 relative">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">My Average Day</CardTitle>
            </div>
            <div className="flex items-center gap-3">
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
              
              <Select value={layerMode} onValueChange={(value: LayerMode) => setLayerMode(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">
                    <div className="flex items-center gap-2">
                      <Layers className="h-3 w-3" />
                      Single
                    </div>
                  </SelectItem>
                  <SelectItem value="group">
                    <div className="flex items-center gap-2">
                      <Layers className="h-3 w-3" />
                      By Group
                    </div>
                  </SelectItem>
                  <SelectItem value="project">
                    <div className="flex items-center gap-2">
                      <Layers className="h-3 w-3" />
                      By Project
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFilterModalOpen(true)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filters
                {getActiveFilterCount() > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                    {getActiveFilterCount()}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
  <CardContent className="relative">
          <div className="space-y-6">
            {/* Stream Chart */}
            <div className="space-y-4">
              <div className="relative h-80">
                {summaryStats.activeSlots === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-sm">No activity data for this period</p>
                      <p className="text-xs">Try adjusting your filters or selecting a different time period</p>
                    </div>
                  </div>
                ) : (
                  <ResponsiveLine
                    data={lineData}
                    margin={{ top: 20, right: 20, bottom: 50, left: 50 }}
                    xScale={{ type: 'linear', min: 0, max: 47 }}
                    yScale={{ type: 'linear', min: 0, max: 0.5 }}
                    axisTop={null}
                    axisRight={null}
                    axisBottom={{
                      tickSize: 5,
                      tickPadding: 5,
                      tickRotation: -45,
                      legend: 'Time of Day',
                      legendOffset: 45,
                      tickValues: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46],
                      format: (value) => {
                        const index = Number(value);
                        const hour = Math.floor(index / 2);
                        const isHalfHour = index % 2 === 1;
                        if (isHalfHour) return ''; // Don't show label for 30-min marks
                        if (hour === 0) return '12am';
                        if (hour < 12) return `${hour}am`;
                        if (hour === 12) return '12pm';
                        return `${hour - 12}pm`;
                      }
                    }}
                    axisLeft={{
                      tickSize: 0,
                      tickPadding: 5,
                      tickRotation: 0,
                      tickValues: [0, 0.5],
                      format: (value) => {
                        const num = Number(value);
                        if (num <= 0.01) return '0min';
                        if (num >= 0.49) return '30min';
                        return String(num);
                      }
                    }}
                    colors={layerMode === 'single' 
                      ? [BRAND_COLORS.primary] 
                      : { scheme: 'category10' }
                    }
                    lineWidth={1}
                    enableArea={true}
                    areaOpacity={0.5}
                    areaBaselineValue={0}
                    enablePoints={false}
                    enableGridX={false}
                    enableGridY={true}
                    curve="monotoneX"
                    animate={true}
                    motionConfig="gentle"
                    enableSlices="x"
                    sliceTooltip={({ slice }) => {
                      return (
                        <div
                          className="pointer-events-none relative rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-[0_8px_16px_rgba(15,23,42,0.08)]"
                          style={{ minWidth: 170 }}
                        >
                          <div className="font-semibold text-slate-900">Avg time spent</div>
                          <div className="mt-2 space-y-1">
                            {slice.points.map((point: any) => {
                              const minutes = Math.round(Number(point.data.y) * 60);
                              return (
                                <div key={point.id} className="font-medium text-slate-900">
                                  {point.serieId} - {minutes} min
                                </div>
                              );
                            })}
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
                      grid: {
                        line: {
                          stroke: '#f0f0f0',
                          strokeWidth: 1
                        }
                      }
                    }}
                  />
                )}
              </div>
            </div>

            {/* Summary Stats moved to bottom */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground mb-1">
                  {formatDuration(summaryStats.averageDailyHours)}
                </div>
                <div className="text-sm text-gray-600">Average daily hours</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground mb-1">
                  {summaryStats.activeSlots}
                </div>
                <div className="text-sm text-gray-600">Active time slots</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground mb-1">
                  {validDaysCount}
                </div>
                <div className="text-sm text-gray-600">Days analyzed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground mb-1">
                  {getActiveFilterCount()}
                </div>
                <div className="text-sm text-gray-600">Active filters</div>
              </div>
            </div>
          </div>
        </CardContent>

        {/* Info popover bottom-right of the card */}
        <div className="absolute bottom-6 right-6">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="About My Average Day"
                className="rounded-full"
              >
                <Info className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" side="top" align="end">
              <div className="space-y-2">
                <div className="font-medium text-sm">About My Average Day</div>
                <p className="text-xs text-gray-600">
                  Stream chart showing average work hours throughout the day based on your completed events.
                </p>
                <div className="text-xs text-gray-700 space-y-2">
                  <div className="font-medium">How to Read</div>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>X-axis: Time of day (00:00 to 23:30 in 30-min intervals)</li>
                    <li>Y-axis: Hours worked (0 to 1.0 hour per time slot)</li>
                    <li>Area shows average work duration for each time slot</li>
                    <li>Higher peaks = more work during that time</li>
                  </ul>
                  <div className="font-medium">Layer Modes</div>
                  <ul className="list-disc pl-4 space-y-1">
                    <li><strong>Single:</strong> Total work time across all projects</li>
                    <li><strong>By Group:</strong> Separate layers for each group</li>
                    <li><strong>By Project:</strong> Separate layers for each project</li>
                  </ul>
                  <div className="font-medium">Settings</div>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Period: Last Week / Last Month / Last 6 Months</li>
                    <li>Filters: Select specific groups/projects and days</li>
                  </ul>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
  </Card>

      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        groups={groups}
        projects={projects}
        filterRules={filterRules}
        onFilterRulesChange={setFilterRules}
        includedDays={includedDays}
        onIncludedDaysChange={setIncludedDays}
      />
    </>
  );
};
