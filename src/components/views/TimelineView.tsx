import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TooltipProvider } from '../ui/tooltip';
import { Card } from '../ui/card';
import { useProjectContext } from '../../contexts/ProjectContext';
import { useTimelineContext } from '../../contexts/TimelineContext';
import { usePlannerContext } from '../../contexts/PlannerContext';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { 
  TimelineViewportService, 
  expandHolidayDates, 
  normalizeToMidnight, 
  addDaysToDate,
  createSmoothDragAnimation,
  workingDayStats,
  milestoneStats,
  calculateTimelineRows,
  UnifiedDayEstimateService,
  type SmoothAnimationConfig,
  type DragState as ServiceDragState
} from '@/services';
import { RelationshipRules } from '@/domain/rules';
import { useTimelineData } from '../../hooks/useTimelineData';
import { useDynamicViewportDays } from '../../hooks/useDynamicViewportDays';
import { useHolidayDrag } from '../../hooks/useHolidayDrag';
import { useProjectResize } from '../../hooks/useProjectResize';
import { usePhaseResize } from '../../hooks/usePhaseResize';
import { TimelineDateHeader } from '@/components/features/timeline/TimelineDateHeader';
import { TimelineBackground } from '@/components/features/timeline/TimelineBackground';
import { TimelineCard } from '@/components/features/timeline/TimelineCard';
import { AvailabilityCard } from '../shared/AvailabilityCard';
import { HolidayBar } from '@/components/features/timeline/HolidayBar';
import { AppPageLayout } from '../layout/AppPageLayout';
import { TimelineToolbar } from '@/components/features/timeline/TimelineToolbar';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';
import type { DayEstimate, Project } from '@/types/core';
// Lazy load heavy modals
const ProjectModal = React.lazy(() => import('../modals/ProjectModal').then(module => ({ default: module.ProjectModal })));
const HolidayModal = React.lazy(() => import('../modals/HolidayModal').then(module => ({ default: module.HolidayModal })));
const HelpModal = React.lazy(() => import('../modals/HelpModal').then(module => ({ default: module.HelpModal })));

/**
 * TimelineView - Main coordinator component for the timeline page
 * 
 * **Role**: Coordinates contexts, custom hooks, and services to render the timeline UI
 * 
 * **Architecture Pattern**:
 * - Contexts: Provides data (projects, groups, holidays, settings)
 * - Custom Hooks: Manage React state + coordinate services (useHolidayDrag, useTimelineData)
 * - Services: Pure calculations (TimelineViewportService, calculateTimelineRows)
 * - Components: Presentational UI (TimelineToolbar, TimelineCard, TimelineBackground)
 * 
 * **Responsibilities**:
 * - Wire up context data to child components
 * - Manage viewport state (viewportStart, isAnimating)
 * - Coordinate holiday drag operations via custom hook
 * - Handle navigation and scrolling animations
 * - Render timeline layout with auto-layout algorithm
 * 
 * **Does NOT**:
 * - Implement business logic (delegated to services)
 * - Calculate dates manually (uses @/services/dateCalculations)
 * - Access database directly (uses context data)
 * 
 * @see TimelineViewportService - Viewport calculations and animations
 * @see useHolidayDrag - Holiday drag state management
 * @see calculateTimelineRows - Auto-row arrangement algorithm
 */
interface TimelineViewProps {
  mainSidebarCollapsed: boolean;
}

