/**
 * UI Timeline Viewport Service
 * Handles all viewport positioning, navigation, and animation calculations for timeline views
 * Migrated from legacy/timeline/timelineViewportService.ts
 */
import { formatDateRange } from '@/utils/dateFormatUtils';
// Types for viewport operations
export interface ViewportPosition {
  start: Date;
  end: Date;
  dayCount: number;
}
export interface ScrollAnimation {
  startTime: number;
  startPosition: number;
  targetPosition: number;
  duration: number;
  isActive: boolean;
}
export interface AutoScrollConfig {
  direction: 'left' | 'right';
  scrollAmount: number;
  intervalMs: number;
  threshold: number;
}
export interface ViewportNavigationParams {
  currentViewportStart: Date;
  viewportDays: number;
  direction: 'prev' | 'next';
  timelineMode: 'days' | 'weeks';
}
export interface DateSelectionParams {
  selectedDate: Date;
  currentViewportStart: Date;
  viewportDays: number;
  timelineMode: 'days' | 'weeks';
}
export interface ProjectScrollParams {
  projectStartDate: Date;
  currentViewportStart: Date;
  timelineMode: 'days' | 'weeks';
}
export interface AutoScrollTriggerParams {
  mouseX: number;
  timelineContentRect: DOMRect;
  threshold?: number;
}
export interface ViewportBlockingState {
  isBlocked: boolean;
  reason?: string;
}
/**
 * Timeline Viewport Management Service
 * Provides viewport calculations, navigation, and animation utilities
 */
