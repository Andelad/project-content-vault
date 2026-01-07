import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/shadcn/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/shadcn/toggle-group';
import { DatePickerButton } from '@/components/shared/DatePickerButton';
import { HelpButton } from '@/components/shared/HelpButton';
import { ChevronLeft, ChevronRight, MapPin, Plus } from 'lucide-react';
import { 
  createSmoothDragAnimation, 
  TimelineViewportService,
  normalizeToMidnight,
  addDaysToDate,
  type SmoothAnimationConfig
} from '@/services';
import { TIMELINE_CONSTANTS, BRAND_COLORS } from '@/constants';
import { AppPageLayout } from '@/components/layout/AppPageLayout';

interface TimelineToolbarProps {
  timelineMode: 'days' | 'weeks';
  currentDate: Date;
  viewportStart: Date;
  actualViewportStart: Date;
  viewportEnd: Date;
  viewportDays: number;
  collapsed: boolean;
  mainSidebarCollapsed: boolean;
  isAnimating: boolean;
  groups: Array<{ id: string }>;
  onTimelineModeChange: (mode: 'days' | 'weeks') => void;
  onCurrentDateChange: (date: Date) => void;
  onViewportStartChange: (date: Date) => void;
  onAnimatingChange: (isAnimating: boolean) => void;
  onCreateNewProject: (groupId: string | null) => void;
  onHelpClick: () => void;
}

