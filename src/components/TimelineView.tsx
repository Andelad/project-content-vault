import React, { useState, useCallback, useMemo } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TooltipProvider } from './ui/tooltip';
import { Card } from './ui/card';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { Input } from './ui/input';
import { ChevronLeft, ChevronRight, MapPin, CalendarSearch, Folders, Hash, Circle, PanelLeft } from 'lucide-react';
import { useProjectContext } from '../contexts/ProjectContext';
import { useTimelineContext } from '../contexts/TimelineContext';
import { usePlannerContext } from '../contexts/PlannerContext';
import { useSettingsContext } from '../contexts/SettingsContext';
import { expandHolidayDates, TimelineViewportService } from '@/services';
import { calculateHolidayOverlayPosition } from '@/services/timeline';
import { TimelineDragCoordinatorService, DragState } from '@/services/events';
import { useTimelineData } from '../hooks/useTimelineData';
import { useDynamicViewportDays } from '../hooks/useDynamicViewportDays';
import { calculateDaysDelta, createSmoothAnimation, debounce, throttle } from '@/lib/dragUtils';
import { TIMELINE_CONSTANTS } from '@/constants';
import { performanceMonitor } from '@/lib/performanceUtils';
import { throttledDragUpdate, clearDragQueue } from '@/lib/dragPerformance';

// Import timeline components
import { TimelineHeader } from './timeline/TimelineHeader';
import { TimelineSidebar } from './timeline/TimelineSidebar';
import { AvailabilitySidebar } from './timeline/AvailabilitySidebar';
import { TimelineDateHeaders } from './timeline/TimelineDateHeaders';
import { TimelineBar } from './timeline/TimelineBar';
import { TimelineColumnMarkers } from './timeline/TimelineColumnMarkers';
import { UnifiedAvailabilityCircles } from './timeline/UnifiedAvailabilityCircles';
import { TimelineScrollbar } from './timeline/TimelineScrollbar';
import { HoverableTimelineScrollbar } from './timeline/HoverableTimelineScrollbar';
import { TimelineAddProjectRow, AddHolidayRow } from './timeline/AddProjectRow';
import { SmartHoverAddProjectBar } from '@/components';
import { PerformanceStatus } from './debug/PerformanceStatus';
import { DraggableRowComponent } from './timeline/DraggableRowComponent';
import { AddRowComponent } from './timeline/AddRowComponent';
import { DraggableGroupRow } from './timeline/DraggableGroupRow';
import { AddGroupRow } from './timeline/AddGroupRow';
import { AppPageLayout } from './layout/AppPageLayout';

