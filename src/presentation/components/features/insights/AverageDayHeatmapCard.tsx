import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/shadcn/card';
import { Button } from '@/components/shadcn/button';
import { Filter, Calendar, GraduationCap } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/shadcn/select';
import { CalendarEvent, Group, Project } from '@/shared/types';
import { FilterModal } from './FilterModal';
import { formatDuration, normalizeToMidnight, addDaysToDate } from '@/services';
import { useDebouncedCalculation } from '@/hooks/insights/useDebouncedCalculation';

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
  onHelpClick?: () => void;
}

export const AverageDayHeatmapCard: React.FC<AverageDayHeatmapCardProps> = ({
  events,
  groups,
  projects,
  onHelpClick
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

  // PERFORMANCE: Debounce expensive heatmap calculation
  // Calculate heatmap data
  const heatmapData = useDebouncedCalculation(() => {
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
      const eventDate = new Date(event.startTime);
      const isInRange = eventDate >= dateRange.startDate && eventDate <= dateRange.endDate;
      const isCompleted = event.completed === true || event.type === 'tracked';
      
      // Check if the event's day of week is included
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[eventDate.getDay()] as keyof typeof includedDays;
      const isDayIncluded = includedDays[dayName];
      
      return isInRange && isCompleted && isDayIncluded;
    });

    // Accumulate data for each time slot
    relevantEvents.forEach(event => {
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
    });

    // Calculate intensities and populate slot data
    let maxIntensity = 0;
    
    slots.forEach((slot) => {
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
  }, [filteredEvents, dateRange, includedDays, validDaysCount], 500);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (!heatmapData || heatmapData.length === 0) {
      return {
        totalDuration: 0,
        totalEvents: 0,
        activeSlots: 0,
        averageDailyHours: 0
      };
    }
    
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
                <SelectTrigger className="h-9 w-32">
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
                className="h-9 flex items-center gap-2"
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
            {/* Rectangle Heatmap View */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-700">Time Activity Frequency</h4>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>Low</span>
                  <div className="flex gap-0.5">
                    {[0.1, 0.3, 0.5, 0.7, 1.0].map(intensity => (
                      <div
                        key={intensity}
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: getIntensityColor(intensity) }}
                      />
                    ))}
                  </div>
                  <span>High</span>
                </div>
              </div>

              {!heatmapData || heatmapData.length === 0 || summaryStats.activeSlots === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-sm">No activity data for this period</p>
                  <p className="text-xs">Try adjusting your filters or selecting a different time period</p>
                </div>
              ) : (
                <div className="relative">
                  {/* 24-hour horizontal calendar layout */}
                  <div className="space-y-2">
                    {/* Time labels */}
                    <div className="flex items-center">
                      <div className="w-16"></div>
                      <div className="flex-1 flex">
                        {heatmapData.filter(slot => slot.minute === 0).map((slot) => (
                          <div
                            key={`label-${slot.hour}`}
                            className="flex-1 text-xs text-gray-500 text-center"
                          >
                            {slot.hour === 0 ? '12am' : slot.hour < 12 ? `${slot.hour}am` : slot.hour === 12 ? '12pm' : `${slot.hour - 12}pm`}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Heatmap bars */}
                    <div className="flex items-center gap-2">
                      <div className="w-16 text-xs text-gray-600 font-medium">Activity</div>
                      <div className="flex-1 flex gap-0.5">
                        {heatmapData.map((slot) => (
                          <div
                            key={`${slot.hour}-${slot.minute}`}
                            className="flex-1 h-16 cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all rounded-sm"
                            style={{ 
                              backgroundColor: getIntensityColor(slot.intensity),
                              minWidth: '8px'
                            }}
                            title={`${slot.timeString}: ${(slot.intensity * 100).toFixed(0)}% activity, ${slot.totalDuration.toFixed(2)}h avg duration`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* Legend */}
                  <div className="mt-4 text-center">
                    <div className="text-xs text-gray-500">Each bar represents a 30-minute time slot throughout the day</div>
                  </div>
                </div>
              )}
            </div>

            {/* Summary Stats */}
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

        {/* Info button bottom-right of the card */}
        <div className="absolute bottom-6 right-6">
          <Button
            variant="outline"
            size="icon"
            aria-label="About My Average Day"
            className="h-9 w-9 rounded-full"
            onClick={onHelpClick}
          >
            <GraduationCap className="w-4 h-4" />
          </Button>
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
