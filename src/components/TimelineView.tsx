import React, { useState, useCallback, useMemo } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TooltipProvider } from './ui/tooltip';
import { Card } from './ui/card';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { ChevronLeft, ChevronRight, MapPin, CalendarSearch, Folders } from 'lucide-react';
import { useAppDataOnly, useAppActionsOnly, useApp } from '../contexts/AppContext';
import { useTimelineData } from '../hooks/useTimelineData';
import { useDynamicViewportDays } from '../hooks/useDynamicViewportDays';
import { calculateDaysDelta, createSmoothAnimation, TIMELINE_CONSTANTS, debounce, throttle } from '@/lib/dragUtils';
import { performanceMonitor } from '@/lib/performanceUtils';
import { checkProjectOverlap, adjustProjectDatesForDrag } from '@/lib/projectOverlapUtils';

// Import timeline components
import { TimelineHeader } from './timeline/TimelineHeader';
import { TimelineSidebar } from './timeline/TimelineSidebar';
import { AvailabilitySidebar } from './timeline/AvailabilitySidebar';
import { TimelineDateHeaders } from './timeline/TimelineDateHeaders';
import { TimelineBar } from './timeline/TimelineBar';
import { TimelineColumnMarkers } from './timeline/TimelineColumnMarkers';
import { AvailabilityCircles } from './timeline/AvailabilityCircles';
import { TimelineScrollbar } from './timeline/TimelineScrollbar';
import { HoverableTimelineScrollbar } from './timeline/HoverableTimelineScrollbar';
import { TimelineAddProjectRow, AddHolidayRow } from './timeline/AddProjectRow';
import { SmartHoverAddProjectBar } from './timeline/SmartHoverAddProjectBar';
import { PerformanceStatus } from './PerformanceStatus';
import { DraggableRowComponent } from './timeline/DraggableRowComponent';
import { AddRowComponent } from './timeline/AddRowComponent';
import { DraggableGroupRow } from './timeline/DraggableGroupRow';
import { AddGroupRow } from './timeline/AddGroupRow';

// Import new availability component
import { NewAvailabilityCircles } from './timeline/NewAvailabilityCircles';

