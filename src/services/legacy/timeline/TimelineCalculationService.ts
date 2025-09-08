/**
 * Timeline UI Calculation Service
 * Handles all visual positioning and sizing calculations for the timeline
 *
 * @deprecated This service has been migrated to calculations/timelineCalculations.ts
 * Use the new functions directly from @/services:
 * - calculateProjectPosition
 * - calculateMilestonePosition
 * - calculateRowHeight
 * - calculateScrollToDate
 * - calculateVisibleDateRange
 * - calculateColumnPositions
 * - calculateDragConstraints
 * - pixelToDate
 * - dateToPixel
 */

import {
  calculateProjectPosition as calculateProjectPositionNew,
  calculateMilestonePosition as calculateMilestonePositionNew,
  calculateRowHeight as calculateRowHeightNew,
  calculateScrollToDate as calculateScrollToDateNew,
  calculateVisibleDateRange as calculateVisibleDateRangeNew,
  calculateColumnPositions as calculateColumnPositionsNew,
  calculateDragConstraints as calculateDragConstraintsNew,
  pixelToDate as pixelToDateNew,
  dateToPixel as dateToPixelNew,
  calculateOptimalColumnWidth as calculateOptimalColumnWidthNew,
  calculateZoomConstraints as calculateZoomConstraintsNew,
  calculateWorkHoursTotal as calculateWorkHoursTotalNew,
  calculateDayWidthPosition as calculateDayWidthPositionNew,
  calculateBaselineVisualOffsets as calculateBaselineVisualOffsetsNew,
  calculateVisualProjectDates as calculateVisualProjectDatesNew,
  calculateTimelineBarPosition as calculateTimelineBarPositionNew,
  calculateWeekProjectIntersection as calculateWeekProjectIntersectionNew
} from '../../calculations/timelineCalculations';

export interface TimelinePosition {
  left: number;
  width: number;
  top?: number;
  height?: number;
}

export interface ViewportConfig {
  startDate: Date;
  endDate: Date;
  columnWidth: number;
  totalWidth: number;
  mode: 'days' | 'weeks';
}

export class TimelineCalculationService {
  /**
   * Calculate position for a project bar in the timeline
   * @deprecated Use calculateProjectPosition from @/services instead
   */
  static calculateProjectPosition(
    projectStart: Date,
    projectEnd: Date,
    viewport: ViewportConfig
  ): TimelinePosition {
    console.warn('TimelineCalculationService.calculateProjectPosition is deprecated. Use calculateProjectPosition from @/services');
    return calculateProjectPositionNew(projectStart, projectEnd, viewport);
  }

  /**
   * Calculate position for a milestone diamond
   * @deprecated Use calculateMilestonePosition from @/services instead
   */
  static calculateMilestonePosition(
    milestoneDate: Date,
    projectStart: Date,
    projectPosition: TimelinePosition,
    viewport: ViewportConfig
  ): TimelinePosition {
    console.warn('TimelineCalculationService.calculateMilestonePosition is deprecated. Use calculateMilestonePosition from @/services');
    return calculateMilestonePositionNew(milestoneDate, projectStart, projectPosition, viewport);
  }

  /**
   * Calculate row height based on project workload
   * @deprecated Use calculateRowHeight from @/services instead
   */
  static calculateRowHeight(dailyHours: number, baseHeight: number = 40): number {
    console.warn('TimelineCalculationService.calculateRowHeight is deprecated. Use calculateRowHeight from @/services');
    return calculateRowHeightNew(dailyHours, baseHeight);
  }

  /**
   * Calculate timeline scroll position to center on date
   * @deprecated Use calculateScrollToDate from @/services instead
   */
  static calculateScrollToDate(
    targetDate: Date,
    viewport: ViewportConfig,
    containerWidth: number
  ): number {
    console.warn('TimelineCalculationService.calculateScrollToDate is deprecated. Use calculateScrollToDate from @/services');
    return calculateScrollToDateNew(targetDate, viewport, containerWidth);
  }

