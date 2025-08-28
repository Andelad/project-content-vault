import React from 'react';
import { Card } from '../../ui/card';
import { AvailabilitySidebar } from '../AvailabilitySidebar';
import { TimelineColumnMarkers } from '../TimelineColumnMarkers';
import { UnifiedAvailabilityCircles } from '../UnifiedAvailabilityCircles';
import { HoverableTimelineScrollbar } from '../HoverableTimelineScrollbar';
import { expandHolidayDates } from '@/services';

interface AvailabilityContentProps {
  collapsed: boolean;
  dates: Date[];
  mode: 'days' | 'weeks';
  holidays: any[];
  projects: any[];
  settings: any;
  availabilityDisplayMode: 'circles' | 'numbers';
  viewportStart: Date;
  setViewportStart: (date: Date) => void;
  setCurrentDate: (date: Date) => void;
  VIEWPORT_DAYS: number;
  isAnimating: boolean;
  setIsAnimating: (animating: boolean) => void;
  dragState: any;
}

export function AvailabilityContent({
  collapsed,
  dates,
  mode,
  holidays,
  projects,
  settings,
  availabilityDisplayMode,
  viewportStart,
  setViewportStart,
  setCurrentDate,
  VIEWPORT_DAYS,
  isAnimating,
  setIsAnimating,
  dragState
}: AvailabilityContentProps) {
  return (
    <Card className="h-60 flex flex-col overflow-hidden relative">
      {/* Column Markers - spans full availability card height */}
      <div className="absolute pointer-events-none z-1" style={{
        top: 0,
        bottom: 0,
        left: collapsed ? '48px' : '280px', // After sidebar
        right: 0,
        transition: 'left 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        willChange: 'left'
      }}>
        <TimelineColumnMarkers dates={dates} mode={mode} />
        {/* Full-column holiday overlays for availability card */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
          {holidays && holidays.length > 0 && holidays.map(holiday => {
            const expandedDates = expandHolidayDates([{ ...holiday, name: holiday.title || 'Holiday' }]);
            const columnWidth = mode === 'weeks' ? 77 : 40;
            const dayWidth = mode === 'weeks' ? 11 : columnWidth; // 11px per day in weeks mode
            const totalDays = mode === 'weeks' ? dates.length * 7 : dates.length;

            // Calculate day positions for the holiday
            const timelineStart = new Date(dates[0]);
            timelineStart.setHours(0,0,0,0);
            const msPerDay = 24 * 60 * 60 * 1000;

            const startDay = Math.floor((expandedDates[0].getTime() - timelineStart.getTime()) / msPerDay);
            const holidayDays = expandedDates.length;

            const startDayIndex = Math.max(0, startDay);
            const endDayIndex = Math.min(totalDays - 1, startDay + holidayDays - 1);

            if (endDayIndex < 0 || startDayIndex > totalDays - 1) return null;

            const leftPx = startDayIndex * dayWidth;
            const widthPx = (endDayIndex - startDayIndex + 1) * dayWidth;

            // More condensed pattern for weeks view (thinner lines, smaller gaps)
            const backgroundPattern = mode === 'weeks'
              ? 'repeating-linear-gradient(-45deg, rgba(107,114,128,0.16) 0 1.5px, transparent 1.5px 4px)'
              : 'repeating-linear-gradient(-45deg, rgba(107,114,128,0.16) 0 2px, transparent 2px 6px)';

            return (
              <div
                key={`holiday-avail-${holiday.id}`}
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{
                  left: `${leftPx}px`,
                  width: `${widthPx}px`,
                  backgroundImage: backgroundPattern
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="flex h-full">
        {/* Availability Sidebar */}
        <AvailabilitySidebar
          collapsed={collapsed}
          dates={dates}
        />

        {/* Availability Timeline Content */}
        <div className="flex-1 flex flex-col bg-white relative" style={{ minWidth: `${dates.length * (mode === 'weeks' ? 77 : 40)}px` }}>
          {/* Available Hours Row */}
          <div className="border-b border-gray-100 h-12">
            <UnifiedAvailabilityCircles
              dates={dates}
              projects={projects}
              settings={settings}
              type="available"
              mode={mode}
              displayMode={availabilityDisplayMode}
            />
          </div>

          {/* Overbooked Hours Row */}
          <div className="border-b border-gray-100 h-12">
            <UnifiedAvailabilityCircles
              dates={dates}
              projects={projects}
              settings={settings}
              type="busy"
              mode={mode}
              displayMode={availabilityDisplayMode}
            />
          </div>

          {/* Overtime Planned/Completed Row */}
          <div className="border-b border-gray-100 h-12">
            <UnifiedAvailabilityCircles
              dates={dates}
              settings={settings}
              type="overtime-planned"
              mode={mode}
              displayMode={availabilityDisplayMode}
            />
          </div>

          {/* Planned/Completed Row */}
          <div className="border-b border-gray-100 h-12">
            <UnifiedAvailabilityCircles
              dates={dates}
              settings={settings}
              type="total-planned"
              mode={mode}
              displayMode={availabilityDisplayMode}
            />
          </div>

          {/* Other Time Row */}
          <div className="h-12">
            <UnifiedAvailabilityCircles
              dates={dates}
              settings={settings}
              type="other-time"
              mode={mode}
              displayMode={availabilityDisplayMode}
            />
          </div>
        </div>
      </div>

      {/* Hoverable Timeline Scrollbar for availability card */}
      <HoverableTimelineScrollbar
        viewportStart={viewportStart}
        setViewportStart={setViewportStart}
        setCurrentDate={setCurrentDate}
        VIEWPORT_DAYS={VIEWPORT_DAYS}
        isAnimating={isAnimating}
        setIsAnimating={setIsAnimating}
        sidebarWidth={collapsed ? 48 : 280}
        bottomOffset={0}
        isDragging={!!dragState}
        stopAutoScroll={() => {}} // Auto-scroll handled by services
      />
    </Card>
  );
}