export class TimelineViewport {
  // Constants for viewport calculations
  private static readonly MIN_DAY_COLUMN_WIDTH = 40;
  private static readonly MIN_WEEK_COLUMN_WIDTH = 77;
  private static readonly MIN_VIEWPORT_DAYS = 7;
  private static readonly MAX_VIEWPORT_DAYS = 60;
  private static readonly MIN_VIEWPORT_WEEKS = 4;
  private static readonly MAX_VIEWPORT_WEEKS = 30;
  private static readonly SIDEBAR_WIDTH = 280;
  private static readonly COLLAPSED_SIDEBAR_WIDTH = 48;
  private static readonly VIEWPORT_MARGINS = 100;
  /**
   * Calculate dynamic viewport size based on available screen space
   */
  static calculateDynamicViewportSize(params: {
    timelineSidebarCollapsed: boolean;
    mainSidebarCollapsed: boolean;
    mode: 'days' | 'weeks';
    availableWidth?: number;
  }): number {
    const { timelineSidebarCollapsed, mainSidebarCollapsed, mode, availableWidth } = params;
    const viewportWidth = availableWidth ?? window.innerWidth;
    const timelineSidebarWidth = timelineSidebarCollapsed ? this.COLLAPSED_SIDEBAR_WIDTH : this.SIDEBAR_WIDTH;
    const mainSidebarWidth = mainSidebarCollapsed ? 64 : 192; // Main app sidebar widths (w-16 = 64px, w-48 = 192px)
    const calculatedAvailableWidth = Math.max(600, viewportWidth - mainSidebarWidth - timelineSidebarWidth - this.VIEWPORT_MARGINS);
    if (mode === 'weeks') {
      const completeWeekColumns = Math.floor(calculatedAvailableWidth / this.MIN_WEEK_COLUMN_WIDTH);
      const weeksWithBuffer = completeWeekColumns + 8;
      const weeks = Math.max(this.MIN_VIEWPORT_WEEKS, Math.min(this.MAX_VIEWPORT_WEEKS, weeksWithBuffer));
      return weeks * 7; // Convert to days
    } else {
      const completeColumns = Math.floor(calculatedAvailableWidth / this.MIN_DAY_COLUMN_WIDTH);
      const daysWithBuffer = completeColumns + 7;
      return Math.max(this.MIN_VIEWPORT_DAYS, Math.min(this.MAX_VIEWPORT_DAYS, daysWithBuffer));
    }
  }
  /**
   * Calculate visible columns that can fit in the timeline display
   */
  static calculateVisibleColumns(params: {
    timelineSidebarCollapsed: boolean;
    mainSidebarCollapsed: boolean;
    mode: 'days' | 'weeks';
    availableWidth?: number;
  }): number {
    const { timelineSidebarCollapsed, mainSidebarCollapsed, mode, availableWidth } = params;
    const viewportWidth = availableWidth ?? window.innerWidth;
    const timelineSidebarWidth = timelineSidebarCollapsed ? this.COLLAPSED_SIDEBAR_WIDTH : this.SIDEBAR_WIDTH;
    const mainSidebarWidth = mainSidebarCollapsed ? 64 : 192;
    const calculatedAvailableWidth = Math.max(600, viewportWidth - mainSidebarWidth - timelineSidebarWidth - this.VIEWPORT_MARGINS);
    if (mode === 'weeks') {
      // Use ceil to include partial final week
      const theoreticalColumns = calculatedAvailableWidth / 72;
      return Math.max(1, Math.ceil(theoreticalColumns));
    } else {
      // For days, use ceil + 1 to show partial final column
      const theoreticalColumns = calculatedAvailableWidth / 40;
      return Math.max(1, Math.ceil(theoreticalColumns) + 1);
    }
  }
  /**
   * Generate timeline data with optimized viewport calculations
   */
  static generateTimelineData(params: {
    projects: any[];
    viewportStart: Date;
    viewportDays: number;
    mode: 'days' | 'weeks';
    timelineSidebarCollapsed: boolean;
    mainSidebarCollapsed: boolean;
    availableWidth?: number;
  }): {
    dates: Date[];
    viewportEnd: Date;
    filteredProjects: any[];
    mode: 'days' | 'weeks';
    actualViewportStart: Date;
  } {
    const { projects, viewportStart, mode, timelineSidebarCollapsed, mainSidebarCollapsed, availableWidth } = params;
    const visibleColumns = this.calculateVisibleColumns({
      timelineSidebarCollapsed,
      mainSidebarCollapsed,
      mode,
      availableWidth
    });
    if (mode === 'weeks') {
      // For weeks mode, show only the visible week columns
      const actualWeeks = visibleColumns;
      // Adjust viewportStart to start of week (Monday)
      const weekStart = new Date(viewportStart);
      const day = weekStart.getDay();
      const daysToSubtract = day === 0 ? 6 : day - 1;
      weekStart.setDate(weekStart.getDate() - daysToSubtract);
      // Generate array of week start dates for visible weeks only
      const dates = [];
      for (let w = 0; w < actualWeeks; w++) {
        const weekDate = new Date(weekStart);
        weekDate.setDate(weekStart.getDate() + (w * 7));
        weekDate.setHours(0, 0, 0, 0);
        dates.push(weekDate);
      }
      // Calculate viewport end based on the last visible week
      const lastWeekStart = dates[dates.length - 1];
      const viewportEnd = new Date(lastWeekStart);
      viewportEnd.setDate(lastWeekStart.getDate() + 6);
      // Filter projects that intersect with viewport
      const filteredProjects = (projects || []).filter(project => {
        const projectStart = new Date(project.startDate);
        const projectEnd = new Date(project.endDate);
        // Project intersects if it starts before viewport ends and ends after viewport starts
        return !(projectEnd < weekStart || projectStart > viewportEnd);
      });
      return {
        dates,
        viewportEnd,
        filteredProjects,
        mode: 'weeks',
        actualViewportStart: weekStart
      };
    } else {
      // Days mode - show visible day columns + partial column
      const actualDays = visibleColumns;
      // // console.log('🔍 Timeline Viewport Days Mode:', {
      //   visibleColumns,
      //   actualDays,
      //   calculatedAvailableWidth: availableWidth ?? window.innerWidth,
      // // });
      // Generate array of dates for visible days only
      const dates = [];
      const actualViewportStart = new Date(viewportStart);
      actualViewportStart.setHours(0, 0, 0, 0);
      for (let d = 0; d < actualDays; d++) {
        const date = new Date(actualViewportStart);
        date.setDate(actualViewportStart.getDate() + d);
        date.setHours(0, 0, 0, 0);
        dates.push(date);
      }
      // // console.log('🔍 Generated dates:', {
      //   count: dates.length,
      //   first: dates[0]?.toDateString(),
      //   last: dates[dates.length - 1]?.toDateString()
      // // });
      // Calculate viewport end
      const viewportEnd = new Date(actualViewportStart);
      viewportEnd.setDate(actualViewportStart.getDate() + actualDays - 1);
      // Filter projects that intersect with viewport
      const filteredProjects = (projects || []).filter(project => {
        const projectStart = new Date(project.startDate);
        const projectEnd = new Date(project.endDate);
        return !(projectEnd < actualViewportStart || projectStart > viewportEnd);
      });
      return {
        dates,
        viewportEnd,
        filteredProjects,
        mode: 'days',
        actualViewportStart
      };
    }
  }
  /**
   * Calculate navigation target for prev/next navigation
   */
  static calculateNavigationTarget(params: {
    currentViewportStart: Date;
    viewportDays: number;
    direction: 'prev' | 'next';
    timelineMode: 'days' | 'weeks';
  }): { start: Date; end: Date } {
    const { currentViewportStart, viewportDays, direction, timelineMode } = params;
    let newStart: Date;
    if (timelineMode === 'weeks') {
      // Navigate by weeks
      const weeksToMove = Math.ceil(viewportDays / 7);
      newStart = new Date(currentViewportStart);
      if (direction === 'next') {
        newStart.setDate(newStart.getDate() + (weeksToMove * 7));
      } else {
        newStart.setDate(newStart.getDate() - (weeksToMove * 7));
      }
    } else {
      // Navigate by days
      newStart = new Date(currentViewportStart);
      if (direction === 'next') {
        newStart.setDate(newStart.getDate() + viewportDays);
      } else {
        newStart.setDate(newStart.getDate() - viewportDays);
      }
    }
    const newEnd = new Date(newStart);
    newEnd.setDate(newStart.getDate() + viewportDays - 1);
    return { start: newStart, end: newEnd };
  }
  /**
   * Calculate animation duration for viewport transitions
   */
  static calculateAnimationDuration(startTime: number, targetTime: number): number {
    const timeDifference = Math.abs(targetTime - startTime);
    const daysDifference = timeDifference / (1000 * 60 * 60 * 24);
    // Base duration 300ms, add 20ms per day, cap at 800ms
    const duration = Math.min(800, 300 + (daysDifference * 20));
    return duration;
  }
  /**
   * Check if animation should be skipped (dates are too close)
   */
  static shouldSkipAnimation(currentTime: number, targetTime: number): boolean {
    const timeDifference = Math.abs(targetTime - currentTime);
    const daysDifference = timeDifference / (1000 * 60 * 60 * 24);
    // Skip animation if moving less than 1 day
    return daysDifference < 1;
  }
  /**
   * Calculate target for "Go to Today" navigation
   */
  static calculateTodayTarget(params: {
    currentDate: Date;
    viewportDays: number;
    timelineMode: 'days' | 'weeks';
  }): { start: Date; end: Date } {
    const { currentDate, viewportDays, timelineMode } = params;
    let start: Date;
    if (timelineMode === 'weeks') {
      // Center today in the week view
      start = new Date(currentDate);
      const weeksToShow = Math.ceil(viewportDays / 7);
      const daysToGoBack = Math.floor((weeksToShow * 7) / 2);
      start.setDate(start.getDate() - daysToGoBack);
      // Adjust to start of week (Monday)
      const day = start.getDay();
      const daysToSubtract = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - daysToSubtract);
    } else {
      // Center today in the days view
      start = new Date(currentDate);
      start.setDate(start.getDate() - Math.floor(viewportDays / 2));
    }
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + viewportDays - 1);
    return { start, end };
  }
  /**
   * Calculate target for scrolling to a specific project
   */
  static calculateProjectScrollTarget(params: {
    projectStartDate: Date;
    currentViewportStart: Date;
    timelineMode: 'days' | 'weeks';
  }): { start: Date; end: Date } {
    const { projectStartDate, timelineMode } = params;
    let start: Date;
    if (timelineMode === 'weeks') {
      // Align to start of week containing project start
      start = new Date(projectStartDate);
      const day = start.getDay();
      const daysToSubtract = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - daysToSubtract);
    } else {
      // Start from project start date
      start = new Date(projectStartDate);
    }
    start.setHours(0, 0, 0, 0);
    // End is not critical for this calculation but we'll provide a reasonable default
    const end = new Date(start);
    end.setDate(start.getDate() + 30); // 30 day window
    return { start, end };
  }
  /**
   * Calculate auto-scroll configuration
   */
  static calculateAutoScrollConfig(timelineMode: 'days' | 'weeks'): {
    direction: 'left' | 'right';
    scrollAmount: number;
    intervalMs: number;
    threshold: number;
  } {
    return {
      direction: 'right', // Default direction
      scrollAmount: timelineMode === 'weeks' ? 7 : 3, // Days to scroll
      intervalMs: 100, // Scroll interval in milliseconds
      threshold: 50 // Pixel threshold from edge
    };
  }
  /**
   * Calculate auto-scroll trigger based on mouse position
   */
  static calculateAutoScrollTrigger(params: {
    mouseX: number;
    timelineContentRect: DOMRect;
    threshold?: number;
  }): {
    shouldScroll: boolean;
    direction: 'left' | 'right' | null;
  } {
    const { mouseX, timelineContentRect, threshold = 50 } = params;
    const leftEdge = timelineContentRect.left + threshold;
    const rightEdge = timelineContentRect.right - threshold;
    if (mouseX < leftEdge) {
      return { shouldScroll: true, direction: 'left' };
    } else if (mouseX > rightEdge) {
      return { shouldScroll: true, direction: 'right' };
    } else {
      return { shouldScroll: false, direction: null };
    }
  }
  /**
   * Calculate new viewport position for auto-scroll
   */
  static calculateAutoScrollPosition(params: {
    currentStart: Date;
    direction: 'left' | 'right';
    scrollAmount: number;
    timelineMode: 'days' | 'weeks';
  }): Date {
    const { currentStart, direction, scrollAmount, timelineMode } = params;
    const newStart = new Date(currentStart);
    const actualScrollAmount = timelineMode === 'weeks' ? scrollAmount * 7 : scrollAmount;
    if (direction === 'left') {
      newStart.setDate(newStart.getDate() - actualScrollAmount);
    } else {
      newStart.setDate(newStart.getDate() + actualScrollAmount);
    }
    return newStart;
  }
  /**
   * Check if viewport operations should be blocked
   */
  static checkViewportBlocking(): {
    isBlocked: boolean;
    reason?: string;
  } {
    // Can add blocking logic here if needed (e.g., during heavy operations)
    return { isBlocked: false };
  }
  /**
   * Calculate viewport performance metrics
   */
  static calculateViewportPerformanceMetrics(params: {
    projectCount: number;
    viewportDays: number;
    mode: 'days' | 'weeks';
  }): {
    complexity: 'low' | 'medium' | 'high';
    recommendedOptimizations: string[];
  } {
    const { projectCount, viewportDays, mode } = params;
    let complexity: 'low' | 'medium' | 'high' = 'low';
    const recommendations: string[] = [];
    // Calculate complexity based on data volume
    const dataPoints = projectCount * viewportDays;
    if (dataPoints > 10000) {
      complexity = 'high';
      recommendations.push('Consider virtualization');
      recommendations.push('Reduce viewport size');
    } else if (dataPoints > 3000) {
      complexity = 'medium';
      recommendations.push('Enable performance monitoring');
    }
    if (mode === 'days' && viewportDays > 45) {
      recommendations.push('Consider switching to weeks mode');
    }
    return {
      complexity,
      recommendedOptimizations: recommendations
    };
  }
  /**
   * Format date range for display
   */
  static formatDateRange(startDate: Date, endDate: Date): string {
    return formatDateRange(startDate, endDate);
  }
}