export function TimelineView() {
  // Get data from specific contexts
  const { 
    projects, 
    groups, 
    rows, 
    selectedProjectId, 
    milestones,
    updateProject, 
    setSelectedProjectId, 
    addProject, 
    updateMilestone,
    setCreatingNewProject,
    showMilestoneSuccessToast,
    showProjectSuccessToast
  } = useProjectContext();

  const { 
    currentDate, 
    timelineMode,
    collapsedGroups,
    setTimelineMode,
    setCurrentDate 
  } = useTimelineContext();

  const { 
    holidays,
    updateHoliday
  } = usePlannerContext();

  const { 
    settings 
  } = useSettingsContext();
  
  // Debug: Log the data structures  
  console.log('🔍 TimelineView - Available rows:', rows.length);
  console.log('🔍 TimelineView - Available groups:', groups.length);
  console.log('🔍 TimelineView - Available projects:', projects.length);
  
  // Check for orphaned projects (projects without proper rowId or groupId)
  const orphanedProjects = projects.filter(p => !p.rowId || !p.groupId);
  if (orphanedProjects.length > 0) {
    console.warn('� ORPHANED PROJECTS (missing rowId or groupId):', orphanedProjects.map(p => ({ 
      id: p.id, 
      name: p.name, 
      rowId: p.rowId, 
      groupId: p.groupId 
    })));
  }
  
  // Check for projects that have rowId/groupId but don't match existing rows
  const mismatchedProjects = projects.filter(p => {
    if (!p.rowId || !p.groupId) return false;
    const matchingRow = rows.find(r => r.id === p.rowId && r.groupId === p.groupId);
    return !matchingRow;
  });
  if (mismatchedProjects.length > 0) {
    console.warn('🚨 MISMATCHED PROJECTS (invalid rowId/groupId):', mismatchedProjects.map(p => ({ 
      id: p.id, 
      name: p.name, 
      rowId: p.rowId, 
      groupId: p.groupId 
    })));
  }
  
  // Auto-fix orphaned projects - assign them to the first available row in their group
  React.useEffect(() => {
    const orphanedProjects = projects.filter(p => !p.rowId || !p.groupId);
    
    if (orphanedProjects.length > 0 && groups.length > 0 && rows.length > 0) {
      console.log('🔧 Auto-fixing orphaned projects...');
      
      orphanedProjects.forEach(project => {
        // If project has no groupId, assign to first available group
        const targetGroupId = project.groupId || groups[0].id;
        
        // Find first row in this group
        const groupRows = rows.filter(r => r.groupId === targetGroupId);
        const targetRowId = project.rowId || (groupRows.length > 0 ? groupRows[0].id : null);
        
        if (targetRowId && (!project.rowId || !project.groupId)) {
          console.log(`🔧 Auto-fixing project ${project.name}: assigning to groupId=${targetGroupId}, rowId=${targetRowId}`);
          updateProject(project.id, { 
            groupId: targetGroupId,
            rowId: targetRowId
          }, { silent: true });
        }
      });
    }
  }, [projects, groups, rows, updateProject]);
  
  // Timeline state management
  const [viewportStart, setViewportStart] = useState(() => {
    const start = new Date(currentDate);
    start.setDate(1); // Start at beginning of month
    start.setHours(0, 0, 0, 0); // Normalize time component
    return start;
  });
  
  // Protected viewport setter that respects scrollbar blocking using service
  const protectedSetViewportStart = useCallback((date: Date) => {
    const blockingState = TimelineViewportService.checkViewportBlocking();
    if (blockingState.isBlocked) {
      console.log(`🚫 TimelineView blocked from updating viewport - ${blockingState.reason}`);
      return;
    }
    setViewportStart(date);
  }, []);
  
  const [collapsed, setCollapsed] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [availabilityDisplayMode, setAvailabilityDisplayMode] = useState<'circles' | 'numbers'>('circles');

  // Get dynamic viewport days based on available width
  const VIEWPORT_DAYS = useDynamicViewportDays(collapsed, timelineMode);

  // Get timeline data using your existing hook
  const { dates, viewportEnd, filteredProjects, mode, actualViewportStart } = useTimelineData(projects, viewportStart, VIEWPORT_DAYS, timelineMode, collapsed);

  // Expand holiday ranges into individual Date objects for fast lookup by the markers
  const holidayDates = useMemo(() => {
    const holidaysWithName = holidays.map(h => ({ ...h, name: h.title || 'Holiday' }));
    return expandHolidayDates(holidaysWithName);
  }, [holidays]);

  // Debug performance logging using service
  const performanceMetrics = useMemo(() => {
    return TimelineViewportService.calculateViewportPerformanceMetrics({
      timelineMode,
      daysCount: dates.length,
      projectsCount: filteredProjects.length
    });
  }, [timelineMode, dates.length, filteredProjects.length]);

  console.log(`🚀 Timeline performance:`, {
    mode: timelineMode,
    days: dates.length,
    projects: filteredProjects.length,
    ...performanceMetrics
  });

  // Memoize date range formatting using service
  const dateRangeText = useMemo(() => {
    return TimelineViewportService.formatDateRange(actualViewportStart, viewportEnd);
  }, [actualViewportStart, viewportEnd]);

  // Navigation handlers with smooth scrolling using service
  const handleNavigate = useCallback((direction: 'prev' | 'next') => {
    if (isAnimating) return;
    
    const targetViewport = TimelineViewportService.calculateNavigationTarget({
      currentViewportStart: viewportStart,
      viewportDays: VIEWPORT_DAYS,
      direction,
      timelineMode
    });
    
    const animationDuration = TimelineViewportService.calculateAnimationDuration(
      viewportStart.getTime(),
      targetViewport.start.getTime(),
      timelineMode
    );
    
    setIsAnimating(true);
    createSmoothAnimation(
      viewportStart.getTime(),
      targetViewport.start.getTime(),
      animationDuration,
      (intermediateStart) => setViewportStart(intermediateStart),
      (targetStart) => {
        setViewportStart(targetStart);
        setCurrentDate(new Date(targetStart));
        setIsAnimating(false);
      }
    );
  }, [viewportStart, setCurrentDate, isAnimating, VIEWPORT_DAYS, timelineMode]);

  const handleGoToToday = useCallback(() => {
    if (isAnimating) return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const targetViewport = TimelineViewportService.calculateTodayTarget({
      selectedDate: today,
      currentViewportStart: viewportStart,
      viewportDays: VIEWPORT_DAYS,
      timelineMode
    });
    
    // Check if animation should be skipped
    if (TimelineViewportService.shouldSkipAnimation(viewportStart.getTime(), targetViewport.start.getTime())) {
      setViewportStart(targetViewport.start);
      setCurrentDate(today);
      return;
    }
    
    const animationDuration = TimelineViewportService.calculateAnimationDuration(
      viewportStart.getTime(),
      targetViewport.start.getTime(),
      timelineMode
    );
    
    setIsAnimating(true);
    createSmoothAnimation(
      viewportStart.getTime(),
      targetViewport.start.getTime(),
      animationDuration,
      (intermediateStart) => setViewportStart(intermediateStart),
      () => {
        setViewportStart(targetViewport.start);
        setCurrentDate(today);
        setIsAnimating(false);
      }
    );
  }, [viewportStart, setCurrentDate, isAnimating, VIEWPORT_DAYS, timelineMode]);

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

  // Scroll to project functionality using service
  const scrollToProject = useCallback((project: any) => {
    if (isAnimating) return;
    
    const targetViewport = TimelineViewportService.calculateProjectScrollTarget({
      projectStartDate: new Date(project.startDate),
      currentViewportStart: viewportStart,
      timelineMode
    });
    
    // Check if animation should be skipped
    if (TimelineViewportService.shouldSkipAnimation(viewportStart.getTime(), targetViewport.start.getTime())) {
      setViewportStart(targetViewport.start);
      setCurrentDate(new Date(project.startDate));
      return;
    }
    
    const animationDuration = TimelineViewportService.calculateAnimationDuration(
      viewportStart.getTime(),
      targetViewport.start.getTime(),
      timelineMode
    );
    
    setIsAnimating(true);
    createSmoothAnimation(
      viewportStart.getTime(),
      targetViewport.start.getTime(),
      animationDuration,
      (intermediateStart) => setViewportStart(intermediateStart),
      () => {
        setViewportStart(targetViewport.start);
        setCurrentDate(new Date(project.startDate));
        setIsAnimating(false);
      }
    );
  }, [viewportStart, setCurrentDate, isAnimating, timelineMode]);

  // Auto-scroll is now handled by TimelineDragCoordinatorService

  // Simplified mouse handlers using services
  const handleMouseDown = useCallback((e: React.MouseEvent, projectId: string, action: string) => {
    e.preventDefault();
    e.stopPropagation();

    const targetProject = projects.find(p => p.id === projectId);
    if (!targetProject) return;

    const initialDragState: DragState = {
      projectId,
      action,
      startX: e.clientX,
      startY: e.clientY,
      originalStartDate: new Date(targetProject.startDate),
      originalEndDate: new Date(targetProject.endDate),
      lastDaysDelta: 0,
      mode: timelineMode
    };

    setDragState(initialDragState);

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState) return;

      const coordinationResult = TimelineDragCoordinatorService.coordinateDragOperation(
        dragState,
        e,
        {
          projects,
          viewportStart: actualViewportStart,
          viewportEnd,
          timelineMode,
          dates
        }
      );

      if (coordinationResult.shouldUpdate) {
        setDragState(coordinationResult.newDragState);

        // Handle auto-scroll
        if (coordinationResult.autoScrollConfig?.shouldScroll && coordinationResult.autoScrollConfig.direction) {
          // Auto-scroll logic would be handled here if needed
          // For now, the service coordinates but component handles viewport updates
        }
      }
    };

    const handleMouseUp = async () => {
      if (!dragState) return;

      // Calculate final dates
      const finalDates = {
        startDate: dragState.originalStartDate,
        endDate: dragState.originalEndDate
      };

      // Apply final delta
      const daysDelta = dragState.lastDaysDelta || 0;
      if (dragState.action === 'move') {
        finalDates.startDate = new Date(dragState.originalStartDate.getTime() + daysDelta * 24 * 60 * 60 * 1000);
        finalDates.endDate = new Date(dragState.originalEndDate.getTime() + daysDelta * 24 * 60 * 60 * 1000);
      } else if (dragState.action === 'resize-start-date') {
        finalDates.startDate = new Date(dragState.originalStartDate.getTime() + daysDelta * 24 * 60 * 60 * 1000);
      } else if (dragState.action === 'resize-end-date') {
        finalDates.endDate = new Date(dragState.originalEndDate.getTime() + daysDelta * 24 * 60 * 60 * 1000);
      }

      // Complete the drag operation
      await TimelineDragCoordinatorService.completeDragOperation(
        dragState,
        finalDates,
        {
          onProjectUpdate: updateProject,
          onMilestoneUpdate: updateMilestone,
          onSuccessToast: showProjectSuccessToast
        }
      );

      // Clean up
      setDragState(null);
      clearDragQueue();

      // Remove event listeners
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [projects, timelineMode, actualViewportStart, viewportEnd, dates, updateProject, updateMilestone, showProjectSuccessToast]);

  // Holiday drag handler (simplified version)
  const handleHolidayMouseDown = useCallback((e: React.MouseEvent, holidayId: string, action: string) => {
    e.preventDefault();
    e.stopPropagation();

    const targetHoliday = holidays.find(h => h.id === holidayId);
    if (!targetHoliday) return;

    const initialDragState: DragState = {
      holidayId,
      action,
      startX: e.clientX,
      startY: e.clientY,
      originalStartDate: new Date(targetHoliday.startDate),
      originalEndDate: new Date(targetHoliday.endDate),
      lastDaysDelta: 0,
      mode: timelineMode
    };

    setDragState(initialDragState);

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState) return;

      // Simple holiday drag logic (can be enhanced later if needed)
      const deltaX = e.clientX - dragState.startX;
      const dayWidth = timelineMode === 'weeks' ? 77 : 40;
      const daysDelta = Math.round(deltaX / dayWidth);

      if (daysDelta !== dragState.lastDaysDelta) {
        // Update holiday dates
        const newDates = {
          startDate: new Date(dragState.originalStartDate.getTime() + daysDelta * 24 * 60 * 60 * 1000),
          endDate: new Date(dragState.originalEndDate.getTime() + daysDelta * 24 * 60 * 60 * 1000)
        };

        updateHoliday(holidayId, newDates);
        (dragState as any).lastDaysDelta = daysDelta;
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [holidays, timelineMode, updateHoliday]);

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
  console.log('🎯 Available rows:', rows.map(r => ({ id: r.id, groupId: r.groupId, name: r.name })));
    const row = rows.find(r => r.id === rowId);
    if (!row) {
      console.error('❌ Row not found for rowId:', rowId);
      console.error('❌ Available row IDs:', rows.map(r => r.id));
      return;
    }

  console.log('✅ Found row:', row, 'groupId:', row.groupId);
  console.log('✅ Row object keys:', Object.keys(row));
  console.log('✅ Row groupId type:', typeof row.groupId, 'value:', JSON.stringify(row.groupId));

    // REMOVED: Competing overlap check - SmartHoverAddProjectBar already validated this is safe
    // SmartHoverAddProjectBar prevents creation in occupied spaces, so we trust its validation

  console.log('🚀 Opening project creation modal with rowId:', rowId, 'groupId:', row.groupId, 'dates:', { startDate, endDate });
  console.log('🚀 DETAILED: About to call setCreatingNewProject with startDate ISO:', startDate.toISOString(), 'endDate ISO:', endDate.toISOString());
    // Open the project creation modal with the selected dates and row
    setCreatingNewProject(row.groupId, { startDate, endDate }, rowId);
  }, [rows, setCreatingNewProject, projects]);

  // Handle milestone drag updates
  const handleMilestoneDrag = useCallback((milestoneId: string, newDate: Date) => {
    updateMilestone(milestoneId, { dueDate: newDate }, { silent: true });
  }, [updateMilestone]);

  // Handle milestone drag end
  const handleMilestoneDragEnd = useCallback(() => {
    showMilestoneSuccessToast("Milestone updated successfully");
  }, [showMilestoneSuccessToast]);

  return (
    <DndProvider backend={HTML5Backend}>
      <TooltipProvider>
        <AppPageLayout>
          {/* Timeline Header */}
          <AppPageLayout.Header className="h-20 border-b border-[#e2e2e2] flex items-center justify-between px-8">
            <TimelineHeader 
              currentDate={currentDate}
              viewportStart={viewportStart}
              viewportEnd={viewportEnd}
              onNavigate={handleNavigate}
              onGoToToday={handleGoToToday}
            />
          </AppPageLayout.Header>
          
          {/* Timeline Mode Toggle and Navigation */}
          <AppPageLayout.SubHeader>
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
          </AppPageLayout.SubHeader>
          
          {/* Main Content Area with Card */}
          <AppPageLayout.Content>
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
                      const position = calculateHolidayOverlayPosition(holiday, dates, mode);

                      if (!position) return null;

                      const { leftPx, widthPx } = position;

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
                        className="absolute top-3 -right-3 w-6 h-6 bg-white border border-border rounded-md flex items-center justify-center text-gray-500 hover:text-gray-600 hover:bg-gray-50 transition-colors duration-200 z-20"
                      >
                        <PanelLeft className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* Date Headers */}
                    <div className="flex-1 bg-white" style={{ 
                      minWidth: `${dates.length * (mode === 'weeks' ? 77 : 40)}px`
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
                          {groups.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                              <div className="text-gray-400 mb-4">
                                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                              </div>
                              <h3 className="text-lg font-medium text-gray-900 mb-2">Welcome to Timeline</h3>
                              <p className="text-sm text-gray-500 mb-4 max-w-xs">
                                Start by creating a group to organize your projects, then add rows within the group.
                              </p>
                              <div className="text-xs text-gray-400">
                                Click "Add group" below to get started
                              </div>
                            </div>
                          ) : (
                            groups.map((group, groupIndex) => (
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
                            ))
                          )}
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
                          
                          // Log warning for orphaned projects in development only
                          if (process.env.NODE_ENV === 'development' && orphanedProjects.length > 0) {
                            console.warn(`Found ${orphanedProjects.length} orphaned projects in group ${group.id}:`, orphanedProjects.map(p => ({ id: p.id, name: p.name, rowId: p.rowId })));
                          }
                          
                          // Check if group is collapsed
                          const isGroupCollapsed = collapsedGroups.has(group.id);
                          
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
                              
                              {/* Rows in this group - only render if group is not collapsed */}
                              {!isGroupCollapsed && groupRows.map((row: any) => {
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
                                              isDragging={!!dragState}
                                              dragState={dragState}
                                              handleMouseDown={handleMouseDown}
                                              mode={mode}
                                              isMultiProjectRow={true} // Add flag for multi-project rows
                                              collapsed={collapsed}
                                              onMilestoneDrag={handleMilestoneDrag}
                                              onMilestoneDragEnd={handleMilestoneDragEnd}
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
                                        isDragging={!!dragState}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                              
                              {/* Add Row spacer - only render if group is not collapsed */}
                              {!isGroupCollapsed && <div className="h-9 border-b border-gray-100" />}
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
                      isDragging={!!dragState}
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
                  isDragging={!!dragState}
                  stopAutoScroll={() => {}} // Auto-scroll handled by services
                />
              </Card>
              
              {/* Availability Display Mode Toggle */}
              <div className="mt-4 mb-4 flex justify-start">
                <ToggleGroup
                  type="single"
                  value={availabilityDisplayMode}
                  onValueChange={(value) => {
                    if (value) {
                      setAvailabilityDisplayMode(value as 'circles' | 'numbers');
                    }
                  }}
                  variant="outline"
                  className="border border-gray-200 rounded-lg h-9 p-1"
                >
                  <ToggleGroupItem value="circles" aria-label="Circles mode" className="px-2 py-1 h-7">
                    <Circle className="w-4 h-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="numbers" aria-label="Numbers mode" className="px-2 py-1 h-7">
                    <Hash className="w-4 h-4" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
              
              {/* Availability Timeline Card */}
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
                    {/* Holiday Overlay */}
                    {/* <HolidayOverlay dates={dates} type="availability" mode={mode} /> */}
                    
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
              
              {/* Timeline Scrollbar - Outside the cards, at bottom of viewport */}
              <div className="mt-4">
                <PerformanceStatus className="mt-2" />
              </div>
            </div>
          </AppPageLayout.Content>
        </AppPageLayout>
      </TooltipProvider>
    </DndProvider>
  );
}