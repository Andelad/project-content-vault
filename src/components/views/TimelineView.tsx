import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TooltipProvider } from '../ui/tooltip';
import { Card } from '../ui/card';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { Input } from '../ui/input';
import { ChevronLeft, ChevronRight, MapPin, CalendarSearch, Folders, Hash, Circle, PanelLeft } from 'lucide-react';
import { toast } from '../../hooks/use-toast';
import { useProjectContext } from '../../contexts/ProjectContext';
import { useTimelineContext } from '../../contexts/TimelineContext';
import { usePlannerContext } from '../../contexts/PlannerContext';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { TimelineViewportService, expandHolidayDates, ProjectValidationService } from '@/services';
import { useTimelineData } from '../../hooks/useTimelineData';
import { useDynamicViewportDays } from '../../hooks/useDynamicViewportDays';
import { 
  calculateDaysDelta, 
  createSmoothDragAnimation, 
  debounceDragUpdate, 
  throttleDragUpdate,
  type SmoothAnimationConfig 
} from '@/services';
import { TIMELINE_CONSTANTS } from '@/constants';
import { PerformanceMetrics, throttledDragUpdate, clearDragQueue, throttledVisualUpdate } from '@/services';
import { checkProjectOverlap, adjustProjectDatesForDrag } from '@/services';
import { workingDayStats, milestoneStats } from '@/services';
// Import timeline components
import { TimelineHeader } from '../timeline/TimelineHeader';
import { TimelineSidebar } from '../timeline/TimelineSidebar';
import { AvailabilitySidebar } from '../timeline/AvailabilitySidebar';
import { TimelineDateHeaders } from '../timeline/TimelineDateHeaders';
import { TimelineBar } from '../timeline/TimelineBar';
import { TimelineColumnMarkers } from '../timeline/TimelineColumnMarkers';
import { UnifiedAvailabilityCircles } from '../timeline/UnifiedAvailabilityCircles';
import { TimelineScrollbar } from '../timeline/TimelineScrollbar';
import { HoverableTimelineScrollbar } from '../timeline/HoverableTimelineScrollbar';
import { TimelineAddProjectRow, AddHolidayRow } from '../timeline/AddProjectRow';
import { SmartHoverAddProjectBar } from '@/components';
import { PerformanceStatus } from '../debug/PerformanceStatus';
import { DraggableRowComponent } from '../timeline/DraggableRowComponent';
import { AddRowComponent } from '../timeline/AddRowComponent';
import { DraggableGroupRow } from '../timeline/DraggableGroupRow';
import { AddGroupRow } from '../timeline/AddGroupRow';
import { AppPageLayout } from '../layout/AppPageLayout';
// Modal imports - Lazy load heavy modals
const ProjectModal = React.lazy(() => import('../modals/ProjectModal').then(module => ({ default: module.ProjectModal })));
const HolidayModal = React.lazy(() => import('../modals/HolidayModal').then(module => ({ default: module.HolidayModal })));
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
    creatingNewProject,
    showMilestoneSuccessToast,
    showProjectSuccessToast
  } = useProjectContext();
  const { 
    currentDate, 
    timelineMode,
    collapsedGroups,
    mainSidebarCollapsed,
    setTimelineMode,
    setCurrentDate 
  } = useTimelineContext();
  const { 
    holidays,
    updateHoliday,
    creatingNewHoliday,
    setCreatingNewHoliday,
    editingHolidayId,
    setEditingHolidayId
  } = usePlannerContext();
  const { 
    settings 
  } = useSettingsContext();
  // Validate and auto-fix project relationships using the validation service
  React.useEffect(() => {
    ProjectValidationService.validateAndAutoFix(
      projects,
      groups,
      rows,
      updateProject,
      { logResults: true }
    );
  }, [projects, groups, rows, updateProject]);
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
      fallbackDate.setHours(0, 0, 0, 0); // Normalize time component
      return fallbackDate;
    }
    const start = new Date(currentDate);
    start.setDate(1); // Start at beginning of month
    start.setHours(0, 0, 0, 0); // Normalize time component
    return start;
  });
  // Protected viewport setter that respects scrollbar blocking using service
  const protectedSetViewportStart = useCallback((date: Date) => {
    // Safety check: ensure date is valid
    if (!date || isNaN(date.getTime())) {
      console.error('⚠️ Attempted to set invalid viewportStart:', date);
      return;
    }
    const blockingState = TimelineViewportService.checkViewportBlocking();
    if (blockingState.isBlocked) {
      return;
    }
    setViewportStart(date);
  }, []);
  const [collapsed, setCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragState, setDragState] = useState<any>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [availabilityDisplayMode, setAvailabilityDisplayMode] = useState<'circles' | 'numbers'>('circles');
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
  // Get timeline data using your existing hook
  const { dates, viewportEnd, filteredProjects, mode, actualViewportStart } = useTimelineData(
    projects, 
    viewportStart, 
    VIEWPORT_DAYS, 
    timelineMode, 
    collapsed,
    mainSidebarCollapsed
  );
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
        setViewportStart(new Date(animationConfig.targetStart));
        setCurrentDate(new Date(animationConfig.targetStart));
        setIsAnimating(false);
      }
    );
  }, [viewportStart, setCurrentDate, isAnimating, VIEWPORT_DAYS, timelineMode]);
  const handleGoToToday = useCallback(() => {
    if (isAnimating) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetViewport = TimelineViewportService.calculateTodayTarget({
      currentDate: today,
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
    const animationConfig: SmoothAnimationConfig = {
      currentStart,
      targetStart,
      duration: animationDuration
    };
    createSmoothDragAnimation(
      animationConfig,
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
        const targetStart = new Date(viewportStart);
        targetStart.setDate(targetStart.getDate() + (scrollDirection === 'next' ? daysToScroll : -daysToScroll));
        // Faster, more responsive animation
        setIsAnimating(true);
        const animationDuration = Math.min(150, daysToScroll * 25); // Even faster for better responsiveness
        const animationConfig = {
          currentStart,
          targetStart: targetStart.getTime(),
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
    const currentEnd = new Date(currentStart);
    currentEnd.setDate(currentStart.getDate() + VIEWPORT_DAYS - 1);
    // If currentDate is outside viewport, navigate to include it
    if (currentDate < currentStart || currentDate > currentEnd) {
      // Center the viewport around the currentDate
      const newViewportStart = new Date(currentDate);
      if (timelineMode === 'weeks') {
        // In weeks mode, align to week boundary  
        const dayOfWeek = newViewportStart.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday = 1
        newViewportStart.setDate(newViewportStart.getDate() + mondayOffset);
      } else {
        // In days mode, go back by half viewport to center the date
        newViewportStart.setDate(newViewportStart.getDate() - Math.floor(VIEWPORT_DAYS / 2));
      }
      newViewportStart.setHours(0, 0, 0, 0);
      setViewportStart(newViewportStart);
    }
  }, [currentDate, viewportStart, VIEWPORT_DAYS, timelineMode]);
  // Mouse handlers for timeline bar interactions
  const handleMouseDown = useCallback((e: React.MouseEvent, projectId: string, action: string) => {
    // 🚫 PREVENT BROWSER DRAG-AND-DROP: Stop the globe/drag indicator
    e.preventDefault();
    e.stopPropagation();
    const targetProject = projects.find(p => p.id === projectId);
    if (!targetProject) return;
    const initialDragState = {
      projectId,
      action,
      startX: e.clientX,
      lastMouseX: e.clientX,
      startY: e.clientY,
      originalStartDate: new Date(targetProject.startDate),
      originalEndDate: new Date(targetProject.endDate),
      lastDaysDelta: 0,
      pixelDeltaX: 0,
      lastSnappedDelta: 0,
      lastVisualUpdate: 0 // Track last visual update time for throttling
    };
    setIsDragging(true);
    setDragState(initialDragState);
  const handleMouseMove = (e: MouseEvent) => {
      try {
        // 🚫 PREVENT BROWSER DRAG BEHAVIOR: Stop any default drag actions
        e.preventDefault();
        // DEBUG: Confirm drag handler is being called
        if (Math.abs(e.clientX - initialDragState.lastMouseX) > 1) {
          // Drag handler called - processing movement
        }
        // Calculate incremental delta from last mouse position (prevents overshoot)
        const incrementalDeltaX = e.clientX - initialDragState.lastMouseX;
        const totalDeltaX = e.clientX - initialDragState.startX;
        const dayWidth = timelineMode === 'weeks' ? 11 : 40;
        // Always accumulate smooth movement for responsive pen/mouse following
        const currentPixelDeltaX = (initialDragState.pixelDeltaX || 0) + incrementalDeltaX;
        const smoothVisualDelta = currentPixelDeltaX / dayWidth;
        // For visual display: snap to day boundaries in days view, smooth in weeks view
        let visualDelta;
        if (timelineMode === 'weeks') {
          visualDelta = smoothVisualDelta;  // Smooth movement in weeks
        } else {
          // In days view: snap to nearest day boundary but prevent jumping
          const snappedDelta = Math.round(smoothVisualDelta);
          // Only update the snapped position if we've moved enough to cross a boundary
          const currentSnapped = initialDragState.lastSnappedDelta || 0;
          const minMovement = 0.3; // Require 30% of day width movement to snap
          if (Math.abs(snappedDelta - currentSnapped) >= 1 && Math.abs(smoothVisualDelta - currentSnapped) > minMovement) {
            visualDelta = snappedDelta;
            initialDragState.lastSnappedDelta = snappedDelta;
          } else {
            visualDelta = currentSnapped; // Stay at current snapped position until boundary crossed
          }
        }
        // Calculate rounded delta for database updates only
        const daysDelta = calculateDaysDelta(e.clientX, initialDragState.startX, dates, true, timelineMode);
        // DEBUG: Always log drag events to see if handler is being called
        // Drag move event processed
        // Update last mouse position for next incremental calculation
        initialDragState.lastMouseX = e.clientX;
        // Check for auto-scroll during drag
        checkAutoScroll(e.clientX);
        // Use service for throttled visual updates to improve performance
        throttledVisualUpdate(() => {
          setDragState(prev => ({ 
            ...prev, 
            daysDelta: visualDelta,  // Use calculated visual delta
            pixelDeltaX: currentPixelDeltaX  // Accumulate smooth movement
          }));
        }, timelineMode);
        // BACKGROUND persistence (throttled database updates)
        if (daysDelta !== initialDragState.lastDaysDelta) {
          // Use mode-specific throttling for better performance
          const throttleMs = timelineMode === 'weeks' ? 100 : 50; // Longer throttle for weeks mode
                  throttledDragUpdate(async () => {
                    if (action === 'resize-start-date') {
                      const newStartDate = new Date(initialDragState.originalStartDate);
                      newStartDate.setDate(newStartDate.getDate() + daysDelta);
                      const endDate = new Date(initialDragState.originalEndDate);
                      const oneDayBefore = new Date(endDate);
                      oneDayBefore.setDate(endDate.getDate() - 1);
                      // Simple validation - ensure start date is before end date
                      if (newStartDate <= oneDayBefore) {
                        updateProject(projectId, { startDate: newStartDate }, { silent: true });
                      }
                    } else if (action === 'resize-end-date') {
                      const newEndDate = new Date(initialDragState.originalEndDate);
                      newEndDate.setDate(newEndDate.getDate() + daysDelta);
                      const startDate = new Date(initialDragState.originalStartDate);
                      const oneDayAfter = new Date(startDate);
                      oneDayAfter.setDate(startDate.getDate() + 1);
                      // Simple validation - ensure end date is after start date
                      if (newEndDate >= oneDayAfter) {
                        updateProject(projectId, { endDate: newEndDate }, { silent: true });
                      }
                    } else if (action === 'move') {
                      const newStartDate = new Date(initialDragState.originalStartDate);
                      const newEndDate = new Date(initialDragState.originalEndDate);
                      newStartDate.setDate(newStartDate.getDate() + daysDelta);
                      newEndDate.setDate(newEndDate.getDate() + daysDelta);
                      // Update project and all milestones in parallel
                      const projectUpdate = updateProject(projectId, { 
                        startDate: newStartDate,
                        endDate: newEndDate 
                      }, { silent: true });
                      const projectMilestones = milestones.filter(m => m.projectId === projectId);
                      const milestoneUpdates = projectMilestones.map(milestone => {
                        const originalMilestoneDate = new Date(milestone.dueDate);
                        const newMilestoneDate = new Date(originalMilestoneDate);
                        newMilestoneDate.setDate(originalMilestoneDate.getDate() + daysDelta);
                        return updateMilestone(milestone.id, { 
                          dueDate: new Date(newMilestoneDate.toISOString().split('T')[0] + 'T00:00:00+00:00')
                        }, { silent: true });
                      });
                      Promise.all([projectUpdate, ...milestoneUpdates]);
                    }
                  }, throttleMs);
                  initialDragState.lastDaysDelta = daysDelta;
                }
              } catch (error) {
                console.error('🚨 PROJECT DRAG ERROR:', error);
              }
            };
    const handleMouseUp = () => {
      const hadMovement = dragState && dragState.lastDaysDelta !== 0;
      setIsDragging(false);
      setDragState(null);
      stopAutoScroll(); // Fix infinite scrolling
      // Clear any pending drag updates for better performance
      clearDragQueue();
      // Only show success toast if there was actual movement/change
      if (hadMovement) {
        showProjectSuccessToast("Project updated successfully");
      }
      // Remove ALL possible event listeners for robust pen/tablet support
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('pointermove', handleMouseMove);
      document.removeEventListener('pointerup', handleMouseUp);
      document.removeEventListener('pointercancel', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleMouseUp);
      document.removeEventListener('touchcancel', handleMouseUp);
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        // Create a more complete mouse event for touch with both coordinates
        const mouseEvent = {
          clientX: touch.clientX,
          clientY: touch.clientY,
          preventDefault: () => e.preventDefault(),
          stopPropagation: () => e.stopPropagation()
        } as MouseEvent;
        handleMouseMove(mouseEvent);
      }
    };
    // Add comprehensive event listeners for all input types (mouse, pen, touch)
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('pointermove', handleMouseMove);
    document.addEventListener('pointerup', handleMouseUp);
    document.addEventListener('pointercancel', handleMouseUp); // Critical for pen input
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleMouseUp);
    document.addEventListener('touchcancel', handleMouseUp);
  }, [projects, dates, updateProject, checkAutoScroll, stopAutoScroll, timelineMode, milestones, updateMilestone, showProjectSuccessToast]);
  // COMPLETELY REWRITTEN HOLIDAY DRAG HANDLER - SIMPLE AND FAST
  const handleHolidayMouseDown = useCallback((e: React.MouseEvent, holidayId: string, action: string) => {
    e.preventDefault();
    e.stopPropagation();
    const targetHoliday = holidays.find(h => h.id === holidayId);
    if (!targetHoliday) return;
    const startX = e.clientX;
    const dayWidth = timelineMode === 'weeks' ? 77 : 40;
    const originalStartDate = new Date(targetHoliday.startDate);
    const originalEndDate = new Date(targetHoliday.endDate);
    setIsDragging(true);
    const handleMouseMove = (e: MouseEvent) => {
      // 🚫 PREVENT BROWSER DRAG BEHAVIOR: Stop any default drag actions
      e.preventDefault();
      // Calculate exact visual delta (no rounding for smooth mouse following)
      const totalDeltaX = e.clientX - startX;
      // In weeks view: smooth movement, in days view: snap to day boundaries
      const exactVisualDelta = timelineMode === 'weeks' 
        ? totalDeltaX / dayWidth  // Smooth movement in weeks
        : Math.round(totalDeltaX / dayWidth);  // Snap to days in days view
      // Calculate rounded delta for database updates only
      const daysDelta = Math.round(exactVisualDelta);
      // Holiday drag operation processed
      try {
        if (action === 'resize-start-date') {
          const newStartDate = new Date(originalStartDate);
          newStartDate.setDate(originalStartDate.getDate() + daysDelta);
          // Allow start date to equal end date (single day holiday)
          if (newStartDate <= originalEndDate) {
            updateHoliday(holidayId, { startDate: newStartDate }, { silent: true });
          } else {
            // Start date update blocked - would make holiday invalid
          }
        } else if (action === 'resize-end-date') {
          const newEndDate = new Date(originalEndDate);
          newEndDate.setDate(originalEndDate.getDate() + daysDelta);
          // Allow end date to equal start date (single day holiday)
          if (newEndDate >= originalStartDate) {
            updateHoliday(holidayId, { endDate: newEndDate }, { silent: true });
          } else {
            // End date update blocked - would make holiday invalid
          }
        } else if (action === 'move') {
          const newStartDate = new Date(originalStartDate);
          const newEndDate = new Date(originalEndDate);
          newStartDate.setDate(originalStartDate.getDate() + daysDelta);
          newEndDate.setDate(originalEndDate.getDate() + daysDelta);
          updateHoliday(holidayId, { 
            startDate: newStartDate,
            endDate: newEndDate 
          }, { silent: true });
        }
      } catch (error) {
        console.error('🚨 HOLIDAY UPDATE ERROR:', error);
      }
      checkAutoScroll(e.clientX);
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      setDragState(null);
      stopAutoScroll();
      // Show success toast when holiday drag operation completes
      toast({
        title: "Success",
        description: "Holiday updated successfully",
      });
      // Remove ALL possible event listeners for robust pen/tablet support
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('pointermove', handleMouseMove);
      document.removeEventListener('pointerup', handleMouseUp);
      document.removeEventListener('pointercancel', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleMouseUp);
      document.removeEventListener('touchcancel', handleMouseUp);
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        handleMouseMove({ clientX: touch.clientX } as MouseEvent);
      }
    };
    // Add comprehensive event listeners for all input types (mouse, pen, touch)
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('pointermove', handleMouseMove);
    document.addEventListener('pointerup', handleMouseUp);
    document.addEventListener('pointercancel', handleMouseUp); // Critical for pen input
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleMouseUp);
    document.addEventListener('touchcancel', handleMouseUp);
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
    const row = rows.find(r => r.id === rowId);
    if (!row) {
      console.error('❌ Row not found for rowId:', rowId);
      console.error('❌ Available row IDs:', rows.map(r => r.id));
      return;
    }
    // REMOVED: Competing overlap check - SmartHoverAddProjectBar already validated this is safe
    // SmartHoverAddProjectBar prevents creation in occupied spaces, so we trust its validation
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
          {/* Timeline Header - now handled by AppHeader in MainAppLayout */}
          <AppPageLayout.Header className="h-0 overflow-hidden">
            <div />
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
                      minWidth: mode === 'weeks' 
                        ? `${dates.length * 77}px`
                        : `${dates.length * 40 + 40}px` // Add buffer for days mode
                    }}>
                      <TimelineDateHeaders dates={dates} mode={mode} />
                    </div>
                  </div>
                  {/* Scrollable Content Area */}
                                    {/* Scrollable Content Area */}
                  <div className="flex-1 overflow-x-auto overflow-y-auto light-scrollbar-vertical-only relative" style={{ 
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
                                              isDragging={isDragging}
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
                                        isDragging={isDragging}
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
                  <div className="flex-1 flex flex-col bg-white relative availability-timeline-content" style={{ 
                    minWidth: mode === 'weeks'
                      ? `${dates.length * 77}px`
                      : `${dates.length * 40 + 40}px` // Add buffer for days mode
                  }}>
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
                  isDragging={isDragging}
                  stopAutoScroll={stopAutoScroll}
                />
              </Card>
              {/* Timeline Scrollbar - Outside the cards, at bottom of viewport */}
              <div className="mt-4">
                <PerformanceStatus className="mt-2" />
              </div>
            </div>
          </AppPageLayout.Content>
        </AppPageLayout>
        {/* Modals */}
        <React.Suspense fallback={<div>Loading...</div>}>
          <ProjectModal
            isOpen={!!creatingNewProject}
            onClose={() => setCreatingNewProject(null)}
            groupId={creatingNewProject?.groupId || null}
            rowId={creatingNewProject?.rowId}
          />
          {/* Project Edit Modal */}
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
          {/* Holiday Edit Modal */}
          <HolidayModal
            isOpen={!!editingHolidayId}
            onClose={() => setEditingHolidayId(null)}
            holidayId={editingHolidayId || undefined}
          />
        </React.Suspense>
      </TooltipProvider>
    </DndProvider>
  );
}