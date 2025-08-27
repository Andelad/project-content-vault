/**
 * Timeline Viewport Calculation Service
 * 
 * Centralizes all viewport-related calculations for timeline navigation, 
 * smooth scrolling, auto-scroll during drag operations, and date positioning.
 * 
 * This service extracts complex viewport management logic from TimelineView
 * to improve maintainability and enable comprehensive testing.
 */

import { TIMELINE_CONSTANTS } from '@/constants';

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
 * Timeline Viewport Calculation Service
 * Handles all viewport positioning, navigation, and animation calculations
 */
export class TimelineViewportService {
  
  /**
   * Calculate target viewport position for navigation (prev/next)
   */
  static calculateNavigationTarget(params: ViewportNavigationParams): ViewportPosition {
    const { currentViewportStart, viewportDays, direction } = params;
    
    const targetStart = new Date(currentViewportStart);
    const days = direction === 'prev' ? -viewportDays : viewportDays;
    targetStart.setDate(targetStart.getDate() + days);
    
    const targetEnd = new Date(targetStart);
    targetEnd.setDate(targetStart.getDate() + viewportDays - 1);
    
    return {
      start: targetStart,
      end: targetEnd,
      dayCount: viewportDays
    };
  }

  /**
   * Calculate target viewport to center a selected date
   */
  static calculateDateCenteringTarget(params: DateSelectionParams): ViewportPosition {
    const { selectedDate, viewportDays } = params;
    
    // Normalize the selected date
    const normalizedDate = new Date(selectedDate);
    normalizedDate.setHours(0, 0, 0, 0);
    
    // Calculate target viewport start to center the selected date
    const targetStart = new Date(normalizedDate);
    targetStart.setDate(normalizedDate.getDate() - Math.floor(viewportDays / 4));
    
    const targetEnd = new Date(targetStart);
    targetEnd.setDate(targetStart.getDate() + viewportDays - 1);
    
    return {
      start: targetStart,
      end: targetEnd,
      dayCount: viewportDays
    };
  }

  /**
   * Calculate target viewport for "Go to Today" with mode-specific positioning
   */
  static calculateTodayTarget(params: DateSelectionParams): ViewportPosition {
    const { timelineMode, viewportDays } = params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const targetStart = new Date(today);
    
    if (timelineMode === 'weeks') {
      // In weeks view, we need to position so today's week is the 3rd column
      // First, find the start of today's week (Monday)
      const dayOfWeek = today.getDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert Sunday=0 to Monday=0
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - mondayOffset);
      
      // Position so this week is the 3rd column (2 weeks from left)
      targetStart.setTime(weekStart.getTime());
      targetStart.setDate(weekStart.getDate() - (2 * 7)); // Go back 2 weeks
    } else {
      // In days view, position so today is the 5th column (4 days from left)
      targetStart.setDate(today.getDate() - 4);
    }
    
    const targetEnd = new Date(targetStart);
    targetEnd.setDate(targetStart.getDate() + viewportDays - 1);
    