export function TimelineToolbar({
  timelineMode,
  currentDate,
  viewportStart,
  actualViewportStart,
  viewportEnd,
  viewportDays,
  collapsed,
  mainSidebarCollapsed,
  isAnimating,
  groups,
  onTimelineModeChange,
  onCurrentDateChange,
  onViewportStartChange,
  onAnimatingChange,
  onCreateNewProject,
  onHelpClick
}: TimelineToolbarProps) {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Format the date range display
  const dateRangeText = useMemo(() => {
    return TimelineViewportService.formatDateRange(actualViewportStart, viewportEnd);
  }, [actualViewportStart, viewportEnd]);

  // Navigation handler with smooth scrolling
  const handleNavigate = useCallback((direction: 'prev' | 'next') => {
    if (isAnimating) return;

    const targetViewport = TimelineViewportService.calculateNavigationTarget({
      currentViewportStart: viewportStart,
      viewportDays,
      direction,
      timelineMode
    });

    const animationDuration = TimelineViewportService.calculateAnimationDuration(
      viewportStart.getTime(),
      targetViewport.start.getTime()
    );

    onAnimatingChange(true);

    const animationConfig: SmoothAnimationConfig = {
      currentStart: viewportStart.getTime(),
      targetStart: targetViewport.start.getTime(),
      duration: animationDuration
    };

    createSmoothDragAnimation(
      animationConfig,
      (intermediateStart) => onViewportStartChange(intermediateStart),
      () => {
        onViewportStartChange(new Date(animationConfig.targetStart));
        onCurrentDateChange(new Date(animationConfig.targetStart));
        onAnimatingChange(false);
      }
    );
  }, [viewportStart, onCurrentDateChange, onViewportStartChange, onAnimatingChange, isAnimating, viewportDays, timelineMode]);

  // Go to today handler
  const handleGoToToday = useCallback(() => {
    if (isAnimating) return;

    const today = normalizeToMidnight(new Date());
    const targetViewport = TimelineViewportService.calculateTodayTarget({
      currentDate: today,
      viewportDays,
      timelineMode,
      timelineSidebarCollapsed: collapsed,
      mainSidebarCollapsed
    });

    // Check if animation should be skipped
    if (TimelineViewportService.shouldSkipAnimation(viewportStart.getTime(), targetViewport.start.getTime())) {
      onViewportStartChange(targetViewport.start);
      onCurrentDateChange(today);
      return;
    }

    const animationDuration = TimelineViewportService.calculateAnimationDuration(
      viewportStart.getTime(),
      targetViewport.start.getTime()
    );

    onAnimatingChange(true);

    const animationConfig: SmoothAnimationConfig = {
      currentStart: viewportStart.getTime(),
      targetStart: targetViewport.start.getTime(),
      duration: animationDuration
    };

    createSmoothDragAnimation(
      animationConfig,
      (intermediateStart) => onViewportStartChange(intermediateStart),
      () => {
        onViewportStartChange(targetViewport.start);
        onCurrentDateChange(today);
        onAnimatingChange(false);
      }
    );
  }, [viewportStart, onCurrentDateChange, onViewportStartChange, onAnimatingChange, isAnimating, viewportDays, timelineMode, collapsed, mainSidebarCollapsed]);

  // Date picker handler
  const handleDateSelect = useCallback((selectedDate: Date | undefined) => {
    if (!selectedDate || isAnimating) return;

    // Normalize the selected date
    const normalizedDate = normalizeToMidnight(new Date(selectedDate));

    // Calculate target viewport start to center the selected date
    const targetViewportStart = addDaysToDate(normalizedDate, -Math.floor(viewportDays / 4));
    const currentStart = viewportStart.getTime();
    const targetStart = targetViewportStart.getTime();
    const daysDifference = Math.abs((targetStart - currentStart) / (24 * 60 * 60 * 1000));

    // Close the date picker
    setIsDatePickerOpen(false);

    if (daysDifference < 1) {
      onViewportStartChange(targetViewportStart);
      onCurrentDateChange(normalizedDate);
      return;
    }

    onAnimatingChange(true);

    const animationDuration = Math.min(
      TIMELINE_CONSTANTS.SCROLL_ANIMATION_MAX_DURATION, 
      daysDifference * TIMELINE_CONSTANTS.SCROLL_ANIMATION_MS_PER_DAY
    );

    const animationConfig: SmoothAnimationConfig = {
      currentStart,
      targetStart,
      duration: animationDuration
    };

    createSmoothDragAnimation(
      animationConfig,
      (intermediateStart) => onViewportStartChange(intermediateStart),
      () => {
        onViewportStartChange(targetViewportStart);
        onCurrentDateChange(normalizedDate);
        onAnimatingChange(false);
      }
    );
  }, [viewportStart, onCurrentDateChange, onViewportStartChange, onAnimatingChange, isAnimating, viewportDays]);

  return (
    <AppPageLayout.SubHeader>
      <div className="flex items-center justify-between">
        {/* Timeline Mode Toggle and Today Button */}
        <div className="flex items-center" style={{ gap: '21px' }}>
          <Button 
            onClick={() => {
              // Get the first group ID or null if no groups exist
              const firstGroupId = groups.length > 0 ? groups[0].id : null;
              onCreateNewProject(firstGroupId);
            }}
            className="h-9 gap-2 px-3 shadow"
            style={{ backgroundColor: BRAND_COLORS.primary }}
          >
            <Plus className="w-4 h-4" />
            Add Project
          </Button>
          <ToggleGroup
            type="single"
            value={timelineMode}
            onValueChange={(value) => {
              if (value) {
                console.time(`⏱️ Timeline mode change to ${value}`);
                onTimelineModeChange(value as 'days' | 'weeks');
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
          <Button variant="outline" onClick={handleGoToToday} className="h-9 gap-2">
            <MapPin className="w-4 h-4" />
            Today
          </Button>
          <DatePickerButton
            selected={currentDate}
            onSelect={handleDateSelect}
            isOpen={isDatePickerOpen}
            onOpenChange={setIsDatePickerOpen}
          />
        </div>
        {/* Navigation Controls */}
        <div className="flex items-center gap-3">
          <HelpButton onClick={onHelpClick} />
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" className="h-9 w-9 px-0" onClick={() => handleNavigate('prev')}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-sm font-semibold text-gray-900 text-center px-2">
              {dateRangeText}
            </h2>
            <Button variant="ghost" className="h-9 w-9 px-0" onClick={() => handleNavigate('next')}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </AppPageLayout.SubHeader>
  );
}