  /**
   * Calculate visible date range for the current viewport
   * @deprecated Use calculateVisibleDateRange from @/services instead
   */
  static calculateVisibleDateRange(
    scrollLeft: number,
    containerWidth: number,
    viewport: ViewportConfig
  ): { start: Date; end: Date } {
    console.warn('TimelineCalculationService.calculateVisibleDateRange is deprecated. Use calculateVisibleDateRange from @/services');
    return calculateVisibleDateRangeNew(scrollLeft, containerWidth, viewport);
  }

  /**
   * Calculate column positions for timeline grid
   * @deprecated Use calculateColumnPositions from @/services instead
   */
  static calculateColumnPositions(
    viewport: ViewportConfig,
    visibleColumns: number
  ): Array<{ date: Date; position: number; label: string }> {
    console.warn('TimelineCalculationService.calculateColumnPositions is deprecated. Use calculateColumnPositions from @/services');
    return calculateColumnPositionsNew(viewport, visibleColumns);
  }

  /**
   * Calculate drag constraints for a project
   * @deprecated Use calculateDragConstraints from @/services instead
   */
  static calculateDragConstraints(
    project: { startDate: Date; endDate: Date },
    viewport: ViewportConfig,
    containerBounds: { left: number; right: number }
  ): { minLeft: number; maxLeft: number } {
    console.warn('TimelineCalculationService.calculateDragConstraints is deprecated. Use calculateDragConstraints from @/services');
    return calculateDragConstraintsNew(project, viewport, containerBounds);
  }

  /**
   * Convert pixel position to date
   * @deprecated Use pixelToDate from @/services instead
   */
  static pixelToDate(
    pixelPosition: number,
    viewport: ViewportConfig
  ): Date {
    console.warn('TimelineCalculationService.pixelToDate is deprecated. Use pixelToDate from @/services');
    return pixelToDateNew(pixelPosition, viewport);
  }

  /**
   * Convert date to pixel position
   * @deprecated Use dateToPixel from @/services instead
   */
  static dateToPixel(
    date: Date,
    viewport: ViewportConfig
  ): number {
    console.warn('TimelineCalculationService.dateToPixel is deprecated. Use dateToPixel from @/services');
    return dateToPixelNew(date, viewport);
  }

  /**
   * Calculate offset between two dates based on timeline mode
   */
  private static getDateOffset(
    targetDate: Date,
    baseDate: Date,
    mode: 'days' | 'weeks'
  ): number {
    const timeDiff = targetDate.getTime() - baseDate.getTime();
    const daysDiff = Math.floor(timeDiff / (24 * 60 * 60 * 1000));
    
    if (mode === 'weeks') {
      return Math.floor(daysDiff / 7);
    }
    
    return daysDiff;
  }

  /**
   * Add offset to a date based on timeline mode
   */
  private static addDateOffset(
    baseDate: Date,
    offset: number,
    mode: 'days' | 'weeks'
  ): Date {
    const result = new Date(baseDate);
    
    if (mode === 'weeks') {
      result.setDate(result.getDate() + offset * 7);
    } else {
      result.setDate(result.getDate() + offset);
    }
    
    return result;
  }

  /**
   * Format date label for timeline columns
   */
  private static formatDateLabel(date: Date, mode: 'days' | 'weeks'): string {
    if (mode === 'weeks') {
      const options: Intl.DateTimeFormatOptions = { 
        month: 'short', 
        day: 'numeric' 
      };
      return date.toLocaleDateString('en-US', options);
    } else {
      const options: Intl.DateTimeFormatOptions = { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      };
      return date.toLocaleDateString('en-US', options);
    }
  }

