/**
 * Timeline Viewport Calculation Service
 * 
 * @deprecated Use TimelineViewport from @/services instead
 * This is a migration wrapper - will be removed after imports updated
 */

import { TimelineViewport } from '../../ui/TimelineViewport';

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
 * @deprecated Use TimelineViewport from @/services instead
 * Migration wrapper - delegates to new UI service
 */
export class TimelineViewportService {
  
  /**
   * @deprecated Use TimelineViewport.calculateDynamicViewportSize
   */
  static calculateDynamicViewportSize(params: {
    sidebarCollapsed: boolean;
    mode: 'days' | 'weeks';
    availableWidth?: number;
  }): number {
    console.warn('TimelineViewportService.calculateDynamicViewportSize is deprecated. Use TimelineViewport from @/services');
    return TimelineViewport.calculateDynamicViewportSize(params);
  }

  /**
   * @deprecated Use TimelineViewport.calculateVisibleColumns
   */
  static calculateVisibleColumns(params: {
    sidebarCollapsed: boolean;
    mode: 'days' | 'weeks';
    availableWidth?: number;
  }): number {
    console.warn('TimelineViewportService.calculateVisibleColumns is deprecated. Use TimelineViewport from @/services');
    return TimelineViewport.calculateVisibleColumns(params);
  }

  /**
   * @deprecated Use TimelineViewport.generateTimelineData
   */
  static generateTimelineData(params: {
    projects: any[];
    viewportStart: Date;
    viewportDays: number;
    mode: 'days' | 'weeks';
    sidebarCollapsed: boolean;
    availableWidth?: number;
  }): {
    dates: Date[];
    viewportEnd: Date;
    filteredProjects: any[];
    mode: 'days' | 'weeks';
    actualViewportStart: Date;
  } {
    console.warn('TimelineViewportService.generateTimelineData is deprecated. Use TimelineViewport from @/services');
    return TimelineViewport.generateTimelineData(params);
  }

  /**
   * @deprecated Use TimelineViewport.calculateNavigationTarget
   */
  static calculateNavigationTarget(params: ViewportNavigationParams): { start: Date; end: Date } {
    console.warn('TimelineViewportService.calculateNavigationTarget is deprecated. Use TimelineViewport from @/services');
    return TimelineViewport.calculateNavigationTarget(params);
  }

  /**
   * @deprecated Use TimelineViewport.calculateAnimationDuration
   */
  static calculateAnimationDuration(startTime: number, targetTime: number): number {
    console.warn('TimelineViewportService.calculateAnimationDuration is deprecated. Use TimelineViewport from @/services');
    return TimelineViewport.calculateAnimationDuration(startTime, targetTime);
  }

  /**
   * @deprecated Use TimelineViewport.shouldSkipAnimation
   */
  static shouldSkipAnimation(currentTime: number, targetTime: number): boolean {
    console.warn('TimelineViewportService.shouldSkipAnimation is deprecated. Use TimelineViewport from @/services');
    return TimelineViewport.shouldSkipAnimation(currentTime, targetTime);
  }

  /**
   * @deprecated Use TimelineViewport.calculateTodayTarget
   */
  static calculateTodayTarget(params: {
    currentDate: Date;
    viewportDays: number;
    timelineMode: 'days' | 'weeks';
  }): { start: Date; end: Date } {
    console.warn('TimelineViewportService.calculateTodayTarget is deprecated. Use TimelineViewport from @/services');
    return TimelineViewport.calculateTodayTarget(params);
  }

  /**
   * @deprecated Use TimelineViewport.calculateProjectScrollTarget
   */
  static calculateProjectScrollTarget(params: ProjectScrollParams): { start: Date; end: Date } {
    console.warn('TimelineViewportService.calculateProjectScrollTarget is deprecated. Use TimelineViewport from @/services');
    return TimelineViewport.calculateProjectScrollTarget(params);
  }

  /**
   * @deprecated Use TimelineViewport.calculateAutoScrollConfig
   */
  static calculateAutoScrollConfig(timelineMode: 'days' | 'weeks'): AutoScrollConfig {
    console.warn('TimelineViewportService.calculateAutoScrollConfig is deprecated. Use TimelineViewport from @/services');
    return TimelineViewport.calculateAutoScrollConfig(timelineMode);
  }

  /**
   * @deprecated Use TimelineViewport.calculateAutoScrollTrigger
   */
  static calculateAutoScrollTrigger(params: AutoScrollTriggerParams): {
    shouldScroll: boolean;
    direction: 'left' | 'right' | null;
  } {
    console.warn('TimelineViewportService.calculateAutoScrollTrigger is deprecated. Use TimelineViewport from @/services');
    return TimelineViewport.calculateAutoScrollTrigger(params);
  }

  /**
   * @deprecated Use TimelineViewport.calculateAutoScrollPosition
   */
  static calculateAutoScrollPosition(params: {
    currentStart: Date;
    direction: 'left' | 'right';
    scrollAmount: number;
    timelineMode: 'days' | 'weeks';
  }): Date {
    console.warn('TimelineViewportService.calculateAutoScrollPosition is deprecated. Use TimelineViewport from @/services');
    return TimelineViewport.calculateAutoScrollPosition(params);
  }

  /**
   * @deprecated Use TimelineViewport.checkViewportBlocking
   */
  static checkViewportBlocking(): ViewportBlockingState {
    console.warn('TimelineViewportService.checkViewportBlocking is deprecated. Use TimelineViewport from @/services');
    return TimelineViewport.checkViewportBlocking();
  }

  /**
   * @deprecated Use TimelineViewport.calculateViewportPerformanceMetrics
   */
  static calculateViewportPerformanceMetrics(params: {
    projectCount: number;
    viewportDays: number;
    mode: 'days' | 'weeks';
  }): {
    complexity: 'low' | 'medium' | 'high';
    recommendedOptimizations: string[];
  } {
    console.warn('TimelineViewportService.calculateViewportPerformanceMetrics is deprecated. Use TimelineViewport from @/services');
    return TimelineViewport.calculateViewportPerformanceMetrics(params);
  }

  /**
   * @deprecated Use TimelineViewport.formatDateRange
   */
  static formatDateRange(startDate: Date, endDate: Date): string {
    console.warn('TimelineViewportService.formatDateRange is deprecated. Use TimelineViewport from @/services');
    return TimelineViewport.formatDateRange(startDate, endDate);
  }
}