    return {
      start: targetStart,
      end: targetEnd,
      dayCount: viewportDays
    };
  }

  /**
   * Calculate target viewport for project scrolling (position project start as second visible date)
   */
  static calculateProjectScrollTarget(params: ProjectScrollParams): ViewportPosition {
    const { projectStartDate } = params;
    
    const projectStart = new Date(projectStartDate);
    const targetStart = new Date(projectStart);
    targetStart.setDate(targetStart.getDate() - 1);
    
    // Calculate end based on standard viewport logic
    const targetEnd = new Date(targetStart);
    targetEnd.setDate(targetStart.getDate() + 30); // Assume 30-day viewport
    
    return {
      start: targetStart,
      end: targetEnd,
      dayCount: 30
    };
  }

  /**
   * Calculate animation duration based on distance and mode
   */
  static calculateAnimationDuration(startPosition: number, targetPosition: number, timelineMode: 'days' | 'weeks'): number {
    const daysDifference = Math.abs((targetPosition - startPosition) / (24 * 60 * 60 * 1000));
    
    return Math.min(
      TIMELINE_CONSTANTS.SCROLL_ANIMATION_MAX_DURATION,
      daysDifference * TIMELINE_CONSTANTS.SCROLL_ANIMATION_MS_PER_DAY
    );
  }

  /**
   * Check if animation should be skipped (distance too small)
   */
  static shouldSkipAnimation(startPosition: number, targetPosition: number): boolean {
    const daysDifference = Math.abs((targetPosition - startPosition) / (24 * 60 * 60 * 1000));
    return daysDifference < 1;
  }

  /**
   * Calculate auto-scroll configuration based on timeline mode
   */
  static calculateAutoScrollConfig(timelineMode: 'days' | 'weeks'): AutoScrollConfig {
    return {
      direction: 'left', // Will be overridden based on mouse position
      scrollAmount: timelineMode === 'weeks' ? 7 : 3, // Days to scroll per interval
      intervalMs: 150, // Scroll every 150ms
      threshold: 80 // Pixels from edge to trigger scroll
    };
  }

  /**
   * Determine auto-scroll direction and whether to trigger
   */
  static calculateAutoScrollTrigger(params: AutoScrollTriggerParams): {
    shouldScroll: boolean;
    direction: 'left' | 'right' | null;
    distanceFromEdge: number;
  } {
    const { mouseX, timelineContentRect, threshold = 80 } = params;
    
    const distanceFromLeft = mouseX - timelineContentRect.left;
    const distanceFromRight = timelineContentRect.right - mouseX;
    
    // Check if mouse is within the timeline content area
    if (distanceFromLeft < 0 || distanceFromRight < 0) {
      return {
        shouldScroll: false,
        direction: null,
        distanceFromEdge: 0
      };
    }
    
    // Check for left edge proximity
    if (distanceFromLeft < threshold) {
      return {
        shouldScroll: true,
        direction: 'left',
        distanceFromEdge: distanceFromLeft
      };
    }
    
    // Check for right edge proximity
    if (distanceFromRight < threshold) {
      return {
        shouldScroll: true,
        direction: 'right',
        distanceFromEdge: distanceFromRight
      };
    }
    
    return {
      shouldScroll: false,
      direction: null,
      distanceFromEdge: Math.min(distanceFromLeft, distanceFromRight)
    };
  }

  /**
   * Calculate new viewport position for auto-scroll
   */
  static calculateAutoScrollPosition(
    currentStart: Date, 
    direction: 'left' | 'right', 
    scrollAmount: number
  ): Date {
    const newStart = new Date(currentStart);
    const days = direction === 'left' ? -scrollAmount : scrollAmount;
    newStart.setDate(currentStart.getDate() + days);
    return newStart;
  }

  /**
   * Check if viewport updates should be blocked (e.g., during scrollbar dragging)
   */
  static checkViewportBlocking(): ViewportBlockingState {
    const isBlocked = (window as any).__budgiScrollbarBlocking;
    return {
      isBlocked: !!isBlocked,
      reason: isBlocked ? 'scrollbar is dragging' : undefined
    };
  }

  /**
   * Format date range for display
   */
  static formatDateRange(startDate: Date, endDate: Date): string {
    const sameMonth = startDate.getMonth() === endDate.getMonth();
    const sameYear = startDate.getFullYear() === endDate.getFullYear();
    
    if (sameMonth && sameYear) {
      return `${startDate.toLocaleDateString('en-US', { 
        month: 'long',
        day: 'numeric'
      })} - ${endDate.toLocaleDateString('en-US', { 
        day: 'numeric',
        year: 'numeric'
      })}`;
    } else if (sameYear) {
      return `${startDate.toLocaleDateString('en-US', { 
        month: 'short',
        day: 'numeric'
      })} - ${endDate.toLocaleDateString('en-US', { 
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })}`;
    } else {
      return `${startDate.toLocaleDateString('en-US', { 
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })} - ${endDate.toLocaleDateString('en-US', { 
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })}`;
    }
  }

  /**
   * Initialize default viewport position (centers around current date)
   */
  static initializeDefaultViewport(viewportDays: number): ViewportPosition {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const start = new Date(today);
    start.setDate(today.getDate() - Math.floor(viewportDays / 4));
    
    const end = new Date(start);
    end.setDate(start.getDate() + viewportDays - 1);
    
    return {
      start,
      end,
      dayCount: viewportDays
    };
  }

  /**
   * Validate viewport position constraints
   */
  static validateViewportPosition(position: ViewportPosition): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    
    if (position.start >= position.end) {
      issues.push('Start date must be before end date');
    }
    
    if (position.dayCount <= 0) {
      issues.push('Day count must be positive');
    }
    
    const actualDays = Math.ceil((position.end.getTime() - position.start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (Math.abs(actualDays - position.dayCount) > 1) {
      issues.push(`Day count mismatch: expected ${position.dayCount}, calculated ${actualDays}`);
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Calculate performance metrics for viewport operations
   */
  static calculateViewportPerformanceMetrics(params: {
    timelineMode: 'days' | 'weeks';
    daysCount: number;
    projectsCount: number;
  }): {
    totalCalculations: number;
    estimatedRenderTime: number;
    complexity: 'low' | 'medium' | 'high';
  } {
    const { timelineMode, daysCount, projectsCount } = params;
    
    const totalCalculations = daysCount * projectsCount;
    
    // Estimate render time based on mode and calculations
    const baseTimePerCalculation = timelineMode === 'weeks' ? 0.001 : 0.002; // ms
    const estimatedRenderTime = totalCalculations * baseTimePerCalculation;
    
    let complexity: 'low' | 'medium' | 'high' = 'low';
    if (totalCalculations > 10000) complexity = 'high';
    else if (totalCalculations > 2000) complexity = 'medium';
    
    return {
      totalCalculations,
      estimatedRenderTime,
      complexity
    };
  }

  /**
   * Create smooth animation configuration
   */
  static createAnimationConfig(
    startPosition: number,
    targetPosition: number,
    timelineMode: 'days' | 'weeks'
  ): ScrollAnimation {
    const duration = this.calculateAnimationDuration(startPosition, targetPosition, timelineMode);
    
    return {
      startTime: Date.now(),
      startPosition,
      targetPosition,
      duration,
      isActive: true
    };
  }

  /**
   * Update animation progress
   */
  static updateAnimationProgress(animation: ScrollAnimation): {
    currentPosition: number;
    isComplete: boolean;
    progress: number;
  } {
    const now = Date.now();
    const elapsed = now - animation.startTime;
    const progress = Math.min(elapsed / animation.duration, 1);
    
    // Easing function for smooth animation (ease-out)
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    
    const currentPosition = animation.startPosition + 
      (animation.targetPosition - animation.startPosition) * easedProgress;
    
    return {
      currentPosition,
      isComplete: progress >= 1,
      progress: easedProgress
    };
  }
}