  /**
   * Calculate optimal column width based on container size
   * @deprecated Use calculateOptimalColumnWidth from @/services instead
   */
  static calculateOptimalColumnWidth(
    containerWidth: number,
    desiredColumns: number,
    minColumnWidth: number = 40,
    maxColumnWidth: number = 120
  ): number {
    console.warn('TimelineCalculationService.calculateOptimalColumnWidth is deprecated. Use calculateOptimalColumnWidth from @/services');
    return calculateOptimalColumnWidthNew(containerWidth, desiredColumns, minColumnWidth, maxColumnWidth);
  }

  /**
   * Calculate timeline zoom level constraints
   * @deprecated Use calculateZoomConstraints from @/services instead
   */
  static calculateZoomConstraints(
    containerWidth: number,
    totalTimespan: number
  ): { minZoom: number; maxZoom: number } {
    console.warn('TimelineCalculationService.calculateZoomConstraints is deprecated. Use calculateZoomConstraints from @/services');
    return calculateZoomConstraintsNew(containerWidth, totalTimespan);
  }

  /**
   * Calculate total work hours for a day
   * @deprecated Use calculateWorkHoursTotal from @/services instead
   */
  static calculateWorkHoursTotal(workHours: any[]): number {
    console.warn('TimelineCalculationService.calculateWorkHoursTotal is deprecated. Use calculateWorkHoursTotal from @/services');
    return calculateWorkHoursTotalNew(workHours);
  }

  /**
   * Calculate left position for a day within a week
   * @deprecated Use calculateDayWidthPosition from @/services instead
   */
  static calculateDayWidthPosition(dayWidths: number[], dayOfWeek: number): number {
    console.warn('TimelineCalculationService.calculateDayWidthPosition is deprecated. Use calculateDayWidthPosition from @/services');
    return calculateDayWidthPositionNew(dayWidths, dayOfWeek);
  }

  /**
   * Calculate baseline visual offsets for drag operations
   * @deprecated Use calculateBaselineVisualOffsets from @/services instead
   */
  static calculateBaselineVisualOffsets(
    positions: any,
    isDragging: boolean,
    dragState: any,
    projectId: string,
    mode: 'days' | 'weeks' = 'days'
  ): any {
    console.warn('TimelineCalculationService.calculateBaselineVisualOffsets is deprecated. Use calculateBaselineVisualOffsets from @/services');
    return calculateBaselineVisualOffsetsNew(positions, isDragging, dragState, projectId, mode);
  }

  /**
   * Calculate visual project dates with consolidated offset logic
   * @deprecated Use calculateVisualProjectDates from @/services instead
   */
  static calculateVisualProjectDates(
    project: any,
    isDragging: boolean,
    dragState: any
  ): { visualProjectStart: Date; visualProjectEnd: Date } {
    console.warn('TimelineCalculationService.calculateVisualProjectDates is deprecated. Use calculateVisualProjectDates from @/services');
    return calculateVisualProjectDatesNew(project, isDragging, dragState);
  }

  /**
   * Calculate timeline bar position for a project
   * @deprecated Use calculateTimelineBarPosition from @/services instead
   */
  static calculateTimelineBarPosition(
    dates: Date[],
    project: { startDate: Date; endDate: Date }
  ): { startIndex: number; width: number } {
    console.warn('TimelineCalculationService.calculateTimelineBarPosition is deprecated. Use calculateTimelineBarPosition from @/services');
    return calculateTimelineBarPositionNew(dates, project);
  }

  /**
   * Calculate week-project intersection data for weeks view
   * @deprecated Use calculateWeekProjectIntersection from @/services instead
   */
  static calculateWeekProjectIntersection(
    date: Date,
    visualProjectStart: Date,
    visualProjectEnd: Date,
    isWorkingDay: (date: Date) => boolean
  ): {
    intersects: boolean;
    workingDaysInWeek: Date[];
    weekStart?: Date;
    weekEnd?: Date;
  } {
    console.warn('TimelineCalculationService.calculateWeekProjectIntersection is deprecated. Use calculateWeekProjectIntersection from @/services');
    return calculateWeekProjectIntersectionNew(date, visualProjectStart, visualProjectEnd, isWorkingDay);
  }
}
