import React, { useState, useCallback, useMemo } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TooltipProvider } from './ui/tooltip';
import { Card } from './ui/card';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { ChevronLeft, ChevronRight, MapPin, CalendarSearch } from 'lucide-react';
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
import { WeekendOverlay } from './timeline/WeekendOverlay';
import { HolidayOverlay } from './timeline/HolidayOverlay';
import { AvailabilityCircles } from './timeline/AvailabilityCircles';
import { TimelineScrollbar } from './timeline/TimelineScrollbar';
import { HoverableTimelineScrollbar } from './timeline/HoverableTimelineScrollbar';
import { TimelineAddProjectRow, AddHolidayRow } from './timeline/AddProjectRow';
import { SmartHoverAddProjectBar } from './timeline/SmartHoverAddProjectBar';
import { PerformanceStatus } from './PerformanceStatus';

// Import new availability component
import { NewAvailabilityCircles } from './timeline/NewAvailabilityCircles';

export function TimelineView() {
  const { projects, groups, rows, settings, currentDate, selectedProjectId, holidays } = useAppDataOnly();
  const { setCurrentDate, updateProject, setSelectedProjectId, addProject, updateHoliday } = useAppActionsOnly();
  const { setCreatingNewProject } = useApp();
  
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
  const [timelineMode, setTimelineMode] = useState<'days' | 'weeks'>('days');
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
  const { dates, viewportEnd, filteredProjects, mode, actualViewportStart } = useTimelineData(projects, viewportStart, VIEWPORT_DAYS, timelineMode);

  // Memoize date range formatting
  const dateRangeText = useMemo(() => {
    const sameMonth = viewportStart.getMonth() === viewportEnd.getMonth();
    const sameYear = viewportStart.getFullYear() === viewportEnd.getFullYear();
    
    if (sameMonth && sameYear) {
      return `${viewportStart.toLocaleDateString('en-US', { 
        month: 'long',
        day: 'numeric'
      })} - ${viewportEnd.toLocaleDateString('en-US', { 
        day: 'numeric',
        year: 'numeric'
      })}`;
    } else if (sameYear) {
      return `${viewportStart.toLocaleDateString('en-US', { 
        month: 'short',
        day: 'numeric'
      })} - ${viewportEnd.toLocaleDateString('en-US', { 
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })}`;
    } else {
      return `${viewportStart.toLocaleDateString('en-US', { 
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })} - ${viewportEnd.toLocaleDateString('en-US', { 
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })}`;
    }
  }, [viewportStart, viewportEnd]);

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
                  onValueChange={(value) => value && setTimelineMode(value as 'days' | 'weeks')}
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
                <div className="flex-1 flex min-h-0 overflow-x-auto">
                  {/* Sidebar */}
                  <TimelineSidebar
                    groups={groupsWithProjects}
                    rows={rows}
                    collapsed={collapsed}
                    onToggleCollapse={handleToggleCollapse}
                    dates={dates}
                  />
                  
                  {/* Timeline Content */}
                  <div className="flex-1 flex flex-col bg-white timeline-content-area" style={{ minWidth: `${dates.length * (mode === 'weeks' ? 72 : 40)}px` }}>
                    {/* Date Headers */}
                    <TimelineDateHeaders dates={dates} mode={mode} />
                    
                    {/* Timeline Grid - Scrollable Content */}
                    <div className="flex-1 overflow-y-auto relative pb-12 light-scrollbar">
                      {/* Weekend Overlay */}
                      <WeekendOverlay dates={dates} mode={mode} />
                      
                      {/* Holiday Overlay */}
                      <HolidayOverlay dates={dates} type="projects" mode={mode} />
                      
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
                      
                    </div>
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
                
                {/* Fixed Add Holiday Row at bottom */}
                <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 z-40">
                  <AddHolidayRow 
                    dates={dates} 
                    collapsed={collapsed} 
                    isDragging={isDragging}
                    dragState={dragState}
                    handleHolidayMouseDown={handleHolidayMouseDown}
                    mode={timelineMode}
                  />
                </div>
              </Card>
              
              {/* Availability Timeline Card */}
              <Card className="mt-4 h-60 flex flex-col overflow-hidden relative">
                <div className="flex h-full">
                  {/* Availability Sidebar */}
                  <AvailabilitySidebar
                    collapsed={collapsed}
                    dates={dates}
                  />
                  
                  {/* Availability Timeline Content */}
                  <div className="flex-1 flex flex-col bg-white relative" style={{ minWidth: `${dates.length * (mode === 'weeks' ? 72 : 40)}px` }}>
                    {/* Weekend Overlay */}
                    <WeekendOverlay dates={dates} mode={mode} />
                    
                    {/* Holiday Overlay */}
                    <HolidayOverlay dates={dates} type="availability" mode={mode} />
                    
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