export function TimelineView() {
  const { 
    projects, 
    groups, 
    rows, 
    settings, 
    currentDate, 
    selectedProjectId, 
    holidays,
    timelineMode,
    setTimelineMode,
    setCurrentDate, 
    updateProject, 
    setSelectedProjectId, 
    addProject, 
    updateHoliday,
    setCreatingNewProject 
  } = useApp();
  
  // Timeline state management
  const [viewportStart, setViewportStart] = useState(() => {
    const start = new Date(currentDate);
    start.setDate(1); // Start at beginning of month
    start.setHours(0, 0, 0, 0); // Normalize time component
    return start;
  });
  
  // Protected viewport setter that respects scrollbar blocking
  const protectedSetViewportStart = useCallback((date: Date) => {
    // Check if scrollbar is blocking updates
    if ((window as any).__budgiScrollbarBlocking) {
      console.log('🚫 TimelineView blocked from updating viewport - scrollbar is dragging');
      return;
    }
    setViewportStart(date);
  }, []);
  
  const [collapsed, setCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragState, setDragState] = useState<any>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Auto-scroll state for drag operations
  const [autoScrollState, setAutoScrollState] = useState<{
    isScrolling: boolean;
    direction: 'left' | 'right' | null;
    intervalId: NodeJS.Timeout | null;
  }>({
    isScrolling: false,
    direction: null,
    intervalId: null
  });

  // Get dynamic viewport days based on available width
  const VIEWPORT_DAYS = useDynamicViewportDays(collapsed, timelineMode);

  // Get timeline data using your existing hook
  const { dates, viewportEnd, filteredProjects, mode, actualViewportStart } = useTimelineData(projects, viewportStart, VIEWPORT_DAYS, timelineMode, collapsed);

  // Expand holiday ranges into individual Date objects for fast lookup by the markers
  const holidayDates = useMemo(() => {
    if (!holidays || holidays.length === 0) return [] as Date[];
    const result: Date[] = [];
    for (const h of holidays) {
      // h.startDate and h.endDate are Date objects in AppContext processing
      const start = new Date(h.startDate);
      const end = new Date(h.endDate);
      start.setHours(0,0,0,0);
      end.setHours(0,0,0,0);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        result.push(new Date(d));
      }
    }
    return result;
  }, [holidays]);

  // Debug performance logging
  console.log(`🚀 Timeline performance:`, {
    mode: timelineMode,
    days: dates.length,
    projects: filteredProjects.length,
    totalCalculations: dates.length * filteredProjects.length
  });

  // Memoize date range formatting
  const dateRangeText = useMemo(() => {
    // Use the actual timeline start and end dates, not the requested viewport dates
    const timelineStart = actualViewportStart;
    const timelineEnd = viewportEnd;
    
    const sameMonth = timelineStart.getMonth() === timelineEnd.getMonth();
    const sameYear = timelineStart.getFullYear() === timelineEnd.getFullYear();
    
    if (sameMonth && sameYear) {
      return `${timelineStart.toLocaleDateString('en-US', { 
        month: 'long',
        day: 'numeric'
      })} - ${timelineEnd.toLocaleDateString('en-US', { 
        day: 'numeric',
        year: 'numeric'
      })}`;
    } else if (sameYear) {
      return `${timelineStart.toLocaleDateString('en-US', { 
        month: 'short',
        day: 'numeric'
      })} - ${timelineEnd.toLocaleDateString('en-US', { 
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })}`;
    } else {
      return `${timelineStart.toLocaleDateString('en-US', { 
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })} - ${timelineEnd.toLocaleDateString('en-US', { 
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })}`;
    }
  }, [actualViewportStart, viewportEnd]);

  // Navigation handlers with smooth scrolling  
  const handleNavigate = useCallback((direction: 'prev' | 'next') => {
    if (isAnimating) return;
    
    const targetViewportStart = new Date(viewportStart);
    const days = direction === 'prev' ? -VIEWPORT_DAYS : VIEWPORT_DAYS;
    targetViewportStart.setDate(targetViewportStart.getDate() + days);
    
    setIsAnimating(true);
    createSmoothAnimation(
      viewportStart.getTime(),
      targetViewportStart.getTime(),
      TIMELINE_CONSTANTS.SCROLL_ANIMATION_DURATION,
      (intermediateStart) => setViewportStart(intermediateStart),
      (targetStart) => {
        setViewportStart(targetStart);
        setCurrentDate(new Date(targetStart));
        setIsAnimating(false);
      }
    );
  }, [viewportStart, setCurrentDate, isAnimating, VIEWPORT_DAYS]);

  const handleGoToToday = useCallback(() => {
    if (isAnimating) return;
    
    const today = new Date();
    const targetViewportStart = new Date(today);
    targetViewportStart.setDate(today.getDate() - Math.floor(VIEWPORT_DAYS / 4));
    
    const currentStart = viewportStart.getTime();
    const targetStart = targetViewportStart.getTime();
    const daysDifference = Math.abs((targetStart - currentStart) / (24 * 60 * 60 * 1000));
    
    if (daysDifference < 1) {
      setViewportStart(targetViewportStart);
      setCurrentDate(today);
      return;
    }
    
    setIsAnimating(true);
    const animationDuration = Math.min(
      TIMELINE_CONSTANTS.SCROLL_ANIMATION_MAX_DURATION, 
      daysDifference * TIMELINE_CONSTANTS.SCROLL_ANIMATION_MS_PER_DAY
    );
    
    createSmoothAnimation(
      currentStart,
      targetStart,
      animationDuration,
      (intermediateStart) => setViewportStart(intermediateStart),
      () => {
        setViewportStart(targetViewportStart);
        setCurrentDate(today);
        setIsAnimating(false);
      }
    );
  }, [viewportStart, setCurrentDate, isAnimating, VIEWPORT_DAYS]);

  const handleDateSelect = useCallback((selectedDate: Date | undefined) => {
    if (!selectedDate || isAnimating) return;
    
    // Normalize the selected date
    const normalizedDate = new Date(selectedDate);
    normalizedDate.setHours(0, 0, 0, 0);
    
    // Calculate target viewport start to center the selected date
    const targetViewportStart = new Date(normalizedDate);
    targetViewportStart.setDate(normalizedDate.getDate() - Math.floor(VIEWPORT_DAYS / 4));
    
    const currentStart = viewportStart.getTime();
    const targetStart = targetViewportStart.getTime();
    const daysDifference = Math.abs((targetStart - currentStart) / (24 * 60 * 60 * 1000));
    
    // Close the date picker
    setIsDatePickerOpen(false);
    
    if (daysDifference < 1) {
      setViewportStart(targetViewportStart);
      setCurrentDate(normalizedDate);
      return;
    }
    
    setIsAnimating(true);
    const animationDuration = Math.min(
      TIMELINE_CONSTANTS.SCROLL_ANIMATION_MAX_DURATION, 
      daysDifference * TIMELINE_CONSTANTS.SCROLL_ANIMATION_MS_PER_DAY
    );
    
    createSmoothAnimation(
      currentStart,
      targetStart,
      animationDuration,
      (intermediateStart) => setViewportStart(intermediateStart),
      () => {
        setViewportStart(targetViewportStart);
        setCurrentDate(normalizedDate);
        setIsAnimating(false);
      }
    );
  }, [viewportStart, setCurrentDate, isAnimating, VIEWPORT_DAYS]);

  const handleToggleCollapse = useCallback(() => {
    setCollapsed(prev => !prev);
  }, []);

  // Scroll to project functionality - position project start as second visible date with smooth animation
  const scrollToProject = useCallback((project: any) => {
    if (isAnimating) return;
    
    const projectStart = new Date(project.startDate);
    const targetViewportStart = new Date(projectStart);
    targetViewportStart.setDate(targetViewportStart.getDate() - 1);
    
    const currentStart = viewportStart.getTime();
    const targetStart = targetViewportStart.getTime();
    const daysDifference = (targetStart - currentStart) / (24 * 60 * 60 * 1000);
    
    if (Math.abs(daysDifference) < 1) {
      setViewportStart(targetViewportStart);
      setCurrentDate(new Date(projectStart));
      return;
    }
    
    setIsAnimating(true);
    const animationDuration = Math.min(
      TIMELINE_CONSTANTS.SCROLL_ANIMATION_MAX_DURATION, 
      Math.abs(daysDifference) * TIMELINE_CONSTANTS.SCROLL_ANIMATION_MS_PER_DAY
    );
    
    createSmoothAnimation(
      currentStart,
      targetStart,
      animationDuration,
      (intermediateStart) => setViewportStart(intermediateStart),
      () => {
        setViewportStart(targetViewportStart);
        setCurrentDate(new Date(projectStart));
        setIsAnimating(false);
      }
    );
  }, [viewportStart, setCurrentDate, isAnimating]);

  // Auto-scroll functions for drag operations
  const startAutoScroll = useCallback((direction: 'left' | 'right') => {
    if (autoScrollState.isScrolling && autoScrollState.direction === direction) return;
    
    // Clear any existing auto-scroll
    if (autoScrollState.intervalId) {
      clearInterval(autoScrollState.intervalId);
    }
    
    const scrollAmount = timelineMode === 'weeks' ? 7 : 3; // Days to scroll per interval
    const intervalMs = 150; // Scroll every 150ms
    
    const intervalId = setInterval(() => {
      setViewportStart(prevStart => {
        // Check if scrollbar is blocking updates
        if ((window as any).__budgiScrollbarBlocking) {
          console.log('🚫 Auto-scroll blocked from updating viewport - scrollbar is dragging');
          return prevStart; // Return unchanged
        }
        
        const newStart = new Date(prevStart);
        const days = direction === 'left' ? -scrollAmount : scrollAmount;
        newStart.setDate(prevStart.getDate() + days);
        setCurrentDate(new Date(newStart));
        return newStart;
      });
    }, intervalMs);
    
    setAutoScrollState({
      isScrolling: true,
      direction,
      intervalId
    });
  }, [autoScrollState, timelineMode, setCurrentDate]);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollState.intervalId) {
      clearInterval(autoScrollState.intervalId);
    }
    setAutoScrollState({
      isScrolling: false,
      direction: null,
      intervalId: null
    });
  }, [autoScrollState.intervalId]);

  const checkAutoScroll = useCallback((clientX: number) => {
    if (!isDragging) return;
    
    // Get the timeline content area bounds
    const timelineContent = document.querySelector('.timeline-content-area');
    if (!timelineContent) return;
    
    const rect = timelineContent.getBoundingClientRect();
    const scrollThreshold = 80; // Pixels from edge to trigger scroll
    
    const distanceFromLeft = clientX - rect.left;
    const distanceFromRight = rect.right - clientX;
    
    if (distanceFromLeft < scrollThreshold && distanceFromLeft >= 0) {
      // Near left edge - scroll left
      startAutoScroll('left');
    } else if (distanceFromRight < scrollThreshold && distanceFromRight >= 0) {
      // Near right edge - scroll right
      startAutoScroll('right');
    } else {
      // Not near edges - stop auto scroll
      stopAutoScroll();
    }
  }, [isDragging, startAutoScroll, stopAutoScroll]);

  // Clean up auto-scroll on unmount or when dragging stops
  React.useEffect(() => {
    if (!isDragging) {
      stopAutoScroll();
    }
  }, [isDragging, stopAutoScroll]);

  React.useEffect(() => {
    return () => {
      if (autoScrollState.intervalId) {
        clearInterval(autoScrollState.intervalId);
      }
    };
  }, [autoScrollState.intervalId]);

  // Mouse handlers for timeline bar interactions
  const handleMouseDown = useCallback((e: React.MouseEvent, projectId: string, action: string) => {
    const targetProject = projects.find(p => p.id === projectId);
    if (!targetProject) return;
    
    const initialDragState = {
      projectId,
      action,
      startX: e.clientX,
      startY: e.clientY,
      originalStartDate: new Date(targetProject.startDate),
      originalEndDate: new Date(targetProject.endDate),
      lastDaysDelta: 0
    };
    
    setIsDragging(true);
    setDragState(initialDragState);
    
    const handleMouseMove = (e: MouseEvent) => {
      const daysDelta = calculateDaysDelta(e.clientX, initialDragState.startX, dates, true, timelineMode);
      
      // Check for auto-scroll during drag
      checkAutoScroll(e.clientX);
      
      if (action === 'resize-start-date' && daysDelta !== initialDragState.lastDaysDelta) {
        const currentProject = projects.find(p => p.id === projectId);
        if (currentProject) {
          const newStartDate = new Date(initialDragState.originalStartDate);
          newStartDate.setDate(newStartDate.getDate() + daysDelta);
          
          const endDate = new Date(currentProject.endDate);
          const oneDayBefore = new Date(endDate);
          oneDayBefore.setDate(endDate.getDate() - 1);
          
          if (newStartDate <= oneDayBefore) {
            // Check for overlaps with other projects in the same row
            const overlaps = checkProjectOverlap(
              projectId,
              currentProject.rowId,
              newStartDate,
              endDate,
              projects
            );
            
            // Only update if no overlaps
            if (overlaps.length === 0) {
              updateProject(projectId, { startDate: newStartDate });
              initialDragState.lastDaysDelta = daysDelta;
            }
          }
        }
      } else if (action === 'resize-end-date' && daysDelta !== initialDragState.lastDaysDelta) {
        const currentProject = projects.find(p => p.id === projectId);
        if (currentProject) {
          const newEndDate = new Date(initialDragState.originalEndDate);
          newEndDate.setDate(newEndDate.getDate() + daysDelta);
          
          const startDate = new Date(currentProject.startDate);
          const oneDayAfter = new Date(startDate);
          oneDayAfter.setDate(startDate.getDate() + 1);
          
          if (newEndDate >= oneDayAfter) {
            // Check for overlaps with other projects in the same row
            const overlaps = checkProjectOverlap(
              projectId,
              currentProject.rowId,
              startDate,
              newEndDate,
              projects
            );
            
            // Only update if no overlaps
            if (overlaps.length === 0) {
              updateProject(projectId, { endDate: newEndDate });
              initialDragState.lastDaysDelta = daysDelta;
            }
          }
        }
      } else if (action === 'move' && daysDelta !== initialDragState.lastDaysDelta) {
        const currentProject = projects.find(p => p.id === projectId);
        if (currentProject) {
          const newStartDate = new Date(initialDragState.originalStartDate);
          const newEndDate = new Date(initialDragState.originalEndDate);
          
          newStartDate.setDate(newStartDate.getDate() + daysDelta);
          newEndDate.setDate(newEndDate.getDate() + daysDelta);
          
          // Check for overlaps with other projects in the same row
          const overlaps = checkProjectOverlap(
            projectId,
            currentProject.rowId,
            newStartDate,
            newEndDate,
            projects
          );
          
          // Only update if no overlaps
          if (overlaps.length === 0) {
            updateProject(projectId, { 
              startDate: newStartDate,
              endDate: newEndDate 
            });
            initialDragState.lastDaysDelta = daysDelta;
          }
        }
      }
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      setDragState(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [projects, dates, updateProject, checkAutoScroll, timelineMode]);

  // COMPLETELY REWRITTEN HOLIDAY DRAG HANDLER - SIMPLE AND FAST
  const handleHolidayMouseDown = useCallback((e: React.MouseEvent, holidayId: string, action: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const targetHoliday = holidays.find(h => h.id === holidayId);
    if (!targetHoliday) return;
    
    console.log('🏖️ HOLIDAY DRAG START:', { action, holidayId });
    
    const startX = e.clientX;
    const dayWidth = timelineMode === 'weeks' ? 72 : 40;
    const originalStartDate = new Date(targetHoliday.startDate);
    const originalEndDate = new Date(targetHoliday.endDate);
    
    setIsDragging(true);
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const daysDelta = Math.round(deltaX / dayWidth);
      
      console.log(`🏖️ ${action.toUpperCase()}:`, { deltaX, daysDelta });
      
      try {
        if (action === 'resize-start-date') {
          const newStartDate = new Date(originalStartDate);
          newStartDate.setDate(originalStartDate.getDate() + daysDelta);
          
          // Allow start date to equal end date (single day holiday)
          if (newStartDate <= originalEndDate) {
            console.log('✅ START DATE UPDATE:', newStartDate.toDateString());
            updateHoliday(holidayId, { startDate: newStartDate });
          } else {
            console.log('❌ START DATE BLOCKED');
          }
          
        } else if (action === 'resize-end-date') {
          const newEndDate = new Date(originalEndDate);
          newEndDate.setDate(originalEndDate.getDate() + daysDelta);
          
          // Allow end date to equal start date (single day holiday)
          if (newEndDate >= originalStartDate) {
            console.log('✅ END DATE UPDATE:', newEndDate.toDateString());
            updateHoliday(holidayId, { endDate: newEndDate });
          } else {
            console.log('❌ END DATE BLOCKED');
          }
          
        } else if (action === 'move') {
          const newStartDate = new Date(originalStartDate);
          const newEndDate = new Date(originalEndDate);
          
          newStartDate.setDate(originalStartDate.getDate() + daysDelta);
          newEndDate.setDate(originalEndDate.getDate() + daysDelta);
          
          console.log('✅ MOVE UPDATE:', newStartDate.toDateString(), 'to', newEndDate.toDateString());
          updateHoliday(holidayId, { 
            startDate: newStartDate,
            endDate: newEndDate 
          });
        }
      } catch (error) {
        console.error('🚨 HOLIDAY UPDATE ERROR:', error);
      }
      
      checkAutoScroll(e.clientX);
    };
    
    const handleMouseUp = () => {
      console.log('🏖️ DRAG END');
      setIsDragging(false);
      setDragState(null);
      stopAutoScroll();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleMouseUp);
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        handleMouseMove({ clientX: touch.clientX } as MouseEvent);
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleMouseUp);
  }, [holidays, updateHoliday, checkAutoScroll, stopAutoScroll, timelineMode]);

  // Organize projects by groups for sidebar
  const groupsWithProjects = useMemo(() => {
    return groups.map(group => ({
      ...group,
      projects: projects.filter(project => project.groupId === group.id)
    }));
  }, [groups, projects]);

  // Handle creating projects from hover drag - opens modal for confirmation
  const handleCreateProject = useCallback((rowId: string, startDate: Date, endDate: Date) => {
  console.log('🎯 TimelineView.handleCreateProject called with rowId:', rowId, 'startDate:', startDate, 'endDate:', endDate);
  console.log('🎯 DETAILED: startDate ISO:', startDate.toISOString(), 'endDate ISO:', endDate.toISOString());
    const row = rows.find(r => r.id === rowId);
    if (!row) {
      console.error('❌ Row not found for rowId:', rowId);
      return;
    }

  console.log('✅ Found row:', row, 'groupId:', row.groupId);

    // REMOVED: Competing overlap check - SmartHoverAddProjectBar already validated this is safe
    // SmartHoverAddProjectBar prevents creation in occupied spaces, so we trust its validation

  console.log('🚀 Opening project creation modal with rowId:', rowId, 'groupId:', row.groupId, 'dates:', { startDate, endDate });
  console.log('🚀 DETAILED: About to call setCreatingNewProject with startDate ISO:', startDate.toISOString(), 'endDate ISO:', endDate.toISOString());
    // Open the project creation modal with the selected dates and row
    setCreatingNewProject(row.groupId, { startDate, endDate }, rowId);
  }, [rows, setCreatingNewProject, projects]);

  return (
    <DndProvider backend={HTML5Backend}>
      <TooltipProvider>
        <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
          {/* Timeline Header */}
          <TimelineHeader 
            currentDate={currentDate}
            viewportStart={viewportStart}
            viewportEnd={viewportEnd}
            onNavigate={handleNavigate}
            onGoToToday={handleGoToToday}
          />
          
          {/* Timeline Mode Toggle and Navigation */}
          <div className="px-6 p-[21px]">
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
                      onSelect={handleDateSelect}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="icon" onClick={() => handleNavigate('prev')}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                
                <h2 className="text-xl font-semibold text-gray-900 min-w-[280px] text-center">
                  {dateRangeText}
                </h2>
                
                <Button variant="ghost" size="icon" onClick={() => handleNavigate('next')}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
          
          {/* Main Content Area with Card */}
          <div className="flex-1 flex flex-col px-6 pb-6 min-h-0">
            <div className="flex-1 flex flex-col min-h-0 pt-[0px] pr-[0px] pb-[21px] pl-[0px]">
              {/* Timeline Card */}
              <Card className="flex-1 flex flex-col overflow-hidden relative timeline-card-container">
                {/* Column Markers - covers timeline area only, doesn't scroll */}
                <div className="absolute pointer-events-none z-1" style={{
                  top: '48px', // Below date header
                  bottom: '52px', // Above holiday row
                  left: collapsed ? '48px' : '280px', // After sidebar
                  right: 0,
                  transition: 'left 300ms cubic-bezier(0.4, 0, 0.2, 1)',
                  willChange: 'left'
                }}>
                  <TimelineColumnMarkers dates={dates} mode={mode} />
                  {/* Full-column holiday overlays that span the full scroll window */}
                  <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
                    {holidays && holidays.length > 0 && holidays.map(holiday => {
                      const holidayStart = new Date(holiday.startDate);
                      const holidayEnd = new Date(holiday.endDate);
                      const columnWidth = mode === 'weeks' ? 72 : 40;
                      const dayWidth = mode === 'weeks' ? columnWidth / 7 : columnWidth;
                      const timelineStart = new Date(dates[0]);
                      timelineStart.setHours(0,0,0,0);
                      const msPerDay = 24 * 60 * 60 * 1000;

                      holidayStart.setHours(0,0,0,0);
                      holidayEnd.setHours(0,0,0,0);

                      const startDay = Math.floor((holidayStart.getTime() - timelineStart.getTime()) / msPerDay);
                      const holidayDays = Math.round((holidayEnd.getTime() - holidayStart.getTime()) / msPerDay) + 1;
                      const totalDays = mode === 'weeks' ? dates.length * 7 : dates.length;

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
                          key={`holiday-full-${holiday.id}`}
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
                <div className="flex flex-col min-h-full bg-white">
                  {/* Fixed Headers Row */}
                  <div className="flex border-b border-gray-200 bg-white relative z-10">
                    {/* Sidebar Header */}
                    <div 
                      className="bg-white border-r border-gray-200 flex items-center py-2 relative"
                      style={{ 
                        width: collapsed ? '48px' : '280px',
                        minWidth: collapsed ? '48px' : '280px',
                        transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1), min-width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
                        willChange: 'width, min-width',
                        zIndex: 25
                      }}
                    >
                      <div className={`flex items-center w-full ${collapsed ? 'justify-center' : 'px-4 gap-3'}`}>
                        {collapsed ? (
                          <Folders className="w-4 h-4 text-gray-600" />
                        ) : (
                          <>
                            <Folders className="w-4 h-4 text-gray-600" />
                            <span>Projects</span>
                          </>
                        )}
                      </div>
                      
                      {/* Collapse Toggle Button */}
                      <button
                        onClick={handleToggleCollapse}
                        className="absolute top-3 -right-3 w-6 h-6 bg-white border border-border rounded-md flex items-center justify-center text-[#595956] hover:bg-gray-50 transition-colors duration-200 z-20"
                      >
                        {collapsed ? (
                          <ChevronRight className="w-4 h-4" />
                        ) : (
                          <ChevronLeft className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    
                    {/* Date Headers */}
                    <div className="flex-1 bg-white" style={{ 
                      minWidth: `${dates.length * (mode === 'weeks' ? 72 : 40)}px`
                    }}>
                      <TimelineDateHeaders dates={dates} mode={mode} />
                    </div>
                  </div>
                  
                  {/* Scrollable Content Area */}
                                    {/* Scrollable Content Area */}
                  <div className="flex-1 overflow-x-hidden overflow-y-auto light-scrollbar-vertical-only relative" style={{ 
                    display: 'flex',
                    height: '100%'
                  }}>
                    {/* Sidebar Content */}
                    <div 
                      className="bg-white relative"
                      style={{ 
                        width: collapsed ? '48px' : '280px',
                        height: '100%',
                        transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
                        willChange: 'width',
                        zIndex: 25
                      }}
                    >
                      {/* Border wrapper: at least viewport height, grows with content */}
                      <div className="border-r border-gray-200 min-h-full w-full">
                        <div style={{ 
                          opacity: collapsed ? 0 : 1,
                          visibility: collapsed ? 'hidden' : 'visible',
                          transition: 'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1), visibility 300ms cubic-bezier(0.4, 0, 0.2, 1)'
                        }}>
                          {groups.map((group, groupIndex) => (
                            <DraggableGroupRow key={group.id} group={group} index={groupIndex}>
                              {rows
                                .filter(row => row.groupId === group.id)
                                .sort((a, b) => a.order - b.order)
                                .map((row: any, rowIndex: number) => (
                                  <DraggableRowComponent
                                    key={row.id}
                                    row={row}
                                    index={rowIndex}
                                    groupId={group.id}
                                  />
                                ))
                              }
                              <AddRowComponent groupId={group.id} />
                            </DraggableGroupRow>
                          ))}
                          <AddGroupRow />
                        </div>
                      </div>
                    </div>
                    
                    {/* Timeline Content */}
                    <div className="bg-white timeline-content-area relative" style={{ 
                      flex: 1,
                      height: '100%'
                    }}>
                      {/* Scrollable Content Layer */}
                      <div className="relative z-10">
                        {/* per-row holiday overlays will render inside each row container */}
                      
                      {/* Holiday Overlay */}
                      {/* <HolidayOverlay dates={dates} type="projects" mode={mode} /> */}
                      
                      {/* Project Timeline Bars - Organized by Groups and Rows */}
                      
                      <div className="relative">
                        {groups.map(group => {
                          // Get all valid rows for this group
                          const groupRows = rows.filter(row => row.groupId === group.id).sort((a, b) => a.order - b.order);
                          
                          // Get all projects for this group that have valid rowIds
                          const groupProjects = projects.filter(project => project.groupId === group.id);
                          const orphanedProjects = groupProjects.filter(project => 
                            !project.rowId || !rows.some(row => row.id === project.rowId)
                          );
                          
                          // Log warning for orphaned projects
                          if (orphanedProjects.length > 0) {
                            console.warn(`Found ${orphanedProjects.length} orphaned projects in group ${group.id}:`, orphanedProjects.map(p => ({ id: p.id, name: p.name, rowId: p.rowId })));
                          }
                          
                          return (
                            <div key={group.id}>
                              {/* Group Header Row - Visual separator with optional group title when collapsed */}
                              <div className="h-8 border-b border-gray-200 bg-gray-50/50 relative">
                                {collapsed && (
                                  <div 
                                    className="absolute left-2 top-1/2 transform -translate-y-1/2 z-30 bg-gray-50/90 px-2 py-1 rounded text-xs font-medium text-gray-700"
                                    style={{ 
                                      marginLeft: '8px' // 8px gap from sidebar edge
                                    }}
                                  >
                                    {group.name}
                                  </div>
                                )}
                              </div>
                              
                              {/* Rows in this group */}
                              {groupRows.map((row: any) => {
                                // STRICT FILTERING: Only include projects that match BOTH rowId AND groupId
                                const rowProjects = projects.filter(project => 
                                  project.rowId === row.id && 
                                  project.groupId === group.id &&
                                  project.groupId === row.groupId // Triple check: project group matches row group
                                );
                                
                                // SAFETY CHECK: Warn about any projects that have mismatched group/row assignments
                                projects.forEach(project => {
                                  if (project.rowId === row.id && project.groupId !== row.groupId) {
                                    console.error(`🚨 MISMATCH: Project "${project.name}" (${project.id}) has rowId "${project.rowId}" in row group "${row.groupId}" but project groupId is "${project.groupId}"`);
                                  }
                                });
                                
                                return (
                                  <div key={row.id} className="h-[52px] border-b border-gray-100 relative">
                                    {/* Container for projects in this row - fixed height with absolute positioned children */}
                                    <div className="relative h-[52px]">
                                      {/* Height enforcer - ensures row maintains 52px height even when empty */}
                                      <div className="absolute inset-0 min-h-[52px]" />

                                      {/* holiday overlays moved to full-column containers outside rows */}

                                      {/* Render all projects in this row - positioned absolutely to overlay */}
                                      {rowProjects.map((project: any) => {
                                        // Always render TimelineBar to maintain consistent positioning
                                        // TimelineBar will handle visibility internally
                                        return (
                                          <div key={project.id} className="absolute inset-0 pointer-events-none">
                                            <TimelineBar
                                              project={project}
                                              dates={dates}
                                              viewportStart={viewportStart}
                                              viewportEnd={viewportEnd}
                                              isDragging={isDragging}
                                              dragState={dragState}
                                              handleMouseDown={handleMouseDown}
                                              mode={mode}
                                              isMultiProjectRow={true} // Add flag for multi-project rows
                                              collapsed={collapsed}
                                            />
                                          </div>
                                        );
                                      })}
                                      
                                      {/* Smart Hover Add Project Bar - positioned within same container as projects */}
                                      <SmartHoverAddProjectBar
                                        rowId={row.id}
                                        dates={dates}
                                        projects={rowProjects}
                                        onCreateProject={handleCreateProject}
                                        mode={mode}
                                        isDragging={isDragging}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                              
                              {/* Add Row spacer */}
                              <div className="h-9 border-b border-gray-100" />
                            </div>
                          );
                        })}
                        
                        {/* Add Group Row spacer */}
                        <div className="h-12 border-b border-gray-100" />
                      </div>
                      
                      </div> {/* End of Scrollable Content Layer */}
                    </div>
                  </div>
                  
                  {/* Fixed Add Holiday Row at bottom */}
                  <div className="border-t border-gray-200 bg-yellow-200">
                    <AddHolidayRow 
                      dates={dates} 
                      collapsed={collapsed} 
                      isDragging={isDragging}
                      dragState={dragState}
                      handleHolidayMouseDown={handleHolidayMouseDown}
                      mode={timelineMode}
                    />
                  </div>
                </div>
                
                {/* Hoverable Timeline Scrollbar - positioned above holiday row */}
                <HoverableTimelineScrollbar
                  viewportStart={viewportStart}
                  setViewportStart={setViewportStart}
                  setCurrentDate={setCurrentDate}
                  VIEWPORT_DAYS={VIEWPORT_DAYS}
                  isAnimating={isAnimating}
                  setIsAnimating={setIsAnimating}
                  sidebarWidth={collapsed ? 48 : 280}
                  bottomOffset={54}
                  isDragging={isDragging}
                  stopAutoScroll={stopAutoScroll}
                />
              </Card>
              
              {/* Availability Timeline Card */}
              <Card className="mt-4 h-60 flex flex-col overflow-hidden relative">
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
                      const holidayStart = new Date(holiday.startDate);
                      const holidayEnd = new Date(holiday.endDate);
                      const columnWidth = mode === 'weeks' ? 72 : 40;
                      const dayWidth = mode === 'weeks' ? columnWidth / 7 : columnWidth;
                      const timelineStart = new Date(dates[0]);
                      timelineStart.setHours(0,0,0,0);
                      const msPerDay = 24 * 60 * 60 * 1000;

                      holidayStart.setHours(0,0,0,0);
                      holidayEnd.setHours(0,0,0,0);

                      const startDay = Math.floor((holidayStart.getTime() - timelineStart.getTime()) / msPerDay);
                      const holidayDays = Math.round((holidayEnd.getTime() - holidayStart.getTime()) / msPerDay) + 1;
                      const totalDays = mode === 'weeks' ? dates.length * 7 : dates.length;

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
                  <div className="flex-1 flex flex-col bg-white relative" style={{ minWidth: `${dates.length * (mode === 'weeks' ? 72 : 40)}px` }}>
                    {/* Holiday Overlay */}
                    {/* <HolidayOverlay dates={dates} type="availability" mode={mode} /> */}
                    
                    {/* Available Hours Row */}
                    <div className="border-b border-gray-100 h-12">
                      <AvailabilityCircles
                        dates={dates}
                        projects={projects}
                        settings={settings}
                        type="available"
                        mode={mode}
                      />
                    </div>
                    
                    {/* Overbooked Hours Row */}
                    <div className="border-b border-gray-100 h-12">
                      <AvailabilityCircles
                        dates={dates}
                        projects={projects}
                        settings={settings}
                        type="busy"
                        mode={mode}
                      />
                    </div>

                    {/* Overtime Planned/Completed Row */}
                    <div className="border-b border-gray-100 h-12">
                      <NewAvailabilityCircles
                        dates={dates}
                        settings={settings}
                        type="overtime-planned"
                        mode={mode}
                      />
                    </div>

                    {/* Planned/Completed Row */}
                    <div className="border-b border-gray-100 h-12">
                      <NewAvailabilityCircles
                        dates={dates}
                        settings={settings}
                        type="total-planned"
                        mode={mode}
                      />
                    </div>

                    {/* Other Time Row */}
                    <div className="h-12">
                      <NewAvailabilityCircles
                        dates={dates}
                        settings={settings}
                        type="other-time"
                        mode={mode}
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
                  isDragging={isDragging}
                  stopAutoScroll={stopAutoScroll}
                />
              </Card>
              
              {/* Timeline Scrollbar - Outside the cards, at bottom of viewport */}
              <div className="mt-4">
                <PerformanceStatus className="mt-2" />
              </div>
            </div>
          </div>
        </div>
      </TooltipProvider>
    </DndProvider>
  );
}