export function TimelineView({ mainSidebarCollapsed }: TimelineViewProps) {
  // Get data from specific contexts
  const { 
    projects, 
    groups, 
    rows, 
    selectedProjectId, 
    phases,
    updateProject, 
    setSelectedProjectId, 
    addProject, 
    updatePhase,
    setCreatingNewProject,
    creatingNewProject,
    showMilestoneSuccessToast,
    showProjectSuccessToast
  } = useProjectContext();
  const { 
    currentDate, 
    timelineMode,
    collapsedGroups,
    toggleGroupCollapse,
    setTimelineMode,
    setCurrentDate 
  } = useTimelineContext();
  const { 
    holidays,
    events,
    updateHoliday,
    creatingNewHoliday,
    setCreatingNewHoliday,
    editingHolidayId,
    setEditingHolidayId
  } = usePlannerContext();
  const { 
    settings 
  } = useSettingsContext();
  
  // Validate project relationships
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const validation = RelationshipRules.validateSystemIntegrity({
        projects,
        phases: [],
        clients: [],
        groups
      });
      
      if (!validation.isValid) {
        console.warn('⚠️ Timeline validation issues:', validation.errors);
      }
    }
  }, [projects, groups]);
  
  // Monitor working day cache performance
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const interval = setInterval(() => {
        workingDayStats.logStats();
        milestoneStats.logStats();
      }, 10000); // Log every 10 seconds in development
      return () => clearInterval(interval);
    }
  }, []);
  // Timeline state management
  const [viewportStart, setViewportStart] = useState(() => {
    // Safety check: ensure currentDate is valid
    if (!currentDate || isNaN(currentDate.getTime())) {
      console.warn('⚠️ TimelineView: currentDate is invalid, using current date');
      const fallbackDate = new Date();
      fallbackDate.setDate(1); // Start at beginning of month
      return normalizeToMidnight(fallbackDate); // Normalize time component
    }
    const start = new Date(currentDate);
    start.setDate(1); // Start at beginning of month
    return normalizeToMidnight(start); // Normalize time component
  });
  
  // Help modal state
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  
  // Protected viewport setter that respects scrollbar blocking using service
  const protectedSetViewportStart = useCallback((date: Date) => {
    // Safety check: ensure date is valid
    if (!date || isNaN(date.getTime())) {
      ErrorHandlingService.handle(`Invalid viewportStart date: ${date}`, { source: 'TimelineView' });
      return;
    }
    const blockingState = TimelineViewportService.checkViewportBlocking();
    if (blockingState.isBlocked) {
      return;
    }
    setViewportStart(date);
  }, []);
  // Timeline 2.0: Sidebar always collapsed
  const collapsed = true;
  const [isDragging, setIsDragging] = useState(false);
  const [dragState, setDragState] = useState<ServiceDragState | null>(null);
  const [isAnimating, setIsAnimating] = useState(false); // Shared state for scrolling animations
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
  const VIEWPORT_DAYS = useDynamicViewportDays(collapsed, mainSidebarCollapsed, timelineMode);
  
  // Scrollbar range - centered on today with 6 months buffer, auto-extends near edges
  const [scrollbarRange, setScrollbarRange] = useState<{ start: Date; end: Date }>(() => {
    const today = normalizeToMidnight(new Date());
    return {
      start: addDaysToDate(today, -182), // 6 months before
      end: addDaysToDate(today, 182)     // 6 months after
    };
  });
  
  // Auto-extend scrollbar range when approaching edges
  useEffect(() => {
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const THRESHOLD_DAYS = 90;
    
    const totalDays = Math.floor((scrollbarRange.end.getTime() - scrollbarRange.start.getTime()) / MS_PER_DAY);
    const viewportEnd = addDaysToDate(viewportStart, VIEWPORT_DAYS);
    const startOffset = Math.floor((viewportStart.getTime() - scrollbarRange.start.getTime()) / MS_PER_DAY);
    const endOffset = Math.floor((viewportEnd.getTime() - scrollbarRange.start.getTime()) / MS_PER_DAY);
    
    // Extend backward if approaching start
    if (startOffset < THRESHOLD_DAYS && startOffset >= 0) {
      setScrollbarRange(prev => ({
        ...prev,
        start: addDaysToDate(prev.start, -THRESHOLD_DAYS)
      }));
    } 
    // Extend forward if approaching end
    else if ((totalDays - endOffset) < THRESHOLD_DAYS && (totalDays - endOffset) >= 0) {
      setScrollbarRange(prev => ({
        ...prev,
        end: addDaysToDate(prev.end, THRESHOLD_DAYS)
      }));
    }
  }, [viewportStart, VIEWPORT_DAYS, scrollbarRange]);
  // Get timeline data using your existing hook
  const { dates, viewportEnd, filteredProjects, mode, actualViewportStart } = useTimelineData(
    projects, 
    viewportStart, 
    VIEWPORT_DAYS, 
    timelineMode, 
    collapsed,
    mainSidebarCollapsed
  );

  // ========== TIMELINE 2.0: AUTO-LAYOUT CALCULATION ==========
  // Calculate dynamic visual rows for each group using auto-layout algorithm
  const groupLayouts = useMemo(() => {
    return groups.map(group => {
      const groupProjects = filteredProjects.filter(p => p.groupId === group.id);
      
      if (groupProjects.length === 0) {
        // Empty group - return minimal layout
        return {
          groupId: group.id,
          groupName: group.name,
          visualRows: [],
          totalHeight: 52 // One empty row
        };
      }
      
      const layout = calculateTimelineRows({
        projects: groupProjects,
        groups: [group],
        dateRange: {
          start: viewportStart,
          end: viewportEnd
        },
        sortBy: 'startDate',
        minGapDays: 2
      });

      return layout.groups[0]; // Return the first (and only) group layout
    });
  }, [groups, filteredProjects, viewportStart, viewportEnd]);
  // ========== END AUTO-LAYOUT CALCULATION ==========

  // Expand holiday ranges into individual Date objects for fast lookup by the markers
  const holidayDates = useMemo(() => {
    const holidaysWithName = holidays.map(h => ({ ...h, name: h.title || 'Holiday' }));
    return expandHolidayDates(holidaysWithName);
  }, [holidays]);
  // Debug performance logging using service
  const performanceMetrics = useMemo(() => {
    return TimelineViewportService.calculateViewportPerformanceMetrics({
      projectCount: filteredProjects.length,
      viewportDays: dates.length,
      mode: timelineMode
    });
  }, [timelineMode, dates.length, filteredProjects.length]);
  // Memoize date range formatting using service
  // Navigation handlers moved to TimelineToolbar component

  // Timeline 2.0: No sidebar toggle - always collapsed

  // Scroll to project functionality using service
  const scrollToProject = useCallback((project: Project) => {
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
      targetViewport.start.getTime()
    );
    setIsAnimating(true);
    const animationConfig: SmoothAnimationConfig = {
      currentStart: viewportStart.getTime(),
      targetStart: targetViewport.start.getTime(),
      duration: animationDuration
    };
    createSmoothDragAnimation(
      animationConfig,
      (intermediateStart) => setViewportStart(intermediateStart),
      () => {
        setViewportStart(targetViewport.start);
        setCurrentDate(new Date(project.startDate));
        setIsAnimating(false);
      }
    );
  }, [viewportStart, setCurrentDate, isAnimating, timelineMode]);
  // Auto-scroll functions for drag operations using service
  const startAutoScroll = useCallback((direction: 'left' | 'right') => {
    if (autoScrollState.isScrolling && autoScrollState.direction === direction) return;
    // Clear any existing auto-scroll
    if (autoScrollState.intervalId) {
      clearInterval(autoScrollState.intervalId);
    }
    const config = TimelineViewportService.calculateAutoScrollConfig(timelineMode);
    config.direction = direction;
    const intervalId = setInterval(() => {
      setViewportStart(prevStart => {
        // Check if viewport updates are blocked
        const blockingState = TimelineViewportService.checkViewportBlocking();
        if (blockingState.isBlocked) {
          return prevStart;
        }
        const newStart = TimelineViewportService.calculateAutoScrollPosition({
          currentStart: prevStart,
          direction,
          scrollAmount: config.scrollAmount,
          timelineMode
        });
        setCurrentDate(new Date(newStart));
        return newStart;
      });
    }, config.intervalMs);
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
  // Horizontal scroll handler for touchpad/wheel events
  const handleHorizontalScroll = useCallback((e: WheelEvent) => {
    // This handler is only called for horizontal scrolls, so no need to check again
    if (!isDragging && !isAnimating) {
      // Calculate scroll direction and amount
      const scrollDirection = e.deltaX > 0 ? 'next' : 'prev';
      const scrollIntensity = Math.abs(e.deltaX);
      // Much more sensitive thresholds for smoother scrolling
      if (scrollIntensity > 5) { // Lower threshold for better responsiveness
        // More granular scrolling calculation
        let daysToScroll: number;
        if (scrollIntensity <= 20) {
          // Small gesture = 1 day/column
          daysToScroll = 1;
        } else if (scrollIntensity <= 50) {
          // Medium gesture = 2-3 days
          daysToScroll = Math.floor(scrollIntensity / 20);
        } else {
          // Large gesture = 3-7 days max
          daysToScroll = Math.min(7, Math.floor(scrollIntensity / 15));
        }
        // Create smooth navigation
        const currentStart = viewportStart.getTime();
        const targetStartDate = addDaysToDate(viewportStart, (scrollDirection === 'next' ? daysToScroll : -daysToScroll));
        // Faster, more responsive animation
        setIsAnimating(true);
        const animationDuration = Math.min(150, daysToScroll * 25); // Even faster for better responsiveness
        const animationConfig = {
          currentStart,
          targetStart: targetStartDate.getTime(),
          duration: animationDuration
        };
        createSmoothDragAnimation(
          animationConfig,
          (intermediateStart) => setViewportStart(intermediateStart),
          () => {
            setViewportStart(new Date(animationConfig.targetStart));
            setCurrentDate(new Date(animationConfig.targetStart));
            setIsAnimating(false);
          }
        );
      }
    }
  }, [viewportStart, setViewportStart, setCurrentDate, isDragging, isAnimating, setIsAnimating]);
  // Add wheel event listener to timeline content area and availability card
  React.useEffect(() => {
    const timelineContent = document.querySelector('.timeline-content-area');
    const availabilityContent = document.querySelector('.availability-timeline-content');
    // Enhanced wheel handler that prevents browser navigation
    const enhancedWheelHandler = (e: WheelEvent) => {
      const isHorizontalScroll = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (isHorizontalScroll) {
        // ALWAYS prevent browser navigation for any horizontal scroll
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        // Call our custom scroll handler
        handleHorizontalScroll(e);
        return false;
      }
    };
    if (timelineContent) {
      timelineContent.addEventListener('wheel', enhancedWheelHandler, { 
        passive: false,
        capture: true  // Capture early to prevent browser navigation
      });
    }
    if (availabilityContent) {
      availabilityContent.addEventListener('wheel', enhancedWheelHandler, { 
        passive: false,
        capture: true  // Capture early to prevent browser navigation
      });
    }
    return () => {
      if (timelineContent) {
        timelineContent.removeEventListener('wheel', enhancedWheelHandler, { capture: true });
      }
      if (availabilityContent) {
        availabilityContent.removeEventListener('wheel', enhancedWheelHandler, { capture: true });
      }
    };
  }, [handleHorizontalScroll]);
  const checkAutoScroll = useCallback((clientX: number) => {
    if (!isDragging) return;
    // Get the timeline content area bounds
    const timelineContent = document.querySelector('.timeline-content-area');
    if (!timelineContent) return;
    const rect = timelineContent.getBoundingClientRect();
    const trigger = TimelineViewportService.calculateAutoScrollTrigger({
      mouseX: clientX,
      timelineContentRect: rect
    });
    if (trigger.shouldScroll && trigger.direction) {
      startAutoScroll(trigger.direction);
    } else {
      stopAutoScroll();
    }
  }, [isDragging, startAutoScroll, stopAutoScroll]);
  
  // Holiday drag handler extracted to custom hook
  const { handleHolidayMouseDown } = useHolidayDrag({
    holidays,
    projects,
    dates,
    viewportStart,
    viewportEnd,
    timelineMode,
    updateHoliday,
    checkAutoScroll,
    stopAutoScroll,
    setIsDragging,
    setDragState,
    dragState
  });
  
  // Calculate day estimates for all projects (for resize validation)
  // Include dragState to recalculate during phase resize
  const allDayEstimates = React.useMemo(() => {
    const estimates: DayEstimate[] = [];
    projects.forEach(project => {
      let projectPhases = phases.filter(p => p.projectId === project.id);
      
      // If a phase is being dragged for this project, apply visual dates
      const activePhaseId = dragState?.phaseId ?? dragState?.milestoneId;
      if (isDragging && dragState?.projectId === project.id && activePhaseId &&
          (dragState?.action === 'resize-phase-start' || dragState?.action === 'resize-phase-end')) {
        projectPhases = projectPhases.map(p => {
          if (p.id === activePhaseId) {
            // Apply visual date changes during drag
            const daysDelta = dragState.lastDaysDelta || 0;
            const msOffset = daysDelta * 24 * 60 * 60 * 1000;
            
            if (dragState.action === 'resize-phase-start' && p.startDate) {
              return {
                ...p,
                startDate: new Date(new Date(p.startDate).getTime() + msOffset)
              };
            } else if (dragState.action === 'resize-phase-end' && p.endDate) {
              return {
                ...p,
                endDate: new Date(new Date(p.endDate).getTime() + msOffset),
                dueDate: new Date(new Date(p.endDate).getTime() + msOffset)
              };
            }
          }
          return p;
        });
      }
      
      const projectEstimates = UnifiedDayEstimateService.calculateProjectDayEstimates(
        project,
        projectPhases,
        settings,
        holidays,
        events
      );
      estimates.push(...projectEstimates);
    });
    return estimates;
  }, [projects, phases, settings, holidays, events, isDragging, dragState]);
  
  // Project resize handler extracted to custom hook
  const { handleProjectResizeMouseDown } = useProjectResize({
    projects,
    dates,
    viewportStart,
    viewportEnd,
    timelineMode,
    dayEstimates: allDayEstimates,
    updateProject,
    checkAutoScroll,
    stopAutoScroll,
    setIsDragging,
    setDragState,
    dragState
  });

  // Phase boundary resize handler
  const { handlePhaseResizeMouseDown } = usePhaseResize({
    projects,
    phases,
    dates,
    viewportStart,
    viewportEnd,
    timelineMode,
    updatePhase,
    checkAutoScroll,
    stopAutoScroll,
    setIsDragging,
    setDragState,
    dragState
  });
  
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
  // Handle external currentDate changes (e.g., from planner navigation)
  React.useEffect(() => {
    // Check if currentDate is outside current viewport
    const currentStart = viewportStart;
    const currentEnd = addDaysToDate(currentStart, VIEWPORT_DAYS - 1);
    // If currentDate is outside viewport, navigate to include it
    if (currentDate < currentStart || currentDate > currentEnd) {
      // Center the viewport around the currentDate
      let newViewportStart = new Date(currentDate);
      if (timelineMode === 'weeks') {
        // In weeks mode, align to week boundary  
        const dayOfWeek = newViewportStart.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday = 1
        newViewportStart = addDaysToDate(newViewportStart, mondayOffset);
      } else {
        // In days mode, go back by half viewport to center the date
        newViewportStart = addDaysToDate(newViewportStart, -Math.floor(VIEWPORT_DAYS / 2));
      }
      newViewportStart = normalizeToMidnight(newViewportStart);
      setViewportStart(newViewportStart);
    }
  }, [currentDate, viewportStart, VIEWPORT_DAYS, timelineMode]);
  
  // Handle milestone drag updates
  const handlePhaseDrag = useCallback((phaseId: string, newDate: Date) => {
    updatePhase(phaseId, { dueDate: newDate }, { silent: true });
  }, [updatePhase]);
  // Handle milestone drag end
  const handlePhaseDragEnd = useCallback(() => {
    showMilestoneSuccessToast("Phase updated successfully");
  }, [showMilestoneSuccessToast]);
  // Legacy prop naming compatibility
  const handleMilestoneDrag = handlePhaseDrag;
  const handleMilestoneDragEnd = handlePhaseDragEnd;
  return (
    <DndProvider backend={HTML5Backend}>
      <TooltipProvider>
        <AppPageLayout>
          {/* Timeline Header - now handled by AppHeader in MainAppLayout */}
          <AppPageLayout.Header className="h-0 overflow-hidden">
            <div />
          </AppPageLayout.Header>
          {/* Timeline Toolbar - extracted to separate component */}
          <TimelineToolbar
            timelineMode={timelineMode}
            currentDate={currentDate}
            viewportStart={viewportStart}
            actualViewportStart={actualViewportStart}
            viewportEnd={viewportEnd}
            viewportDays={VIEWPORT_DAYS}
            collapsed={collapsed}
            mainSidebarCollapsed={mainSidebarCollapsed}
            isAnimating={isAnimating}
            groups={groups}
            onTimelineModeChange={setTimelineMode}
            onCurrentDateChange={setCurrentDate}
            onViewportStartChange={setViewportStart}
            onAnimatingChange={setIsAnimating}
            onCreateNewProject={setCreatingNewProject}
            onHelpClick={() => setHelpModalOpen(true)}
          />
          {/* Main Content Area with Card */}
          <AppPageLayout.Content className="px-6 pb-6">
            <div className="flex flex-col min-h-0 flex-1">
              {/* Timeline Card - expands to fill remaining space */}
              <Card className="flex-1 flex flex-col overflow-hidden relative timeline-card-container min-h-0">
                {/* Column Markers removed from here - will be added per-row */}
                <div className="flex flex-col min-h-full bg-white relative">
                  {/* Fixed Headers Row */}
                  <div className="flex border-b border-gray-200 bg-white relative z-10">
                    {/* Date Headers - full width, no sidebar */}
                    <div className="flex-1 bg-white" style={{ 
                      minWidth: mode === 'weeks' 
                        ? `${dates.length * 153}px` // 153px per week column (7 days × 21px + 6 gaps × 1px)
                        : `${dates.length * 52 + 52}px` // 52px per day + 52px buffer
                    }}>
                      <TimelineDateHeader dates={dates} mode={mode} />
                    </div>
                  </div>
                  {/* Scrollable Content Area */}
                  <div className="flex-1 overflow-x-auto overflow-y-auto light-scrollbar-vertical-only relative">
                    {/* Timeline Content - full width, no sidebar */}
                    <div className="bg-gray-50 timeline-content-area relative" style={{ 
                      width: '100%',
                      minHeight: '100%'
                    }}>
                      {/* Column overlays - weekends, holidays, and markers spanning entire content height */}
                      <div 
                        className="absolute top-0 left-0 bottom-0 pointer-events-none" 
                        style={{ 
                          width: mode === 'weeks' 
                            ? `${dates.length * 153}px` // 153px per week column (matches headers and components)
                            : `${dates.length * 52 + 52}px`,
                          zIndex: 1
                        }}
                      >
                        {/* All timeline overlays: borders, today, weekends, holidays */}
                        <TimelineBackground dates={dates} mode={mode} holidays={holidays} />
                      </div>
                    
                      {/* Scrollable Content Layer */}
                      <div className="relative">
                        {/* Project Timeline Grid - Organized by Groups and VISUAL ROWS (Auto-Layout) */}
                        <TimelineCard
                          groups={groups}
                          groupLayouts={groupLayouts}
                          collapsedGroups={collapsedGroups}
                          dates={dates}
                          viewportStart={viewportStart}
                          viewportEnd={viewportEnd}
                          isDragging={isDragging}
                          dragState={dragState}
                          handleMilestoneDrag={handleMilestoneDrag}
                          handleMilestoneDragEnd={handleMilestoneDragEnd}
                          handleProjectResizeMouseDown={handleProjectResizeMouseDown}
                          handlePhaseResizeMouseDown={handlePhaseResizeMouseDown}
                          mode={mode}
                          collapsed={collapsed}
                          onToggleGroupCollapse={toggleGroupCollapse}
                        />
                      </div> {/* End of Scrollable Content Layer */}
                    </div> {/* End of Timeline Content */}
                  </div> {/* End of Scrollable Content Area */}
                  {/* Bottom fade/shadow to soften cut-off at scroll edge (stays fixed to container bottom) */}
                  <div
                    className="pointer-events-none absolute left-0 right-0 bottom-0"
                    style={{
                      height: '6px',
                      zIndex: 45,
                      background: 'linear-gradient(to top, rgba(64,64,64,0.06) 0%, rgba(64,64,64,0.03) 25%, rgba(64,64,64,0.01) 70%, rgba(64,64,64,0) 100%)'
                    }}
                  />
                </div>
              </Card>
              
              {/* Availability Timeline Card */}
              <div className="relative flex-shrink-0 mt-[21px]">
                <AvailabilityCard
                  collapsed={collapsed}
                  dates={dates}
                  projects={projects}
                  settings={settings}
                  mode={mode}
                  phases={phases}
                  context="timeline"
                  columnMarkersOverlay={
                    /* All timeline overlays: borders, today, weekends, holidays */
                    <TimelineBackground dates={dates} mode={mode} holidays={holidays} />
                  }
                />
              </div>
              
              {/* Holiday Card */}
              <Card className="mt-[21px] overflow-hidden shadow-sm border border-gray-200 relative flex-shrink-0">
                <div className="bg-yellow-200">
                  <HolidayBar 
                    dates={dates} 
                    collapsed={collapsed} 
                    isDragging={isDragging}
                    dragState={dragState}
                    handleHolidayMouseDown={handleHolidayMouseDown}
                    mode={timelineMode}
                  />
                </div>
              </Card>
              {/* Unified Timeline Scrollbar */}
              {(() => {
                const { start, end } = scrollbarRange;
                const totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                const offset = Math.floor((viewportStart.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                const thumbPosition = (offset / totalDays) * 100;
                const thumbWidth = (VIEWPORT_DAYS / totalDays) * 100;
                
                return (
                  <div className="w-full mt-[21px] mb-0 px-0">
                    <div className="w-full h-2 bg-gray-150 relative overflow-hidden" style={{ backgroundColor: '#e8e8e8' }}>
                      <div 
                        className="absolute top-0 h-full cursor-grab active:cursor-grabbing transition-colors rounded-sm hover:bg-gray-600"
                        style={{
                          left: `${Math.max(0, Math.min(100 - thumbWidth, thumbPosition))}%`,
                          width: `${thumbWidth}%`,
                          minWidth: '40px',
                          backgroundColor: '#9a9a9a'
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const scrollbarEl = e.currentTarget.parentElement;
                          if (!scrollbarEl) return;
                          
                          const startX = e.clientX;
                          const startPos = thumbPosition;
                          
                          const handleMouseMove = (moveEvent: MouseEvent) => {
                            moveEvent.preventDefault();
                            const deltaX = moveEvent.clientX - startX;
                            const percentMoved = (deltaX / scrollbarEl.clientWidth) * 100;
                            const newPos = Math.max(0, Math.min(100 - thumbWidth, startPos + percentMoved));
                            const newDayOffset = Math.round((newPos / 100) * totalDays);
                            const newStart = addDaysToDate(start, newDayOffset);
                            
                            protectedSetViewportStart(newStart);
                            setCurrentDate(newStart);
                          };
                          
                          const handleMouseUp = () => {
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUp);
                          };
                          
                          document.addEventListener('mousemove', handleMouseMove);
                          document.addEventListener('mouseup', handleMouseUp);
                        }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
          </AppPageLayout.Content>
        </AppPageLayout>
        <React.Suspense fallback={<div>Loading...</div>}>
          <ProjectModal
            isOpen={!!creatingNewProject}
            onClose={() => setCreatingNewProject(null)}
            groupId={creatingNewProject?.groupId || null}
            rowId={creatingNewProject?.rowId}
          />
          <ProjectModal
            isOpen={!!selectedProjectId}
            onClose={() => setSelectedProjectId(null)}
            projectId={selectedProjectId || undefined}
          />
          <HolidayModal
            isOpen={!!creatingNewHoliday}
            onClose={() => setCreatingNewHoliday(null)}
            defaultStartDate={creatingNewHoliday?.startDate}
            defaultEndDate={creatingNewHoliday?.endDate}
          />
          <HolidayModal
            isOpen={!!editingHolidayId}
            onClose={() => setEditingHolidayId(null)}
            holidayId={editingHolidayId || undefined}
          />
          <HelpModal
            open={helpModalOpen}
            onOpenChange={setHelpModalOpen}
            initialTopicId="timeline"
          />
        </React.Suspense>
      </TooltipProvider>
    </DndProvider>
  );
}