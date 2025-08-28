import React from 'react';
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group';
import { Button } from '../../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { Calendar } from '../../ui/calendar';
import { Input } from '../../ui/input';
import { ChevronLeft, ChevronRight, MapPin, CalendarSearch } from 'lucide-react';

interface TimelineNavigationProps {
  timelineMode: 'days' | 'weeks';
  setTimelineMode: (mode: 'days' | 'weeks') => void;
  currentDate: Date;
  dateRangeText: string;
  isDatePickerOpen: boolean;
  setIsDatePickerOpen: (open: boolean) => void;
  projectSearchQuery: string;
  setProjectSearchQuery: (query: string) => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  onGoToToday: () => void;
  onDateSelect: (date: Date | undefined) => void;
}

export function TimelineNavigation({
  timelineMode,
  setTimelineMode,
  currentDate,
  dateRangeText,
  isDatePickerOpen,
  setIsDatePickerOpen,
  projectSearchQuery,
  setProjectSearchQuery,
  onNavigate,
  onGoToToday,
  onDateSelect
}: TimelineNavigationProps) {
  return (
    <div className="flex items-center justify-between">
      {/* Timeline Mode Toggle and Today Button */}
      <div className="flex items-center" style={{ gap: '21px' }}>
        <ToggleGroup
          type="single"
          value={timelineMode}
          onValueChange={(value) => {
            if (value) {
              console.time(`⏱️ Timeline mode change to ${value}`);
              setTimelineMode(value as 'days' | 'weeks');
              // Use setTimeout to measure after render
              setTimeout(() => {
                console.timeEnd(`⏱️ Timeline mode change to ${value}`);
              }, 100);
            }
          }}
          variant="outline"
          className="border border-gray-200 rounded-lg h-9 p-1"
        >
          <ToggleGroupItem value="weeks" aria-label="Weeks mode" className="px-3 py-1 h-7">
            Weeks
          </ToggleGroupItem>
          <ToggleGroupItem value="days" aria-label="Days mode" className="px-3 py-1 h-7">
            Days
          </ToggleGroupItem>
        </ToggleGroup>

        <Button variant="outline" onClick={onGoToToday} className="h-9 gap-2">
          <MapPin className="w-4 h-4" />
          Today
        </Button>

        <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9">
              <CalendarSearch className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={currentDate}
              onSelect={onDateSelect}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <Input
          type="text"
          placeholder="search for project"
          value={projectSearchQuery}
          onChange={(e) => setProjectSearchQuery(e.target.value)}
          className="h-9 w-48"
        />
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" className="h-9 w-9 px-0" onClick={() => onNavigate('prev')}>
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <h2 className="text-sm font-semibold text-gray-900 text-center px-2">
          {dateRangeText}
        </h2>

        <Button variant="ghost" className="h-9 w-9 px-0" onClick={() => onNavigate('next')}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
