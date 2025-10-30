import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Filter, Calendar, Info } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { CalendarEvent, Group, Project } from '../../types';
import { FilterModal } from './FilterModal';
import { formatDuration } from '@/services';

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
    const current = new Date(dateRange.startDate);
    
    while (current <= dateRange.endDate) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[current.getDay()] as keyof typeof includedDays;
      
      if (includedDays[dayName]) {
        count++;
      }
      
      current.setDate(current.getDate() + 1);
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
        const eventStartOfDay = new Date(startTime);
        eventStartOfDay.setHours(0, 0, 0, 0);
        
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
            {/* Day filter moved into Filters modal for better UX */}

            {/* Heatmap */}
            <div className="space-y-4">
              {/* Inline heading and color key removed; moved to info popover */}

              {/* 24-hour vertical calendar layout */}
              <div className="relative">
                {/* Heatmap grid - vertical flow like a calendar day */}
                <div className="max-w-lg mx-auto">
                  {heatmapData.map((slot, index) => (
                    <div
                      key={`${slot.hour}-${slot.minute}`}
                      className="flex items-center"
                    >
                      {/* Time label - show only on the hour (every 2nd slot) */}
                      <div className="w-12 text-xs text-gray-500 text-right pr-2">
                        {slot.minute === 0 ? `${slot.hour.toString().padStart(2, '0')}:00` : ''}
                      </div>
                      
                      {/* Time slot rectangle - no gaps */}
                      <div
                        className="flex-1 h-4 cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all border-r border-gray-100"
                        style={{ 
                          backgroundColor: getIntensityColor(slot.intensity)
                        }}
                        title={`${slot.timeString}: ${(slot.intensity * 100).toFixed(0)}% activity, ${slot.totalDuration.toFixed(2)}h avg duration`}
                      />
                    </div>
                  ))}
                </div>
                
                {/* Legend removed per request */}
              </div>

              {summaryStats.activeSlots === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-sm">No activity data for this period</p>
                  <p className="text-xs">Try adjusting your filters or selecting a different time period</p>
                </div>
              )}
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
                  Heatmap of when you're most active during an average day within the selected period and filters.
                </p>
                <div className="text-xs text-gray-700 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Low</span>
                    <div className="flex gap-0.5">
                      {[0.1, 0.3, 0.5, 0.7, 1.0].map((alpha) => (
                        <div key={alpha} className="w-3 h-3 rounded-sm" style={{ backgroundColor: `rgba(59, 130, 246, ${alpha})` }} />
                      ))}
                    </div>
                    <span className="text-gray-500">High</span>
                  </div>
                  <div className="font-medium">Keys</div>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Each bar = 30 minutes, flowing from 00:00 to 23:30</li>
                    <li>Color intensity indicates activity</li>
                    <li>Respects selected Groups/Projects and Included Days</li>
                    <li>Period: Last Week / Last Month / Last 6 Months</li>
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
